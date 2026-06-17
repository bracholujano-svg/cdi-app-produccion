import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://klapeabwtphxqdspiggv.supabase.co', 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt');

async function fixArea() {
  console.log("Fetching produccion_pedidos...");
  const { data: prodData, error: prodErr } = await supabase.from('produccion_pedidos').select('id, data_completa');
  if (prodErr) { console.error(prodErr); return; }

  let count = 0;
  for (const row of prodData) {
    const dc = row.data_completa;
    if (dc && dc.pedidoNum === "63580") {
      dc.areaActual = "Comercial / Ventas";
      dc.estadoInterno = "Ingreso de Pedido";
      const { error: updateErr } = await supabase.from('produccion_pedidos').update({ data_completa: dc }).eq('id', row.id);
      if (updateErr) {
        console.error(`Error updating ${row.id}:`, updateErr);
      } else {
        console.log(`Updated ${dc.pedidoNum} to Comercial / Ventas`);
        count++;
      }
    }
  }
  console.log(`Finished updating ${count} records.`);
}

fixArea();
