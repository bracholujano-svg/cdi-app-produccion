import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://klapeabwtphxqdspiggv.supabase.co', 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt');

supabase.rpc('get_tables').then(res => {
    // If rpc fails, let's just query a known table with an invalid column to see the error which sometimes leaks schema, or just use another method.
    console.log(res);
});

// Better: query information_schema if we have access via REST (usually not allowed).
// Let's just list known tables from useSupabaseData.js
