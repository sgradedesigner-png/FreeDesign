import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is required');
if (!supabaseAnonKey) throw new Error('VITE_SUPABASE_ANON_KEY is required');

type SupabaseGlobal = typeof globalThis & {
  __adminSupabase?: SupabaseClient;
};

const supabaseGlobal = globalThis as SupabaseGlobal;

function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseGlobal.__adminSupabase ?? createSupabaseClient();

if (import.meta.env.DEV) {
  supabaseGlobal.__adminSupabase = supabase;
}
