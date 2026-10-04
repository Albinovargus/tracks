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

export async function getById(id: string) {
  const { data, error } = await supabase.from('table').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
```

## Hooks

- `fastify.authenticate` — preHandler, verifies JWT via jose. Apply to any protected route.

## Registration Order (app.ts)

1. Sentry → 2. Zod provider → 3. CORS → 4. Rate limit → 5. Multipart → 6. Auth plugin → 7. Health → 8. Feature plugins

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
