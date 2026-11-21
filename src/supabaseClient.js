import { createClient } from '@supabase/supabase-js';

// Fallback to hardcoded string to avoid breaking Vercel immediately, but prioritize ENV
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://klapeabwtphxqdspiggv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt';

/**
 * Purga cualquier rastro residual de sesiones/tokens/usuarios recientes en localStorage y sessionStorage
 * para garantizar 0 persistencia de credenciales o sesiones en el equipo.
 */
export const purgeBrowserAuthArtifacts = () => {
  if (typeof window === 'undefined') return;
  const stores = [window.localStorage, window.sessionStorage];
  for (const store of stores) {
    if (!store) continue;
    try {
      const keysToRemove = [];
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i);
        if (!k) continue;
        if (
          k === 'cdi_supervisor_session' ||
          k === 'cdi_recent_logins' ||
          k === 'supabase.auth.token' ||
          /^sb-.*-auth-token/i.test(k)
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => store.removeItem(k));
    } catch (_) {
      // Ignorar si el almacenamiento está restringido por el navegador
    }
  }
};

// Limpiar de inmediato cualquier sesión heredada en disco antes de inicializar el cliente
purgeBrowserAuthArtifacts();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
