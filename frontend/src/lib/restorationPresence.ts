import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

const STORAGE_KEY = "bloom_restoration_session";

/**
 * Parallel Realtime “rooms” (shards). Each client joins one shard derived from their
 * session key so load spreads across many small channels (better sync performance than
 * one global channel). This is not a hard player cap — it’s a scaling partition.
 */
export const PRESENCE_SHARD_COUNT = 48;

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

function shardIndexForSession(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0) % PRESENCE_SHARD_COUNT;
}

function channelName(shard: number): string {
  return `bloom-presence-s${shard}`;
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
 * Subscribes to a sharded presence channel, tracks display name, and reports peers in the same shard.
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
  const shard = shardIndexForSession(sk);
  const topic = channelName(shard);

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
      shardIndex: shard,
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
