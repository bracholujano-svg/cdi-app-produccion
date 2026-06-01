const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://klapeabwtphxqdspiggv.supabase.co';
const supabaseKey = 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: req, error } = await supabase.from('requerimientos_pedido').select('*').limit(10000);
    if (error) console.error(error);
    else console.log('Rows fetched with limit 10000:', req.length);
}
main();
