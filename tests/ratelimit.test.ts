import { describe, it, expect } from 'vitest';
import { MemoryLimiter } from '@/lib/ratelimit/memory';

describe('MemoryLimiter', () => {
  it('allows burst requests without waiting', async () => {
    const limiter = new MemoryLimiter({ ratePerSec: 10, burst: 5 });
    for (let i = 0; i < 5; i++) {
      expect(await limiter.acquire('user1')).toBe(0);
    }
  });

  it('returns wait time when burst exhausted', async () => {
    const limiter = new MemoryLimiter({ ratePerSec: 10, burst: 2 });
    await limiter.acquire('u');
    await limiter.acquire('u');
    const wait = await limiter.acquire('u');
    expect(wait).toBeGreaterThan(0);
  });

  it('isolates buckets per key', async () => {
    const limiter = new MemoryLimiter({ ratePerSec: 10, burst: 1 });
    expect(await limiter.acquire('a')).toBe(0);
    expect(await limiter.acquire('b')).toBe(0);
    // 'a' is now exhausted
    expect(await limiter.acquire('a')).toBeGreaterThan(0);
  });
});
