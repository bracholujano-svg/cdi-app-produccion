// Endpoint privado de servidor (Vercel Serverless Function).
// Lee la clave secreta GEMINI_API_KEY exclusivamente en el servidor.
// La clave NUNCA viaja ni es visible en el navegador del usuario.

const GEMINI_MODELS_FALLBACK = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

const GEMINI_PROMPT_CAJETIN = `Analiza la imagen del cajetín de este plano técnico industrial de CDI Exhibiciones. Extrae los datos y devuelve ÚNICAMENTE un objeto JSON válido con estas claves exactas:
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Use POST.' });
  }

  const apiKey = String(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar la variable secreta GEMINI_API_KEY en el servidor (Vercel → Settings → Environment Variables)."
    });
  }

  try {
    const { base64Raw, mimeType } = req.body || {};
    if (!base64Raw) {
      return res.status(400).json({ error: 'No se recibió la imagen codificada (base64Raw).' });
    }

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
        responseMimeType: 'application/json'
      }
    };

    const SALTAR_MODELO = [404, 429, 503];
    const RONDAS = 2;
    let response = null;
    let ultimoModelo = '';

    rondas:
    for (let ronda = 1; ronda <= RONDAS; ronda++) {
      for (let i = 0; i < GEMINI_MODELS_FALLBACK.length; i++) {
        ultimoModelo = GEMINI_MODELS_FALLBACK[i];
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${ultimoModelo}:generateContent?key=${apiKey}`,
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
      return res.status(response.status).json({ error: msg });
    }

    const jsonResponse = await response.json();
    const rawText = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(502).json({ error: 'Gemini no devolvió contenido para la imagen proporcionada.' });
    }

    let parsed = {};
    try {
      parsed = JSON.parse(rawText);
    } catch (_) {
      return res.status(502).json({ error: 'No se pudo interpretar el formato JSON devuelto por Gemini.' });
    }

    return res.status(200).json({ data: parsed, model: ultimoModelo });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Error interno en el servidor de escaneo.' });
  }
}
