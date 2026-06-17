import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://klapeabwtphxqdspiggv.supabase.co', 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt');

async function check() {
  const { data, error } = await supabase.from('ribisoft_pedidos').select('PedidoSIN, Cliente, "Nombre Proyecto"').in('PedidoSIN', ['63557', '63595']);
  if (error) console.error(error);
  else console.log(data.slice(0, 5));
}
check();
