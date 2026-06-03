/**
 * Validate required environment variables at startup. Imported at the top of
 * astro.config.mjs (server entry) so the process crashes immediately with a
 * clear message rather than producing cryptic runtime errors later.
 */
const REQUIRED_VARS = [
  'SESSION_SECRET',
  'GITLAB_CLIENT_ID',
  'GITLAB_CLIENT_SECRET',
  'GITLAB_REDIRECT_URI',
] as const;

export function validateEnv() {
  if (!import.meta.env.PROD) return;

  const missing = REQUIRED_VARS.filter((key) => !import.meta.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables in production:\n  ${missing.join('\n  ')}`,
    );
  }
}

validateEnv();
