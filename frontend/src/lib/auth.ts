import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

export async function login() {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase is not configured") };
  }
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : undefined;
  return getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}

export async function loginWithEmail(email: string) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase is not configured") };
  }
  return getSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
}

export const signInWithGoogle = login;

export async function logout() {
  if (!isSupabaseConfigured) return;
  await getSupabase().auth.signOut();
}

export function subscribeAuth(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  if (!isSupabaseConfigured) {
    return () => {};
  }
  const { data } = getSupabase().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
