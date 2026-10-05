# Tracks Starter

Production-ready monorepo starter for web + mobile apps — designed for AI-assisted development with [Claude Code](https://claude.com/claude-code).

> **First thing after cloning**: Find and replace to make this yours.
> See [Personalize This Starter](#personalize-this-starter) below.

---

## Supercharge Your Development with AI Tooling

This starter is built to work hand-in-hand with Claude Code. Many of the providers in this stack ship **official MCP servers** that let Claude directly manage your databases, deployments, error monitoring, emails, and more — right from your terminal. Below is how to set everything up.

> [!TIP]
> **You can ask Claude to walk you through this entire setup**, including secret configuration, provider account creation, and environment variables. Just open Claude Code in this repo and say: *"Help me set up my MCP servers and secrets for this project."*

### Recommended Claude Code Plugins

These plugins are available from the [official Anthropic plugin marketplace](https://github.com/anthropics/claude-code-plugins). Install them with `claude plugin add <name>`:

| Plugin | What it does | Why it matters here |
|--------|-------------|---------------------|
| **context7** | Injects live, up-to-date docs for any library into Claude's context | Ensures Claude uses current APIs for React 19, Fastify 5, Supabase, Tailwind v4, Vite 8, Capacitor 8, Zod, etc. |
| **playwright** | Browser automation via Playwright MCP | Powers E2E test writing and debugging for the `e2e/` suite |
| **frontend-design** | Generates polished, production-grade UI components | Build distinctive interfaces for the React SPA without generic AI aesthetics |
| **feature-dev** | Guided feature development with codebase understanding | Follows this repo's three-file rule and architecture patterns automatically |
| **superpowers** | TDD, planning, debugging, and code review workflows | Structured workflows for the session-based development this repo expects |
| **pr-review-toolkit** | Comprehensive PR review with specialized agents | Catches style violations, silent failures, type design issues, and test gaps |
| **code-review** | Pull request code review | Validates changes against CLAUDE.md rules before merge |
| **code-simplifier** | Simplifies and refines code for clarity | Keeps implementations clean after feature work |
| **claude-md-management** | Audits and improves CLAUDE.md files | Maintains the project's AI instruction files as the codebase evolves |

### Official MCP Servers

Add these to your project's `.mcp.json` (create it at the repo root) or configure via `claude mcp add`. Each server connects Claude directly to a stack provider's API.

#### Supabase — Database, Auth, Storage, Migrations

Manage your Supabase project, run SQL, apply migrations, deploy edge functions, and search docs — all from Claude.

```bash
claude mcp add --transport http supabase https://mcp.supabase.com/mcp
```

Authentication happens via OAuth — a browser window opens on first use. To scope to a specific project and enable read-only mode:

```bash
claude mcp add --transport http supabase "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"
```

For CI/headless environments, use a Supabase access token:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}",
      "headers": {
        "Authorization": "Bearer ${SUPABASE_ACCESS_TOKEN}"
      }
    }
  }
}
```

| | |
|---|---|
| **Docs** | [supabase.com/docs/guides/getting-started/mcp](https://supabase.com/docs/guides/getting-started/mcp) |
| **Repo** | [github.com/supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp) |
| **Capabilities** | SQL queries, migrations, edge functions, project management, docs search, branching |

---

#### GitHub — Repos, Issues, PRs, Actions, Pages

Manage repositories, create issues and PRs, view Actions workflows, search code, and deploy to GitHub Pages — all from Claude. This is your deployment target for the web app.

```bash
claude mcp add-json github '{"type":"http","url":"https://api.githubcopilot.com/mcp/","headers":{"Authorization":"Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"}}'
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

Create a personal access token at [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) with `repo`, `read:org`, and `read:packages` scopes. To enable Actions and security toolsets, set `GITHUB_TOOLSETS=all` in your environment.

| | |
|---|---|
| **Docs** | [github.com/github/github-mcp-server](https://github.com/github/github-mcp-server) |
| **Repo** | [github.com/github/github-mcp-server](https://github.com/github/github-mcp-server) |
| **Capabilities** | Repos, branches, issues, PRs, reviews, Actions, code search, code scanning, notifications (51 tools) |

---

#### Sentry — Error Monitoring & Debugging

Search issues, view error details, trigger AI-powered root cause analysis, and monitor fixes — all from Claude.

```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

Authentication is via OAuth. No API keys needed for interactive use.

For self-hosted Sentry or offline use (stdio transport):

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["@sentry/mcp-server"],
      "env": {
        "SENTRY_ACCESS_TOKEN": "YOUR_SENTRY_AUTH_TOKEN"
      }
    }
  }
}
```

| | |
|---|---|
| **Docs** | [docs.sentry.io/product/sentry-mcp](https://docs.sentry.io/product/sentry-mcp/) |
| **Repo** | [github.com/getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp) |
| **Capabilities** | Issue search, error details, AI autofix, release management, event queries |

---

#### Resend — Transactional Email

Send emails, manage contacts, domains, broadcasts, and webhooks — all from Claude.

```bash
claude mcp add resend -e RESEND_API_KEY=re_xxxxxxxxx -- npx -y resend-mcp
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "resend": {
      "command": "npx",
      "args": ["-y", "resend-mcp"],
      "env": {
        "RESEND_API_KEY": "re_xxxxxxxxx"
      }
    }
  }
}
```

| | |
|---|---|
| **Docs** | [resend.com/docs/knowledge-base/mcp-server](https://resend.com/docs/knowledge-base/mcp-server) |
| **Repo** | [github.com/resend/resend-mcp](https://github.com/resend/resend-mcp) |
| **Capabilities** | Send/batch email, contacts, domains, broadcasts, webhooks, API key management |

---

#### Stripe — Payments (when you're ready)

Create products, prices, payment links, invoices, subscriptions, and search Stripe docs — all from Claude. Use a **restricted API key** for safety.

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--tools=all"],
      "env": {
        "STRIPE_SECRET_KEY": "rk_test_xxxxxxxxx"
      }
    }
  }
}
```

| | |
|---|---|
| **Docs** | [docs.stripe.com/mcp](https://docs.stripe.com/mcp) |
| **Repo** | [github.com/stripe/ai](https://github.com/stripe/ai) |
| **Capabilities** | Customers, products, prices, payment links, invoices, subscriptions, balance, Stripe docs search |

---

#### Upstash — Redis Management (for BullMQ)

Manage Redis databases, run commands, create backups, and monitor usage — all from Claude. Useful for inspecting BullMQ queues.

```bash
claude mcp add upstash -- npx -y @upstash/mcp-server@latest \
  --email YOUR_UPSTASH_EMAIL \
  --api-key YOUR_UPSTASH_API_KEY
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": ["-y", "@upstash/mcp-server@latest", "--email", "YOUR_EMAIL", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

Get your API key at [console.upstash.com/account/api](https://console.upstash.com/account/api).

| | |
|---|---|
| **Docs** | [upstash.com/docs/redis/integrations/mcp](https://upstash.com/docs/redis/integrations/mcp) |
| **Repo** | [github.com/upstash/mcp-server](https://github.com/upstash/mcp-server) |
| **Capabilities** | Database CRUD, Redis commands, backups, usage stats — run BullMQ inspection commands directly |

---

#### Cloudflare — CDN, Workers, DNS (optional)

If you use Cloudflare for DNS, CDN, or Workers, their MCP server gives Claude access to the entire Cloudflare API.

```bash
claude mcp add --transport http cloudflare https://mcp.cloudflare.com/mcp
```

| | |
|---|---|
| **Docs** | [developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/) |
| **Repo** | [github.com/cloudflare/mcp](https://github.com/cloudflare/mcp) |
| **Capabilities** | Workers, KV, R2, D1, DNS, firewall, Pages, and 2,500+ API endpoints |

---

### Example `.mcp.json` (all servers)

Create this file at the repo root. Only include the servers you use:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp"
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    },
    "sentry": {
      "url": "https://mcp.sentry.dev/mcp"
    },
    "resend": {
      "command": "npx",
      "args": ["-y", "resend-mcp"],
      "env": {
        "RESEND_API_KEY": "${RESEND_API_KEY}"
      }
    },
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--tools=all"],
      "env": {
        "STRIPE_SECRET_KEY": "${STRIPE_SECRET_KEY}"
      }
    },
    "upstash": {
      "command": "npx",
      "args": ["-y", "@upstash/mcp-server@latest", "--email", "${UPSTASH_EMAIL}", "--api-key", "${UPSTASH_API_KEY}"]
    }
  }
}
```

> [!NOTE]
> Servers using OAuth (Supabase, Sentry) will prompt you to authenticate in your browser on first use. Servers using API keys or tokens (GitHub, Resend, Stripe, Upstash) read from environment variables — set them in your shell profile or `.env` files. **Ask Claude to help you configure secrets** — it can guide you through each provider's dashboard.

---

### Building Features with Claude Code

This is the recommended workflow for full-stack feature development. It's designed for ambitious asks like *"Build a complete login screen with OAuth, email/password, forgot password, and session management."* The process is deliberate — it front-loads research and planning so implementation goes smoothly.

#### Phase 1: Research (4 parallel agents)

Tell Claude what you want to build and ask it to research the codebase first. Claude will dispatch agents in parallel to:

1. Scan all existing UI components, pages, and layouts related to your feature
2. Trace the API layer — routes, services, schemas, and hooks in scope
3. Map database tables, migrations, and RLS policies that will be touched
4. Audit shared types, validation schemas, and state management related to the feature

This gives Claude (and you) a complete picture of what already exists before a single line is written.

> **Example prompt**: *"I want to build a login screen with email/password, Google OAuth, forgot password flow, and session persistence. Use 4 agents to research every existing line of code related to auth, sessions, routing, and the current login page."*

#### Phase 2: Spec & Gap Analysis (2 review cycles)

Claude will use the **superpowers brainstorming** skill to quiz you on every detail you didn't cover — edge cases, error states, mobile behavior, loading states, accessibility, multi-user scenarios. Answer each question one at a time.

Once the first spec is written and reviewed, **ask for a second full gap analysis cycle**. This catches assumptions that survived the first pass — missing transitions, unhandled token expiry, race conditions between tabs, keyboard behavior on mobile, etc.

> **Example prompt after first spec review**: *"Run a second gap analysis. Look for anything we missed — edge cases, mobile-specific behavior, multi-user state, error recovery, and regressions to existing features."*

#### Phase 3: Chunked Implementation Plan

The spec gets compiled into an implementation plan broken into **~200k context chunks** — each chunk is a self-contained unit of work that Claude can complete in a single focused session. Chunks run sequentially because later chunks often depend on earlier ones.

Between every chunk:
- **`/compact`** to reclaim context space
- Review what was just completed before starting the next chunk

This prevents context degradation on large features. A login screen might break into: (1) schemas + API routes, (2) auth service + hooks, (3) UI components + pages, (4) state management + session persistence, (5) error handling + edge cases.

#### Phase 4: Verification (after every chunk)

After each implementation chunk, Claude uses **Claude for Chrome** to run a full manual verification:

1. **All changes** — visually confirm every new and modified screen, flow, and interaction
2. **Desktop + Mobile** — verify at full width, then at 375px. Mobile is first-class.
3. **Multi-user** — open a second tab/profile, confirm state isolation and concurrent behavior
4. **Edge cases** — empty states, invalid input, network errors, rapid actions, token expiry
5. **Regression sweep** — re-check every feature that was touched but not changed. If the login screen is new but the dashboard layout was adjusted to accommodate it, verify the dashboard still works.

Nothing moves forward until verification passes. Fix and re-verify.

#### Phase 5: Commit

After all chunks are implemented and verified, commit with descriptive messages. Each chunk typically gets its own commit.

#### Quick Reference

```
You:   "Build [feature]. Use 4 agents to research all related code first."
        ↓
Claude: Researches → quizzes you on details → writes spec
        ↓
You:   "Run a second gap analysis."
        ↓
Claude: Second review cycle → finalizes spec
        ↓
You:   "Create a plan in ~200k context chunks."
        ↓
Claude: Implements chunk 1 → verifies with Chrome → /compact
        ↓
Claude: Implements chunk 2 → verifies with Chrome → /compact
        ↓
        ... repeat until done ...
        ↓
Claude: Final regression sweep → commit
```

> [!TIP]
> **You don't need to type all of this out.** This repo includes a `/build` slash command and an auto-detection hook:
>
> **Explicit** — type `/build` to invoke the structured workflow directly:
> ```
> /build login screen with email/password, Google OAuth, forgot password, and session persistence
> ```
>
> **Automatic** — just describe what you want naturally. A `UserPromptSubmit` hook detects feature-request prompts and tells Claude to follow the `/build` workflow:
> ```
> I want to build a dashboard with analytics charts, user activity feeds, and export to CSV
> ```
>
> Either way, Claude runs the full workflow — 4-agent research, spec with quiz, second gap analysis, chunked plan, and verification after each chunk.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22 LTS |
| Package Manager | pnpm | 9 |
| Monorepo | Turborepo | 2 |
| Frontend | React + Vite | 19 + 7 |
| Mobile | Capacitor | 8 |
| Backend | Fastify | 5 |
| Database | Supabase (Postgres) | - |
| Auth | Supabase Auth | - |
| Storage | Supabase Storage | - |
| Job Queue | BullMQ + Redis | 5 + 7 |
| UI Components | shadcn/ui + Radix | - |
| Styling | Tailwind CSS | 4 |
| State | Zustand + TanStack Query | 5 + 5 |
| Validation | Zod | 3 |
| Error Monitoring | Sentry | 9 |
| Email | Resend (via BullMQ) | - |
| Testing | Vitest + Playwright | 3 + 1 |
| CI/CD | GitHub Actions | - |
| Deployment | GitHub Pages (web) + Railway (API) | - |

## Architecture

```mermaid
graph LR
    Browser["Browser / Mobile"]
    SPA["React SPA<br/>(Vite / Capacitor)"]
    Auth["Supabase Auth"]
    API["Fastify API"]
    DB["Supabase<br/>(Postgres + Storage)"]
    Queue["Redis / BullMQ"]
    Email["Resend"]

    Browser --> SPA
    SPA -- "anon key<br/>(auth only)" --> Auth
    SPA -- "all data" --> API
    API -- "service role key" --> DB
    API --> Queue --> Email
```

> [!IMPORTANT]
> **Proxy boundary** -- the frontend never queries Supabase for data. All data access goes through the Fastify API using the service role key. The frontend only uses the Supabase anon key for authentication UI flows. See [ADR-002](docs/decisions/002-proxy-boundary.md).

### Monorepo Structure

```
tracks/
├── apps/
│   ├── api/            Fastify v5 API
│   └── web/            React 19 SPA + Capacitor
├── packages/
│   ├── types/          Shared Zod schemas and TypeScript types
│   └── config/         TSConfig, ESLint, Prettier base configs
├── supabase/           Migrations, seed data, config
├── e2e/                Playwright E2E tests
└── docs/decisions/     Architecture Decision Records
```

---

## Personalize This Starter

After cloning, run these find-and-replace operations across the entire repo:

| Find | Replace with | Description |
|------|-------------|-------------|
| `@tracks` | `@yourscope` | Package scope in all package.json, imports, scripts |
| `Tracks` | `YourApp` | Display name in UI, emails, HTML title |
| `myapp` | `yourapp` | Lowercase in config IDs, email addresses, URLs |
| `com.tracks.app` | `com.yourcompany.yourapp` | Capacitor app ID |
| `tracks_app` | `yourapp` | Supabase project ID in `supabase/config.toml` |
| `noreply@tracks.com` | `noreply@yourdomain.com` | Email sender in `apps/api/src/services/email.service.ts` |

> **Tip**: Use your editor's global find-and-replace (Cmd+Shift+H / Ctrl+Shift+H). All placeholder names are intentionally unique so they won't collide with real code.

After replacing, run `pnpm install` to update the lockfile with your new package names.

---

## Prerequisites

1. **Node.js 24** -- pinned in `.nvmrc`, use `nvm use`
2. **pnpm 12** -- `corepack enable` to activate
3. **Docker** -- for Redis and Supabase local dev
4. **Supabase CLI** -- `brew install supabase/tap/supabase` or [install docs](https://supabase.com/docs/guides/cli/getting-started)
5. **Xcode** -- iOS development only
6. **Android Studio** -- Android development only

---

## Setup Guide

### Step 1: Install dependencies

```bash
git clone <repo-url> && cd tracks
nvm use          # Switch to Node 24
corepack enable  # Activate pnpm
pnpm install
```

### Step 2: Start Supabase

```bash
supabase start
```

This prints output like:

```
         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
        anon key: eyJhbGci...  <-- you need this
service_role key: eyJhbGci...  <-- you need this
   JWT secret: super-secret... <-- you need this
```

**Save these values** — you'll paste them into `.env` files in the next step.

### Step 3: Start Redis

```bash
docker compose up -d
```

This starts a Redis container on port 6379 (for BullMQ job queues).

### Step 4: Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Now edit each file and fill in the values from `supabase start` output:

**`apps/api/.env`**

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key from supabase start>
SUPABASE_JWT_SECRET=<paste JWT secret from supabase start>
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
SENTRY_DSN=                    # Optional: leave empty for local dev
RESEND_API_KEY=                # Optional: leave empty, emails log to console
```

| Variable | Where to get it | Required locally? |
|----------|----------------|-------------------|
| `SUPABASE_URL` | `supabase start` output | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase start` output | Yes |
| `SUPABASE_JWT_SECRET` | `supabase start` output | Yes |
| `PORT` | Default `3000` | No (has default) |
| `NODE_ENV` | Default `development` | No (has default) |
| `FRONTEND_URL` | Default `http://localhost:5173` | No (has default) |
| `REDIS_URL` | Default `redis://localhost:6379` | No (has default) |
| `SENTRY_DSN` | [sentry.io](https://sentry.io) dashboard | No (optional) |
| `RESEND_API_KEY` | [resend.com](https://resend.com) dashboard | No (emails log to console) |

**`apps/web/.env`**

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_API_BASE_URL_NATIVE=http://192.168.1.x:3000
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<paste anon key from supabase start>
VITE_SENTRY_DSN=               # Optional: leave empty for local dev
```

| Variable | Where to get it | Required locally? |
|----------|----------------|-------------------|
| `VITE_API_BASE_URL` | Default `http://localhost:3000` | No (has default) |
| `VITE_API_BASE_URL_NATIVE` | Your machine's LAN IP (for Capacitor) | Only for mobile dev |
| `VITE_SUPABASE_URL` | `supabase start` output | Yes |
| `VITE_SUPABASE_ANON_KEY` | `supabase start` output | Yes |
| `VITE_SENTRY_DSN` | [sentry.io](https://sentry.io) dashboard | No (optional) |

### Step 5: Start all services

```bash
pnpm dev
```

### Step 6: Verify everything works

| Service | URL | What to expect |
|---------|-----|----------------|
| Web app | http://localhost:5173 | Login page |
| API health | http://localhost:3000/health | `{"success": true}` |
| Supabase Studio | http://localhost:54323 | Database admin UI |
| Inbucket (email) | http://localhost:54324 | Local email capture |

---

## Development

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services (Turborepo) |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | ESLint (flat config) |
| `pnpm test` | Vitest (all workspaces) |
| `pnpm cap:sync` | Capacitor sync native projects |
| `pnpm cap:add:ios` | Add iOS platform |
| `pnpm cap:add:android` | Add Android platform |

### Running Individual Workspaces

```bash
pnpm --filter @tracks/api dev
pnpm --filter @tracks/web dev
pnpm --filter @tracks/types watch
```

### Database

```bash
supabase start              # Start local Supabase
supabase stop               # Stop local Supabase
supabase db reset           # Reset DB and re-run migrations + seed
supabase migration new name # Create a new migration
```

- Supabase Studio: http://localhost:54323
- Inbucket (email capture): http://localhost:54324

### Mobile Development

- Run `pnpm cap:sync` after building the web app
- Open in Xcode (`ios/`) or Android Studio (`android/`) from `apps/web/`
- Set `VITE_API_BASE_URL_NATIVE` to your LAN IP (e.g., `http://192.168.1.x:3000`)
- Capacitor plugins are installed in `apps/web` only -- never at root

## Project Structure

### API (`apps/api/src/`)

```
src/
├── app.ts                  App factory (plugin registration order)
├── server.ts               Entry point
├── plugins/                Route handlers (thin, delegate to services)
│   ├── health.ts
│   ├── auth.ts
│   ├── auth-callback.ts
│   ├── users.ts
│   └── uploads.ts
├── services/               Business logic + Supabase queries
│   ├── users.service.ts
│   ├── upload.service.ts
│   └── email.service.ts
├── hooks/                  Fastify preHandlers
│   └── authenticate.ts     JWT verification
├── jobs/                   BullMQ job definitions
│   ├── queues.ts
│   └── send-welcome-email.job.ts
├── workers/                BullMQ workers
│   └── email.worker.ts
├── emails/                 Email templates
│   └── welcome.email.ts
└── lib/                    Shared utilities
    ├── supabase.ts
    ├── sentry.ts
    ├── zod-provider.ts
    └── escape-html.ts
```

**Three-File Rule**: every feature requires a plugin (`plugins/`), a service (`services/`), and a schema (`packages/types/`).

**Registration order** (in `app.ts`): Sentry, Zod provider, CORS, rate limit, multipart, auth plugin, health, feature plugins.

#### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/users/me` | Yes | Current user profile |
| POST | `/uploads` | Yes | Upload file (multipart) |
| GET | `/uploads/:path` | Yes | Download file (signed URL redirect) |
| POST | `/auth/callback` | Yes | Post-auth callback (welcome email) |

### Web (`apps/web/src/`)

```
src/
├── App.tsx
├── main.tsx                Entry point (Sentry init, providers)
├── router.tsx              Hash router configuration
├── components/
│   ├── ui/                 shadcn/ui primitives
│   ├── layout/             AppShell, Header, Sidebar
│   └── ErrorBoundary.tsx
├── pages/
│   └── LoginPage.tsx
├── hooks/                  Custom hooks
│   ├── useAuth.ts
│   ├── useCamera.ts
│   ├── useFilesystem.ts
│   ├── useHaptics.ts
│   └── usePushNotifications.ts
├── store/                  Zustand stores
│   └── auth.store.ts
└── lib/
    ├── api.ts              API client (all data requests)
    ├── supabase.ts         Supabase client (auth only)
    ├── queryClient.ts      TanStack Query config
    └── utils.ts            cn() and utilities
```

### Types (`packages/types/src/`)

```
src/
├── index.ts                Barrel exports
├── api-response.ts         ApiSuccessSchema, ApiErrorSchema
├── common.ts               Shared primitives
├── user.schema.ts
├── upload.schema.ts
├── jobs.schema.ts
└── __tests__/              Schema validation tests
```

Schemas use verbose names (`UserProfile`, not `UserData`). Types are always derived with `z.infer<typeof Schema>` -- never manual interfaces.

## Verification & Testing

Every change — especially UI and feature work — must be manually verified before it's considered done. If you're using Claude Code, it will use Claude for Chrome to perform this loop automatically.

### Verification Loop

After any code change, this loop runs before committing:

1. **Desktop** — Open the app in Chrome and visually confirm the change works as expected
2. **Mobile** — Resize to 375px width (or toggle Chrome DevTools device toolbar to iPhone SE / iPhone 14) and confirm layout, touch targets, and interactions work correctly. No horizontal scroll, no clipped content, no unreachable controls.
3. **Multi-user** — Open a second browser tab or profile with a different user. Verify state isolation, concurrent interactions, and real-time updates behave correctly.
4. **Edge cases** — Test empty states, error states, boundary inputs, rapid repeated actions, and network failures where relevant.
5. **Fix & repeat** — If anything fails, fix it and re-run the loop from step 1.

> [!IMPORTANT]
> **Mobile is first-class.** This app ships to phones via Capacitor. If it doesn't feel native at 375px, it's not done. Every layout, modal, form, and interaction must be designed mobile-first and scaled up to desktop.

### Unit Tests

- **Framework**: Vitest
- **Run**: `pnpm test`
- **Web**: `@testing-library/react` + jsdom
- **Types**: schema parse/reject validation tests
- **API**: route handler tests with Fastify `inject()`

### End-to-End Tests

- **Framework**: Playwright
- **Run**: `pnpm exec playwright test`
- **Location**: `e2e/`
- **Config**: `playwright.config.ts` auto-starts API and web dev servers

## Deployment

### Environments

| Environment | Frontend | API | Database | Trigger |
|-------------|----------|-----|----------|---------|
| Local | localhost:5173 | localhost:3000 | Supabase local | `pnpm dev` |
| Staging | GitHub Pages (preview) | Railway | Supabase staging | Push to `main` |
| Production | GitHub Pages | Railway | Supabase production | Tag `v*` |

### CI/CD Pipeline

| Workflow | Trigger | Steps |
|----------|---------|-------|
| [ci.yml](.github/workflows/ci.yml) | PR to `main` | build, typecheck, lint, test, playwright |
| [deploy-staging.yml](.github/workflows/deploy-staging.yml) | Push to `main` | validate, build, deploy, migrate |
| [deploy-production.yml](.github/workflows/deploy-production.yml) | Tag `v*` | validate, build, deploy, migrate |

### Required Secrets (for CI/CD)

| Secret | Purpose | Where to get it |
|--------|---------|----------------|
| `RAILWAY_TOKEN` | Railway CLI deploy token | [railway.app](https://railway.app) → Project → Settings → Tokens |
| `RAILWAY_SERVICE_ID` | Railway service to deploy to | [railway.app](https://railway.app) → Project → Service → Settings |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth for migrations | [supabase.com/dashboard](https://supabase.com/dashboard) → Settings → Access Tokens |
| `SUPABASE_DB_PASSWORD` | Supabase DB password for migrations | [supabase.com/dashboard](https://supabase.com/dashboard) → Settings → Database |
| `SENTRY_AUTH_TOKEN` | Source map upload | [sentry.io](https://sentry.io) → Settings → Auth Tokens |
| `SENTRY_ORG` | Sentry organization slug | [sentry.io](https://sentry.io) → Settings → Organization |
| `SENTRY_PROJECT_WEB` | Sentry project for web app | [sentry.io](https://sentry.io) → Projects |

> **Important**: Disable Railway's auto-deploy from branch pushes in your Railway project settings. All deploys are triggered explicitly by GitHub Actions using `railway up`.

## Adding a New Feature

1. Define Zod schema in `packages/types/src/<feature>.schema.ts`
2. Export schema and inferred type from `packages/types/src/index.ts`
3. Add schema validation tests in `packages/types/src/__tests__/`
4. Create service in `apps/api/src/services/<feature>.service.ts`
5. Create plugin in `apps/api/src/plugins/<feature>.ts`
6. Register plugin in `apps/api/src/app.ts`
7. Add API route tests in `apps/api/src/__tests__/`
8. Build frontend feature in `apps/web/src/`

## Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| [001](docs/decisions/001-monorepo-structure.md) | Monorepo Structure | Accepted |
| [002](docs/decisions/002-proxy-boundary.md) | Proxy Boundary | Accepted |
| [003](docs/decisions/003-hash-routing.md) | Hash Routing | Accepted |
| [004](docs/decisions/004-deployment-targets.md) | Deployment Targets | Accepted |

## Documentation

| Document | Description |
|----------|-------------|
| [apps/api/CLAUDE.md](apps/api/CLAUDE.md) | API plugin pattern, service pattern, hooks, route guide |
| [apps/web/CLAUDE.md](apps/web/CLAUDE.md) | Feature folders, api.ts usage, component patterns |
| [packages/types/CLAUDE.md](packages/types/CLAUDE.md) | Schema naming, test requirements |
| [ADR-001](docs/decisions/001-monorepo-structure.md) | Why pnpm + Turborepo |
| [ADR-002](docs/decisions/002-proxy-boundary.md) | Why frontend never touches Supabase directly |
| [ADR-003](docs/decisions/003-hash-routing.md) | Why createHashRouter for Capacitor |
| [ADR-004](docs/decisions/004-deployment-targets.md) | Why GitHub Pages + Railway |

## Troubleshooting

<details>
<summary><code>supabase start</code> fails</summary>

Ensure Docker is running. Supabase local development requires Docker containers for Postgres, Auth, Storage, and other services.

```bash
docker info  # Verify Docker is running
supabase start
```
</details>

<details>
<summary>Types not updating after schema changes</summary>

Rebuild the types package so downstream workspaces pick up changes:

```bash
pnpm --filter @tracks/types build
```

Or use watch mode during development:

```bash
pnpm --filter @tracks/types watch
```
</details>

<details>
<summary>Capacitor app cannot reach API</summary>

Native apps cannot use `localhost`. Set `VITE_API_BASE_URL_NATIVE` to your machine's LAN IP:

```bash
# apps/web/.env
VITE_API_BASE_URL_NATIVE=http://192.168.1.x:3000
```

Rebuild and sync:

```bash
pnpm --filter @tracks/web build && pnpm cap:sync
```
</details>

<details>
<summary>pnpm phantom dependency errors</summary>

This monorepo uses strict hoisting. If a package needs a dependency, add it explicitly:

```bash
pnpm --filter @tracks/web add <package>
```
</details>

<details>
<summary>ESLint error: Supabase import outside allowed file</summary>

This is intentional. The ESLint rule enforces the proxy boundary -- `@supabase/supabase-js` can only be imported in `src/lib/supabase.ts`. Move your Supabase usage to a service (API) or use `api.ts` (web).
</details>

## License

MIT
