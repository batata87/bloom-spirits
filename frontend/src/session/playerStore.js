import * as guest from "./playerStorage.js";
import { ensureAndLoadPlayer, updatePlayer } from "../lib/playerService.ts";
import { normalizeSpiritLook } from "../Game.js";

/** @typedef {'guest' | 'account'} StorageMode */

/** @type {StorageMode} */
let mode = "guest";
/** @type {string | null} */
let accountUserId = null;
/** @type {import('../lib/playerService.ts').PlayerRow | null} */
let accountRow = null;

/** @returns {StorageMode} */
export function getStorageMode() {
  return mode;
}

export function setGuestMode() {
  mode = "guest";
  accountUserId = null;
  accountRow = null;
}

/**
 * @param {import('@supabase/supabase-js').User} user
 */
export async function setAccountMode(user) {
  mode = "account";
  accountUserId = user.id;
  accountRow = await ensureAndLoadPlayer(user);
}

function rowToStats(row) {
  return {
    worldsAwakened: Number(row.worlds_awakened) || 0,
    totalBlooms: Number(row.total_blooms) || 0,
    timePlayedMs: Number(row.time_played_ms) || 0,
  };
}

function statsToRow(stats) {
  return {
    worlds_awakened: stats.worldsAwakened,
    total_blooms: stats.totalBlooms,
    time_played_ms: stats.timePlayedMs,
  };
}

/** @returns {{ name: string, isGuest: boolean, spiritLook: number } | null} */
export function loadPlayer() {
  if (mode === "guest") {
    const p = guest.loadPlayer();
    if (!p) return null;
    return { ...p, spiritLook: normalizeSpiritLook(p.spiritLook) };
  }
  if (!accountRow) return null;
  return {
    name: accountRow.name,
    isGuest: false,
    spiritLook: normalizeSpiritLook(accountRow.spirit_look),
  };
}

/** @param {{ name: string, isGuest: boolean, spiritLook?: number }} player */
export function saveGuestPlayer(player) {
  guest.savePlayer(player);
}

/** @param {number} lookId */
export async function saveSpiritLook(lookId) {
  const id = normalizeSpiritLook(lookId);
  if (mode === "guest") {
    const p = guest.loadPlayer() ?? { name: "Guest", isGuest: true };
    guest.savePlayer({ ...p, isGuest: true, spiritLook: id });
    return;
  }
  if (!accountUserId || !accountRow) return;
  accountRow = { ...accountRow, spirit_look: id };
  const { error } = await updatePlayer(accountUserId, { spirit_look: id });
  if (error) console.error("[Bloom Spirits] Failed to save spirit look", error);
}

/** @returns {{ worldsAwakened: number, totalBlooms: number, timePlayedMs: number }} */
export function loadStats() {
  if (mode === "guest") return guest.loadStats();
  if (!accountRow) return { worldsAwakened: 0, totalBlooms: 0, timePlayedMs: 0 };
  return rowToStats(accountRow);
}

/** @param {{ worldsAwakened: number, totalBlooms: number, timePlayedMs: number }} stats */
export async function saveStats(stats) {
  if (mode === "guest") {
    guest.saveStats(stats);
    return;
  }
  if (!accountUserId || !accountRow) return;
  const next = { ...statsToRow(stats) };
  accountRow = {
    ...accountRow,
    worlds_awakened: next.worlds_awakened,
    total_blooms: next.total_blooms,
    time_played_ms: next.time_played_ms,
  };
  const { error } = await updatePlayer(accountUserId, accountRow);
  if (error) console.error("[Bloom Spirits] Failed to sync stats", error);
}

export async function incrementBlooms(n = 1) {
  const s = loadStats();
  s.totalBlooms += n;
  await saveStats(s);
}

export async function incrementWorldsAwakened() {
  const s = loadStats();
  s.worldsAwakened += 1;
  await saveStats(s);
}

export async function addTimePlayed(ms) {
  const s = loadStats();
  s.timePlayedMs += ms;
  await saveStats(s);
}

/** Clears guest identity only (local). */
export function clearGuestSession() {
  guest.clearSession();
}

export function formatPlayTime(ms) {
  return guest.formatPlayTime(ms);
}
