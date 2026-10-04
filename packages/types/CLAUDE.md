# @tracks/types

Shared Zod schemas and derived TypeScript types.

## Rules

- **Verbose names**: `UserProfile`, not `UserData`
- **Always `z.infer<typeof Schema>`** — never manual interfaces for shared data
- **Zod enums** (`z.enum()`) — never TypeScript `enum`
- **Every schema gets a test** — parse valid data, reject invalid data
- **Barrel exports** — all schemas re-exported from `src/index.ts`

## Commands

```bash
pnpm --filter @tracks/types build      # Compile to dist/
pnpm --filter @tracks/types typecheck   # Check types without emitting
pnpm --filter @tracks/types watch       # Watch mode for development
```

## Adding a New Schema

1. Create `src/<domain>.schema.ts`
2. Define Zod schema, derive type with `z.infer<>`
3. Export both schema and type from `src/index.ts`
4. Add tests in `src/__tests__/<domain>.schema.test.ts`
