---
name: sync-types
description: Verifies API response shapes match shared Zod schemas and checks for stale re-exports
disable-model-invocation: true
---

# /sync-types

Verifies API response shapes match shared Zod schemas.

## Usage
```
/sync-types
```

## What It Checks

1. **Untyped API calls** — Any `api.get<T>()` or `api.post<T>()` in `apps/web/` where `T` is not a type from `@tracks/types`
2. **Missing schemas** — API route response schemas that don't reference `@tracks/types` schemas
3. **Stale re-exports** — Schemas defined in `packages/types/src/` but not re-exported from `index.ts`
4. **Build sync** — Runs `pnpm --filter @tracks/types build` and checks for errors

## Steps

1. Scan `apps/web/src/` for all `api.get`, `api.post`, `api.patch`, `api.delete` calls
2. Verify each uses a type from `@tracks/types`
3. Scan `apps/api/src/plugins/` for all route schemas
4. Verify each response schema references `ApiSuccessSchema` with a `@tracks/types` schema
5. Verify `packages/types/src/index.ts` re-exports all schemas from sub-modules
6. Report any mismatches
