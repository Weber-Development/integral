/** Minimal key-value storage. `localStorage`, a file or a database row all fit. */
export interface LicenseStorage {
  get(key: string): string | null | undefined | Promise<string | null | undefined>;
  set(key: string, value: string): void | Promise<void>;
  delete(key: string): void | Promise<void>;
}

export function memoryStorage(): LicenseStorage {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    delete: (key) => void map.delete(key),
  };
}

/** Wraps `window.localStorage`; falls back to memory where it is unavailable or blocked. */
export function browserStorage(prefix = "integral:"): LicenseStorage {
  const fallback = memoryStorage();
  const local = (): Storage | null => {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        return local()?.getItem(prefix + key) ?? fallback.get(key);
      } catch {
        return fallback.get(key);
      }
    },
    set(key, value) {
      try {
        local()?.setItem(prefix + key, value);
      } catch {
        // Storage full or blocked: keep it in memory for this session.
      }
      fallback.set(key, value);
    },
    delete(key) {
      try {
        local()?.removeItem(prefix + key);
      } catch {
        // ignore
      }
      fallback.delete(key);
    },
  };
}

export interface CheckOutcome<T = unknown> {
  valid: boolean;
  reason?: string;
  data?: T;
}

export interface CachedOutcome<T = unknown> extends CheckOutcome<T> {
  /** When the server last answered (ms since epoch). */
  checkedAt: number;
  /** `network`: fresh answer. `cache`: within `ttl`. `grace`: server unreachable, last good answer used. */
  source: "network" | "cache" | "grace";
}

export interface OfflineGraceOptions {
  storage?: LicenseStorage;
  /** Storage key, e.g. per license key. */
  key: string;
  /** Re-use a good answer this long without asking the server. Default 1 hour. */
  ttl?: number;
  /** Keep a good answer this long while the server is unreachable. Default 7 days. */
  grace?: number;
  now?: () => number;
}

/**
 * Wraps an online license check (for example Polar) so apps keep working offline for a while.
 * Definitive answers (valid or invalid) are cached; thrown errors count as "server unreachable".
 */
export function withOfflineGrace<T>(
  check: () => Promise<CheckOutcome<T>>,
  options: OfflineGraceOptions,
): () => Promise<CachedOutcome<T>> {
  const storage = options.storage ?? memoryStorage();
  const ttl = options.ttl ?? 60 * 60 * 1000;
  const grace = options.grace ?? 7 * 24 * 60 * 60 * 1000;
  const now = options.now ?? Date.now;

  const read = async (): Promise<CachedOutcome<T> | null> => {
    try {
      const raw = await storage.get(options.key);
      return raw ? (JSON.parse(raw) as CachedOutcome<T>) : null;
    } catch {
      return null;
    }
  };

  return async () => {
    const cached = await read();
    const age = cached ? now() - cached.checkedAt : Number.POSITIVE_INFINITY;
    if (cached?.valid && age < ttl) return { ...cached, source: "cache" };
    try {
      const outcome = await check();
      const fresh: CachedOutcome<T> = { ...outcome, checkedAt: now(), source: "network" };
      await storage.set(options.key, JSON.stringify(fresh));
      return fresh;
    } catch (error) {
      if (cached?.valid && age < grace) return { ...cached, source: "grace" };
      return {
        valid: false,
        reason: "unreachable",
        checkedAt: cached?.checkedAt ?? 0,
        source: "network",
        data: error instanceof Error ? (error.message as T) : undefined,
      };
    }
  };
}
