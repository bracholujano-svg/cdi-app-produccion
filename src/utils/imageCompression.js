/**
 * Utilitario centralizado de compresión y optimización de imágenes en cliente.
 * Objetivo estricto:
 *  - Redimensionar al máximo de 800px en su lado mayor.
 *  - Exportar en image/webp (con fallback automático a image/jpeg) a calidad 0.72.
 *  - Garantizar un peso objetivo de 80-120 KB por imagen (evitando fotos HD/4K de 3-8 MB en Base64).
 */

const DEFAULT_MAX_DIMENSION = 800;
const DEFAULT_QUALITY = 0.72;
const DEFAULT_MAX_TARGET_KB = 120;

let cachedWebpSupport = null;

/**
 * Detecta si el navegador actual soporta codificación WebP en Canvas.
 */
const supportsCanvasWebp = () => {
  if (cachedWebpSupport !== null) return cachedWebpSupport;
  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 2;
    testCanvas.height = 2;
    const dataUrl = testCanvas.toDataURL('image/webp', 0.72);
    cachedWebpSupport = typeof dataUrl === 'string' && dataUrl.startsWith('data:image/webp');
  } catch (_) {
    cachedWebpSupport = false;
  }
  return cachedWebpSupport;
};

/**
 * Estima el tamaño real en bytes de una cadena DataURL Base64.
 */
export const estimateBase64Bytes = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const commaIdx = dataUrl.indexOf(',');
  const base64Body = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const padding = base64Body.endsWith('==') ? 2 : base64Body.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64Body.length * 3) / 4) - padding);
};

export const formatKB = (bytes) => `${(Number(bytes || 0) / 1024).toFixed(1)} KB`;

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen para compresión.'));
    img.src = src;
  });

const readSourceAsDataUrl = (input) =>
  new Promise((resolve, reject) => {
    if (typeof input === 'string') {
      return resolve(input);
    }
    if (input instanceof Blob) {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
      reader.onload = (ev) => resolve(ev.target?.result || null);
      reader.readAsDataURL(input);
      return;
    }
    reject(new Error('Tipo de entrada no soportado para compresión de imagen.'));
  });

/**
 * Comprime cualquier File, Blob o DataURL Base64 en cliente antes de subirlo/guardarlo.
 * @param {File|Blob|string} input - Archivo de cámara/galería o DataURL existente
 * @param {Object} [options]
 * @param {number} [options.maxDimension=800] - Lado mayor máximo en píxeles
 * @param {number} [options.quality=0.72] - Calidad inicial (0 a 1)
 * @param {number} [options.maxTargetKB=120] - Peso máximo objetivo en KB
 * @param {boolean} [options.preferWebp=true] - Usar image/webp si el navegador lo soporta (fallback JPEG)
 * @returns {Promise<string|null>} DataURL comprimido
 */
export const compressImageForUpload = async (input, options = {}) => {
  if (!input) return null;

  const {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
    maxTargetKB = DEFAULT_MAX_TARGET_KB,
    preferWebp = true
  } = options;

  const rawDataUrl = await readSourceAsDataUrl(input);
  if (!rawDataUrl || typeof rawDataUrl !== 'string') return null;

  // Si ya es una URL remota (ej. Supabase Storage https://...), no recomprimir
  if (/^https?:\/\//i.test(rawDataUrl)) {
    return rawDataUrl;
  }

  const img = await loadImageElement(rawDataUrl);

  let width = img.naturalWidth || img.width || maxDimension;
  let height = img.naturalHeight || img.height || maxDimension;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxDimension) / width));
      width = maxDimension;
    } else {
      width = Math.max(1, Math.round((width * maxDimension) / height));
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto Canvas 2D no disponible para compresión.');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const mimeType = preferWebp && supportsCanvasWebp() ? 'image/webp' : 'image/jpeg';
  const maxBytes = maxTargetKB * 1024;

  let currentQuality = quality;
  let compressed = canvas.toDataURL(mimeType, currentQuality);

  // Ajuste progresivo si una imagen muy densa supera los 120 KB objetivo
  const qualitySteps = [0.62, 0.52, 0.44];
  for (const nextQ of qualitySteps) {
    if (estimateBase64Bytes(compressed) <= maxBytes) break;
    if (nextQ >= currentQuality) continue;
    currentQuality = nextQ;
    compressed = canvas.toDataURL(mimeType, currentQuality);
  }

  return compressed;
};

/**
 * Convierte un DataURL Base64 comprimido a Blob para subir a Supabase Storage.
 */
export const dataUrlToBlob = (dataUrl) => {
  const parts = String(dataUrl || '').split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
  const binary = atob(parts[1] || '');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

/**
 * Helper oficial para subir imágenes a Supabase Storage con caché agresiva de 1 año
 * (`cacheControl: '31536000'`) y compresión obligatoria previa.
 */
export const uploadImageToStorageWithCache = async (
  supabaseClient,
  bucketName,
  storagePath,
  fileOrDataUrl,
  options = {}
) => {
  const compressedDataUrl = await compressImageForUpload(fileOrDataUrl, options);
  if (!compressedDataUrl) return { publicUrl: null, error: new Error('Imagen vacía') };
  const blob = dataUrlToBlob(compressedDataUrl);
  const contentType = blob.type || 'image/webp';

  const { error: uploadError } = await supabaseClient.storage
    .from(bucketName)
    .upload(storagePath, blob, {
      contentType,
      cacheControl: '31536000',
      upsert: true
    });

  if (uploadError) {
    return { publicUrl: null, error: uploadError };
  }

  const { data } = supabaseClient.storage.from(bucketName).getPublicUrl(storagePath);
  return { publicUrl: data?.publicUrl || null, error: null };
};

/**
 * Función de migración/limpieza OPCIONAL (ejecutar únicamente bajo confirmación explícita).
 * Recorre los registros de `colores_aprobados` uno a uno (evitando descargas masivas),
 * detecta fotos Base64 pesadas (> 120 KB) y las recomprime a 800px WebP/JPEG calidad 0.72.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun=true] - En true solo audita sin escribir en BD
 * @param {number} [opts.thresholdKB=120] - Umbral mínimo en KB para recomprimir
 * @param {Function} [opts.onProgress] - Callback opcional ({ index, total, codigo, beforeKB, afterKB, updated })
 */
export const recompressExistingColorImages = async (
  supabaseClient,
  { dryRun = true, thresholdKB = 120, onProgress = null } = {}
) => {
  const { data: idRows, error: listErr } = await supabaseClient
    .from('colores_aprobados')
    .select('id, codigo_objetivo')
    .order('created_at', { ascending: false })
    .limit(500);

  if (listErr) throw listErr;
  const rows = Array.isArray(idRows) ? idRows : [];

  const summary = {
    dryRun,
    totalScanned: rows.length,
    withImage: 0,
    recompressedCount: 0,
    totalBytesBefore: 0,
    totalBytesAfter: 0,
    details: []
  };

  for (let i = 0; i < rows.length; i++) {
    const meta = rows[i];
    const { data: fullRow, error: rowErr } = await supabaseClient
      .from('colores_aprobados')
      .select('id, codigo_objetivo, procedimiento_preparacion')
      .eq('id', meta.id)
      .single();

    if (rowErr || !fullRow) continue;

    const proc = fullRow.procedimiento_preparacion || {};
    const imgStr = proc.imagen_muestra;
    if (!imgStr || typeof imgStr !== 'string' || !imgStr.startsWith('data:image/')) {
      continue;
    }

    summary.withImage += 1;
    const beforeBytes = estimateBase64Bytes(imgStr);
    summary.totalBytesBefore += beforeBytes;

    if (beforeBytes <= thresholdKB * 1024) {
      summary.totalBytesAfter += beforeBytes;
      continue;
    }

    const optimized = await compressImageForUpload(imgStr, {
      maxDimension: DEFAULT_MAX_DIMENSION,
      quality: DEFAULT_QUALITY,
      maxTargetKB: thresholdKB
    });

    const afterBytes = estimateBase64Bytes(optimized);
    const shouldReplace = optimized && afterBytes > 0 && afterBytes < beforeBytes * 0.9;

    if (shouldReplace) {
      summary.totalBytesAfter += afterBytes;
      if (!dryRun) {
        const { error: updErr } = await supabaseClient
          .from('colores_aprobados')
          .update({
            procedimiento_preparacion: {
              ...proc,
              imagen_muestra: optimized
            }
          })
          .eq('id', fullRow.id);
        if (updErr) throw updErr;
      }
      summary.recompressedCount += 1;
      const itemInfo = {
        index: i + 1,
        total: rows.length,
        id: fullRow.id,
        codigo: fullRow.codigo_objetivo,
        beforeKB: Number((beforeBytes / 1024).toFixed(1)),
        afterKB: Number((afterBytes / 1024).toFixed(1)),
        updated: !dryRun
      };
      summary.details.push(itemInfo);
      if (onProgress) onProgress(itemInfo);
    } else {
      summary.totalBytesAfter += beforeBytes;
    }
  }

  return summary;
};
