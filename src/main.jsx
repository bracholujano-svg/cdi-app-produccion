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

  const verifyLatestBuildAndSync = async () => {
    if ('caches' in window) {
      caches.delete('supabase-api-cache').catch(() => {});
    }

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

    window.dispatchEvent(new CustomEvent('cdi-force-sync'));

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

  window.addEventListener('load', verifyLatestBuildAndSync);
  window.addEventListener('focus', verifyLatestBuildAndSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      verifyLatestBuildAndSync();
    }
  });
  window.setInterval(verifyLatestBuildAndSync, 60000);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
