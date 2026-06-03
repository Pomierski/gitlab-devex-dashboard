# Changelog

## [1.0.0] - 2026-06-03

### Features

- Pipeline overview with paginated list, stage graphs, status badges, duration, and bulk retry/cancel
- Flaky job detection — identifies jobs that pass and fail on the same ref
- Analytics — success/failure ratio, average pipeline duration trends, top failing jobs
- Health matrix — heatmap of project health with MTTR calculation
- CI drift detection — flags outdated include templates and deprecated Docker images
- Runner telemetry — bottleneck detection and log error fingerprinting via Web Workers
- Anomaly alerts — spike detection (N failures in 15 min) and stuck pipeline warnings
- Preview mode — browse any public GitLab.com project without signing in
- OAuth2 authentication with GitLab

### Security

- OAuth CSRF state validation (stored in session, verified on callback)
- Environment variable validation at startup — fails fast in production if required vars are missing
- Security headers middleware (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy)
- Error response sanitization — generic messages to clients, details logged server-side
- Zod validation on all POST request bodies (bulk-action, ci-lint)
- Session secret throws in production if unset (no hardcoded fallback)

### Architecture

- Split `gitlabService.ts` into focused modules: `gitlabClient.ts`, `gitlabPipelines.ts`, `gitlabAnalytics.ts`
- Code-split heavy dependencies (chart.js, react-syntax-highlighter) via React.lazy + manualChunks
- React ErrorBoundary at app root with recovery UI
- Token-bucket rate limiter with bounded-concurrency queue and Retry-After honoring
- In-memory cache with singleflight deduplication
- GraphQL for analytics/flaky detection (one query per project instead of N+1)

### Developer Experience

- Vitest test setup with 13 tests covering rate limiter, cache, and API queue
- Prettier + ESLint with `curly: "error"` enforced
- Pinned dependency versions
- `@types/*` and `@tailwindcss/vite` moved to devDependencies
- Healthcheck endpoint at `/api/health`
- Custom 404 page
- `perPage` query param clamped to 1–100ś