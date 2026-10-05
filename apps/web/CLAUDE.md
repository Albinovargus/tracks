# @tracks/web — React 19 SPA

## Feature Folder Structure

```
src/features/<name>/
  components/    → Feature-specific components
  hooks/         → Feature-specific hooks
  index.ts       → Public API (barrel export)
```

Small features may keep flat modules directly in `src/features/<name>/`, with tests in `__tests__/`. The `components/`, `hooks/` and `index.ts` barrel layout is for larger features.

## Key Rules

- **Mobile-first**: Design for 375px first, then scale up. Every layout, modal, form, and interaction must feel native on a phone. No horizontal scroll, no clipped text, no unreachable controls.
- **api.ts**: Always `api.get()` / `api.post()` — never raw `fetch()`
- **dvh**: `h-[100dvh]` always, `h-screen` never — iOS Safari breaks with vh
- **Touch targets**: `min-h-11` (44px) on all tappable elements. Generous padding on interactive elements — thumbs are imprecise.
- **Safe areas**: Use `env(safe-area-inset-*)` or Capacitor safe area utilities for notched devices. Content must not hide behind system UI.
- **Supabase**: Only import from `src/lib/supabase.ts` — auth UI flows only, zero data queries
- **Capacitor hooks**: Always use custom hooks, never import plugins directly in components
- **Tailwind v4**: All customization in `src/index.css` under `@theme` — no tailwind.config.js
- **Components**: shadcn/ui primitives in `src/components/ui/`

## Commands

```bash
pnpm --filter @tracks/web dev        # Start Vite dev server
pnpm --filter @tracks/web build      # Type check + Vite build
pnpm --filter @tracks/web typecheck  # Type check without build
pnpm --filter @tracks/web lint       # ESLint
```

## Patterns

- **Zustand v5 + TypeScript**: Always use double-call pattern `create<Type>()(...)` for proper type inference with middleware
- **Auth tokens**: `getSession()` for forwarding JWT to API (validated server-side); `getUser()` for trusted user data on the frontend
- **Zustand middleware**: No immer for flat stores (e.g. auth state); reserve immer for deeply nested state only

## Forbidden

- **Never** import `@supabase/supabase-js` outside `src/lib/supabase.ts`
- **Never** make data queries via Supabase client — auth UI flows only
- **Never** use `h-screen` or `100vh` — always `h-[100dvh]`
- **Never** create `tailwind.config.js` — Tailwind v4 uses `@theme` in CSS
- **Never** use raw `fetch()` — always `api.get()` / `api.post()`
