const PLAYER_KEY = "bloom_spirits_player";
const STATS_KEY = "bloom_spirits_stats";

/** @returns {{ name: string, isGuest: boolean } | null} */
export function loadPlayer() {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** @param {{ name: string, isGuest: boolean }} player */
export function savePlayer(player) {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

export function clearPlayer() {
  localStorage.removeItem(PLAYER_KEY);
}

/** @returns {{ worldsAwakened: number, totalBlooms: number, timePlayedMs: number }} */
export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { worldsAwakened: 0, totalBlooms: 0, timePlayedMs: 0 };
    const s = JSON.parse(raw);
    return {
      worldsAwakened: Number(s.worldsAwakened) || 0,
      totalBlooms: Number(s.totalBlooms) || 0,
      timePlayedMs: Number(s.timePlayedMs) || 0,
    };
  } catch {
    return { worldsAwakened: 0, totalBlooms: 0, timePlayedMs: 0 };
  }
}

/** @param {{ worldsAwakened: number, totalBlooms: number, timePlayedMs: number }} stats */
export function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function incrementBlooms(n = 1) {
  const s = loadStats();
  s.totalBlooms += n;
  saveStats(s);
}

export function incrementWorldsAwakened() {
  const s = loadStats();
  s.worldsAwakened += 1;
  saveStats(s);
}

export function addTimePlayed(ms) {
  const s = loadStats();
  s.timePlayedMs += ms;
  saveStats(s);
}

/** Logout: clear identity; keep lifetime stats on device (optional — can clear stats too). */
export function clearSession() {
  clearPlayer();
}

export function formatPlayTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
