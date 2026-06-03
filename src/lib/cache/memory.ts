import type { Cache } from './types';

interface Entry {
  value: unknown;
  expiresAt: number; // epoch ms
}

export interface MemoryCacheOptions {
  /** Hard cap on entries; oldest are evicted when exceeded. Default 1000. */
  maxEntries?: number;
}

/**
 * Process-local cache. Wraps values internally so that `undefined` can be
 * distinguished from "missing entry". LRU bound prevents unbounded growth in
 * long-lived dev sessions.
 */
export class MemoryCache implements Cache {
  private readonly store = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;

  constructor(opts: MemoryCacheOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 1000;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Map maintains insertion order; re-insert to mark as recently used.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSec: number): Promise<void> {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      // Evict oldest (first iteration order)
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async getOrSet<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = (async () => {
      try {
        const value = await fn();
        await this.set(key, value, ttlSec);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }
}

/** Module-level default. Swap to a `RedisCache` when multi-instance. */
export const defaultCache: Cache = new MemoryCache();
