// Cascada de modelos multimodales verificados con la clave del proyecto (ListModels, 15/10/2026).
// Si uno responde 404/429/503 se pasa de inmediato al siguiente.
// Nota: gemini-2.5-flash responde 404 ("no longer available to new users"); 2.0 y 1.5 ya no aparecen en la lista.
export const GEMINI_MODELS_FALLBACK = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

export const GEMINI_PROMPT_CAJETIN = `Analiza la imagen del cajetín de este plano técnico industrial de CDI Exhibiciones. Extrae los datos y devuelve ÚNICAMENTE un objeto JSON válido con estas claves exactas:
- origen_pedido: (string) Número ubicado en la casilla 'ORIGEN' (ej. '63918').
- requisicion_rq: (string) Código que inicia con 'RQ' ubicado en 'ORDEN DE PRODUCCIÓN' (ej. 'RQ00215165'). Nota: Es la requisición.
- codigo_producto: (string) En la casilla 'NOMBRE DEL ARTICULO', extrae SOLO la secuencia numérica inicial antes del primer guion (ej. '33009813').
- nombre_producto: (string) En 'NOMBRE DEL ARTICULO', extrae el texto descriptivo después del primer guion (ej. 'TRESTLETABLE3-184815').
- cliente: (string) Texto completo en la casilla 'CLIENTE' (incluyendo proyecto/sede si aparece debajo).
- cantidad: (number) Número en el recuadro 'CANT. TOTAL' (por defecto 1 si no es visible).
- fecha_entrega: (string) Fecha en 'FECHA DE ENTREGA' convertida a formato YYYY-MM-DD para compatibilidad con inputs tipo date.
- acabado: (string) Todo el texto descriptivo de materiales y pintura junto a la etiqueta vertical 'ACABADO:'.
- seccion: (string) Texto en 'SECCIÓN'.
Si algún campo no es legible o no aparece en el recorte, devuelve '' (string vacío) en esa clave, nunca inventes datos.`;

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
 * Procesa la imagen del cajetín mediante la API REST Multimodal de Gemini 2.5 Flash
 * @param {string|File|Blob} imageSource - DataURL Base64 o File/Blob
 * @param {Function} [onProgress] - Callback opcional para estados de carga
 * @returns {Promise<Object>} Datos extraídos del cajetín
 */
export const analizarCajetinConGemini = async (imageSource, onProgress = null) => {
  if (!imageSource) {
    throw new Error("No se ha proporcionado imagen para analizar.");
  }

  // Vite solo inyecta en el navegador las variables con prefijo VITE_ (process.env no existe en cliente).
  // Vite las reemplaza en tiempo de compilación: si la variable no existía al hacer el build
  // (por ejemplo en Vercel), el bundle queda sin clave aunque el .env local la tenga.
  const geminiApiKey = String(import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || '').trim();

  if (!geminiApiKey) {
    throw new Error("Falta configurar la variable VITE_GEMINI_API_KEY. En local: agréguela al .env y reinicie 'npm run dev'. En Vercel: agréguela en Settings → Environment Variables y vuelva a desplegar.");
  }

  // 1. Compresión en cliente (< 1280px, JPEG 0.8)
  if (onProgress) onProgress(20, 'Optimizando y comprimiendo imagen...');
  const { compressedDataUrl, base64Raw, mimeType } = await comprimirImagenCajetin(imageSource);

  // 2. Llamada directa a la API REST de Gemini con cascada de modelos (ver GEMINI_MODELS_FALLBACK).
  if (onProgress) onProgress(45, 'Analizando cajetín con Gemini...');

  const payload = {
    contents: [
      {
        parts: [
          { text: GEMINI_PROMPT_CAJETIN },
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Raw
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  // Códigos que indican "este modelo no puede atender ahora": se salta al siguiente sin esperar.
  const SALTAR_MODELO = [404, 429, 503];
  const RONDAS = 2; // segunda ronda corta solo si TODOS los modelos estaban saturados
  let response = null;
  let ultimoModelo = '';

  rondas:
  for (let ronda = 1; ronda <= RONDAS; ronda++) {
    for (let i = 0; i < GEMINI_MODELS_FALLBACK.length; i++) {
      ultimoModelo = GEMINI_MODELS_FALLBACK[i];
      if (onProgress && (i > 0 || ronda > 1)) {
        onProgress(Math.min(80, 45 + (i + 1) * 10), `Modelo ocupado, probando alternativa (${ultimoModelo})...`);
      }
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${ultimoModelo}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      if (response.ok || !SALTAR_MODELO.includes(response.status)) break rondas;
    }
    if (ronda < RONDAS) await new Promise(r => setTimeout(r, 1200));
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let msg = `Error al consultar Gemini API (${response.status}, ${ultimoModelo})`;
    try {
      const parsedErr = JSON.parse(errorBody);
      if (parsedErr?.error?.message) {
        msg = `Gemini API (${ultimoModelo}): ${parsedErr.error.message}`;
      }
    } catch (_) {}
    if (SALTAR_MODELO.includes(response.status)) {
      msg += ' — Todos los modelos de IA están saturados. Intente de nuevo en unos segundos o use la pestaña "Buscar en Base de Datos".';
    }
    throw new Error(msg);
  }

  if (onProgress) onProgress(85, 'Interpretando datos del cajetín...');
  const jsonResponse = await response.json();
  const rawText = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Gemini no devolvió contenido para la imagen proporcionada.");
  }

  let parsed = {};
  try {
    parsed = JSON.parse(rawText);
  } catch (parseErr) {
    console.warn("Error parseando respuesta JSON de Gemini:", parseErr, rawText);
    throw new Error("No se pudo interpretar el formato JSON devuelto por Gemini.");
  }

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
