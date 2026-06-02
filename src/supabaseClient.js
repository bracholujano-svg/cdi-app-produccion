import { createClient } from '@supabase/supabase-js';

// Fallback to hardcoded string to avoid breaking Vercel immediately, but prioritize ENV
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://klapeabwtphxqdspiggv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
