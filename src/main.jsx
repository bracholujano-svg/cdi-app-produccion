/* global __CDI_BUILD_ID__ */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Al abrir, volver a la app o periódicamente: verificar versión desplegada en el servidor, purgar cachés/SW viejos y forzar sincronización de datos
if (typeof window !== 'undefined') {
  const localBuildId = typeof __CDI_BUILD_ID__ !== 'undefined' ? String(__CDI_BUILD_ID__) : null;
  let isCheckingUpdate = false;
  let isReloading = false;

  const purgeCachesAndReload = async (remoteBuildId) => {
    if (isReloading) return;
    isReloading = true;
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem('cdi_reloading_build', String(remoteBuildId));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (_) {
      // Continuar con recarga aunque falle limpieza parcial
    }
    window.location.reload();
  };

  let lastVersionCheckAt = 0;

  const verifyLatestBuild = async (force = false) => {
    const now = Date.now();
    if (!force && lastVersionCheckAt > 0 && now - lastVersionCheckAt < 120000) {
      return;
    }
    lastVersionCheckAt = now;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
          registrations.forEach((reg) => {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            reg.update().catch(() => {});
          });
        })
        .catch(() => {});
    }

    if (!localBuildId || isCheckingUpdate || isReloading) return;
    isCheckingUpdate = true;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const remote = await res.json();
        const remoteBuildId = remote?.buildId ? String(remote.buildId) : null;
        if (remoteBuildId && remoteBuildId !== localBuildId) {
          const alreadyAttempted =
            window.sessionStorage &&
            window.sessionStorage.getItem('cdi_reloading_build') === remoteBuildId;
          if (!alreadyAttempted) {
            await purgeCachesAndReload(remoteBuildId);
            return;
          }
        }
      }
    } catch (_) {
      // Sin conexión o version.json aún no disponible en entorno local
    } finally {
      isCheckingUpdate = false;
    }
  };

  if ('serviceWorker' in navigator) {
    let swRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (swRefreshing || isReloading) return;
      swRefreshing = true;
      window.location.reload();
    });
  }

  // Verificar nueva versión desplegada únicamente al cargar, al volver tras >= 2 min, o cada 10 minutos.
  // NUNCA disparar `cdi-force-sync` ni purgar cachés de datos periódicamente (evita fuga masiva de Egress en Supabase).
  window.addEventListener('load', () => verifyLatestBuild(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      verifyLatestBuild(false);
    }
  });
  window.setInterval(() => verifyLatestBuild(false), 600000);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
