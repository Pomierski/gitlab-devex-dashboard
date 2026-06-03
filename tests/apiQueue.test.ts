import { describe, it, expect } from 'vitest';
import { ApiQueue } from '@/lib/apiQueue';

const noopLimiter = { acquire: async () => 0 };

describe('ApiQueue', () => {
  it('resolves enqueued tasks', async () => {
    const q = new ApiQueue({ limiter: noopLimiter });
    const result = await q.enqueue(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('respects concurrency limit', async () => {
    let concurrent = 0;
    let peak = 0;
    const q = new ApiQueue({ concurrency: 2, limiter: noopLimiter });

    const task = () =>
      new Promise<void>((r) => {
        concurrent++;
        peak = Math.max(peak, concurrent);
        setTimeout(() => {
          concurrent--;
          r();
        }, 20);
      });

    await Promise.all(Array.from({ length: 6 }, () => q.enqueue(task)));
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('retries on 429 with backoff', async () => {
    let attempts = 0;
    const q = new ApiQueue({ maxRetries: 2, baseDelayMs: 10, limiter: noopLimiter });

    const result = await q.enqueue(async () => {
      attempts++;
      if (attempts < 3) throw Object.assign(new Error(), { status: 429 });
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('rejects after exhausting retries', async () => {
    const q = new ApiQueue({ maxRetries: 1, baseDelayMs: 10, limiter: noopLimiter });

    await expect(
      q.enqueue(async () => {
        throw Object.assign(new Error('fail'), { status: 500 });
      }),
    ).rejects.toThrow('fail');
  });

  it('does not retry client errors (4xx except 429)', async () => {
    let attempts = 0;
    const q = new ApiQueue({ maxRetries: 3, baseDelayMs: 10, limiter: noopLimiter });

    await expect(
      q.enqueue(async () => {
        attempts++;
        throw Object.assign(new Error(), { status: 403 });
      }),
    ).rejects.toThrow();

    expect(attempts).toBe(1);
  });
});
