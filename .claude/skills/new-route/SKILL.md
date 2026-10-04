---
name: new-route
description: Adds a new route to an existing Fastify plugin with schema, service method, and tests
disable-model-invocation: true
argument-hint: <METHOD> <path>
---

# /new-route

Adds a new route to an existing Fastify plugin.

## Usage
```
/new-route <METHOD> <path>
```

Example: `/new-route POST /users/me/avatar`

## Steps

1. **Identify plugin** — Determine which plugin file in `apps/api/src/plugins/` owns this route path
2. **Define schema** — Add or reuse Zod schemas in `packages/types/` for request body/params/query and response
3. **Re-export** — Ensure new schemas are exported from `packages/types/src/index.ts`
4. **Build types** — `pnpm --filter @tracks/types build`
5. **Add service method** — Implement business logic in the matching `apps/api/src/services/<name>.service.ts`
6. **Add route** — Add route handler in the plugin file:
   ```typescript
   fastify.<method>('<path>', {
     preHandler: [fastify.authenticate],
     schema: {
       body: RequestBodySchema,     // if POST/PATCH
       params: ParamsSchema,        // if path params
       querystring: QuerySchema,    // if query params
       response: { 200: ApiSuccessSchema(ResponseSchema) },
     },
   }, async (request) => {
     const result = await someService.method(request.user.id, request.body);
     return { success: true as const, data: result };
   });
   ```
7. **Add test** — Add test case in `apps/api/src/__tests__/<plugin>.test.ts`
8. **Verify** — `pnpm typecheck && pnpm --filter @tracks/api test`
