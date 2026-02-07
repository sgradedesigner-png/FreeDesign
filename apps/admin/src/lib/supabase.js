import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl)
    throw new Error('VITE_SUPABASE_URL is required');
if (!supabaseAnonKey)
    throw new Error('VITE_SUPABASE_ANON_KEY is required');
const supabaseGlobal = globalThis;
function createSupabaseClient() {
    return createClient(supabaseUrl, supabaseAnonKey);
}
export const supabase = supabaseGlobal.__adminSupabase ?? createSupabaseClient();
if (import.meta.env.DEV) {
    supabaseGlobal.__adminSupabase = supabase;
}
