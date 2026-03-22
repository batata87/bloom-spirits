import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/**
 * Lazily creates the client only when env vars exist.
 * Calling `createClient` with missing URL/key throws and would crash the whole app on load (e.g. Vercel without env).
 */
export function getSupabase(): SupabaseClient {
  if (!url || !key) {
    throw new Error("Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).");
  }
  if (!client) {
    client = createClient(url, key);
  }
  return client;
}
