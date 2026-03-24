import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

const STORAGE_KEY = "bloom_restoration_session";

export type RoomMode = "public" | "private";

export type RestorationPresencePeer = { name: string };

export type RestorationPresenceUpdate = {
  count: number;
  multiplier: number;
  peers: RestorationPresencePeer[];
  /** Which shard (0 .. PRESENCE_SHARD_COUNT-1); for debugging only, not shown in UI */
  shardIndex: number;
};

function sessionKey(): string {
  try {
    let k = localStorage.getItem(STORAGE_KEY);
    if (!k) {
      k = `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(STORAGE_KEY, k);
    }
    return k;
  } catch {
    return `anon-${Date.now()}`;
  }
}

function roomConfig(): { mode: RoomMode; key: string } {
  try {
    const params = new URLSearchParams(window.location.search);
    const modeRaw = params.get("mode")?.trim().toLowerCase();
    const mode: RoomMode = modeRaw === "private" ? "private" : "public";
    const room = params.get("room")?.trim();
    if (mode === "private" && room) {
      return { mode, key: `private:${room.toLowerCase()}` };
    }
    if (room) {
      // Backward compatibility: `?room=...` without mode acts as private room.
      return { mode: "private", key: `private:${room.toLowerCase()}` };
    }
  } catch {
    // Ignore URL parsing issues and fallback to public room.
  }
  return { mode: "public", key: "public:global" };
}

function channelName(roomKey: string): string {
  const safe = roomKey.replace(/[^a-z0-9:_-]/gi, "-").slice(0, 80);
  return `bloom-presence-${safe}`;
}

/** More spirits in the same shard → higher multiplier (diminishing returns). */
export function helpersToMultiplier(helperCount: number): number {
  const n = Math.max(1, Math.floor(helperCount));
  if (n <= 1) return 1;
  return 1 + Math.min(2.5, 0.26 * (n - 1) ** 0.82);
}

function extractPeers(presenceState: Record<string, unknown>): RestorationPresencePeer[] {
  const out: RestorationPresencePeer[] = [];
  for (const key of Object.keys(presenceState)) {
    const entries = presenceState[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const pres = (entry as { presence?: Record<string, unknown> }).presence;
      if (pres && typeof pres.name === "string" && pres.name.length > 0) {
        out.push({ name: pres.name });
      }
    }
  }
  return out;
}

/**
 * Subscribes to a room channel, tracks display name, and reports peers in the same room.
 * When Supabase is off, behaves as solo play with a fake peer list.
 */
export function subscribeRestorationPresence(
  initialDisplayName: string,
  onChange: (u: RestorationPresenceUpdate) => void,
): { unsubscribe: () => void; setDisplayName: (name: string) => void } {
  let displayName = initialDisplayName.trim() || "Guest";
  const joinedAt = Date.now();
  let ch: ReturnType<ReturnType<typeof getSupabase>["channel"]> | null = null;

  const emitSolo = () => {
    onChange({
      count: 1,
      multiplier: helpersToMultiplier(1),
      peers: [{ name: displayName }],
      shardIndex: 0,
    });
  };

  if (!isSupabaseConfigured) {
    emitSolo();
    return {
      unsubscribe: () => {},
      setDisplayName: (name: string) => {
        displayName = name.trim() || "Guest";
        emitSolo();
      },
    };
  }

  const supabase = getSupabase();
  const sk = sessionKey();
  const cfg = roomConfig();
  const topic = channelName(cfg.key);

  const sync = () => {
    if (!ch) return;
    const state = ch.presenceState() as Record<string, unknown>;
    const keys = Object.keys(state);
    const n = Math.max(1, keys.length);
    const peers = extractPeers(state);
    onChange({
      count: n,
      multiplier: helpersToMultiplier(n),
      peers,
      shardIndex: 0,
    });
  };

  ch = supabase.channel(topic, {
    config: { presence: { key: sk } },
  });

  ch.on("presence", { event: "sync" }, sync).subscribe(async (status) => {
    if (status === "SUBSCRIBED" && ch) {
      await ch.track({ name: displayName, at: joinedAt });
      sync();
    }
  });

  const setDisplayName = (name: string) => {
    displayName = name.trim() || "Guest";
    void ch?.track({ name: displayName, at: joinedAt });
    sync();
  };

  return {
    unsubscribe: () => {
      ch?.unsubscribe().catch(() => {});
      ch = null;
    },
    setDisplayName,
  };
}
