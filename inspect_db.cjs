const { createClient } = require('@supabase/supabase-js');

// Configuración - extraída de tu archivo .env o hardcodeada para test
// Nota: Deberás reemplazar con tus credenciales reales si no están en entorno
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'REPLACE_ME_IF_NEEDED';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'REPLACE_ME_IF_NEEDED';

async function main() {
    const fs = require('fs');
    // read variables from .env
    const env = fs.readFileSync('.env', 'utf-8');
    const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
    const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
    const supabaseUrl = urlMatch[1].trim();
    const supabaseKey = keyMatch[1].trim();

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: reqs, error } = await supabase.from('requerimientos_pedido').select('*').limit(20);
    if (error) {
        console.error("Error fetching requerimientos:", error);
    } else {
        console.log("=== PRIMEROS 20 REQUERIMIENTOS ===");
        reqs.forEach(r => {
            console.log(`Pedidosin: '${r.pedidosin}', Id Referencia: '${r['Id Referencia']}', Cantidad: ${r.Cantidad}, Cant.OC: ${r['Cant.OC']}`);
        });
    }
}

main();
