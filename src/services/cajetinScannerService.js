import Tesseract from 'tesseract.js';
import { supabase } from '../supabaseClient';

export const SYSTEM_PROMPT_CAJETIN = `Eres un asistente de lectura de planos industriales. Analiza la imagen del cajetín y devuelve un JSON estricto. APLICA ESTAS REGLAS INQUEBRANTABLES:
'CANT_TOTAL': Número entero.
'CLIENTE': Nombre del cliente.
El campo 'NOMBRE DEL ARTICULO' en la imagen contiene dos datos. Sepáralo:
'codigo_producto': Extrae solo la serie de números inicial (Ej. 33009813).
'nombre_producto': Extrae el texto alfabético posterior (Ej. TRESTLETABLE3...).
'ACABADO': Todo el texto de materiales y colores (Crítico).
'FECHA_DE_ENTREGA': Formato DD/MM/AAAA.
'ORIGEN': Número de pedido (Ej. 63918).
'REQUISICION': Extrae el código que empieza por 'RQ' (Ej. RQ00215165). NO lo llames orden de producción.
'ORDEN_DE_PRODUCCION': Dejar en blanco a menos que exista un número distinto al RQ que diga explícitamente OP.`;

/**
 * Parsea el texto bruto extraído por OCR desde el cajetín de un plano industrial
 * @param {string} rawText 
 * @returns {Object} Datos normalizados del cajetín
 */
export const parseCajetinText = (rawText) => {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 10) {
    throw new Error("No se detectó texto legible en la imagen del plano. Por favor, asegúrese de enfocar directamente el cajetín con buena iluminación.");
  }

  const clean = rawText.replace(/\r\n/g, '\n');

  // 1. Requisición (RQ)
  const rqMatch = clean.match(/(?:REQUISICI[OÓ]N|REQ|RQ)[\s.:#*-]*([A-Z0-9_-]{5,15})/i) || 
                  clean.match(/\b(RQ[\s\-_]*[0-9]{4,10})\b/i);
  const requisicion = rqMatch ? rqMatch[1].replace(/[\s\-_]+/g, '').toUpperCase() : '';

  // 2. Origen / Pedido
  const pedidoMatch = clean.match(/(?:ORIGEN\s*(?:\/\s*PEDIDO)?|PEDIDO|PEDIDO\s*N[°o.]?|DOC\.?\s*REF|N[°o.]?\s*PEDIDO)[\s.:#*-]*([0-9]{4,10})/i);
  const origen = pedidoMatch ? pedidoMatch[1].trim() : '';

  // 3. Cantidad Total
  const cantMatch = clean.match(/(?:CANTIDAD|CANT\.?\s*TOTAL|CANT\.?|UNDS?\.?|PIEZAS)[\s.:#*-]*([0-9]+)/i);
  const cant = cantMatch ? parseInt(cantMatch[1], 10) : 1;

  // 4. Fecha de Entrega (DD/MM/AAAA, DD-MM-AAAA o YYYY-MM-DD)
  const fechaMatch = clean.match(/(?:FECHA(?:\s+DE)?\s+ENTREGA|ENTREGA|FECHA)[\s.:#*-]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i) ||
                     clean.match(/\b([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.](?:20)?[0-9]{2})\b/);
  const fecha = fechaMatch ? fechaMatch[1].replace(/[\-\.]/g, '/') : '';

  // 5. Cliente
  const clienteMatch = clean.match(/(?:CLIENTE|CLIENT)[\s.:#*-]*([^\n\r,;]{3,60})/i);
  const cliente = clienteMatch ? clienteMatch[1].trim() : '';

  // 6. Acabado / Especificaciones
  const acabadoMatch = clean.match(/(?:ACABADOS?|MATERIAL(?:ES)?|TERMINACI[OÓ]N)[\s.:#*-]*([^\n\r]{4,150})/i);
  const acabado = acabadoMatch ? acabadoMatch[1].trim() : '';

  // 7. Nombre y Código del Artículo
  const artMatch = clean.match(/(?:NOMBRE\s+DEL\s+ART[IÍ]CULO|ART[IÍ]CULO|DESCRIPCI[OÓ]N|PRODUCTO|ITEM)[\s.:#*-]*([^\n\r]{3,100})/i);
  let cod = '';
  let nom = '';

  if (artMatch) {
    const rawArt = artMatch[1].trim();
    const splitMatch = rawArt.match(/^([0-9]{5,12})[\s\-_]*(.*)$/);
    if (splitMatch) {
      cod = splitMatch[1];
      nom = splitMatch[2].trim();
    } else {
      nom = rawArt;
    }
  }

  // Fallback para código numérico aislado si no vino en el campo de artículo
  if (!cod) {
    const fallbackCod = clean.match(/\b([0-9]{7,9})\b/);
    if (fallbackCod && fallbackCod[1] !== origen) {
      cod = fallbackCod[1];
    }
  }

  // 8. Orden de Producción (OP)
  const opMatch = clean.match(/(?:ORDEN\s+DE\s+PRODUCCI[OÓ]N|ORDEN\s+PROD\.?|O\.?P\.?)[\s.:#*-]*([0-9]{4,10})/i);
  const op = opMatch ? opMatch[1].trim() : '';

  // Validación: si no detectó ningún campo clave, informar al usuario para evitar falsos positivos
  const hasKeyField = requisicion || origen || cod || cliente || nom;
  if (!hasKeyField) {
    throw new Error("Se leyó texto en la imagen pero no se reconocieron campos válidos de un cajetín industrial (Código, RQ, Pedido o Cliente). Intente acercar y enfocar mejor el cajetín.");
  }

  return {
    CANT_TOTAL: cant,
    CLIENTE: cliente,
    codigo_producto: cod,
    nombre_producto: nom,
    ACABADO: acabado,
    FECHA_DE_ENTREGA: fecha,
    ORIGEN: origen,
    REQUISICION: requisicion,
    ORDEN_DE_PRODUCCION: op
  };
};

/**
 * Procesa la imagen del cajetín mediante OCR real en cliente (Tesseract.js)
 * o API de Visión externa si está configurada (Supabase Edge Function / OpenAI).
 * NUNCA devuelve datos estáticos/mock.
 * 
 * @param {string} imageBase64 - Imagen en formato DataURL Base64
 * @param {Function} [onProgress] - Callback opcional para reporte de avance (0-100, statusText)
 * @returns {Promise<Object>} Datos extraídos del cajetín según las reglas
 */
export const analizarCajetinConIA = async (imageBase64, onProgress = null) => {
  if (!imageBase64) {
    throw new Error("No se ha proporcionado imagen para analizar.");
  }

  // 1. Intentar invocación a Edge Function de Supabase si está desplegada
  try {
    if (onProgress) onProgress(10, 'Consultando servicio de visión...');
    const { data, error } = await supabase.functions.invoke('analizar-cajetin', {
      body: { 
        image: imageBase64,
        systemPrompt: SYSTEM_PROMPT_CAJETIN 
      }
    });
    if (!error && data) {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed && (parsed.codigo_producto || parsed.REQUISICION || parsed.ORIGEN)) {
        if (onProgress) onProgress(100, 'Datos extraídos con éxito.');
        return parsed;
      }
    }
  } catch (_) {
    // Continuar al siguiente proveedor o motor OCR
  }

  // 2. Intentar llamar a API OpenAI si hay clave configurada en entorno
  const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_API_KEY) || 
                 (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY);

  if (apiKey) {
    try {
      if (onProgress) onProgress(20, 'Analizando imagen con OpenAI Vision...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_CAJETIN },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: 'Analiza la imagen del cajetín del plano industrial adjunto y devuelve el JSON estricto con los campos requeridos.' },
                { type: 'image_url', image_url: { url: imageBase64 } }
              ] 
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const jsonRes = await response.json();
        const content = jsonRes.choices?.[0]?.message?.content;
        if (content) {
          if (onProgress) onProgress(100, 'Datos extraídos con éxito.');
          return JSON.parse(content);
        }
      }
    } catch (err) {
      console.warn("OpenAI Vision no disponible o falló:", err);
    }
  }

  // 3. Procesamiento Real de Imágenes en el Cliente vía Tesseract.js (Opción A)
  // Sin datos quemados / mock. Extrae texto real y lo parsea.
  if (onProgress) onProgress(30, 'Iniciando motor OCR en navegador...');

  let ocrResult = null;
  try {
    ocrResult = await Tesseract.recognize(imageBase64, 'spa+eng', {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text') {
          const pct = Math.min(95, Math.max(30, Math.round(m.progress * 100)));
          onProgress(pct, `Reconociendo caracteres (${pct}%)...`);
        }
      }
    });
  } catch (ocrErr) {
    // Si falla 'spa+eng', intentar con fallback 'eng' básico
    try {
      if (onProgress) onProgress(40, 'Reintentando con motor base...');
      ocrResult = await Tesseract.recognize(imageBase64, 'eng', {
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            const pct = Math.min(95, Math.max(40, Math.round(m.progress * 100)));
            onProgress(pct, `Reconociendo caracteres (${pct}%)...`);
          }
        }
      });
    } catch (fallbackErr) {
      throw new Error(`Fallo en el reconocimiento de imagen (OCR): ${fallbackErr.message || ocrErr.message}. Asegúrese de tener buena conexión o ingrese los datos manualmente.`);
    }
  }

  if (onProgress) onProgress(96, 'Extrayendo campos del cajetín...');

  const rawText = ocrResult?.data?.text || '';
  const parsedData = parseCajetinText(rawText);

  if (onProgress) onProgress(100, 'Lectura finalizada.');
  return parsedData;
};
