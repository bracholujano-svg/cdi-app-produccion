import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Al abrir o volver a la app: limpiar caché obsoleta de API, verificar versión nueva del Service Worker y forzar sincronización de datos
if (typeof window !== 'undefined') {
  if ('caches' in window) {
    caches.delete('supabase-api-cache').catch(() => {});
  }

  if ('serviceWorker' in navigator) {
    let isRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isRefreshing) return;
      isRefreshing = true;
      window.location.reload();
    });

    const checkAppUpdatesAndSync = () => {
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
      window.dispatchEvent(new CustomEvent('cdi-force-sync'));
    };

    window.addEventListener('load', checkAppUpdatesAndSync);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkAppUpdatesAndSync();
      }
    });
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
