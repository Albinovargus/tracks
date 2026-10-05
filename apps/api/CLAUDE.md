# @tracks/api — Fastify v5 API

## Plugin Pattern (Three-File Rule)

Every feature requires exactly three files:
1. `src/plugins/<feature>.ts` — Route handlers (thin, delegates to service)
2. `src/services/<feature>.service.ts` — Business logic + Supabase queries
3. `packages/types/<feature>.schema.ts` — Zod schemas

### Plugin Example
```typescript
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ApiSuccessSchema, SomeSchema } from '@tracks/types';
import * as someService from '../services/some.service.js';

const somePlugin: FastifyPluginAsyncZod = async function (fastify) {
  fastify.get('/some', {
    preHandler: [fastify.authenticate],
    schema: { response: { 200: ApiSuccessSchema(SomeSchema) } },
  }, async (request) => {
    const data = await someService.getById(request.user.id);
    return { success: true as const, data };
  });
};
export default somePlugin;
```

### Service Example
```typescript
import { supabase } from '../lib/supabase.js';

// The row must exist: .single() errors when it does not.
export async function getById(id: string) {
  const { data, error } = await supabase.from('table').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// The row may not exist: .maybeSingle() resolves null instead of erroring.
export async function findByUserId(userId: string) {
  const { data, error } = await supabase.from('table').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data; // null → the plugin replies 404 (declare 404: ApiErrorSchema in schema.response)
}
```

Use `.single()` only when a missing row is a bug. With no row it errors with
PGRST116, which the global error handler turns into a 500. For optional rows
(for example `getByUserId` in `services/avatar.service.ts`), use `.maybeSingle()`
and map `null` to a 404 in the plugin.

## Hooks

- `fastify.authenticate` — preHandler, verifies JWT via jose. Apply to any protected route.

## Registration Order (app.ts)

1. Sentry → 2. Zod provider → 3. CORS → 4. Rate limit → 5. Multipart → 6. Error handler → 7. Auth plugin → 8. Health → 9. Feature plugins

- The error handler goes before every route. A route keeps the handler that was active when it was registered. A route added before `setErrorHandler` gets Fastify's default body, with no `success` field, and a declared `400: ApiErrorSchema` then becomes a 500 (`FST_ERR_FAILED_ERROR_SERIALIZATION`).
- CORS lists its methods explicitly (`GET, HEAD, POST, PUT`). Add a method there before any route uses it, or the browser's preflight fails.
- `src/__tests__/app-contract.test.ts` guards both rules.

## Forbidden

- **Never** instantiate Supabase client outside `src/lib/supabase.ts`
- **Never** put business logic in route handlers — always delegate to services
- **Never** use `any` type — use `unknown` and narrow
- **Never** call Resend or email SDK directly in handlers — enqueue a BullMQ job
- **Never** use `setTimeout` for background work — use BullMQ

## Commands

```bash
pnpm --filter @tracks/api dev        # Start dev server (tsx watch)
pnpm --filter @tracks/api build      # Compile TypeScript
pnpm --filter @tracks/api typecheck  # Type check without emit
pnpm --filter @tracks/api lint       # ESLint
```

## Environment Variables

`SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_JWT_SECRET` · `PORT` · `NODE_ENV` · `FRONTEND_URL` · `REDIS_URL` · `SENTRY_DSN` · `RESEND_API_KEY`

The service role key **never** leaves this service. Never logged. Never in frontend.
