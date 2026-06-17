import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://klapeabwtphxqdspiggv.supabase.co', 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt');

supabase.storage.listBuckets().then(res => {
    console.log("Buckets:", JSON.stringify(res.data, null, 2));
    if(res.error) console.error("Error:", res.error);
}).catch(console.error);
