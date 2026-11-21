import DOMPurify from 'dompurify';
import { AREAS } from './constants';

const FORBIDDEN_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const CORPORATE_DOMAIN = 'cdiexhibiciones.co';

/**
 * Elimina caracteres de control invisibles (NULL, ASCII 0x00-0x1F excepto \n/\t)
 * y caracteres bidireccionales de suplantación visual (Trojan Source / Bidi),
 * conservando tildes, ñ, medidas (4", 1/2"), códigos, guiones, barras, @, %, Δ, °, etc.
 */
export const stripControlAndBidiChars = (value, { allowNewlines = true } = {}) => {
  const raw = String(value ?? '');
  const controlRegex = allowNewlines
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g
    : /[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
  return raw.replace(controlRegex, '');
};

/**
 * Detecta patrones compuestos de inyección (XSS, protocolos ejecutables o payloads SQLi)
 * sin producir falsos positivos sobre medidas o textos legítimos de ingeniería/planta
 * (ej. `MDF 18mm 4" x 2" - Lijar @40% brillo / Peña`).
 */
export const detectMaliciousInputPattern = (value = '') => {
  const str = String(value ?? '');
  if (!str) return { suspicious: false, reason: null };

  // 1. Etiquetas o manejadores XSS activos
  const xssPatterns = [
    /<\s*\/?\s*(?:script|iframe|object|embed|applet|meta|link|style|form|base)\b/i,
    /<\s*svg\b[^>]*\bon[a-z]+\s*=/i,
    /<\s*[a-z][^>]*\bon(?:error|load|click|mouseover|mouseenter|focus|blur|input|submit)\s*=/i,
    /(?:javascript|vbscript)\s*:/i,
    /data\s*:\s*(?:text\/html|application\/xhtml\+xml|image\/svg\+xml)/i
  ];
  for (const rx of xssPatterns) {
    if (rx.test(str)) {
      return {
        suspicious: true,
        reason: 'contiene etiquetas HTML activas o scripts ejecutables (XSS)'
      };
    }
  }

  // 2. Patrones compuestos de inyección SQL / comandos ocultos
  const sqliPatterns = [
    /;\s*(?:DROP|DELETE|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC(?:UTE)?)\b/i,
    /;\s*(?:INSERT\s+INTO|UPDATE\s+[a-z0-9_."`]+\s+SET|SELECT\s+.+\s+FROM)\b/i,
    /\bUNION\s+(?:ALL\s+)?SELECT\b/i,
    /(?:'|"|\b)(?:OR|AND)\s+['"]?\s*\d+\s*['"]?\s*=\s*['"]?\s*\d+\b/i,
    /(?:'|"|\b)(?:OR|AND)\s+['"][a-z0-9_]+['"]\s*=\s*['"][a-z0-9_]+['"]/i,
    /\/\*[\s\S]*?\*\//,
    /(?:^|['";\s])--\s+\S/,
    /\b(?:PG_SLEEP|SLEEP|BENCHMARK|WAITFOR\s+DELAY)\s*\(/i,
    /\bINTO\s+(?:OUTFILE|DUMPFILE)\b/i,
    /\bLOAD_FILE\s*\(/i
  ];
  for (const rx of sqliPatterns) {
    if (rx.test(str)) {
      return {
        suspicious: true,
        reason: 'contiene secuencias de comandos SQL no permitidas'
      };
    }
  }

  return { suspicious: false, reason: null };
};

/**
 * Neutraliza de forma segura un texto libre de planta/ingeniería preservando
 * caracteres legítimos (tildes, ñ, medidas, códigos, guiones, barras, @, etc.)
 * y aplicando control estricto de longitud máxima.
 */
export const sanitizePlantText = (
  value,
  { maxLength = 500, allowNewlines = true, uppercase = false, fallback = '' } = {}
) => {
  if (value === null || value === undefined) return fallback;

  let text = stripControlAndBidiChars(String(value), { allowNewlines });

  // Eliminar etiquetas HTML / XSS vía DOMPurify conservando texto plano
  text = DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

  // Neutralizar protocolos ejecutables si aparecieran en texto plano
  text = text
    .replace(/(?:javascript|vbscript)\s*:/gi, '')
    .replace(/data\s*:\s*(?:text\/html|application\/xhtml\+xml|image\/svg\+xml)/gi, '');

  // Neutralizar comentarios SQL y sentencias compuestas si se llama en modo saneamiento silencioso
  text = text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/;\s*(?:DROP|DELETE|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC(?:UTE)?)\b/gi, '')
    .replace(/\bUNION\s+(?:ALL\s+)?SELECT\b/gi, '');

  text = text.trim().slice(0, Math.max(1, Number(maxLength) || 500));
  if (!text) return fallback;
  return uppercase ? text.toUpperCase() : text;
};

/**
 * Valida una entrada de texto de planta antes de guardarla en estado/Supabase.
 * Si contiene un payload malicioso evidente (XSS/SQLi), lo bloquea con un mensaje claro;
 * en caso contrario devuelve el texto limpio y normalizado.
 */
export const validatePlantSubmissionText = (
  value,
  {
    fieldLabel = 'Campo de texto',
    maxLength = 500,
    allowNewlines = true,
    uppercase = false,
    required = false,
    fallback = ''
  } = {}
) => {
  const rawStr = String(value ?? '');
  const check = detectMaliciousInputPattern(rawStr);
  if (check.suspicious) {
    return {
      valid: false,
      value: '',
      error: `⛔ Entrada bloqueada en "${fieldLabel}": ${check.reason}.`
    };
  }

  const cleaned = sanitizePlantText(rawStr, {
    maxLength,
    allowNewlines,
    uppercase,
    fallback
  });

  if (required && !cleaned) {
    return {
      valid: false,
      value: '',
      error: `⚠️ El campo "${fieldLabel}" es obligatorio.`
    };
  }

  return {
    valid: true,
    value: cleaned,
    error: null
  };
};

/**
 * Escapa/limpia términos que se pasan a filtros dinámicos PostgREST (.ilike / .or),
 * impidiendo alterar operadores lógicos o comodines.
 */
export const sanitizePostgrestSearchTerm = (value, maxLengthOrOpts = 50) => {
  const maxLength =
    typeof maxLengthOrOpts === 'object' && maxLengthOrOpts !== null
      ? Number(maxLengthOrOpts.maxLength) || 50
      : Number(maxLengthOrOpts) || 50;
  const clean = stripControlAndBidiChars(String(value ?? ''), { allowNewlines: false });
  return clean
    .replace(/[%_(),*\\;'"`<>]/g, '')
    .trim()
    .slice(0, Math.max(1, maxLength));
};

/**
 * Valida que una URL de imagen/evidencia sea exclusivamente una imagen Base64 segura
 * o una URL HTTPS válida (rechaza javascript:, data:text/html, data:image/svg+xml, etc.).
 */
export const sanitizeImageDataUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = stripControlAndBidiChars(value, { allowNewlines: false }).trim();
  if (!trimmed) return null;

  // Imágenes base64 permitidas (excluye SVG para evitar XSS embebido)
  if (/^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    // Tope razonable de 2.5 MB de string base64
    return trimmed.length <= 2_600_000 ? trimmed : null;
  }

  // URLs HTTPS legítimas (ej. Supabase Storage)
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (_) {
    // URL inválida
  }

  return null;
};

/**
 * Abre una evidencia fotográfica únicamente si supera la validación estricta de esquema.
 */
export const safeOpenEvidenceUrl = (url) => {
  const safeUrl = sanitizeImageDataUrl(url);
  if (!safeUrl || typeof window === 'undefined') return false;
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
  return true;
};

/**
 * Validación estricta de credenciales en Login (formato, dominio corporativo y longitud).
 */
export const validateLoginCredentials = ({ username = '', password = '' } = {}) => {
  const rawUser = String(username ?? '');
  const rawPass = String(password ?? '');

  if (/\u0000/.test(rawUser) || /\u0000/.test(rawPass)) {
    return {
      valid: false,
      email: '',
      password: '',
      error: '⛔ Entrada bloqueada por caracteres de control no permitidos.'
    };
  }

  const userMalicious = detectMaliciousInputPattern(rawUser);
  if (userMalicious.suspicious || /['";\\()=<>`*]/.test(rawUser)) {
    return {
      valid: false,
      email: '',
      password: '',
      error: '⛔ Usuario bloqueado por contener caracteres o comandos no permitidos.'
    };
  }

  const cleanUser = stripControlAndBidiChars(rawUser, { allowNewlines: false })
    .trim()
    .toLowerCase();

  if (!cleanUser) {
    return { valid: false, email: '', password: '', error: '⚠️ Ingresa tu usuario corporativo.' };
  }

  if (cleanUser.length > 120 || /\s/.test(cleanUser)) {
    return {
      valid: false,
      email: '',
      password: '',
      error: '⚠️ El usuario corporativo no puede contener espacios ni exceder 120 caracteres.'
    };
  }

  const emailFull = cleanUser.includes('@') ? cleanUser : `${cleanUser}@${CORPORATE_DOMAIN}`;
  const [localPart, domainPart, ...extraAt] = emailFull.split('@');
  const strictLocalRegex = /^[a-z0-9._+-]{2,64}$/;

  if (
    extraAt.length > 0 ||
    !localPart ||
    !strictLocalRegex.test(localPart) ||
    domainPart !== CORPORATE_DOMAIN
  ) {
    return {
      valid: false,
      email: '',
      password: '',
      error: `⛔ Solo se permiten usuarios corporativos válidos (@${CORPORATE_DOMAIN}).`
    };
  }

  const cleanPass = rawPass.trim();
  if (!cleanPass || cleanPass.length < 6) {
    return {
      valid: false,
      email: emailFull,
      password: '',
      error: '⚠️ Ingresa una clave válida de al menos 6 caracteres.'
    };
  }
  if (cleanPass.length > 128) {
    return {
      valid: false,
      email: emailFull,
      password: '',
      error: '⛔ La clave excede la longitud máxima permitida (128 caracteres).'
    };
  }

  return {
    valid: true,
    email: emailFull,
    usernameClean: localPart,
    password: cleanPass,
    error: null
  };
};

/**
 * Validación estricta para el formulario de auto-registro de supervisores/operarios.
 */
export const validateRegisterInput = ({ name = '', username = '', password = '', area = '' } = {}) => {
  const loginCheck = validateLoginCredentials({ username, password });
  if (!loginCheck.valid) {
    return { valid: false, error: loginCheck.error };
  }

  const nameCheck = validatePlantSubmissionText(name, {
    fieldLabel: 'Nombre Completo',
    maxLength: 80,
    allowNewlines: false,
    uppercase: true,
    required: true
  });
  if (!nameCheck.valid) {
    return { valid: false, error: nameCheck.error };
  }
  if (nameCheck.value.length < 3 || !/^[A-ZÁÉÍÓÚÑÜ\s.'-]{3,80}$/.test(nameCheck.value)) {
    return {
      valid: false,
      error: '⚠️ Ingresa un nombre completo válido (solo letras y espacios, mínimo 3 caracteres).'
    };
  }

  const cleanArea = sanitizePlantText(area, { maxLength: 80, allowNewlines: false });
  const allowedRegisterAreas = (AREAS || []).filter((a) => a !== 'Administrador / Todos');
  if (!cleanArea || cleanArea === 'Administrador / Todos' || !allowedRegisterAreas.includes(cleanArea)) {
    return {
      valid: false,
      error: '⛔ El área seleccionada no es válida o requiere asignación administrativa.'
    };
  }

  return {
    valid: true,
    email: loginCheck.email,
    password: loginCheck.password,
    name: nameCheck.value,
    area: cleanArea,
    error: null
  };
};

/**
 * Sanitización recursiva segura para estructuras auxiliares (packingListSnapshot, metadata, etc.)
 * bloqueando claves de prototype pollution (`__proto__`, `constructor`, `prototype`).
 */
const sanitizeSafeGenericStructure = (val, depth = 0) => {
  if (depth > 8) return null;
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    if (val.startsWith('data:image/')) {
      return sanitizeImageDataUrl(val);
    }
    return sanitizePlantText(val, { maxLength: 1500, allowNewlines: true });
  }
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'boolean') return val;
  if (Array.isArray(val)) {
    return val.slice(0, 500).map((item) => sanitizeSafeGenericStructure(item, depth + 1));
  }
  if (typeof val === 'object') {
    const out = {};
    for (const key of Object.keys(val)) {
      if (FORBIDDEN_PROTO_KEYS.has(key)) continue;
      out[key] = sanitizeSafeGenericStructure(val[key], depth + 1);
    }
    return out;
  }
  return null;
};

const pickWhitelistedKeys = (obj, allowedSet) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const result = {};
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_PROTO_KEYS.has(key) || !allowedSet.has(key)) continue;
    result[key] = obj[key];
  }
  return result;
};

// Listas blancas estrictas de propiedades permitidas en JSONB de Supabase
const ALLOWED_LOGISTICA_KEYS = new Set([
  'tipoTransporte',
  'empresaTransporte',
  'nombreChofer',
  'cedulaChofer',
  'placaMarca',
  'precintoSeguridad',
  'guiaRemesa',
  'numeroEmpaque',
  'destino',
  'telefonoChofer',
  'observaciones'
]);

const ALLOWED_TRANSFER_KEYS = new Set([
  'desdeArea',
  'haciaArea',
  'entregadoPor',
  'nota',
  'fotoEntrega',
  'fechaEnvio',
  'fecha',
  'isPartial'
]);

const ALLOWED_SHIFT_NOTE_KEYS = new Set([
  'id',
  'area',
  'supervisor',
  'operario',
  'actividad',
  'nota',
  'foto',
  'fecha'
]);

const ALLOWED_QUALITY_NOTE_KEYS = new Set([
  'id',
  'area',
  'supervisor',
  'inspector',
  'estado',
  'observacion',
  'foto',
  'fecha'
]);

const ALLOWED_HISTORY_KEYS = new Set([
  'fecha',
  'supervisor',
  'accion',
  'entrega',
  'recibe',
  'nota',
  'foto',
  'logistica'
]);

const ALLOWED_ORDER_JSONB_KEYS = new Set([
  'id',
  'master_id',
  'pedidoNum',
  'codArticulo',
  'codigo_item',
  'qr_plano_payload',
  'nombre',
  'descripcion',
  'cantidad',
  'cliente',
  'nombre_proyecto',
  'area',
  'areaActual',
  'areas_compartidas',
  'asignado_a',
  'estado',
  'estadoInterno',
  'prioridad',
  'isTerminado',
  'fechaIngresoArea',
  'fechaInicioTrabajo',
  'fechaEntregaPrometida',
  'fechaDespacho',
  'fecha_asigna',
  'fecha_genera_ped',
  'fechaGeneraPed',
  'fechaCreacion',
  'creadoEn',
  'ultimaActualizacionPlanta',
  'requisicion',
  'acabado',
  'ordenProduccion',
  'dim_1',
  'dim_2',
  'dim_3',
  'acabado_1',
  'acabado_2',
  'acabado_3',
  'caracteristicas',
  'programador',
  'categoria',
  'notas',
  'observaciones_erp',
  'guia_despacho',
  'datos_logistica',
  'transferenciaPendiente',
  'bitacoraTurnos',
  'bitacoraCalidad',
  'historial',
  'alertas_insumos',
  'packingListCompletada',
  'resumenEmpaque',
  'packingListSnapshot',
  'metadata',
  'tipoRegistro'
]);

const ALLOWED_ALERT_JSONB_KEYS = new Set([
  'id',
  'pedidoNum',
  'cliente',
  'fechaEntrega',
  'detalle',
  'notas',
  'creadoEn',
  'actualizadoEn',
  'tipoRegistro',
  'prioridad',
  'creadoPor'
]);

export const sanitizeLogisticaData = (logistica) => {
  if (!logistica || typeof logistica !== 'object') return null;
  const picked = pickWhitelistedKeys(logistica, ALLOWED_LOGISTICA_KEYS);
  const clean = {};
  for (const [k, v] of Object.entries(picked)) {
    clean[k] = sanitizePlantText(v, { maxLength: k === 'observaciones' ? 500 : 120, allowNewlines: k === 'observaciones' });
  }
  return clean;
};

export const sanitizeShiftNoteEntry = (entry = {}) => {
  const picked = pickWhitelistedKeys(entry, ALLOWED_SHIFT_NOTE_KEYS);
  return {
    id: picked.id ?? Date.now(),
    area: sanitizePlantText(picked.area, { maxLength: 80, allowNewlines: false }),
    supervisor: sanitizePlantText(picked.supervisor, { maxLength: 80, allowNewlines: false, fallback: 'S/N' }),
    operario: sanitizePlantText(picked.operario, { maxLength: 80, allowNewlines: false, fallback: 'S/N' }),
    actividad: sanitizePlantText(picked.actividad, { maxLength: 100, allowNewlines: false }),
    nota: sanitizePlantText(picked.nota, { maxLength: 600, allowNewlines: true, fallback: 'Sin novedades' }),
    foto: sanitizeImageDataUrl(picked.foto),
    fecha: sanitizePlantText(picked.fecha, { maxLength: 40, allowNewlines: false, fallback: new Date().toISOString() })
  };
};

export const sanitizeQualityNoteEntry = (entry = {}) => {
  const picked = pickWhitelistedKeys(entry, ALLOWED_QUALITY_NOTE_KEYS);
  return {
    id: picked.id ?? Date.now(),
    area: sanitizePlantText(picked.area, { maxLength: 80, allowNewlines: false }),
    supervisor: sanitizePlantText(picked.supervisor, { maxLength: 80, allowNewlines: false, fallback: 'S/N' }),
    inspector: sanitizePlantText(picked.inspector, { maxLength: 80, allowNewlines: false, fallback: 'S/N' }),
    estado: sanitizePlantText(picked.estado, { maxLength: 60, allowNewlines: false, fallback: 'APROBADO' }),
    observacion: sanitizePlantText(picked.observacion, { maxLength: 600, allowNewlines: true, fallback: 'Sin observaciones' }),
    foto: sanitizeImageDataUrl(picked.foto),
    fecha: sanitizePlantText(picked.fecha, { maxLength: 40, allowNewlines: false, fallback: new Date().toISOString() })
  };
};

export const sanitizeHistoryEntry = (entry = {}) => {
  const picked = pickWhitelistedKeys(entry, ALLOWED_HISTORY_KEYS);
  const out = {
    fecha: sanitizePlantText(picked.fecha, { maxLength: 40, allowNewlines: false, fallback: new Date().toISOString() }),
    accion: sanitizePlantText(picked.accion, { maxLength: 250, allowNewlines: false }),
    entrega: sanitizePlantText(picked.entrega, { maxLength: 100, allowNewlines: false }),
    recibe: sanitizePlantText(picked.recibe, { maxLength: 100, allowNewlines: false })
  };
  if (picked.supervisor !== undefined) {
    out.supervisor = sanitizePlantText(picked.supervisor, { maxLength: 80, allowNewlines: false });
  }
  if (picked.nota !== undefined) {
    out.nota = sanitizePlantText(picked.nota, { maxLength: 600, allowNewlines: true });
  }
  if (picked.foto !== undefined) {
    out.foto = sanitizeImageDataUrl(picked.foto);
  }
  if (picked.logistica !== undefined) {
    out.logistica = sanitizeLogisticaData(picked.logistica);
  }
  return out;
};

export const sanitizeTransferPending = (tp) => {
  if (!tp || typeof tp !== 'object') return null;
  const picked = pickWhitelistedKeys(tp, ALLOWED_TRANSFER_KEYS);
  return {
    ...(picked.desdeArea ? { desdeArea: sanitizePlantText(picked.desdeArea, { maxLength: 80, allowNewlines: false }) } : {}),
    haciaArea: sanitizePlantText(picked.haciaArea, { maxLength: 80, allowNewlines: false }),
    entregadoPor: sanitizePlantText(picked.entregadoPor, { maxLength: 80, allowNewlines: false, fallback: 'S/N' }),
    nota: sanitizePlantText(picked.nota, { maxLength: 600, allowNewlines: true }),
    fotoEntrega: sanitizeImageDataUrl(picked.fotoEntrega),
    fechaEnvio: sanitizePlantText(picked.fechaEnvio || picked.fecha, { maxLength: 40, allowNewlines: false, fallback: new Date().toISOString() }),
    ...(picked.isPartial !== undefined ? { isPartial: Boolean(picked.isPartial) } : {})
  };
};

/**
 * Aplica whitelist estricta de campos y sanitización sobre un objeto de orden
 * antes de guardarlo en `produccion_pedidos.data_completa`.
 */
export const sanitizeOrderPayload = (orderObj = {}) => {
  const picked = pickWhitelistedKeys(orderObj, ALLOWED_ORDER_JSONB_KEYS);
  const clean = {};

  for (const [key, val] of Object.entries(picked)) {
    if (key === 'bitacoraTurnos') {
      clean.bitacoraTurnos = Array.isArray(val) ? val.map(sanitizeShiftNoteEntry) : [];
    } else if (key === 'bitacoraCalidad') {
      clean.bitacoraCalidad = Array.isArray(val) ? val.map(sanitizeQualityNoteEntry) : [];
    } else if (key === 'historial') {
      clean.historial = Array.isArray(val) ? val.map(sanitizeHistoryEntry) : [];
    } else if (key === 'transferenciaPendiente') {
      clean.transferenciaPendiente = sanitizeTransferPending(val);
    } else if (key === 'datos_logistica') {
      clean.datos_logistica = sanitizeLogisticaData(val);
    } else if (key === 'cantidad') {
      const n = Number(val);
      clean.cantidad = Number.isFinite(n) && n > 0 ? n : 1;
    } else if (key === 'isTerminado' || key === 'packingListCompletada') {
      clean[key] = Boolean(val);
    } else if (key === 'areas_compartidas' || key === 'asignado_a') {
      const arr = Array.isArray(val) ? val : (val ? [val] : []);
      clean[key] = arr
        .slice(0, 50)
        .map((s) => sanitizePlantText(s, { maxLength: 80, allowNewlines: false }))
        .filter(Boolean);
    } else if (
      key === 'resumenEmpaque' ||
      key === 'packingListSnapshot' ||
      key === 'metadata' ||
      key === 'alertas_insumos'
    ) {
      clean[key] = sanitizeSafeGenericStructure(val);
    } else if (typeof val === 'string') {
      const maxLen =
        key === 'notas' || key === 'observaciones_erp' || key === 'caracteristicas'
          ? 1000
          : key === 'qr_plano_payload'
          ? 300
          : 250;
      clean[key] = sanitizePlantText(val, {
        maxLength: maxLen,
        allowNewlines: key === 'notas' || key === 'observaciones_erp' || key === 'caracteristicas'
      });
    } else if (val === null || typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    }
  }

  return clean;
};

/**
 * Aplica whitelist estricta sobre `coordinacion_alertas.data_completa`.
 */
export const sanitizeAlertPayload = (alertObj = {}) => {
  const picked = pickWhitelistedKeys(alertObj, ALLOWED_ALERT_JSONB_KEYS);
  const clean = {};
  for (const [key, val] of Object.entries(picked)) {
    if (typeof val === 'string') {
      clean[key] = sanitizePlantText(val, {
        maxLength: key === 'detalle' || key === 'notas' ? 600 : 120,
        allowNewlines: key === 'detalle' || key === 'notas'
      });
    } else if (val === null || typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    }
  }
  return clean;
};

/**
 * Aplica sanitización segura a los campos de texto libre e imágenes de `colores_aprobados` (ETP / Colorimetría).
 */
export const sanitizeColorEtpPayload = (payload = {}) => {
  const ALLOWED_COLOR_TOP_KEYS = new Set([
    'sustrato_muestra',
    'tolerancia_delta_e',
    'porcentaje_pasta_mateante',
    'catalizador_tipo',
    'catalizador_pct',
    'disolvente_tipo',
    'disolvente_pct',
    'procedimiento_preparacion',
    'sistema_color',
    'codigo_objetivo',
    'color_hexadecimal',
    'creado_por_id',
    'aprobado_por_id',
    'estado_aprobacion'
  ]);
  const picked = pickWhitelistedKeys(payload, ALLOWED_COLOR_TOP_KEYS);
  const clean = {};
  for (const [key, val] of Object.entries(picked)) {
    if (key === 'procedimiento_preparacion') {
      clean[key] = sanitizeSafeGenericStructure(val);
    } else if (typeof val === 'string') {
      clean[key] = sanitizePlantText(val, {
        maxLength: key === 'sustrato_muestra' ? 600 : 150,
        allowNewlines: key === 'sustrato_muestra'
      });
    } else if (val === null || typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    }
  }
  return clean;
};
