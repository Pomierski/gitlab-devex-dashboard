import type { RateLimiter } from '@/lib/ratelimit/types';
import { defaultLimiter } from '@/lib/ratelimit/memory';

interface QueueTask<T> {
  fn: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  rateLimitKey?: string;
}

export interface ApiQueueOptions {
  concurrency?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  /** Cap on a single Retry-After-driven wait. Default 30s. */
  maxRetryAfterMs?: number;
  limiter?: RateLimiter;
}

export interface EnqueueOptions {
  /**
   * Identifier (e.g. hashed user token) for per-user rate limiting. If
   * omitted, the queue still applies its concurrency cap but skips the
   * token-bucket check.
   */
  rateLimitKey?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Bounded-concurrency request queue with retry + rate limiting.
 *
 * - **Concurrency cap** prevents head-of-line blocking; in-flight requests
 *   are limited regardless of caller patterns.
 * - **Token-bucket limiter** (per `rateLimitKey`) caps requests-per-second
 *   independently of concurrency, so fast endpoints don't burst over the
 *   server's ceiling.
 * - **Retry**: 429 / 5xx are retried with exponential backoff. If the error
 *   carries `retryAfterMs` (parsed from `Retry-After`), that wins over the
 *   computed backoff — capped at `maxRetryAfterMs` to avoid unbounded waits.
 */
export class ApiQueue {
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxRetryAfterMs: number;
  private readonly limiter: RateLimiter;
  private running = 0;
  private readonly queue: QueueTask<unknown>[] = [];

  constructor(opts: ApiQueueOptions = {}) {
    this.concurrency = opts.concurrency ?? 5;
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.maxRetryAfterMs = opts.maxRetryAfterMs ?? 30_000;
    this.limiter = opts.limiter ?? defaultLimiter;
  }

  enqueue<T>(fn: () => Promise<T>, opts: EnqueueOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject,
        rateLimitKey: opts.rateLimitKey,
      } as QueueTask<unknown>);
      this.drain();
    });
  }

  private drain() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running++;
      this.run(task).finally(() => {
        this.running--;
        this.drain();
      });
    }
  }

  private async run<T>(task: QueueTask<T>, attempt = 0): Promise<void> {
    // Per-key rate limit (no-op when no key provided)
    if (task.rateLimitKey) {
      const wait = await this.limiter.acquire(task.rateLimitKey);
      if (wait > 0) await sleep(wait);
    }

    try {
      task.resolve(await task.fn());
    } catch (err) {
      const e = err as { status?: number; retryAfterMs?: number };
      const status = e.status;
      const shouldRetry =
        (status === 429 || (status != null && status >= 500)) && attempt < this.maxRetries;

      if (!shouldRetry) {
        task.reject(err);
        return;
      }

      // Server-specified wait wins over computed backoff
      const computed = this.baseDelayMs * 2 ** attempt + Math.random() * 100;
      const serverHint = e.retryAfterMs;
      const delay =
        serverHint != null ? Math.min(this.maxRetryAfterMs, Math.max(serverHint, 0)) : computed;

      await sleep(delay);
      return this.run(task, attempt + 1);
    }
  }
}

export const defaultQueue = new ApiQueue({ concurrency: 5 });
