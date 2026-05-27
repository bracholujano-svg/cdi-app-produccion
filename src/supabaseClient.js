import { createClient } from '@supabase/supabase-js';

// Reemplaza con tu URL real
const supabaseUrl = '[https://TU-PROYECTO.supabase.co](https://TU-PROYECTO.supabase.co)';
// Reemplaza con tu anon key (API Key) real
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsIn...';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
