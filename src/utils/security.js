import DOMPurify from 'dompurify';
import CryptoJS from 'crypto-js';

export const SESSION_SECRET = 'cdi_industrial_vault_2026';

export const sanitizeInput = (text) =>
  DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

export const deepSanitize = (obj) => {
  if (typeof obj === 'string') return sanitizeInput(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (let key in obj) newObj[key] = deepSanitize(obj[key]);
    return newObj;
  }
  return obj;
};

export const verifySignature = (profile, signature) => {
  if (!profile || !signature) return false;
  const expectedSig = CryptoJS.SHA256(JSON.stringify(profile) + SESSION_SECRET).toString();
  return expectedSig === signature;
};

export const signProfile = (profile) => {
  return CryptoJS.SHA256(JSON.stringify(profile) + SESSION_SECRET).toString();
};

/**
 * Verifica si un área/rol corresponde a Supervisor de Pintura Líquida o Administrador
 */
export const isPaintSupervisorOrAdminRole = (rawRole = '') => {
  const norm = String(rawRole || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!norm) return false;
  return (
    norm.includes('ADMINISTRADOR') ||
    norm === 'ADMIN' ||
    norm.includes('TODOS') ||
    norm.includes('PINTURA LIQUIDA')
  );
};

/**
 * Verifica las credenciales de un usuario directamente contra Supabase Auth REST API
 * de forma 100% aislada (sin sobrescribir la sesión activa ni disparar el gestor de contraseñas del navegador).
 * Jamás permite claves comodín ni longitudes arbitrarias.
 */
export const verifySupervisorCredentials = async ({
  emailOrUsername = '',
  password = '',
  fallbackProfile = null,
  requirePaintOrAdmin = true
}) => {
  const cleanPass = String(password || '').trim();
  if (!cleanPass) {
    return {
      ok: false,
      error: 'Debes ingresar tu clave de usuario.'
    };
  }

  let rawUser = String(emailOrUsername || fallbackProfile?.email || '').trim().toLowerCase();
  if (!rawUser) {
    return {
      ok: false,
      error: 'No se identificó el usuario. Ingresa tu usuario corporativo (@cdiexhibiciones.co).'
    };
  }

  const emailFull = rawUser.includes('@') ? rawUser : `${rawUser}@cdiexhibiciones.co`;

  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || 'https://klapeabwtphxqdspiggv.supabase.co';
  const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt';

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey
      },
      body: JSON.stringify({
        email: emailFull,
        password: cleanPass
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || !data.user) {
      return {
        ok: false,
        error: '❌ Clave incorrecta o usuario no válido. Acceso denegado.'
      };
    }

    const userMeta = data.user.user_metadata || {};
    const resolvedRole =
      userMeta.rol ||
      userMeta.area ||
      (emailFull === String(fallbackProfile?.email || '').toLowerCase()
        ? fallbackProfile?.area || fallbackProfile?.rol
        : '') ||
      'GENERAL';
    const resolvedName =
      userMeta.nombre ||
      userMeta.name ||
      fallbackProfile?.name ||
      fallbackProfile?.nombre ||
      emailFull;

    if (requirePaintOrAdmin && !isPaintSupervisorOrAdminRole(resolvedRole)) {
      return {
        ok: false,
        error: `⛔ Acceso restringido: El usuario "${resolvedName}" pertenece al área "${resolvedRole}". Esta acción requiere clave de Supervisor de Pintura Líquida o Administrador.`
      };
    }

    return {
      ok: true,
      user: {
        id: data.user.id,
        email: emailFull,
        nombre: resolvedName,
        rol: resolvedRole
      }
    };
  } catch (err) {
    console.error('Error verificando credenciales en Supabase Auth:', err);
    return {
      ok: false,
      error: 'Error de conexión al verificar credenciales con el servidor.'
    };
  }
};
