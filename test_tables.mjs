import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://klapeabwtphxqdspiggv.supabase.co', 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt');

supabase.from('ribisoft_pedidos').select('id').limit(1).then(res => {
    console.log("ribisoft_pedidos:", res);
}).catch(console.error);

supabase.from('requerimientos_pedido').select('id').limit(1).then(res => {
    console.log("requerimientos_pedido:", res);
}).catch(console.error);
