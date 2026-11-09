import DOMPurify from 'dompurify';
import CryptoJS from 'crypto-js';

export const SESSION_SECRET =
  import.meta.env.VITE_SESSION_SECRET || 'cdi_industrial_vault_2026';

export const sanitizeInput = (text) =>
  DOMPurify.sanitize(String(text ?? ''), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

export const deepSanitize = (obj) => {
  if (typeof obj === 'string') return sanitizeInput(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (let key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = deepSanitize(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

/**
 * 1. VALIDACIÓN ESTRICTA DE INPUTS DE USUARIO
 */
export const validateSafeText = (value, maxLengthOrOptions = 250) => {
  if (value === null || value === undefined) return '';
  const maxLength =
    typeof maxLengthOrOptions === 'number'
      ? maxLengthOrOptions
      : Number(maxLengthOrOptions?.maxLength) || 250;
  const cleaned = sanitizeInput(String(value))
    // Eliminar caracteres de control invisibles excepto saltos de línea básicos
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  return cleaned.slice(0, maxLength);
};

/**
 * Escapa caracteres comodín y operadores de PostgREST (% _ , ( ) * \) antes de usar .ilike()
 */
export const escapePostgrestFilter = (value, maxLength = 60) => {
  const safe = validateSafeText(value, maxLength);
  return safe.replace(/[%_(),*\\;'"`]/g, '').trim();
};

/**
 * Detecta patrones clásicos de Inyección SQL (SQLi) o comandos maliciosos en inputs críticos
 */
export const containsSqlInjectionPattern = (value = '') => {
  const str = String(value || '');
  // Detectar comillas simples/dobles combinadas con operadores SQL, comentarios SQL (-- o /* */), punto y coma o palabras clave de ataque
  const sqliRegex =
    /('|"|;|--|\/\*|\*\/|\b(UNION\s+SELECT|DROP\s+TABLE|ALTER\s+TABLE|INSERT\s+INTO|DELETE\s+FROM|OR\s+1\s*=\s*1|AND\s+1\s*=\s*1|EXEC\s*\(|SLEEP\s*\(|BENCHMARK\s*\()\b)/i;
  return sqliRegex.test(str);
};

export const validateCorporateEmail = (rawInput = '') => {
  if (containsSqlInjectionPattern(rawInput)) {
    return {
      valid: false,
      email: '',
      error: 'Entrada bloqueada por contener caracteres no permitidos.'
    };
  }
  const clean = validateSafeText(rawInput, 120).toLowerCase().replace(/\s+/g, '');
  if (!clean) {
    return { valid: false, email: '', error: 'Ingresa tu usuario corporativo.' };
  }
  const emailFull = clean.includes('@') ? clean : `${clean}@cdiexhibiciones.co`;
  // Lista blanca estricta: solo letras, números, punto, guion y guion bajo (bloquea ', ", ;, =, paréntesis, etc.)
  const strictEmailAllowlist = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  if (!strictEmailAllowlist.test(emailFull)) {
    return {
      valid: false,
      email: emailFull,
      error: 'Formato de usuario o correo inválido (solo letras, números, puntos y guiones).'
    };
  }
  return { valid: true, email: emailFull, error: null };
};

export const validatePositiveNumber = (value, { min = 0.01, max = 1000000 } = {}) => {
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num) || num < min || num > max) {
    return { valid: false, value: 0 };
  }
  return { valid: true, value: num };
};

/**
 * 2. MOTOR DE RATE-LIMITING POR USUARIO Y HUELLA DE CLIENTE
 * Protege contra fuerza bruta en login, validación de PIN y abuso de consultas API.
 */
const RATE_LIMIT_STORAGE_KEY = 'cdi_sec_ratelimit_v1';

const getClientFingerprint = () => {
  if (typeof window === 'undefined') return 'srv';
  const raw = [
    navigator.userAgent || '',
    navigator.language || '',
    window.screen?.width || 0,
    window.screen?.height || 0
  ].join('|');
  return CryptoJS.SHA256(raw).toString().slice(0, 12);
};

const readRateLimitStore = () => {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (_) {
    return {};
  }
};

const writeRateLimitStore = (store) => {
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(store));
  } catch (_) {}
};

export const checkRateLimit = (
  actionScope,
  identifier = 'anon',
  { maxAttempts = 5, windowMs = 5 * 60 * 1000, lockoutMs = 3 * 60 * 1000 } = {}
) => {
  const now = Date.now();
  const fp = getClientFingerprint();
  const normId = String(identifier || 'anon').trim().toLowerCase() || 'anon';
  const key = `${actionScope}::${normId}::${fp}`;

  const store = readRateLimitStore();
  const entry = store[key] || { attempts: [], lockedUntil: 0 };

  if (entry.lockedUntil && now < entry.lockedUntil) {
    const remainingSec = Math.ceil((entry.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingSec,
      error: `⏳ Demasiados intentos seguidos. Por seguridad, espera ${remainingSec} segundos antes de volver a intentar.`
    };
  }

  const recentAttempts = (entry.attempts || []).filter((ts) => now - ts < windowMs);
  if (recentAttempts.length >= maxAttempts) {
    entry.attempts = recentAttempts;
    entry.lockedUntil = now + lockoutMs;
    store[key] = entry;
    writeRateLimitStore(store);
    const remainingSec = Math.ceil(lockoutMs / 1000);
    return {
      allowed: false,
      remainingSec,
      error: `⛔ Límite de intentos excedido. Cuenta protegida temporalmente por ${remainingSec} segundos.`
    };
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - recentAttempts.length,
    error: null
  };
};

export const recordRateLimitAttempt = (
  actionScope,
  identifier = 'anon',
  { maxAttempts = 5, windowMs = 5 * 60 * 1000, lockoutMs = 3 * 60 * 1000 } = {}
) => {
  const now = Date.now();
  const fp = getClientFingerprint();
  const normId = String(identifier || 'anon').trim().toLowerCase() || 'anon';
  const key = `${actionScope}::${normId}::${fp}`;

  const store = readRateLimitStore();
  const entry = store[key] || { attempts: [], lockedUntil: 0 };
  const recentAttempts = (entry.attempts || []).filter((ts) => now - ts < windowMs);
  recentAttempts.push(now);

  entry.attempts = recentAttempts;
  if (recentAttempts.length >= maxAttempts) {
    entry.lockedUntil = now + lockoutMs;
  }
  store[key] = entry;
  writeRateLimitStore(store);
};

export const resetRateLimit = (actionScope, identifier = 'anon') => {
  const fp = getClientFingerprint();
  const normId = String(identifier || 'anon').trim().toLowerCase() || 'anon';
  const key = `${actionScope}::${normId}::${fp}`;
  const store = readRateLimitStore();
  if (store[key]) {
    delete store[key];
    writeRateLimitStore(store);
  }
};

/**
 * 3. MANEJO SEGURO DE ERRORES (SIN EXPONER DETALLES DE BASE DE DATOS NI STACKTRACES)
 */
export const formatSafeErrorMessage = (
  err,
  fallbackMessage = 'No se pudo completar la operación. Verifica tu conexión o permisos.'
) => {
  if (!err) return fallbackMessage;
  const rawMsg = typeof err === 'string' ? err : err.message || '';
  const lower = rawMsg.toLowerCase();

  if (lower.includes('row-level security') || lower.includes('rls') || err?.code === '42501') {
    return '⛔ No tienes permisos suficientes para realizar esta acción.';
  }
  if (lower.includes('jwt') || lower.includes('token') || err?.code === 'PGRST301') {
    return '🔒 Tu sesión ha expirado. Por favor vuelve a iniciar sesión.';
  }
  if (lower.includes('duplicate key') || err?.code === '23505') {
    return '⚠️ Ya existe un registro con ese mismo código o identificador.';
  }
  if (lower.includes('foreign key') || err?.code === '23503') {
    return '⚠️ No se puede modificar o eliminar porque tiene registros asociados.';
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return '📡 Error de red al conectar con el servidor. Verifica tu conexión a internet.';
  }

  return fallbackMessage;
};

/**
 * 4. FIRMA Y VERIFICACIÓN DE SESIÓN
 */
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
 * de forma 100% aislada (sin sobrescribir la sesión activa ni disparar el gestor de contraseñas del navegador)
 * e incluye Rate-Limiting contra ataques de fuerza bruta.
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

  const rawUser = String(emailOrUsername || fallbackProfile?.email || '').trim().toLowerCase();
  const emailCheck = validateCorporateEmail(rawUser);
  if (!emailCheck.valid) {
    return {
      ok: false,
      error: emailCheck.error
    };
  }

  const emailFull = emailCheck.email;

  // Verificar Rate-Limiting por usuario + dispositivo (Máx 5 intentos fallidos cada 5 min)
  const limitStatus = checkRateLimit('supervisor_pin', emailFull, {
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000,
    lockoutMs: 3 * 60 * 1000
  });
  if (!limitStatus.allowed) {
    return {
      ok: false,
      error: limitStatus.error
    };
  }

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
      recordRateLimitAttempt('supervisor_pin', emailFull, {
        maxAttempts: 5,
        windowMs: 5 * 60 * 1000,
        lockoutMs: 3 * 60 * 1000
      });
      return {
        ok: false,
        error: '❌ Clave incorrecta o usuario no válido. Acceso denegado.'
      };
    }

    // Credenciales válidas: limpiar contador de intentos fallidos
    resetRateLimit('supervisor_pin', emailFull);

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
    return {
      ok: false,
      error: formatSafeErrorMessage(
        err,
        'Error de conexión al verificar credenciales con el servidor.'
      )
    };
  }
};
