# GitLab Pipelines Dashboard

A real-time CI/CD observability dashboard for GitLab. Built for engineering managers who need to understand pipeline health at a glance - not just status, but trends, flakiness, and drift.

## Features

- **Pipeline overview** - paginated list with stage graphs, status badges, duration, and bulk retry/cancel
- **Flaky job detection** - identifies jobs that pass and fail on the same ref (the worst kind of CI noise)
- **Analytics** - success/failure ratio, average pipeline duration trends, top failing jobs
- **Health matrix** - GitHub-style heatmap of project health with MTTR calculation
- **CI drift detection** - flags outdated include templates and deprecated Docker images
- **Runner telemetry** - bottleneck detection and log error fingerprinting via Web Workers
- **Anomaly alerts** - spike detection (N failures in 15 min) and stuck pipeline warnings
- **Preview mode** - browse any public GitLab.com project without signing in

## Tech Stack

| Layer         | Technology                                                                     |
| ------------- | ------------------------------------------------------------------------------ |
| Framework     | [Astro](https://astro.build) (SSR, Node adapter)                               |
| UI            | React 19, Tailwind CSS 4, Radix UI primitives                                  |
| Charts        | Chart.js + react-chartjs-2                                                     |
| Data fetching | @tanstack/react-query, GitLab REST + GraphQL APIs                              |
| Validation    | Zod (API response schemas)                                                     |
| Notifications | Sonner (toast)                                                                 |
| Drawer        | Vaul (log viewer)                                                              |
| Dates         | date-fns                                                                       |
| Auth          | OAuth2 (GitLab) + iron-session                                                 |
| Rate limiting | Token-bucket per user, Retry-After honoring, in-memory cache with singleflight |

## Getting Started

### Prerequisites

- Node.js ≥ 22.12
- A GitLab.com account (or use preview mode without one)

### 1. Clone and install

```bash
git clone <repo-url>
cd gitlabs-dashboard
npm install
```

### 2. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Required for OAuth sign-in:

```env
GITLAB_URL=https://gitlab.com
GITLAB_CLIENT_ID=your_oauth_app_id
GITLAB_CLIENT_SECRET=your_oauth_app_secret
GITLAB_REDIRECT_URI=http://localhost:4321/auth/callback
SESSION_SECRET=a_random_string_at_least_32_characters_long
```

To create a GitLab OAuth application:

1. Go to https://gitlab.com/-/user_settings/applications
2. Name: `Pipeline Dashboard (dev)`
3. Redirect URI: `http://localhost:4321/auth/callback`
4. Scopes: `read_api`, `read_user`
5. Save → copy Application ID and Secret into `.env`

### 3. Run

```bash
npm run dev
```

Open http://localhost:4321. Sign in with GitLab, or click **"Browse public projects (preview)"** to explore without an account.

### 4. Build for production

```bash
npm run build
npm run preview   # test the production build locally
```

## Preview Mode

Preview mode lets anyone explore the dashboard against public GitLab.com projects - no account needed.

- Click "Browse public projects (preview)" on the login page
- Default projects: `gitlab-org/cli`, `inkscape/inkscape`
- Add any public project via the banner input (format: `group/project`)
- Bulk actions and CI lint are disabled (require write access)

Override defaults via env:

```env
PREVIEW_PROJECT_PATHS=gitlab-org/cli,inkscape/inkscape,gitlab-org/gitlab-runner
```

## Architecture

```
src/
├── pages/
│   ├── index.astro              # SSR entry - loads initial data
│   ├── auth/                    # OAuth + preview endpoints
│   └── api/                     # Server-side API routes
├── components/
│   ├── DashboardView.tsx        # Main client component (tabs, filters)
│   ├── FlakyJobsView.tsx        # Flaky job detection UI
│   ├── HealthMatrix.tsx         # Project health heatmap
│   ├── PipelineCard.tsx         # Individual pipeline card
│   ├── PipelineStageGraph.tsx   # Lazy-loaded stage/job graph
│   └── charts/                  # Chart.js wrappers
├── lib/
│   ├── gitlabService.ts         # REST API client (rate-limited, cached)
│   ├── gitlabGraphql.ts         # GraphQL client (pipelines + jobs in one call)
│   ├── apiQueue.ts              # Bounded-concurrency queue with retry
│   ├── cache/                   # Cache interface + in-memory impl
│   ├── ratelimit/               # Token-bucket rate limiter
│   └── session.ts               # Auth + access mode detection
├── hooks/                       # React hooks (filters, anomaly detection, telemetry)
├── workers/                     # Web Worker for background telemetry
└── types/                       # TypeScript types (gitlab.ts, telemetry.ts)
```

### Rate Limiting Strategy

GitLab.com allows ~2000 authenticated requests/min (~33/sec). The dashboard handles this via:

1. **Token bucket** (25 req/sec sustained, 50 burst) per user token hash
2. **Bounded concurrency** (5 in-flight max) in the request queue
3. **`Retry-After` honoring** - server-specified wait wins over computed backoff
4. **In-memory cache** - `fetchProjects` (5 min TTL), tag refs (1 hour TTL)
5. **Singleflight** - concurrent identical requests share one in-flight fetch
6. **GraphQL** - flaky-jobs and analytics use one query per project instead of N+1

### GraphQL vs REST

The dashboard uses both:

- **REST** for pipeline listing (rich filter support), job logs, CI YAML, project health
- **GraphQL** for analytics and flaky-job detection (pipelines + jobs in one round-trip per project)

## Commands

| Command           | Action                             |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start dev server at localhost:4321 |
| `npm run build`   | Build for production               |
| `npm run preview` | Preview production build           |
| `npx astro check` | TypeScript type checking           |

## License

MIT
