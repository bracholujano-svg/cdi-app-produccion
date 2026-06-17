import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://klapeabwtphxqdspiggv.supabase.co', 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt');

async function fixClients() {
  console.log("Fetching ribisoft_pedidos...");
  const clientMap = {};
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('ribisoft_pedidos').select('PedidoSIN, Cliente').range(from, from + 999);
    if (error) { console.error(error); break; }
    if (data.length === 0) break;
    data.forEach(r => {
      if (r.PedidoSIN && r.Cliente) clientMap[r.PedidoSIN] = r.Cliente;
    });
    from += 1000;
  }

  console.log("Fetching produccion_pedidos...");
  let pFrom = 0;
  let count = 0;
  while (true) {
    const { data: prodData, error: prodErr } = await supabase.from('produccion_pedidos').select('id, data_completa').range(pFrom, pFrom + 999);
    if (prodErr) { console.error(prodErr); break; }
    if (prodData.length === 0) break;

    for (const row of prodData) {
      const dc = row.data_completa;
      if (dc && dc.pedidoNum && clientMap[dc.pedidoNum]) {
        const correctClient = clientMap[dc.pedidoNum];
        if (dc.cliente !== correctClient) {
          dc.cliente = correctClient;
          const { error: updateErr } = await supabase.from('produccion_pedidos').update({ data_completa: dc }).eq('id', row.id);
          if (updateErr) {
            console.error(`Error updating ${row.id}:`, updateErr);
          } else {
            console.log(`Updated ${dc.pedidoNum} -> ${correctClient}`);
            count++;
          }
        }
      }
    }
    pFrom += 1000;
  }
  console.log(`Finished updating ${count} records.`);
}

fixClients();
