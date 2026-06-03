import { describe, it, expect, vi } from 'vitest';
import { MemoryCache } from '@/lib/cache/memory';

describe('MemoryCache', () => {
  it('stores and retrieves values', async () => {
    const cache = new MemoryCache();
    await cache.set('k', 'v', 60);
    expect(await cache.get('k')).toBe('v');
  });

  it('returns undefined for expired entries', async () => {
    vi.useFakeTimers();
    const cache = new MemoryCache();
    await cache.set('k', 'v', 1);
    vi.advanceTimersByTime(2000);
    expect(await cache.get('k')).toBeUndefined();
    vi.useRealTimers();
  });

  it('evicts oldest entry when maxEntries exceeded', async () => {
    const cache = new MemoryCache({ maxEntries: 2 });
    await cache.set('a', 1, 60);
    await cache.set('b', 2, 60);
    await cache.set('c', 3, 60);
    expect(await cache.get('a')).toBeUndefined();
    expect(await cache.get('b')).toBe(2);
    expect(await cache.get('c')).toBe(3);
  });

  it('getOrSet deduplicates concurrent calls (singleflight)', async () => {
    const cache = new MemoryCache();
    let calls = 0;
    const fn = () => new Promise<number>((r) => setTimeout(() => r(++calls), 50));
    const [r1, r2] = await Promise.all([cache.getOrSet('k', 60, fn), cache.getOrSet('k', 60, fn)]);
    expect(r1).toBe(1);
    expect(r2).toBe(1);
    expect(calls).toBe(1);
  });

  it('del removes entry', async () => {
    const cache = new MemoryCache();
    await cache.set('k', 'v', 60);
    await cache.del('k');
    expect(await cache.get('k')).toBeUndefined();
  });
});
