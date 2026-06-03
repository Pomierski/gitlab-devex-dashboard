/**
 * Per-key rate limiter. `acquire` returns the number of milliseconds the
 * caller should wait before proceeding (0 if allowed immediately). The caller
 * is responsible for actually sleeping; this keeps the limiter side-effect
 * free and easy to mock.
 */
export interface RateLimiter {
  acquire(key: string): Promise<number>;
}
