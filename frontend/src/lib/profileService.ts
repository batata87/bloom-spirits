import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

export type ProfileRow = {
  id: string;
  life_essence: number;
  inventory: string[];
};

function assertConfigured() {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
}

export async function ensureAndLoadProfile(user: User): Promise<ProfileRow> {
  assertConfigured();
  const { data: existing, error: selErr } = await getSupabase()
    .from("profiles")
    .select("id, life_essence, inventory")
    .eq("id", user.id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    return {
      id: existing.id,
      life_essence: Number(existing.life_essence) || 0,
      inventory: Array.isArray(existing.inventory) ? existing.inventory : ["basic_spirit"],
    };
  }

  const { data: inserted, error: insErr } = await getSupabase()
    .from("profiles")
    .insert({ id: user.id, life_essence: 0, inventory: ["basic_spirit"] })
    .select("id, life_essence, inventory")
    .single();
  if (insErr) throw insErr;

  return {
    id: inserted.id,
    life_essence: Number(inserted.life_essence) || 0,
    inventory: Array.isArray(inserted.inventory) ? inserted.inventory : ["basic_spirit"],
  };
}
