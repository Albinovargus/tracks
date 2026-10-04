# Starter Monorepo

## Stack
Fastify v5 · React 19 + Vite + Capacitor 8 · Supabase · pnpm + Turborepo

## Architecture
```
apps/api        → Fastify v5 API (service role key, all data access)
apps/web        → React 19 SPA (anon key, auth UI only)
packages/types  → Zod schemas, shared types
packages/config → TSConfig, ESLint, Prettier base configs
supabase/       → Migrations, seed data
```

## Commands
```bash
pnpm dev              # Start all services (Turborepo)
pnpm build            # Build all packages and apps
pnpm typecheck        # TypeScript strict check
pnpm lint             # ESLint (flat config)
pnpm test             # Vitest (all workspaces)
pnpm cap:sync         # Capacitor sync native projects
pnpm cap:add:ios      # Add iOS platform
pnpm cap:add:android  # Add Android platform
```

## Mandatory Rules (30)

### Architecture
1. **Hash routing** — createHashRouter only, never createBrowserRouter (Capacitor filesystem)
2. **Proxy boundary** — Frontend never imports @supabase/supabase-js except src/lib/supabase.ts. ESLint enforces.
3. **API calls** — Always src/lib/api.ts, never raw fetch()
4. **Three-file rule** — New feature = src/plugins/<n>.ts + src/services/<n>.service.ts + packages/types/<n>.schema.ts
5. **File uploads** — All through Fastify proxy → Supabase Storage. Never direct from frontend.

### Capacitor & Mobile-First
6. **Plugin installs** — All @capacitor/* in apps/web only: `pnpm --filter @tracks/web add`
7. **cap CLI** — Never from root. Use workspace scripts: cap:sync, cap:add:ios, cap:add:android
8. **webDir parity** — vite.config.ts build.outDir and capacitor.config.ts webDir must both be "dist"
9. **Native URL** — Capacitor.isNativePlatform() in api.ts for URL switching. Never hardcode localhost.
10. **Mobile-first UI** — Every UI change must work on 375px viewport first, then scale up. Test with Chrome DevTools device toolbar (iPhone SE, iPhone 14, Pixel 7). No horizontal scroll, no text overflow, no unreachable controls.

### Frontend
11. **h-[100dvh]** — Always. Never h-screen or 100vh (iOS Safari).
12. **Touch targets** — min-h-11 (44px) on all tappable elements.
13. **Tailwind v4** — All config in src/index.css @theme. No tailwind.config.js.
14. **React Router mode** — Data mode only (createHashRouter). Never framework mode.

### Types & Code Quality
15. **Zod-first** — z.infer<typeof Schema>, never manual interfaces for shared data.
16. **No TypeScript enums** — Use z.enum(). Serializes correctly + runtime validation.
17. **No any** — Use unknown + narrow. Any `any` requires a comment explaining why.
18. **Node 22 LTS** — Pin in .nvmrc and engines.

### Backend
19. **Background jobs** — BullMQ only. Jobs in apps/api/src/jobs/. Never setTimeout or inline async.
20. **Transactional email** — Never call Resend directly in handlers. Always BullMQ job. Templates in apps/api/src/emails/.
21. **Error monitoring** — Sentry in api/app.ts and web/main.tsx. ErrorBoundary must call Sentry.captureException().

### Verification
22. **Browser verification** — After every UI or feature change, use Claude for Chrome to verify the change visually. Never claim done without visual confirmation.
23. **Mobile verification** — Resize to 375px width (or use device toolbar) and verify every change renders correctly on mobile before moving on.
24. **Multi-user & edge cases** — Test with multiple browser tabs/profiles to verify multi-user state (auth, real-time, concurrent edits). Test empty states, error states, and boundary inputs.
25. **Verification loop** — Code → verify desktop → verify mobile → verify edge cases → fix → repeat. This loop is not optional.
26. **Zero tolerance** — Every bug, error, warning, console message, visual glitch, failing test, lint error, or type error observed at any point is in scope and must be fixed. Never dismiss anything as "pre-existing" or "out of scope." If it's broken, fix it. The task is not done until everything is clean: browser, console, tests, types, lint — all of it.

### Tooling
27. **ESLint 9+** — Flat config (eslint.config.js). Never .eslintrc.json.
28. **CLAUDE.md size** — Root under 200 lines. Detail in referenced docs.
29. **Session workflow** — For >2 files: explore → plan → code → verify → commit.
30. **Context discipline** — /clear between tasks. /compact at ~50%.

## Session Workflow
1. **Explore** — Read relevant code, understand context. No code changes.
2. **Plan** — Write plan.md for tasks touching >2 files. Get approval.
3. **Code** — Implement following plan.
4. **Verify** — Use Claude for Chrome: check desktop, resize to mobile (375px), test multi-user and edge cases. Fix anything broken before proceeding.
5. **Commit** — Atomic commits with descriptive messages.

## Context Management
- `/clear` between distinct tasks
- Manual `/compact` at ~50% context capacity
- Delegate file-heavy tasks (15+ files) to subagents
- Fresh session for code review
- Git worktrees for parallel work

## Package Details
See per-package CLAUDE.md files:
- `apps/api/CLAUDE.md` — Plugin pattern, service pattern, hooks, route guide
- `apps/web/CLAUDE.md` — Feature folders, api.ts usage, component patterns
- `packages/types/CLAUDE.md` — Schema naming, test requirements

## Architecture Decisions
See `docs/decisions/` for rationale:
- `001-monorepo-structure.md` — Why pnpm + Turborepo
- `002-proxy-boundary.md` — Why frontend never touches Supabase directly
- `003-hash-routing.md` — Why createHashRouter for Capacitor
- `004-deployment-targets.md` — Why GitHub Pages + Railway (via Actions), graduation paths

## Scope: @tracks
