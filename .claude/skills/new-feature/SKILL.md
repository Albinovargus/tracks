---
name: new-feature
description: Scaffolds a new feature following the three-file pattern (schema + plugin + service + frontend feature folder)
disable-model-invocation: true
argument-hint: <feature-name>
---

# /new-feature

Creates a new feature following the three-file pattern.

## Usage
```
/new-feature <feature-name>
```

## What It Creates

1. `packages/types/src/<name>.schema.ts` — Zod schemas
2. `apps/api/src/plugins/<name>.ts` — Fastify plugin with CRUD routes
3. `apps/api/src/services/<name>.service.ts` — Business logic + Supabase queries
4. `apps/web/src/features/<name>/` — Feature folder:
   - `components/` directory
   - `hooks/` directory
   - `index.ts` barrel export
5. `apps/api/src/__tests__/<name>.test.ts` — API inject() tests
6. `packages/types/src/__tests__/<name>.schema.test.ts` — Schema tests

## Steps

1. Create Zod schemas in `packages/types/src/<name>.schema.ts`
2. Add re-exports to `packages/types/src/index.ts`
3. Build types: `pnpm --filter @tracks/types build`
4. Create service in `apps/api/src/services/<name>.service.ts`
5. Create plugin in `apps/api/src/plugins/<name>.ts` with `fastify.authenticate` preHandler + Zod validation
6. Register plugin in `apps/api/src/app.ts` (import + `await app.register()`)
7. Create feature folder in `apps/web/src/features/<name>/`
8. Create test files
9. Run `pnpm typecheck` to verify
