import { createClient } from '@supabase/supabase-js';

// Reemplaza con tu URL real
const supabaseUrl = 'https://klapeabwtphxqdspiggv.supabase.co/rest/v1/';
// Reemplaza con tu anon key (API Key) real
const supabaseAnonKey = 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENtIsIn...';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
