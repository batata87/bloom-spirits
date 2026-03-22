import { supabase, isSupabaseConfigured } from "./supabaseClient";

export async function login(email: string) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase is not configured") };
  }
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
}

export async function logout() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export function subscribeAuth(
  callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]
) {
  if (!isSupabaseConfigured) {
    return () => {};
  }
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
