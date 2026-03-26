import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

export type ProfileRow = {
  id: string;
  magical_creatures: number;
  inventory: string[];
};

function assertConfigured() {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
}

export async function ensureAndLoadProfile(user: User): Promise<ProfileRow> {
  assertConfigured();
  const { data: existing, error: selErr } = await getSupabase()
    .from("profiles")
    .select("id, magical_creatures, inventory")
    .eq("id", user.id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    return {
      id: existing.id,
      magical_creatures: Number(existing.magical_creatures) || 0,
      inventory: Array.isArray(existing.inventory) ? existing.inventory : ["basic_spirit"],
    };
  }

  const { data: inserted, error: insErr } = await getSupabase()
    .from("profiles")
    .insert({ id: user.id, magical_creatures: 0, inventory: ["basic_spirit"] })
    .select("id, magical_creatures, inventory")
    .single();
  if (insErr) throw insErr;

  return {
    id: inserted.id,
    magical_creatures: Number(inserted.magical_creatures) || 0,
    inventory: Array.isArray(inserted.inventory) ? inserted.inventory : ["basic_spirit"],
  };
}

export async function loadProfile(userId: string): Promise<ProfileRow> {
  assertConfigured();
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, magical_creatures, inventory")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    magical_creatures: Number(data.magical_creatures) || 0,
    inventory: Array.isArray(data.inventory) ? data.inventory : ["basic_spirit"],
  };
}

export async function purchaseWithCreatures(itemId: string) {
  assertConfigured();
  return getSupabase().rpc("purchase_with_creatures", { item_id_param: itemId });
}
