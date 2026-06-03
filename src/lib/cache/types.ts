/**
 * Generic key/value cache with TTL. Implementations may be in-memory or
 * backed by Redis; consumers should depend only on this interface.
 */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;

  /**
   * Read-through with singleflight: at most one `fn()` runs concurrently for
   * a given key — duplicate concurrent callers wait for the in-flight result.
   * Errors from `fn()` are not cached; the in-flight slot is cleared so the
   * next caller can retry.
   */
  getOrSet<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T>;
}
