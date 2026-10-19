// Servicio de escaneo de cajetines conectado al endpoint privado de servidor (/api/scan-cajetin).
// La API Key de Gemini vive únicamente en el servidor (Vercel Secret) y NUNCA se expone al navegador.

export const GEMINI_MODELS_FALLBACK = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

/**
 * Comprime o redimensiona la imagen en el cliente usando un canvas temporal (máx 1280px ancho, calidad JPEG 0.8)
 * para garantizar subidas ultrarrápidas (<2 segundos) en redes móviles.
 * @param {string|File|Blob} imageSource 
 * @returns {Promise<{ compressedDataUrl: string, base64Raw: string, mimeType: string }>}
 */
export const comprimirImagenCajetin = (imageSource) => {
  return new Promise((resolve, reject) => {
    const processImageObj = (img) => {
      const maxDim = 1280;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64Raw = compressedDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

      resolve({
        compressedDataUrl,
        base64Raw,
        mimeType: 'image/jpeg'
      });
    };

    if (typeof imageSource === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => processImageObj(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para compresión.'));
      img.src = imageSource;
    } else if (imageSource instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => processImageObj(img);
        img.onerror = () => reject(new Error('No se pudo procesar el archivo de imagen.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
      reader.readAsDataURL(imageSource);
    } else {
      reject(new Error('Formato de imagen no soportado.'));
    }
  });
};

/**
 * Procesa la imagen del cajetín enviándola al endpoint interno de servidor (/api/scan-cajetin)
 * para mantener la clave GEMINI_API_KEY 100% privada en el servidor.
 * @param {string|File|Blob} imageSource - DataURL Base64 o File/Blob
 * @param {Function} [onProgress] - Callback opcional para estados de carga
 * @returns {Promise<Object>} Datos extraídos del cajetín
 */
export const analizarCajetinConGemini = async (imageSource, onProgress = null) => {
  if (!imageSource) {
    throw new Error("No se ha proporcionado imagen para analizar.");
  }

  // 1. Compresión en cliente (< 1280px, JPEG 0.8)
  if (onProgress) onProgress(20, 'Optimizando y comprimiendo imagen...');
  const { compressedDataUrl, base64Raw, mimeType } = await comprimirImagenCajetin(imageSource);

  // 2. Envío al endpoint privado de servidor (/api/scan-cajetin)
  if (onProgress) onProgress(50, 'Analizando cajetín en servidor seguro con Gemini IA...');

  const response = await fetch('/api/scan-cajetin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Raw, mimeType })
  });

  const resultJson = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultJson?.error || `Error del servidor de escaneo (${response.status}).`);
  }

  if (onProgress) onProgress(85, 'Interpretando datos del cajetín...');
  const parsed = resultJson?.data || {};

  // Normalización sin bloqueos (tolerancia a fallos)
  const normalized = {
    origen_pedido: String(parsed.origen_pedido || '').trim(),
    requisicion_rq: String(parsed.requisicion_rq || '').trim(),
    codigo_producto: String(parsed.codigo_producto || '').trim(),
    nombre_producto: String(parsed.nombre_producto || '').trim(),
    cliente: String(parsed.cliente || '').trim(),
    cantidad: Number(parsed.cantidad) || 1,
    fecha_entrega: String(parsed.fecha_entrega || '').trim(),
    acabado: String(parsed.acabado || '').trim(),
    seccion: String(parsed.seccion || '').trim(),
    // Compatibilidad con keys de formularios
    ORIGEN: String(parsed.origen_pedido || '').trim(),
    REQUISICION: String(parsed.requisicion_rq || '').trim(),
    CLIENTE: String(parsed.cliente || '').trim(),
    CANT_TOTAL: Number(parsed.cantidad) || 1,
    FECHA_DE_ENTREGA: String(parsed.fecha_entrega || '').trim(),
    ACABADO: String(parsed.acabado || '').trim(),
    ORDEN_DE_PRODUCCION: String(parsed.seccion || '').trim(),
    compressedDataUrl
  };

  const fieldsFilled = [
    normalized.origen_pedido,
    normalized.requisicion_rq,
    normalized.codigo_producto,
    normalized.nombre_producto,
    normalized.cliente,
    normalized.acabado
  ].filter(Boolean).length;

  normalized.fieldsFilledCount = fieldsFilled;
  normalized.hasData = fieldsFilled > 0;

  if (onProgress) onProgress(100, 'Análisis completado.');
  return normalized;
};

// Alias para mantener retrocompatibilidad total
export const analizarCajetinConIA = analizarCajetinConGemini;
