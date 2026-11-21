/* global __CDI_BUILD_ID__ */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto-actualización transparente de versión PWA/Vercel (0 consumo Supabase, preserva sesión y caché localforage)
if (typeof window !== 'undefined') {
  const localBuildId = typeof __CDI_BUILD_ID__ !== 'undefined' ? String(__CDI_BUILD_ID__) : null;
  let isReloading = false;

  const clearStaticCachesAndReloadOnce = async (remoteVersion) => {
    if (isReloading) return;
    try {
      const alreadyReloaded =
        window.sessionStorage &&
        window.sessionStorage.getItem('cdi_reloaded_version') === String(remoteVersion);
      if (alreadyReloaded) return;
      if (window.sessionStorage) {
        window.sessionStorage.setItem('cdi_reloaded_version', String(remoteVersion));
      }
    } catch (_) {
      // Continuar incluso si sessionStorage está restringido
    }

    isReloading = true;
    try {
      // Limpiar ÚNICAMENTE cachés de assets estáticos (NO tocar localforage ni sesión)
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (reg) => {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            await reg.update().catch(() => {});
          })
        );
      }
    } catch (_) {
      // Continuar con recarga aunque falle limpieza parcial
    }
    window.location.reload();
  };

  const checkAppVersionOnBoot = async () => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .getRegistrations()
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

      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;

      const remote = await res.json();
      const remoteVersion = String(remote?.version || remote?.buildId || '').trim();
      if (!remoteVersion) return;

      let storedVersion = null;
      try {
        storedVersion = window.localStorage.getItem('cdi_app_version');
      } catch (_) {}

      const differsFromStored = Boolean(storedVersion && storedVersion !== remoteVersion);
      const differsFromBundle = Boolean(localBuildId && localBuildId !== remoteVersion);

      try {
        window.localStorage.setItem('cdi_app_version', remoteVersion);
      } catch (_) {}

      if (differsFromStored || differsFromBundle) {
        await clearStaticCachesAndReloadOnce(remoteVersion);
      }
    } catch (_) {
      // Sin conexión o version.json aún no disponible en entorno de desarrollo
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

  // Consultar version.json una sola vez en el arranque inicial (sin polling repetitivo)
  checkAppVersionOnBoot();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
