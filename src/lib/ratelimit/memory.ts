import type { RateLimiter } from './types';

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface TokenBucketOptions {
  /** Sustained rate, tokens per second. Default 25. */
  ratePerSec?: number;
  /** Burst capacity. Default 50. */
  burst?: number;
}

/**
 * Token-bucket rate limiter, one bucket per key. Sized for GitLab.com's
 * ~33 req/sec authenticated limit by default — slightly conservative so we
 * never quite reach the ceiling and trigger 429s on our own.
 */
export class MemoryLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly ratePerMs: number;
  private readonly burst: number;

  constructor(opts: TokenBucketOptions = {}) {
    const rate = opts.ratePerSec ?? 25;
    this.ratePerMs = rate / 1000;
    this.burst = opts.burst ?? 50;
  }

  async acquire(key: string): Promise<number> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.burst, lastRefillMs: now };
      this.buckets.set(key, bucket);
    }

    // Refill since last touch
    const elapsed = now - bucket.lastRefillMs;
    if (elapsed > 0) {
      bucket.tokens = Math.min(this.burst, bucket.tokens + elapsed * this.ratePerMs);
      bucket.lastRefillMs = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return 0;
    }

    // Not enough tokens — caller should wait until 1 is available
    const deficit = 1 - bucket.tokens;
    const waitMs = Math.ceil(deficit / this.ratePerMs);
    // Pre-charge: assume the caller will wait then proceed
    bucket.tokens -= 1;
    return waitMs;
  }
}

/** Module-level default. Swap to a Redis-backed limiter when multi-instance. */
export const defaultLimiter: RateLimiter = new MemoryLimiter();
