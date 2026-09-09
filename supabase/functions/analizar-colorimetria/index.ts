import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { color } = await req.json()
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY no configurada")
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: "json_object" },
        messages: [
          {
            role: 'system',
            content: "Eres un experto ingeniero químico de PPG Industries. Tu trabajo es analizar códigos de color (RAL, PANTONE, NCS, etc.). Debes devolver un objeto JSON estricto con: 1) 'l_star_estimado': nivel de luminosidad. 2) 'riesgo_opacidad': alto/medio/bajo. 3) 'fondo_recomendado': Qué sustrato usar (PU Blanco Alto Sólidos, Primer Gris Oscuro, o Gris Claro 7035) para evitar metamería y mejorar cubriente. 4) 'justificacion': El porqué técnico."
          },
          {
            role: 'user',
            content: `Analiza la siguiente referencia de color: ${color}`
          }
        ]
      })
    });

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
