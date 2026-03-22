import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Expected table `public.players` (enable RLS + policies in Supabase):
 * id uuid PK references auth.users, name text, worlds_awakened int, total_blooms int, time_played_ms bigint
 */
export type PlayerRow = {
  id: string;
  name: string;
  worlds_awakened: number;
  total_blooms: number;
  time_played_ms: number;
};

function assertConfigured() {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
}

export async function ensureAndLoadPlayer(user: User): Promise<PlayerRow> {
  assertConfigured();
  const { data: existing, error: selErr } = await supabase
    .from("players")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing as PlayerRow;

  const { data: inserted, error: insErr } = await supabase
    .from("players")
    .insert({
      id: user.id,
      name: "New Spirit",
      worlds_awakened: 0,
      total_blooms: 0,
      time_played_ms: 0,
    })
    .select("*")
    .single();

  if (insErr) throw insErr;
  return inserted as PlayerRow;
}

export async function loadPlayer(userId: string) {
  assertConfigured();
  return supabase.from("players").select("*").eq("id", userId).single();
}

export async function updatePlayer(userId: string, data: Partial<PlayerRow>) {
  assertConfigured();
  const { name, worlds_awakened, total_blooms, time_played_ms } = data;
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (worlds_awakened !== undefined) patch.worlds_awakened = worlds_awakened;
  if (total_blooms !== undefined) patch.total_blooms = total_blooms;
  if (time_played_ms !== undefined) patch.time_played_ms = time_played_ms;

  return supabase.from("players").update(patch).eq("id", userId);
}
