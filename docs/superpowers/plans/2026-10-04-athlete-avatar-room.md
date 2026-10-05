# Athlete Avatar & Room v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player creates a pixel-art athlete (skin tone, hair style and color, starter clothing), saves it through the API, and watches it idle and run on a treadmill in a side-view trophy room that is the app's main screen.

**Architecture:**
- **Data:** shared Zod catalog in `@tracks/types`, and an `avatars` table reached only by the Fastify API's service-role client (GET/PUT `/avatar`).
- **Rendering:** the web app composites layered, palette-swapped Aseprite sprite sheets on a single Canvas 2D per scene, at integer device-pixel scale. A pure behavior state machine drives idle → turn → run → turn.
- **Art:** authored with the Aseprite MCP, committed as `.aseprite` sources. `pnpm art:export` exports them to PNG + JSON, and a node-env art check validates the exports.

**Tech Stack:**
- **Web:** React 19, Vite 8, Tailwind v4, TanStack Query 5, Zustand 5, React Router 8 (hash).
- **API:** Fastify 5, fastify-type-provider-zod 7, Zod 4.
- **Data:** Supabase (Postgres, pgTAP).
- **Tooling:** Vitest 5, Playwright 1.63, Aseprite 1.3.18 + diivi/aseprite-mcp, pngjs.

**Spec:** `docs/superpowers/specs/2026-10-04-athlete-avatar-room-design.md` (read it with this plan).

## Global Constraints

### Branch and commits

- Work on branch `feat/avatar-room`.
- Every commit message ends with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3`.

### Rules

- Obey `.claude/CLAUDE.md` and the package `CLAUDE.md` files. Rule 26 (zero tolerance): no console errors, warnings, lint or type errors left anywhere.

### TypeScript and imports

- TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Imports use `.js` extensions.
- Vitest globals are off: import `describe`, `it`, `expect` and `vi`, and RTL tests need `afterEach(cleanup)`.

### Data and API

- `@tracks/types` is consumed from `dist`: run `pnpm --filter @tracks/types build` after changing it.
- The web app never imports `@supabase/supabase-js` outside `src/lib/supabase.ts`, and never uses raw `fetch`. Use `api.get` / `api.put`.

### Mobile and layout

- Mobile-first at 375 px.
- Touch targets `min-h-11` / `size-11`.
- `h-[100dvh]` only in AppShell; pages never add it or safe-area padding.

### Catalog and art

- Catalog IDs are append-only (spec §2).
- Avatar cell 64×64, anchor (32, 63), tags `front-idle`, `turn` (1 frame, ¾) and `side-run`. Treadmill tag `belt`.
- Placeholder ramps, exact RGB:
  - skin `#FF80FF #FF40FF #FF00FF`
  - hair `#80FFFF #40FFFF #00FFFF`
  - cloth `#FFFF80 #FFFF40 #FFFF00`
- Art sources stay RGB, 100% opacity, alpha 0 or 255, palette colors only.
- MCP tool calls use absolute forward-slash paths. Previews go only to `.superpowers/art-previews/`.

### Session restart

Task 13 ends with a **session restart**, needed for the Aseprite MCP to load. Do not start Task 14 in the same session.

## Review Focus

The five real-world conditions most likely to bite a player that the spec implies but the original task tests did not exercise. Each now has a test in its owning task:

1. **A sprite sheet fails to load** (flaky network on the Pages site): the room shows its error message, not a blank canvas forever, and never reports ready. Task 11 (RoomScene error test).
2. **Rotating the phone, resizing the window, or moving to a monitor with a different DPR:** the canvas re-sizes to the new integer scale and stays crisp (backing store, CSS size, smoothing off, transform reset). Task 8 (usePixelCanvas test).
3. **Leaving the tab in the background for minutes:** on return the avatar resumes its cycle instead of skipping states (dt clamped to 250 ms). Task 11 (`clampDt` test).
4. **A keyboard-only player in the creator:** each option group is one native radio group (shared `name`, fieldset legend as its name), so arrow keys and focus rings work. Task 10.
5. **Double-tapping Save, or saving after a failure:** exactly one PUT goes out per tap while one is pending, and after a failed save the button works again for a retry. Task 10.

---

### Task 1: API contract fixes: error handler order + CORS PUT

**Files:**
- Create: `apps/api/src/__tests__/app-contract.test.ts`
- Modify: `apps/api/src/app.ts` (lines 26-32 CORS registration gains `methods`; lines 58-71 `app.setErrorHandler(...)` moves above the auth plugin registration at line 47; step comments renumbered 6-10)
- Modify: `apps/api/CLAUDE.md` (lines 43-45, section "Registration Order (app.ts)")

**Interfaces:**
- Consumes: `build(opts: { logger?: boolean }): Promise<FastifyInstance>` from `apps/api/src/app.ts`; `createTestToken(overrides?: Record<string, unknown>): Promise<string>` from `apps/api/src/__tests__/helpers.ts`; `ApiErrorSchema` from `@tracks/types` (existing, `{ success: false, error: { code: string, message: string } }`); `getById(id: string)` from `apps/api/src/services/users.service.ts` (mocked); existing routes `GET /users/me` and `POST /uploads` (declares `400: ApiErrorSchema`).
- Produces: no new exports. Behavior contract that later tasks rely on: (1) the global error handler is set before the auth, health and feature plugins, so every route registered in `build()` (including `avatarPlugin` added later after `authCallbackPlugin`) returns `{ success: false, error: { code, message } }` for thrown and validation errors; (2) `@fastify/cors` is registered with `methods: ['GET', 'HEAD', 'POST', 'PUT']`, so the browser preflight for `PUT /avatar` succeeds.

- [ ] **Step 1: Make sure you are on the feature branch**

Run from the repo root:

```bash
git switch feat/avatar-room 2>/dev/null || git switch -c feat/avatar-room
git branch --show-current
```

Expected output of the last command: `feat/avatar-room`

Then check whether the plan file itself is committed:

```bash
git status --porcelain docs/superpowers/plans
```

If this prints `?? docs/superpowers/plans/2026-10-04-athlete-avatar-room.md`, commit it on this branch so every later `git status` check starts clean:

```bash
git add docs/superpowers/plans/2026-10-04-athlete-avatar-room.md
git commit -F - <<'EOF'
Add the athlete avatar & room implementation plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
git status --porcelain
```

Expected: the last command prints nothing. From here on, do not edit the plan file. Track step progress in your todo list, not by ticking the `- [ ]` boxes in the file. Otherwise ` M docs/superpowers/plans/2026-10-04-athlete-avatar-room.md` appears and breaks the exact `git status` checks in Tasks 8, 12, 15, 16, 17, 19 and 20. (The plan-file exceptions in Task 13 Steps 11 and 19 then never trigger.)

- [ ] **Step 2: Write the failing contract tests**

Create `apps/api/src/__tests__/app-contract.test.ts`:

```typescript
import { vi, describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ApiErrorSchema } from '@tracks/types';

vi.mock('../workers/email.worker.js', () => ({
  startEmailWorkers: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/users.service.js', () => ({
  getById: vi.fn().mockRejectedValue(
    Object.assign(new Error('Profile was changed by another request'), {
      statusCode: 409,
      code: 'CUSTOM',
    }),
  ),
}));

import { build } from '../app.js';
import { createTestToken } from './helpers.js';

describe('app contract', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the PUT preflight from the web dev origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/avatar',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'authorization,content-type',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const allowMethods = String(response.headers['access-control-allow-methods'] ?? '')
      .split(',')
      .map((method) => method.trim());
    expect(allowMethods).toContain('PUT');
  });

  it('formats an error thrown inside a feature route as ApiError', async () => {
    const token = await createTestToken();
    const response = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);
    const body: unknown = response.json();
    expect(body).toEqual({
      success: false,
      error: { code: 'CUSTOM', message: 'Profile was changed by another request' },
    });
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  });

  it('formats a validation error on a route that declares 400: ApiErrorSchema', async () => {
    // Querystring validation runs before the authenticate preHandler, so no token is needed.
    const response = await app.inject({
      method: 'POST',
      url: '/uploads?bucket=not-a-bucket',
    });

    expect(response.statusCode).toBe(400);
    const body: unknown = response.json();
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ success: false, error: { code: 'FST_ERR_VALIDATION' } });
  });
});
```

`OPTIONS /avatar` works before the avatar route exists because `@fastify/cors` registers a wildcard `OPTIONS *` preflight route.

- [ ] **Step 3: Run the tests and confirm they fail for the right reasons**

```bash
pnpm --filter @tracks/types build
pnpm --filter @tracks/api exec vitest run src/__tests__/app-contract.test.ts
```

Expected: `Tests  3 failed (3)`, with these failures:
- `answers the PUT preflight from the web dev origin`: `AssertionError: expected [ 'GET', 'HEAD', 'POST' ] to include 'PUT'` (the @fastify/cors 11 default methods)
- `formats an error thrown inside a feature route as ApiError`: `AssertionError: expected { statusCode: 409, …(3) } to deeply equal { success: false, error: { …(2) } }`. The diff shows Fastify's default body `{ statusCode, code: "CUSTOM", error: "Conflict", message }`.
- `formats a validation error on a route that declares 400: ApiErrorSchema`: `AssertionError: expected 500 to be 400 // Object.is equality`. Fastify's default validation body fails the declared `400: ApiErrorSchema` serializer, which produces `FST_ERR_FAILED_ERROR_SERIALIZATION`.

- [ ] **Step 4: Move the error handler above the auth plugin and allow PUT in CORS**

Replace the whole of `apps/api/src/app.ts` with:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { Redis } from 'ioredis';
import * as Sentry from '@sentry/node';
import { initSentry } from './lib/sentry.js';
import { configureZodProvider } from './lib/zod-provider.js';
import authPlugin from './plugins/auth.js';
import healthPlugin from './plugins/health.js';
import usersPlugin from './plugins/users.js';
import uploadsPlugin from './plugins/uploads.js';
import authCallbackPlugin from './plugins/auth-callback.js';
import { startEmailWorkers } from './workers/email.worker.js';
import { closeAllQueues } from './jobs/queues.js';

export async function build(opts: { logger?: boolean } = {}) {
  // 1. Sentry init (before everything)
  initSentry();

  const app = Fastify({ logger: opts.logger ?? true });

  // 2. Zod type provider
  configureZodProvider(app);

  // 3. CORS — register before routes. List every method a route uses:
  //    @fastify/cors defaults to GET, HEAD and POST only.
  await app.register(cors, {
    origin: [
      'http://localhost:5173',
      process.env['FRONTEND_URL'],
    ].filter(Boolean) as string[],
    methods: ['GET', 'HEAD', 'POST', 'PUT'],
  });

  // 4. Rate limiting — 100 req/min per IP, Redis-backed in production
  const redisUrl = process.env['REDIS_URL'];
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    ...(redisUrl && { redis: new Redis(redisUrl) }),
  });

  // 5. Multipart — 10MB file size limit
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  // 6. Global error handler — matches ApiErrorSchema contract.
  //    Set before any route: a route keeps the handler that was active when it
  //    was registered, so routes added earlier fall back to Fastify's default.
  app.setErrorHandler((error: { statusCode?: number; code?: string; message: string }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      Sentry.captureException(error);
    }
    reply.code(statusCode).send({
      success: false,
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: error.message,
      },
    });
  });

  // 7. Auth plugin — decorates request.user, registers fastify.authenticate
  await app.register(authPlugin);

  // 8. Health check (no auth)
  await app.register(healthPlugin);

  // 9. Feature plugins
  await app.register(usersPlugin);
  await app.register(uploadsPlugin);
  await app.register(authCallbackPlugin);

  // 10. Start background job workers
  const workers = startEmailWorkers();
  app.addHook('onClose', async () => {
    await Promise.all(workers.map((w) => w.close()));
    await closeAllQueues();
  });

  return app;
}
```

- [ ] **Step 5: Run the contract tests and confirm they pass**

```bash
pnpm --filter @tracks/api exec vitest run src/__tests__/app-contract.test.ts --reporter=verbose
```

Expected:
```
 ✓ src/__tests__/app-contract.test.ts > app contract > answers the PUT preflight from the web dev origin
 ✓ src/__tests__/app-contract.test.ts > app contract > formats an error thrown inside a feature route as ApiError
 ✓ src/__tests__/app-contract.test.ts > app contract > formats a validation error on a route that declares 400: ApiErrorSchema
      Tests  3 passed (3)
```

- [ ] **Step 6: Run the full API suite, typecheck and lint**

```bash
pnpm --filter @tracks/api test
pnpm --filter @tracks/api typecheck
pnpm --filter @tracks/api lint
```

Expected: `Test Files  6 passed (6)` and `Tests  19 passed (19)`. The existing 401 bodies (`UNAUTHORIZED`) and the uploads `BAD_REQUEST` body are unchanged because those handlers call `reply.send` directly. Typecheck and lint should exit 0 with no output. Fix anything that is reported before continuing (rule 26).

- [ ] **Step 7: Update the Registration Order in apps/api/CLAUDE.md**

In `apps/api/CLAUDE.md`, replace lines 43-45:

```markdown
## Registration Order (app.ts)

1. Sentry → 2. Zod provider → 3. CORS → 4. Rate limit → 5. Multipart → 6. Auth plugin → 7. Health → 8. Feature plugins
```

with:

```markdown
## Registration Order (app.ts)

1. Sentry → 2. Zod provider → 3. CORS → 4. Rate limit → 5. Multipart → 6. Error handler → 7. Auth plugin → 8. Health → 9. Feature plugins

- The error handler goes before every route. A route keeps the handler that was active when it was registered. A route added before `setErrorHandler` gets Fastify's default body, with no `success` field, and a declared `400: ApiErrorSchema` then becomes a 500 (`FST_ERR_FAILED_ERROR_SERIALIZATION`).
- CORS lists its methods explicitly (`GET, HEAD, POST, PUT`). Add a method there before any route uses it, or the browser's preflight fails.
- `src/__tests__/app-contract.test.ts` guards both rules.
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/__tests__/app-contract.test.ts apps/api/CLAUDE.md
git commit -F - <<'EOF'
Apply API error contract to all routes and allow PUT in CORS

Set the global error handler before the auth, health and feature plugins.
Their errors now use the ApiError shape instead of Fastify's default
body, and a declared 400: ApiErrorSchema no longer becomes a
serialization 500. List the CORS methods explicitly and add PUT for the
upcoming PUT /avatar route.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

---

### Task 2: Shared avatar schemas in @tracks/types

**Files:**
- Create: `packages/types/src/avatar.schema.ts`
- Modify: `packages/types/src/index.ts` (append after line 40, the final `export type { UploadResult } ...` line)
- Test: `packages/types/src/__tests__/avatar.schema.test.ts`

**Interfaces:**
Consumes: `z` from `zod` (v4: `z.enum`, `z.object`, `.extend`, `z.iso.datetime({ offset: true })`).
Produces (all exported from `packages/types/src/avatar.schema.ts` and re-exported from `packages/types/src/index.ts`, consumed as `@tracks/types` from `dist/`):
- `SkinToneSchema` = `z.enum(['tone-1','tone-2','tone-3','tone-4','tone-5','tone-6'])`, `type SkinTone`
- `HairStyleSchema` = `z.enum(['short','curly','ponytail'])`, `type HairStyle`
- `HairColorSchema` = `z.enum(['black','dark-brown','light-brown','blonde','auburn','red','gray','blue'])`, `type HairColor`
- `TopItemSchema` = `z.enum(['starter-tee-red','starter-tee-blue','starter-tee-green'])`, `type TopItem`
- `BottomItemSchema` = `z.enum(['starter-shorts-navy','starter-shorts-black','starter-shorts-gray'])`, `type BottomItem`
- `ShoesItemSchema` = `z.enum(['starter-shoes-white','starter-shoes-black','starter-shoes-red'])`, `type ShoesItem`
- `AvatarAppearanceSchema` = `z.object({ skin_tone, hair_style, hair_color, top, bottom, shoes })`, `type AvatarAppearance`
- `AvatarSchema` = `AvatarAppearanceSchema.extend({ created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }) })`, `type Avatar`

Enum order matters. The first value of each enum is the default. `DEFAULT_APPEARANCE` in `apps/web/src/features/avatar/appearance.ts` uses these first values, and the "catalog enums" tests below lock the order. `z.object` strips unknown keys by default, so a `user_id` in a PUT body or a DB row never reaches the parsed value.

- [ ] **Step 1: Write the failing test**

Create `packages/types/src/__tests__/avatar.schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SkinToneSchema,
  HairStyleSchema,
  HairColorSchema,
  TopItemSchema,
  BottomItemSchema,
  ShoesItemSchema,
  AvatarAppearanceSchema,
  AvatarSchema,
} from '../avatar.schema.js';
import type { AvatarAppearance } from '../avatar.schema.js';
import * as barrel from '../index.js';

const validAppearance: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'auburn',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};

const validAvatar = {
  ...validAppearance,
  created_at: '2026-10-04T21:39:39.724427+00:00',
  updated_at: '2026-10-04T21:39:39.724427+00:00',
};

const appearanceFields = [
  'skin_tone',
  'hair_style',
  'hair_color',
  'top',
  'bottom',
  'shoes',
] as const;

describe('catalog enums', () => {
  it('lists skin tones in catalog order', () => {
    expect(SkinToneSchema.options).toEqual([
      'tone-1',
      'tone-2',
      'tone-3',
      'tone-4',
      'tone-5',
      'tone-6',
    ]);
  });

  it('lists hair styles in catalog order', () => {
    expect(HairStyleSchema.options).toEqual(['short', 'curly', 'ponytail']);
  });

  it('lists hair colors in catalog order', () => {
    expect(HairColorSchema.options).toEqual([
      'black',
      'dark-brown',
      'light-brown',
      'blonde',
      'auburn',
      'red',
      'gray',
      'blue',
    ]);
  });

  it('lists starter tops in catalog order', () => {
    expect(TopItemSchema.options).toEqual([
      'starter-tee-red',
      'starter-tee-blue',
      'starter-tee-green',
    ]);
  });

  it('lists starter bottoms in catalog order', () => {
    expect(BottomItemSchema.options).toEqual([
      'starter-shorts-navy',
      'starter-shorts-black',
      'starter-shorts-gray',
    ]);
  });

  it('lists starter shoes in catalog order', () => {
    expect(ShoesItemSchema.options).toEqual([
      'starter-shoes-white',
      'starter-shoes-black',
      'starter-shoes-red',
    ]);
  });

  it('rejects an ID from another slot', () => {
    expect(() => TopItemSchema.parse('starter-shorts-navy')).toThrow();
  });
});

describe('AvatarAppearanceSchema', () => {
  it('parses a valid appearance', () => {
    expect(AvatarAppearanceSchema.parse(validAppearance)).toEqual(
      validAppearance,
    );
  });

  it('parses the first option of every field', () => {
    const firsts = {
      skin_tone: 'tone-1',
      hair_style: 'short',
      hair_color: 'black',
      top: 'starter-tee-red',
      bottom: 'starter-shorts-navy',
      shoes: 'starter-shoes-white',
    };
    expect(AvatarAppearanceSchema.parse(firsts)).toEqual(firsts);
  });

  it.each(appearanceFields)('rejects an unknown %s ID', (field) => {
    const result = AvatarAppearanceSchema.safeParse({
      ...validAppearance,
      [field]: 'not-a-catalog-id',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it.each(appearanceFields)('rejects a missing %s', (field) => {
    const partial = Object.fromEntries(
      Object.entries(validAppearance).filter(([key]) => key !== field),
    );
    const result = AvatarAppearanceSchema.safeParse(partial);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it('rejects an empty object', () => {
    expect(() => AvatarAppearanceSchema.parse({})).toThrow();
  });

  it('strips a user_id sent with the appearance', () => {
    const result = AvatarAppearanceSchema.parse({
      ...validAppearance,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result).toEqual(validAppearance);
    expect(result).not.toHaveProperty('user_id');
  });
});

describe('AvatarSchema', () => {
  it('accepts Postgres timestamptz values with a +00:00 offset', () => {
    const result = AvatarSchema.parse(validAvatar);
    expect(result.created_at).toBe('2026-10-04T21:39:39.724427+00:00');
    expect(result.updated_at).toBe('2026-10-04T21:39:39.724427+00:00');
  });

  it('accepts Z timestamps', () => {
    expect(() =>
      AvatarSchema.parse({
        ...validAppearance,
        created_at: '2026-10-04T21:39:39.724Z',
        updated_at: '2026-10-04T21:39:39.724Z',
      }),
    ).not.toThrow();
  });

  it('strips unknown keys like user_id from a database row', () => {
    const result = AvatarSchema.parse({
      ...validAvatar,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result).toEqual(validAvatar);
    expect(result).not.toHaveProperty('user_id');
  });

  it('rejects missing timestamps', () => {
    expect(() => AvatarSchema.parse(validAppearance)).toThrow();
  });

  it('rejects a non-ISO timestamp', () => {
    expect(() =>
      AvatarSchema.parse({ ...validAvatar, updated_at: 'yesterday' }),
    ).toThrow();
  });

  it('rejects an unknown catalog ID in a stored row', () => {
    expect(() =>
      AvatarSchema.parse({ ...validAvatar, hair_style: 'mohawk' }),
    ).toThrow();
  });
});

describe('package barrel', () => {
  it('re-exports every avatar schema from src/index.ts', () => {
    expect(barrel.SkinToneSchema).toBe(SkinToneSchema);
    expect(barrel.HairStyleSchema).toBe(HairStyleSchema);
    expect(barrel.HairColorSchema).toBe(HairColorSchema);
    expect(barrel.TopItemSchema).toBe(TopItemSchema);
    expect(barrel.BottomItemSchema).toBe(BottomItemSchema);
    expect(barrel.ShoesItemSchema).toBe(ShoesItemSchema);
    expect(barrel.AvatarAppearanceSchema).toBe(AvatarAppearanceSchema);
    expect(barrel.AvatarSchema).toBe(AvatarSchema);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run:
```bash
pnpm --filter @tracks/types exec vitest run src/__tests__/avatar.schema.test.ts
```
Expected: FAIL. The suite does not load and reports no tests:
```
 FAIL  src/__tests__/avatar.schema.test.ts [ src/__tests__/avatar.schema.test.ts ]
Error: Cannot find module '../avatar.schema.js' imported from .../packages/types/src/__tests__/avatar.schema.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 3: Implement the schemas**

Create `packages/types/src/avatar.schema.ts`:

```ts
import { z } from 'zod';

// Catalog IDs are append-only: never rename or remove one unless a migration
// first rewrites the avatars rows that store it. The first value of each enum
// is the default the creator starts from.

export const SkinToneSchema = z.enum([
  'tone-1',
  'tone-2',
  'tone-3',
  'tone-4',
  'tone-5',
  'tone-6',
]);
export type SkinTone = z.infer<typeof SkinToneSchema>;

export const HairStyleSchema = z.enum(['short', 'curly', 'ponytail']);
export type HairStyle = z.infer<typeof HairStyleSchema>;

export const HairColorSchema = z.enum([
  'black',
  'dark-brown',
  'light-brown',
  'blonde',
  'auburn',
  'red',
  'gray',
  'blue',
]);
export type HairColor = z.infer<typeof HairColorSchema>;

export const TopItemSchema = z.enum([
  'starter-tee-red',
  'starter-tee-blue',
  'starter-tee-green',
]);
export type TopItem = z.infer<typeof TopItemSchema>;

export const BottomItemSchema = z.enum([
  'starter-shorts-navy',
  'starter-shorts-black',
  'starter-shorts-gray',
]);
export type BottomItem = z.infer<typeof BottomItemSchema>;

export const ShoesItemSchema = z.enum([
  'starter-shoes-white',
  'starter-shoes-black',
  'starter-shoes-red',
]);
export type ShoesItem = z.infer<typeof ShoesItemSchema>;

export const AvatarAppearanceSchema = z.object({
  skin_tone: SkinToneSchema,
  hair_style: HairStyleSchema,
  hair_color: HairColorSchema,
  top: TopItemSchema,
  bottom: BottomItemSchema,
  shoes: ShoesItemSchema,
});
export type AvatarAppearance = z.infer<typeof AvatarAppearanceSchema>;

export const AvatarSchema = AvatarAppearanceSchema.extend({
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type Avatar = z.infer<typeof AvatarSchema>;
```

- [ ] **Step 4: Run the test. The schema tests pass and the barrel test still fails**

Run:
```bash
pnpm --filter @tracks/types exec vitest run src/__tests__/avatar.schema.test.ts
```
Expected: 29 passed, 1 failed. Only the barrel test fails:
```
 FAIL  src/__tests__/avatar.schema.test.ts > package barrel > re-exports every avatar schema from src/index.ts
AssertionError: expected undefined to be ZodEnum{ _zod: { …(10) }, …(6) } // Object.is equality
      Tests  1 failed | 29 passed (30)
```

- [ ] **Step 5: Export from the package barrel**

Append to the end of `packages/types/src/index.ts`, after line 40 (`export type { UploadResult } from './upload.schema.js';`), with one blank line before it:

```ts

export {
  SkinToneSchema,
  HairStyleSchema,
  HairColorSchema,
  TopItemSchema,
  BottomItemSchema,
  ShoesItemSchema,
  AvatarAppearanceSchema,
  AvatarSchema,
} from './avatar.schema.js';
export type {
  SkinTone,
  HairStyle,
  HairColor,
  TopItem,
  BottomItem,
  ShoesItem,
  AvatarAppearance,
  Avatar,
} from './avatar.schema.js';
```

- [ ] **Step 6: Run the test and watch it pass**

Run:
```bash
pnpm --filter @tracks/types exec vitest run src/__tests__/avatar.schema.test.ts
```
Expected: PASS.
```
 Test Files  1 passed (1)
      Tests  30 passed (30)
```

- [ ] **Step 7: Run the whole package suite**

Run:
```bash
pnpm --filter @tracks/types test
```
Expected: PASS. All 6 test files pass (`api-response`, `common`, `jobs.schema`, `upload.schema`, `user.schema`, `avatar.schema`) with 0 failures. The package had 44 tests before this task, so this run should show `Tests  74 passed (74)`.

- [ ] **Step 8: Typecheck (tests included, strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)**

Run:
```bash
pnpm --filter @tracks/types typecheck
```
Expected: exits 0 and `tsc --noEmit` prints nothing. `@tracks/types` has no `lint` script, so typecheck is its only static check.

- [ ] **Step 9: Build dist so api and web can consume the new exports**

Run:
```bash
pnpm --filter @tracks/types build && grep -n "avatar.schema.js" packages/types/dist/index.js packages/types/dist/index.d.ts
```
Expected: the build exits 0, and grep prints three lines:
```
packages/types/dist/index.js:6:export { SkinToneSchema, HairStyleSchema, HairColorSchema, TopItemSchema, BottomItemSchema, ShoesItemSchema, AvatarAppearanceSchema, AvatarSchema, } from './avatar.schema.js';
packages/types/dist/index.d.ts:11:export { SkinToneSchema, HairStyleSchema, HairColorSchema, TopItemSchema, BottomItemSchema, ShoesItemSchema, AvatarAppearanceSchema, AvatarSchema, } from './avatar.schema.js';
packages/types/dist/index.d.ts:12:export type { SkinTone, HairStyle, HairColor, TopItem, BottomItem, ShoesItem, AvatarAppearance, Avatar, } from './avatar.schema.js';
```
`packages/types/dist/` is gitignored and is not committed.

- [ ] **Step 10: Commit**

```bash
git add packages/types/src/avatar.schema.ts packages/types/src/index.ts packages/types/src/__tests__/avatar.schema.test.ts
git commit -F - <<'EOF'
Add shared avatar catalog schemas to @tracks/types

Skin tone, hair style, hair color and starter clothing IDs as z.enum
(first value is the default), AvatarAppearanceSchema for the six slots,
and AvatarSchema with offset-tolerant timestamps. Unknown keys such as
user_id are stripped. Exported from the package barrel.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```
Expected: one commit on `feat/avatar-room` with 3 files changed (2 created, 1 modified).

---

### Task 3: Database: avatars table, user_profiles grant, pgTAP tests

**Files:**
- Create: `supabase/tests/database/avatars.test.sql`
- Create: `supabase/migrations/20261004120000_create_avatars.sql`
- Create: `supabase/migrations/20261004120100_grant_user_profiles_service_role.sql`
- Modify: `package.json` (the `scripts` block, lines 8-18: add `"test:db"` right after `"test"` on line 13)

**Interfaces:**
- Consumes: the `public.set_updated_at()` trigger function (from `supabase/migrations/20260312060909_create_users_profile.sql`), `auth.users(id)`, `public.user_profiles`, and the Supabase roles `anon`, `authenticated` and `service_role`. Only `service_role` has `bypassrls`.
- Produces:
  - Table `public.avatars (user_id uuid primary key references auth.users(id) on delete cascade, skin_tone text not null, hair_style text not null, hair_color text not null, top text not null, bottom text not null, shoes text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`. RLS is enabled with no policies. `anon` and `authenticated` hold no privileges. `service_role` has `select, insert, update, delete`. The `set_updated_at` BEFORE UPDATE trigger maintains `updated_at`.
  - `service_role` has `select, insert, update, delete` on `public.user_profiles`.
  - Root script `"test:db": "supabase test db"`.
  - The later API task's `avatar.service.ts` (`getByUserId(userId: string): Promise<Avatar | null>`, `upsertForUser(userId: string, appearance: AvatarAppearance): Promise<Avatar>`) uses this table through `supabase.from('avatars')`. Its upsert never sends `created_at` or `updated_at`, which matches the upsert this task tests.

> **Warning:** `supabase db reset` wipes all local data, including auth users you created by hand. Recreate them afterwards if you need them. The e2e suite signs up a fresh address on every run. This task needs the local Supabase stack (project_id `tracks_app`) to be running.

> **What the local tests cannot prove:** Supabase CLI 2.98.1 still auto-grants. In the local DB, `pg_default_acl` already gives `service_role` full privileges on every new `public` table. Tests 2-3 (the `user_profiles` grant) and tests 8-12 (`service_role` access to `avatars`) therefore pass locally whether or not the two `grant ... to service_role` statements exist. Those grants only take effect on hosted projects, which no longer auto-grant, and on any stack without auto-grant. Locally, you confirm them by reading the migration files (Step 8). Tests 4-7 are different: they do fail locally without the `revoke`, because the local auto-grant also covers `anon` and `authenticated`.

- [ ] **Step 1: Check the branch and the local stack**

Run:
```bash
git branch --show-current && supabase status 2>&1 | grep -E "running|Database"
```
Expected: `feat/avatar-room`, then `supabase local development setup is running.` and the `⛁ Database` row. If the stack is stopped, run `supabase start` first.

- [ ] **Step 2: Write the failing pgTAP test**

Create `supabase/tests/database/avatars.test.sql`:
```sql
-- pgTAP checks for public.avatars and the user_profiles service_role grant.
-- Local only (not part of pnpm test): supabase db reset && pnpm test:db

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Fixtures, inserted as postgres. now() is fixed for the whole test
-- transaction, so the 2000-01-01 timestamps make "moved forward" observable.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'avatar-test-a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'avatar-test-b@example.test');

insert into public.avatars
  (user_id, skin_tone, hair_style, hair_color, top, bottom, shoes, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000000a', 'tone-1', 'short', 'black',
   'starter-tee-red', 'starter-shorts-navy', 'starter-shoes-white',
   '2000-01-01 00:00:00+00', '2000-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-00000000000b', 'tone-2', 'curly', 'blonde',
   'starter-tee-blue', 'starter-shorts-black', 'starter-shoes-black',
   '2000-01-01 00:00:00+00', '2000-01-01 00:00:00+00');

-- 1. RLS is enabled (with no policies, nothing but a bypassrls role sees rows)
select ok(
  (select relrowsecurity from pg_class where oid = 'public.avatars'::regclass),
  'RLS is enabled on public.avatars'
);

-- 2-3. Regression guard for the user_profiles service_role grant. Supabase CLI
-- 2.98.1 auto-grants new public tables to service_role, so these pass locally
-- with or without the grant migration. They only fail on hosted projects or on
-- a stack without auto-grant.
select ok(
  has_table_privilege('service_role', 'public.user_profiles', 'select'),
  'service_role has select on public.user_profiles'
);
select ok(
  has_table_privilege('service_role', 'public.user_profiles', 'update'),
  'service_role has update on public.user_profiles'
);

-- 4-6. authenticated (as user A) holds no table privileges, even on A's own row
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select * from public.avatars where user_id = '00000000-0000-4000-8000-00000000000a' $$,
  '42501',
  'permission denied for table avatars',
  'authenticated cannot select its own avatar'
);
select throws_ok(
  $$ insert into public.avatars (user_id, skin_tone, hair_style, hair_color, top, bottom, shoes)
     values ('00000000-0000-4000-8000-00000000000a', 'tone-3', 'ponytail', 'red',
             'starter-tee-green', 'starter-shorts-gray', 'starter-shoes-red') $$,
  '42501',
  'permission denied for table avatars',
  'authenticated cannot insert its own avatar'
);
select throws_ok(
  $$ update public.avatars set hair_style = 'ponytail'
     where user_id = '00000000-0000-4000-8000-00000000000a' $$,
  '42501',
  'permission denied for table avatars',
  'authenticated cannot update its own avatar'
);

-- 7. anon holds no table privileges
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select * from public.avatars $$,
  '42501',
  'permission denied for table avatars',
  'anon cannot select avatars'
);

-- 8-12. service_role (the API's client) reads and upserts. As with tests 2-3,
-- the local auto-grant means these do not prove the explicit avatars grant.
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select results_eq(
  $$ select user_id from public.avatars order by user_id $$,
  $$ values ('00000000-0000-4000-8000-00000000000a'::uuid),
            ('00000000-0000-4000-8000-00000000000b'::uuid) $$,
  'service_role can select every avatar'
);

-- Same statement shape PostgREST builds for supabase-js
-- .upsert({ user_id, ...appearance }, { onConflict: 'user_id' }):
-- created_at and updated_at are never sent.
select lives_ok(
  $$ insert into public.avatars (user_id, skin_tone, hair_style, hair_color, top, bottom, shoes)
     values ('00000000-0000-4000-8000-00000000000a', 'tone-1', 'curly', 'black',
             'starter-tee-red', 'starter-shorts-navy', 'starter-shoes-white')
     on conflict (user_id) do update set
       skin_tone = excluded.skin_tone,
       hair_style = excluded.hair_style,
       hair_color = excluded.hair_color,
       top = excluded.top,
       bottom = excluded.bottom,
       shoes = excluded.shoes $$,
  'service_role can upsert an avatar on user_id'
);

select is(
  (select hair_style from public.avatars
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  'curly',
  'upsert changed hair_style'
);
select is(
  (select created_at from public.avatars
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  '2000-01-01 00:00:00+00'::timestamptz,
  'upsert kept created_at'
);
select ok(
  (select updated_at from public.avatars
   where user_id = '00000000-0000-4000-8000-00000000000a') > '2000-01-01 00:00:00+00'::timestamptz,
  'set_updated_at trigger moved updated_at forward'
);

select * from finish();
rollback;
```
Each `throws_ok` call checks the exact error message as well as the code. If the `revoke` were missing, an insert as `authenticated` would still fail with code 42501, but the message would be `new row violates row-level security policy for table "avatars"`. Checking the message makes test 5 fail in that case instead of passing.

Writing this file triggers the repo's PostToolUse hook in `.claude/settings.json`. The hook runs `npx vitest --run <file>` on any path that contains `.test.`. The repo root has no vitest, so npx installs `vitest@5.0.3` (`npm warn exec The following package was not found and will be installed: vitest@5.0.3`) and prints `No test files found, exiting with code 1` with `filter: supabase/tests/database/avatars.test.sql`. That output is expected and harmless: the hook ends with `|| true`, and vitest never runs `.sql` files. Do not try to fix it. The real check for this file is `pnpm test:db` in Steps 4 and 7.

- [ ] **Step 3: Add the root `test:db` script**

In `package.json`, add `"test:db": "supabase test db",` directly after `"test": "turbo test",` (line 13). The `scripts` block (lines 8-18) becomes:
```json
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "test": "turbo test",
    "test:db": "supabase test db",
    "cap:sync": "pnpm --filter @tracks/web exec cap sync",
    "cap:add:ios": "pnpm --filter @tracks/web exec cap add ios",
    "cap:add:android": "pnpm --filter @tracks/web exec cap add android",
    "init:project": "npx tsx scripts/init.ts"
  },
```
Leave the rest of the file unchanged. `supabase test db` uses the globally installed Supabase CLI (2.98.1) and runs every `*.sql` file under `supabase/tests/`, including the `database/` subfolder. The script is not part of `pnpm test`, so CI and deploys stay free of Supabase.

- [ ] **Step 4: Reset the DB and run the test to see it fail**

Run:
```bash
supabase db reset && pnpm test:db
```
Expected: the reset applies only the two existing migrations and ends with `Finished supabase db reset on branch feat/avatar-room.` The test run then FAILS:
```
NOTICE:  extension "pgtap" already exists, skipping
.../supabase/tests/database/avatars.test.sql:23: ERROR:  relation "public.avatars" does not exist
LINE 1: insert into public.avatars
...
Dubious, test returned 3 (wstat 768, 0x300)
Failed 12/12 subtests
  Parse errors: Bad plan.  You planned 12 tests but ran 0.
Result: FAIL
error running container: exit 1
```
pnpm then reports `ELIFECYCLE  Command failed with exit code 1.` On the first run, the CLI may pull `public.ecr.aws/supabase/pg_prove:3.36` before testing.

This failure comes only from the missing table. There is no separate red run for the `user_profiles` grant (Step 6). With the local auto-grant, tests 2-3 already hold before that migration exists (see the note at the top of this task).

- [ ] **Step 5: Create the avatars migration**

Create `supabase/migrations/20261004120000_create_avatars.sql`:
```sql
-- Athlete avatar appearance, one row per user. Allowed IDs are enforced by the
-- API's Zod catalog (packages/types/src/avatar.schema.ts), not by enums or CHECK
-- constraints: the API's service-role client is the only reader and writer.
create table public.avatars (
  user_id uuid primary key references auth.users(id) on delete cascade,
  skin_tone text not null,
  hair_style text not null,
  hair_color text not null,
  top text not null,
  bottom text not null,
  shoes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS on with no policies, and no Data API privileges for anon or
-- authenticated (ADR-002). Grants are explicit because hosted Supabase no
-- longer auto-grants new public tables to the Data API roles.
alter table public.avatars enable row level security;
revoke all on table public.avatars from anon, authenticated;
grant select, insert, update, delete on table public.avatars to service_role;

create trigger set_updated_at
  before update on public.avatars
  for each row execute function public.set_updated_at();
```

- [ ] **Step 6: Create the user_profiles grant migration**

Create `supabase/migrations/20261004120100_grant_user_profiles_service_role.sql`:
```sql
-- Hosted Supabase no longer auto-grants new public tables to the Data API
-- roles, so the API's service-role client needs an explicit grant.
-- Existing RLS policies and the set_updated_at trigger are unchanged.
grant select, insert, update, delete on table public.user_profiles to service_role;
```

- [ ] **Step 7: Reset the DB and run the test to see it pass**

Run:
```bash
supabase db reset && pnpm test:db
```
Expected: the reset output includes `Applying migration 20261004120000_create_avatars.sql...` and `Applying migration 20261004120100_grant_user_profiles_service_role.sql...`, and ends with `Finished supabase db reset on branch feat/avatar-room.` Then:
```
.../supabase/tests/database/avatars.test.sql .. ok
All tests successful.
Files=1, Tests=12, ...
Result: PASS
```
This green run proves four things: the table exists, RLS is on, `anon` and `authenticated` are locked out (tests 4-7 need the `revoke`), and the upsert and trigger behave as expected. It does not prove either `grant ... to service_role` line, because CLI 2.98.1 auto-grants them locally. Step 8 checks those lines in the migration files.

- [ ] **Step 8: Verify the grants and policies directly**

Read the two grant statements back from the migrations. They are the only proof available locally that hosted projects will get the grants:
```bash
grep -n "grant\|revoke" supabase/migrations/20261004120000_create_avatars.sql supabase/migrations/20261004120100_grant_user_profiles_service_role.sql
```
Expected: six matching lines. grep is case-sensitive, so the `Grants are explicit` comment does not match. Three are comment lines: `-- longer auto-grants new public tables to the Data API roles.` in the first file, and `-- Hosted Supabase no longer auto-grants new public tables to the Data API` and `-- roles, so the API's service-role client needs an explicit grant.` in the second. The other three are statements: `revoke all on table public.avatars from anon, authenticated;` and `grant select, insert, update, delete on table public.avatars to service_role;` in the first file, plus `grant select, insert, update, delete on table public.user_profiles to service_role;` in the second. Make sure the two `grant ... to service_role` statements and the `revoke` are all present and spelled exactly as shown.

Then query the live catalog:
```bash
docker exec supabase_db_tracks_app psql -U postgres -d postgres -Atc "select grantee from information_schema.role_table_grants where table_schema = 'public' and table_name = 'avatars' group by grantee order by grantee; select count(*) from pg_policies where schemaname = 'public' and tablename = 'avatars'; select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'user_profiles' and grantee = 'service_role';"
```
Expected output, line by line: `postgres`, then `service_role` (no `anon` or `authenticated` row), then `0` (no policies), then `DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE`. That last list is the same with or without the Step 6 migration, because CLI 2.98.1 auto-grants all privileges locally. Hosted projects get only the four explicit privileges.

Also confirm that the new script exists and `pnpm test` is unchanged:
```bash
pnpm run 2>&1 | grep -A1 "test:db"
```
Expected: `test:db` followed by `supabase test db`. Turbo's `test` pipeline is unchanged.

- [ ] **Step 9: Commit**

```bash
git add supabase/tests/database/avatars.test.sql supabase/migrations/20261004120000_create_avatars.sql supabase/migrations/20261004120100_grant_user_profiles_service_role.sql package.json
git commit -F - <<'EOF'
Add avatars table, user_profiles grant and pgTAP tests

Create public.avatars: one row per user, RLS on with no policies, no
anon/authenticated privileges, explicit service_role grants, and the
set_updated_at trigger. Grant service_role DML on public.user_profiles,
since hosted Supabase no longer auto-grants new public tables to the Data
API roles.

supabase/tests/database/avatars.test.sql runs locally through the new
root script pnpm test:db after supabase db reset. It covers RLS, the
anon/authenticated lockout and the service_role upsert and trigger. Its
service_role grant assertions are a regression guard only: the local
CLI auto-grants, so they can fail only on hosted or non-auto-grant stacks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```
Expected: one commit with 4 files changed (3 new files, `package.json` modified).

---

### Task 4: API: GET/PUT /avatar (plugin + service)

**Files:**
- Create: `apps/api/src/services/avatar.service.ts`
- Create: `apps/api/src/plugins/avatar.ts`
- Modify: `apps/api/src/app.ts` (import block next to `import authCallbackPlugin ...`, originally line 13; feature-plugin block right after `await app.register(authCallbackPlugin);`, line 75 after Task 1's rewrite)
- Modify: `apps/api/CLAUDE.md` (the `### Service Example` section, lines 28-37)
- Test: `apps/api/src/__tests__/avatar.test.ts`

**Interfaces:**
- Consumes:
  - From `@tracks/types` (Task 2, built to dist): `AvatarAppearanceSchema`, `AvatarSchema`, `type Avatar`, `type AvatarAppearance`. Already there: `ApiSuccessSchema`, `ApiErrorSchema`.
  - From `apps/api/src/app.ts` (Task 1): `app.setErrorHandler(...)` is registered above `await app.register(authPlugin)`, and CORS has `methods: ['GET', 'HEAD', 'POST', 'PUT']`.
  - Already in the API: `fastify.authenticate` (preHandler), `request.user.id`, `supabase` from `../lib/supabase.js`, and `createTestToken()` from `./helpers.js` (its sub is `550e8400-e29b-41d4-a716-446655440000`).
- Produces:
  - `apps/api/src/services/avatar.service.ts`:
    - `getByUserId(userId: string): Promise<Avatar | null>`
    - `upsertForUser(userId: string, appearance: AvatarAppearance): Promise<Avatar>`
  - `apps/api/src/plugins/avatar.ts`: `export default avatarPlugin` (`FastifyPluginAsyncZod`), registered in `app.ts` after `authCallbackPlugin`.
  - HTTP:
    - `GET /avatar`:
      - 200 `ApiSuccess<Avatar>`.
      - 404 `{ success: false, error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' } }`.
      - 401 `UNAUTHORIZED`.
    - `PUT /avatar` (body `AvatarAppearance`, unknown keys such as `user_id` stripped):
      - 200 `ApiSuccess<Avatar>`.
      - 400 `ApiError` with code `FST_ERR_VALIDATION`.
      - 401 `UNAUTHORIZED`.
    - Response bodies never include `user_id`: the response schema strips it.

- [ ] **Step 1: Confirm the Task 2 and Task 1 prerequisites**

Run from the repo root (Git Bash, branch `feat/avatar-room`):

```bash
pnpm --filter @tracks/types build
grep -c "AvatarAppearanceSchema" packages/types/dist/index.d.ts
grep -n "app.setErrorHandler\|app.register(authPlugin)\|methods:" apps/api/src/app.ts
```

Expected:
- The build exits 0.
- The first grep (Task 2's schemas) prints a non-zero count.
- In the second grep (Task 1's app.ts changes), the `app.setErrorHandler` line number is **lower** than the `app.register(authPlugin)` line number, and the `methods:` line lists `'PUT'`.

If either check fails, stop: Task 1 or Task 2 has not landed (a failed first grep means Task 2; a failed second grep means Task 1).

- [ ] **Step 2: Write the failing route tests**

Create `apps/api/src/__tests__/avatar.test.ts`:

```typescript
import { vi, describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Avatar, AvatarAppearance } from '@tracks/types';

vi.mock('../workers/email.worker.js', () => ({
  startEmailWorkers: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/avatar.service.js', () => ({
  getByUserId: vi.fn(),
  upsertForUser: vi.fn(),
}));

import { build } from '../app.js';
import * as avatarService from '../services/avatar.service.js';
import { createTestToken } from './helpers.js';

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

const APPEARANCE: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'auburn',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};

const AVATAR: Avatar = {
  ...APPEARANCE,
  created_at: '2026-10-04T12:00:00.123456+00:00',
  updated_at: '2026-10-04T12:30:00.654321+00:00',
};

// What Supabase returns at runtime: the full row, including user_id.
const AVATAR_ROW = { ...AVATAR, user_id: TEST_USER_ID };

const getByUserId = vi.mocked(avatarService.getByUserId);
const upsertForUser = vi.mocked(avatarService.upsertForUser);

describe('/avatar', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    getByUserId.mockReset();
    upsertForUser.mockReset();
  });

  describe('GET /avatar', () => {
    it('returns 404 AVATAR_NOT_FOUND when the user has no avatar', async () => {
      getByUserId.mockResolvedValueOnce(null);
      const token = await createTestToken();

      const response = await app.inject({
        method: 'GET',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AVATAR_NOT_FOUND');
      expect(body.error.message).toBe('Avatar not found');
      expect(getByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('returns 200 with the avatar, without user_id', async () => {
      getByUserId.mockResolvedValueOnce(AVATAR_ROW);
      const token = await createTestToken();

      const response = await app.inject({
        method: 'GET',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(AVATAR);
      expect(getByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('returns 401 without auth', async () => {
      const response = await app.inject({ method: 'GET', url: '/avatar' });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(getByUserId).not.toHaveBeenCalled();
    });
  });

  describe('PUT /avatar', () => {
    it('upserts for the token user with the parsed body and returns 200', async () => {
      upsertForUser.mockResolvedValueOnce(AVATAR_ROW);
      const token = await createTestToken();

      const response = await app.inject({
        method: 'PUT',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...APPEARANCE, user_id: '00000000-0000-4000-8000-000000000000' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(AVATAR);
      expect(upsertForUser).toHaveBeenCalledTimes(1);
      expect(upsertForUser).toHaveBeenCalledWith(TEST_USER_ID, APPEARANCE);
    });

    it('returns 400 FST_ERR_VALIDATION for an unknown catalog ID', async () => {
      const token = await createTestToken();

      const response = await app.inject({
        method: 'PUT',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...APPEARANCE, hair_color: 'neon-pink' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FST_ERR_VALIDATION');
      expect(upsertForUser).not.toHaveBeenCalled();
    });

    it('returns 400 FST_ERR_VALIDATION when a field is missing', async () => {
      const token = await createTestToken();
      const { shoes: _shoes, ...withoutShoes } = APPEARANCE;

      const response = await app.inject({
        method: 'PUT',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
        payload: withoutShoes,
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FST_ERR_VALIDATION');
      expect(upsertForUser).not.toHaveBeenCalled();
    });

    it('returns 401 without auth for a valid body', async () => {
      // Body validation runs before the auth preHandler, so this body must be valid
      // for the request to reach authenticate and get a 401.
      const response = await app.inject({
        method: 'PUT',
        url: '/avatar',
        payload: APPEARANCE,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(upsertForUser).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @tracks/api exec vitest run src/__tests__/avatar.test.ts`

Expected: FAIL. The suite cannot load because the service module does not exist yet:

```
FAIL  src/__tests__/avatar.test.ts [ src/__tests__/avatar.test.ts ]
Error: Cannot find module '/src/services/avatar.service.js' imported from D:/Projects/Tracks/apps/api/src/__tests__/avatar.test.ts
Test Files  1 failed (1)
     Tests  no tests
```

- [ ] **Step 4: Implement the avatar service**

Create `apps/api/src/services/avatar.service.ts`:

```typescript
import type { Avatar, AvatarAppearance } from '@tracks/types';
import { supabase } from '../lib/supabase.js';

// Returns null when the user has no avatar yet. Use maybeSingle(), not single():
// single() turns "no row" into a PGRST116 error, which surfaces as a 500.
export async function getByUserId(userId: string): Promise<Avatar | null> {
  const { data, error } = await supabase
    .from('avatars')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Creates or replaces the user's avatar. Never sends created_at/updated_at:
// an update keeps created_at, and the set_updated_at trigger moves updated_at.
export async function upsertForUser(
  userId: string,
  appearance: AvatarAppearance,
): Promise<Avatar> {
  const { data, error } = await supabase
    .from('avatars')
    .upsert({ user_id: userId, ...appearance }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 5: Run the test to verify the routes are still missing**

Run: `pnpm --filter @tracks/api exec vitest run src/__tests__/avatar.test.ts`

Expected: FAIL with `Tests  7 failed (7)`.
- The 404 test fails with `AssertionError: expected undefined to be false // Object.is equality`. Fastify's default not-found body has no `success` field.
- Every other test fails with `AssertionError: expected 404 to be 200`, `expected 404 to be 401` or `expected 404 to be 400`.

- [ ] **Step 6: Implement the avatar plugin**

Create `apps/api/src/plugins/avatar.ts`:

```typescript
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  ApiErrorSchema,
  ApiSuccessSchema,
  AvatarAppearanceSchema,
  AvatarSchema,
} from '@tracks/types';
import * as avatarService from '../services/avatar.service.js';

const avatarPlugin: FastifyPluginAsyncZod = async function (fastify) {
  fastify.get('/avatar', {
    preHandler: [fastify.authenticate],
    schema: {
      response: { 200: ApiSuccessSchema(AvatarSchema), 404: ApiErrorSchema },
    },
  }, async (request, reply) => {
    const avatar = await avatarService.getByUserId(request.user.id);
    if (!avatar) {
      return reply.code(404).send({
        success: false,
        error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' },
      });
    }
    return { success: true as const, data: avatar };
  });

  // The body schema strips unknown keys, so a user_id sent by the client never
  // reaches the service. The owner always comes from the verified token.
  fastify.put('/avatar', {
    preHandler: [fastify.authenticate],
    schema: {
      body: AvatarAppearanceSchema,
      response: { 200: ApiSuccessSchema(AvatarSchema), 400: ApiErrorSchema },
    },
  }, async (request) => {
    const avatar = await avatarService.upsertForUser(request.user.id, request.body);
    return { success: true as const, data: avatar };
  });
};

export default avatarPlugin;
```

- [ ] **Step 7: Register the plugin in app.ts**

In `apps/api/src/app.ts`, add the import right after the auth-callback import:

```typescript
import authCallbackPlugin from './plugins/auth-callback.js';
import avatarPlugin from './plugins/avatar.js';
```

In the `// 9. Feature plugins` block (Task 1 renumbered it), add the registration right after `authCallbackPlugin`. The block then reads:

```typescript
  await app.register(usersPlugin);
  await app.register(uploadsPlugin);
  await app.register(authCallbackPlugin);
  await app.register(avatarPlugin);
```

Leave everything else alone. The error-handler position and CORS methods belong to Task 1.

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter @tracks/api exec vitest run src/__tests__/avatar.test.ts`

Expected: PASS with `Test Files  1 passed (1)` and `Tests  7 passed (7)`.

If the two 400 tests fail with `expected 500 to be 400`, `app.setErrorHandler` is still registered after the feature plugins. Fix the Task 1 ordering in app.ts; do not change the test.

- [ ] **Step 9: Document maybeSingle() for optional rows in apps/api/CLAUDE.md**

In `apps/api/CLAUDE.md`, replace the whole `### Service Example` section (lines 28-37, up to but not including `## Hooks`) with:

````markdown
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
````

- [ ] **Step 10: Typecheck, lint and run the full API suite**

Run:

```bash
pnpm --filter @tracks/api typecheck
pnpm --filter @tracks/api lint
pnpm --filter @tracks/api test
```

Expected:
- Typecheck and lint both exit 0 with no output beyond the script banner.
- `test` reports every test file passed (users, auth, uploads, health, auth-callback, app-contract, avatar), with no failures, warnings or stray console output.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/services/avatar.service.ts apps/api/src/plugins/avatar.ts apps/api/src/app.ts apps/api/src/__tests__/avatar.test.ts apps/api/CLAUDE.md
git commit -F - <<'EOF'
Add GET and PUT /avatar API routes

GET /avatar returns the caller's avatar, or 404 AVATAR_NOT_FOUND when
none exists (maybeSingle, so a missing row is not a 500). PUT /avatar
validates all six appearance fields against the shared catalog and
upserts on user_id. The owner always comes from the verified token,
and a user_id in the body is stripped. The API service example now
documents maybeSingle() for optional rows.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

---

### Task 5: Web avatar catalog: palette ramps, option labels, appearance helpers

**Files:**
- Create: `apps/web/src/features/avatar/swap.ts` (types `Ramp`, `Swap` and the functions `buildSwap`, `swapKey`; Task 6 appends `swapPixels`)
- Create: `apps/web/src/features/avatar/palette.ts`
- Create: `apps/web/src/features/avatar/catalog.ts`
- Create: `apps/web/src/features/avatar/appearance.ts`
- Test: `apps/web/src/features/avatar/__tests__/swap.test.ts`
- Test: `apps/web/src/features/avatar/__tests__/palette.test.ts`
- Test: `apps/web/src/features/avatar/__tests__/catalog.test.ts`
- Test: `apps/web/src/features/avatar/__tests__/appearance.test.ts`

**Interfaces:**
Consumes (Task 2, `@tracks/types` built to dist): `SkinToneSchema`, `HairStyleSchema`, `HairColorSchema`, `TopItemSchema`, `BottomItemSchema`, `ShoesItemSchema`, `AvatarAppearanceSchema`; types `SkinTone`, `HairStyle`, `HairColor`, `TopItem`, `BottomItem`, `ShoesItem`, `AvatarAppearance`.
Produces:
- `swap.ts`: `type Ramp = readonly [number, number, number]`; `type Swap = ReadonlyMap<number, number>`; `buildSwap(from: Ramp, to: Ramp): Swap`; `swapKey(swap: Swap | null): string` (`"none"` for null or an empty swap, otherwise sorted `rrggbb:rrggbb` pairs joined by `,`; never contains `|`)
- `palette.ts`: `PLACEHOLDER_RAMPS: { skin: Ramp; hair: Ramp; cloth: Ramp }`; `SKIN_RAMPS: Record<SkinTone, Ramp>`; `HAIR_RAMPS: Record<HairColor, Ramp>`; `CLOTH_RAMPS: Record<TopItem | BottomItem | ShoesItem, Ramp>`; `rampToCss(ramp: Ramp): string`
- `catalog.ts`: `interface Option { label: string }`; `SKIN_TONE_OPTIONS: Record<SkinTone, Option>`; `HAIR_STYLE_OPTIONS: Record<HairStyle, Option & { sheet: SheetId }>`; `HAIR_COLOR_OPTIONS: Record<HairColor, Option>`; `TOP_OPTIONS`, `BOTTOM_OPTIONS`, `SHOES_OPTIONS: Record<…, Option & { sheet: SheetId }>`; `BODY_SHEET = "body"`; `AVATAR_SHEET_IDS: readonly SheetId[]`. `SheetId = string` per the contract. It is written as `string` here because `sheets.ts` arrives in a later task.
- `appearance.ts`: `DEFAULT_APPEARANCE` (`as const satisfies AvatarAppearance`); `describeAppearance(a: AvatarAppearance): string`; `randomAppearance(rng: () => number): AvatarAppearance`

- [ ] **Step 1: Confirm the branch and the built avatar schemas**

```bash
git branch --show-current
pnpm --filter @tracks/types build && grep -c "AvatarAppearanceSchema" packages/types/dist/index.d.ts
```

Expected: the first line prints `feat/avatar-room`. The build exits 0, and grep prints a count of `1` or more. If the count is `0`, finish Task 2 first.

- [ ] **Step 2: Write the failing swap test**

Create `apps/web/src/features/avatar/__tests__/swap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSwap, swapKey } from '../swap.js';
import type { Ramp } from '../swap.js';

const FROM: Ramp = [0xff80ff, 0xff40ff, 0xff00ff];
const TO: Ramp = [0x112233, 0x445566, 0x778899];

describe('buildSwap', () => {
  it('maps each placeholder shade to the target shade at the same position', () => {
    const swap = buildSwap(FROM, TO);
    expect(swap.size).toBe(3);
    expect(swap.get(0xff80ff)).toBe(0x112233);
    expect(swap.get(0xff40ff)).toBe(0x445566);
    expect(swap.get(0xff00ff)).toBe(0x778899);
  });

  it('leaves colors outside the source ramp unmapped', () => {
    const swap = buildSwap(FROM, TO);
    expect(swap.has(0x000000)).toBe(false);
    expect(swap.has(0x112233)).toBe(false);
  });
});

describe('swapKey', () => {
  it('returns "none" for no swap or an empty swap', () => {
    expect(swapKey(null)).toBe('none');
    expect(swapKey(new Map())).toBe('none');
  });

  it('lists from:to pairs as 6-digit hex sorted by source color', () => {
    expect(swapKey(buildSwap(FROM, TO))).toBe('ff00ff:778899,ff40ff:445566,ff80ff:112233');
  });

  it('zero-pads small colors to 6 hex digits', () => {
    expect(swapKey(new Map([[0x00000a, 0x0000ff]]))).toBe('00000a:0000ff');
  });

  it('does not depend on insertion order', () => {
    const a = new Map([
      [0x010101, 0x020202],
      [0x030303, 0x040404],
    ]);
    const b = new Map([
      [0x030303, 0x040404],
      [0x010101, 0x020202],
    ]);
    expect(swapKey(a)).toBe(swapKey(b));
  });

  it('differs when any target differs', () => {
    const other: Ramp = [0x112233, 0x445566, 0x778800];
    expect(swapKey(buildSwap(FROM, TO))).not.toBe(swapKey(buildSwap(FROM, other)));
  });

  it('never contains the "|" separator used by LoadedSheets keys', () => {
    expect(swapKey(buildSwap(FROM, TO))).not.toContain('|');
    expect(swapKey(null)).not.toContain('|');
  });
});
```

- [ ] **Step 3: Run the swap test and watch it fail**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/swap.test.ts
```

Expected: FAIL, with
`Error: Failed to resolve import "../swap.js" from "src/features/avatar/__tests__/swap.test.ts". Does the file exist?` and `Test Files  1 failed (1)`.

- [ ] **Step 4: Implement swap.ts**

Create `apps/web/src/features/avatar/swap.ts`:

```ts
/** Three shades of one color, each packed 0xRRGGBB: [light, base, shadow]. */
export type Ramp = readonly [number, number, number];

/** Exact-RGB replacement table: packed 0xRRGGBB source -> packed 0xRRGGBB target. */
export type Swap = ReadonlyMap<number, number>;

/** Maps each shade of `from` to the shade at the same position in `to`. */
export function buildSwap(from: Ramp, to: Ramp): Swap {
  return new Map<number, number>([
    [from[0], to[0]],
    [from[1], to[1]],
    [from[2], to[2]],
  ]);
}

function hex6(color: number): string {
  return color.toString(16).padStart(6, '0');
}

/**
 * Stable cache key for a swap. `null` and an empty swap both mean "draw the
 * sheet as exported" and share the key "none"; otherwise the key lists
 * `from:to` hex pairs sorted by source color, so insertion order never matters.
 */
export function swapKey(swap: Swap | null): string {
  if (swap === null || swap.size === 0) return 'none';
  return [...swap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([from, to]) => `${hex6(from)}:${hex6(to)}`)
    .join(',');
}
```

- [ ] **Step 5: Run the swap test and watch it pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/swap.test.ts
```

Expected: PASS, `Test Files  1 passed (1)`, `Tests  8 passed (8)`.

- [ ] **Step 6: Write the failing palette test**

Create `apps/web/src/features/avatar/__tests__/palette.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  BottomItemSchema,
  HairColorSchema,
  ShoesItemSchema,
  SkinToneSchema,
  TopItemSchema,
} from '@tracks/types';
import {
  CLOTH_RAMPS,
  HAIR_RAMPS,
  PLACEHOLDER_RAMPS,
  SKIN_RAMPS,
  rampToCss,
} from '../palette.js';
import type { Ramp } from '../swap.js';

const PLACEHOLDER_COLORS = new Set<number>([
  ...PLACEHOLDER_RAMPS.skin,
  ...PLACEHOLDER_RAMPS.hair,
  ...PLACEHOLDER_RAMPS.cloth,
]);

const TARGET_RAMPS: ReadonlyArray<readonly [string, Ramp]> = [
  ...Object.entries(SKIN_RAMPS),
  ...Object.entries(HAIR_RAMPS),
  ...Object.entries(CLOTH_RAMPS),
];

/** Rec. 601 luma of a packed 0xRRGGBB color. */
function luma(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

describe('PLACEHOLDER_RAMPS', () => {
  it('holds the exact reserved key colors as [light, base, shadow]', () => {
    expect(PLACEHOLDER_RAMPS).toEqual({
      skin: [0xff80ff, 0xff40ff, 0xff00ff],
      hair: [0x80ffff, 0x40ffff, 0x00ffff],
      cloth: [0xffff80, 0xffff40, 0xffff00],
    });
  });

  it('has 9 distinct placeholder colors', () => {
    expect(PLACEHOLDER_COLORS.size).toBe(9);
  });
});

describe('target ramps', () => {
  it('cover every skin tone, hair color and clothing item exactly', () => {
    expect(Object.keys(SKIN_RAMPS).sort()).toEqual([...SkinToneSchema.options].sort());
    expect(Object.keys(HAIR_RAMPS).sort()).toEqual([...HairColorSchema.options].sort());
    expect(Object.keys(CLOTH_RAMPS).sort()).toEqual(
      [...TopItemSchema.options, ...BottomItemSchema.options, ...ShoesItemSchema.options].sort(),
    );
  });

  it.each(TARGET_RAMPS)('%s has 3 packed RGB shades', (_id, ramp) => {
    expect(ramp).toHaveLength(3);
    for (const color of ramp) {
      expect(Number.isInteger(color)).toBe(true);
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });

  it.each(TARGET_RAMPS)('%s contains no placeholder color', (_id, ramp) => {
    for (const color of ramp) {
      expect(PLACEHOLDER_COLORS.has(color)).toBe(false);
    }
  });

  it.each(TARGET_RAMPS)('%s runs light > base > shadow', (_id, ramp) => {
    const [light, base, shadow] = ramp;
    expect(luma(light)).toBeGreaterThan(luma(base));
    expect(luma(base)).toBeGreaterThan(luma(shadow));
  });

  it('orders skin tones from light to deep', () => {
    const bases = SkinToneSchema.options.map((tone) => luma(SKIN_RAMPS[tone][1]));
    expect(new Set(bases).size).toBe(bases.length);
    expect(bases).toEqual([...bases].sort((a, b) => b - a));
  });
});

describe('rampToCss', () => {
  it('formats the base shade as lowercase #rrggbb', () => {
    expect(rampToCss(PLACEHOLDER_RAMPS.skin)).toBe('#ff40ff');
    expect(rampToCss([0xabcdef, 0xa1b2c3, 0x000000])).toBe('#a1b2c3');
  });

  it('zero-pads dark colors to 6 digits', () => {
    expect(rampToCss([0x000010, 0x00000a, 0x000000])).toBe('#00000a');
  });
});
```

- [ ] **Step 7: Run the palette test and watch it fail**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/palette.test.ts
```

Expected: FAIL, with
`Error: Failed to resolve import "../palette.js" from "src/features/avatar/__tests__/palette.test.ts". Does the file exist?` and `Test Files  1 failed (1)`.

- [ ] **Step 8: Implement palette.ts**

Create `apps/web/src/features/avatar/palette.ts`:

```ts
import type { BottomItem, HairColor, ShoesItem, SkinTone, TopItem } from '@tracks/types';
import type { Ramp } from './swap.js';

/**
 * Reserved key colors drawn into the art. Matched by exact RGB at runtime and
 * replaced by a target ramp; never shown on screen.
 */
export const PLACEHOLDER_RAMPS: { skin: Ramp; hair: Ramp; cloth: Ramp } = {
  skin: [0xff80ff, 0xff40ff, 0xff00ff],
  hair: [0x80ffff, 0x40ffff, 0x00ffff],
  cloth: [0xffff80, 0xffff40, 0xffff00],
};

/** Skin tones, light to deep. */
export const SKIN_RAMPS: Record<SkinTone, Ramp> = {
  'tone-1': [0xfce3d3, 0xf5cdb6, 0xdda88e],
  'tone-2': [0xf6d2b4, 0xedb98f, 0xcf9670],
  'tone-3': [0xe8b88e, 0xd49a6a, 0xb07a4e],
  'tone-4': [0xc98e63, 0xb0744a, 0x8c5636],
  'tone-5': [0x9c6644, 0x80502f, 0x613a20],
  'tone-6': [0x6e4630, 0x563321, 0x3d2216],
};

export const HAIR_RAMPS: Record<HairColor, Ramp> = {
  black: [0x4a4458, 0x2b2733, 0x18151d],
  'dark-brown': [0x7a5236, 0x5a3a24, 0x3e2716],
  'light-brown': [0xb78652, 0x96693b, 0x714c29],
  blonde: [0xf6de8d, 0xe3c163, 0xbf9a41],
  auburn: [0xb8583a, 0x924126, 0x6c2e1a],
  red: [0xe8643c, 0xc8462a, 0x9a301e],
  gray: [0xd2d2d6, 0xa9a9b1, 0x7e7e88],
  blue: [0x6fa8f0, 0x3f7fd9, 0x2a59a8],
};

/** One ramp per clothing item ID; every item's sheet carries PH cloth. */
export const CLOTH_RAMPS: Record<TopItem | BottomItem | ShoesItem, Ramp> = {
  'starter-tee-red': [0xf2685e, 0xd93b3b, 0xa82a32],
  'starter-tee-blue': [0x6aa9f2, 0x3b7dd9, 0x2a5aa8],
  'starter-tee-green': [0x7ed37a, 0x46a84a, 0x2f7a3a],
  'starter-shorts-navy': [0x4a5c8c, 0x2f3e6b, 0x1f2848],
  'starter-shorts-black': [0x5a5a66, 0x3a3a44, 0x24242c],
  'starter-shorts-gray': [0xb4b4bc, 0x8e8e98, 0x6a6a74],
  'starter-shoes-white': [0xf8f8f4, 0xe2e2da, 0xb8b8b0],
  'starter-shoes-black': [0x4e4e58, 0x2e2e36, 0x1a1a20],
  'starter-shoes-red': [0xf06a5a, 0xd63a34, 0xa0262a],
};

/** The ramp's base shade as a CSS color, for picker swatches. */
export function rampToCss(ramp: Ramp): string {
  return `#${ramp[1].toString(16).padStart(6, '0')}`;
}
```

- [ ] **Step 9: Run the palette test and watch it pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/palette.test.ts
```

Expected: PASS, `Test Files  1 passed (1)`, `Tests  75 passed (75)`. That is 2 placeholder tests, 1 coverage test, 3 checks for each of the 23 target ramps, 1 skin-order test and 2 `rampToCss` tests.

- [ ] **Step 10: Typecheck and lint**

```bash
pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint
```

Expected: both exit 0 and print no errors or warnings.

- [ ] **Step 11: Commit swap keys and palette**

```bash
git add apps/web/src/features/avatar/swap.ts apps/web/src/features/avatar/palette.ts apps/web/src/features/avatar/__tests__/swap.test.ts apps/web/src/features/avatar/__tests__/palette.test.ts
git commit -F - <<'EOF'
Add avatar palette swap keys and color ramps

Ramp and Swap types with buildSwap and swapKey for the runtime palette
swap, plus PLACEHOLDER_RAMPS and the skin, hair and clothing target ramps.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 12: Write the failing catalog test**

Create `apps/web/src/features/avatar/__tests__/catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  BottomItemSchema,
  HairColorSchema,
  HairStyleSchema,
  ShoesItemSchema,
  SkinToneSchema,
  TopItemSchema,
} from '@tracks/types';
import {
  AVATAR_SHEET_IDS,
  BODY_SHEET,
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from '../catalog.js';
import type { Option } from '../catalog.js';

const GROUPS: ReadonlyArray<readonly [string, readonly string[], Record<string, Option>]> = [
  ['skin tone', SkinToneSchema.options, SKIN_TONE_OPTIONS],
  ['hair style', HairStyleSchema.options, HAIR_STYLE_OPTIONS],
  ['hair color', HairColorSchema.options, HAIR_COLOR_OPTIONS],
  ['top', TopItemSchema.options, TOP_OPTIONS],
  ['bottom', BottomItemSchema.options, BOTTOM_OPTIONS],
  ['shoes', ShoesItemSchema.options, SHOES_OPTIONS],
];

describe('catalog option sets', () => {
  it.each(GROUPS)('%s has exactly one entry per enum value', (_name, ids, options) => {
    expect(Object.keys(options).sort()).toEqual([...ids].sort());
  });

  it.each(GROUPS)('every %s option has a non-empty label', (_name, ids, options) => {
    for (const id of ids) {
      const label = options[id]?.label ?? '';
      expect(label.trim().length, id).toBeGreaterThan(0);
    }
  });

  it.each(GROUPS)('%s labels are unique within the group', (_name, _ids, options) => {
    const labels = Object.values(options).map((option) => option.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('uses the display labels the creator and describeAppearance rely on', () => {
    expect(SKIN_TONE_OPTIONS['tone-1'].label).toBe('Tone 1');
    expect(SKIN_TONE_OPTIONS['tone-6'].label).toBe('Tone 6');
    expect(HAIR_STYLE_OPTIONS.short.label).toBe('Short');
    expect(HAIR_STYLE_OPTIONS.curly.label).toBe('Curly');
    expect(HAIR_STYLE_OPTIONS.ponytail.label).toBe('Ponytail');
    expect(HAIR_COLOR_OPTIONS.black.label).toBe('Black');
    expect(HAIR_COLOR_OPTIONS['dark-brown'].label).toBe('Dark brown');
    expect(TOP_OPTIONS['starter-tee-red'].label).toBe('Red tee');
    expect(BOTTOM_OPTIONS['starter-shorts-navy'].label).toBe('Navy shorts');
    expect(SHOES_OPTIONS['starter-shoes-white'].label).toBe('White shoes');
  });
});

describe('catalog sheets', () => {
  it('gives each hair style its own sheet', () => {
    expect(HAIR_STYLE_OPTIONS.short.sheet).toBe('hair-short');
    expect(HAIR_STYLE_OPTIONS.curly.sheet).toBe('hair-curly');
    expect(HAIR_STYLE_OPTIONS.ponytail.sheet).toBe('hair-ponytail');
  });

  it('maps every starter clothing color to its one shared base sprite', () => {
    for (const option of Object.values(TOP_OPTIONS)) {
      expect(option.sheet).toBe('top-starter-tee');
    }
    for (const option of Object.values(BOTTOM_OPTIONS)) {
      expect(option.sheet).toBe('bottom-starter-shorts');
    }
    for (const option of Object.values(SHOES_OPTIONS)) {
      expect(option.sheet).toBe('shoes-starter');
    }
  });

  it('names the body sheet', () => {
    expect(BODY_SHEET).toBe('body');
  });

  it('lists body plus every distinct hair and clothing sheet once', () => {
    expect(AVATAR_SHEET_IDS).toEqual([
      'body',
      'hair-short',
      'hair-curly',
      'hair-ponytail',
      'top-starter-tee',
      'bottom-starter-shorts',
      'shoes-starter',
    ]);
  });
});
```

- [ ] **Step 13: Run the catalog test and watch it fail**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/catalog.test.ts
```

Expected: FAIL, with
`Error: Failed to resolve import "../catalog.js" from "src/features/avatar/__tests__/catalog.test.ts". Does the file exist?` and `Test Files  1 failed (1)`.

- [ ] **Step 14: Implement catalog.ts**

Create `apps/web/src/features/avatar/catalog.ts`:

```ts
import type {
  BottomItem,
  HairColor,
  HairStyle,
  ShoesItem,
  SkinTone,
  TopItem,
} from '@tracks/types';

/** Display data for one catalog ID. */
export interface Option {
  label: string;
}

// Sheet IDs are export basenames: apps/web/src/assets/sprites/<id>.json and <id>.png.

export const SKIN_TONE_OPTIONS: Record<SkinTone, Option> = {
  'tone-1': { label: 'Tone 1' },
  'tone-2': { label: 'Tone 2' },
  'tone-3': { label: 'Tone 3' },
  'tone-4': { label: 'Tone 4' },
  'tone-5': { label: 'Tone 5' },
  'tone-6': { label: 'Tone 6' },
};

export const HAIR_STYLE_OPTIONS: Record<HairStyle, Option & { sheet: string }> = {
  short: { label: 'Short', sheet: 'hair-short' },
  curly: { label: 'Curly', sheet: 'hair-curly' },
  ponytail: { label: 'Ponytail', sheet: 'hair-ponytail' },
};

export const HAIR_COLOR_OPTIONS: Record<HairColor, Option> = {
  black: { label: 'Black' },
  'dark-brown': { label: 'Dark brown' },
  'light-brown': { label: 'Light brown' },
  blonde: { label: 'Blonde' },
  auburn: { label: 'Auburn' },
  red: { label: 'Red' },
  gray: { label: 'Gray' },
  blue: { label: 'Blue' },
};

export const TOP_OPTIONS: Record<TopItem, Option & { sheet: string }> = {
  'starter-tee-red': { label: 'Red tee', sheet: 'top-starter-tee' },
  'starter-tee-blue': { label: 'Blue tee', sheet: 'top-starter-tee' },
  'starter-tee-green': { label: 'Green tee', sheet: 'top-starter-tee' },
};

export const BOTTOM_OPTIONS: Record<BottomItem, Option & { sheet: string }> = {
  'starter-shorts-navy': { label: 'Navy shorts', sheet: 'bottom-starter-shorts' },
  'starter-shorts-black': { label: 'Black shorts', sheet: 'bottom-starter-shorts' },
  'starter-shorts-gray': { label: 'Gray shorts', sheet: 'bottom-starter-shorts' },
};

export const SHOES_OPTIONS: Record<ShoesItem, Option & { sheet: string }> = {
  'starter-shoes-white': { label: 'White shoes', sheet: 'shoes-starter' },
  'starter-shoes-black': { label: 'Black shoes', sheet: 'shoes-starter' },
  'starter-shoes-red': { label: 'Red shoes', sheet: 'shoes-starter' },
};

export const BODY_SHEET = 'body';

/** Every avatar sheet, each once: body, then hair, top, bottom and shoes sheets. */
export const AVATAR_SHEET_IDS: readonly string[] = [
  ...new Set([
    BODY_SHEET,
    ...Object.values(HAIR_STYLE_OPTIONS).map((option) => option.sheet),
    ...Object.values(TOP_OPTIONS).map((option) => option.sheet),
    ...Object.values(BOTTOM_OPTIONS).map((option) => option.sheet),
    ...Object.values(SHOES_OPTIONS).map((option) => option.sheet),
  ]),
];
```

- [ ] **Step 15: Run the catalog test and watch it pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/catalog.test.ts
```

Expected: PASS, `Test Files  1 passed (1)`, `Tests  23 passed (23)`.

- [ ] **Step 16: Write the failing appearance test**

Create `apps/web/src/features/avatar/__tests__/appearance.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  AvatarAppearanceSchema,
  BottomItemSchema,
  HairColorSchema,
  HairStyleSchema,
  ShoesItemSchema,
  SkinToneSchema,
  TopItemSchema,
} from '@tracks/types';
import type { AvatarAppearance } from '@tracks/types';
import { DEFAULT_APPEARANCE, describeAppearance, randomAppearance } from '../appearance.js';

describe('DEFAULT_APPEARANCE', () => {
  it('parses with AvatarAppearanceSchema', () => {
    expect(AvatarAppearanceSchema.parse(DEFAULT_APPEARANCE)).toEqual(DEFAULT_APPEARANCE);
  });

  it('uses the first value of each enum', () => {
    expect(DEFAULT_APPEARANCE).toEqual({
      skin_tone: SkinToneSchema.options[0],
      hair_style: HairStyleSchema.options[0],
      hair_color: HairColorSchema.options[0],
      top: TopItemSchema.options[0],
      bottom: BottomItemSchema.options[0],
      shoes: ShoesItemSchema.options[0],
    });
  });
});

describe('describeAppearance', () => {
  it('describes the default appearance from catalog labels', () => {
    expect(describeAppearance(DEFAULT_APPEARANCE)).toBe(
      'Your athlete: tone 1 skin, short black hair, red tee, navy shorts, white shoes',
    );
  });

  it('lowercases multi-word labels', () => {
    const appearance: AvatarAppearance = {
      skin_tone: 'tone-3',
      hair_style: 'curly',
      hair_color: 'dark-brown',
      top: 'starter-tee-green',
      bottom: 'starter-shorts-gray',
      shoes: 'starter-shoes-red',
    };
    expect(describeAppearance(appearance)).toBe(
      'Your athlete: tone 3 skin, curly dark brown hair, green tee, gray shorts, red shoes',
    );
  });
});

describe('randomAppearance', () => {
  it('picks the first option of every field when rng returns 0', () => {
    expect(randomAppearance(() => 0)).toEqual(DEFAULT_APPEARANCE);
  });

  it('picks the last option of every field when rng returns 0.999', () => {
    expect(randomAppearance(() => 0.999)).toEqual({
      skin_tone: 'tone-6',
      hair_style: 'ponytail',
      hair_color: 'blue',
      top: 'starter-tee-green',
      bottom: 'starter-shorts-gray',
      shoes: 'starter-shoes-red',
    });
  });

  it('draws each field independently, once, in schema field order', () => {
    const values = [0, 0.999, 0, 0.999, 0, 0.999];
    const rng = vi.fn(() => values.shift() ?? 0);
    expect(randomAppearance(rng)).toEqual({
      skin_tone: 'tone-1',
      hair_style: 'ponytail',
      hair_color: 'black',
      top: 'starter-tee-green',
      bottom: 'starter-shorts-navy',
      shoes: 'starter-shoes-red',
    });
    expect(rng).toHaveBeenCalledTimes(6);
  });

  it('maps rng into uniform buckets: floor(rng() * n)', () => {
    expect(randomAppearance(() => 0.5)).toEqual({
      skin_tone: 'tone-4',
      hair_style: 'curly',
      hair_color: 'auburn',
      top: 'starter-tee-blue',
      bottom: 'starter-shorts-black',
      shoes: 'starter-shoes-black',
    });
  });

  it('always returns a valid appearance for rng values in [0, 1)', () => {
    for (const r of [0, 0.1, 0.25, 0.33, 0.5, 0.66, 0.75, 0.9, 0.999]) {
      expect(AvatarAppearanceSchema.safeParse(randomAppearance(() => r)).success).toBe(true);
    }
  });

  it('throws when rng returns a value outside [0, 1)', () => {
    expect(() => randomAppearance(() => 1)).toThrow('rng() must return a value in [0, 1)');
  });
});
```

- [ ] **Step 17: Run the appearance test and watch it fail**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/appearance.test.ts
```

Expected: FAIL, with
`Error: Failed to resolve import "../appearance.js" from "src/features/avatar/__tests__/appearance.test.ts". Does the file exist?` and `Test Files  1 failed (1)`.

- [ ] **Step 18: Implement appearance.ts**

Create `apps/web/src/features/avatar/appearance.ts`:

```ts
import {
  BottomItemSchema,
  HairColorSchema,
  HairStyleSchema,
  ShoesItemSchema,
  SkinToneSchema,
  TopItemSchema,
} from '@tracks/types';
import type { AvatarAppearance } from '@tracks/types';
import {
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from './catalog.js';

/** The first value of each catalog enum: a new player's starting look. */
export const DEFAULT_APPEARANCE = {
  skin_tone: 'tone-1',
  hair_style: 'short',
  hair_color: 'black',
  top: 'starter-tee-red',
  bottom: 'starter-shorts-navy',
  shoes: 'starter-shoes-white',
} as const satisfies AvatarAppearance;

/** Accessible description built from catalog labels, used as the canvas aria-label. */
export function describeAppearance(appearance: AvatarAppearance): string {
  const skin = SKIN_TONE_OPTIONS[appearance.skin_tone].label.toLowerCase();
  const style = HAIR_STYLE_OPTIONS[appearance.hair_style].label.toLowerCase();
  const color = HAIR_COLOR_OPTIONS[appearance.hair_color].label.toLowerCase();
  const top = TOP_OPTIONS[appearance.top].label.toLowerCase();
  const bottom = BOTTOM_OPTIONS[appearance.bottom].label.toLowerCase();
  const shoes = SHOES_OPTIONS[appearance.shoes].label.toLowerCase();
  return `Your athlete: ${skin} skin, ${style} ${color} hair, ${top}, ${bottom}, ${shoes}`;
}

function pick<T extends string>(options: readonly T[], rng: () => number): T {
  const value = rng();
  const choice = options[Math.floor(value * options.length)];
  if (choice === undefined) {
    throw new Error(`rng() must return a value in [0, 1), got ${value}`);
  }
  return choice;
}

/**
 * Picks each field independently and uniformly from its enum, calling `rng`
 * once per field in schema order. `rng` returns values in [0, 1).
 */
export function randomAppearance(rng: () => number): AvatarAppearance {
  return {
    skin_tone: pick(SkinToneSchema.options, rng),
    hair_style: pick(HairStyleSchema.options, rng),
    hair_color: pick(HairColorSchema.options, rng),
    top: pick(TopItemSchema.options, rng),
    bottom: pick(BottomItemSchema.options, rng),
    shoes: pick(ShoesItemSchema.options, rng),
  };
}
```

- [ ] **Step 19: Run the appearance test and watch it pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/appearance.test.ts
```

Expected: PASS, `Test Files  1 passed (1)`, `Tests  10 passed (10)`.

- [ ] **Step 20: Verify the whole task: its four test files, the full web suite, typecheck and lint**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/swap.test.ts src/features/avatar/__tests__/palette.test.ts src/features/avatar/__tests__/catalog.test.ts src/features/avatar/__tests__/appearance.test.ts
pnpm --filter @tracks/web test
pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint
```

Expected:
- The first command prints `Test Files  4 passed (4)` and `Tests  116 passed (116)`.
- `pnpm --filter @tracks/web test` reports every test file passed and prints no console errors or warnings.
- typecheck and lint both exit 0 with no output errors.

- [ ] **Step 21: Commit the catalog and appearance helpers**

```bash
git add apps/web/src/features/avatar/catalog.ts apps/web/src/features/avatar/appearance.ts apps/web/src/features/avatar/__tests__/catalog.test.ts apps/web/src/features/avatar/__tests__/appearance.test.ts
git commit -F - <<'EOF'
Add avatar catalog labels and appearance helpers

One labeled entry per catalog ID, with base sprite sheets for hair and
clothing, plus DEFAULT_APPEARANCE, describeAppearance for the canvas
accessible name, and randomAppearance for the creator's Randomize.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

---

### Task 6: Web sprite core: sheet parsing, swapPixels, frames, fitScale, drawList

**Files:**
- Create: `apps/web/src/features/avatar/fitScale.ts`
- Modify: `apps/web/src/features/avatar/swap.ts` (Task 5's file, which ends with `swapKey`. Append `swapPixels` at the end of the file and leave `Ramp`, `Swap`, `buildSwap` and `swapKey` unchanged)
- Create: `apps/web/src/features/avatar/sheets.ts` (Task 5 does not create this file)
- Create: `apps/web/src/features/avatar/frames.ts`
- Create: `apps/web/src/features/avatar/layers.ts`
- Create (test helper, not a test file): `apps/web/src/features/avatar/__tests__/fixtures.ts`
- Test: `apps/web/src/features/avatar/__tests__/fitScale.test.ts`
- Test: `apps/web/src/features/avatar/__tests__/swapPixels.test.ts` (a separate file, so Task 5's existing `swap.test.ts` is left alone)
- Test: `apps/web/src/features/avatar/__tests__/sheets.test.ts`
- Test: `apps/web/src/features/avatar/__tests__/frames.test.ts`
- Test: `apps/web/src/features/avatar/__tests__/layers.test.ts`

**Interfaces:**
Consumes:
- `@tracks/types`: `type AvatarAppearance`
- `./swap.js` (Task 5): `type Ramp`, `type Swap = ReadonlyMap<number, number>`, `buildSwap(from: Ramp, to: Ramp): Swap`, `swapKey(swap: Swap | null): string`. Task 5 also created `__tests__/swap.test.ts`.
- `./palette.js` (Task 5): `PLACEHOLDER_RAMPS`, `SKIN_RAMPS`, `HAIR_RAMPS`, `CLOTH_RAMPS`
- `./catalog.js` (Task 5): `BODY_SHEET`, `HAIR_STYLE_OPTIONS`, `TOP_OPTIONS`, `BOTTOM_OPTIONS`, `SHOES_OPTIONS`. Each entry has `.sheet`. Task 5 types it as `string`, which is identical to `SheetId`, so catalog.ts needs no change.
- `zod` (already a web dependency)

Produces:
- `swap.ts`: `swapPixels(rgba: Uint8ClampedArray, swap: Swap): Uint8ClampedArray<ArrayBuffer>`. This is a narrower type than the contract's `Uint8ClampedArray` and is assignable to it. TS 6 needs the narrowing because `new ImageData(data, w, h)` requires `ImageDataArray = Uint8ClampedArray<ArrayBuffer>`. Only fully opaque pixels (alpha 255) are remapped.
- `fitScale.ts`: `fitScale(availW: number, availH: number, dpr: number, w: number, h: number): number`
- `sheets.ts`:
  - `type SheetId = string`
  - `interface SheetFrame { x; y; w; h; duration }`
  - `interface SheetTag { name; from; to; direction }`
  - `interface SheetSlice { name; x; y; w; h; pivot: { x: number; y: number } | null }`
  - `interface SheetData { id; imageUrl; frames; tags; slices }`
  - `parseSheet(id: SheetId, json: unknown, imageUrl: string): SheetData`
  - `SHEETS: ReadonlyMap<SheetId, SheetData>`
  - `getSheet(id: SheetId, registry?: ReadonlyMap<SheetId, SheetData>): SheetData`
  - Also `buildRegistry(jsonModules: Record<string, unknown>, pngUrls: Record<string, string>): ReadonlyMap<SheetId, SheetData>`. This export is not in the contract. It exists so the JSON/PNG basename pairing and the missing-PNG error can be unit-tested without real exports. `SHEETS = buildRegistry(globbed json, globbed png)`. Later tasks use `SHEETS`/`getSheet` and must not depend on it.
- `frames.ts`:
  - `type AnimationTag = 'front-idle' | 'turn' | 'side-run'`
  - `interface TagFrame { index: number; duration: number }`
  - `tagFrames(sheet: SheetData, tag: string): TagFrame[]`
  - `loopLength(frames: TagFrame[]): number`
  - `frameAt(frames: TagFrame[], msInState: number): number`
- `layers.ts`:
  - `interface DrawItem { sheet: SheetId; swap: Swap; rect: SheetFrame }`
  - `drawList(appearance: AvatarAppearance, tag: AnimationTag, frameOffset: number, registry?: ReadonlyMap<SheetId, SheetData>): DrawItem[]`
- `__tests__/fixtures.ts` (test helper that later tasks reuse):
  - `asepriteJson(name, spec): unknown`
  - `fixtureSheet(id, spec): SheetData`
  - `registryOf(...sheets): ReadonlyMap<SheetId, SheetData>`
  - `avatarSheet(id, pad?): SheetData`
  - `AVATAR_DURATIONS`, `AVATAR_TAGS`, `FIXTURE_REGISTRY`
  - the `FixtureRect`/`FixtureTag`/`FixtureSlice`/`FixtureSheetSpec` interfaces
- Every error message starts with `Sprite sheet "<id>"`

---

- [ ] **Step 1: Write the failing fitScale test**

Create `apps/web/src/features/avatar/__tests__/fitScale.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fitScale } from '../fitScale.js';

describe('fitScale', () => {
  it('fits the 180x120 room on an iPhone SE stage at DPR 2', () => {
    expect(fitScale(375, 551, 2, 180, 120)).toBe(4);
  });

  it('fits the room on a Pixel 7 stage at fractional DPR 2.625', () => {
    expect(fitScale(412, 715, 2.625, 180, 120)).toBe(6);
  });

  it('never goes below 1 when the stage is narrower than the art', () => {
    expect(fitScale(179, 500, 1, 180, 120)).toBe(1);
  });

  it('fits the room on an iPhone 14 stage at DPR 3', () => {
    expect(fitScale(390, 600, 3, 180, 120)).toBe(6);
  });

  it('is limited by height when the stage is short', () => {
    expect(fitScale(1024, 300, 1, 180, 120)).toBe(2);
  });

  it('scales the 64x64 avatar cell in device pixels', () => {
    expect(fitScale(200, 200, 3, 64, 64)).toBe(9);
  });

  it('returns 1 for an empty container', () => {
    expect(fitScale(0, 0, 2, 180, 120)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/fitScale.test.ts
```

Expected: FAIL with `Error: Failed to resolve import "../fitScale.js" from "src/features/avatar/__tests__/fitScale.test.ts". Does the file exist?` and `Tests  no tests`.

- [ ] **Step 3: Implement fitScale**

Create `apps/web/src/features/avatar/fitScale.ts`:

```ts
/**
 * Device pixels per art pixel for a w×h native canvas inside an
 * availW×availH CSS content box: the largest whole number that fits, never
 * below 1. Each art pixel is then exactly k device pixels, including on
 * fractional-DPR phones (Pixel 7 at 2.625).
 */
export function fitScale(
  availW: number,
  availH: number,
  dpr: number,
  w: number,
  h: number,
): number {
  return Math.max(1, Math.floor(Math.min((availW * dpr) / w, (availH * dpr) / h)));
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/fitScale.test.ts
```

Expected: `Test Files  1 passed (1)`, `Tests  7 passed (7)`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/avatar/fitScale.ts apps/web/src/features/avatar/__tests__/fitScale.test.ts
git commit -F - <<'EOF'
feat(web): add fitScale for integer device-pixel canvas scaling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 6: Write the failing swapPixels test**

Create `apps/web/src/features/avatar/__tests__/swapPixels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSwap, swapPixels } from '../swap.js';

const FROM = [0xff80ff, 0xff40ff, 0xff00ff] as const;
const TO = [0x112233, 0x445566, 0x778899] as const;
const SWAP = buildSwap(FROM, TO);

function pixels(...rgba: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(rgba.flat());
}

describe('swapPixels', () => {
  it('maps each opaque placeholder pixel to its target shade', () => {
    const input = pixels(
      [0xff, 0x80, 0xff, 255],
      [0xff, 0x40, 0xff, 255],
      [0xff, 0x00, 0xff, 255],
    );
    expect(Array.from(swapPixels(input, SWAP))).toEqual([
      0x11, 0x22, 0x33, 255,
      0x44, 0x55, 0x66, 255,
      0x77, 0x88, 0x99, 255,
    ]);
  });

  it('leaves colors that are not in the swap unchanged', () => {
    const input = pixels([0x1a, 0x1c, 0x2c, 255], [0xff, 0x40, 0xfe, 255]);
    expect(Array.from(swapPixels(input, SWAP))).toEqual([
      0x1a, 0x1c, 0x2c, 255,
      0xff, 0x40, 0xfe, 255,
    ]);
  });

  it('leaves fully transparent pixels untouched, even with a placeholder RGB', () => {
    const input = pixels([0xff, 0x40, 0xff, 0], [0, 0, 0, 0]);
    expect(Array.from(swapPixels(input, SWAP))).toEqual([0xff, 0x40, 0xff, 0, 0, 0, 0, 0]);
  });

  it('maps only fully opaque pixels and never changes alpha', () => {
    const input = pixels([0xff, 0x40, 0xff, 128], [0xff, 0x00, 0xff, 255]);
    expect(Array.from(swapPixels(input, SWAP))).toEqual([
      0xff, 0x40, 0xff, 128,
      0x77, 0x88, 0x99, 255,
    ]);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = pixels([0xff, 0x40, 0xff, 255]);
    const out = swapPixels(input, SWAP);
    expect(out).not.toBe(input);
    expect(out).toBeInstanceOf(Uint8ClampedArray);
    expect(Array.from(input)).toEqual([0xff, 0x40, 0xff, 255]);
  });

  it('copies the buffer unchanged with an empty swap', () => {
    const input = pixels([0xff, 0x40, 0xff, 255], [1, 2, 3, 0]);
    const out = swapPixels(input, new Map<number, number>());
    expect(out).not.toBe(input);
    expect(Array.from(out)).toEqual(Array.from(input));
  });
});
```

- [ ] **Step 7: Run it and watch it fail**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/swapPixels.test.ts
```

Expected: FAIL, `Test Files  1 failed (1)`, `Tests  6 failed (6)`. Each test fails with `TypeError: swapPixels is not a function`.

- [ ] **Step 8: Implement swapPixels**

Append this to the end of `apps/web/src/features/avatar/swap.ts`, after `swapKey`, and leave everything above it unchanged:

```ts

/**
 * Returns a recolored copy of an RGBA buffer (ImageData layout). Every fully
 * opaque pixel (alpha 255) has its packed 0xRRGGBB looked up in `swap` and
 * replaced when found; other pixels are copied as-is. Alpha is never changed
 * and the input is not mutated. The result is ArrayBuffer-backed, so it can go
 * straight into `new ImageData(result, w, h)`.
 */
export function swapPixels(rgba: Uint8ClampedArray, swap: Swap): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(rgba);
  if (swap.size === 0) return out;
  for (let i = 0; i + 3 < out.length; i += 4) {
    if (out[i + 3] !== 255) continue;
    const rgb = ((out[i] ?? 0) << 16) | ((out[i + 1] ?? 0) << 8) | (out[i + 2] ?? 0);
    const to = swap.get(rgb);
    if (to === undefined) continue;
    out[i] = (to >> 16) & 0xff;
    out[i + 1] = (to >> 8) & 0xff;
    out[i + 2] = to & 0xff;
  }
  return out;
}
```

- [ ] **Step 9: Run it together with Task 5's swap tests and watch both pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/swapPixels.test.ts src/features/avatar/__tests__/swap.test.ts
```

Expected: `Test Files  2 passed (2)`. swapPixels.test.ts has 6 passing tests. Task 5's swap.test.ts (8 tests in its current form) still passes, for `Tests  14 passed (14)`.

- [ ] **Step 10: Typecheck and lint**

```bash
pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint
```

Expected: both commands exit 0 with no errors or warnings.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/features/avatar/swap.ts apps/web/src/features/avatar/__tests__/swapPixels.test.ts
git commit -F - <<'EOF'
feat(web): add pure swapPixels palette swap over RGBA buffers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 12: Write the failing sheets test**

Create `apps/web/src/features/avatar/__tests__/sheets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRegistry, getSheet, parseSheet, SHEETS } from '../sheets.js';

// Hand-written in the shape of `aseprite --batch --format json-array --list-tags --list-slices`.
// Frame 1 sits BELOW frame 0 (y: 64), so a parser that computed rects from the
// frame index (i * 64) instead of reading frames[i].frame would fail.
const EXPORT = {
  frames: [
    {
      filename: 'treadmill 0.aseprite',
      frame: { x: 0, y: 0, w: 64, h: 64 },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
      sourceSize: { w: 64, h: 64 },
      duration: 120,
    },
    {
      filename: 'treadmill 1.aseprite',
      frame: { x: 0, y: 64, w: 64, h: 64 },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
      sourceSize: { w: 64, h: 64 },
      duration: 80,
    },
  ],
  meta: {
    app: 'https://www.aseprite.org/',
    version: '1.3.18.6-x64',
    image: 'treadmill.png',
    format: 'RGBA8888',
    size: { w: 64, h: 128 },
    scale: '1',
    frameTags: [
      { name: 'belt', from: 0, to: 1, direction: 'forward', color: '#000000ff' },
    ],
    slices: [
      {
        name: 'rider',
        color: '#0000ffff',
        keys: [{ frame: 0, bounds: { x: 20, y: 10, w: 16, h: 30 }, pivot: { x: 8, y: 29 } }],
      },
      {
        name: 'console',
        color: '#0000ffff',
        keys: [{ frame: 0, bounds: { x: 50, y: 4, w: 10, h: 20 } }],
      },
    ],
  },
};

describe('parseSheet', () => {
  it('keeps the id and image url', () => {
    const sheet = parseSheet('treadmill', EXPORT, '/assets/treadmill.png');
    expect(sheet.id).toBe('treadmill');
    expect(sheet.imageUrl).toBe('/assets/treadmill.png');
  });

  it('reads source rects from frames[i].frame and durations from frames[i].duration', () => {
    expect(parseSheet('treadmill', EXPORT, '/t.png').frames).toEqual([
      { x: 0, y: 0, w: 64, h: 64, duration: 120 },
      { x: 0, y: 64, w: 64, h: 64, duration: 80 },
    ]);
  });

  it('reads 0-based tag ranges from meta.frameTags', () => {
    expect(parseSheet('treadmill', EXPORT, '/t.png').tags).toEqual([
      { name: 'belt', from: 0, to: 1, direction: 'forward' },
    ]);
  });

  it('reads slice bounds and pivot from keys[0], with a null pivot when absent', () => {
    expect(parseSheet('treadmill', EXPORT, '/t.png').slices).toEqual([
      { name: 'rider', x: 20, y: 10, w: 16, h: 30, pivot: { x: 8, y: 29 } },
      { name: 'console', x: 50, y: 4, w: 10, h: 20, pivot: null },
    ]);
  });

  it('treats missing frameTags and slices as empty', () => {
    const sheet = parseSheet('plain', { frames: EXPORT.frames, meta: { image: 'plain.png' } }, '/p.png');
    expect(sheet.tags).toEqual([]);
    expect(sheet.slices).toEqual([]);
  });

  it('rejects a json-hash export, naming the sheet', () => {
    const hash = { frames: { 'treadmill 0.aseprite': EXPORT.frames[0] }, meta: EXPORT.meta };
    expect(() => parseSheet('treadmill', hash, '/t.png')).toThrow('Sprite sheet "treadmill"');
  });

  it('rejects an export with no frames, naming the sheet', () => {
    expect(() => parseSheet('empty', { frames: [], meta: {} }, '/e.png')).toThrow(
      'Sprite sheet "empty"',
    );
  });
});

describe('getSheet', () => {
  const registry = new Map([['treadmill', parseSheet('treadmill', EXPORT, '/t.png')]]);

  it('returns the sheet from the given registry', () => {
    expect(getSheet('treadmill', registry).frames).toHaveLength(2);
  });

  it('throws an error naming a missing id', () => {
    expect(() => getSheet('trophy-gold', registry)).toThrow('"trophy-gold"');
  });
});

describe('buildRegistry', () => {
  it('pairs each JSON export with the PNG of the same basename', () => {
    const registry = buildRegistry(
      { '../../assets/sprites/treadmill.json': EXPORT },
      { '../../assets/sprites/treadmill.png': '/assets/treadmill-abc123.png' },
    );
    expect([...registry.keys()]).toEqual(['treadmill']);
    expect(getSheet('treadmill', registry).imageUrl).toBe('/assets/treadmill-abc123.png');
  });

  it('throws when a JSON export has no matching PNG', () => {
    expect(() => buildRegistry({ '../../assets/sprites/treadmill.json': EXPORT }, {})).toThrow(
      'Sprite sheet "treadmill"',
    );
  });
});

describe('SHEETS', () => {
  it('holds every committed export, keyed by its own id', () => {
    expect(SHEETS).toBeInstanceOf(Map);
    for (const [id, sheet] of SHEETS) {
      expect(sheet.id).toBe(id);
      expect(sheet.frames.length).toBeGreaterThan(0);
      expect(sheet.imageUrl).not.toBe('');
    }
  });
});
```

- [ ] **Step 13: Run it and watch it fail**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/sheets.test.ts
```

Expected: `FAIL  src/features/avatar/__tests__/sheets.test.ts [ src/features/avatar/__tests__/sheets.test.ts ]` with `Error: Failed to resolve import "../sheets.js" from "src/features/avatar/__tests__/sheets.test.ts". Does the file exist?`, `Test Files  1 failed (1)` and `Tests  no tests`.

- [ ] **Step 14: Implement sheets.ts**

Create `apps/web/src/features/avatar/sheets.ts`:

```ts
import { z } from 'zod';

/** An export's basename in src/assets/sprites/, e.g. 'body', 'hair-short', 'treadmill'. */
export type SheetId = string;

/** A frame's source rect in the sheet PNG plus its duration in ms. */
export interface SheetFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  duration: number;
}

/** A 0-based, inclusive frame range from meta.frameTags. */
export interface SheetTag {
  name: string;
  from: number;
  to: number;
  direction: string;
}

/** A slice's sprite-local bounds; the pivot is relative to the slice's top-left. */
export interface SheetSlice {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pivot: { x: number; y: number } | null;
}

export interface SheetData {
  id: SheetId;
  imageUrl: string;
  frames: SheetFrame[];
  tags: SheetTag[];
  slices: SheetSlice[];
}

const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const SliceKeySchema = z.object({
  bounds: RectSchema,
  pivot: z.object({ x: z.number(), y: z.number() }).optional(),
});

/** The parts of Aseprite's `--format json-array --list-tags --list-slices` output the app reads. */
const AsepriteExportSchema = z.object({
  frames: z
    .array(z.object({ frame: RectSchema, duration: z.number().nonnegative() }))
    .min(1),
  meta: z.object({
    frameTags: z
      .array(
        z.object({
          name: z.string(),
          from: z.number().int().nonnegative(),
          to: z.number().int().nonnegative(),
          direction: z.string(),
        }),
      )
      .default([]),
    slices: z
      .array(
        z.object({
          name: z.string(),
          keys: z.tuple([SliceKeySchema], SliceKeySchema),
        }),
      )
      .default([]),
  }),
});

/**
 * Reads an Aseprite json-array export. Source rects come from frames[i].frame
 * (never from the frame index), durations from frames[i].duration, tag ranges
 * from meta.frameTags and slices from meta.slices[].keys[0].
 */
export function parseSheet(id: SheetId, json: unknown, imageUrl: string): SheetData {
  const parsed = AsepriteExportSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Sprite sheet "${id}" is not a valid Aseprite json-array export: ${z.prettifyError(parsed.error)}`,
    );
  }
  const { frames, meta } = parsed.data;
  return {
    id,
    imageUrl,
    frames: frames.map(({ frame, duration }) => ({
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
      duration,
    })),
    tags: meta.frameTags.map(({ name, from, to, direction }) => ({ name, from, to, direction })),
    slices: meta.slices.map(({ name, keys: [{ bounds, pivot }] }) => ({
      name,
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      pivot: pivot ? { x: pivot.x, y: pivot.y } : null,
    })),
  };
}

function basename(path: string, ext: string): string {
  const file = path.slice(path.lastIndexOf('/') + 1);
  return file.endsWith(ext) ? file.slice(0, -ext.length) : file;
}

/**
 * Pairs each `<name>.json` module with the `<name>.png` URL of the same
 * basename. Keys are import.meta.glob paths. SHEETS is built with this; it is
 * exported only so the pairing can be unit-tested without real exports.
 */
export function buildRegistry(
  jsonModules: Record<string, unknown>,
  pngUrls: Record<string, string>,
): ReadonlyMap<SheetId, SheetData> {
  const urls = new Map<string, string>();
  for (const [path, url] of Object.entries(pngUrls)) {
    urls.set(basename(path, '.png'), url);
  }
  const registry = new Map<SheetId, SheetData>();
  for (const [path, json] of Object.entries(jsonModules)) {
    const id = basename(path, '.json');
    const url = urls.get(id);
    if (url === undefined) {
      throw new Error(`Sprite sheet "${id}" has a JSON export but no ${id}.png next to it`);
    }
    registry.set(id, parseSheet(id, json, url));
  }
  return registry;
}

const jsonModules = import.meta.glob<unknown>('../../assets/sprites/*.json', {
  eager: true,
  import: 'default',
});
const pngUrls = import.meta.glob<string>('../../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Every committed export in src/assets/sprites/, keyed by basename. */
export const SHEETS: ReadonlyMap<SheetId, SheetData> = buildRegistry(jsonModules, pngUrls);

export function getSheet(
  id: SheetId,
  registry: ReadonlyMap<SheetId, SheetData> = SHEETS,
): SheetData {
  const sheet = registry.get(id);
  if (!sheet) {
    throw new Error(
      `Sprite sheet "${id}" is not exported (expected src/assets/sprites/${id}.json and ${id}.png)`,
    );
  }
  return sheet;
}
```

(`import.meta.glob` returns `{}` while `src/assets/sprites/` is missing or empty. It does not exist yet, so `SHEETS` starts out as an empty Map.)

- [ ] **Step 15: Run it and watch it pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/sheets.test.ts
```

Expected: `Test Files  1 passed (1)`, `Tests  12 passed (12)`.

- [ ] **Step 16: Typecheck and lint**

```bash
pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint
```

Expected: both commands exit 0 and print nothing beyond the script banner.

- [ ] **Step 17: Commit**

```bash
git add apps/web/src/features/avatar/sheets.ts apps/web/src/features/avatar/__tests__/sheets.test.ts
git commit -F - <<'EOF'
feat(web): parse Aseprite json-array exports into a sprite sheet registry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 18: Write the fixture registry helper**

Create `apps/web/src/features/avatar/__tests__/fixtures.ts`. Vitest's `*.test.ts` include does not match this file, but tsc and ESLint still check it:

```ts
import { parseSheet, type SheetData, type SheetId } from '../sheets.js';

export interface FixtureRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FixtureTag {
  name: string;
  from: number;
  to: number;
}

export interface FixtureSlice {
  name: string;
  bounds: FixtureRect;
  pivot?: { x: number; y: number };
}

export interface FixtureSheetSpec {
  w: number;
  h: number;
  durations: readonly number[];
  tags?: readonly FixtureTag[];
  slices?: readonly FixtureSlice[];
}

/**
 * An object shaped like `aseprite --batch --sheet x.png --data x.json
 * --format json-array --list-tags --list-slices` output: a horizontal strip
 * of w×h frames, every tag `forward`.
 */
export function asepriteJson(name: string, spec: FixtureSheetSpec): unknown {
  return {
    frames: spec.durations.map((duration, i) => ({
      filename: `${name} ${i}.aseprite`,
      frame: { x: i * spec.w, y: 0, w: spec.w, h: spec.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: spec.w, h: spec.h },
      sourceSize: { w: spec.w, h: spec.h },
      duration,
    })),
    meta: {
      app: 'https://www.aseprite.org/',
      version: '1.3.18.6-x64',
      image: `${name}.png`,
      format: 'RGBA8888',
      size: { w: spec.w * spec.durations.length, h: spec.h },
      scale: '1',
      frameTags: (spec.tags ?? []).map((t) => ({
        name: t.name,
        from: t.from,
        to: t.to,
        direction: 'forward',
        color: '#000000ff',
      })),
      slices: (spec.slices ?? []).map((s) => ({
        name: s.name,
        color: '#0000ffff',
        keys: [
          s.pivot
            ? { frame: 0, bounds: s.bounds, pivot: s.pivot }
            : { frame: 0, bounds: s.bounds },
        ],
      })),
    },
  };
}

/** parseSheet over asepriteJson, with a fake image URL. */
export function fixtureSheet(id: SheetId, spec: FixtureSheetSpec): SheetData {
  return parseSheet(id, asepriteJson(id, spec), `/fixtures/${id}.png`);
}

export function registryOf(...sheets: SheetData[]): ReadonlyMap<SheetId, SheetData> {
  return new Map(sheets.map((sheet) => [sheet.id, sheet]));
}

/** Body timing for fixture avatar sheets: front-idle 0-3 (1600 ms), turn 4 (150 ms), side-run 5-8 (440 ms). */
export const AVATAR_DURATIONS: readonly number[] = [400, 200, 400, 600, 150, 100, 120, 100, 120];

export const AVATAR_TAGS: readonly FixtureTag[] = [
  { name: 'front-idle', from: 0, to: 3 },
  { name: 'turn', from: 4, to: 4 },
  { name: 'side-run', from: 5, to: 8 },
];

/**
 * A 64×64-cell avatar sheet. `pad` adds leading 100 ms frames, so its tags
 * start `pad` frames later than body's.
 */
export function avatarSheet(id: SheetId, pad = 0): SheetData {
  return fixtureSheet(id, {
    w: 64,
    h: 64,
    durations: [...Array.from({ length: pad }, () => 100), ...AVATAR_DURATIONS],
    tags: AVATAR_TAGS.map((t) => ({ name: t.name, from: t.from + pad, to: t.to + pad })),
  });
}

/**
 * Every avatar sheet the catalog references. top-starter-tee (pad 2) and
 * hair-curly (pad 1) start their tags later than body, so a drawList that used
 * body's frame indices for every layer would pick the wrong rects.
 */
export const FIXTURE_REGISTRY: ReadonlyMap<SheetId, SheetData> = registryOf(
  avatarSheet('body'),
  avatarSheet('shoes-starter'),
  avatarSheet('bottom-starter-shorts'),
  avatarSheet('top-starter-tee', 2),
  avatarSheet('hair-short'),
  avatarSheet('hair-curly', 1),
  avatarSheet('hair-ponytail'),
);
```

- [ ] **Step 19: Write the failing frames test**

Create `apps/web/src/features/avatar/__tests__/frames.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { frameAt, loopLength, tagFrames, type TagFrame } from '../frames.js';
import { getSheet } from '../sheets.js';
import { FIXTURE_REGISTRY } from './fixtures.js';

const body = getSheet('body', FIXTURE_REGISTRY);
const curly = getSheet('hair-curly', FIXTURE_REGISTRY);

// Absolute indices start at 5 so a frameAt that returned the absolute index
// instead of the offset within the tag would fail.
const THREE: TagFrame[] = [
  { index: 5, duration: 100 },
  { index: 6, duration: 200 },
  { index: 7, duration: 100 },
];

describe('tagFrames', () => {
  it('lists absolute sheet frame indices with their durations', () => {
    expect(tagFrames(body, 'side-run')).toEqual([
      { index: 5, duration: 100 },
      { index: 6, duration: 120 },
      { index: 7, duration: 100 },
      { index: 8, duration: 120 },
    ]);
  });

  it("uses the sheet's own tag range", () => {
    expect(tagFrames(curly, 'side-run').map((f) => f.index)).toEqual([6, 7, 8, 9]);
  });

  it('returns the single turn frame', () => {
    expect(tagFrames(body, 'turn')).toEqual([{ index: 4, duration: 150 }]);
  });

  it('throws naming the sheet and the missing tag', () => {
    expect(() => tagFrames(body, 'belt')).toThrow('Sprite sheet "body" has no tag "belt"');
  });
});

describe('loopLength', () => {
  it('sums the per-frame durations', () => {
    expect(loopLength(tagFrames(body, 'front-idle'))).toBe(1600);
    expect(loopLength(tagFrames(body, 'side-run'))).toBe(440);
    expect(loopLength(THREE)).toBe(400);
  });

  it('is 0 for no frames', () => {
    expect(loopLength([])).toBe(0);
  });
});

describe('frameAt', () => {
  it('returns the 0-based offset within the tag, not the sheet index', () => {
    expect(frameAt(THREE, 0)).toBe(0);
  });

  it('switches frames exactly at each duration boundary', () => {
    expect(frameAt(THREE, 99)).toBe(0);
    expect(frameAt(THREE, 100)).toBe(1);
    expect(frameAt(THREE, 299)).toBe(1);
    expect(frameAt(THREE, 300)).toBe(2);
    expect(frameAt(THREE, 399)).toBe(2);
  });

  it('handles fractional rAF times', () => {
    expect(frameAt(THREE, 99.9)).toBe(0);
    expect(frameAt(THREE, 100.5)).toBe(1);
  });

  it('loops after the last frame', () => {
    expect(frameAt(THREE, 400)).toBe(0);
    expect(frameAt(THREE, 500)).toBe(1);
    expect(frameAt(THREE, 1300)).toBe(1);
    expect(frameAt(THREE, 4399)).toBe(2);
  });

  it('always returns 0 for a single-frame tag', () => {
    const turn = tagFrames(body, 'turn');
    expect(frameAt(turn, 0)).toBe(0);
    expect(frameAt(turn, 149)).toBe(0);
    expect(frameAt(turn, 10_000)).toBe(0);
  });

  it('walks a real fixture tag', () => {
    const idle = tagFrames(body, 'front-idle');
    expect([0, 399, 400, 599, 600, 999, 1000, 1599, 1600].map((ms) => frameAt(idle, ms))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 0,
    ]);
  });

  it('returns 0 for no frames', () => {
    expect(frameAt([], 123)).toBe(0);
  });
});
```

- [ ] **Step 20: Run it and watch it fail**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/frames.test.ts
```

Expected: FAIL with `Error: Failed to resolve import "../frames.js" from "src/features/avatar/__tests__/frames.test.ts". Does the file exist?` and `Tests  no tests`.

- [ ] **Step 21: Implement frames.ts**

Create `apps/web/src/features/avatar/frames.ts`:

```ts
import type { SheetData } from './sheets.js';

export type AnimationTag = 'front-idle' | 'turn' | 'side-run';

/** One frame of a tag: its absolute index in the sheet and its duration in ms. */
export interface TagFrame {
  index: number;
  duration: number;
}

/** The frames of `tag` in play order, read from the sheet's own tag range. */
export function tagFrames(sheet: SheetData, tag: string): TagFrame[] {
  const range = sheet.tags.find((t) => t.name === tag);
  if (!range) {
    throw new Error(`Sprite sheet "${sheet.id}" has no tag "${tag}"`);
  }
  const frames: TagFrame[] = [];
  for (let index = range.from; index <= range.to; index++) {
    const frame = sheet.frames[index];
    if (!frame) {
      throw new Error(`Sprite sheet "${sheet.id}" tag "${tag}" points at missing frame ${index}`);
    }
    frames.push({ index, duration: frame.duration });
  }
  return frames;
}

/** Total duration of one pass through the frames, in ms. */
export function loopLength(frames: TagFrame[]): number {
  return frames.reduce((total, frame) => total + frame.duration, 0);
}

/**
 * The 0-based offset within `frames` showing at `msInState`, looping forward.
 * A frame starts exactly when the previous frames' durations have elapsed.
 */
export function frameAt(frames: TagFrame[], msInState: number): number {
  const total = loopLength(frames);
  if (total <= 0) return 0;
  let t = ((msInState % total) + total) % total;
  for (const [offset, frame] of frames.entries()) {
    if (t < frame.duration) return offset;
    t -= frame.duration;
  }
  return frames.length - 1;
}
```

- [ ] **Step 22: Run it and watch it pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/frames.test.ts
```

Expected: `Test Files  1 passed (1)`, `Tests  13 passed (13)`.

- [ ] **Step 23: Typecheck and lint**

```bash
pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint
```

Expected: both commands exit 0 with no errors or warnings. This also checks `__tests__/fixtures.ts`.

- [ ] **Step 24: Commit**

```bash
git add apps/web/src/features/avatar/frames.ts apps/web/src/features/avatar/__tests__/frames.test.ts apps/web/src/features/avatar/__tests__/fixtures.ts
git commit -F - <<'EOF'
feat(web): add tag frame lookup and looping frameAt over sheet durations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 25: Write the failing drawList test**

Create `apps/web/src/features/avatar/__tests__/layers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { AvatarAppearance } from '@tracks/types';
import { drawList } from '../layers.js';
import { CLOTH_RAMPS, HAIR_RAMPS, PLACEHOLDER_RAMPS, SKIN_RAMPS } from '../palette.js';
import { getSheet, type SheetFrame, type SheetId } from '../sheets.js';
import { buildSwap } from '../swap.js';
import { FIXTURE_REGISTRY, registryOf } from './fixtures.js';

const LOOK: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'blonde',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-gray',
  shoes: 'starter-shoes-red',
};

function rect(id: SheetId, index: number): SheetFrame {
  const frame = getSheet(id, FIXTURE_REGISTRY).frames[index];
  if (!frame) throw new Error(`fixture ${id} has no frame ${index}`);
  return frame;
}

describe('drawList', () => {
  it('draws body, shoes, bottom, top, then hair', () => {
    expect(drawList(LOOK, 'front-idle', 0, FIXTURE_REGISTRY).map((d) => d.sheet)).toEqual([
      'body',
      'shoes-starter',
      'bottom-starter-shorts',
      'top-starter-tee',
      'hair-curly',
    ]);
  });

  it('picks the hair sheet from the hair style', () => {
    const short = drawList({ ...LOOK, hair_style: 'short' }, 'front-idle', 0, FIXTURE_REGISTRY);
    const ponytail = drawList({ ...LOOK, hair_style: 'ponytail' }, 'front-idle', 0, FIXTURE_REGISTRY);
    expect(short.at(-1)?.sheet).toBe('hair-short');
    expect(ponytail.at(-1)?.sheet).toBe('hair-ponytail');
  });

  it('swaps skin on body, hair on hair, and cloth to each clothing item', () => {
    expect(drawList(LOOK, 'front-idle', 0, FIXTURE_REGISTRY).map((d) => d.swap)).toEqual([
      buildSwap(PLACEHOLDER_RAMPS.skin, SKIN_RAMPS['tone-3']),
      buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS['starter-shoes-red']),
      buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS['starter-shorts-gray']),
      buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS['starter-tee-blue']),
      buildSwap(PLACEHOLDER_RAMPS.hair, HAIR_RAMPS.blonde),
    ]);
  });

  it("offsets from each sheet's own tag start", () => {
    // side-run starts at 5 in body/shoes/bottom, 6 in hair-curly (pad 1), 7 in top (pad 2).
    expect(drawList(LOOK, 'side-run', 2, FIXTURE_REGISTRY).map((d) => d.rect)).toEqual([
      rect('body', 7),
      rect('shoes-starter', 7),
      rect('bottom-starter-shorts', 7),
      rect('top-starter-tee', 9),
      rect('hair-curly', 8),
    ]);
  });

  it('reads source rects from the sheet data, never from the frame index', () => {
    // Re-pack top-starter-tee as a vertical strip. A drawList that computed
    // rects as (index × 64, 0), or reused body's rects, would get the top wrong.
    const vertical = registryOf(
      ...[...FIXTURE_REGISTRY.values()].map((sheet) =>
        sheet.id === 'top-starter-tee'
          ? { ...sheet, frames: sheet.frames.map((frame, i) => ({ ...frame, x: 0, y: i * 64 })) }
          : sheet,
      ),
    );
    const [bodyItem, , , topItem] = drawList(LOOK, 'turn', 0, vertical);
    expect(bodyItem?.rect).toEqual({ x: 4 * 64, y: 0, w: 64, h: 64, duration: 150 });
    expect(topItem?.rect).toEqual({ x: 0, y: 6 * 64, w: 64, h: 64, duration: 150 });
  });

  it('throws naming a sheet missing from the registry', () => {
    const withoutCurly = registryOf(
      ...[...FIXTURE_REGISTRY.values()].filter((sheet) => sheet.id !== 'hair-curly'),
    );
    expect(() => drawList(LOOK, 'front-idle', 0, withoutCurly)).toThrow('"hair-curly"');
  });

  it('throws when the offset is past the end of a tag', () => {
    expect(() => drawList(LOOK, 'turn', 1, FIXTURE_REGISTRY)).toThrow(
      'Sprite sheet "body" tag "turn" has no frame at offset 1',
    );
  });
});
```

- [ ] **Step 26: Run it and watch it fail**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/layers.test.ts
```

Expected: FAIL with `Error: Failed to resolve import "../layers.js" from "src/features/avatar/__tests__/layers.test.ts". Does the file exist?` and `Tests  no tests`.

- [ ] **Step 27: Implement layers.ts**

Create `apps/web/src/features/avatar/layers.ts`:

```ts
import type { AvatarAppearance } from '@tracks/types';
import {
  BODY_SHEET,
  BOTTOM_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  TOP_OPTIONS,
} from './catalog.js';
import { tagFrames, type AnimationTag } from './frames.js';
import { CLOTH_RAMPS, HAIR_RAMPS, PLACEHOLDER_RAMPS, SKIN_RAMPS } from './palette.js';
import { getSheet, SHEETS, type SheetData, type SheetFrame, type SheetId } from './sheets.js';
import { buildSwap, type Swap } from './swap.js';

/** One layer to draw: which sheet, the recolor to apply, and the source rect. */
export interface DrawItem {
  sheet: SheetId;
  swap: Swap;
  rect: SheetFrame;
}

/**
 * The avatar's layers in draw order (body, shoes, bottom, top, hair) for one
 * frame. `frameOffset` is the 0-based offset within `tag` (frameAt's result);
 * each sheet maps it through its own tag range, and the source rect is read
 * from that sheet's frame data.
 */
export function drawList(
  appearance: AvatarAppearance,
  tag: AnimationTag,
  frameOffset: number,
  registry: ReadonlyMap<SheetId, SheetData> = SHEETS,
): DrawItem[] {
  const layers: { sheet: SheetId; swap: Swap }[] = [
    {
      sheet: BODY_SHEET,
      swap: buildSwap(PLACEHOLDER_RAMPS.skin, SKIN_RAMPS[appearance.skin_tone]),
    },
    {
      sheet: SHOES_OPTIONS[appearance.shoes].sheet,
      swap: buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS[appearance.shoes]),
    },
    {
      sheet: BOTTOM_OPTIONS[appearance.bottom].sheet,
      swap: buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS[appearance.bottom]),
    },
    {
      sheet: TOP_OPTIONS[appearance.top].sheet,
      swap: buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS[appearance.top]),
    },
    {
      sheet: HAIR_STYLE_OPTIONS[appearance.hair_style].sheet,
      swap: buildSwap(PLACEHOLDER_RAMPS.hair, HAIR_RAMPS[appearance.hair_color]),
    },
  ];

  return layers.map(({ sheet, swap }) => {
    const data = getSheet(sheet, registry);
    const frame = tagFrames(data, tag)[frameOffset];
    const rect = frame ? data.frames[frame.index] : undefined;
    if (!rect) {
      throw new Error(`Sprite sheet "${sheet}" tag "${tag}" has no frame at offset ${frameOffset}`);
    }
    return { sheet, swap, rect };
  });
}
```

- [ ] **Step 28: Run it and watch it pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/layers.test.ts
```

Expected: `Test Files  1 passed (1)`, `Tests  7 passed (7)`.

- [ ] **Step 29: Run the whole web suite, typecheck and lint**

```bash
pnpm --filter @tracks/web test && pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint
```

Expected: every test file passes. That covers this task's 45 tests (fitScale 7, swapPixels 6, sheets 12, frames 13, layers 7), Task 5's swap/palette/catalog/appearance tests, and the existing `src/__tests__/App.test.tsx` and `LoginPage.test.tsx`. Vitest prints no `Not implemented` messages or other console errors. Typecheck and lint exit 0 with no output. Per rule 26, fix anything that fails before you commit.

- [ ] **Step 30: Commit**

```bash
git add apps/web/src/features/avatar/layers.ts apps/web/src/features/avatar/__tests__/layers.test.ts
git commit -F - <<'EOF'
feat(web): add pure drawList for ordered, palette-swapped avatar layers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

---

### Task 7: Room behavior state machine

**Files:**
- Create: `apps/web/src/features/avatar-room/behavior.ts`
- Test: `apps/web/src/features/avatar-room/__tests__/behavior.test.ts`

**Interfaces:**
Consumes (Task 6 / Task 5):
- `apps/web/src/features/avatar/frames.ts`: `type AnimationTag = "front-idle" | "turn" | "side-run"`, `tagFrames(sheet: SheetData, tag: string): TagFrame[]` (throws if tag missing), `loopLength(frames: TagFrame[]): number`
- `apps/web/src/features/avatar/sheets.ts`: `interface SheetData { id: SheetId; imageUrl: string; frames: SheetFrame[]; tags: SheetTag[]; slices: SheetSlice[] }` (type-only import)

Produces (`apps/web/src/features/avatar-room/behavior.ts`):
- `type BehaviorPhase = "idle" | "turn-in" | "run" | "turn-out"`
- `interface BehaviorTimings { idleLoopMs: number; runLoopMs: number; turnMs: number }`
- `interface BehaviorState { phase: BehaviorPhase; msInPhase: number; targetMs: number }`
- `initialBehavior(rng: () => number, timings: BehaviorTimings): BehaviorState`
- `step(state: BehaviorState, dtMs: number, rng: () => number, timings: BehaviorTimings): BehaviorState`. It is pure and carries leftover dt across transitions. When dt is zero, negative or non-finite, it returns the same `state` object it was given (not a copy). Targets: idle `ceil((4000 + rng()*4000)/idleLoopMs)*idleLoopMs`, run `ceil((8000 + rng()*7000)/runLoopMs)*runLoopMs`, turn-in/turn-out `turnMs`. `rng` is called only when entering idle or run.
- `tagForPhase(phase: BehaviorPhase): AnimationTag`
- `timingsFromSheet(body: SheetData): BehaviorTimings`. It throws `Sheet "<id>": tag "<tag>" must last longer than 0 ms, got <ms>` when a loop length is not a positive finite number.

RoomScene (a later task) uses this as `frameAt(tagFrames(body, tagForPhase(state.phase)), state.msInPhase)`.

- [ ] **Step 1: Write the failing state-machine test**

Create `apps/web/src/features/avatar-room/__tests__/behavior.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  initialBehavior,
  step,
  tagForPhase,
  type BehaviorPhase,
  type BehaviorState,
  type BehaviorTimings,
} from '../behavior.js';

const TIMINGS: BehaviorTimings = { idleLoopMs: 1000, runLoopMs: 800, turnMs: 150 };

const rngLow = (): number => 0;
const rngHigh = (): number => 0.999;

/** Returns the given values in order and throws if called more often than that. */
function rngSequence(...values: number[]): () => number {
  let calls = 0;
  return () => {
    const value = values[calls];
    calls += 1;
    if (value === undefined) {
      throw new Error(`rng called ${calls} times but only ${values.length} values were stubbed`);
    }
    return value;
  };
}

/** A frozen state: any mutation inside step() throws (ES modules are strict). */
function state(phase: BehaviorPhase, msInPhase: number, targetMs: number): BehaviorState {
  return Object.freeze({ phase, msInPhase, targetMs });
}

describe('initialBehavior', () => {
  it('starts idle at 0 ms with the shortest idle when rng is 0', () => {
    expect(initialBehavior(rngLow, TIMINGS)).toEqual({
      phase: 'idle',
      msInPhase: 0,
      targetMs: 4000,
    });
  });

  it('rounds the longest idle (7996 ms) up to whole front-idle loops', () => {
    expect(initialBehavior(rngHigh, TIMINGS).targetMs).toBe(8000);
  });

  it('rounds up when the idle loop does not divide 4000 ms', () => {
    const timings: BehaviorTimings = { ...TIMINGS, idleLoopMs: 1500 };
    expect(initialBehavior(rngLow, timings).targetMs).toBe(4500);
  });

  it('ends idle on the first loop boundary at or after the drawn duration', () => {
    const timings: BehaviorTimings = { ...TIMINGS, idleLoopMs: 1500 };
    for (const r of [0, 0.13, 0.5, 0.77, 0.999]) {
      const drawn = 4000 + r * 4000;
      const target = initialBehavior(() => r, timings).targetMs;
      expect(target % 1500).toBe(0);
      expect(target).toBeGreaterThanOrEqual(drawn);
      expect(target).toBeLessThan(drawn + 1500);
    }
  });
});

describe('step', () => {
  it('stays idle until the idle target is reached', () => {
    expect(step(initialBehavior(rngLow, TIMINGS), 3999, rngLow, TIMINGS)).toEqual({
      phase: 'idle',
      msInPhase: 3999,
      targetMs: 4000,
    });
  });

  it('switches to turn-in exactly when idle reaches its target', () => {
    expect(step(state('idle', 3999, 4000), 1, rngLow, TIMINGS)).toEqual({
      phase: 'turn-in',
      msInPhase: 0,
      targetMs: 150,
    });
  });

  it('runs a full cycle idle -> turn-in -> run -> turn-out -> idle', () => {
    const idle = initialBehavior(rngLow, TIMINGS);
    const turnIn = step(idle, 4000, rngLow, TIMINGS);
    expect(turnIn).toEqual({ phase: 'turn-in', msInPhase: 0, targetMs: 150 });
    const run = step(turnIn, 150, rngLow, TIMINGS);
    expect(run).toEqual({ phase: 'run', msInPhase: 0, targetMs: 8000 });
    const turnOut = step(run, 8000, rngLow, TIMINGS);
    expect(turnOut).toEqual({ phase: 'turn-out', msInPhase: 0, targetMs: 150 });
    const idleAgain = step(turnOut, 150, rngLow, TIMINGS);
    expect(idleAgain).toEqual({ phase: 'idle', msInPhase: 0, targetMs: 4000 });
  });

  it('rounds the longest run (14993 ms) up to whole side-run loops', () => {
    expect(step(state('turn-in', 0, 150), 150, rngHigh, TIMINGS)).toEqual({
      phase: 'run',
      msInPhase: 0,
      targetMs: 15200,
    });
  });

  it('draws a fresh duration on each idle and run entry and none for turns', () => {
    const rng = rngSequence(0, 0.999, 0.999);
    const idle = initialBehavior(rng, TIMINGS);
    expect(idle.targetMs).toBe(4000);
    const turnIn = step(idle, 4000, rng, TIMINGS);
    const run = step(turnIn, 150, rng, TIMINGS);
    expect(run).toEqual({ phase: 'run', msInPhase: 0, targetMs: 15200 });
    const turnOut = step(run, 15200, rng, TIMINGS);
    const idleAgain = step(turnOut, 150, rng, TIMINGS);
    expect(idleAgain).toEqual({ phase: 'idle', msInPhase: 0, targetMs: 8000 });
  });

  it('carries leftover dt across two transitions in one step', () => {
    // 100 ms finishes idle, 150 ms is the whole turn-in, 150 ms lands in run.
    expect(step(state('idle', 3900, 4000), 400, rngLow, TIMINGS)).toEqual({
      phase: 'run',
      msInPhase: 150,
      targetMs: 8000,
    });
  });

  it('carries a dt longer than a whole cycle around the loop', () => {
    const cycleMs = 4000 + 150 + 8000 + 150;
    expect(step(initialBehavior(rngLow, TIMINGS), cycleMs + 50, rngLow, TIMINGS)).toEqual({
      phase: 'idle',
      msInPhase: 50,
      targetMs: 4000,
    });
  });

  it('adds dt within a phase and keeps the drawn target', () => {
    expect(step(state('run', 100, 8000), 16.5, rngHigh, TIMINGS)).toEqual({
      phase: 'run',
      msInPhase: 116.5,
      targetMs: 8000,
    });
  });

  it('returns the same state for zero, negative and non-finite dt', () => {
    const s = state('run', 100, 8000);
    expect(step(s, 0, rngLow, TIMINGS)).toBe(s);
    expect(step(s, -50, rngLow, TIMINGS)).toBe(s);
    expect(step(s, Number.NaN, rngLow, TIMINGS)).toBe(s);
    expect(step(s, Number.POSITIVE_INFINITY, rngLow, TIMINGS)).toBe(s);
  });

  it('does not mutate the state it is given', () => {
    const s = state('idle', 3900, 4000);
    step(s, 400, rngLow, TIMINGS);
    expect(s).toEqual({ phase: 'idle', msInPhase: 3900, targetMs: 4000 });
  });
});

describe('tagForPhase', () => {
  it('maps each phase to the avatar tag it plays', () => {
    expect(tagForPhase('idle')).toBe('front-idle');
    expect(tagForPhase('turn-in')).toBe('turn');
    expect(tagForPhase('run')).toBe('side-run');
    expect(tagForPhase('turn-out')).toBe('turn');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/behavior.test.ts`

Expected: FAIL with
```
Error: Failed to resolve import "../behavior.js" from "src/features/avatar-room/__tests__/behavior.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 3: Implement the state machine**

Create `apps/web/src/features/avatar-room/behavior.ts`:

```ts
import type { AnimationTag } from '../avatar/frames.js';

/**
 * Room behavior: idle (front-idle) -> turn-in (turn) -> run (side-run)
 * -> turn-out (turn) -> idle. Pure: no clock, no timers; rng is injected.
 */
export type BehaviorPhase = 'idle' | 'turn-in' | 'run' | 'turn-out';

export interface BehaviorTimings {
  /** One front-idle loop in ms (sum of its frame durations in body.json). */
  idleLoopMs: number;
  /** One side-run loop in ms. */
  runLoopMs: number;
  /** How long the turn tag shows, in ms. */
  turnMs: number;
}

export interface BehaviorState {
  phase: BehaviorPhase;
  /** Time spent in the current phase; pass it to frameAt for the tag frame. */
  msInPhase: number;
  /** The phase ends when msInPhase reaches this. */
  targetMs: number;
}

const IDLE_MIN_MS = 4000;
const IDLE_SPREAD_MS = 4000;
const RUN_MIN_MS = 8000;
const RUN_SPREAD_MS = 7000;

const NEXT_PHASE: Record<BehaviorPhase, BehaviorPhase> = {
  idle: 'turn-in',
  'turn-in': 'run',
  run: 'turn-out',
  'turn-out': 'idle',
};

const PHASE_TAG: Record<BehaviorPhase, AnimationTag> = {
  idle: 'front-idle',
  'turn-in': 'turn',
  run: 'side-run',
  'turn-out': 'turn',
};

/** Rounds up to whole loops, so the switch lands at the end of a tag loop. */
function wholeLoops(ms: number, loopMs: number): number {
  return Math.ceil(ms / loopMs) * loopMs;
}

/** A phase's duration, drawn on entry. Only idle and run consume rng. */
function phaseTarget(phase: BehaviorPhase, rng: () => number, timings: BehaviorTimings): number {
  switch (phase) {
    case 'idle':
      return wholeLoops(IDLE_MIN_MS + rng() * IDLE_SPREAD_MS, timings.idleLoopMs);
    case 'run':
      return wholeLoops(RUN_MIN_MS + rng() * RUN_SPREAD_MS, timings.runLoopMs);
    case 'turn-in':
    case 'turn-out':
      return timings.turnMs;
  }
}

export function initialBehavior(rng: () => number, timings: BehaviorTimings): BehaviorState {
  return { phase: 'idle', msInPhase: 0, targetMs: phaseTarget('idle', rng, timings) };
}

export function step(
  state: BehaviorState,
  dtMs: number,
  rng: () => number,
  timings: BehaviorTimings,
): BehaviorState {
  // Zero dt changes nothing; a negative or non-finite dt would corrupt
  // msInPhase (or never leave the loop). Either way, hand back the same object.
  if (!Number.isFinite(dtMs) || dtMs <= 0) return state;
  let phase = state.phase;
  let targetMs = state.targetMs;
  let msInPhase = state.msInPhase + dtMs;
  while (msInPhase >= targetMs) {
    msInPhase -= targetMs;
    phase = NEXT_PHASE[phase];
    targetMs = phaseTarget(phase, rng, timings);
  }
  return { phase, msInPhase, targetMs };
}

export function tagForPhase(phase: BehaviorPhase): AnimationTag {
  return PHASE_TAG[phase];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/behavior.test.ts`

Expected: PASS, `Test Files  1 passed (1)`, `Tests  15 passed (15)`.

- [ ] **Step 5: Write the failing timingsFromSheet test**

In `apps/web/src/features/avatar-room/__tests__/behavior.test.ts`, replace the import block at the top of the file (lines 1-9) with:

```ts
import { describe, expect, it } from 'vitest';
import type { SheetData } from '../../avatar/sheets.js';
import {
  initialBehavior,
  step,
  tagForPhase,
  timingsFromSheet,
  type BehaviorPhase,
  type BehaviorState,
  type BehaviorTimings,
} from '../behavior.js';
```

Then append this to the end of the same file:

```ts

/** A body sheet laid out like the export: front-idle, then turn, then side-run. */
function bodySheet(idle: number[], turn: number[], run: number[]): SheetData {
  const durations = [...idle, ...turn, ...run];
  return {
    id: 'body',
    imageUrl: '/sprites/body.png',
    frames: durations.map((duration, i) => ({ x: i * 64, y: 0, w: 64, h: 64, duration })),
    tags: [
      { name: 'front-idle', from: 0, to: idle.length - 1, direction: 'forward' },
      { name: 'turn', from: idle.length, to: idle.length + turn.length - 1, direction: 'forward' },
      {
        name: 'side-run',
        from: idle.length + turn.length,
        to: durations.length - 1,
        direction: 'forward',
      },
    ],
    slices: [],
  };
}

describe('timingsFromSheet', () => {
  it('sums the front-idle and side-run frame durations and reads the turn frame', () => {
    const body = bodySheet([700, 100, 700, 500], [150], [80, 120, 100, 100, 80, 120, 100, 100]);
    expect(timingsFromSheet(body)).toEqual({ idleLoopMs: 2000, runLoopMs: 800, turnMs: 150 });
  });

  it('throws on a zero-length tag instead of handing step() a 0 ms phase', () => {
    const body = bodySheet([500, 500], [0], [100, 100]);
    expect(() => timingsFromSheet(body)).toThrow(
      'Sheet "body": tag "turn" must last longer than 0 ms, got 0',
    );
  });
});
```

- [ ] **Step 6: Run the test to verify the new cases fail**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/behavior.test.ts`

Expected: FAIL, `Tests  2 failed | 15 passed (17)`. The first new case fails with `TypeError: timingsFromSheet is not a function`. The zero-length case fails with `AssertionError: expected [Function] to throw error including 'Sheet "body": tag "turn" must last lo…' but got '(0 , __vite_ssr_import_1__.timingsFro…'`.

- [ ] **Step 7: Implement timingsFromSheet**

In `apps/web/src/features/avatar-room/behavior.ts`, replace line 1:

```ts
import type { AnimationTag } from '../avatar/frames.js';
```

with:

```ts
import { loopLength, tagFrames, type AnimationTag } from '../avatar/frames.js';
import type { SheetData } from '../avatar/sheets.js';
```

Then append this to the end of the same file:

```ts

/** A tag's loop length in ms; throws unless it is a positive, finite number. */
function tagLoopMs(sheet: SheetData, tag: AnimationTag): number {
  const ms = loopLength(tagFrames(sheet, tag));
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(`Sheet "${sheet.id}": tag "${tag}" must last longer than 0 ms, got ${ms}`);
  }
  return ms;
}

/** Reads the timings from body.json, the timing reference for every avatar layer. */
export function timingsFromSheet(body: SheetData): BehaviorTimings {
  return {
    idleLoopMs: tagLoopMs(body, 'front-idle'),
    runLoopMs: tagLoopMs(body, 'side-run'),
    turnMs: tagLoopMs(body, 'turn'),
  };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/behavior.test.ts`

Expected: PASS, `Test Files  1 passed (1)`, `Tests  17 passed (17)`.

- [ ] **Step 9: Typecheck and lint**

Run: `pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint`

Expected: both exit 0 with no errors or warnings. The exhaustive `switch` in `phaseTarget` has to compile without a trailing return. If TS2366 appears, a phase is missing from the switch.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/avatar-room/behavior.ts apps/web/src/features/avatar-room/__tests__/behavior.test.ts
git commit -F - <<'EOF'
feat(web): add room behavior state machine

Pure idle -> turn-in -> run -> turn-out loop for the avatar room.
Idle (4-8 s) and run (8-15 s) durations are drawn from an injected
rng on entry and rounded up to whole front-idle / side-run loops, so
a phase only ends at the end of a tag loop. step() carries leftover
dt across transitions and returns the same state for zero, negative
or non-finite dt. timingsFromSheet reads the loop lengths and turn
duration from body.json and rejects zero-length tags.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

---

### Task 8: Canvas adapter, pixel-canvas hook and AvatarSprite

**Files:**
- Create: `apps/web/src/features/avatar/canvas.ts`
- Create: `apps/web/src/features/avatar/usePixelCanvas.ts`
- Create: `apps/web/src/features/avatar/AvatarSprite.tsx`
- Test: `apps/web/src/features/avatar/__tests__/usePixelCanvas.test.tsx`. It covers only the hook's sizing (Review Focus: "Rotating a phone, resizing the window, or moving to a monitor with a different DPR must re-size the canvas crisply."). It stubs `ResizeObserver`, `window.matchMedia`, `window.devicePixelRatio` and `HTMLCanvasElement.prototype.getContext`, so nothing is drawn and jsdom never prints "Not implemented".
- No jsdom test for `canvas.ts` or `AvatarSprite.tsx`, by design. Spec §5 "web UI" says jsdom has no canvas, no image decoding and no ImageData, and later UI tests `vi.mock` `AvatarSprite` and `RoomScene`. For these two files the red/green check is the compiler, plus lint. Do not commit any temporary dev route, harness page or probe test. Real drawing is verified in **Task 20**: the e2e `data-ready` and accessible-name checks, and Playwright captures at DPR 2, 3, 2.625 and 1.

**Interfaces:**
- Consumes (Tasks 5-6 and existing code):
  - `swap.ts`:
    - `type Swap = ReadonlyMap<number, number>`
    - `swapKey(swap: Swap | null): string`
    - `swapPixels(rgba: Uint8ClampedArray, swap: Swap): Uint8ClampedArray<ArrayBuffer>`, where an empty swap leaves every pixel unchanged
  - `sheets.ts`: `type SheetId`, `interface SheetData`, `getSheet(id: SheetId, registry?: ReadonlyMap<SheetId, SheetData>): SheetData`
  - `frames.ts`: `type AnimationTag`
  - `fitScale.ts`: `fitScale(availW: number, availH: number, dpr: number, w: number, h: number): number`
  - `layers.ts`: `drawList(appearance: AvatarAppearance, tag: AnimationTag, frameOffset: number, registry?: ReadonlyMap<SheetId, SheetData>): DrawItem[]`
  - `appearance.ts`: `describeAppearance(a: AvatarAppearance): string`
  - `@tracks/types`: `AvatarAppearance`
  - `apps/web/src/lib/utils.ts`: `cn`
  - `@sentry/react`: `captureException` (already a web dependency, used in `main.tsx` and `components/ErrorBoundary.tsx`)
  - `react-dom`: `flushSync`
- Produces:
  - `canvas.ts`:
    - `type LoadedSheets = ReadonlyMap<string, HTMLCanvasElement>`, keyed by `` `${sheet.id}|${swapKey(swap)}` ``
    - `loadSheetCanvas(sheet: SheetData, swap: Swap | null): Promise<HTMLCanvasElement>`
    - `loadAvatarSheets(appearance: AvatarAppearance, registry?: ReadonlyMap<SheetId, SheetData>): Promise<LoadedSheets>`
    - `drawAvatar(ctx: CanvasRenderingContext2D, sheets: LoadedSheets, appearance: AvatarAppearance, tag: AnimationTag, frameOffset: number, feetX: number, feetY: number, registry?: ReadonlyMap<SheetId, SheetData>): void`
  - `usePixelCanvas.ts`: `usePixelCanvas(nativeW: number, nativeH: number): { stageRef: RefObject<HTMLDivElement | null>; canvasRef: RefObject<HTMLCanvasElement | null>; scale: number; generation: number }`
    - `generation` increments only when k or the DPR actually changes.
    - It increments inside `flushSync`, so consumers' redraw effects run before the browser paints the cleared canvas.
  - `AvatarSprite.tsx`: `export function AvatarSprite(props: { appearance: AvatarAppearance; tag: AnimationTag; frame: number; className?: string })`
    - It never throws during render.
    - If this appearance fails to load or draw, it reports the error to Sentry, hides the canvas and shows an inline `role="alert"` message, "Can't load the avatar preview."

- [ ] **Step 1: Confirm the pure-function base is green**

`canvas.ts` and `AvatarSprite.tsx` get no unit test file, for two reasons:
- jsdom has no canvas, and spec §5 forbids jsdom tests that draw with these modules.
- Every drawing decision they make is delegated to pure functions that Tasks 5-6 already tested: `drawList`, `swapPixels`, `swapKey`, `getSheet` and `describeAppearance`.

For those two files the red/green check is `tsc`. Step 2 writes the consumer first, and the typecheck fails until the adapter and the hook exist.

`usePixelCanvas` is the exception: its re-size behavior on rotation, window resize and DPR change is not covered by `fitScale` alone. Steps 6-9 test it in jsdom with `ResizeObserver`, `matchMedia`, `devicePixelRatio` and `getContext` stubbed, so no real canvas is touched. Do **not** add a temporary dev route, harness page or probe test. Real drawing is verified in Task 20.

Run:
```bash
pnpm --filter @tracks/types build
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__
pnpm --filter @tracks/web typecheck
```
Expected:
- The types build succeeds.
- Every Task 5-6 test file under `src/features/avatar/__tests__` passes, with 0 failed.
- `tsc --noEmit` exits 0 with no output.

- [ ] **Step 2: Write the consumer first: `AvatarSprite.tsx`**

The component never throws during render. The app uses a data router (`createHashRouter`), so React Router wraps the first route match (the AppShell route) in its own error boundary and renders its default "Unexpected Application Error!" element there. A thrown error would replace the whole AppShell, including the header and Sign out, and would never reach the Sentry `ErrorBoundary` in `App.tsx`.

A sheet that fails to load or draw is handled in the component instead:
- It is reported with `Sentry.captureException`.
- It is shown inline as a `role="alert"` message, styled like LoginPage's error box.
- The stage and canvas stay mounted, because `usePixelCanvas` needs both for the component's lifetime.

Create `apps/web/src/features/avatar/AvatarSprite.tsx`:
```tsx
import * as Sentry from '@sentry/react';
import { useEffect, useState } from 'react';
import type { AvatarAppearance } from '@tracks/types';
import { cn } from '../../lib/utils.js';
import { describeAppearance } from './appearance.js';
import { drawAvatar, loadAvatarSheets, type LoadedSheets } from './canvas.js';
import type { AnimationTag } from './frames.js';
import { usePixelCanvas } from './usePixelCanvas.js';

// The shared 64×64 avatar cell; its anchor pixel (32, 63) is the feet point.
const CELL = 64;
const FEET_X = 32;
const FEET_Y = 63;

interface LoadedAvatar {
  appearance: AvatarAppearance;
  sheets: LoadedSheets;
}

/**
 * One avatar on its own pixel-perfect 64×64 canvas, centered in a stage that fills the
 * parent (the parent must have a definite size). Draws `frame` (an offset within `tag`)
 * and never animates: RoomScene's rAF loop is the app's only animation driver.
 *
 * A failure to load or draw this appearance is reported to Sentry and shown inline as a
 * `role="alert"` message. It is never thrown: the data router's default error element
 * would replace the whole AppShell, and the error would never reach Sentry.
 */
export function AvatarSprite({
  appearance,
  tag,
  frame,
  className,
}: {
  appearance: AvatarAppearance;
  tag: AnimationTag;
  frame: number;
  className?: string;
}) {
  const { stageRef, canvasRef, generation } = usePixelCanvas(CELL, CELL);
  const [loaded, setLoaded] = useState<LoadedAvatar | null>(null);
  // The appearance whose sheets failed to load or draw. A new appearance (every picker
  // change is a new object) clears the message and gets its own attempt.
  const [failedFor, setFailedFor] = useState<AvatarAppearance | null>(null);

  useEffect(() => {
    let active = true;
    loadAvatarSheets(appearance).then(
      (sheets) => {
        if (active) setLoaded({ appearance, sheets });
      },
      (error: unknown) => {
        if (!active) return;
        Sentry.captureException(error);
        setFailedFor(appearance);
      },
    );
    return () => {
      active = false;
    };
  }, [appearance]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || loaded === null || generation === 0) return;
    if (failedFor === loaded.appearance) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.clearRect(0, 0, CELL, CELL);
    try {
      // Draw the appearance these sheets were loaded for; a newer one shows once it loads.
      drawAvatar(ctx, loaded.sheets, loaded.appearance, tag, frame, FEET_X, FEET_Y);
    } catch (error) {
      Sentry.captureException(error);
      setFailedFor(loaded.appearance);
    }
  }, [canvasRef, loaded, tag, frame, generation, failedFor]);

  const failed = failedFor === appearance;

  return (
    <div
      ref={stageRef}
      className={cn(
        'flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden',
        className,
      )}
    >
      {/* The canvas stays mounted while the message shows: usePixelCanvas needs it. */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={describeAppearance(appearance)}
        hidden={failed}
        className="shrink-0 [image-rendering:pixelated]"
      />
      {failed && (
        <p
          role="alert"
          className="max-w-full rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive"
        >
          Can&apos;t load the avatar preview.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run the typecheck and watch it fail**

Run:
```bash
pnpm --filter @tracks/web typecheck
```
Expected: the command exits non-zero with exactly these `tsc` errors:
```
src/features/avatar/AvatarSprite.tsx(6,65): error TS2307: Cannot find module './canvas.js' or its corresponding type declarations.
src/features/avatar/AvatarSprite.tsx(8,32): error TS2307: Cannot find module './usePixelCanvas.js' or its corresponding type declarations.
src/features/avatar/AvatarSprite.tsx(49,8): error TS7006: Parameter 'sheets' implicitly has an 'any' type.
```

- [ ] **Step 4: Implement the canvas adapter: `canvas.ts`**

Create `apps/web/src/features/avatar/canvas.ts`. It never uses `OffscreenCanvas`, and its only branches are:
- the cache lookup
- the missing-canvas throw
- the null-context guard
```ts
import type { AvatarAppearance } from '@tracks/types';
import type { AnimationTag } from './frames.js';
import { drawList } from './layers.js';
import { getSheet, type SheetData, type SheetId } from './sheets.js';
import { swapKey, swapPixels, type Swap } from './swap.js';

// Thin DOM adapter (spec §3 Rendering). What to draw is decided by the tested pure
// modules (drawList, swapPixels, swapKey, getSheet); this file only loads sheet images,
// applies each swap once, caches the result and blits it. jsdom has no canvas, so no unit
// test mounts this file: the e2e run and the visual captures cover real drawing.

/** Swapped sheet canvases keyed by `${sheet.id}|${swapKey(swap)}`. */
export type LoadedSheets = ReadonlyMap<string, HTMLCanvasElement>;

// Anchor pixel of the shared 64×64 avatar cell: centerline x = 32, ground row y = 63.
const ANCHOR_X = 32;
const ANCHOR_Y = 63;

// An empty swap maps nothing, so a sheet loaded with `null` keeps its exported colors.
const NO_SWAP: Swap = new Map<number, number>();

const cache = new Map<string, Promise<HTMLCanvasElement>>();

function sheetKey(id: SheetId, swap: Swap | null): string {
  return `${id}|${swapKey(swap)}`;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D context is unavailable');
  return ctx;
}

function loadImage(sheet: SheetData): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite sheet image "${sheet.id}"`));
    img.src = sheet.imageUrl;
  });
}

// A detached <canvas>, never an OffscreenCanvas: its 2D context needs Safari 16.4+,
// and Capacitor 8 supports iOS 15.
async function renderSheet(sheet: SheetData, swap: Swap | null): Promise<HTMLCanvasElement> {
  const img = await loadImage(sheet);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = context2d(canvas);
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(swapPixels(pixels.data, swap ?? NO_SWAP));
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/**
 * The sheet drawn onto a detached canvas with `swap` applied (`null` keeps the exported
 * colors). Cached per (sheet, swap), so each combination is decoded and swapped once.
 * A failed load is evicted, so a later mount can try again.
 */
export function loadSheetCanvas(sheet: SheetData, swap: Swap | null): Promise<HTMLCanvasElement> {
  const key = sheetKey(sheet.id, swap);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const pending = renderSheet(sheet, swap);
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  return pending;
}

/**
 * Loads every (sheet, swap) pair `drawAvatar` needs for `appearance`. The pairs come
 * from `drawList`, the same source `drawAvatar` reads, and do not depend on the tag or
 * frame, so any tag's frame 0 lists them.
 */
export async function loadAvatarSheets(
  appearance: AvatarAppearance,
  registry?: ReadonlyMap<SheetId, SheetData>,
): Promise<LoadedSheets> {
  const items = drawList(appearance, 'front-idle', 0, registry);
  const entries = await Promise.all(
    items.map(async (item): Promise<[string, HTMLCanvasElement]> => [
      sheetKey(item.sheet, item.swap),
      await loadSheetCanvas(getSheet(item.sheet, registry), item.swap),
    ]),
  );
  return new Map(entries);
}

/**
 * Draws the avatar's layers (body, shoes, bottom, top, hair) for `frameOffset` within
 * `tag`, with the cell's anchor pixel (32, 63) at (feetX, feetY) in art pixels.
 * `sheets` must come from `loadAvatarSheets` for this same appearance.
 */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  sheets: LoadedSheets,
  appearance: AvatarAppearance,
  tag: AnimationTag,
  frameOffset: number,
  feetX: number,
  feetY: number,
  registry?: ReadonlyMap<SheetId, SheetData>,
): void {
  for (const item of drawList(appearance, tag, frameOffset, registry)) {
    const key = sheetKey(item.sheet, item.swap);
    const source = sheets.get(key);
    if (source === undefined) throw new Error(`Sheet canvas "${key}" is not loaded`);
    const { x, y, w, h } = item.rect;
    ctx.drawImage(source, x, y, w, h, feetX - ANCHOR_X, feetY - ANCHOR_Y, w, h);
  }
}
```
Notes:
- `loadAvatarSheets` is `async`, so if `drawList` or `getSheet` throws inside it (for example, a sheet that was never exported), the result is a rejected promise. `AvatarSprite`'s rejection handler then reports it and shows the alert.
- `pixels.data.set(...)` copies the swapped pixels into the existing `ImageData`, so no second ImageData is allocated. (`swapPixels` returns `Uint8ClampedArray<ArrayBuffer>`, so `new ImageData(swapped, w, h)` would also typecheck.)

- [ ] **Step 5: Run the typecheck: only the hook is still missing**

Run:
```bash
pnpm --filter @tracks/web typecheck
```
Expected: the command exits non-zero with exactly one error:
```
src/features/avatar/AvatarSprite.tsx(8,32): error TS2307: Cannot find module './usePixelCanvas.js' or its corresponding type declarations.
```

- [ ] **Step 6: Write the failing `usePixelCanvas` re-size test**

This test covers the Review Focus item "Rotating a phone, resizing the window, or moving to a monitor with a different DPR must re-size the canvas crisply." It mounts the hook in a tiny harness component that attaches `stageRef` and `canvasRef` to real jsdom elements. It replaces the browser APIs the hook depends on:
- `ResizeObserver`: a fake that captures the callback. The test calls it with a `contentRect`, because the hook reads `entry.contentRect.width` and `entry.contentRect.height`.
- `window.matchMedia`: a fake that records each `(resolution: <dpr>dppx)` query, its `change` listener and its removals.
- `window.devicePixelRatio`: set with `vi.stubGlobal`.
- `HTMLCanvasElement.prototype.getContext`: a spy that returns a fake context `{ imageSmoothingEnabled: true, setTransform: vi.fn() }`. It is installed before any canvas mounts, so jsdom never prints "Not implemented: HTMLCanvasElement.prototype.getContext" (.claude/CLAUDE.md rule 26).

The harness renders `scale` and `generation` as data attributes, so the test reads what React committed. Every callback runs inside `act`, and `afterEach` fails the test on any `console.error`, such as an act warning.

Create `apps/web/src/features/avatar/__tests__/usePixelCanvas.test.tsx`:
```tsx
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { usePixelCanvas } from '../usePixelCanvas.js';

// jsdom has no ResizeObserver, no matchMedia and no canvas. This file stubs all three and
// sets devicePixelRatio, so the hook's sizing runs for real while nothing is drawn.

const NATIVE_W = 180;
const NATIVE_H = 120;

type ChangeListener = (event: MediaQueryListEvent) => void;

interface FakeQuery {
  media: string;
  listener: ChangeListener | null;
  removed: ChangeListener[];
}

interface FakeContext {
  imageSmoothingEnabled: boolean;
  setTransform: Mock;
}

let observers: FakeResizeObserver[] = [];
let queries: FakeQuery[] = [];
let ctx: FakeContext;
let consoleError: MockInstance<typeof console.error>;

class FakeResizeObserver {
  readonly callback: ResizeObserverCallback;
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

function fakeMatchMedia(media: string) {
  const query: FakeQuery = { media, listener: null, removed: [] };
  queries.push(query);
  return {
    media,
    matches: true,
    addEventListener: (_type: string, listener: ChangeListener) => {
      query.listener = listener;
    },
    removeEventListener: (_type: string, listener: ChangeListener) => {
      query.removed.push(listener);
    },
  };
}

function last<T>(items: T[]): T {
  const item = items[items.length - 1];
  if (item === undefined) throw new Error('expected at least one item');
  return item;
}

function Harness() {
  const { stageRef, canvasRef, scale, generation } = usePixelCanvas(NATIVE_W, NATIVE_H);
  return (
    <div ref={stageRef} data-testid="stage" data-scale={scale} data-generation={generation}>
      <canvas ref={canvasRef} data-testid="canvas" />
    </div>
  );
}

function mount() {
  const view = render(<Harness />);
  return {
    ...view,
    stage: screen.getByTestId('stage'),
    canvas: screen.getByTestId('canvas') as HTMLCanvasElement,
  };
}

/** One ResizeObserver callback for the stage's new CSS content box. */
function resizeStage(width: number, height: number): void {
  const observer = last(observers);
  act(() => {
    observer.callback(
      [{ contentRect: { width, height } } as unknown as ResizeObserverEntry],
      observer as unknown as ResizeObserver,
    );
  });
}

/** The window moves to a screen with a different DPR: the armed query stops matching. */
function changeDpr(dpr: number): void {
  vi.stubGlobal('devicePixelRatio', dpr);
  const query = last(queries);
  const listener = query.listener;
  if (listener === null) throw new Error(`no change listener on ${query.media}`);
  act(() => {
    listener({ matches: false, media: query.media } as MediaQueryListEvent);
  });
}

beforeEach(() => {
  observers = [];
  queries = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('matchMedia', fakeMatchMedia);
  vi.stubGlobal('devicePixelRatio', 2);
  ctx = { imageSmoothingEnabled: true, setTransform: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  consoleError = vi.spyOn(console, 'error');
});

afterEach(() => {
  cleanup();
  const errors = [...consoleError.mock.calls];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  expect(errors).toEqual([]);
});

describe('usePixelCanvas', () => {
  it('observes the stage, arms the DPR query and leaves the canvas alone until the first size', () => {
    const { stage, canvas } = mount();

    expect(last(observers).observed).toEqual([stage]);
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 2dppx)']);
    expect(stage.dataset.generation).toBe('0');
    expect(canvas.width).toBe(300); // the HTML default: not sized yet
    expect(ctx.setTransform).not.toHaveBeenCalled();
  });

  it('sizes the 180x120 room crisply on an iPhone SE stage (375x551 CSS at DPR 2)', () => {
    const { stage, canvas } = mount();

    resizeStage(375, 551); // k = floor(min(750 / 180, 1102 / 120)) = 4

    expect(canvas.width).toBe(720);
    expect(canvas.height).toBe(480);
    expect(canvas.style.width).toBe('360px');
    expect(canvas.style.height).toBe('240px');
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.setTransform).toHaveBeenCalledTimes(1);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(4, 0, 0, 4, 0, 0);
    expect(stage.dataset.scale).toBe('4');
    expect(stage.dataset.generation).toBe('1');
  });

  it('re-sizes when the phone rotates, and skips a resize that keeps k', () => {
    const { stage, canvas } = mount();
    resizeStage(375, 551);

    // The browser resets the context when the canvas is resized.
    ctx.imageSmoothingEnabled = true;
    resizeStage(667, 319); // landscape: k = floor(min(1334 / 180, 638 / 120)) = 5

    expect(canvas.width).toBe(900);
    expect(canvas.height).toBe(600);
    expect(canvas.style.width).toBe('450px');
    expect(canvas.style.height).toBe('300px');
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(5, 0, 0, 5, 0, 0);
    expect(stage.dataset.scale).toBe('5');
    expect(stage.dataset.generation).toBe('2');

    // A window resize that keeps k = 5 must not clear the canvas or bump generation.
    resizeStage(680, 330);

    expect(canvas.width).toBe(900);
    expect(ctx.setTransform).toHaveBeenCalledTimes(2);
    expect(stage.dataset.generation).toBe('2');
  });

  it('re-sizes when the window moves to a DPR 3 screen, and re-arms the DPR query', () => {
    const { stage, canvas } = mount();
    resizeStage(375, 551);
    const firstQuery = last(queries);

    ctx.imageSmoothingEnabled = true;
    changeDpr(3); // k = floor(min(1125 / 180, 1653 / 120)) = 6

    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(720);
    expect(canvas.style.width).toBe('360px');
    expect(canvas.style.height).toBe('240px');
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(6, 0, 0, 6, 0, 0);
    expect(stage.dataset.scale).toBe('6');
    expect(stage.dataset.generation).toBe('2');

    // The old query is disarmed and a new one watches the new DPR.
    expect(firstQuery.removed).toEqual([firstQuery.listener]);
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 2dppx)', '(resolution: 3dppx)']);
    expect(last(queries).listener).not.toBeNull();

    // The resize callback that follows a DPR change, with the same CSS box, is a no-op.
    resizeStage(375, 551);

    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(720);
    expect(ctx.setTransform).toHaveBeenCalledTimes(2);
    expect(stage.dataset.generation).toBe('2');
  });

  it('disconnects the observer and the DPR listener on unmount', () => {
    const { unmount } = mount();
    const observer = last(observers);
    const query = last(queries);

    unmount();

    expect(observer.disconnected).toBe(true);
    expect(query.removed).toEqual([query.listener]);
  });
});
```

- [ ] **Step 7: Run the test and watch it fail**

Run:
```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/usePixelCanvas.test.tsx
```
Expected: FAIL with `Error: Failed to resolve import "../usePixelCanvas.js" from "src/features/avatar/__tests__/usePixelCanvas.test.tsx". Does the file exist?` and `Tests  no tests`.

- [ ] **Step 8: Implement the pixel-canvas hook: `usePixelCanvas.ts`**

The resize path relies on two browser facts:
- Assigning `canvas.width` or `canvas.height` clears the bitmap, even when the value is unchanged.
- A `setState` called from a ResizeObserver callback gets React's default lane, so the redraw effect would only run in a later task, after the browser has painted the blank canvas.

The hook handles both:
- It returns early when neither k nor the DPR changed, so there is no clear and no `generation` bump.
- On a real resize, it commits `scale` and `generation` inside `flushSync`. React flushes a sync-lane commit's passive effects at once, so the caller redraws inside the same callback, before paint.

Create `apps/web/src/features/avatar/usePixelCanvas.ts`:
```ts
import { useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { fitScale } from './fitScale.js';

/**
 * Pixel-perfect sizing for one canvas of native size nativeW×nativeH (spec §3 Rendering).
 *
 * Attach `stageRef` to a container and `canvasRef` to a <canvas> inside it; both stay
 * mounted for the component's lifetime. The stage must take its size from its parent,
 * never from the canvas. On every ResizeObserver callback for the stage, and on every
 * devicePixelRatio change:
 * - k = fitScale(stage content box width, height, dpr, nativeW, nativeH)
 * - backing store nativeW·k × nativeH·k; CSS size = backing ÷ dpr, so each art pixel is
 *   exactly k device pixels
 * - imageSmoothingEnabled = false and setTransform(k, 0, 0, k, 0, 0) again, because
 *   resizing resets the context; callers draw in art-pixel coordinates
 *
 * Resizing also clears the canvas, so `generation` increments after every resize and
 * callers redraw when it changes. It stays 0 until the first size is applied. A callback
 * that changes neither k nor the DPR leaves the canvas, and `generation`, untouched.
 */
export function usePixelCanvas(
  nativeW: number,
  nativeH: number,
): {
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  scale: number;
  generation: number;
} {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (stage === null || canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('Canvas 2D context is unavailable');

    // Set by the observer, whose first callback fires as soon as observe() is called.
    let availW = 0;
    let availH = 0;
    let applied: { k: number; dpr: number } | null = null;
    let media: MediaQueryList | null = null;

    const resize = (): void => {
      const dpr = window.devicePixelRatio;
      const k = fitScale(availW, availH, dpr, nativeW, nativeH);
      // Assigning canvas.width or height clears the bitmap even when the value is the
      // same, so a callback that changes neither k nor the DPR must not touch the canvas.
      if (applied !== null && applied.k === k && applied.dpr === dpr) return;
      applied = { k, dpr };
      canvas.width = nativeW * k;
      canvas.height = nativeH * k;
      canvas.style.width = `${(nativeW * k) / dpr}px`;
      canvas.style.height = `${(nativeH * k) / dpr}px`;
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      // The canvas is blank now. flushSync commits on the sync lane, and React then
      // flushes that commit's passive effects at once, so callers' redraw effects run
      // inside this callback, before the browser paints the cleared canvas.
      flushSync(() => {
        setScale(k);
        setGeneration((g) => g + 1);
      });
    };

    // A resolution query matches only the DPR it was built with. When it stops
    // matching, re-arm it for the new DPR and resize.
    const onDprChange = (): void => {
      watchDpr();
      resize();
    };
    const watchDpr = (): void => {
      media?.removeEventListener('change', onDprChange);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      media.addEventListener('change', onDprChange);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        availW = entry.contentRect.width;
        availH = entry.contentRect.height;
      }
      resize();
    });
    observer.observe(stage);
    watchDpr();

    return () => {
      observer.disconnect();
      media?.removeEventListener('change', onDprChange);
    };
  }, [nativeW, nativeH]);

  return { stageRef, canvasRef, scale, generation };
}
```

- [ ] **Step 9: Run the `usePixelCanvas` test and watch it pass**

Run:
```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/usePixelCanvas.test.tsx
```
Expected: `Test Files  1 passed (1)`, `Tests  5 passed (5)`. No `Not implemented` line and no act warning prints.

- [ ] **Step 10: Run the typecheck and watch it pass**

Run:
```bash
pnpm --filter @tracks/web typecheck
```
Expected: `tsc --noEmit` exits 0 with no errors.

- [ ] **Step 11: Lint and check for forbidden APIs and render-time throws**

Run:
```bash
pnpm --filter @tracks/web lint
grep -nE "new OffscreenCanvas|fetch\(|h-screen|100vh" apps/web/src/features/avatar/canvas.ts apps/web/src/features/avatar/usePixelCanvas.ts apps/web/src/features/avatar/AvatarSprite.tsx
grep -nw throw apps/web/src/features/avatar/AvatarSprite.tsx
```
Expected:
- `eslint .` exits 0 with no problems reported.
- The first `grep` prints nothing and exits 1: no OffscreenCanvas, no raw fetch, no `h-screen` or `100vh`.
- The second `grep` prints nothing and exits 1. `AvatarSprite` has no `throw` statement, so no error from it can reach React Router's default error element.

- [ ] **Step 12: Run the whole web suite and confirm jsdom never touches a real canvas**

Run:
```bash
pnpm --filter @tracks/web test 2>&1 | grep -E "Test Files|Tests |Not implemented|FAIL"
```
Expected:
- Only the `Test Files  N passed (N)` and `Tests  M passed (M)` summary lines print.
- No `FAIL` line appears.
- No `Not implemented: HTMLCanvasElement.prototype.getContext` line appears (.claude/CLAUDE.md rule 26). `usePixelCanvas.test.tsx` stubs `getContext` before its harness mounts, and no other jsdom test mounts these modules.

- [ ] **Step 13: Commit (only the four files; nothing temporary)**

Run:
```bash
git status --porcelain
```
Expected: exactly these lines. If anything else shows up (a harness, dev route or probe test), remove it first; it must not be committed.
```
?? apps/web/src/features/avatar/AvatarSprite.tsx
?? apps/web/src/features/avatar/__tests__/usePixelCanvas.test.tsx
?? apps/web/src/features/avatar/canvas.ts
?? apps/web/src/features/avatar/usePixelCanvas.ts
```
Then, on branch `feat/avatar-room`, run:
```bash
git add apps/web/src/features/avatar/canvas.ts apps/web/src/features/avatar/usePixelCanvas.ts apps/web/src/features/avatar/AvatarSprite.tsx apps/web/src/features/avatar/__tests__/usePixelCanvas.test.tsx
git commit -F - <<'EOF'
Add avatar canvas adapter, pixel-canvas hook and AvatarSprite

canvas.ts loads each sprite sheet onto a detached canvas, applies its
palette swap once per (sheet, swap) through swapPixels, caches the
result and draws the drawList layers with the cell anchor (32, 63) on
the feet point.

usePixelCanvas sizes a canvas to an integer number of device pixels
per art pixel. When a stage resize or DPR change alters k or the DPR,
it re-applies imageSmoothingEnabled = false and the k-times transform
and bumps generation inside flushSync, so callers redraw before the
cleared canvas is painted. Callbacks that change neither are skipped.

AvatarSprite wraps both as a role="img" canvas labelled with
describeAppearance. A sheet that fails to load or draw is reported to
Sentry and shown as an inline alert instead of being thrown, because
the data router's default error element would replace the AppShell.

usePixelCanvas.test.tsx stubs ResizeObserver, matchMedia,
devicePixelRatio and getContext, and checks that a rotation, a window
resize and a DPR change re-size the canvas crisply, while a callback
that keeps k is skipped. jsdom has no canvas, so no unit test draws
with canvas.ts or AvatarSprite; their decisions live in the tested pure
modules. Real drawing is verified by the e2e run and the device
captures.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```
Expected: one commit with 4 files changed. `git status --porcelain` is then empty.

---

### Task 9: Avatar data hooks (useAvatar, useSaveAvatar)

**Files:**
- Create: `apps/web/src/features/avatar/useAvatar.ts`
- Test: `apps/web/src/features/avatar/__tests__/useAvatar.test.tsx`

**Interfaces:**
Consumes:
- `@tracks/types` (Task 2, consumed from `packages/types/dist`): `ApiErrorSchema`, `type ApiSuccess<T>`, `type Avatar`, `type AvatarAppearance`
- `apps/web/src/lib/api.ts`: `api.get<T>(path: string): Promise<T>`, `api.put<T>(path: string, body?: unknown): Promise<T>` (unchanged; throws the parsed JSON error body, or `{ success: false, error: { code: 'UNKNOWN', message: res.statusText } }` when the body is not JSON)
- `apps/web/src/store/auth.store.ts`: `useAuthStore((s) => s.user)` (`User | null`); never `useAuth()`
- API (Task 4): `GET /avatar` returns 200 `ApiSuccess<Avatar>`, or 404 `{ success: false, error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' } }`; `PUT /avatar` takes the body `AvatarAppearance` and returns 200 `ApiSuccess<Avatar>`

Produces (`apps/web/src/features/avatar/useAvatar.ts`):
- `avatarQueryKey(userId: string | undefined): readonly ['avatar', string | undefined]`, which returns `['avatar', userId]`
- `isAvatarNotFound(err: unknown): boolean`: `ApiErrorSchema.safeParse(err)` succeeds and `error.code === 'AVATAR_NOT_FOUND'`
- `useAvatar(): UseQueryResult<Avatar | null>`: key `avatarQueryKey(user?.id)`, `enabled: !!user`. The queryFn returns the unwrapped `Avatar`, returns `null` for AVATAR_NOT_FOUND, and rethrows anything else.
- `useSaveAvatar(): UseMutationResult<ApiSuccess<Avatar>, unknown, AvatarAppearance>`: calls `api.put('/avatar', appearance)`. Its hook-level `onSuccess` calls `queryClient.setQueryData(avatarQueryKey(user?.id), res.data)`, and this runs before `mutateAsync` resolves and before any call-level `onSuccess`. That ordering means the cache is written before the creator navigates.

- [ ] **Step 1: Confirm the branch and that the avatar types are built**

Run from the repo root (Git Bash):

```bash
git branch --show-current
pnpm --filter @tracks/types build
grep -c "AvatarAppearanceSchema" packages/types/dist/index.d.ts
```

Expected: `feat/avatar-room`. The build exits 0, and the grep prints a number of at least `1`. Task 2's exports are in dist, which is what apps/web resolves `@tracks/types` from.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/features/avatar/__tests__/useAvatar.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Avatar, AvatarAppearance } from '@tracks/types';
import type { User } from '../../../lib/supabase.js';

vi.mock('../../../lib/api.js', () => ({
  api: { get: vi.fn(), put: vi.fn() },
}));

import { api } from '../../../lib/api.js';
import { useAuthStore } from '../../../store/auth.store.js';
import {
  avatarQueryKey,
  isAvatarNotFound,
  useAvatar,
  useSaveAvatar,
} from '../useAvatar.js';

const get = vi.mocked(api.get);
const put = vi.mocked(api.put);

function makeUser(id: string, email: string): User {
  return {
    id,
    email,
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-10-04T12:00:00.000Z',
  };
}

const USER_A = makeUser('00000000-0000-4000-8000-00000000000a', 'a@example.test');
const USER_B = makeUser('00000000-0000-4000-8000-00000000000b', 'b@example.test');

const APPEARANCE_A: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'black',
  top: 'starter-tee-red',
  bottom: 'starter-shorts-navy',
  shoes: 'starter-shoes-white',
};

const AVATAR_A: Avatar = {
  ...APPEARANCE_A,
  created_at: '2026-10-04T12:00:00+00:00',
  updated_at: '2026-10-04T12:00:00+00:00',
};

const NOT_FOUND = {
  success: false,
  error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' },
};
const UNKNOWN = {
  success: false,
  error: { code: 'UNKNOWN', message: 'Not Found' },
};

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  get.mockReset();
  put.mockReset();
  useAuthStore.setState({ session: null, user: null });
});

afterEach(cleanup);
afterEach(() => {
  client.clear();
});

describe('avatarQueryKey', () => {
  it('scopes the key by user id', () => {
    expect(avatarQueryKey('u1')).toEqual(['avatar', 'u1']);
    expect(avatarQueryKey(undefined)).toEqual(['avatar', undefined]);
  });
});

describe('isAvatarNotFound', () => {
  it('is true only for an ApiError envelope with code AVATAR_NOT_FOUND', () => {
    expect(isAvatarNotFound(NOT_FOUND)).toBe(true);
    expect(isAvatarNotFound(UNKNOWN)).toBe(false);
    expect(isAvatarNotFound(new TypeError('Failed to fetch'))).toBe(false);
    expect(isAvatarNotFound({ code: 'AVATAR_NOT_FOUND' })).toBe(false);
    expect(isAvatarNotFound('AVATAR_NOT_FOUND')).toBe(false);
    expect(isAvatarNotFound(null)).toBe(false);
  });
});

describe('useAvatar', () => {
  it('returns the unwrapped avatar from GET /avatar', async () => {
    get.mockResolvedValue({ success: true, data: AVATAR_A });
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(AVATAR_A);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/avatar');
    expect(client.getQueryData(avatarQueryKey(USER_A.id))).toEqual(AVATAR_A);
  });

  it('resolves to null (a success, not an error) for AVATAR_NOT_FOUND', async () => {
    get.mockRejectedValue(NOT_FOUND);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('is an error for an ApiError with code UNKNOWN (e.g. a static host 404 page)', async () => {
    get.mockRejectedValue(UNKNOWN);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(UNKNOWN);
    expect(result.current.data).toBeUndefined();
  });

  it('is an error when the request itself fails with a TypeError', async () => {
    const networkError = new TypeError('Failed to fetch');
    get.mockRejectedValue(networkError);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(networkError);
    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch without a signed-in user, then fetches once one signs in', async () => {
    get.mockResolvedValue({ success: true, data: AVATAR_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.current.status).toBe('pending');
    expect(result.current.fetchStatus).toBe('idle');
    expect(get).not.toHaveBeenCalled();

    act(() => {
      useAuthStore.setState({ user: USER_A });
    });

    await waitFor(() => expect(result.current.data).toEqual(AVATAR_A));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('refetches under the new key when a different user signs in', async () => {
    get
      .mockResolvedValueOnce({ success: true, data: AVATAR_A })
      .mockRejectedValueOnce(NOT_FOUND);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(AVATAR_A));

    act(() => {
      useAuthStore.setState({ user: USER_B });
    });

    await waitFor(() => expect(result.current.data).toBeNull());
    expect(result.current.isSuccess).toBe(true);
    expect(get).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(avatarQueryKey(USER_A.id))).toEqual(AVATAR_A);
    expect(client.getQueryData(avatarQueryKey(USER_B.id))).toBeNull();
  });
});

describe('useSaveAvatar', () => {
  it("PUTs the appearance and writes the saved avatar into the user's cache without another GET", async () => {
    get.mockRejectedValue(NOT_FOUND);
    put.mockResolvedValue({ success: true, data: AVATAR_A });
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(
      () => ({ avatar: useAvatar(), save: useSaveAvatar() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.avatar.isSuccess).toBe(true));
    expect(result.current.avatar.data).toBeNull();

    await act(async () => {
      await result.current.save.mutateAsync(APPEARANCE_A);
    });

    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/avatar', APPEARANCE_A);
    expect(client.getQueryData(avatarQueryKey(USER_A.id))).toEqual(AVATAR_A);
    await waitFor(() => expect(result.current.avatar.data).toEqual(AVATAR_A));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('leaves the cache unchanged when the save fails', async () => {
    const saveError = {
      success: false,
      error: { code: 'FST_ERR_VALIDATION', message: 'body/top must be equal to one of the allowed values' },
    };
    get.mockRejectedValue(NOT_FOUND);
    put.mockRejectedValue(saveError);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(
      () => ({ avatar: useAvatar(), save: useSaveAvatar() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.avatar.isSuccess).toBe(true));

    await act(async () => {
      await expect(result.current.save.mutateAsync(APPEARANCE_A)).rejects.toEqual(saveError);
    });

    expect(client.getQueryData(avatarQueryKey(USER_A.id))).toBeNull();
    expect(result.current.avatar.data).toBeNull();
  });
});
```

Notes:
- The `vi.mock` factory replaces `api.ts` completely, so `@capacitor/core` and `lib/supabase.ts` never load. `User` is a type-only import and is erased.
- `auth.store.ts` imports only types from `lib/supabase.ts`, so it needs no mock either.

- [ ] **Step 3: Run the test and confirm it fails**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/useAvatar.test.tsx
```

Expected: FAIL with
`Error: Failed to resolve import "../useAvatar.js" from "src/features/avatar/__tests__/useAvatar.test.tsx". Does the file exist?`
followed by `Test Files  1 failed (1)` and `Tests  no tests`.

- [ ] **Step 4: Implement the hooks**

Create `apps/web/src/features/avatar/useAvatar.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ApiErrorSchema } from '@tracks/types';
import type { ApiSuccess, Avatar, AvatarAppearance } from '@tracks/types';
import { api } from '../../lib/api.js';
import { useAuthStore } from '../../store/auth.store.js';

/**
 * Cache key for one user's avatar. Scoped by user id so a different user
 * signing in on the same device gets a fresh entry and a new GET.
 */
export function avatarQueryKey(
  userId: string | undefined,
): readonly ['avatar', string | undefined] {
  return ['avatar', userId] as const;
}

/**
 * True only when a value thrown by api.ts is the API's "no avatar yet" error.
 * Classifies by error code, never by HTTP status: api.ts does not expose the
 * status, and a static host's HTML 404 arrives as code UNKNOWN, which must
 * stay an error.
 */
export function isAvatarNotFound(err: unknown): boolean {
  const parsed = ApiErrorSchema.safeParse(err);
  return parsed.success && parsed.data.error.code === 'AVATAR_NOT_FOUND';
}

/**
 * The signed-in user's avatar. Resolves to null (a success, so it is neither
 * retried nor reported to Sentry) when the user has not created one yet.
 * Every other failure is rethrown and surfaces as the query's error.
 */
export function useAvatar(): UseQueryResult<Avatar | null> {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: avatarQueryKey(user?.id),
    queryFn: async (): Promise<Avatar | null> => {
      try {
        const res = await api.get<ApiSuccess<Avatar>>('/avatar');
        return res.data;
      } catch (err) {
        if (isAvatarNotFound(err)) return null;
        throw err;
      }
    },
    enabled: !!user,
  });
}

/**
 * Saves the full appearance with PUT /avatar. On success the saved avatar is
 * written into the user's cache entry before the caller navigates, so the
 * room shows it without another GET despite the app-wide staleTime.
 */
export function useSaveAvatar(): UseMutationResult<
  ApiSuccess<Avatar>,
  unknown,
  AvatarAppearance
> {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  return useMutation<ApiSuccess<Avatar>, unknown, AvatarAppearance>({
    mutationFn: (appearance) => api.put<ApiSuccess<Avatar>>('/avatar', appearance),
    onSuccess: (res) => {
      queryClient.setQueryData<Avatar | null>(avatarQueryKey(user?.id), res.data);
    },
  });
}
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/useAvatar.test.tsx
```

Expected: `Test Files  1 passed (1)` and `Tests  10 passed (10)`, with no `act(...)` warnings and no stderr output.

- [ ] **Step 6: Typecheck, lint and run the full web suite**

```bash
pnpm --filter @tracks/web typecheck
pnpm --filter @tracks/web lint
pnpm --filter @tracks/web test
```

Expected: `tsc --noEmit` and `eslint .` both exit 0 with no output. The test file is under `src`, so it is typechecked with strict, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Every web test file passes. If anything prints a warning or error, fix it before committing (rule 26).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/avatar/useAvatar.ts apps/web/src/features/avatar/__tests__/useAvatar.test.tsx
git commit -F - <<'EOF'
Add useAvatar and useSaveAvatar data hooks

useAvatar keys the query by the signed-in user's id and is enabled only
when a user is present, so a different user on the same device refetches.
AVATAR_NOT_FOUND (matched by error code, never HTTP status) resolves to
null as a success; every other failure, including UNKNOWN and network
TypeErrors, stays an error. useSaveAvatar PUTs the appearance and writes
the saved avatar into the user's cache entry before the caller navigates.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

---

### Task 10: Creator page

**Files:**
- Create: `apps/web/src/features/avatar-creator/__tests__/CreatorPage.test.tsx`
- Create: `apps/web/src/features/avatar-creator/OptionGroup.tsx`
- Create: `apps/web/src/features/avatar-creator/CreatorPage.tsx`
- Modify: `docs/superpowers/specs/2026-10-04-athlete-avatar-room-design.md` (section 3 option label sizing, Step 9)

**Interfaces:**
Consumes:
- `@tracks/types`: `Avatar`, `AvatarAppearance`, `ApiSuccess` (types)
- `features/avatar/appearance.ts`: `DEFAULT_APPEARANCE`, `describeAppearance(a: AvatarAppearance): string`, `randomAppearance(rng: () => number): AvatarAppearance`
- `features/avatar/catalog.ts`: `SKIN_TONE_OPTIONS`, `HAIR_STYLE_OPTIONS`, `HAIR_COLOR_OPTIONS`, `TOP_OPTIONS`, `BOTTOM_OPTIONS`, `SHOES_OPTIONS`
- `features/avatar/palette.ts`: `SKIN_RAMPS`, `HAIR_RAMPS`, `CLOTH_RAMPS`, `rampToCss(ramp: Ramp): string`
- `features/avatar/AvatarSprite.tsx`: `AvatarSprite(props: { appearance: AvatarAppearance; tag: AnimationTag; frame: number; className?: string })`
- `features/avatar/useAvatar.ts`: `useAvatar(): UseQueryResult<Avatar | null>`, `useSaveAvatar(): UseMutationResult<ApiSuccess<Avatar>, unknown, AvatarAppearance>`, `avatarQueryKey(userId: string | undefined)` (test only)
- `store/auth.store.ts`: `useAuthStore` (the test seeds `user`); `lib/api.ts`: `api` (mocked in the test)
- `components/ui/button.tsx`: `Button`; `components/ui/skeleton.tsx`: `Skeleton`; `lib/utils.ts`: `cn`

Produces:
- `apps/web/src/features/avatar-creator/CreatorPage.tsx`: `export function CreatorPage()`
- `apps/web/src/features/avatar-creator/OptionGroup.tsx`: `export function OptionGroup<T extends string>(props: { legend: string; name: string; options: Record<T, { label: string }>; value: T; onChange: (v: T) => void; swatch?: (v: T) => string })`

- [ ] **Step 1: Write the failing CreatorPage test**

Create `apps/web/src/features/avatar-creator/__tests__/CreatorPage.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ApiSuccess, Avatar, AvatarAppearance } from '@tracks/types';
import type { User } from '../../../lib/supabase.js';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('../../../lib/api.js', () => ({
  api: { get, put },
}));

// jsdom has no canvas: the real <AvatarSprite> never mounts (.claude/CLAUDE.md rule 26).
vi.mock('../../avatar/AvatarSprite.js', async () => {
  const { describeAppearance } = await import('../../avatar/appearance.js');
  return {
    AvatarSprite: (props: { appearance: AvatarAppearance; tag: string; frame: number }) => (
      <div
        role="img"
        aria-label={describeAppearance(props.appearance)}
        data-tag={props.tag}
        data-frame={props.frame}
      />
    ),
  };
});

import { useAuthStore } from '../../../store/auth.store.js';
import { DEFAULT_APPEARANCE, describeAppearance } from '../../avatar/appearance.js';
import {
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from '../../avatar/catalog.js';
import { CLOTH_RAMPS, HAIR_RAMPS, SKIN_RAMPS, rampToCss } from '../../avatar/palette.js';
import { avatarQueryKey } from '../../avatar/useAvatar.js';
import { CreatorPage } from '../CreatorPage.js';

const USER = { id: 'user-a' } as User;

const LEGENDS: Record<keyof AvatarAppearance, string> = {
  skin_tone: 'Skin tone',
  hair_style: 'Hair style',
  hair_color: 'Hair color',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
};

const FIELD_OPTIONS: Record<keyof AvatarAppearance, Record<string, { label: string }>> = {
  skin_tone: SKIN_TONE_OPTIONS,
  hair_style: HAIR_STYLE_OPTIONS,
  hair_color: HAIR_COLOR_OPTIONS,
  top: TOP_OPTIONS,
  bottom: BOTTOM_OPTIONS,
  shoes: SHOES_OPTIONS,
};

const NOT_FOUND = {
  success: false,
  error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' },
};

const EDIT_APPEARANCE: AvatarAppearance = {
  skin_tone: 'tone-4',
  hair_style: 'curly',
  hair_color: 'auburn',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};

function avatarOf(appearance: AvatarAppearance): Avatar {
  return {
    ...appearance,
    created_at: '2026-10-04T12:00:00+00:00',
    updated_at: '2026-10-04T12:00:00+00:00',
  };
}

function renderCreator(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/create']}>
        <Routes>
          <Route path="/" element={<p>Room stub</p>} />
          <Route path="/create" element={<CreatorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return queryClient;
}

async function renderNewUser(): Promise<QueryClient> {
  get.mockRejectedValue(NOT_FOUND);
  const queryClient = renderCreator();
  await screen.findByRole('group', { name: 'Skin tone' });
  return queryClient;
}

async function renderExistingUser(appearance: AvatarAppearance): Promise<QueryClient> {
  get.mockResolvedValue({ success: true, data: avatarOf(appearance) });
  const queryClient = renderCreator();
  await screen.findByRole('group', { name: 'Skin tone' });
  return queryClient;
}

function group(legend: string): HTMLElement {
  return screen.getByRole('group', { name: legend });
}

function radio(legend: string, label: string): HTMLElement {
  return within(group(legend)).getByRole('radio', { name: label });
}

function swatchOf(legend: string, label: string): HTMLElement | null {
  return radio(legend, label).closest('label')?.querySelector<HTMLElement>('span[style]') ?? null;
}

function checkedAppearance(): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(LEGENDS).map(([field, legend]) => [
      field,
      within(group(legend)).getByRole('radio', { checked: true }).getAttribute('value'),
    ])
  );
}

describe('CreatorPage', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    useAuthStore.setState({ user: USER });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null });
  });

  it('fills the preview box with a skeleton and renders no pickers while the avatar loads', async () => {
    get.mockReturnValue(new Promise(() => {}));
    renderCreator();

    const skeleton = screen.getByRole('status', { name: 'Loading your athlete' });
    expect(skeleton.parentElement).toHaveClass('h-[40dvh]', 'w-full', 'shrink-0');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/avatar'));
  });

  it('starts a new user from DEFAULT_APPEARANCE with a static front-idle preview and no Cancel', async () => {
    await renderNewUser();

    expect(screen.getByRole('heading', { name: 'Create your athlete' })).toBeInTheDocument();
    expect(checkedAppearance()).toEqual(DEFAULT_APPEARANCE);
    const preview = screen.getByRole('img', { name: describeAppearance(DEFAULT_APPEARANCE) });
    expect(preview).toHaveAttribute('data-tag', 'front-idle');
    expect(preview).toHaveAttribute('data-frame', '0');
    expect(screen.queryByRole('link', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps the preview box fixed above a scrolling region that holds the pickers and buttons', async () => {
    await renderNewUser();

    const previewBox = screen.getByRole('img').parentElement;
    expect(previewBox).toHaveClass('h-[40dvh]', 'w-full', 'shrink-0');
    expect(previewBox?.parentElement).toHaveClass('flex', 'h-full', 'flex-col', 'p-4');
    const scroller = group('Skin tone').closest('.overflow-y-auto');
    expect(scroller).toHaveClass('min-h-0', 'flex-1');
    expect(scroller).toContainElement(screen.getByRole('button', { name: 'Save' }));
    expect(scroller).not.toContainElement(screen.getByRole('img'));
  });

  it('renders one fieldset per field, in order, with every catalog option as a full-size radio', async () => {
    await renderNewUser();

    const legends = screen
      .getAllByRole('group')
      .map((fieldset) => fieldset.querySelector('legend')?.textContent);
    expect(legends).toEqual(Object.values(LEGENDS));

    for (const [field, legend] of Object.entries(LEGENDS) as [keyof AvatarAppearance, string][]) {
      const scope = within(group(legend));
      const options = FIELD_OPTIONS[field];
      expect(scope.getAllByRole('radio')).toHaveLength(Object.keys(options).length);
      for (const [id, option] of Object.entries(options)) {
        const input = scope.getByRole('radio', { name: option.label });
        expect(input).toHaveAttribute('value', id);
        expect(input).toHaveAttribute('name', field);
        expect(input).toHaveClass(
          'peer',
          'absolute',
          'inset-0',
          'm-0',
          'cursor-pointer',
          'opacity-0'
        );
        expect(input).not.toHaveClass('sr-only');
        // The radio is invisible, so the face after it must show selection and
        // keyboard focus: a foreground border ring when checked, a focus ring.
        expect(input.nextElementSibling).toHaveClass(
          'peer-checked:border-foreground',
          'peer-focus-visible:ring-[3px]',
          'peer-focus-visible:ring-ring/50'
        );
        // A 44px tap area: square for swatches, at least 44px wide for text.
        const size = field === 'hair_style' ? ['h-11', 'min-w-11'] : ['size-11'];
        const label = input.closest('label');
        expect(label).toHaveClass('relative', ...size);
        expect(label?.parentElement).toHaveClass('flex', 'flex-wrap', 'gap-2');
      }
    }
  });

  it('shows ramp swatches for skin, hair color and clothing, and the label text for hair style', async () => {
    await renderNewUser();

    expect(swatchOf('Skin tone', SKIN_TONE_OPTIONS['tone-3'].label)).toHaveStyle({
      backgroundColor: rampToCss(SKIN_RAMPS['tone-3']),
    });
    expect(swatchOf('Hair color', HAIR_COLOR_OPTIONS.blonde.label)).toHaveStyle({
      backgroundColor: rampToCss(HAIR_RAMPS.blonde),
    });
    expect(swatchOf('Top', TOP_OPTIONS['starter-tee-blue'].label)).toHaveStyle({
      backgroundColor: rampToCss(CLOTH_RAMPS['starter-tee-blue']),
    });
    expect(swatchOf('Bottom', BOTTOM_OPTIONS['starter-shorts-black'].label)).toHaveStyle({
      backgroundColor: rampToCss(CLOTH_RAMPS['starter-shorts-black']),
    });
    expect(swatchOf('Shoes', SHOES_OPTIONS['starter-shoes-red'].label)).toHaveStyle({
      backgroundColor: rampToCss(CLOTH_RAMPS['starter-shoes-red']),
    });

    const curly = radio('Hair style', HAIR_STYLE_OPTIONS.curly.label).closest('label');
    expect(curly).toHaveTextContent(HAIR_STYLE_OPTIONS.curly.label);
    expect(curly?.querySelector('span[style]')).toBeNull();
  });

  it('updates the static preview when a picker changes', async () => {
    await renderNewUser();

    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.blonde.label));

    const chosen: AvatarAppearance = { ...DEFAULT_APPEARANCE, hair_color: 'blonde' };
    expect(checkedAppearance()).toEqual(chosen);
    const preview = screen.getByRole('img', { name: describeAppearance(chosen) });
    expect(preview).toHaveAttribute('data-tag', 'front-idle');
    expect(preview).toHaveAttribute('data-frame', '0');
  });

  it('prefills every picker from the saved avatar in edit mode', async () => {
    await renderExistingUser(EDIT_APPEARANCE);

    expect(screen.getByRole('heading', { name: 'Edit your athlete' })).toBeInTheDocument();
    expect(checkedAppearance()).toEqual(EDIT_APPEARANCE);
    expect(
      screen.getByRole('img', { name: describeAppearance(EDIT_APPEARANCE) })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveClass('min-h-11');
  });

  it('Cancel returns to the room without saving', async () => {
    await renderExistingUser(EDIT_APPEARANCE);
    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.blonde.label));

    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('Save sends only the six fields, is disabled while pending, writes the cache and navigates', async () => {
    const queryClient = await renderExistingUser(EDIT_APPEARANCE);
    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.blonde.label));
    fireEvent.click(radio('Top', TOP_OPTIONS['starter-tee-green'].label));
    const chosen: AvatarAppearance = {
      ...EDIT_APPEARANCE,
      hair_color: 'blonde',
      top: 'starter-tee-green',
    };
    let resolvePut: (value: ApiSuccess<Avatar>) => void = () => {};
    put.mockReturnValue(
      new Promise<ApiSuccess<Avatar>>((resolve) => {
        resolvePut = resolve;
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
    await waitFor(() => expect(put).toHaveBeenCalledWith('/avatar', chosen));
    expect(put).toHaveBeenCalledTimes(1);

    resolvePut({ success: true, data: avatarOf(chosen) });

    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(queryClient.getQueryData(avatarQueryKey(USER.id))).toEqual(avatarOf(chosen));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("replaces a new user's cached null with the saved avatar before navigating", async () => {
    const queryClient = await renderNewUser();
    expect(queryClient.getQueryData(avatarQueryKey(USER.id))).toBeNull();
    put.mockResolvedValue({ success: true, data: avatarOf(DEFAULT_APPEARANCE) });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(put).toHaveBeenCalledWith('/avatar', DEFAULT_APPEARANCE);
    expect(queryClient.getQueryData(avatarQueryKey(USER.id))).toEqual(avatarOf(DEFAULT_APPEARANCE));
  });

  it('keeps the choices and shows an inline alert above the buttons when the save fails', async () => {
    await renderNewUser();
    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.red.label));
    fireEvent.click(radio('Shoes', SHOES_OPTIONS['starter-shoes-black'].label));
    const chosen: AvatarAppearance = {
      ...DEFAULT_APPEARANCE,
      hair_color: 'red',
      shoes: 'starter-shoes-black',
    };
    put.mockRejectedValue(new TypeError('Failed to fetch'));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't save your athlete. Try again.");
    expect(alert).toHaveClass(
      'rounded-md',
      'bg-destructive/10',
      'p-3',
      'text-sm',
      'text-destructive'
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    expect(alert.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(checkedAppearance()).toEqual(chosen);
    expect(screen.getByRole('img', { name: describeAppearance(chosen) })).toBeInTheDocument();
    expect(screen.queryByText('Room stub')).not.toBeInTheDocument();
  });

  it('Randomize picks every field from its own options without saving', async () => {
    await renderNewUser();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.999);

    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));

    const last: AvatarAppearance = {
      skin_tone: 'tone-6',
      hair_style: 'ponytail',
      hair_color: 'blue',
      top: 'starter-tee-green',
      bottom: 'starter-shorts-gray',
      shoes: 'starter-shoes-red',
    };
    expect(random).toHaveBeenCalledTimes(6);
    expect(checkedAppearance()).toEqual(last);
    expect(screen.getByRole('img', { name: describeAppearance(last) })).toBeInTheDocument();

    random.mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));

    expect(checkedAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    { cause: 'a network failure', failure: new TypeError('Failed to fetch') },
    {
      cause: 'an UNKNOWN error (Pages HTML 404)',
      failure: { success: false, error: { code: 'UNKNOWN', message: 'Not Found' } },
    },
  ])("shows Can't reach the server for $cause, and Retry refetches", async ({ failure }) => {
    get.mockRejectedValueOnce(failure).mockRejectedValueOnce(NOT_FOUND);
    renderCreator();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach the server");
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry).toHaveClass('min-h-11');

    fireEvent.click(retry);

    expect(await screen.findByRole('group', { name: 'Skin tone' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
    expect(checkedAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(screen.queryByText('Room stub')).not.toBeInTheDocument();
  });

  it('keeps the form and the unsaved picks when a background refetch fails', async () => {
    const queryClient = await renderExistingUser(EDIT_APPEARANCE);
    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.blonde.label));
    get.mockRejectedValue(new TypeError('Failed to fetch'));

    // A window-focus or reconnect refetch after the 5-minute staleTime, failing.
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: avatarQueryKey(USER.id) });
    });
    await waitFor(() =>
      expect(queryClient.getQueryState(avatarQueryKey(USER.id))?.status).toBe('error')
    );
    // Flush the observer's batched notification so CreatorPage renders the error state.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(checkedAppearance()).toEqual({ ...EDIT_APPEARANCE, hair_color: 'blonde' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar-creator/__tests__/CreatorPage.test.tsx
```

Expected: FAIL with `Error: Failed to resolve import "../CreatorPage.js" from "src/features/avatar-creator/__tests__/CreatorPage.test.tsx". Does the file exist?`, `Test Files  1 failed (1)` and `Tests  no tests`.

- [ ] **Step 3: Implement OptionGroup**

**Deliberate deviation from the spec:** spec section 3 puts every option in a `relative size-11` label. Text options (the hair style labels, such as "Ponytail" at `text-sm` with `px-3`, about 80px wide) can't fit in a 44px square without overflowing, which breaks CLAUDE.md rule 10. So swatch labels are `relative size-11`, and text labels are `relative h-11 min-w-11`: still at least a 44x44 tap area, and as wide as the text needs. The Step 1 test encodes this split, and Step 9 updates the spec to match. Do not "fix" text labels back to `size-11`.

Create `apps/web/src/features/avatar-creator/OptionGroup.tsx`:

```tsx
import { cn } from '../../lib/utils.js';

// The visible face of an option. It sits after the radio, so the peer-* variants
// read the radio's state: a 2px foreground ring (border) when checked, and the
// shadcn focus ring on keyboard focus. The two compose, so neither hides the other.
const FACE =
  'pointer-events-none flex flex-1 items-center justify-center rounded-md border-2 border-transparent peer-checked:border-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50';

/**
 * One picker: a native fieldset of radios named `name`, one per catalog ID in
 * `options`. Each radio is transparent and covers its 44px label, so it stays the
 * tap target (and Playwright's check() target). With `swatch`, an option shows a
 * color chip and its label is screen-reader text; without it, the label shows.
 */
export function OptionGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  swatch,
}: {
  legend: string;
  name: string;
  options: Record<T, { label: string }>;
  value: T;
  onChange: (v: T) => void;
  swatch?: (v: T) => string;
}) {
  // Object.keys loses the key type; every key of `options` is a T.
  const ids = Object.keys(options) as T[];

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const { label } = options[id];
          return (
            <label
              key={id}
              className={cn('relative flex shrink-0', swatch ? 'size-11' : 'h-11 min-w-11')}
            >
              <input
                type="radio"
                name={name}
                value={id}
                checked={id === value}
                onChange={() => onChange(id)}
                className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
              />
              {swatch ? (
                <>
                  <span aria-hidden="true" className={FACE}>
                    <span
                      className="size-8 rounded-sm border border-foreground/25"
                      style={{ backgroundColor: swatch(id) }}
                    />
                  </span>
                  <span className="sr-only">{label}</span>
                </>
              ) : (
                <span className={cn(FACE, 'bg-muted px-3 text-sm')}>{label}</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 4: Implement CreatorPage**

The page checks for data first: once the GET has resolved, the form stays mounted. A failed background refetch keeps the cached data, so the user's unsaved picks are not lost. Only a first-load failure, with no data yet, shows "Can't reach the server". `avatar.data !== undefined` narrows `avatar.data` to `Avatar | null`.

Save is guarded by a ref, not only by `disabled={save.isPending}`. TanStack Query v5 delivers the observer's `isPending` change to React through `notifyManager`, which schedules it with `setTimeout(0)`, so a second tap that lands before that tick still hits an enabled button and would send a second PUT. The ref flips synchronously in the submit handler and resets in `onSettled`, so a failed save can be retried. Step 6 tests both.

Create `apps/web/src/features/avatar-creator/CreatorPage.tsx`:

```tsx
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Shuffle } from 'lucide-react';
import type { Avatar, AvatarAppearance } from '@tracks/types';
import { Button } from '../../components/ui/button.js';
import { Skeleton } from '../../components/ui/skeleton.js';
import { AvatarSprite } from '../avatar/AvatarSprite.js';
import { DEFAULT_APPEARANCE, randomAppearance } from '../avatar/appearance.js';
import {
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from '../avatar/catalog.js';
import { CLOTH_RAMPS, HAIR_RAMPS, SKIN_RAMPS, rampToCss } from '../avatar/palette.js';
import { useAvatar, useSaveAvatar } from '../avatar/useAvatar.js';
import { OptionGroup } from './OptionGroup.js';

const PAGE = 'flex h-full flex-col p-4';
const PREVIEW_BOX = 'h-[40dvh] w-full shrink-0';

/** The six appearance fields of a saved avatar, without its timestamps. */
function appearanceOf({
  skin_tone,
  hair_style,
  hair_color,
  top,
  bottom,
  shoes,
}: Avatar): AvatarAppearance {
  return { skin_tone, hair_style, hair_color, top, bottom, shoes };
}

/**
 * Create mode when the user has no avatar yet, edit mode when one exists. The
 * pickers mount only after the GET resolves, so the form state starts once.
 */
export function CreatorPage() {
  const avatar = useAvatar();

  // Data first: once the GET has resolved, the form stays mounted. A failed
  // background refetch (window focus or reconnect after the 5-minute staleTime)
  // keeps the data and sets isError; branching on isError first would unmount
  // the form and throw away the user's unsaved picks.
  if (avatar.data !== undefined) {
    return <CreatorForm saved={avatar.data} />;
  }

  if (avatar.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
        <p role="alert" className="text-sm text-muted-foreground">
          Can't reach the server
        </p>
        <Button
          variant="secondary"
          disabled={avatar.isFetching}
          onClick={() => void avatar.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <div className={PREVIEW_BOX}>
        <Skeleton role="status" aria-label="Loading your athlete" className="size-full" />
      </div>
    </div>
  );
}

function CreatorForm({ saved }: { saved: Avatar | null }) {
  // Frozen at mount: saving writes the new avatar into the cache, and a new
  // user must not flip into edit mode (showing Cancel) before navigating away.
  const [editing] = useState(saved !== null);
  const [appearance, setAppearance] = useState<AvatarAppearance>(() =>
    saved === null ? DEFAULT_APPEARANCE : appearanceOf(saved)
  );
  const save = useSaveAvatar();
  const navigate = useNavigate();
  // Set synchronously on submit. save.isPending only reaches React on the next
  // notifyManager tick (setTimeout 0), so a fast double tap would otherwise
  // submit twice. Reset on settle so a failed save can be retried.
  const submitting = useRef(false);

  return (
    <div className={PAGE}>
      <div className={PREVIEW_BOX}>
        {/* Static frame 0: RoomScene's rAF loop is the app's only animation driver. */}
        <AvatarSprite appearance={appearance} tag="front-idle" frame={0} />
      </div>
      <form
        className="min-h-0 flex-1 overflow-y-auto pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (submitting.current) return;
          submitting.current = true;
          save.mutate(appearance, {
            onSuccess: () => {
              void navigate('/');
            },
            onSettled: () => {
              submitting.current = false;
            },
          });
        }}
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
          <h1 className="text-lg font-semibold">
            {editing ? 'Edit your athlete' : 'Create your athlete'}
          </h1>
          <OptionGroup
            legend="Skin tone"
            name="skin_tone"
            options={SKIN_TONE_OPTIONS}
            value={appearance.skin_tone}
            onChange={(skin_tone) => setAppearance((a) => ({ ...a, skin_tone }))}
            swatch={(id) => rampToCss(SKIN_RAMPS[id])}
          />
          <OptionGroup
            legend="Hair style"
            name="hair_style"
            options={HAIR_STYLE_OPTIONS}
            value={appearance.hair_style}
            onChange={(hair_style) => setAppearance((a) => ({ ...a, hair_style }))}
          />
          <OptionGroup
            legend="Hair color"
            name="hair_color"
            options={HAIR_COLOR_OPTIONS}
            value={appearance.hair_color}
            onChange={(hair_color) => setAppearance((a) => ({ ...a, hair_color }))}
            swatch={(id) => rampToCss(HAIR_RAMPS[id])}
          />
          <OptionGroup
            legend="Top"
            name="top"
            options={TOP_OPTIONS}
            value={appearance.top}
            onChange={(top) => setAppearance((a) => ({ ...a, top }))}
            swatch={(id) => rampToCss(CLOTH_RAMPS[id])}
          />
          <OptionGroup
            legend="Bottom"
            name="bottom"
            options={BOTTOM_OPTIONS}
            value={appearance.bottom}
            onChange={(bottom) => setAppearance((a) => ({ ...a, bottom }))}
            swatch={(id) => rampToCss(CLOTH_RAMPS[id])}
          />
          <OptionGroup
            legend="Shoes"
            name="shoes"
            options={SHOES_OPTIONS}
            value={appearance.shoes}
            onChange={(shoes) => setAppearance((a) => ({ ...a, shoes }))}
            swatch={(id) => rampToCss(CLOTH_RAMPS[id])}
          />
          {save.isError && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Couldn't save your athlete. Try again.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAppearance(randomAppearance(Math.random))}
            >
              <Shuffle /> Randomize
            </Button>
            <div className="ml-auto flex gap-2">
              {editing && (
                <Button asChild variant="ghost">
                  <Link to="/">Cancel</Link>
                </Button>
              )}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar-creator/__tests__/CreatorPage.test.tsx
```

Expected: PASS, with `Test Files  1 passed (1)` and `Tests  15 passed (15)`. There should be no stderr output: no act() warnings and no jsdom "Not implemented" errors (.claude/CLAUDE.md rule 26).

- [ ] **Step 6: Add the keyboard, double-tap and retry tests**

Append these three tests inside the `describe('CreatorPage', ...)` block in `apps/web/src/features/avatar-creator/__tests__/CreatorPage.test.tsx`, after the last `it(...)` ('keeps the form and the unsaved picks when a background refetch fails'). They reuse the file's `api` mock (`get`, `put`), `renderNewUser`, `renderExistingUser`, `group`, `LEGENDS`, `avatarOf` and `EDIT_APPEARANCE`; no new imports are needed.

jsdom does not implement arrow-key movement inside a radio group, so the keyboard test does not fire `keyDown` events. It asserts the DOM structure the browser's native behavior depends on: one shared `name` per group (arrow keys move within it, Tab enters it once at the checked radio), distinct names between groups, a real `<fieldset>` named by its `<legend>`, and a focusable checked radio.

```tsx
  it('gives keyboard players one native radio group per fieldset, named by its legend', async () => {
    await renderNewUser();

    const groupNames: string[] = [];
    for (const legend of Object.values(LEGENDS)) {
      // getByRole('group', { name }) resolves the name from the <legend>.
      const fieldset = group(legend);
      expect(fieldset.tagName).toBe('FIELDSET');
      expect(fieldset.querySelector('legend')).toHaveTextContent(legend);

      const radios = within(fieldset).getAllByRole('radio') as HTMLInputElement[];
      const names = new Set(radios.map((r) => r.name));
      // One shared, non-empty name: the browser's arrow keys move the selection
      // within it, and Tab stops once, on the checked radio.
      expect(names.size).toBe(1);
      const [name] = [...names];
      expect(name).not.toBe('');
      groupNames.push(name);

      const checked = radios.filter((r) => r.checked);
      expect(checked).toHaveLength(1);
      expect(checked[0]).toBeEnabled();
      expect(checked[0]).not.toHaveAttribute('tabindex', '-1');
      checked[0].focus();
      expect(checked[0]).toHaveFocus();
    }
    // Distinct between groups, or arrowing out of Skin tone would change Hair color.
    expect(new Set(groupNames).size).toBe(groupNames.length);
  });

  it('sends exactly one PUT when Save is tapped twice', async () => {
    await renderExistingUser(EDIT_APPEARANCE);
    let resolvePut: (value: ApiSuccess<Avatar>) => void = () => {};
    put.mockReturnValue(
      new Promise<ApiSuccess<Avatar>>((resolve) => {
        resolvePut = resolve;
      })
    );

    // Two taps in the same tick: React has not yet seen isPending, because
    // TanStack Query delivers it on a setTimeout(0) notifyManager tick.
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);

    const saving = await screen.findByRole('button', { name: 'Saving...' });
    expect(saving).toBeDisabled();
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put).toHaveBeenCalledTimes(1);

    // A third tap on the disabled button sends nothing either.
    fireEvent.click(saving);
    expect(put).toHaveBeenCalledTimes(1);

    resolvePut({ success: true, data: avatarOf(EDIT_APPEARANCE) });

    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('re-enables Save after a failed save, and a retry sends a second PUT', async () => {
    await renderNewUser();
    put
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ success: true, data: avatarOf(DEFAULT_APPEARANCE) });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save your athlete. Try again."
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    expect(put).toHaveBeenCalledTimes(1);

    fireEvent.click(save);

    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put).toHaveBeenNthCalledWith(1, '/avatar', DEFAULT_APPEARANCE);
    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(put).toHaveBeenNthCalledWith(2, '/avatar', DEFAULT_APPEARANCE);
  });
```

- [ ] **Step 7: Run the test file and confirm the new tests pass**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar-creator/__tests__/CreatorPage.test.tsx
```

Expected: PASS, with `Test Files  1 passed (1)` and `Tests  18 passed (18)`, and no stderr output (no act() warnings, no jsdom "Not implemented" errors).

These tests are written to fail against naive implementations. If one fails, fix the implementation, not the test:
- Radios with no `name`, a per-option name, or one name shared by every group: the keyboard test fails on `names.size` with `expected <option count> to be 1` (per-option names), on `expected '' not to be ''` (no name), or on the distinct-names check with `expected 1 to be 6` (one shared name). A `<div role="group" aria-label>` in place of the fieldset fails with `expected 'DIV' to be 'FIELDSET'`.
- Save guarded only by `disabled={save.isPending}` (no `submitting` ref): the double-tap test fails with `AssertionError: expected "spy" to be called 1 times, but got 2 times`.
- A ref reset only in `onSuccess` (not `onSettled`): the retry test's `waitFor` times out with `AssertionError: expected "spy" to be called 2 times, but got 1 times`, because the second click is swallowed.

- [ ] **Step 8: Typecheck, lint and run the full web suite**

```bash
pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint && pnpm --filter @tracks/web test
```

Expected: `tsc --noEmit` and `eslint .` both exit 0 with no output, and every web test file passes, including the existing `App.test.tsx` and `LoginPage.test.tsx`. Fix anything they report before committing. CreatorPage gets a route only when the routing task adds `{ path: 'create', element: <CreatorPage /> }`, so the browser checks (375px, then desktop, per rules 22 and 23) run in that task.

- [ ] **Step 9: Update the spec to match the option label sizing**

The approved spec still says every option label is `size-11`. Bring it in line with Step 3's deliberate deviation so the code and the spec agree after merge. In `docs/superpowers/specs/2026-10-04-athlete-avatar-room-design.md`, section 3, make exactly these two replacements with the Edit tool (whitespace before each phrase stays as it is):

1. Replace:

   ```
   inside a `relative size-11` `<label>` that also holds the swatch or text.
   ```

   with:

   ```
   inside a `relative` `<label>` (`size-11` for swatch options, `h-11 min-w-11` for text options such as hair styles) that also holds the swatch or text.
   ```

2. Replace:

   ```
   Tap area `size-11`.
   ```

   with:

   ```
   Tap area at least 44×44 px (`size-11` swatches, `h-11 min-w-11` text).
   ```

Confirm no option-sizing `size-11` claim is left that contradicts the split:

```bash
grep -n "size-11" docs/superpowers/specs/2026-10-04-athlete-avatar-room-design.md
```

Expected: every remaining match mentions swatches (the two new lines), none says every option label or tap area is `size-11`.

In the task report, name this change explicitly so the user sees it: "Updated spec section 3: option labels are `size-11` for swatches and `h-11 min-w-11` for text options (hair styles), since text like 'Ponytail' can't fit a 44px square; tap area stays at least 44x44 px."

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/avatar-creator/OptionGroup.tsx apps/web/src/features/avatar-creator/CreatorPage.tsx apps/web/src/features/avatar-creator/__tests__/CreatorPage.test.tsx docs/superpowers/specs/2026-10-04-athlete-avatar-room-design.md
git commit -F - <<'EOF'
Add avatar creator page with swatch pickers

CreatorPage starts a new user from DEFAULT_APPEARANCE and prefills
an existing avatar. A static front-idle preview sits above scrolling
fieldset pickers. Save writes the useAvatar cache and returns to the
room. A ref guard makes a double tap on Save send one PUT. A failed
save keeps the choices, shows an inline alert and re-enables Save. If
the first GET fails, the page shows a Retry state. A failed background
refetch leaves the form and its unsaved picks in place.

The spec now sizes text option labels h-11 min-w-11 (swatches stay
size-11), since hair style names don't fit a 44px square.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

---

### Task 11: Room page, room layout and RoomScene

**Files:**
- Create: `apps/web/src/features/avatar-room/sampleRoom.ts`
- Create: `apps/web/src/features/avatar-room/roomLayout.ts`
- Create: `apps/web/src/features/avatar-room/clock.ts`
- Create: `apps/web/src/features/avatar-room/RoomScene.tsx`
- Create: `apps/web/src/features/avatar-room/RoomPage.tsx`
- Create (test helper, not a test file): `apps/web/src/features/avatar-room/__tests__/roomFixtures.ts`
- Test: `apps/web/src/features/avatar-room/__tests__/roomLayout.test.ts`
- Test: `apps/web/src/features/avatar-room/__tests__/clock.test.ts`
- Test: `apps/web/src/features/avatar-room/__tests__/RoomScene.test.tsx`
- Test: `apps/web/src/features/avatar-room/__tests__/RoomScene.loadError.test.tsx`
- Test: `apps/web/src/features/avatar-room/__tests__/RoomPage.test.tsx`

**Interfaces:**
Consumes:
- `@tracks/types`: `type AvatarAppearance`, `type Avatar`
- `../avatar/sheets.js`: `type SheetId`, `type SheetData`, `type SheetFrame`, `type SheetSlice`, `type SheetTag`, `SHEETS: ReadonlyMap<SheetId, SheetData>`, `getSheet(id: SheetId, registry?: ReadonlyMap<SheetId, SheetData>): SheetData` (throws an Error naming the id)
- `../avatar/frames.js`: `type AnimationTag`, `interface TagFrame`, `tagFrames(sheet: SheetData, tag: string): TagFrame[]`, `frameAt(frames: TagFrame[], msInState: number): number`
- `../avatar/catalog.js`: `BODY_SHEET`
- `../avatar/appearance.js`: `describeAppearance(a: AvatarAppearance): string`
- `../avatar/canvas.js`: `type LoadedSheets`, `loadAvatarSheets(appearance, registry?): Promise<LoadedSheets>`, `loadSheetCanvas(sheet: SheetData, swap: Swap | null): Promise<HTMLCanvasElement>`, `drawAvatar(ctx, sheets, appearance, tag, frameOffset, feetX, feetY, registry?): void`
- `../avatar/usePixelCanvas.js`: `usePixelCanvas(nativeW: number, nativeH: number): { stageRef; canvasRef; scale; generation }` (generation is 0 until the first resize has sized the canvas, then increments after every resize)
- `../avatar/useAvatar.js`: `useAvatar(): UseQueryResult<Avatar | null>`
- `./behavior.js`: `type BehaviorTimings`, `initialBehavior(rng, timings): BehaviorState`, `step(state, dtMs, rng, timings): BehaviorState`, `tagForPhase(phase): AnimationTag`, `timingsFromSheet(body: SheetData): BehaviorTimings`
- `@sentry/react` `captureException`, `../../components/ui/button.js` `Button`, `../../components/ui/skeleton.js` `Skeleton`, `lucide-react` `Pencil`, `react-router` `Link` / `useNavigate`, `../../store/auth.store.js` `useAuthStore` (tests), `../../lib/api.js` `api` (mocked in tests)

Produces:
- `sampleRoom.ts`: `interface SampleRoom { trophies: SheetId[]; medals: SheetId[]; frame: SheetId; equipment: SheetId; decor: SheetId }`, `SAMPLE_ROOM: SampleRoom`
- `roomLayout.ts`: `interface PlacedSprite { sheet: SheetId; x: number; y: number; animated: boolean }`, `interface RoomLayout { sprites: PlacedSprite[]; avatarFeet: { x: number; y: number } }`, `layoutRoom(room: SampleRoom, registry: ReadonlyMap<SheetId, SheetData> = SHEETS): RoomLayout`, plus the added pure helper `spriteFrame(sprite: PlacedSprite, tag: AnimationTag, frameOffset: number, registry: ReadonlyMap<SheetId, SheetData> = SHEETS): SheetFrame` (frame 0 for static sprites; during `side-run`, the `belt` frame at the same offset as the run; belt frame 0 otherwise)
- `clock.ts`: `MAX_DT_MS = 250`, `clampDt(dtMs: number): number` (= `Math.min(Math.max(dtMs, 0), MAX_DT_MS)`; pure, used by RoomScene's rAF loop). It lives in its own file because `behavior.ts` belongs to Task 7.
- `RoomScene.tsx`: `export function RoomScene(props: { appearance: AvatarAppearance })`. It renders an unexported `RoomCanvas` keyed by the six appearance fields, so a new look remounts the canvas with fresh load, ready and error state.
- `RoomPage.tsx`: `export function RoomPage()`
- `__tests__/roomFixtures.ts` (tests only): `slice`, `sheet`, `SLOTS`, `BELT`, `RIDER`, `BODY`, `roomRegistry(overrides?: SheetData[]): ReadonlyMap<string, SheetData>`

Run every command from the repo root in Git Bash, on branch `feat/avatar-room`. `@tracks/types` must already be built (`pnpm --filter @tracks/types build`, done in Task 2, Step 9).

- [ ] **Step 1: Create the shared room fixtures**

The roomLayout and RoomScene tests share these sheets. The file is in `__tests__/` but doesn't match `*.test.*`, so Vitest doesn't run it as a test. It imports only types from `sheets.js`, so it is safe to load from inside a `vi.mock` factory.

Create `apps/web/src/features/avatar-room/__tests__/roomFixtures.ts`:

```ts
import type { SheetData, SheetSlice, SheetTag } from '../../avatar/sheets.js';

export function slice(
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  pivot: { x: number; y: number } | null = null,
): SheetSlice {
  return { name, x, y, w, h, pivot };
}

/** A sheet whose frames sit side by side, each w x h, 100 ms long unless `durations` says otherwise. */
export function sheet(
  id: string,
  w: number,
  h: number,
  options: { frames?: number; durations?: number[]; tags?: SheetTag[]; slices?: SheetSlice[] } = {},
): SheetData {
  const count = options.durations?.length ?? options.frames ?? 1;
  return {
    id,
    imageUrl: `/sprites/${id}.png`,
    frames: Array.from({ length: count }, (_, i) => ({
      x: i * w,
      y: 0,
      w,
      h,
      duration: options.durations?.[i] ?? 100,
    })),
    tags: options.tags ?? [],
    slices: options.slices ?? [],
  };
}

/** The background's slot slices, one per sample item. */
export const SLOTS: SheetSlice[] = [
  slice('trophy-1', 10, 20, 16, 18),
  slice('trophy-2', 30, 20, 16, 18),
  slice('trophy-3', 50, 20, 16, 18),
  slice('medal-1', 100, 10, 12, 20),
  slice('medal-2', 114, 10, 12, 20),
  slice('medal-3', 128, 10, 12, 20),
  slice('frame', 70, 12, 24, 30),
  slice('equipment', 60, 60, 80, 50),
  slice('decor', 150, 70, 20, 40),
];

// The belt is sheet frames 1..3; frame 0 is an unused still.
export const BELT: SheetTag = { name: 'belt', from: 1, to: 3, direction: 'forward' };
export const RIDER = slice('rider', 20, 10, 24, 24, { x: 12, y: 23 });

/**
 * body.json's timing: front-idle is frames 0..3 at 100 ms (a 400 ms loop), turn is
 * frame 4 at 150 ms, and side-run is frames 5..7 at 80 ms, one per belt frame.
 */
export const BODY = sheet('body', 64, 64, {
  durations: [100, 100, 100, 100, 150, 80, 80, 80],
  tags: [
    { name: 'front-idle', from: 0, to: 3, direction: 'forward' },
    { name: 'turn', from: 4, to: 4, direction: 'forward' },
    { name: 'side-run', from: 5, to: 7, direction: 'forward' },
  ],
});

/** Every room sheet plus body; `overrides` replace sheets with the same id. */
export function roomRegistry(overrides: SheetData[] = []): ReadonlyMap<string, SheetData> {
  const sheets = [
    sheet('background', 180, 120, { slices: SLOTS }),
    sheet('frame-bib', 20, 26),
    sheet('trophy-gold', 10, 14),
    sheet('trophy-silver', 9, 12),
    sheet('trophy-bronze', 8, 10),
    sheet('medal-gold', 8, 12),
    sheet('medal-silver', 7, 12),
    sheet('medal-bronze', 8, 11),
    sheet('plant', 14, 30),
    sheet('treadmill', 72, 40, { frames: 4, tags: [BELT], slices: [RIDER] }),
    BODY,
    ...overrides,
  ];
  return new Map(sheets.map((s) => [s.id, s]));
}
```

- [ ] **Step 2: Write the failing roomLayout test**

Create `apps/web/src/features/avatar-room/__tests__/roomLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { layoutRoom, spriteFrame, type PlacedSprite } from '../roomLayout.js';
import { SAMPLE_ROOM, type SampleRoom } from '../sampleRoom.js';
import { BELT, RIDER, SLOTS, roomRegistry, sheet, slice } from './roomFixtures.js';

function placed(sprites: PlacedSprite[], id: string): PlacedSprite | undefined {
  return sprites.find((s) => s.sheet === id);
}

describe('layoutRoom', () => {
  it('lists sprites in draw order: background, frame, trophies, medals, plant, treadmill', () => {
    const { sprites } = layoutRoom(SAMPLE_ROOM, roomRegistry());
    expect(sprites.map((s) => s.sheet)).toEqual([
      'background',
      'frame-bib',
      'trophy-gold',
      'trophy-silver',
      'trophy-bronze',
      'medal-gold',
      'medal-silver',
      'medal-bronze',
      'plant',
      'treadmill',
    ]);
  });

  it('draws the background at the origin and animates only the treadmill', () => {
    const { sprites } = layoutRoom(SAMPLE_ROOM, roomRegistry());
    expect(sprites[0]).toEqual({ sheet: 'background', x: 0, y: 0, animated: false });
    expect(sprites.filter((s) => s.animated).map((s) => s.sheet)).toEqual(['treadmill']);
  });

  it('stands trophies, the plant and the treadmill bottom-centered on their slice bottom edge', () => {
    const { sprites } = layoutRoom(SAMPLE_ROOM, roomRegistry());
    // trophy-1 is (10, 20) 16x18 and trophy-gold is 10x14: x = 10 + (16 - 10) / 2, y = 20 + 18 - 14
    expect(placed(sprites, 'trophy-gold')).toMatchObject({ x: 13, y: 24 });
    // An odd leftover rounds down: x = 30 + floor((16 - 9) / 2)
    expect(placed(sprites, 'trophy-silver')).toMatchObject({ x: 33, y: 26 });
    expect(placed(sprites, 'trophy-bronze')).toMatchObject({ x: 54, y: 28 });
    // decor is (150, 70) 20x40 and plant is 14x30
    expect(placed(sprites, 'plant')).toMatchObject({ x: 153, y: 80 });
    // equipment is (60, 60) 80x50 and treadmill is 72x40
    expect(placed(sprites, 'treadmill')).toMatchObject({ x: 64, y: 70 });
  });

  it('hangs the frame and medals top-centered from their slice top edge', () => {
    const { sprites } = layoutRoom(SAMPLE_ROOM, roomRegistry());
    // frame is (70, 12) 24x30 and frame-bib is 20x26
    expect(placed(sprites, 'frame-bib')).toMatchObject({ x: 72, y: 12 });
    // medal-1 is (100, 10) 12x20 and medal-gold is 8x12
    expect(placed(sprites, 'medal-gold')).toMatchObject({ x: 102, y: 10 });
    expect(placed(sprites, 'medal-silver')).toMatchObject({ x: 116, y: 10 });
    expect(placed(sprites, 'medal-bronze')).toMatchObject({ x: 130, y: 10 });
  });

  it('puts the avatar feet on the treadmill rider pivot', () => {
    // treadmill drawn at (64, 70) + rider bounds (20, 10) + pivot (12, 23)
    expect(layoutRoom(SAMPLE_ROOM, roomRegistry()).avatarFeet).toEqual({ x: 96, y: 103 });
  });

  it('fills slots in order from the room contents', () => {
    const room: SampleRoom = { ...SAMPLE_ROOM, trophies: ['trophy-bronze'], medals: [] };
    const { sprites } = layoutRoom(room, roomRegistry());
    expect(sprites.map((s) => s.sheet)).toEqual([
      'background',
      'frame-bib',
      'trophy-bronze',
      'plant',
      'treadmill',
    ]);
    // trophy-bronze (8x10) now stands in trophy-1, (10, 20) 16x18
    expect(placed(sprites, 'trophy-bronze')).toMatchObject({ x: 14, y: 28 });
  });

  it('throws naming the slice when the background lacks a slot', () => {
    const background = sheet('background', 180, 120, {
      slices: SLOTS.filter((s) => s.name !== 'medal-3'),
    });
    expect(() => layoutRoom(SAMPLE_ROOM, roomRegistry([background]))).toThrow('medal-3');
  });

  it('throws naming the sheet when an item has no exported sheet', () => {
    const room: SampleRoom = { ...SAMPLE_ROOM, decor: 'cactus' };
    expect(() => layoutRoom(room, roomRegistry())).toThrow('cactus');
  });

  it('throws when the equipment has no rider slice', () => {
    const treadmill = sheet('treadmill', 72, 40, { frames: 4, tags: [BELT] });
    expect(() => layoutRoom(SAMPLE_ROOM, roomRegistry([treadmill]))).toThrow('rider');
  });

  it('throws when the rider slice has no pivot', () => {
    const treadmill = sheet('treadmill', 72, 40, {
      frames: 4,
      tags: [BELT],
      slices: [slice('rider', 20, 10, 24, 24)],
    });
    expect(() => layoutRoom(SAMPLE_ROOM, roomRegistry([treadmill]))).toThrow(/rider.*pivot/);
  });

  it('throws when the equipment has no belt tag', () => {
    const treadmill = sheet('treadmill', 72, 40, { frames: 4, slices: [RIDER] });
    expect(() => layoutRoom(SAMPLE_ROOM, roomRegistry([treadmill]))).toThrow('belt');
  });
});

describe('spriteFrame', () => {
  const registry = roomRegistry();
  const { sprites } = layoutRoom(SAMPLE_ROOM, registry);
  const plant = placed(sprites, 'plant');
  const treadmill = placed(sprites, 'treadmill');
  if (!plant || !treadmill) throw new Error('fixture layout is missing the plant or treadmill');

  it('uses frame 0 for a static sprite in every state', () => {
    const frame0 = { x: 0, y: 0, w: 14, h: 30, duration: 100 };
    expect(spriteFrame(plant, 'front-idle', 0, registry)).toEqual(frame0);
    expect(spriteFrame(plant, 'side-run', 2, registry)).toEqual(frame0);
  });

  it('draws belt frame i with side-run frame i', () => {
    // belt offset 0 is sheet frame 1 and offset 2 is sheet frame 3
    expect(spriteFrame(treadmill, 'side-run', 0, registry)).toMatchObject({ x: 72 });
    expect(spriteFrame(treadmill, 'side-run', 2, registry)).toMatchObject({ x: 216 });
  });

  it.each(['front-idle', 'turn'] as const)('shows belt frame 0 during %s', (tag) => {
    expect(spriteFrame(treadmill, tag, 3, registry)).toMatchObject({ x: 72 });
  });

  it('throws when the run offset is past the end of the belt', () => {
    expect(() => spriteFrame(treadmill, 'side-run', 3, registry)).toThrow('belt');
  });
});
```

- [ ] **Step 3: Run the roomLayout test and watch it fail**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/roomLayout.test.ts`

Expected: FAIL with `Error: Failed to resolve import "../roomLayout.js" from "src/features/avatar-room/__tests__/roomLayout.test.ts". Does the file exist?` and `Tests  no tests`.

- [ ] **Step 4: Create the sample room contents**

Create `apps/web/src/features/avatar-room/sampleRoom.ts`:

```ts
import type { SheetId } from '../avatar/sheets.js';

/** What the room shows, slot by slot. Hard-coded in v1; owned items replace it later. */
export interface SampleRoom {
  trophies: SheetId[];
  medals: SheetId[];
  frame: SheetId;
  equipment: SheetId;
  decor: SheetId;
}

export const SAMPLE_ROOM: SampleRoom = {
  trophies: ['trophy-gold', 'trophy-silver', 'trophy-bronze'],
  medals: ['medal-gold', 'medal-silver', 'medal-bronze'],
  frame: 'frame-bib',
  equipment: 'treadmill',
  decor: 'plant',
};
```

- [ ] **Step 5: Implement the pure room layout**

Create `apps/web/src/features/avatar-room/roomLayout.ts`:

```ts
import { tagFrames, type AnimationTag } from '../avatar/frames.js';
import {
  getSheet,
  SHEETS,
  type SheetData,
  type SheetFrame,
  type SheetId,
  type SheetSlice,
} from '../avatar/sheets.js';
import type { SampleRoom } from './sampleRoom.js';

export interface PlacedSprite {
  sheet: SheetId;
  /** Top-left draw position in room pixels. */
  x: number;
  y: number;
  /** True for the equipment: it plays its `belt` tag in step with the run. */
  animated: boolean;
}

export interface RoomLayout {
  /** Draw order: background, frame, trophies, medals, plant, treadmill. */
  sprites: PlacedSprite[];
  /** Where the avatar cell's anchor pixel (32, 63) goes, in room pixels. */
  avatarFeet: { x: number; y: number };
}

type Registry = ReadonlyMap<SheetId, SheetData>;
type Alignment = 'standing' | 'hanging';

const BACKGROUND_SHEET: SheetId = 'background';
const RIDER_SLICE = 'rider';
const BELT_TAG = 'belt';

function findSlice(sheet: SheetData, name: string): SheetSlice {
  const found = sheet.slices.find((s) => s.name === name);
  if (!found) throw new Error(`Sheet "${sheet.id}" has no slice "${name}"`);
  return found;
}

function firstFrame(sheet: SheetData): SheetFrame {
  const frame = sheet.frames[0];
  if (!frame) throw new Error(`Sheet "${sheet.id}" has no frames`);
  return frame;
}

/**
 * Standing items sit bottom-centered on the slot's bottom edge; hanging items
 * hang top-centered from its top edge. An odd leftover rounds to the left.
 */
function place(
  id: SheetId,
  slot: SheetSlice,
  alignment: Alignment,
  registry: Registry,
  animated = false,
): PlacedSprite {
  const item = firstFrame(getSheet(id, registry));
  return {
    sheet: id,
    x: slot.x + Math.floor((slot.w - item.w) / 2),
    y: alignment === 'standing' ? slot.y + slot.h - item.h : slot.y,
    animated,
  };
}

/** Pure: positions every room sprite from the background's slot slices. */
export function layoutRoom(room: SampleRoom, registry: Registry = SHEETS): RoomLayout {
  const background = getSheet(BACKGROUND_SHEET, registry);
  const slot = (name: string): SheetSlice => findSlice(background, name);

  const equipment = getSheet(room.equipment, registry);
  if (!equipment.tags.some((t) => t.name === BELT_TAG)) {
    throw new Error(`Sheet "${equipment.id}" has no "${BELT_TAG}" tag`);
  }
  const rider = findSlice(equipment, RIDER_SLICE);
  if (!rider.pivot) {
    throw new Error(`Slice "${RIDER_SLICE}" in sheet "${equipment.id}" has no pivot`);
  }

  const treadmill = place(room.equipment, slot('equipment'), 'standing', registry, true);

  return {
    sprites: [
      { sheet: BACKGROUND_SHEET, x: 0, y: 0, animated: false },
      place(room.frame, slot('frame'), 'hanging', registry),
      ...room.trophies.map((id, i) => place(id, slot(`trophy-${i + 1}`), 'standing', registry)),
      ...room.medals.map((id, i) => place(id, slot(`medal-${i + 1}`), 'hanging', registry)),
      place(room.decor, slot('decor'), 'standing', registry),
      treadmill,
    ],
    avatarFeet: {
      x: treadmill.x + rider.x + rider.pivot.x,
      y: treadmill.y + rider.y + rider.pivot.y,
    },
  };
}

/**
 * Pure: the sheet rect to draw for a placed sprite. Static sprites use frame 0.
 * The animated equipment shows belt frame i with side-run frame i, and belt
 * frame 0 in every other tag.
 */
export function spriteFrame(
  sprite: PlacedSprite,
  tag: AnimationTag,
  frameOffset: number,
  registry: Registry = SHEETS,
): SheetFrame {
  const sheet = getSheet(sprite.sheet, registry);
  if (!sprite.animated) return firstFrame(sheet);
  const offset = tag === 'side-run' ? frameOffset : 0;
  const index = tagFrames(sheet, BELT_TAG)[offset]?.index;
  const rect = index === undefined ? undefined : sheet.frames[index];
  if (!rect) throw new Error(`Sheet "${sheet.id}" has no "${BELT_TAG}" frame ${offset}`);
  return rect;
}
```

- [ ] **Step 6: Run the roomLayout test and watch it pass**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/roomLayout.test.ts`

Expected: PASS, `Test Files  1 passed (1)` and `Tests  16 passed (16)`, with no stderr output.

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint`

Expected: both exit 0 with no errors or warnings.

- [ ] **Step 8: Commit the room layout**

```bash
git add apps/web/src/features/avatar-room/sampleRoom.ts apps/web/src/features/avatar-room/roomLayout.ts apps/web/src/features/avatar-room/__tests__/roomFixtures.ts apps/web/src/features/avatar-room/__tests__/roomLayout.test.ts
git commit -F - <<'EOF'
Lay out the room from its art slices

layoutRoom places the sample items in the background's slot slices
(standing items bottom-centered, hanging items top-centered) and puts
the avatar's feet on the treadmill's rider pivot. spriteFrame picks
the belt frame that matches the run.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 9: Write the failing dt-clamp test**

A tab left in the background for minutes gets one rAF callback with a huge `now - lastTime` when it comes back. Fed to `step` unclamped, that gap would run through idle, the turn and part of the run in a single frame, so the athlete would appear mid-run (or anywhere in the cycle). The clamp is a pure helper so this is tested without a canvas. It goes in a new `clock.ts`, not `behavior.ts`, because Task 7 owns `behavior.ts`.

Create `apps/web/src/features/avatar-room/__tests__/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { initialBehavior, step, timingsFromSheet } from '../behavior.js';
import { clampDt, MAX_DT_MS } from '../clock.js';
import { BODY } from './roomFixtures.js';

// The fixture body: a 400 ms front-idle loop, a 150 ms turn, a 240 ms side-run loop.
const TIMINGS = timingsFromSheet(BODY);
const rngLow = (): number => 0;

describe('clampDt', () => {
  it.each([
    ['a tab left in the background for 10 minutes', 600_000, 250],
    ['a clock that went backwards', -5, 0],
    ['an ordinary 60 fps frame', 16, 16],
  ])('clamps %s', (_name, dtMs, expected) => {
    expect(clampDt(dtMs)).toBe(expected);
  });

  it('caps dt at MAX_DT_MS, which is 250 ms', () => {
    expect(MAX_DT_MS).toBe(250);
    expect(clampDt(MAX_DT_MS)).toBe(MAX_DT_MS);
  });

  it('resumes a backgrounded tab in idle instead of jumping to the run', () => {
    const idle = initialBehavior(rngLow, TIMINGS);
    expect(idle).toEqual({ phase: 'idle', msInPhase: 0, targetMs: 4000 });

    expect(step(idle, clampDt(600_000), rngLow, TIMINGS)).toEqual({
      phase: 'idle',
      msInPhase: 250,
      targetMs: 4000,
    });
    // Without the clamp even a 4.4 s gap would skip idle and the turn: 4000 + 150 + 250.
    expect(step(idle, 4400, rngLow, TIMINGS).phase).toBe('run');
  });
});
```

- [ ] **Step 10: Run the dt-clamp test and watch it fail**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/clock.test.ts`

Expected: FAIL with `Error: Failed to resolve import "../clock.js" from "src/features/avatar-room/__tests__/clock.test.ts". Does the file exist?` and `Tests  no tests`.

- [ ] **Step 11: Implement the dt clamp**

Create `apps/web/src/features/avatar-room/clock.ts`:

```ts
/** The longest gap one rAF tick may feed the behavior machine. */
export const MAX_DT_MS = 250;

/**
 * Pure: the frame delta RoomScene passes to step(). A hidden tab or
 * backgrounded app resumes where it was instead of skipping states, and a
 * clock that steps backwards adds nothing. NaN passes through; step() treats
 * a non-finite dt as no time.
 */
export function clampDt(dtMs: number): number {
  return Math.min(Math.max(dtMs, 0), MAX_DT_MS);
}
```

- [ ] **Step 12: Run the dt-clamp test and watch it pass**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/clock.test.ts`

Expected: PASS, `Test Files  1 passed (1)` and `Tests  5 passed (5)`, with no stderr output. `clock.ts` is committed with RoomScene in Step 19.

- [ ] **Step 13: Write the failing RoomScene test**

Some RoomScene logic lives in no pure module: the use of the dt clamp in the loop, the redraw guard, data-ready gating and the error paths. This test covers that logic in jsdom without a real canvas:
- `canvas.js` is replaced, so no image is decoded or drawn.
- `usePixelCanvas.js` is replaced by a hook whose `generation` the test controls.
- `sheets.js` serves the fixture registry.
- `HTMLCanvasElement.prototype.getContext` returns a fake context, so jsdom prints no "Not implemented" error (.claude/CLAUDE.md rule 26).
- `requestAnimationFrame` is a queue the test flushes by hand.
- `Math.random` returns 0, so idle lasts exactly 4000 ms.

No `canvas` package is added. Real pixels stay covered by the e2e run and the visual captures.

Create `apps/web/src/features/avatar-room/__tests__/RoomScene.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { AvatarAppearance } from '@tracks/types';
import type { LoadedSheets } from '../../avatar/canvas.js';
import type { SheetData } from '../../avatar/sheets.js';

const { loadSheetCanvas, loadAvatarSheets, drawAvatar, captureException, pixel } = vi.hoisted(
  () => ({
    loadSheetCanvas: vi.fn(),
    loadAvatarSheets: vi.fn(),
    drawAvatar: vi.fn(),
    captureException: vi.fn(),
    // The mocked usePixelCanvas publishes its setter here so a test can play a resize.
    pixel: { setGeneration: (_generation: number): void => {} },
  }),
);

vi.mock('@sentry/react', () => ({ captureException }));

// jsdom cannot decode images or draw (.claude/CLAUDE.md rule 26), so the canvas adapter is faked.
vi.mock('../../avatar/canvas.js', () => ({ loadSheetCanvas, loadAvatarSheets, drawAvatar }));

// jsdom has no ResizeObserver or matchMedia: generation stays 0 until a test calls resize().
vi.mock('../../avatar/usePixelCanvas.js', async () => {
  const { useRef, useState } = await import('react');
  return {
    usePixelCanvas: () => {
      const stageRef = useRef<HTMLDivElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const [generation, setGeneration] = useState(0);
      pixel.setGeneration = setGeneration;
      return { stageRef, canvasRef, scale: 1, generation };
    },
  };
});

// The room and body sheets come from the fixture registry instead of the exported art.
vi.mock('../../avatar/sheets.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../avatar/sheets.js')>();
  const { roomRegistry } = await import('./roomFixtures.js');
  const registry = roomRegistry();
  return {
    ...actual,
    SHEETS: registry,
    getSheet: (id: string, from: ReadonlyMap<string, SheetData> = registry) =>
      actual.getSheet(id, from),
  };
});

import { describeAppearance } from '../../avatar/appearance.js';
import { RoomScene } from '../RoomScene.js';

const APPEARANCE: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'auburn',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};
const EDITED: AvatarAppearance = { ...APPEARANCE, hair_color: 'blonde' };

const AVATAR_SHEETS: LoadedSheets = new Map();
// The fixture treadmill stands at (64, 70), so its rider pivot puts the feet at (96, 103).
const FEET_X = 96;
const FEET_Y = 103;

const ctx = { clearRect: vi.fn(), drawImage: vi.fn() };
const pendingFrames = new Map<number, FrameRequestCallback>();
let lastFrameId = 0;

/** Runs every queued rAF callback once, at `now` ms. */
function flushFrame(now: number): void {
  const callbacks = [...pendingFrames.values()];
  pendingFrames.clear();
  act(() => {
    for (const callback of callbacks) callback(now);
  });
}

/** Plays a usePixelCanvas resize: the canvas is cleared and the generation moves on. */
function resize(generation: number): void {
  act(() => pixel.setGeneration(generation));
}

/** Renders the scene and waits for its sheets to load, which starts the rAF loop. */
async function mountScene(appearance: AvatarAppearance) {
  const view = render(<RoomScene appearance={appearance} />);
  await waitFor(() => expect(pendingFrames.size).toBe(1));
  return view;
}

/** The scene's one canvas, found even while it is hidden behind the error message. */
function roomCanvas(): HTMLElement {
  return screen.getByRole('img', { hidden: true });
}

describe('RoomScene', () => {
  beforeEach(() => {
    pendingFrames.clear();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
      lastFrameId += 1;
      pendingFrames.set(lastFrameId, callback);
      return lastFrameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      pendingFrames.delete(id);
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    // rng 0: idle lasts exactly 4000 ms, the shortest idle.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    ctx.clearRect.mockReset();
    ctx.drawImage.mockReset();
    drawAvatar.mockReset();
    captureException.mockReset();
    loadSheetCanvas.mockReset().mockResolvedValue(document.createElement('canvas'));
    loadAvatarSheets.mockReset().mockResolvedValue(AVATAR_SHEETS);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sets data-ready only once the first frame is drawn on a sized canvas', async () => {
    await mountScene(APPEARANCE);
    expect(roomCanvas()).toHaveAccessibleName(describeAppearance(APPEARANCE));
    expect(roomCanvas()).not.toHaveAttribute('data-ready');

    // Generation 0: usePixelCanvas has not sized the canvas, and its first resize would wipe a frame.
    flushFrame(0);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    expect(roomCanvas()).not.toHaveAttribute('data-ready');

    resize(1);
    flushFrame(16);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(10);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      'front-idle',
      0,
      FEET_X,
      FEET_Y,
    );
    expect(roomCanvas()).toHaveAttribute('data-ready', 'true');
    expect(pendingFrames.size).toBe(1);
  });

  it('redraws only when the frame or the canvas size changes', async () => {
    await mountScene(APPEARANCE);
    resize(1);
    flushFrame(0);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    // Still front-idle frame 0 (frames are 100 ms long).
    flushFrame(16);
    flushFrame(50);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    flushFrame(116);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      'front-idle',
      1,
      FEET_X,
      FEET_Y,
    );

    // A resize clears the canvas, so the same frame is drawn again.
    resize(2);
    flushFrame(132);
    expect(ctx.clearRect).toHaveBeenCalledTimes(3);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      'front-idle',
      1,
      FEET_X,
      FEET_Y,
    );
  });

  it('clamps a long gap between frames to 250 ms', async () => {
    await mountScene(APPEARANCE);
    resize(1);
    flushFrame(0);

    // Unclamped, 10 s would finish the 4 s idle and the 150 ms turn and land in the run.
    flushFrame(10_000);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      'front-idle',
      2,
      FEET_X,
      FEET_Y,
    );

    // It carries on from there: 350 ms into idle is frame 3.
    flushFrame(10_100);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      'front-idle',
      3,
      FEET_X,
      FEET_Y,
    );
  });

  it('shows an error instead of the room when a sheet fails to load', async () => {
    const error = new Error('Failed to load sprite sheet image "plant"');
    loadSheetCanvas.mockRejectedValue(error);
    render(<RoomScene appearance={APPEARANCE} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load the room. Refresh the page to try again.",
    );
    expect(captureException).toHaveBeenCalledWith(error);
    expect(roomCanvas()).not.toBeVisible();
    expect(roomCanvas()).not.toHaveAttribute('data-ready');
    expect(pendingFrames.size).toBe(0);
  });

  it('shows the error and stops the loop when a draw fails', async () => {
    const error = new Error('Sheet canvas "body|" is not loaded');
    drawAvatar.mockImplementation(() => {
      throw error;
    });
    await mountScene(APPEARANCE);
    resize(1);
    flushFrame(0);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the room.");
    expect(captureException).toHaveBeenCalledWith(error);
    expect(roomCanvas()).not.toHaveAttribute('data-ready');
    expect(pendingFrames.size).toBe(0);
  });

  it('drops data-ready while a new appearance loads', async () => {
    const { rerender } = await mountScene(APPEARANCE);
    resize(1);
    flushFrame(0);
    expect(roomCanvas()).toHaveAttribute('data-ready', 'true');

    let finishLoad: (sheets: LoadedSheets) => void = () => {};
    loadAvatarSheets.mockReturnValueOnce(
      new Promise<LoadedSheets>((resolve) => {
        finishLoad = resolve;
      }),
    );
    rerender(<RoomScene appearance={EDITED} />);

    expect(roomCanvas()).toHaveAccessibleName(describeAppearance(EDITED));
    expect(roomCanvas()).not.toHaveAttribute('data-ready');
    // The old look's loop has stopped and the new one waits for its sheets.
    expect(pendingFrames.size).toBe(0);
    expect(loadAvatarSheets).toHaveBeenLastCalledWith(EDITED);

    finishLoad(AVATAR_SHEETS);
    await waitFor(() => expect(pendingFrames.size).toBe(1));
    resize(1);
    flushFrame(1000);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      EDITED,
      'front-idle',
      0,
      FEET_X,
      FEET_Y,
    );
    expect(roomCanvas()).toHaveAttribute('data-ready', 'true');
  });

  it('clears a failed load when the appearance changes', async () => {
    loadSheetCanvas.mockRejectedValueOnce(new Error('Failed to load sprite sheet image "plant"'));
    const { rerender } = render(<RoomScene appearance={APPEARANCE} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    rerender(<RoomScene appearance={EDITED} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await waitFor(() => expect(pendingFrames.size).toBe(1));
    resize(1);
    flushFrame(0);
    expect(roomCanvas()).toBeVisible();
    expect(roomCanvas()).toHaveAccessibleName(describeAppearance(EDITED));
    expect(roomCanvas()).toHaveAttribute('data-ready', 'true');
  });
});
```

- [ ] **Step 14: Write the failing sheet-load-failure test (no canvas context at all)**

A sprite sheet can fail to load on the Pages site (a network hiccup, a stale deploy). RoomScene must then show its error message and never set `data-ready`, so the e2e run and the visual captures never wait on a room that will not draw. This file checks that path with no fake context at all: `getContext` is spied on but not replaced, so if RoomScene asked for a context before its sheets loaded, jsdom would print "Not implemented: HTMLCanvasElement.prototype.getContext" and the `not.toHaveBeenCalled()` check would fail.
- `../avatar/canvas.js` is replaced: one of `loadAvatarSheets` (the avatar layers) or `loadSheetCanvas` (the room sheets) rejects.
- `../avatar/usePixelCanvas.js` is replaced by a hook that returns plain refs, `scale: 1` and `generation: 0`, and never touches the canvas.
- `../avatar/sheets.js` serves the fixture registry, so `layoutRoom` succeeds and the only failure is the load.
- `requestAnimationFrame` is a spy: the loop must never start.

Create `apps/web/src/features/avatar-room/__tests__/RoomScene.loadError.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AvatarAppearance } from '@tracks/types';
import type { SheetData } from '../../avatar/sheets.js';

const { loadSheetCanvas, loadAvatarSheets, drawAvatar, captureException } = vi.hoisted(() => ({
  loadSheetCanvas: vi.fn(),
  loadAvatarSheets: vi.fn(),
  drawAvatar: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/react', () => ({ captureException }));

// The same module paths RoomScene imports: no image is decoded and nothing is drawn.
vi.mock('../../avatar/canvas.js', () => ({ loadSheetCanvas, loadAvatarSheets, drawAvatar }));

// Plain refs and scale 1: no ResizeObserver, no matchMedia, no getContext.
vi.mock('../../avatar/usePixelCanvas.js', async () => {
  const { useRef } = await import('react');
  return {
    usePixelCanvas: () => ({
      stageRef: useRef<HTMLDivElement | null>(null),
      canvasRef: useRef<HTMLCanvasElement | null>(null),
      scale: 1,
      generation: 0,
    }),
  };
});

vi.mock('../../avatar/sheets.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../avatar/sheets.js')>();
  const { roomRegistry } = await import('./roomFixtures.js');
  const registry = roomRegistry();
  return {
    ...actual,
    SHEETS: registry,
    getSheet: (id: string, from: ReadonlyMap<string, SheetData> = registry) =>
      actual.getSheet(id, from),
  };
});

import { RoomScene } from '../RoomScene.js';

const APPEARANCE: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'auburn',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};

describe('RoomScene when a sprite sheet fails to load', () => {
  let requestFrame = vi.fn((_callback: FrameRequestCallback): number => 1);

  beforeEach(() => {
    requestFrame = vi.fn((_callback: FrameRequestCallback): number => 1);
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    captureException.mockReset();
    drawAvatar.mockReset();
    loadSheetCanvas.mockReset().mockResolvedValue(document.createElement('canvas'));
    loadAvatarSheets.mockReset().mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: 'an avatar layer sheet',
      fail: (error: Error) => loadAvatarSheets.mockRejectedValue(error),
      error: new Error('Failed to load sprite sheet image "hair-curly"'),
    },
    {
      name: 'a room sheet',
      fail: (error: Error) => loadSheetCanvas.mockRejectedValue(error),
      error: new Error('Failed to load sprite sheet image "treadmill"'),
    },
  ])('shows the error and never sets data-ready when $name fails', async ({ fail, error }) => {
    // Not mocked: a call would reach jsdom and print "Not implemented".
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    fail(error);

    render(<RoomScene appearance={APPEARANCE} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load the room. Refresh the page to try again.",
    );
    expect(captureException).toHaveBeenCalledWith(error);
    const canvas = screen.getByRole('img', { hidden: true });
    expect(canvas).not.toHaveAttribute('data-ready', 'true');
    expect(canvas).not.toHaveAttribute('data-ready');
    expect(canvas).not.toBeVisible();
    expect(getContext).not.toHaveBeenCalled();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(drawAvatar).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 15: Run both RoomScene tests and watch them fail**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/RoomScene.test.tsx src/features/avatar-room/__tests__/RoomScene.loadError.test.tsx`

Expected: FAIL with `Error: Failed to resolve import "../RoomScene.js" from "src/features/avatar-room/__tests__/RoomScene.test.tsx". Does the file exist?`, the same error for `RoomScene.loadError.test.tsx`, `Test Files  2 failed (2)` and `Tests  no tests`.

- [ ] **Step 16: Implement RoomScene (the room canvas and its rAF loop)**

The exported `RoomScene` keys an inner `RoomCanvas` by the six appearance fields. A refetch that brings a new look (after an edit in another tab or on another device) remounts the canvas, so `data-ready` and any earlier load error never carry over. The loop draws nothing while `generation` is 0, so `data-ready` is never set on a frame that the first resize would wipe. The draw effect asks for a 2D context only once the art has loaded, so a failed load never touches the context (Step 14 checks this), and each tick feeds `step` the gap through `clampDt` from Step 11.

Create `apps/web/src/features/avatar-room/RoomScene.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import type { AvatarAppearance } from '@tracks/types';
import { describeAppearance } from '../avatar/appearance.js';
import { drawAvatar, loadAvatarSheets, loadSheetCanvas, type LoadedSheets } from '../avatar/canvas.js';
import { BODY_SHEET } from '../avatar/catalog.js';
import { frameAt, tagFrames, type AnimationTag, type TagFrame } from '../avatar/frames.js';
import { getSheet } from '../avatar/sheets.js';
import { usePixelCanvas } from '../avatar/usePixelCanvas.js';
import {
  initialBehavior,
  step,
  tagForPhase,
  timingsFromSheet,
  type BehaviorTimings,
} from './behavior.js';
import { clampDt } from './clock.js';
import { layoutRoom, spriteFrame, type PlacedSprite, type RoomLayout } from './roomLayout.js';
import { SAMPLE_ROOM } from './sampleRoom.js';

const ROOM_W = 180;
const ROOM_H = 120;

/** Everything one appearance needs on screen, loaded and swapped up front. */
interface RoomArt {
  appearance: AvatarAppearance;
  layout: RoomLayout;
  room: { sprite: PlacedSprite; image: HTMLCanvasElement }[];
  avatar: LoadedSheets;
  timings: BehaviorTimings;
  frames: Record<AnimationTag, TagFrame[]>;
}

async function loadRoomArt(appearance: AvatarAppearance): Promise<RoomArt> {
  const layout = layoutRoom(SAMPLE_ROOM);
  const body = getSheet(BODY_SHEET);
  const timings = timingsFromSheet(body);
  const frames: Record<AnimationTag, TagFrame[]> = {
    'front-idle': tagFrames(body, 'front-idle'),
    turn: tagFrames(body, 'turn'),
    'side-run': tagFrames(body, 'side-run'),
  };
  const [room, avatar] = await Promise.all([
    Promise.all(
      layout.sprites.map(async (sprite) => ({
        sprite,
        image: await loadSheetCanvas(getSheet(sprite.sheet), null),
      })),
    ),
    loadAvatarSheets(appearance),
  ]);
  return { appearance, layout, room, avatar, timings, frames };
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  art: RoomArt,
  tag: AnimationTag,
  frameOffset: number,
): void {
  ctx.clearRect(0, 0, ROOM_W, ROOM_H);
  for (const { sprite, image } of art.room) {
    const rect = spriteFrame(sprite, tag, frameOffset);
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, sprite.x, sprite.y, rect.w, rect.h);
  }
  const feet = art.layout.avatarFeet;
  drawAvatar(ctx, art.avatar, art.appearance, tag, frameOffset, feet.x, feet.y);
}

/** One string per distinct look, built from the six appearance fields. */
function appearanceKey(a: AvatarAppearance): string {
  return [a.skin_tone, a.hair_style, a.hair_color, a.top, a.bottom, a.shoes].join('|');
}

/** The room canvas. Its rAF loop is the app's only animation driver. */
export function RoomScene({ appearance }: { appearance: AvatarAppearance }) {
  // A new look (say, a refetch after an edit on another device) remounts the
  // canvas, so data-ready and any earlier load error never carry over to it.
  return <RoomCanvas key={appearanceKey(appearance)} appearance={appearance} />;
}

function RoomCanvas({ appearance }: { appearance: AvatarAppearance }) {
  const { stageRef, canvasRef, generation } = usePixelCanvas(ROOM_W, ROOM_H);
  const [art, setArt] = useState<RoomArt | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // A resize clears the canvas; the loop redraws when it sees a new generation.
  const generationRef = useRef(generation);

  useEffect(() => {
    generationRef.current = generation;
  }, [generation]);

  useEffect(() => {
    let cancelled = false;
    loadRoomArt(appearance).then(
      (loaded) => {
        if (!cancelled) setArt(loaded);
      },
      (error: unknown) => {
        if (cancelled) return;
        Sentry.captureException(error);
        setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [appearance]);

  useEffect(() => {
    // No context until the sheets are in: a failed load never asks for one.
    if (!art) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    let behavior = initialBehavior(Math.random, art.timings);
    let lastTime: number | null = null;
    let drawnKey = '';
    let announced = false;
    let frameId = 0;

    const tick = (now: number): void => {
      // A tab back from the background resumes where it was (see clock.ts).
      const dtMs = lastTime === null ? 0 : clampDt(now - lastTime);
      lastTime = now;
      behavior = step(behavior, dtMs, Math.random, art.timings);
      const tag = tagForPhase(behavior.phase);
      const frameOffset = frameAt(art.frames[tag], behavior.msInPhase);
      // Generation 0: usePixelCanvas has not sized the canvas yet, and its first
      // resize would wipe this frame right after data-ready announced it.
      const sizedGeneration = generationRef.current;
      const key = `${sizedGeneration}|${tag}|${frameOffset}`;
      if (sizedGeneration > 0 && key !== drawnKey) {
        try {
          drawRoom(ctx, art, tag, frameOffset);
        } catch (error) {
          Sentry.captureException(error);
          setFailed(true);
          return;
        }
        drawnKey = key;
        if (!announced) {
          announced = true;
          setReady(true);
        }
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [art, canvasRef]);

  // The root fills RoomPage's stage, so usePixelCanvas's ResizeObserver measures the stage.
  return (
    <div
      ref={stageRef}
      className="flex size-full min-w-0 items-center justify-center overflow-hidden"
    >
      {failed && (
        <p role="alert" className="m-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Couldn't load the room. Refresh the page to try again.
        </p>
      )}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={describeAppearance(appearance)}
        data-ready={ready && !failed ? 'true' : undefined}
        hidden={failed}
        className="[image-rendering:pixelated]"
      />
    </div>
  );
}
```

- [ ] **Step 17: Run the RoomScene test and watch it pass**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/RoomScene.test.tsx src/features/avatar-room/__tests__/RoomScene.loadError.test.tsx`

Expected: PASS, `Test Files  2 passed (2)` and `Tests  9 passed (9)` (7 in `RoomScene.test.tsx`, 2 in `RoomScene.loadError.test.tsx`), with no stderr output (no act warnings, no "Not implemented" messages).

- [ ] **Step 18: Typecheck and lint RoomScene**

Run: `pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint`

Expected: both exit 0 with no errors or warnings.

- [ ] **Step 19: Commit RoomScene**

```bash
git add apps/web/src/features/avatar-room/clock.ts apps/web/src/features/avatar-room/RoomScene.tsx apps/web/src/features/avatar-room/__tests__/clock.test.ts apps/web/src/features/avatar-room/__tests__/RoomScene.test.tsx apps/web/src/features/avatar-room/__tests__/RoomScene.loadError.test.tsx
git commit -F - <<'EOF'
Add the room canvas and its animation loop

RoomScene loads and swaps every sheet up front, then one rAF loop
steps the behavior machine and redraws only when the tag, frame or
canvas size changes. clampDt (clock.ts) caps each tick at 250 ms, so
a tab back from the background resumes in the same state. It waits
for the first resize before drawing, sets data-ready after that
first frame, and shows an error message instead if a sheet fails to
load or draw, without ever asking for a context on a failed load. A
new look remounts the canvas, so ready and error state never carry
over to it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 20: Write the failing RoomPage test**

Create `apps/web/src/features/avatar-room/__tests__/RoomPage.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { Avatar, AvatarAppearance } from '@tracks/types';
import type { User } from '../../../lib/supabase.js';

const { get, put, scene } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  // How many times the stub scene has mounted.
  scene: { mounts: 0 },
}));

vi.mock('../../../lib/api.js', () => ({
  api: { get, put },
}));

// jsdom has no canvas: the real RoomScene never mounts (.claude/CLAUDE.md rule 26).
vi.mock('../RoomScene.js', async () => {
  const { useEffect } = await import('react');
  const { describeAppearance } = await import('../../avatar/appearance.js');
  return {
    RoomScene: (props: { appearance: AvatarAppearance }) => {
      useEffect(() => {
        scene.mounts += 1;
      }, []);
      return <div role="img" aria-label={describeAppearance(props.appearance)} />;
    },
  };
});

import { useAuthStore } from '../../../store/auth.store.js';
import { describeAppearance } from '../../avatar/appearance.js';
import { RoomPage } from '../RoomPage.js';

const USER_A = { id: 'user-a' } as User;
const USER_B = { id: 'user-b' } as User;

const APPEARANCE: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'auburn',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};
const EDITED: AvatarAppearance = { ...APPEARANCE, hair_color: 'blonde' };

const AVATAR: Avatar = {
  ...APPEARANCE,
  created_at: '2026-10-04T12:00:00+00:00',
  updated_at: '2026-10-04T12:00:00+00:00',
};

const FOUND = { success: true, data: AVATAR };
const FOUND_EDITED = {
  success: true,
  data: { ...AVATAR, ...EDITED, updated_at: '2026-10-04T13:00:00+00:00' },
};
const NOT_FOUND = {
  success: false,
  error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' },
};
// What api.ts throws for GitHub Pages' HTML 404 while the API is unhosted.
const PAGES_404 = { success: false, error: { code: 'UNKNOWN', message: 'Not Found' } };

function renderRoom() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([
    { path: '/', element: <RoomPage /> },
    { path: '/create', element: <h1>Creator stub</h1> },
  ]);
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

describe('RoomPage', () => {
  beforeEach(() => {
    get.mockReset();
    scene.mounts = 0;
    useAuthStore.setState({ user: USER_A });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null });
  });

  it('shows a loading skeleton while the avatar loads', async () => {
    get.mockReturnValue(new Promise(() => {}));
    renderRoom();

    expect(await screen.findByRole('status', { name: 'Loading your room' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/avatar');
  });

  it('shows the room with the saved avatar', async () => {
    get.mockResolvedValue(FOUND);
    const { router } = renderRoom();

    expect(
      await screen.findByRole('img', { name: describeAppearance(APPEARANCE) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('links Edit avatar to the creator', async () => {
    get.mockResolvedValue(FOUND);
    const { router } = renderRoom();

    const edit = await screen.findByRole('link', { name: 'Edit avatar' });
    expect(edit).toHaveAttribute('href', '/create');
    fireEvent.click(edit);

    expect(await screen.findByRole('heading', { name: 'Creator stub' })).toBeInTheDocument();
    expect(router.state.historyAction).toBe('PUSH');
  });

  it('keeps the room mounted through a background refetch and passes the new look on', async () => {
    let answer: (value: unknown) => void = () => {};
    get.mockResolvedValueOnce(FOUND).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { queryClient } = renderRoom();
    expect(
      await screen.findByRole('img', { name: describeAppearance(APPEARANCE) }),
    ).toBeInTheDocument();

    // What a window-focus refetch does after an edit in another tab or on another device.
    await act(async () => {
      void queryClient.refetchQueries();
      // Let TanStack Query's batched notification render the fetching state.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('img', { name: describeAppearance(APPEARANCE) })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    answer(FOUND_EDITED);
    expect(
      await screen.findByRole('img', { name: describeAppearance(EDITED) }),
    ).toBeInTheDocument();
    // Same scene instance: RoomScene itself starts over for the new look.
    expect(scene.mounts).toBe(1);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('replaces the room with the creator when the user has no avatar', async () => {
    get.mockRejectedValue(NOT_FOUND);
    const { router } = renderRoom();

    expect(await screen.findByRole('heading', { name: 'Creator stub' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/create');
    // Replace, so Back does not bounce through the room again.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['an UNKNOWN error from an HTML 404', PAGES_404],
  ])('shows the unreachable state on %s and never redirects', async (_name, error) => {
    get.mockRejectedValue(error);
    const { router } = renderRoom();

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit avatar' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('refetches on Retry and shows the room once the server answers', async () => {
    get.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(FOUND);
    renderRoom();

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByRole('img', { name: describeAppearance(APPEARANCE) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('refetches for a new user and redirects when that user has no avatar', async () => {
    get.mockResolvedValueOnce(FOUND).mockRejectedValueOnce(NOT_FOUND);
    const { router } = renderRoom();
    expect(
      await screen.findByRole('img', { name: describeAppearance(APPEARANCE) }),
    ).toBeInTheDocument();

    act(() => {
      useAuthStore.setState({ user: USER_B });
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/create'));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 21: Run the RoomPage test and watch it fail**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/RoomPage.test.tsx`

Expected: FAIL with `Error: Failed to resolve import "../RoomPage.js" from "src/features/avatar-room/__tests__/RoomPage.test.tsx". Does the file exist?` and `Tests  no tests`.

- [ ] **Step 22: Implement RoomPage**

Create `apps/web/src/features/avatar-room/RoomPage.tsx`:

```tsx
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Pencil } from 'lucide-react';
import { Button } from '../../components/ui/button.js';
import { Skeleton } from '../../components/ui/skeleton.js';
import { useAvatar } from '../avatar/useAvatar.js';
import { RoomScene } from './RoomScene.js';

/** The main screen: the avatar in its room, or where to go when there is none. */
export function RoomPage() {
  const { data: avatar, isError, isFetching, refetch } = useAvatar();
  const navigate = useNavigate();
  const hasNoAvatar = avatar === null;

  useEffect(() => {
    if (hasNoAvatar) void navigate('/create', { replace: true });
  }, [hasNoAvatar, navigate]);

  if (!avatar && isError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4 text-center">
        <div role="alert" className="space-y-1">
          <p className="font-medium">Can't reach the server</p>
          <p className="text-sm text-muted-foreground">Check your connection, then try again.</p>
        </div>
        <Button variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        {avatar ? (
          <RoomScene appearance={avatar} />
        ) : (
          <Skeleton
            role="status"
            aria-label="Loading your room"
            className="aspect-[3/2] max-h-full w-full"
          />
        )}
      </div>
      {avatar && (
        <Button asChild variant="secondary" className="my-3 shrink-0">
          <Link to="/create">
            <Pencil /> Edit avatar
          </Link>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 23: Run the RoomPage test and watch it pass**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/RoomPage.test.tsx`

Expected: PASS, `Test Files  1 passed (1)` and `Tests  9 passed (9)`, with no stderr output (no act warnings, no "Not implemented" messages).

- [ ] **Step 24: Run the whole web suite, typecheck and lint**

Run: `pnpm --filter @tracks/web test && pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint`

Expected: every test file passes with no stderr output, including `roomLayout.test.ts` (16), `clock.test.ts` (5), `RoomScene.test.tsx` (7), `RoomScene.loadError.test.tsx` (2) and `RoomPage.test.tsx` (9). Typecheck and lint exit 0 with no errors or warnings. Fix anything reported before you commit (.claude/CLAUDE.md rule 26).

- [ ] **Step 25: Commit RoomPage**

```bash
git add apps/web/src/features/avatar-room/RoomPage.tsx apps/web/src/features/avatar-room/__tests__/RoomPage.test.tsx
git commit -F - <<'EOF'
Add the room page with load, redirect and offline states

RoomPage shows a skeleton while the avatar loads, the room plus an
Edit avatar link once it exists, and replaces itself with the creator
when there is no avatar. Any other failure, including the Pages
build's UNKNOWN 404, shows "Can't reach the server" with a Retry
button and never redirects. A background refetch keeps the room
mounted and hands it the new look, and a different user refetches.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

---

### Task 12: Routing and shell: room as main page

**Files:**
- Create: `apps/web/src/__tests__/AppShell.test.tsx`
- Create: `apps/web/src/__tests__/AvatarEditFlow.test.tsx`
- Create: `apps/web/src/__tests__/favicon.test.ts`
- Create: `apps/web/public/favicon.svg`
- Modify: `apps/web/src/__tests__/App.test.tsx` (whole file)
- Modify: `apps/web/src/components/layout/AppShell.tsx` (line 30: `<main>` drops `p-4`)
- Modify: `apps/web/src/components/layout/Sidebar.tsx` (line 3: `navItems`)
- Modify: `apps/web/src/components/layout/Header.tsx` (line 12: Sign out uses the default `min-h-11` Button size, per .claude/CLAUDE.md rules 12 and 26)
- Modify: `apps/web/src/router.tsx` (whole file, lines 1-21)
- Modify: `apps/web/vite.config.ts` (lines 26-29: `build` gains `rolldownOptions.output.codeSplitting`, per rule 26)
- Modify: `apps/web/index.html` (after line 5: icon link, per rule 26)
- Modify: `README.md` (lines 693-695: the `pages/` entry in the Web tree)
- Modify: `scripts/init.ts` (line 55: `TARGET_FILES`)
- Delete: `apps/web/src/pages/DashboardPage.tsx`
- Test: `apps/web/src/__tests__/AppShell.test.tsx`, `apps/web/src/__tests__/App.test.tsx`, `apps/web/src/__tests__/AvatarEditFlow.test.tsx`, `apps/web/src/__tests__/favicon.test.ts`

**Interfaces:**
Consumes (from Tasks 1-11, using the contract's exact names):
- `RoomPage()` from `apps/web/src/features/avatar-room/RoomPage.tsx` (Task 11). Per spec §3, its root is `flex h-full w-full flex-col items-center` with no padding. It renders `<RoomScene appearance={avatar} />` and the `Edit avatar` link (`<Link to="/create">`).
- `CreatorPage()` from `apps/web/src/features/avatar-creator/CreatorPage.tsx` (Task 10). Per spec §3, its root is `flex h-full flex-col p-4`. It has one `<fieldset>` per field, with the legends `Skin tone`, `Hair style`, `Hair color`, `Top`, `Bottom` and `Shoes`. Each radio's `value` is the item ID and its accessible name is the catalog label. Save calls `useSaveAvatar` and then `navigate('/')`.
- `RoomScene(props: { appearance: AvatarAppearance })` and `AvatarSprite(props: { appearance: AvatarAppearance; tag: AnimationTag; frame: number; className?: string })`. Both are replaced with `vi.mock` here.
- `describeAppearance(a: AvatarAppearance): string` from `apps/web/src/features/avatar/appearance.ts`.
- `SKIN_TONE_OPTIONS`, `HAIR_STYLE_OPTIONS`, `HAIR_COLOR_OPTIONS`, `TOP_OPTIONS`, `BOTTOM_OPTIONS`, `SHOES_OPTIONS` from `apps/web/src/features/avatar/catalog.ts`.
- `useAvatar()` and `useSaveAvatar()` (which writes the cache at `avatarQueryKey(user?.id)`), reached through the pages.
- `queryClient` from `apps/web/src/lib/queryClient.ts` (unchanged; this task only reads its default options). `api` from `apps/web/src/lib/api.ts` (mocked). `useAuth()` from `apps/web/src/hooks/useAuth.ts` (mocked in the shell test).
- Types `Avatar` and `AvatarAppearance` from `@tracks/types`.

Produces:
- `router` in `apps/web/src/router.tsx`: built with `createHashRouter`, with `/login` → `<LoginPage />` and `/` → `<AppShell />`. Its children are `{ index: true, element: <RoomPage /> }` and `{ path: 'create', element: <CreatorPage /> }`.
- AppShell renders `<main className="flex-1 overflow-y-auto">`. Sidebar has `navItems = [{ path: '/', label: 'Room' }]`. Header's Sign out uses the default Button size (`min-h-11`).
- `apps/web/vite.config.ts` gets `build.rolldownOptions.output.codeSplitting.groups` with three groups: `react` (react, react-dom, scheduler, react-router; priority 3), `supabase` (`@supabase/*`; priority 2) and `vendor` (the rest of `node_modules`; priority 1).
- `apps/web/public/favicon.svg`, linked from `apps/web/index.html` as `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`.
- No new TypeScript exports.

- [ ] **Step 1: Write the failing shell test**

Create `apps/web/src/__tests__/AppShell.test.tsx`:

```tsx
import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

const signOut = vi.fn();

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({
    session: { access_token: 'token-a' },
    user: { id: 'user-a', email: 'a@example.com' },
    isLoading: false,
    signOut,
  }),
}));

import { AppShell } from '../components/layout/AppShell.js';

function renderShell() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>Login</p> },
      {
        path: '/',
        element: <AppShell />,
        children: [{ index: true, element: <p>Page content</p> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

describe('AppShell', () => {
  afterEach(cleanup);

  it('offers the room as its only nav destination', () => {
    renderShell();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Room' })).toHaveAttribute('href', '/');
  });

  it('leaves padding to each page: main scrolls but has no padding of its own', () => {
    renderShell();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex-1', 'overflow-y-auto');
    expect(main).not.toHaveClass('p-4');
    expect(main).toHaveTextContent('Page content');
  });

  it('gives Sign out a 44px touch target', () => {
    renderShell();

    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveClass('min-h-11');
  });
});
```

- [ ] **Step 2: Run the shell test and confirm it fails**

Run: `pnpm --filter @tracks/web exec vitest run src/__tests__/AppShell.test.tsx`

Expected: FAIL, 3 failed (3), with:
```
× offers the room as its only nav destination
TestingLibraryElementError: Unable to find an accessible element with the role "link" and name "Room"
× leaves padding to each page: main scrolls but has no padding of its own
Error: expect(element).not.toHaveClass("p-4")
× gives Sign out a 44px touch target
Error: expect(element).toHaveClass("min-h-11")
```
The Sidebar link is still named `Dashboard`, `<main>` still has `p-4`, and Sign out is `h-8` (`size="sm"`).

- [ ] **Step 3: Implement the shell changes**

Replace the whole of `apps/web/src/components/layout/AppShell.tsx`. Only line 30 changes: `<main>` loses `p-4`.

```tsx
import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth.js';
import { useEffect } from 'react';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';

export function AppShell() {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

Replace the whole of `apps/web/src/components/layout/Sidebar.tsx`. Only line 3 changes.

```tsx
import { Link, useLocation } from 'react-router';

const navItems = [{ path: '/', label: 'Room' }];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden w-64 border-r border-border bg-muted/50 md:block">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-lg font-semibold">Tracks</span>
      </div>
      <nav className="p-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm ${
              location.pathname === item.path
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

Replace the whole of `apps/web/src/components/layout/Header.tsx`. Only line 12 changes: removing `size="sm"` gives the button the default `min-h-11 px-4 py-2` size.

```tsx
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../ui/button.js';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <Button variant="ghost" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run the shell test and confirm it passes**

Run: `pnpm --filter @tracks/web exec vitest run src/__tests__/AppShell.test.tsx`

Expected: PASS, `Test Files  1 passed (1)`, `Tests  3 passed (3)`, with no stderr output.

- [ ] **Step 5: Typecheck and lint the shell change**

Run: `pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint`

Expected: both exit 0, with no TypeScript errors and no ESLint problems.

- [ ] **Step 6: Commit the shell change**

```bash
git branch --show-current   # expected: feat/avatar-room
git add apps/web/src/__tests__/AppShell.test.tsx apps/web/src/components/layout/AppShell.tsx apps/web/src/components/layout/Sidebar.tsx apps/web/src/components/layout/Header.tsx
git commit -F - <<'EOF'
Let pages own their padding and make Room the only nav item

The AppShell main element drops p-4, so the room can be full-bleed
while the creator sets its own padding. The Sidebar now offers only
Room, and Sign out uses the default Button size for a 44px touch target.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 7: Update App.test.tsx so App mounts with a QueryClientProvider**

Replace the whole of `apps/web/src/__tests__/App.test.tsx`:

```tsx
import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  captureException: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../lib/api.js';
import { App } from '../App.js';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('inside a QueryClientProvider, a signed-out visitor at #/ reaches Sign In with no API call or console error', async () => {
    const consoleError = vi.spyOn(console, 'error');
    // main.tsx owns the app's QueryClientProvider. AppShell renders the index RoomPage once
    // before it redirects to /login, and RoomPage's useAvatar needs a client.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
    expect(api.get).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Write the failing edit-flow integration test**

Create `apps/web/src/__tests__/AvatarEditFlow.test.tsx`. It renders the real `<App />`, so it drives `router.tsx` with both pages. `RoomScene` and `AvatarSprite` are stubbed because jsdom has no canvas. `api` is mocked, and the query client copies the app's 5-minute `staleTime`.

```tsx
import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Avatar, AvatarAppearance } from '@tracks/types';

// Accessible names RoomScene was rendered with, in order.
const roomRenders = vi.hoisted((): string[] => []);

vi.mock('@/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: 'token-a', user: { id: 'user-a', email: 'a@example.com' } },
        },
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-a', email: 'a@example.com' } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  captureException: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// jsdom has no canvas: both canvas components become an accessible <div>.
vi.mock('../features/avatar-room/RoomScene.js', async () => {
  const { describeAppearance } = await import('../features/avatar/appearance.js');
  return {
    RoomScene: ({ appearance }: { appearance: AvatarAppearance }) => {
      const name = describeAppearance(appearance);
      roomRenders.push(name);
      return <div role="img" aria-label={name} data-testid="room-scene" />;
    },
  };
});

vi.mock('../features/avatar/AvatarSprite.js', async () => {
  const { describeAppearance } = await import('../features/avatar/appearance.js');
  return {
    AvatarSprite: ({ appearance }: { appearance: AvatarAppearance }) => (
      <div role="img" aria-label={describeAppearance(appearance)} data-testid="avatar-sprite" />
    ),
  };
});

import { api } from '../lib/api.js';
import { queryClient as appQueryClient } from '../lib/queryClient.js';
import { App } from '../App.js';
import { describeAppearance } from '../features/avatar/appearance.js';
import {
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from '../features/avatar/catalog.js';

const initialAppearance: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'black',
  top: 'starter-tee-red',
  bottom: 'starter-shorts-navy',
  shoes: 'starter-shoes-white',
};

// Every field differs from initialAppearance.
const savedAppearance: AvatarAppearance = {
  skin_tone: 'tone-5',
  hair_style: 'ponytail',
  hair_color: 'blonde',
  top: 'starter-tee-green',
  bottom: 'starter-shorts-gray',
  shoes: 'starter-shoes-red',
};

const initialAvatar: Avatar = {
  ...initialAppearance,
  created_at: '2026-10-04T12:00:00.000Z',
  updated_at: '2026-10-04T12:00:00.000Z',
};

const savedAvatar: Avatar = {
  ...savedAppearance,
  created_at: '2026-10-04T12:00:00.000Z',
  updated_at: '2026-10-04T12:05:00.000Z',
};

function group(legend: string) {
  return within(screen.getByRole('group', { name: legend }));
}

function pick(legend: string, label: string) {
  fireEvent.click(group(legend).getByRole('radio', { name: label }));
}

function expectPrefilled(appearance: AvatarAppearance) {
  const checked = (legend: string) =>
    group(legend).getByRole('radio', { checked: true }).getAttribute('value');
  expect(checked('Skin tone')).toBe(appearance.skin_tone);
  expect(checked('Hair style')).toBe(appearance.hair_style);
  expect(checked('Hair color')).toBe(appearance.hair_color);
  expect(checked('Top')).toBe(appearance.top);
  expect(checked('Bottom')).toBe(appearance.bottom);
  expect(checked('Shoes')).toBe(appearance.shoes);
}

describe('avatar edit flow', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('After Edit -> Save, without a reload, the room renders the saved appearance without another GET, and reopening Edit prefills it', async () => {
    const consoleError = vi.spyOn(console, 'error');
    vi.mocked(api.get).mockResolvedValue({ success: true, data: initialAvatar });
    vi.mocked(api.put).mockResolvedValue({ success: true, data: savedAvatar });
    // Fresh client with the app's query defaults (5-minute staleTime), so a page
    // that mounts reuses the cache exactly as it does in the app.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { ...appQueryClient.getDefaultOptions().queries, retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    // #/ is the room, inside AppShell's <main>, full-bleed.
    const room = await screen.findByTestId('room-scene');
    expect(room).toHaveAccessibleName(describeAppearance(initialAppearance));
    expect(screen.getByRole('main').firstElementChild).not.toHaveClass('p-4');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/avatar');

    // Edit avatar opens #/create prefilled; the creator pads itself.
    fireEvent.click(screen.getByRole('link', { name: 'Edit avatar' }));
    await screen.findByRole('group', { name: 'Skin tone' });
    expect(window.location.hash).toBe('#/create');
    expect(screen.getByRole('main').firstElementChild).toHaveClass('p-4');
    expectPrefilled(initialAppearance);

    pick('Skin tone', SKIN_TONE_OPTIONS[savedAppearance.skin_tone].label);
    pick('Hair style', HAIR_STYLE_OPTIONS[savedAppearance.hair_style].label);
    pick('Hair color', HAIR_COLOR_OPTIONS[savedAppearance.hair_color].label);
    pick('Top', TOP_OPTIONS[savedAppearance.top].label);
    pick('Bottom', BOTTOM_OPTIONS[savedAppearance.bottom].label);
    pick('Shoes', SHOES_OPTIONS[savedAppearance.shoes].label);
    roomRenders.length = 0;
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));

    // Back on #/, the room's very first render already shows the saved appearance.
    const savedRoom = await screen.findByTestId('room-scene');
    expect(window.location.hash).toBe('#/');
    expect(savedRoom).toHaveAccessibleName(describeAppearance(savedAppearance));
    expect(new Set(roomRenders)).toEqual(new Set([describeAppearance(savedAppearance)]));
    expect(screen.queryByTestId('avatar-sprite')).not.toBeInTheDocument();
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith('/avatar', expect.objectContaining(savedAppearance));
    expect(api.get).toHaveBeenCalledTimes(1);

    // Reopening Edit prefills the saved appearance, still from the cache.
    fireEvent.click(screen.getByRole('link', { name: 'Edit avatar' }));
    await screen.findByRole('group', { name: 'Skin tone' });
    expectPrefilled(savedAppearance);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 9: Run both app-level tests and confirm the flow test fails**

Run: `pnpm --filter @tracks/web exec vitest run src/__tests__/App.test.tsx src/__tests__/AvatarEditFlow.test.tsx`

Expected: `Test Files  1 failed | 1 passed (2)`, with:
```
FAIL  src/__tests__/AvatarEditFlow.test.tsx > avatar edit flow > After Edit -> Save, without a reload, the room renders the saved appearance without another GET, and reopening Edit prefills it
TestingLibraryElementError: Unable to find an element by: [data-testid="room-scene"]
```
The index route still renders DashboardPage. App.test.tsx already passes, because DashboardPage makes no query. Its provider starts to matter in Step 10. AppShell renders the index route once before its effect sends a signed-out visitor to `/login`, so RoomPage's `useAvatar` runs. Without a provider, that call throws `No QueryClient set, use QueryClientProvider to set one`. React Router's default ErrorBoundary then replaces the page, and the test fails with `Unable to find role="heading" and name "Sign In"`.

- [ ] **Step 10: Route the room and the creator**

Replace the whole of `apps/web/src/router.tsx`:

```tsx
import { createHashRouter } from 'react-router';
import { AppShell } from './components/layout/AppShell.js';
import { LoginPage } from './pages/LoginPage.js';
import { RoomPage } from './features/avatar-room/RoomPage.js';
import { CreatorPage } from './features/avatar-creator/CreatorPage.js';

export const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <RoomPage />,
      },
      {
        path: 'create',
        element: <CreatorPage />,
      },
    ],
  },
]);
```

- [ ] **Step 11: Delete DashboardPage**

Run: `git rm apps/web/src/pages/DashboardPage.tsx`

Expected: `rm 'apps/web/src/pages/DashboardPage.tsx'`. Only `LoginPage.tsx` is left in `apps/web/src/pages/`.

- [ ] **Step 12: Run both app-level tests and confirm they pass**

Run: `pnpm --filter @tracks/web exec vitest run src/__tests__/App.test.tsx src/__tests__/AvatarEditFlow.test.tsx`

Expected: PASS, `Test Files  2 passed (2)`, `Tests  2 passed (2)`. Stderr is empty: no `act(...)`, `Not implemented` or React Router warnings.

- [ ] **Step 13: Remove DashboardPage from the README tree and from init.ts**

In `README.md` (Web tree, lines 693-695), replace:
```
├── pages/
│   ├── DashboardPage.tsx
│   └── LoginPage.tsx
```
with:
```
├── pages/
│   └── LoginPage.tsx
```

In `scripts/init.ts`, delete this line from `TARGET_FILES` under `// Web source` (line 55):
```ts
  'apps/web/src/pages/DashboardPage.tsx',
```
The block then reads:
```ts
  // Web source
  'apps/web/index.html',
  'apps/web/capacitor.config.ts',
  'apps/web/src/components/layout/Sidebar.tsx',
```

- [ ] **Step 14: Verify nothing still references the dashboard**

Run: `git grep -n "DashboardPage" -- . ":(exclude)docs/superpowers"; git grep -n "label: 'Dashboard'" -- apps`

Expected: neither command prints anything, and each exits 1. The spec in `docs/superpowers/` is now the only file that names DashboardPage.

- [ ] **Step 15: Run the full web test suite**

Run: `pnpm --filter @tracks/web test`

Expected: every test file passes, with 0 failed and no warnings on stderr. That includes the avatar, avatar-room and avatar-creator tests from Tasks 5-11, `LoginPage.test.tsx`, and this task's three files so far (`AppShell.test.tsx`, `App.test.tsx` and `AvatarEditFlow.test.tsx`). `art.test.ts` does not exist yet; Task 14 adds it.

- [ ] **Step 16: Typecheck and lint the routing change**

Run: `pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint`

Expected: both exit 0, with nothing printed beyond the script banners.

- [ ] **Step 17: Commit the routing change**

```bash
git add apps/web/src/router.tsx apps/web/src/__tests__/App.test.tsx apps/web/src/__tests__/AvatarEditFlow.test.tsx README.md scripts/init.ts
git status --short
# expected:
# M  README.md
# M  apps/web/src/__tests__/App.test.tsx
# A  apps/web/src/__tests__/AvatarEditFlow.test.tsx
# D  apps/web/src/pages/DashboardPage.tsx
# M  apps/web/src/router.tsx
# M  scripts/init.ts
git commit -F - <<'EOF'
Make the room the main page and route the creator at #/create

The AppShell children become RoomPage (index) and CreatorPage (create).
DashboardPage is deleted, along with its README tree and init.ts
TARGET_FILES entries. App.test now wraps App in a QueryClientProvider
and mocks api. An integration test covers Edit, Save and the return to
the room without another GET, and checks that reopening Edit prefills.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 18: Build and confirm the chunk-size warning (the failing check)**

Run:
```bash
pnpm --filter @tracks/web build 2>&1 | tee "$TEMP/web-build.log"
grep -F "larger than 500 kB" "$TEMP/web-build.log"
```

Expected: the build succeeds (`✓ built in …`), but everything lands in a single `assets/index-*.js` chunk of more than 616 kB. On main that chunk is 616.09 kB, and Tasks 1-11 make it larger. grep prints `(!) Some chunks are larger than 500 kB after minification. Consider:`. Under .claude/CLAUDE.md rule 26, this warning must be fixed, which Step 19 does.

- [ ] **Step 19: Split vendor code into its own chunks**

Replace the whole of `apps/web/vite.config.ts`. Only the `build` block changes: it gains `rolldownOptions` (Vite 8 bundles with Rolldown, and `codeSplitting` replaces the deprecated `manualChunks`).

```ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/; local dev and Capacitor use /
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rolldownOptions: {
      output: {
        // Vendor code in its own chunks keeps every chunk under Vite's 500 kB
        // warning, and app releases leave the cached vendor chunks valid.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
              priority: 3,
            },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 2 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
```

- [ ] **Step 20: Rebuild and confirm the warning is gone**

Run:
```bash
pnpm --filter @tracks/web build 2>&1 | tee "$TEMP/web-build.log"
grep -cF "larger than 500 kB" "$TEMP/web-build.log"
```

Expected: the build ends with `✓ built in …` and its chunk list has no `(!)` block. The list shows `assets/rolldown-runtime-*.js` (about 0.6 kB), `assets/index-*.js` (the app code), `assets/vendor-*.js` (about 80 kB), `assets/supabase-*.js` (about 214 kB) and `assets/react-*.js` (about 311 kB). Each is well under 500 kB. grep prints `0`.

- [ ] **Step 21: Commit the vendor split**

```bash
git add apps/web/vite.config.ts
git status --short
# expected:
# M  apps/web/vite.config.ts
git commit -F - <<'EOF'
Split vendor code so no build chunk passes 500 kB

The app built to one chunk of more than 616 kB, so vite build printed
its chunk-size warning. Rolldown codeSplitting groups now put react,
react-dom, scheduler and react-router in a react chunk, @supabase in a
supabase chunk and the rest of node_modules in vendor. Every chunk is
under 500 kB, and app-only releases keep the vendor chunks cached.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 22: Write the failing favicon test**

`apps/web/index.html` has no icon link and `apps/web` has no `public/` folder, so Chrome requests `/favicon.ico` on every load. Both the dev server and the preview answer 404, and the console logs `Failed to load resource: the server responded with a status of 404 (Not Found)` for `/favicon.ico` twice. Step 28's console check would fail on this, and rule 26 puts it in scope here.

Create `apps/web/src/__tests__/favicon.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import indexHtml from '../../index.html?raw';

// Every file in public/, as text, keyed by its path relative to this test.
const publicFiles = import.meta.glob<string>('../../public/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('favicon', () => {
  it('index.html links an SVG icon that public/ serves, so the browser never requests /favicon.ico', () => {
    const href = /<link rel="icon" type="image\/svg\+xml" href="\/([^"]+)" \/>/.exec(indexHtml)?.[1];
    expect(href).toBe('favicon.svg');

    const svg = publicFiles['../../public/favicon.svg'];
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32">/);
  });
});
```

- [ ] **Step 23: Run the favicon test and confirm it fails**

Run: `pnpm --filter @tracks/web exec vitest run src/__tests__/favicon.test.ts`

Expected: FAIL, `Tests  1 failed (1)`, with:
```
FAIL  src/__tests__/favicon.test.ts > favicon > index.html links an SVG icon that public/ serves, so the browser never requests /favicon.ico
AssertionError: expected undefined to be 'favicon.svg' // Object.is equality
```

- [ ] **Step 24: Add the favicon and link it**

Create `apps/web/public/favicon.svg`. It is a placeholder "T" monogram in the theme's `--primary` and `--primary-foreground` neutrals (`oklch(0.205 0 0)` and `oklch(0.985 0 0)`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#171717"/>
  <path d="M8 8h16v4h-6v12h-4V12H8z" fill="#fafafa"/>
</svg>
```

Replace the whole of `apps/web/index.html`. Only the `<link rel="icon">` line is new, placed after line 5. Vite copies `public/` into `dist/` and adds `VITE_BASE_PATH` to the href in the Pages build.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Tracks</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 25: Run the favicon test and confirm it passes**

Run: `pnpm --filter @tracks/web exec vitest run src/__tests__/favicon.test.ts`

Expected: PASS, `Test Files  1 passed (1)`, `Tests  1 passed (1)`, with no stderr output.

- [ ] **Step 26: Commit the favicon**

```bash
git add apps/web/index.html apps/web/public/favicon.svg apps/web/src/__tests__/favicon.test.ts
git status --short
# expected:
# M  apps/web/index.html
# A  apps/web/public/favicon.svg
# A  apps/web/src/__tests__/favicon.test.ts
git commit -F - <<'EOF'
Add a favicon so the browser stops requesting /favicon.ico

index.html had no icon link and apps/web had no public/ folder, so
every page load logged a 404 for /favicon.ico in the console.
public/favicon.svg is a placeholder T monogram, and a test checks that
index.html links an SVG that public/ actually serves.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 27: Run every web check once more**

Run:
```bash
pnpm --filter @tracks/web test && pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint && pnpm --filter @tracks/web build 2>&1 | tee "$TEMP/web-build.log"
grep -cF "larger than 500 kB" "$TEMP/web-build.log"
```

Expected:
- test: every file passes with 0 failed, now including `favicon.test.ts`, and stderr has no warnings.
- typecheck and lint: both exit 0 with no output beyond the script banners.
- build: ends with `✓ built in …` with the same chunk list as Step 20, and `dist/favicon.svg` is present.
- grep: prints `0`.

- [ ] **Step 28: Verify the shell in the browser (rules 22-25)**

Pick the browser tool first:
1. Load the `claude-in-chrome` skill.
2. If it reports that browser tools are not available, use the Playwright MCP instead. Load it with ToolSearch, query `select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_resize,mcp__plugin_playwright_playwright__browser_console_messages,mcp__plugin_playwright_playwright__browser_network_requests,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_evaluate,mcp__plugin_playwright_playwright__browser_click,mcp__plugin_playwright_playwright__browser_fill_form,mcp__plugin_playwright_playwright__browser_snapshot,mcp__plugin_playwright_playwright__browser_wait_for,mcp__plugin_playwright_playwright__browser_tabs,mcp__plugin_playwright_playwright__browser_close`, max_results 12. With the MCP:
   - Use `browser_resize` in place of the device toolbar.
   - Use `browser_console_messages` with `level: "warning"` in place of the DevTools console.
   - Use `browser_network_requests` in place of the Network tab.
   - Use `browser_evaluate` for the size and scrollbar measurements.
3. If neither tool works, stop and ask the user to do the Step 28 and Step 29 checks by hand in Chrome. Do not skip the checks.

Start the README local stack (`supabase start`, `docker compose up -d`), then check that the ports are free:

```bash
netstat -ano | grep -E ':(3000|5173) .*LISTENING'
```

Expected: no output. If a PID is listed, run `taskkill //PID <pid> //T //F` and run the check again. Start `pnpm dev` with the Bash tool's `run_in_background: true` and note its task id. Then wait for both servers:

```bash
curl --retry 30 --retry-delay 2 --retry-connrefused -sf http://localhost:3000/health && echo && curl --retry 30 --retry-delay 2 --retry-connrefused -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/
```

Expected: the health JSON, then `200`. Open `http://localhost:5173/` in the browser tool and sign in, or sign up (which lands on `#/create`) and save there. Check each item below at 375×667 (device toolbar, iPhone SE) and at 1280×800:
- `#/`: the room stage runs to the left and right edges of the content area, with no 16px gutter. `Edit avatar` sits below it, and the page has no horizontal or vertical scrollbar. If the sprite sheets are not exported yet, RoomScene shows its load-error message, and the layout checks still apply.
- `#/create`: the creator has 16px of padding on every side.
- Desktop: the Sidebar lists only `Room`. It is highlighted on `#/` and not on `#/create`.
- Header: Sign out is 44px tall, the header stays 56px, and the email does not overflow at 375px.
- Tab and Network: the tab shows the T icon, `/favicon.svg` returns 200, and nothing requests `/favicon.ico`.
- DevTools console (default levels; with the Playwright MCP, `browser_console_messages` at `level: "warning"`): no errors or warnings on `#/login`, `#/` or `#/create`, with one exception. The first `GET /avatar` for a user with no avatar (every user right after a sign-up, since Task 3's `supabase db reset` left none) logs exactly one `Failed to load resource: the server responded with a status of 404 (Not Found)` for `http://localhost:3000/avatar`. That 404 `AVATAR_NOT_FOUND` is the spec §2 contract. Do not change the API or `useAvatar` for it. Quote it in the task report; Task 19 Step 9 asks the user to decide. After Save, reloading `#/` must log nothing.

If any check fails (other than that one 404), fix it with a test where one applies, re-run Step 27, and commit the fix before you continue. Stop the background `pnpm dev` with TaskStop (load it with ToolSearch `select:TaskStop`), using its task id. Then run `netstat -ano | grep -E ':(3000|5173) .*LISTENING'`. It must print nothing. For each PID it lists, run `taskkill //PID <pid> //T //F`, then run the check again.

- [ ] **Step 29: Verify the production build in the browser**

The vendor split only shows up in a built bundle. Start `pnpm --filter @tracks/api dev` and then `pnpm --filter @tracks/web exec vite preview --port 5173 --strictPort` as two separate Bash calls, each with `run_in_background: true`, and note both task ids. Wait with the same two curl commands as Step 28 (expected: the health JSON, then `200`). The preview serves the `dist/` from Step 27. Port 5173 matches the API's default `FRONTEND_URL` CORS origin, and the `VITE_*` values from `apps/web/.env` were compiled in at build time. Open `http://localhost:5173/` in the same browser tool as Step 28 at 375×667 and at 1280×800:
- Network: `index-*.js`, `rolldown-runtime-*.js`, `react-*.js`, `vendor-*.js`, `supabase-*.js`, `index-*.css` and `favicon.svg` all return 200.
- Sign in, and the room renders on `#/`. `Edit avatar` opens `#/create` prefilled. Save returns to `#/`, and the room canvas's aria-label equals the saved choices. The sprites are not exported until Tasks 15-18, so RoomScene shows its load-error message.
- DevTools console (default levels): no errors or warnings on any route.

If any check fails, fix it, re-run Step 27, and commit the fix. Stop both background tasks with TaskStop, then run the same netstat check and the `taskkill //PID <pid> //T //F` cleanup as Step 28 until it prints nothing.

If the Playwright MCP was used, call `mcp__plugin_playwright_playwright__browser_close`, then run `rm -rf .playwright-mcp && git status --porcelain` from the repo root (the folder holds the MCP's logs and snapshots; nothing in it is committed). Expected: no output, apart from `?? docs/superpowers/plans/2026-10-04-athlete-avatar-room.md` if the plan file is still uncommitted. `.playwright-mcp/` is not gitignored until Task 20 Step 2, and Task 13 Steps 11 and 19, Task 15 Step 18 and Tasks 16-17 Step 1 need a clean tree.

---

### Task 13: Aseprite MCP setup (session restart checkpoint)

This task has no code and no TDD cycle. The "failing check" is Step 1, which confirms that `uv` and the `aseprite` server are missing. **Part A** runs in the current session and ends with a hard STOP at Step 12. **Part B** (Steps 13-19) runs in a **new** Claude Code session, after the restart. Task 14 does not start until Part B passes.

**Files:**
- Modify: none in the repo. `.gitignore` stays as it is because line 12 (`.superpowers/`) already covers `.superpowers/art-previews/`. Step 10 checks this with `git check-ignore`.
- Create (outside repo): `C:/Users/littl/.local/bin/uv.exe`, `uvx.exe` and `uvw.exe` (uv installer)
- Create (outside repo): `C:/Users/littl/tools/aseprite-mcp/` (clone of `https://github.com/diivi/aseprite-mcp`, pinned to `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`, plus its `.venv/` from `uv sync`)
- Modify (outside repo): `C:/Users/littl/.claude.json` (the local-scope `aseprite` entry for this project, written by `claude mcp add`). No `.mcp.json` is created.
- Create (gitignored, kept): `D:/Projects/Tracks/.superpowers/art-previews/`
- Create and then delete (gitignored, throwaway): `D:/Projects/Tracks/.superpowers/art-previews/smoke.aseprite` and `D:/Projects/Tracks/.superpowers/art-previews/smoke-8x.png`
- Test: none. The commands below do the verification.

**Interfaces:**
- Consumes: the spec section 4 "MCP setup, one-time" values: `ASEPRITE_PATH=C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe` and clone dir `C:\Users\littl\tools\aseprite-mcp`. Also the preview convention `<checkout>/.superpowers/art-previews/`. This task uses no TypeScript contract names.
- Produces: an MCP server named `aseprite` (local scope, stdio). Its tools appear in Claude Code as `mcp__aseprite__<tool>`. The pinned commit exposes 116 tools. Later art tasks use `create_canvas`, `set_palette`, `run_lua_script`, `set_tag`, `create_slice`, `set_slice_pivot`, `export_frame` and `export_tag`. These are the signatures this task uses, as written in `aseprite_mcp/tools/*.py`:
  - `create_canvas(width: int, height: int, filename: str = "canvas.aseprite")`
  - `draw_rectangle(filename: str, x: int, y: int, width: int, height: int, color: str = "#000000", fill: bool = False)`
  - `get_sprite_info(filename: str)` returns JSON with `width`, `height`, `color_mode`, `frames`, `durations_ms`, `layers` and `tags`.
  - `get_composite_pixel(filename: str, x: int, y: int, frame_index: int = 1)` returns `#rrggbb (r=…, g=…, b=…, a=…)`.
  - `export_frame(filename: str, frame_index: int, output_filename: str, scale: int = 1)`. `frame_index` is 1-based.
- All MCP paths are absolute, use forward slashes, and are rooted at `git rev-parse --show-toplevel` (`D:/Projects/Tracks` in the commands below). If you are working in another checkout, such as a worktree, use that root everywhere instead. Run Step 8 from that same root, because local scope is keyed to the project directory.
- The resume message in Step 12 points to the plan file `docs/superpowers/plans/2026-10-04-athlete-avatar-room.md`, relative to the repo root.

#### Part A: current session

- [ ] **Step 1: Confirm the starting state (the failing check)**

```bash
uv --version
claude mcp get aseprite
```

Expected:
- `uv --version` prints a line that ends with `uv: command not found`. Git Bash adds a prefix such as `/usr/bin/bash: line 1:`, and the prefix varies, so match only the ending.
- `claude mcp get aseprite` prints a line that starts with `No MCP server named "aseprite". Configured servers:`, then this machine's other servers.

If `uv --version` already prints a version, skip Steps 3-4. If `aseprite` is already registered, remove it with `claude mcp remove aseprite -s local` first, so that Step 8 registers exactly the spec's command.

- [ ] **Step 2: Confirm that Aseprite is at the path you will register**

```bash
ls "C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe"
"C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe" --version
```

Expected: the first command prints the path and the second prints `Aseprite 1.3.18.6-x64` (any `Aseprite 1.3.x` is fine). If the file is missing, stop and ask the user where Aseprite is installed. Do not register a guessed path.

- [ ] **Step 3: Install uv (spec section 4, step 1)**

```bash
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Expected: the installer reports that it installed `uv.exe`, `uvx.exe` and `uvw.exe` to `C:\Users\littl\.local\bin`, and its last line is `everything's installed!`. Ignore any advice about adding that folder to PATH. It is already on PATH, and Step 4 checks this.

- [ ] **Step 4: Verify that uv is on PATH**

```bash
echo "$PATH" | tr ':' '\n' | grep -x /c/Users/littl/.local/bin
uv --version
```

Expected: `/c/Users/littl/.local/bin`, then `uv 0.<minor>.<patch> (<hash> <date>)`. The exact version does not matter.

- [ ] **Step 5: Clone the MCP outside the repo and pin the commit this plan was written against (spec section 4, step 2)**

```bash
mkdir -p C:/Users/littl/tools
git clone https://github.com/diivi/aseprite-mcp C:/Users/littl/tools/aseprite-mcp
git -C C:/Users/littl/tools/aseprite-mcp checkout --detach 90d1696a7e41edff89bbd0823ae6a5f86c114bcc
git -C C:/Users/littl/tools/aseprite-mcp log -1 --format='%h %s'
```

Expected last line: `90d1696 feat(text): add draw_text, measure_text and list_text_fonts`. Tasks 14-18 took their tool names and parameters from this commit.

- [ ] **Step 6: Install the MCP's dependencies once (`uv sync`)**

```bash
uv --directory C:/Users/littl/tools/aseprite-mcp sync
```

Expected: the output includes `Using CPython 3.13.` (uv uses the system 3.13 or downloads one), `Creating virtual environment at: .venv` and `Installed <N> packages`, and the command exits with code 0. Syncing now means the first MCP start does not have to install anything.

- [ ] **Step 7: Verify that the server package imports and registers its tools**

```bash
uv --directory C:/Users/littl/tools/aseprite-mcp run python -c 'import asyncio; import aseprite_mcp.tools; from aseprite_mcp import mcp; names = {t.name for t in asyncio.run(mcp.list_tools())}; print(len(names)); print(all(n in names for n in ["create_canvas", "draw_rectangle", "get_sprite_info", "get_composite_pixel", "export_frame", "export_tag", "set_tag", "set_palette", "run_lua_script", "create_slice", "set_slice_pivot"]))'
```

Expected output:
```
116
True
```

- [ ] **Step 8: Register the server with local scope from the checkout root (spec section 4, step 3)**

Run this from `D:/Projects/Tracks`, the directory the next session will start in. Keep `--transport stdio` between `--env` and the name. If it is not there, the variadic `--env` reads `aseprite` as a second env pair. The single quotes pass the same arguments as the spec's double-quoted form.

```bash
claude mcp add --scope local --env 'ASEPRITE_PATH=C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe' --transport stdio aseprite -- uv --directory 'C:\Users\littl\tools\aseprite-mcp' run -m aseprite_mcp
```

Expected: one line that starts `Added stdio MCP server aseprite with command: uv --directory C:\Users\littl\tools\aseprite-mcp run -m aseprite_mcp to local config`, and one line that names `C:\Users\littl\.claude.json` and project `D:\Projects\Tracks`. The exact wording can vary between CLI versions.

- [ ] **Step 9: Verify the registration and its health check (spec section 4, step 4)**

```bash
claude mcp get aseprite
ls .mcp.json
```

The `claude mcp get aseprite` output should contain these fields. The exact layout varies by CLI version.
```
aseprite:
  Scope: Local config (private to you in this project)
  Status: ✔ Connected
  Type: stdio
  Command: uv
  Args: --directory C:\Users\littl\tools\aseprite-mcp run -m aseprite_mcp
  Environment:
    ASEPRITE_PATH=C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe
```

The status glyph is `✔` (U+2714, heavy check mark), and some terminals print `√` instead. Either glyph followed by `Connected` means the server is healthy, so don't match the glyph character by character.

`ls .mcp.json` must print `ls: cannot access '.mcp.json': No such file or directory`, because nothing machine-specific goes into the repo. If the status line does not say `Connected`, run Step 7 again. If Step 7 passes, check that the `Args` and `Environment` lines match exactly, then run `claude mcp remove aseprite -s local` and repeat Step 8.

- [ ] **Step 10: Create the preview folder and confirm that git ignores it (no `.gitignore` change)**

```bash
mkdir -p "$(git rev-parse --show-toplevel)/.superpowers/art-previews"
git check-ignore -v .superpowers/art-previews/smoke-8x.png
```

Expected output (the separator is a tab):
```
.gitignore:12:.superpowers/	.superpowers/art-previews/smoke-8x.png
```

The existing `.superpowers/` rule already covers `.superpowers/art-previews/`, so `.gitignore` does not change.

- [ ] **Step 11: Confirm there is nothing to commit**

```bash
git status --short
git diff --stat
```

Expected: no output from either command. The one exception is `?? docs/superpowers/plans/2026-10-04-athlete-avatar-room.md`, which appears if the plan file itself has not been committed yet. Every change in this task is outside the repo or gitignored, so this task makes **no commit**. If `git status` shows any other entry, it came from something outside this task. Investigate it before you continue, and do not commit it as part of this task.

- [ ] **Step 12: STOP. The user must restart Claude Code before anything else happens**

MCP servers load only when a session starts, so no `mcp__aseprite__*` tools exist in this session. **Do not start or dispatch Task 14 in this session, and do not try to call any `mcp__aseprite__*` tool here.** If you are a controller running subagents, end your turn after you send this message. Send the user exactly this:

> Task 13 Part A is done. uv is installed, and the Aseprite MCP is cloned to `C:\Users\littl\tools\aseprite-mcp` (pinned to 90d1696). It is registered as `aseprite` with local scope, and `claude mcp get aseprite` reports it connected. Nothing in the repo changed. MCP servers only load when a session starts, so please exit this session (`/exit`), start a new Claude Code session in `D:\Projects\Tracks` (on branch `feat/avatar-room`), and tell it: "Resume the plan at docs/superpowers/plans/2026-10-04-athlete-avatar-room.md, Task 13 Step 13."

Then stop working in this session.

#### Part B: new session, after the restart

- [ ] **Step 13: Confirm the server loaded in this session**

```bash
git branch --show-current
claude mcp get aseprite
```

Expected: `feat/avatar-room`, then the same fields as Step 9, including a check mark (`✔` or `√`) followed by `Connected`. Then take the branch that matches what you see:

- **Server listed as connected and the `mcp__aseprite__*` tools are available.** If they appear only as deferred names, load their schemas with ToolSearch using the query `select:mcp__aseprite__create_canvas,mcp__aseprite__draw_rectangle,mcp__aseprite__get_sprite_info,mcp__aseprite__get_composite_pixel,mcp__aseprite__export_frame`. The result must list all five. Continue to Step 14.
- **Server listed, but no `mcp__aseprite__*` tool exists in this session.** Stop and ask the user to run `/mcp` and reconnect `aseprite`. Do not go on to Task 14 until the five tools load.
- **`claude mcp get aseprite` prints `No MCP server named "aseprite"`.** The local entry is keyed to a different project directory, for example because Step 8 ran from another cwd. `/mcp` cannot add a server, so reconnecting will not help. Run `git rev-parse --show-toplevel` and confirm that the result is the checkout this session started in. Run Step 8 from that root, then Step 9, which must show the server connected. Then **stop again**. Do not call any `mcp__aseprite__*` tool and do not go on to Task 14. Send the user the Step 12 message with its first sentence replaced by "Task 13: the `aseprite` server was not registered for this project directory, so I registered it again." The user restarts, and Step 13 runs again in the next session.
- **Server listed, but its status is not `Connected`.** Follow the recovery steps at the end of Step 9 (Step 7, then remove and repeat Step 8). Then stop for another restart with the same message as in the previous branch.

- [ ] **Step 14: Smoke test. Create a throwaway 8x8 sprite with an absolute path**

Call `mcp__aseprite__create_canvas` with:
```json
{ "width": 8, "height": 8, "filename": "D:/Projects/Tracks/.superpowers/art-previews/smoke.aseprite" }
```

Expected result: `Canvas created successfully: D:/Projects/Tracks/.superpowers/art-previews/smoke.aseprite`. This also proves that the server received `ASEPRITE_PATH`. Without it, the server would fall back to a bare `aseprite` command and fail.

- [ ] **Step 15: Smoke test. Fill the sprite with an exact palette color (the placeholder skin base)**

Call `mcp__aseprite__draw_rectangle` with:
```json
{ "filename": "D:/Projects/Tracks/.superpowers/art-previews/smoke.aseprite", "x": 0, "y": 0, "width": 8, "height": 8, "color": "#FF40FF", "fill": true }
```

Expected result: `Rectangle drawn successfully in D:/Projects/Tracks/.superpowers/art-previews/smoke.aseprite`

- [ ] **Step 16: Smoke test. Read the sprite back**

Call `mcp__aseprite__get_sprite_info` with `{ "filename": "D:/Projects/Tracks/.superpowers/art-previews/smoke.aseprite" }`.
Expected: JSON that contains `"width":8,"height":8,"color_mode":"rgb","frames":1`.

Call `mcp__aseprite__get_composite_pixel` with `{ "filename": "D:/Projects/Tracks/.superpowers/art-previews/smoke.aseprite", "x": 3, "y": 3 }`.
Expected: `#ff40ff (r=255, g=64, b=255, a=255)`. The RGB is exact and alpha is 255, which is what the runtime palette swap needs.

- [ ] **Step 17: Smoke test. Export frame 1 at 8x**

Call `mcp__aseprite__export_frame` with:
```json
{ "filename": "D:/Projects/Tracks/.superpowers/art-previews/smoke.aseprite", "frame_index": 1, "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/smoke-8x.png", "scale": 8 }
```

Expected result: `Frame 1 exported to D:/Projects/Tracks/.superpowers/art-previews/smoke-8x.png at 8x`

- [ ] **Step 18: Verify the exported PNG on disk**

```bash
node -e "const b=require('fs').readFileSync('D:/Projects/Tracks/.superpowers/art-previews/smoke-8x.png');console.log(b.toString('ascii',1,4), b.readUInt32BE(16), b.readUInt32BE(20))"
```

Expected output: `PNG 64 64`. Then open `D:/Projects/Tracks/.superpowers/art-previews/smoke-8x.png` with the Read tool. It must show a solid magenta (#FF40FF) square with crisp edges.

- [ ] **Step 19: Remove the throwaway files and confirm nothing leaked into the clone or the repo**

```bash
rm -f D:/Projects/Tracks/.superpowers/art-previews/smoke.aseprite D:/Projects/Tracks/.superpowers/art-previews/smoke-8x.png
ls -A D:/Projects/Tracks/.superpowers/art-previews
git -C C:/Users/littl/tools/aseprite-mcp status --short
git status --short
```

Expected: no output from the last three commands, apart from the same uncommitted-plan exception as in Step 11. If the clone's status is empty, the absolute paths worked and Aseprite created no stray folders under the MCP checkout. Keep the empty `art-previews/` folder for the later art tasks. There is nothing to commit. Task 13 is complete. Continue with Task 14 in this same new session.

---

### Task 14: Art pipeline: palette, export script, art check

**Files:**
- Create: `apps/web/src/features/avatar/__tests__/paletteRules.test.ts`
- Create: `apps/web/src/features/avatar/__tests__/paletteRules.ts` (test-only helper. It is not a `*.test.ts` file, so vitest does not collect it.)
- Create: `apps/web/src/features/avatar/__tests__/sheetRules.test.ts`
- Create: `apps/web/src/features/avatar/__tests__/sheetRules.ts` (test-only helper)
- Create: `apps/web/src/features/avatar/__tests__/art.test.ts`
- Create: `art/palette.gpl`
- Create: `scripts/export-art.ts`
- Modify: `apps/web/package.json` (devDependencies: `pngjs`, `@types/pngjs`, `@types/node`)
- Modify: `pnpm-lock.yaml` (written by `pnpm add`)
- Modify: `turbo.json` (new `"@tracks/web#test"` task)
- Modify: `package.json` (root `scripts`: add `"art:export"`)

**Interfaces:**
Consumes: from `apps/web/src/features/avatar/palette.ts` (Task 5):
- `PLACEHOLDER_RAMPS: { skin: Ramp; hair: Ramp; cloth: Ramp }`
- `SKIN_RAMPS: Record<SkinTone, Ramp>`
- `HAIR_RAMPS: Record<HairColor, Ramp>`
- `CLOTH_RAMPS: Record<TopItem | BottomItem | ShoesItem, Ramp>`

The sheet ids come from the contract's `SheetId` list (body, hair-*, top-*, bottom-*, shoes-* and the room sheets). The slice names come from spec §3: `trophy-1..3`, `medal-1..3`, `frame`, `equipment`, `decor` and `rider`.

Produces:
- `art/palette.gpl`: 32 fixed colors plus the 9 placeholders, each placeholder exactly once.
- Root script `"art:export": "npx tsx scripts/export-art.ts"`.
- turbo task `"@tracks/web#test"` whose inputs include `$TURBO_ROOT$/art/palette.gpl`.
- `apps/web/src/features/avatar/__tests__/art.test.ts` (`// @vitest-environment node`). It has a module-local `exportedSheetIds(): string[]`, used only inside this file. Task 19 appends a `describe('catalog and sample room coverage')` block that checks coverage through `SHEETS` and `getSheet` from `../sheets.js`.
- Test helpers that are not in the contract. They are test-only and defined here:
  - `paletteRules.ts`:
    - `MIN_PLACEHOLDER_DISTANCE = 32`
    - `hex(color: number): string`
    - `parseGpl(text: string): number[]`
    - `paletteProblems(palette: readonly number[], placeholders: readonly number[]): string[]`
    - `targetRampProblems(name: string, ramp: readonly number[]): string[]`
  - `sheetRules.ts`:
    - `AVATAR_CELL = 64`
    - `AVATAR_TAGS`
    - `ROOM_SLOT_SLICES`
    - `interface RgbaImage { width: number; height: number; data: Uint8Array }`
    - `AsepriteJsonSchema`, `type AsepriteJson` and `parseAsepriteJson(json: unknown): AsepriteJson`
    - `type SwapRampName = 'skin' | 'hair' | 'cloth'`
    - `swapRampFor(sheetId: string): SwapRampName | null`
    - `isAvatarSheet(sheetId: string): boolean`
    - `pixelProblems(image: RgbaImage, palette: ReadonlySet<number>): string[]`
    - `opaqueColors(image: RgbaImage): Set<number>`
    - `placeholderProblems(colors: ReadonlySet<number>, ramp: readonly number[] | null, placeholders: readonly number[]): string[]`
    - `cellProblems(image: RgbaImage, data: AsepriteJson): string[]`
    - `tagProblems(data: AsepriteJson, required: readonly string[]): string[]`
    - `turnFrameProblems(data: AsepriteJson): string[]`
    - `timingProblems(data: AsepriteJson, body: AsepriteJson): string[]`
    - `beltProblems(treadmill: AsepriteJson, body: AsepriteJson): string[]`
    - `sliceProblems(data: AsepriteJson, names: readonly string[], needPivot: boolean): string[]`

- [ ] **Step 1: Write the failing palette-rules test**

Create `apps/web/src/features/avatar/__tests__/paletteRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hex, paletteProblems, parseGpl, targetRampProblems } from './paletteRules.js';

const PLACEHOLDERS = [
  0xff80ff, 0xff40ff, 0xff00ff, 0x80ffff, 0x40ffff, 0x00ffff, 0xffff80, 0xffff40, 0xffff00,
];

describe('hex', () => {
  it('formats a packed color as #rrggbb', () => {
    expect(hex(0x0a0b0c)).toBe('#0a0b0c');
    expect(hex(0xff40ff)).toBe('#ff40ff');
  });
});

describe('parseGpl', () => {
  it('reads RGB rows in file order, skipping header, properties and comments', () => {
    const text = [
      'GIMP Palette',
      'Name: Tracks',
      'Columns: 8',
      '#',
      '# a comment',
      ' 30  26  36\toutline',
      '',
      '# a comment between rows',
      '255 128 255\tPH skin light',
      '  0 255 255\tPH hair shadow',
      '',
    ].join('\n');
    expect(parseGpl(text)).toEqual([0x1e1a24, 0xff80ff, 0x00ffff]);
  });

  it('tolerates CRLF line endings and a byte-order mark', () => {
    const text = '\uFEFFGIMP Palette\r\n#\r\n 10  20  30\tUntitled\r\n 40  50  60\tUntitled\r\n';
    expect(parseGpl(text)).toEqual([0x0a141e, 0x28323c]);
  });

  it('reads Channels: RGBA files with 4-column rows and ignores the alpha column', () => {
    const text = 'GIMP Palette\nChannels: RGBA\n#\n 10  20  30 255\tone\n 40  50  60 128\ttwo\n';
    expect(parseGpl(text)).toEqual([0x0a141e, 0x28323c]);
  });

  it('accepts names that contain spaces and digits without reading them as channels', () => {
    expect(parseGpl('GIMP Palette\n1 2 3 PH cloth base 2\n')).toEqual([0x010203]);
  });

  it('rejects a file without the GIMP Palette header', () => {
    expect(() => parseGpl('Name: x\n1 2 3 a\n')).toThrow(/GIMP Palette/);
  });

  it('rejects a row whose channel is out of range', () => {
    expect(() => parseGpl('GIMP Palette\n256 0 0 too-red\n')).toThrow(/line 2/);
  });

  it('rejects a row with too few numbers', () => {
    expect(() => parseGpl('GIMP Palette\n1 2 short\n')).toThrow(/line 2/);
  });

  it('rejects a row without a name, because Aseprite silently skips such rows', () => {
    expect(() => parseGpl('GIMP Palette\n1 2 3\n')).toThrow(/line 2 has no name/);
    expect(() => parseGpl('GIMP Palette\nChannels: RGBA\n1 2 3 255\n')).toThrow(
      /line 3 has no name/,
    );
  });
});

describe('paletteProblems', () => {
  it('accepts every placeholder once plus fixed colors far from all of them', () => {
    expect(paletteProblems([0x1e1a24, 0xd8c8a8, ...PLACEHOLDERS], PLACEHOLDERS)).toEqual([]);
  });

  it('reports a missing placeholder', () => {
    expect(paletteProblems(PLACEHOLDERS.slice(1), PLACEHOLDERS)).toEqual([
      'placeholder #ff80ff appears 0 times in palette.gpl (expected exactly 1)',
    ]);
  });

  it('reports a duplicated placeholder', () => {
    expect(paletteProblems([...PLACEHOLDERS, 0xffff00], PLACEHOLDERS)).toEqual([
      'placeholder #ffff00 appears 2 times in palette.gpl (expected exactly 1)',
    ]);
  });

  it('reports a fixed color within 31 of a placeholder in every channel', () => {
    expect(paletteProblems([...PLACEHOLDERS, 0xe0ff9f], PLACEHOLDERS)).toEqual([
      'fixed color #e0ff9f is within 31 of placeholder #ffff80 in every RGB channel',
    ]);
  });

  it('accepts a fixed color exactly 32 away in one channel', () => {
    expect(paletteProblems([...PLACEHOLDERS, 0xdfffa0], PLACEHOLDERS)).toEqual([]);
  });
});

describe('targetRampProblems', () => {
  it('accepts a ramp of 3 colors', () => {
    expect(targetRampProblems('skin tone-1', [0xf6d7c3, 0xe8b896, 0xc98e6c])).toEqual([]);
  });

  it('reports a ramp that does not have exactly 3 entries', () => {
    expect(targetRampProblems('hair red', [0xff0000, 0xcc0000])).toEqual([
      'hair red has 2 entries (expected 3)',
    ]);
  });

  it('reports an entry that is not a 24-bit color', () => {
    expect(targetRampProblems('top x', [0xff0000, 0x1000000, -1])).toEqual([
      'top x entry 1 (16777216) is not a 0xRRGGBB color',
      'top x entry 2 (-1) is not a 0xRRGGBB color',
    ]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/paletteRules.test.ts`
Expected: FAIL, 0 tests, with `Error: Failed to resolve import "./paletteRules.js" from "src/features/avatar/__tests__/paletteRules.test.ts". Does the file exist?`

- [ ] **Step 3: Implement the palette rules**

Create `apps/web/src/features/avatar/__tests__/paletteRules.ts`:

```ts
// Pure helpers for the art check (art.test.ts). They read no files, so
// paletteRules.test.ts unit-tests them with literal inputs.

/** Every fixed palette color must differ from every placeholder by at least
 * this much in at least one RGB channel (spec §1 Layers and palette swap). */
export const MIN_PLACEHOLDER_DISTANCE = 32;

/** Packed 0xRRGGBB → '#rrggbb'. */
export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

/** Largest per-channel difference between two packed colors. */
function maxChannelDiff(a: number, b: number): number {
  const ca = channels(a);
  const cb = channels(b);
  return Math.max(...ca.map((v, i) => Math.abs(v - (cb[i] ?? 0))));
}

/**
 * Parses a GIMP palette into packed 0xRRGGBB colors, in file order.
 * Tolerates CRLF, a byte-order mark, comment lines anywhere, properties such
 * as `Name:` and `Columns:`, and Aseprite's `Channels: RGBA` with 4-column rows
 * (the alpha column is ignored). Rows without a name are rejected, because
 * Aseprite's loader silently drops them.
 */
export function parseGpl(text: string): number[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== 'GIMP Palette') {
    throw new Error('Not a GIMP palette: the first line must be "GIMP Palette"');
  }
  let columns = 3;
  const colors: number[] = [];
  lines.forEach((raw, index) => {
    if (index === 0) return;
    const lineNo = index + 1;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    if (!/^\d/.test(line)) {
      const channelsMatch = /^Channels:\s*(\S+)$/.exec(line);
      if (channelsMatch) columns = channelsMatch[1] === 'RGBA' ? 4 : 3;
      return;
    }
    const parts = line.split(/\s+/);
    const numbers = parts.slice(0, columns);
    if (numbers.length < columns || numbers.some((p) => !/^\d+$/.test(p) || Number(p) > 255)) {
      throw new Error(
        `palette line ${lineNo} must start with ${columns} integers from 0 to 255: "${line}"`,
      );
    }
    if (parts.slice(columns).join(' ') === '') {
      throw new Error(
        `palette line ${lineNo} has no name; Aseprite skips rows without a name: "${line}"`,
      );
    }
    const [r = 0, g = 0, b = 0] = numbers.map(Number);
    colors.push((r << 16) | (g << 8) | b);
  });
  return colors;
}

/**
 * Checks palette.gpl against the placeholder colors: each placeholder appears
 * exactly once, and every other (fixed) color differs from every placeholder
 * by at least MIN_PLACEHOLDER_DISTANCE in at least one channel. Returns one
 * message per problem; an empty array means the palette is valid.
 */
export function paletteProblems(
  palette: readonly number[],
  placeholders: readonly number[],
): string[] {
  const problems: string[] = [];
  for (const placeholder of placeholders) {
    const count = palette.filter((c) => c === placeholder).length;
    if (count !== 1) {
      problems.push(
        `placeholder ${hex(placeholder)} appears ${count} times in palette.gpl (expected exactly 1)`,
      );
    }
  }
  for (const color of palette) {
    if (placeholders.includes(color)) continue;
    for (const placeholder of placeholders) {
      if (maxChannelDiff(color, placeholder) < MIN_PLACEHOLDER_DISTANCE) {
        problems.push(
          `fixed color ${hex(color)} is within ${MIN_PLACEHOLDER_DISTANCE - 1} of placeholder ${hex(placeholder)} in every RGB channel`,
        );
      }
    }
  }
  return problems;
}

/** A target ramp (palette.ts) must be exactly 3 packed 0xRRGGBB colors. */
export function targetRampProblems(name: string, ramp: readonly number[]): string[] {
  const problems: string[] = [];
  if (ramp.length !== 3) problems.push(`${name} has ${ramp.length} entries (expected 3)`);
  ramp.forEach((color, i) => {
    if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
      problems.push(`${name} entry ${i} (${color}) is not a 0xRRGGBB color`);
    }
  });
  return problems;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/paletteRules.test.ts`
Expected: PASS, `Tests  17 passed (17)`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/avatar/__tests__/paletteRules.ts apps/web/src/features/avatar/__tests__/paletteRules.test.ts
git commit -F - <<'EOF'
Add palette rules for the art check

GIMP palette parser (CRLF, BOM, Channels: RGBA, nameless rows rejected
because Aseprite drops them) and the placeholder and ramp rules.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 6: Write the failing sheet-rules test**

Create `apps/web/src/features/avatar/__tests__/sheetRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AVATAR_TAGS,
  ROOM_SLOT_SLICES,
  beltProblems,
  cellProblems,
  isAvatarSheet,
  opaqueColors,
  parseAsepriteJson,
  pixelProblems,
  placeholderProblems,
  sliceProblems,
  swapRampFor,
  tagProblems,
  timingProblems,
  turnFrameProblems,
  type AsepriteJson,
  type RgbaImage,
} from './sheetRules.js';

const SKIN = [0xff80ff, 0xff40ff, 0xff00ff] as const;
const PLACEHOLDERS = [...SKIN, 0x80ffff, 0x40ffff, 0x00ffff, 0xffff80, 0xffff40, 0xffff00];
const OUTLINE = 0x1e1a24;

type Pixel = readonly [x: number, y: number, rgb: number, alpha?: number];

function image(width: number, height: number, pixels: readonly Pixel[]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (const [x, y, rgb, alpha = 255] of pixels) {
    const o = (y * width + x) * 4;
    data[o] = (rgb >> 16) & 0xff;
    data[o + 1] = (rgb >> 8) & 0xff;
    data[o + 2] = rgb & 0xff;
    data[o + 3] = alpha;
  }
  return { width, height, data };
}

type TagRow = readonly [name: string, from: number, to: number, direction?: string];

/** A horizontal strip shaped like `aseprite --format json-array` output. */
function strip(
  durations: readonly number[],
  tags: readonly TagRow[] = [],
  slices: readonly unknown[] = [],
  cell = 64,
): AsepriteJson {
  return parseAsepriteJson({
    frames: durations.map((duration, i) => ({
      filename: `x ${i}.aseprite`,
      frame: { x: i * cell, y: 0, w: cell, h: cell },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cell, h: cell },
      sourceSize: { w: cell, h: cell },
      duration,
    })),
    meta: {
      app: 'https://www.aseprite.org/',
      version: '1.3.18.6-x64',
      image: 'x.png',
      format: 'RGBA8888',
      size: { w: durations.length * cell, h: cell },
      scale: '1',
      frameTags: tags.map(([name, from, to, direction = 'forward']) => ({
        name,
        from,
        to,
        direction,
        color: '#000000ff',
      })),
      slices,
    },
  });
}

const BODY_DURATIONS = [200, 200, 200, 150, 80, 80, 80, 80];
const BODY_TAGS: readonly TagRow[] = [
  ['front-idle', 0, 2],
  ['turn', 3, 3],
  ['side-run', 4, 7],
];

describe('parseAsepriteJson', () => {
  it('accepts json-array output and keeps frames, tags and slices', () => {
    const data = strip(
      [100, 120],
      [['belt', 0, 1]],
      [
        {
          name: 'rider',
          color: '#0000ffff',
          keys: [{ frame: 0, bounds: { x: 4, y: 2, w: 10, h: 6 }, pivot: { x: 5, y: 6 } }],
        },
      ],
    );
    expect(data.frames.map((f) => f.duration)).toEqual([100, 120]);
    expect(data.meta.frameTags).toEqual([{ name: 'belt', from: 0, to: 1, direction: 'forward' }]);
    expect(data.meta.slices[0]?.keys[0]?.pivot).toEqual({ x: 5, y: 6 });
  });

  it('rejects a sheet with no frames', () => {
    expect(() =>
      parseAsepriteJson({ frames: [], meta: { size: { w: 1, h: 1 }, frameTags: [], slices: [] } }),
    ).toThrow();
  });

  it('rejects the json-hash format', () => {
    expect(() =>
      parseAsepriteJson({
        frames: { 'x 0.aseprite': { frame: { x: 0, y: 0, w: 1, h: 1 }, duration: 100 } },
        meta: { size: { w: 1, h: 1 }, frameTags: [], slices: [] },
      }),
    ).toThrow();
  });
});

describe('swapRampFor and isAvatarSheet', () => {
  it('maps each avatar sheet to the ramp its swap replaces', () => {
    expect(swapRampFor('body')).toBe('skin');
    expect(swapRampFor('hair-curly')).toBe('hair');
    expect(swapRampFor('top-starter-tee')).toBe('cloth');
    expect(swapRampFor('bottom-starter-shorts')).toBe('cloth');
    expect(swapRampFor('shoes-starter')).toBe('cloth');
    expect(isAvatarSheet('body')).toBe(true);
    expect(isAvatarSheet('hair-short')).toBe(true);
  });

  it('treats room sheets as unswapped and not part of the avatar', () => {
    for (const id of ['background', 'treadmill', 'frame-bib', 'trophy-gold', 'medal-gold', 'plant']) {
      expect(swapRampFor(id)).toBeNull();
      expect(isAvatarSheet(id)).toBe(false);
    }
  });
});

describe('pixelProblems', () => {
  const palette = new Set([OUTLINE, ...SKIN]);

  it('accepts transparent pixels and exact palette colors at alpha 255', () => {
    const img = image(4, 2, [
      [0, 0, OUTLINE],
      [1, 0, 0xff40ff],
      [2, 1, 0x123456, 0],
    ]);
    expect(pixelProblems(img, palette)).toEqual([]);
  });

  it('reports pixels whose alpha is neither 0 nor 255', () => {
    const img = image(4, 2, [
      [3, 0, OUTLINE, 128],
      [0, 1, OUTLINE, 1],
    ]);
    expect(pixelProblems(img, palette)).toEqual([
      '2 pixels have alpha other than 0 or 255, first at (3, 0)',
    ]);
  });

  it('reports each off-palette opaque color once, at its first position', () => {
    const img = image(4, 2, [
      [1, 0, 0x010203],
      [2, 0, 0x010203],
      [0, 1, 0xfe40ff],
    ]);
    expect(pixelProblems(img, palette)).toEqual([
      'color #010203 at (1, 0) is not in palette.gpl',
      'color #fe40ff at (0, 1) is not in palette.gpl',
    ]);
  });
});

describe('opaqueColors', () => {
  it('collects the colors of alpha-255 pixels only', () => {
    const img = image(3, 1, [
      [0, 0, OUTLINE],
      [1, 0, 0xff00ff],
      [2, 0, 0x00ffff, 0],
    ]);
    expect([...opaqueColors(img)].sort((a, b) => a - b)).toEqual([OUTLINE, 0xff00ff]);
  });
});

describe('placeholderProblems', () => {
  it('accepts a swapped sheet that uses its own ramp', () => {
    expect(placeholderProblems(new Set([OUTLINE, 0xff40ff]), SKIN, PLACEHOLDERS)).toEqual([]);
  });

  it('reports a placeholder from another ramp', () => {
    expect(placeholderProblems(new Set([0xff40ff, 0x40ffff]), SKIN, PLACEHOLDERS)).toEqual([
      "placeholder #40ffff is not in this sheet's swap ramp (#ff80ff #ff40ff #ff00ff)",
    ]);
  });

  it('reports a swapped sheet that uses none of its ramp', () => {
    expect(placeholderProblems(new Set([OUTLINE]), SKIN, PLACEHOLDERS)).toEqual([
      'uses no color of its swap ramp (#ff80ff #ff40ff #ff00ff)',
    ]);
  });

  it('reports any placeholder in an unswapped sheet', () => {
    expect(placeholderProblems(new Set([OUTLINE, 0xffff00]), null, PLACEHOLDERS)).toEqual([
      'placeholder #ffff00 is used, but this sheet is not palette-swapped',
    ]);
    expect(placeholderProblems(new Set([OUTLINE]), null, PLACEHOLDERS)).toEqual([]);
  });
});

describe('cellProblems', () => {
  it('accepts 64x64 frames whose top row is transparent', () => {
    const img = image(128, 64, [
      [32, 15, OUTLINE],
      [96, 63, OUTLINE],
    ]);
    expect(cellProblems(img, strip([100, 100]))).toEqual([]);
  });

  it('reports a frame that is not 64x64', () => {
    expect(cellProblems(image(32, 32, []), strip([100], [], [], 32))).toEqual([
      'frame 0 is 32x32 (expected 64x64)',
    ]);
  });

  it('reports a non-transparent pixel on row 0 of a frame, at its frame-local x', () => {
    const img = image(128, 64, [[64 + 5, 0, OUTLINE, 128]]);
    expect(cellProblems(img, strip([100, 100]))).toEqual([
      'frame 1 has a non-transparent pixel on row 0 at x = 5',
    ]);
  });

  it('reports a frame that lies outside the PNG', () => {
    expect(cellProblems(image(64, 64, []), strip([100, 100]))).toEqual([
      'frame 1 lies outside the 64x64 PNG',
    ]);
  });
});

describe('turnFrameProblems', () => {
  it('accepts a one-frame turn tag, and sheets without one', () => {
    expect(turnFrameProblems(strip(BODY_DURATIONS, BODY_TAGS))).toEqual([]);
    expect(turnFrameProblems(strip([100]))).toEqual([]);
  });

  it('reports a turn tag that spans more than one frame', () => {
    const data = strip([100, 100, 100], [['turn', 1, 2]]);
    expect(turnFrameProblems(data)).toEqual(['tag "turn" covers 2 frames (expected 1)']);
  });
});

describe('tagProblems', () => {
  it('accepts the required tags played forward', () => {
    expect(tagProblems(strip(BODY_DURATIONS, BODY_TAGS), AVATAR_TAGS)).toEqual([]);
  });

  it('reports a missing tag, a non-forward direction and a range outside the frames', () => {
    const data = strip(
      [100, 100, 100],
      [
        ['front-idle', 0, 1, 'pingpong'],
        ['side-run', 2, 5],
      ],
    );
    expect(tagProblems(data, AVATAR_TAGS)).toEqual([
      'missing tag "turn"',
      'tag "front-idle" plays pingpong (expected forward)',
      'tag "side-run" covers frames 2-5, outside the 3 frames',
    ]);
  });
});

describe('timingProblems', () => {
  const body = strip(BODY_DURATIONS, BODY_TAGS);

  it('accepts a layer with the same frames, durations and tags as body', () => {
    expect(timingProblems(strip(BODY_DURATIONS, BODY_TAGS), body)).toEqual([]);
  });

  it('reports a different frame count, durations and tags', () => {
    const layer = strip(
      [200, 200, 200, 150, 80, 80, 80],
      [
        ['front-idle', 0, 2],
        ['turn', 3, 3],
        ['side-run', 4, 6],
      ],
    );
    expect(timingProblems(layer, body)).toEqual([
      'has 7 frames (body has 8)',
      'frame durations [200,200,200,150,80,80,80] differ from body [200,200,200,150,80,80,80,80]',
      'tags [front-idle 0-2 forward, turn 3-3 forward, side-run 4-6 forward] differ from body [front-idle 0-2 forward, turn 3-3 forward, side-run 4-7 forward]',
    ]);
  });
});

describe('beltProblems', () => {
  const body = strip(BODY_DURATIONS, BODY_TAGS);

  it('accepts a belt tag timed like body side-run', () => {
    expect(beltProblems(strip([80, 80, 80, 80], [['belt', 0, 3]]), body)).toEqual([]);
  });

  it('reports a missing belt tag', () => {
    expect(beltProblems(strip([80]), body)).toEqual(['missing tag "belt"']);
  });

  it('reports a belt whose frame count or durations differ from side-run', () => {
    expect(beltProblems(strip([80, 80, 80], [['belt', 0, 2]]), body)).toEqual([
      'belt has 3 frames (body side-run has 4)',
    ]);
    expect(beltProblems(strip([80, 80, 90, 80], [['belt', 0, 3]]), body)).toEqual([
      'belt durations [80,80,90,80] differ from body side-run [80,80,80,80]',
    ]);
  });

  it('reports a body without side-run', () => {
    expect(beltProblems(strip([80], [['belt', 0, 0]]), strip([100]))).toEqual([
      'body has no "side-run" tag',
    ]);
  });
});

describe('sliceProblems', () => {
  const bounds = { x: 0, y: 0, w: 8, h: 8 };

  it('accepts present slices, with pivots where required', () => {
    const data = strip([100], [], [{ name: 'rider', keys: [{ frame: 0, bounds, pivot: { x: 4, y: 8 } }] }]);
    expect(sliceProblems(data, ['rider'], true)).toEqual([]);
  });

  it('reports a missing pivot and a missing slice', () => {
    const data = strip([100], [], [{ name: 'rider', keys: [{ frame: 0, bounds }] }]);
    expect(sliceProblems(data, ['rider', 'decor'], true)).toEqual([
      'slice "rider" has no pivot',
      'missing slice "decor"',
    ]);
  });

  it('names every room slot slice', () => {
    expect(ROOM_SLOT_SLICES).toEqual([
      'trophy-1',
      'trophy-2',
      'trophy-3',
      'medal-1',
      'medal-2',
      'medal-3',
      'frame',
      'equipment',
      'decor',
    ]);
  });
});
```

- [ ] **Step 7: Run it and watch it fail**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/sheetRules.test.ts`
Expected: FAIL, 0 tests, with `Error: Failed to resolve import "./sheetRules.js" from "src/features/avatar/__tests__/sheetRules.test.ts". Does the file exist?`

- [ ] **Step 8: Implement the sheet rules**

Create `apps/web/src/features/avatar/__tests__/sheetRules.ts`:

```ts
// Pure helpers for the art check (art.test.ts). They take decoded PNG pixels and
// parsed Aseprite JSON and return one message per problem (empty = valid), so
// they are unit-tested in sheetRules.test.ts without any exported art.
import { z } from 'zod';
import { hex } from './paletteRules.js';

/** Every avatar frame is one shared 64x64 cell (spec §1 Scale). */
export const AVATAR_CELL = 64;

/** Tags every avatar sheet carries, with body.json's timing. */
export const AVATAR_TAGS = ['front-idle', 'turn', 'side-run'] as const;

/** Slot slices background.aseprite must define (spec §3 Room composition). */
export const ROOM_SLOT_SLICES = [
  'trophy-1',
  'trophy-2',
  'trophy-3',
  'medal-1',
  'medal-2',
  'medal-3',
  'frame',
  'equipment',
  'decor',
] as const;

/** Decoded RGBA pixels, row-major, 4 bytes per pixel (pngjs PNG.sync.read). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const RectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

/** The subset of `aseprite --format json-array --list-tags --list-slices`
 * output the art check reads. Unknown keys are stripped. */
export const AsepriteJsonSchema = z.object({
  frames: z.array(z.object({ frame: RectSchema, duration: z.number().int().positive() })).min(1),
  meta: z.object({
    size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
    frameTags: z.array(
      z.object({
        name: z.string(),
        from: z.number().int().nonnegative(),
        to: z.number().int().nonnegative(),
        direction: z.string(),
      }),
    ),
    slices: z.array(
      z.object({
        name: z.string(),
        keys: z
          .array(
            z.object({
              frame: z.number().int().nonnegative(),
              bounds: RectSchema,
              pivot: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
            }),
          )
          .min(1),
      }),
    ),
  }),
});

export type AsepriteJson = z.infer<typeof AsepriteJsonSchema>;

export function parseAsepriteJson(json: unknown): AsepriteJson {
  return AsepriteJsonSchema.parse(json);
}

export type SwapRampName = 'skin' | 'hair' | 'cloth';

/** The placeholder ramp a sheet's runtime swap replaces (same rule as
 * layers.ts: body → skin, hair-* → hair, clothing → cloth); null = unswapped. */
export function swapRampFor(sheetId: string): SwapRampName | null {
  if (sheetId === 'body') return 'skin';
  if (sheetId.startsWith('hair-')) return 'hair';
  if (/^(top|bottom|shoes)-/.test(sheetId)) return 'cloth';
  return null;
}

/** Avatar layer sheets: body, hair-*, top-*, bottom-*, shoes-*. */
export function isAvatarSheet(sheetId: string): boolean {
  return swapRampFor(sheetId) !== null;
}

function alphaAt(image: RgbaImage, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4 + 3] ?? 0;
}

function colorAt(image: RgbaImage, x: number, y: number): number {
  const o = (y * image.width + x) * 4;
  const d = image.data;
  return ((d[o] ?? 0) << 16) | ((d[o + 1] ?? 0) << 8) | (d[o + 2] ?? 0);
}

/** Every pixel has alpha 0 or 255, and every opaque color is in the palette. */
export function pixelProblems(image: RgbaImage, palette: ReadonlySet<number>): string[] {
  let partial = 0;
  let firstPartial = '';
  const offPalette = new Map<number, string>();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const alpha = alphaAt(image, x, y);
      if (alpha === 0) continue;
      if (alpha !== 255) {
        if (partial === 0) firstPartial = `(${x}, ${y})`;
        partial++;
        continue;
      }
      const color = colorAt(image, x, y);
      if (!palette.has(color) && !offPalette.has(color)) offPalette.set(color, `(${x}, ${y})`);
    }
  }
  const problems: string[] = [];
  if (partial > 0) {
    problems.push(`${partial} pixels have alpha other than 0 or 255, first at ${firstPartial}`);
  }
  for (const [color, at] of offPalette) {
    problems.push(`color ${hex(color)} at ${at} is not in palette.gpl`);
  }
  return problems;
}

/** The distinct colors of the image's alpha-255 pixels. */
export function opaqueColors(image: RgbaImage): Set<number> {
  const colors = new Set<number>();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (alphaAt(image, x, y) === 255) colors.add(colorAt(image, x, y));
    }
  }
  return colors;
}

/**
 * A swapped sheet uses placeholders of its own ramp only, and at least one of
 * them; an unswapped sheet (ramp null) uses no placeholder at all.
 */
export function placeholderProblems(
  colors: ReadonlySet<number>,
  ramp: readonly number[] | null,
  placeholders: readonly number[],
): string[] {
  const problems: string[] = [];
  for (const color of colors) {
    if (!placeholders.includes(color)) continue;
    if (ramp === null) {
      problems.push(`placeholder ${hex(color)} is used, but this sheet is not palette-swapped`);
    } else if (!ramp.includes(color)) {
      problems.push(
        `placeholder ${hex(color)} is not in this sheet's swap ramp (${ramp.map(hex).join(' ')})`,
      );
    }
  }
  if (ramp !== null && !ramp.some((c) => colors.has(c))) {
    problems.push(`uses no color of its swap ramp (${ramp.map(hex).join(' ')})`);
  }
  return problems;
}

/** Avatar frames are 64x64 cells inside the PNG with a fully transparent
 * row 0 (anything there was clipped by the cell). */
export function cellProblems(image: RgbaImage, data: AsepriteJson): string[] {
  const problems: string[] = [];
  data.frames.forEach(({ frame }, i) => {
    if (frame.w !== AVATAR_CELL || frame.h !== AVATAR_CELL) {
      problems.push(`frame ${i} is ${frame.w}x${frame.h} (expected ${AVATAR_CELL}x${AVATAR_CELL})`);
      return;
    }
    if (frame.x + frame.w > image.width || frame.y + frame.h > image.height) {
      problems.push(`frame ${i} lies outside the ${image.width}x${image.height} PNG`);
      return;
    }
    for (let dx = 0; dx < frame.w; dx++) {
      if (alphaAt(image, frame.x + dx, frame.y) !== 0) {
        problems.push(`frame ${i} has a non-transparent pixel on row 0 at x = ${dx}`);
        return;
      }
    }
  });
  return problems;
}

/** Required tags exist, every tag plays forward, and every range is in bounds. */
export function tagProblems(data: AsepriteJson, required: readonly string[]): string[] {
  const problems: string[] = [];
  const tags = data.meta.frameTags;
  for (const name of required) {
    if (!tags.some((t) => t.name === name)) problems.push(`missing tag "${name}"`);
  }
  for (const tag of tags) {
    if (tag.direction !== 'forward') {
      problems.push(`tag "${tag.name}" plays ${tag.direction} (expected forward)`);
    }
    if (tag.from > tag.to || tag.to >= data.frames.length) {
      problems.push(
        `tag "${tag.name}" covers frames ${tag.from}-${tag.to}, outside the ${data.frames.length} frames`,
      );
    }
  }
  return problems;
}

/** body's `turn` tag is the single ¾ frame (spec §1 Views and animation tags). */
export function turnFrameProblems(data: AsepriteJson): string[] {
  const turn = data.meta.frameTags.find((t) => t.name === 'turn');
  if (!turn || turn.from === turn.to) return [];
  return [`tag "turn" covers ${turn.to - turn.from + 1} frames (expected 1)`];
}

function durations(data: AsepriteJson, from = 0, to = data.frames.length - 1): number[] {
  return data.frames.slice(from, to + 1).map((f) => f.duration);
}

function tagList(data: AsepriteJson): string {
  return data.meta.frameTags.map((t) => `${t.name} ${t.from}-${t.to} ${t.direction}`).join(', ');
}

/** An avatar layer has body.json's frame count, per-frame durations and tags. */
export function timingProblems(data: AsepriteJson, body: AsepriteJson): string[] {
  const problems: string[] = [];
  if (data.frames.length !== body.frames.length) {
    problems.push(`has ${data.frames.length} frames (body has ${body.frames.length})`);
  }
  const own = durations(data).join(',');
  const ref = durations(body).join(',');
  if (own !== ref) problems.push(`frame durations [${own}] differ from body [${ref}]`);
  if (tagList(data) !== tagList(body)) {
    problems.push(`tags [${tagList(data)}] differ from body [${tagList(body)}]`);
  }
  return problems;
}

/** treadmill's `belt` tag has the frame count and durations of body's `side-run`. */
export function beltProblems(treadmill: AsepriteJson, body: AsepriteJson): string[] {
  const belt = treadmill.meta.frameTags.find((t) => t.name === 'belt');
  if (!belt) return ['missing tag "belt"'];
  const run = body.meta.frameTags.find((t) => t.name === 'side-run');
  if (!run) return ['body has no "side-run" tag'];
  const beltDurations = durations(treadmill, belt.from, belt.to);
  const runDurations = durations(body, run.from, run.to);
  if (beltDurations.length !== runDurations.length) {
    return [`belt has ${beltDurations.length} frames (body side-run has ${runDurations.length})`];
  }
  const own = beltDurations.join(',');
  const ref = runDurations.join(',');
  return own === ref ? [] : [`belt durations [${own}] differ from body side-run [${ref}]`];
}

/** Each named slice exists; with needPivot, its first key has a pivot. */
export function sliceProblems(
  data: AsepriteJson,
  names: readonly string[],
  needPivot: boolean,
): string[] {
  const problems: string[] = [];
  for (const name of names) {
    const slice = data.meta.slices.find((s) => s.name === name);
    if (!slice) {
      problems.push(`missing slice "${name}"`);
    } else if (needPivot && slice.keys[0]?.pivot === undefined) {
      problems.push(`slice "${name}" has no pivot`);
    }
  }
  return problems;
}
```

- [ ] **Step 9: Run it and watch it pass**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/sheetRules.test.ts`
Expected: PASS, `Tests  30 passed (30)`.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/avatar/__tests__/sheetRules.ts apps/web/src/features/avatar/__tests__/sheetRules.test.ts
git commit -F - <<'EOF'
Add sprite-sheet rules for the art check

Aseprite json-array schema plus pixel, placeholder, 64x64 cell, tag,
timing, belt and slice rules, each returning one message per problem.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 11: Add the art-check devDependencies**

Run: `pnpm --filter @tracks/web add -D pngjs@^7.0.0 @types/pngjs@^6.0.5 @types/node@^24`

TS 6 includes no `@types` automatically, so `@types/node` is loaded only through the reference directive in art.test.ts. Major 24 matches `.nvmrc`. Do not add the native `canvas` package.

Then run: `node -p "const d=require('./apps/web/package.json').devDependencies; [d.pngjs, d['@types/pngjs'], d['@types/node']].join(' ')"`
Expected: three specifiers, one for pngjs 7, one for @types/pngjs 6 and one for @types/node 24, with no `undefined`.

- [ ] **Step 12: Write the failing art check**

Create `apps/web/src/features/avatar/__tests__/art.test.ts`. The catalog-coverage assertion is left for Task 19.

```ts
// @vitest-environment node
/// <reference types="node" />
// Art check (spec §5): validates art/palette.gpl, the target ramps and every
// exported sheet in src/assets/sprites against the source rules. It reads the
// committed files, so it never needs Aseprite. Until art is exported, only the
// palette, ramp and export-pair checks run.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { CLOTH_RAMPS, HAIR_RAMPS, PLACEHOLDER_RAMPS, SKIN_RAMPS } from '../palette.js';
import { paletteProblems, parseGpl, targetRampProblems } from './paletteRules.js';
import {
  AVATAR_TAGS,
  ROOM_SLOT_SLICES,
  beltProblems,
  cellProblems,
  isAvatarSheet,
  opaqueColors,
  parseAsepriteJson,
  pixelProblems,
  placeholderProblems,
  sliceProblems,
  swapRampFor,
  tagProblems,
  timingProblems,
  turnFrameProblems,
  type AsepriteJson,
  type RgbaImage,
} from './sheetRules.js';

const SPRITES_DIR = new URL('../../../assets/sprites/', import.meta.url);
const PALETTE_FILE = new URL('../../../../../../art/palette.gpl', import.meta.url);

const PLACEHOLDERS: readonly number[] = [
  ...PLACEHOLDER_RAMPS.skin,
  ...PLACEHOLDER_RAMPS.hair,
  ...PLACEHOLDER_RAMPS.cloth,
];

const palette = parseGpl(readFileSync(PALETTE_FILE, 'utf8'));
const paletteColors: ReadonlySet<number> = new Set(palette);

/** Exported file names in src/assets/sprites (empty until art is exported). */
function exportedFiles(): string[] {
  return existsSync(SPRITES_DIR) ? readdirSync(SPRITES_DIR).sort() : [];
}

/** Basenames of every exported .json or .png, so an orphan of either is checked. */
function exportedSheetIds(): string[] {
  const ids = exportedFiles()
    .filter((file) => file.endsWith('.json') || file.endsWith('.png'))
    .map((file) => file.replace(/\.(json|png)$/, ''));
  return [...new Set(ids)];
}

interface Sheet {
  data: AsepriteJson;
  image: RgbaImage;
}

const loaded = new Map<string, Sheet>();

function loadSheet(id: string): Sheet {
  const cached = loaded.get(id);
  if (cached) return cached;
  const sheet: Sheet = {
    data: parseAsepriteJson(JSON.parse(readFileSync(new URL(`${id}.json`, SPRITES_DIR), 'utf8'))),
    image: PNG.sync.read(readFileSync(new URL(`${id}.png`, SPRITES_DIR))),
  };
  loaded.set(id, sheet);
  return sheet;
}

/** body.json is the timing reference for every avatar layer and the belt. */
function body(): AsepriteJson {
  if (!existsSync(new URL('body.json', SPRITES_DIR))) {
    throw new Error('body.json is not exported; avatar layers and the belt are timed against it');
  }
  return loadSheet('body').data;
}

describe('art/palette.gpl', () => {
  it('holds each placeholder exactly once and keeps fixed colors 32+ away from them', () => {
    expect(paletteProblems(palette, PLACEHOLDERS)).toEqual([]);
  });
});

describe('ramps (palette.ts)', () => {
  it('has 3 colors in every placeholder, skin, hair and clothing ramp', () => {
    const groups: Array<[string, Readonly<Record<string, readonly number[]>>]> = [
      ['placeholder', PLACEHOLDER_RAMPS],
      ['skin', SKIN_RAMPS],
      ['hair', HAIR_RAMPS],
      ['cloth', CLOTH_RAMPS],
    ];
    const problems = groups.flatMap(([group, ramps]) =>
      Object.entries(ramps).flatMap(([id, ramp]) => targetRampProblems(`${group} ${id}`, ramp)),
    );
    expect(problems).toEqual([]);
  });
});

describe('exported sheets', () => {
  it('exports every sheet as a .json and .png pair', () => {
    const files = exportedFiles().filter((file) => /\.(json|png)$/.test(file));
    const expected = exportedSheetIds().flatMap((id) => [`${id}.json`, `${id}.png`]);
    expect(files).toEqual(expected.sort());
  });

  for (const id of exportedSheetIds()) {
    describe(id, () => {
      it('uses only palette colors, at alpha 0 or 255', () => {
        const { data, image } = loadSheet(id);
        expect([image.width, image.height]).toEqual([data.meta.size.w, data.meta.size.h]);
        expect(pixelProblems(image, paletteColors)).toEqual([]);
      });

      it("uses only its own swap ramp's placeholders", () => {
        const ramp = swapRampFor(id);
        const rampColors = ramp === null ? null : PLACEHOLDER_RAMPS[ramp];
        const colors = opaqueColors(loadSheet(id).image);
        expect(placeholderProblems(colors, rampColors, PLACEHOLDERS)).toEqual([]);
      });

      it('plays every tag forward, within its frames', () => {
        const required = isAvatarSheet(id) ? AVATAR_TAGS : id === 'treadmill' ? ['belt'] : [];
        expect(tagProblems(loadSheet(id).data, required)).toEqual([]);
      });

      if (isAvatarSheet(id)) {
        it('uses 64x64 frames with a transparent top row', () => {
          const { data, image } = loadSheet(id);
          expect(cellProblems(image, data)).toEqual([]);
        });
      }

      if (id === 'body') {
        it('has a single-frame turn tag', () => {
          expect(turnFrameProblems(loadSheet(id).data)).toEqual([]);
        });
      }

      if (isAvatarSheet(id) && id !== 'body') {
        it('matches body.json frame count, durations and tags', () => {
          expect(timingProblems(loadSheet(id).data, body())).toEqual([]);
        });
      }

      if (id === 'treadmill') {
        it('has a belt timed like side-run and a rider slice with a pivot', () => {
          const { data } = loadSheet(id);
          expect([...beltProblems(data, body()), ...sliceProblems(data, ['rider'], true)]).toEqual(
            [],
          );
        });
      }

      if (id === 'background') {
        it('has every slot slice', () => {
          expect(sliceProblems(loadSheet(id).data, ROOM_SLOT_SLICES, false)).toEqual([]);
        });
      }
    });
  }
});
```

Keep the pair test inside `describe('exported sheets')`. Vitest 5 fails a `describe` that registers no tests (`Error: No test found in suite exported sheets`), and the sheet loop registers none until art is exported.

- [ ] **Step 13: Run it and watch it fail**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts`
Expected: FAIL, 0 tests, with `Error: ENOENT: no such file or directory, open 'D:\Projects\Tracks\art\palette.gpl'`.

- [ ] **Step 14: Create the palette**

Create `art/palette.gpl` (GIMP Palette format) with exactly this content:

```
GIMP Palette
Name: Tracks
Columns: 8
#
# Tracks art palette (spec section 1 Style, section 4 Source rules).
# 32 fixed colors, then the 9 placeholder ramp entries (light, base, shadow).
# Placeholders are matched by exact RGB at runtime, never by name, and must
# equal PLACEHOLDER_RAMPS in apps/web/src/features/avatar/palette.ts.
# Every fixed color differs from every placeholder by 32+ in some channel.
# Every row needs a name: Aseprite skips rows without one.
#
# Outline and neutrals
 30  26  36  outline
244 241 234  white
200 206 216  metal light
142 150 166  metal
 90  96 112  metal shadow
 70  74  86  belt stripe
 44  46  54  belt
# Room: wall, trim, floor, wood, window (from the approved mockup)
216 200 168  wall
196 180 146  wall shadow
181 158 122  trim
140  94  60  floor
122  80  50  floor lines
142 104  72  wood light
110  75  50  dark wood
 74  50  34  wood shadow
214 236 248  glass light
159 208 239  glass
120 176 216  glass shadow
# Trophies and medals (silver uses the metal ramp)
246 213  92  gold light
224 168  48  gold
168 116  28  gold shadow
228 160 112  bronze light
184 112  64  bronze
126  74  40  bronze shadow
# Accents: ribbons, bib, treadmill console
200  60  60  red
140  36  44  red shadow
 60 100 200  blue
 36  60 132  blue shadow
# Plant and pot
124 196 100  leaf light
 76 154  68  leaf
 46 106  52  leaf shadow
192 100  60  terracotta
# Placeholder ramps, swapped at runtime (light, base, shadow)
255 128 255  PH skin light
255  64 255  PH skin base
255   0 255  PH skin shadow
128 255 255  PH hair light
 64 255 255  PH hair base
  0 255 255  PH hair shadow
255 255 128  PH cloth light
255 255  64  PH cloth base
255 255   0  PH cloth shadow
```

The mockup colors are all present: wall `#d8c8a8`, trim `#b59e7a`, floor `#8c5e3c`, floor lines `#7a5032`, dark wood `#6e4b32` and glass `#9fd0ef`.

- [ ] **Step 15: Run the art check and watch it pass**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts`
Expected: PASS, `Tests  3 passed (3)`. These are the palette, ramps and export-pair tests. The sheet loop is empty because nothing is exported yet.

- [ ] **Step 16: Make turbo re-run web tests when the palette changes**

Replace `turbo.json` with:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "@tracks/web#test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/art/palette.gpl"]
    }
  }
}
```

Run: `pnpm exec turbo run test --filter=@tracks/web --dry=json 2>/dev/null | grep -c 'art/palette.gpl'`
Expected: `2`. The file appears in the task's hashed `inputs` as `"../../art/palette.gpl": "<sha>"` and in its resolved task definition.

- [ ] **Step 17: Verify typecheck, lint and the whole web suite**

Run: `pnpm --filter @tracks/web typecheck`
Expected: exit 0 with no errors. `pngjs` and the `node:fs` imports resolve through the new `@types/*` packages.

Run: `pnpm --filter @tracks/web lint`
Expected: exit 0 with no problems. The `/// <reference types="node" />` line passes `@typescript-eslint/triple-slash-reference`, because the file imports `node:fs`, not `node`.

Run: `pnpm --filter @tracks/web test`
Expected: every test file passes, including paletteRules (17), sheetRules (30) and art (3). There are no warnings or console errors.

- [ ] **Step 18: Commit**

```bash
git add art/palette.gpl apps/web/src/features/avatar/__tests__/art.test.ts apps/web/package.json pnpm-lock.yaml turbo.json
git commit -F - <<'EOF'
Add palette.gpl and the art check

32 fixed colors (mockup room colors, outline, metal, gold, bronze,
accents, plant) plus the 9 placeholders. art.test.ts checks the
palette and ramps now and validates every exported sheet once art
lands. turbo hashes art/palette.gpl into @tracks/web#test.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 19: Write the export script and its root script**

Create `scripts/export-art.ts`:

```ts
// pnpm art:export — exports every art/**/*.aseprite to
// apps/web/src/assets/sprites/<name>.png + <name>.json (spec §4 Export).
// The exports are committed, so CI and Pages never need Aseprite. A failed
// export removes its partial outputs and exits non-zero with Aseprite's output.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART_DIR = path.join(ROOT, 'art');
const OUT_DIR = path.join(ROOT, 'apps', 'web', 'src', 'assets', 'sprites');
const STEAM_ASEPRITE = path.win32.normalize(
  'C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe',
);

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

/** ASEPRITE_PATH if set (the MCP registration's env does not reach this
 * script), else the Steam install, else fail naming both. */
function resolveAseprite(): string {
  const fromEnv = process.env['ASEPRITE_PATH'];
  if (fromEnv !== undefined && fromEnv !== '') {
    if (!existsSync(fromEnv)) {
      throw new Error(`ASEPRITE_PATH is set to "${fromEnv}", but no file exists there.`);
    }
    return fromEnv;
  }
  if (existsSync(STEAM_ASEPRITE)) return STEAM_ASEPRITE;
  throw new Error(
    `Aseprite not found. Set ASEPRITE_PATH to Aseprite.exe, or install it at "${STEAM_ASEPRITE}".`,
  );
}

/** Every .aseprite file under art/, keyed by export name (its basename). */
function findSources(): Map<string, string> {
  const sources = new Map<string, string>();
  if (!existsSync(ART_DIR)) return sources;
  const files = readdirSync(ART_DIR, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.aseprite'))
    .map((file) => path.join(ART_DIR, file))
    .sort();
  for (const file of files) {
    const name = path.basename(file, '.aseprite');
    const other = sources.get(name);
    if (other !== undefined) {
      throw new Error(
        `${rel(other)} and ${rel(file)} would both export to ${name}.png; rename one.`,
      );
    }
    sources.set(name, file);
  }
  return sources;
}

/** Aseprite's combined output, from a result or from execFile's error. */
function outputOf(result: unknown): string {
  if (typeof result !== 'object' || result === null) return String(result);
  const parts: string[] = [];
  if (result instanceof Error) parts.push(result.message);
  if ('stdout' in result) parts.push(String(result.stdout));
  if ('stderr' in result) parts.push(String(result.stderr));
  const text = parts.filter((part) => part.trim() !== '').join('\n');
  return text === '' ? '(no output)' : text;
}

/** Aseprite exits 0 even when a source fails to load, leaving a 0-byte JSON,
 * so check the outputs. Returns a problem, or null when both are usable. */
function checkOutputs(pngFile: string, jsonFile: string): string | null {
  if (!existsSync(pngFile)) return `no PNG was written at ${rel(pngFile)}`;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(jsonFile, 'utf8'));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return `${rel(jsonFile)} is missing or is not valid JSON (${reason})`;
  }
  const frames =
    typeof data === 'object' && data !== null && 'frames' in data ? data.frames : undefined;
  if (!Array.isArray(frames) || frames.length < 1) {
    return `${rel(jsonFile)} has no frames array with at least one frame`;
  }
  return null;
}

async function exportSheet(aseprite: string, name: string, source: string): Promise<void> {
  const pngFile = path.join(OUT_DIR, `${name}.png`);
  const jsonFile = path.join(OUT_DIR, `${name}.json`);
  const removeOutputs = (): void => {
    rmSync(pngFile, { force: true });
    rmSync(jsonFile, { force: true });
  };
  removeOutputs();
  // An args array, because the Aseprite path has spaces. Exactly these flags:
  // the default horizontal strip with untrimmed frame rects.
  const args = [
    '--batch',
    source,
    '--sheet',
    pngFile,
    '--data',
    jsonFile,
    '--format',
    'json-array',
    '--list-tags',
    '--list-slices',
  ];
  let output: string;
  try {
    output = outputOf(await execFileAsync(aseprite, args, { windowsHide: true }));
  } catch (err) {
    removeOutputs();
    throw new Error(`Aseprite failed on ${rel(source)}:\n${outputOf(err)}`);
  }
  const problem = checkOutputs(pngFile, jsonFile);
  if (problem !== null) {
    removeOutputs();
    throw new Error(`${rel(source)}: ${problem}\nAseprite output:\n${output}`);
  }
  console.log(`exported ${rel(source)} -> ${rel(pngFile)} + ${name}.json`);
}

async function main(): Promise<void> {
  const aseprite = resolveAseprite();
  const sources = findSources();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, source] of sources) {
    await exportSheet(aseprite, name, source);
  }
  console.log(`art:export: ${sources.size} sheet(s) exported with ${aseprite}`);
}

main().catch((err: unknown) => {
  console.error(`art:export failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
```

The root package has no `"type"` field, so tsx runs this file as CommonJS. That is why it uses `main().catch(...)` and not top-level await, the same as `scripts/init.ts`.

In the root `package.json`, add this entry as the last one in `"scripts"`, directly after `"init:project": "npx tsx scripts/init.ts"`, and add a comma to the end of the `init:project` line. Task 3's `"test:db"` sits right after `"test"`, not at the end. Leave it there.

```json
    "art:export": "npx tsx scripts/export-art.ts"
```

Run: `node -p "require('./package.json').scripts['art:export']"`
Expected: `npx tsx scripts/export-art.ts`

- [ ] **Step 20: Smoke-test the pipeline end to end with a throwaway source**

```bash
mkdir -p .superpowers/art-previews art/room
cat > .superpowers/art-previews/smoke.lua <<'EOF'
local spr = Sprite(4, 3, ColorMode.RGB)
spr:setPalette(Palette{ fromFile = app.params.palette })
print('palette entries: ' .. #spr.palettes[1])
local img = Image(4, 3, ColorMode.RGB)
img:clear(app.pixelColor.rgba(0, 0, 0, 0))
img:drawPixel(1, 2, app.pixelColor.rgba(216, 200, 168, 255))
img:drawPixel(2, 2, app.pixelColor.rgba(30, 26, 36, 255))
spr:newCel(spr.layers[1], 1, img, Point(0, 0))
spr:saveAs(app.params.out)
EOF
ROOT="$(git rev-parse --show-toplevel)"
ASE="${ASEPRITE_PATH:-/c/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe}"
"$ASE" --batch --script-param "palette=$ROOT/art/palette.gpl" --script-param "out=$ROOT/art/room/zz-smoke.aseprite" --script "$ROOT/.superpowers/art-previews/smoke.lua"
pnpm art:export
grep '"image"' apps/web/src/assets/sprites/zz-smoke.json
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
```

Expected, in order:
1. Aseprite prints `palette entries: 41`, which proves Aseprite loads palette.gpl with all 41 rows.
2. `pnpm art:export` prints `exported art/room/zz-smoke.aseprite -> apps/web/src/assets/sprites/zz-smoke.png + zz-smoke.json`, then `art:export: 1 sheet(s) exported with C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`.
3. `grep` prints `"image": "zz-smoke.png",`, so `meta.image` is relative to the JSON.
4. vitest passes with `Tests  6 passed (6)`: the three base tests plus zz-smoke's palette, placeholder and tag tests, run on a real Aseprite PNG decoded by pngjs.

- [ ] **Step 21: Check the failure paths**

```bash
printf 'not an aseprite file' > art/room/aa-bad.aseprite
pnpm art:export; echo "exit $?"
ls apps/web/src/assets/sprites
ASEPRITE_PATH='C:/nope/Aseprite.exe' pnpm art:export; echo "exit $?"
```

Expected:
1. The first export prints `art:export failed: art/room/aa-bad.aseprite: no PNG was written at apps/web/src/assets/sprites/aa-bad.png`, then `Aseprite output:` followed by Aseprite's `Error reading header` / `Error loading sprite from file ...` / `No documents to export`. pnpm then prints its ELIFECYCLE line and `exit 1`.
2. `ls` lists only `zz-smoke.json` and `zz-smoke.png`. The 0-byte `aa-bad.json` that Aseprite left behind has been removed.
3. The second export prints `art:export failed: ASEPRITE_PATH is set to "C:/nope/Aseprite.exe", but no file exists there.` and `exit 1`.

- [ ] **Step 22: Remove the throwaway files and confirm a clean tree**

```bash
rm art/room/aa-bad.aseprite art/room/zz-smoke.aseprite apps/web/src/assets/sprites/zz-smoke.png apps/web/src/assets/sprites/zz-smoke.json .superpowers/art-previews/smoke.lua
git status --porcelain art apps/web/src/assets
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
```

Expected: `git status` prints nothing (empty directories are not tracked), and vitest passes with `Tests  3 passed (3)`.

- [ ] **Step 23: Commit**

```bash
git add scripts/export-art.ts package.json
git commit -F - <<'EOF'
Add pnpm art:export

Exports every art/**/*.aseprite to apps/web/src/assets/sprites as a
json-array strip with tags and slices. Uses ASEPRITE_PATH or the Steam
install, deletes old outputs first, and fails with Aseprite's output
when a PNG is missing or the JSON has no frames.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

---

### Task 15: Art: body (front-idle, turn, side-run)

**Files:**
- Create (through the Aseprite MCP): `art/avatar/body.aseprite`. This is the timing reference for every avatar layer.
- Create (through `pnpm art:export`): `apps/web/src/assets/sprites/body.png` and `apps/web/src/assets/sprites/body.json`.
- Test (new): `apps/web/src/features/avatar/__tests__/body-art.test.ts`. It checks the body's own geometry, timing and belt hand-off from spec §1 and §3. Task 14's `art.test.ts` is not changed.
- Modify `art/palette.gpl` only if the user changes colors at Checkpoint A.
- Scratch files (gitignored, never committed): `.superpowers/art-src/paint-body.lua`, `.superpowers/art-src/dump-body.lua`, `.superpowers/art-src/derive-idle.mjs`, `.superpowers/art-src/palette-swatch.lua`, `.superpowers/art-src/onion-review.lua`, `.superpowers/art-src/body/f01.txt`…`f15.txt` and `.superpowers/art-previews/*`.

**Interfaces:**
- Consumes:
  - `art/palette.gpl` (Task 14). It holds the 9 `PLACEHOLDER_RAMPS` colors plus the fixed colors. The darkest non-placeholder color is the shared outline.
  - The root script `"art:export": "npx tsx scripts/export-art.ts"` (Task 14).
  - `apps/web/src/features/avatar/__tests__/art.test.ts` (Task 14).
  - The apps/web devDependencies `pngjs`, `@types/pngjs` and `@types/node` (Task 14).
  - The MCP server `aseprite`. All frame indices are 1-based. The tools this task uses:
    - `mcp__aseprite__create_canvas(width, height, filename)`
    - `run_lua_script(script, filename="")`
    - `rename_layer(filename, layer_name, new_name)`
    - `add_frames(filename, count, duration_ms=None)`, which appends copies at the end
    - `delete_frame(filename, frame_index)`
    - `set_frame_duration(filename, frame_index, duration_ms)`
    - `set_tag(filename, name, from_frame, to_frame, direction="forward")`
    - `get_sprite_info(filename)`
    - `export_frame(filename, frame_index, output_filename, scale=1)`
    - `export_tag(filename, tag_name, output_filename, scale=1)`
  - `SendUserFile`.
- Produces:
  - SheetId `body` (= `BODY_SHEET`). `body.png` is a 960×64 horizontal strip of 15 untrimmed 64×64 cells. `body.json` is in Aseprite json-array format.
  - `meta.frameTags` (0-based): `front-idle` 0–5, `turn` 6–6 and `side-run` 7–14, all `forward`.
  - `frames[].duration` is `[700, 200, 450, 120, 330, 200, 150, 90, 90, 90, 90, 90, 90, 90, 90]`. From these durations:
    - `timingsFromSheet(getSheet('body'))` = `{ idleLoopMs: 2000, runLoopMs: 720, turnMs: 150 }`.
    - The behavior loop's whole-loop idles last 6 s or 8 s, and its runs last 8.64–15.12 s.
    - `tagFrames(body, 'side-run')` = indices 7…14, at 90 ms each.
  - Side-run order, by tag offset: 0 down-near, 1 pass-near, 2 flight-1, 3 contact-far, 4 down-far, 5 pass-far, 6 flight-2, 7 contact-near. The loop therefore starts and ends with a foot planted, so a run never switches to `turn` from mid-air (spec §3).
  - Belt hand-off. The planted foot's sole on row 63 has a fixed width and moves exactly 4 px toward −x per frame:
    - near foot: offsets 7 → 0 → 1 (x 35–40 → 31–36 → 27–32), wrapping across the loop seam
    - far foot: offsets 3 → 4 → 5 (the same spans)
    - offsets 2 and 6 are flight frames, with rows 62–63 empty
    - That makes 32 px of belt travel per loop. `body-art.test.ts` pins this with `BELT_SHIFT_PX = 4` and `FLIGHT_OFFSETS = [2, 6]`. The treadmill `belt` (Task 18) must shift by the same 4 px per frame.
  - Layer name `body`.
  - The grids `.superpowers/art-src/body/fNN.txt` are the reference that hair and clothing get drawn against. Grid NN is MCP frame NN, which is JSON index NN−1. They are scratch files, as are the scripts. In a checkout where `.superpowers/art-src/` is missing (a fresh clone or a worktree):
    1. Re-create `dump-body.lua` from Step 4 of this task.
    2. Run it on `art/avatar/body.aseprite`. Expected: `OK dumped=15 empty=0`.

Paths: every MCP argument below uses `D:/Projects/Tracks`. If `git rev-parse --show-toplevel` prints another path (a worktree, for example), use that path everywhere this task names `D:/Projects/Tracks`:
- every MCP argument, including the `dofile` paths;
- the `ROOT` line of the four Lua scripts.

- [ ] **Step 1: Write the failing body geometry test**

Create `apps/web/src/features/avatar/__tests__/body-art.test.ts`:

```ts
// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

// Spec §1 "Scale" and "Views and animation tags" and §3 "Behavior loop", checked on
// the exported body sheet. art.test.ts covers the rules every sheet shares (palette,
// alpha, tags, 64x64 cells); this file pins the body's own geometry and timing.

const SPRITES = new URL('../../../assets/sprites/', import.meta.url);
const CELL = 64;
const GROUND_ROW = 63;
const CENTER_X = 32;
/** Front and 3/4 views: a hip row with a 1-px gap between the hips and both hands. */
const FRONT_HIP_ROW = 46;
/** Side view: the hip joint sits 30 rows below the crown (crown 15, hip 45, plus the bob). */
const SIDE_HIP_BELOW_CROWN = 30;
/** Treadmill belt shift per side-run frame: the planted sole's travel toward -x. */
const BELT_SHIFT_PX = 4;
/** side-run offsets with both feet off the ground. The loop starts and ends planted. */
const FLIGHT_OFFSETS: readonly number[] = [2, 6];
/** behavior.ts draws idle as 4000-8000 ms and rounds it up to whole front-idle loops. */
const IDLE_MAX_MS = 8000;

const BodyJsonSchema = z.object({
  frames: z
    .array(
      z.object({
        frame: z.object({
          x: z.number().int(),
          y: z.number().int(),
          w: z.number().int(),
          h: z.number().int(),
        }),
        duration: z.number().int().positive(),
      }),
    )
    .min(1),
  meta: z.object({
    frameTags: z.array(
      z.object({
        name: z.string(),
        from: z.number().int(),
        to: z.number().int(),
        direction: z.string(),
      }),
    ),
  }),
});

type BodyJson = z.infer<typeof BodyJsonSchema>;

interface Run {
  from: number;
  to: number;
}

interface CellStats {
  top: number;
  minX: number;
  maxX: number;
  pixels: string;
}

let body: BodyJson;
let png: PNG;

function tagFrameIndices(name: string): number[] {
  const tag = body.meta.frameTags.find((t) => t.name === name);
  if (!tag) throw new Error(`body.json has no "${name}" tag`);
  return Array.from({ length: tag.to - tag.from + 1 }, (_, i) => tag.from + i);
}

function cellRect(index: number): { left: number; top: number; w: number; h: number } {
  const entry = body.frames[index];
  if (!entry) throw new Error(`body.json has no frame ${index}`);
  return { left: entry.frame.x, top: entry.frame.y, w: entry.frame.w, h: entry.frame.h };
}

function isOpaque(index: number, x: number, y: number): boolean {
  const { left, top } = cellRect(index);
  return (png.data[((top + y) * png.width + left + x) * 4 + 3] ?? 0) !== 0;
}

/** Contiguous opaque runs on one row of a cell, left to right. */
function rowRuns(index: number, y: number): Run[] {
  const runs: Run[] = [];
  let from = -1;
  for (let x = 0; x <= CELL; x++) {
    const opaque = x < CELL && isOpaque(index, x, y);
    if (opaque && from < 0) from = x;
    if (!opaque && from >= 0) {
      runs.push({ from, to: x - 1 });
      from = -1;
    }
  }
  return runs;
}

function runThrough(index: number, y: number, x: number): Run | undefined {
  return rowRuns(index, y).find((r) => r.from <= x && x <= r.to);
}

function cellStats(index: number): CellStats {
  const { left, top: cellTop, w, h } = cellRect(index);
  let top = h;
  let minX = w;
  let maxX = -1;
  const rows: Uint8Array[] = [];
  for (let y = 0; y < h; y++) {
    const rowStart = ((cellTop + y) * png.width + left) * 4;
    rows.push(png.data.subarray(rowStart, rowStart + w * 4));
    for (let x = 0; x < w; x++) {
      if ((png.data[rowStart + x * 4 + 3] ?? 0) === 0) continue;
      top = Math.min(top, y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  return { top, minX, maxX, pixels: Buffer.concat(rows).toString('base64') };
}

describe('body sheet', () => {
  beforeAll(() => {
    body = BodyJsonSchema.parse(JSON.parse(readFileSync(new URL('body.json', SPRITES), 'utf8')));
    png = PNG.sync.read(readFileSync(new URL('body.png', SPRITES)));
  });

  it('has front-idle (4-6 frames), turn (1) and side-run (6-10), covering each frame once', () => {
    const idle = tagFrameIndices('front-idle');
    const turn = tagFrameIndices('turn');
    const run = tagFrameIndices('side-run');
    expect(idle.length).toBeGreaterThanOrEqual(4);
    expect(idle.length).toBeLessThanOrEqual(6);
    expect(turn).toHaveLength(1);
    expect(run.length).toBeGreaterThanOrEqual(6);
    expect(run.length).toBeLessThanOrEqual(10);
    expect([...idle, ...turn, ...run].sort((a, b) => a - b)).toEqual(body.frames.map((_, i) => i));
  });

  it('plays every tag forward', () => {
    for (const tag of body.meta.frameTags) {
      expect(tag.direction, tag.name).toBe('forward');
    }
  });

  it('loops front-idle in 2-4 s, in whole fractions of 8 s so idles end by 8 s', () => {
    const loopMs = tagFrameIndices('front-idle').reduce(
      (sum, i) => sum + (body.frames[i]?.duration ?? 0),
      0,
    );
    expect(loopMs).toBeGreaterThanOrEqual(2000);
    expect(loopMs).toBeLessThanOrEqual(4000);
    expect(IDLE_MAX_MS % loopMs, `${IDLE_MAX_MS} ms % ${loopMs} ms`).toBe(0);
  });

  it('uses 64x64 cells and keeps every frame off the cell edges', () => {
    body.frames.forEach(({ frame }, i) => {
      expect([frame.w, frame.h], `frame ${i} size`).toEqual([CELL, CELL]);
      const s = cellStats(i);
      expect(s.top, `frame ${i} top row`).toBeGreaterThanOrEqual(1);
      expect(s.minX, `frame ${i} left column`).toBeGreaterThanOrEqual(1);
      expect(s.maxX, `frame ${i} right column`).toBeLessThanOrEqual(CELL - 2);
    });
  });

  it('stands front-idle and turn on row 63 with the crown near y 15', () => {
    for (const i of [...tagFrameIndices('front-idle'), ...tagFrameIndices('turn')]) {
      expect(rowRuns(i, GROUND_ROW).length, `frame ${i} touches row 63`).toBeGreaterThan(0);
      const s = cellStats(i);
      expect(s.top, `frame ${i} crown row`).toBeGreaterThanOrEqual(13);
      expect(s.top, `frame ${i} crown row`).toBeLessThanOrEqual(17);
    }
  });

  it('centers the front-idle figure on x 32', () => {
    for (const i of tagFrameIndices('front-idle')) {
      const s = cellStats(i);
      expect(Math.abs((s.minX + s.maxX) / 2 - CENTER_X), `frame ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it('centers the hips on x 32 in front-idle and turn', () => {
    for (const i of [...tagFrameIndices('front-idle'), ...tagFrameIndices('turn')]) {
      const hips = runThrough(i, FRONT_HIP_ROW, CENTER_X);
      expect(hips, `frame ${i} has hips on row ${FRONT_HIP_ROW} at x 32`).toBeDefined();
      if (!hips) continue;
      expect(
        Math.abs((hips.from + hips.to) / 2 - CENTER_X),
        `frame ${i} hip run ${hips.from}..${hips.to}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the side-run pelvis on x 32', () => {
    for (const i of tagFrameIndices('side-run')) {
      const hipRow = cellStats(i).top + SIDE_HIP_BELOW_CROWN;
      const pelvis = runThrough(i, hipRow, CENTER_X);
      expect(pelvis, `frame ${i} has a pelvis on row ${hipRow} at x 32`).toBeDefined();
      if (!pelvis) continue;
      const span = `frame ${i} pelvis run ${pelvis.from}..${pelvis.to} on row ${hipRow}`;
      expect(pelvis.from, span).toBeGreaterThanOrEqual(27);
      expect(pelvis.to, span).toBeLessThanOrEqual(37);
      expect(Math.abs((pelvis.from + pelvis.to) / 2 - CENTER_X), span).toBeLessThanOrEqual(2);
    }
  });

  it('starts and ends side-run on a planted foot, so a run never cuts on a flight frame', () => {
    const run = tagFrameIndices('side-run');
    const first = run[0] ?? -1;
    const last = run[run.length - 1] ?? -1;
    expect(rowRuns(first, GROUND_ROW).length, `first side-run frame ${first}`).toBeGreaterThan(0);
    expect(rowRuns(last, GROUND_ROW).length, `last side-run frame ${last}`).toBeGreaterThan(0);
  });

  it(`moves the planted sole ${BELT_SHIFT_PX} px toward -x per frame, with fixed flight frames`, () => {
    const run = tagFrameIndices('side-run');
    const soles = run.map((i) => rowRuns(i, GROUND_ROW));
    const flight = soles.flatMap((runs, k) => (runs.length === 0 ? [k] : []));
    expect(flight, 'side-run offsets with row 63 empty').toEqual(FLIGHT_OFFSETS);
    for (const k of flight) {
      expect(rowRuns(run[k] ?? -1, GROUND_ROW - 1), `offset ${k} row 62`).toEqual([]);
    }

    // Walk the loop once from the first flight frame, wrapping at the seam, and
    // collect each stance: the consecutive frames that share one planted foot.
    const start = flight[0] ?? 0;
    const stances: Array<Array<{ k: number; sole: Run }>> = [];
    let stance: Array<{ k: number; sole: Run }> = [];
    for (let step = 1; step <= run.length; step++) {
      const k = (start + step) % run.length;
      const [sole, ...others] = soles[k] ?? [];
      if (!sole) {
        if (stance.length > 0) stances.push(stance);
        stance = [];
        continue;
      }
      expect(others, `offset ${k}: row 63 holds a single sole`).toEqual([]);
      stance.push({ k, sole });
    }
    if (stance.length > 0) stances.push(stance);

    expect(stances).toHaveLength(FLIGHT_OFFSETS.length);
    for (const frames of stances) {
      expect(frames.length, 'contact frames per stance').toBeGreaterThanOrEqual(2);
      for (let j = 1; j < frames.length; j++) {
        const prev = frames[j - 1];
        const cur = frames[j];
        if (!prev || !cur) continue;
        const pair = `offset ${prev.k} -> ${cur.k}`;
        expect(cur.sole.to - cur.sole.from, `${pair} sole width`).toBe(
          prev.sole.to - prev.sole.from,
        );
        expect(cur.sole.from - prev.sole.from, `${pair} sole shift`).toBe(-BELT_SHIFT_PX);
      }
    }
  });

  it('bobs side-run within the cell, with no repeated frame', () => {
    const stats = tagFrameIndices('side-run').map(cellStats);
    for (const s of stats) {
      expect(s.top).toBeGreaterThanOrEqual(11);
      expect(s.top).toBeLessThanOrEqual(18);
    }
    expect(new Set(stats.map((s) => s.pixels)).size).toBe(stats.length);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/body-art.test.ts`

Expected: FAIL, because nothing has been exported yet:
```
 FAIL  src/features/avatar/__tests__/body-art.test.ts > body sheet
Error: ENOENT: no such file or directory, open 'D:\Projects\Tracks\apps\web\src\assets\sprites\body.json'
 Test Files  1 failed (1)
      Tests  11 skipped (11)
```

- [ ] **Step 3: Preflight (checkout, palette, MCP)**

Run:
```bash
git rev-parse --show-toplevel
git branch --show-current
test -f art/palette.gpl && test ! -e art/avatar/body.aseprite && echo ready
mkdir -p art/avatar .superpowers/art-src/body .superpowers/art-previews
claude mcp get aseprite
```
Expected:
- `D:/Projects/Tracks`. If it prints another path, see the Paths note above.
- `feat/avatar-room`.
- `ready`. If `body.aseprite` already exists because an earlier run was interrupted, call `mcp__aseprite__get_sprite_info` on it and continue from the first step whose result is missing.
- The `aseprite` server entry, with a connected status.

The `mcp__aseprite__*` tools must be callable in this session. If any of them appear only as deferred names, load them with ToolSearch, `max_results` 20, query `select:mcp__aseprite__create_canvas,mcp__aseprite__run_lua_script,mcp__aseprite__rename_layer,mcp__aseprite__add_frames,mcp__aseprite__delete_frame,mcp__aseprite__set_frame_duration,mcp__aseprite__set_tag,mcp__aseprite__get_sprite_info,mcp__aseprite__export_frame,mcp__aseprite__export_tag`.

Do not use `+aseprite`. The server registers 116 tools, so a 50-result search can leave some of these out.

If the server is missing or not connected, stop and ask the user to finish spec §4 "MCP setup, one-time". Do not author the art any other way.

- [ ] **Step 4: Write the painter and dump scripts (scratch)**

Create `.superpowers/art-src/paint-body.lua`. It paints every frame of layer `body` from that frame's grid file, using this legend:
- `.` is transparent.
- `o` is the outline, palette.gpl's darkest fixed color.
- `L`, `B` and `S` are the PH skin light, base and shadow shades.

The painter writes every pixel at alpha 255. It rejects unknown characters and grids of the wrong size, leaves frames that have no grid untouched, and prints each frame's geometry.

```lua
-- Paints the "body" layer of every frame from .superpowers/art-src/body/fNN.txt.
-- Legend: . transparent, o outline (darkest fixed palette.gpl color),
-- L/B/S = PH skin light/base/shadow. Frames without a grid file are left as they are.
local ROOT = "D:/Projects/Tracks"
local GRID_DIR = ROOT .. "/.superpowers/art-src/body/"
local PALETTE_FILE = ROOT .. "/art/palette.gpl"
local LAYER_NAME = "body"
local SIZE = 64

local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if spr.colorMode ~= ColorMode.RGB then print("ERROR:Sprite must be RGB") return end
if spr.width ~= SIZE or spr.height ~= SIZE then print("ERROR:Sprite must be 64x64") return end

local layer = nil
for _, l in ipairs(spr.layers) do
  if l.name == LAYER_NAME then layer = l end
end
if not layer then print("ERROR:No layer named " .. LAYER_NAME) return end
if layer.isBackground or not layer.isVisible or layer.opacity ~= 255 or layer.blendMode ~= BlendMode.NORMAL then
  print("ERROR:Layer must be visible, non-background, opacity 255, Normal blend") return
end

local function key(r, g, b) return r * 65536 + g * 256 + b end
local SKIN = { L = { 255, 128, 255 }, B = { 255, 64, 255 }, S = { 255, 0, 255 } }
local PLACEHOLDERS = {
  [key(255, 128, 255)] = true, [key(255, 64, 255)] = true, [key(255, 0, 255)] = true,
  [key(128, 255, 255)] = true, [key(64, 255, 255)] = true, [key(0, 255, 255)] = true,
  [key(255, 255, 128)] = true, [key(255, 255, 64)] = true, [key(255, 255, 0)] = true,
}

local inPalette = {}
local outline = nil
local outlineLuma = math.huge
local pf = io.open(PALETTE_FILE, "r")
if not pf then print("ERROR:Cannot read " .. PALETTE_FILE) return end
for line in pf:lines() do
  local r, g, b = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)")
  if r then
    r, g, b = tonumber(r), tonumber(g), tonumber(b)
    inPalette[key(r, g, b)] = true
    local luma = 299 * r + 587 * g + 114 * b
    if not PLACEHOLDERS[key(r, g, b)] and luma < outlineLuma then
      outline = { r, g, b }
      outlineLuma = luma
    end
  end
end
pf:close()
if not outline then print("ERROR:palette.gpl has no fixed colors") return end
for ch, c in pairs(SKIN) do
  if not inPalette[key(c[1], c[2], c[3])] then print("ERROR:palette.gpl lacks PH skin " .. ch) return end
end

local legend = { o = outline, L = SKIN.L, B = SKIN.B, S = SKIN.S }
local pixel = {}
for ch, c in pairs(legend) do pixel[ch] = app.pixelColor.rgba(c[1], c[2], c[3], 255) end
print(string.format("outline=#%02x%02x%02x", outline[1], outline[2], outline[3]))

local function readGrid(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local rows = {}
  for line in f:lines() do
    line = line:gsub("\r$", "")
    if #line > 0 then rows[#rows + 1] = line end
  end
  f:close()
  return rows
end

local painted, missing = 0, 0
local failure = nil
app.transaction(function()
  for i, frame in ipairs(spr.frames) do
    local name = string.format("f%02d.txt", i)
    local rows = readGrid(GRID_DIR .. name)
    if not rows then
      missing = missing + 1
      print(name .. " missing (frame left unchanged)")
    else
      if #rows ~= SIZE then failure = name .. " has " .. #rows .. " rows, expected 64" return end
      local img = Image(SIZE, SIZE, ColorMode.RGB)
      local top, minX, maxX, opaque = SIZE, SIZE, -1, 0
      local soleFrom, soleTo = nil, nil
      for y = 0, SIZE - 1 do
        local row = rows[y + 1]
        if #row ~= SIZE then failure = name .. " row " .. y .. " has " .. #row .. " chars, expected 64" return end
        for x = 0, SIZE - 1 do
          local ch = row:sub(x + 1, x + 1)
          if ch ~= "." then
            local px = pixel[ch]
            if not px then failure = name .. " row " .. y .. " col " .. x .. " has unknown char '" .. ch .. "'" return end
            img:putPixel(x, y, px)
            opaque = opaque + 1
            if y < top then top = y end
            if x < minX then minX = x end
            if x > maxX then maxX = x end
            if y == SIZE - 1 then
              if not soleFrom then soleFrom = x end
              soleTo = x
            end
          end
        end
      end
      local cel = layer:cel(frame)
      if cel then
        cel.image = img
        cel.position = Point(0, 0)
      else
        cel = spr:newCel(layer, frame, img, Point(0, 0))
      end
      cel.opacity = 255
      painted = painted + 1
      local sole = "none"
      if soleFrom then sole = soleFrom .. ".." .. soleTo end
      print(string.format("%s opaque=%d top=%d x=%d..%d center=%.1f row63=%s",
        name, opaque, top, minX, maxX, (minX + maxX) / 2, sole))
    end
  end
end)
if failure then print("ERROR:" .. failure) return end
spr:saveAs(spr.filename)
print(string.format("OK painted=%d missing=%d", painted, missing))
```

Create `.superpowers/art-src/dump-body.lua`. It makes the grids match the source exactly:
- A frame with pixels gets its grid (a verified round-trip).
- An empty frame gets no grid, so the painter's "missing" lines stay true and a later Write never meets a blank placeholder file.
- Grids numbered past the last frame are deleted.

Run it after every GUI edit and after every frame insert or delete.

```lua
-- Rewrites .superpowers/art-src/body/fNN.txt from the "body" layer so the grids mirror
-- the source: every frame with pixels gets its grid, an empty frame gets none, and
-- grids numbered past the last frame are deleted. Run it after every GUI edit and
-- after every frame insert or delete.
local ROOT = "D:/Projects/Tracks"
local GRID_DIR = ROOT .. "/.superpowers/art-src/body/"
local PALETTE_FILE = ROOT .. "/art/palette.gpl"
local LAYER_NAME = "body"
local SIZE = 64

local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
local layer = nil
for _, l in ipairs(spr.layers) do
  if l.name == LAYER_NAME then layer = l end
end
if not layer then print("ERROR:No layer named " .. LAYER_NAME) return end

local function key(r, g, b) return r * 65536 + g * 256 + b end
local PLACEHOLDERS = {
  [key(255, 128, 255)] = true, [key(255, 64, 255)] = true, [key(255, 0, 255)] = true,
  [key(128, 255, 255)] = true, [key(64, 255, 255)] = true, [key(0, 255, 255)] = true,
  [key(255, 255, 128)] = true, [key(255, 255, 64)] = true, [key(255, 255, 0)] = true,
}
local outline, outlineLuma = nil, math.huge
local pf = io.open(PALETTE_FILE, "r")
if not pf then print("ERROR:Cannot read " .. PALETTE_FILE) return end
for line in pf:lines() do
  local r, g, b = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)")
  if r then
    r, g, b = tonumber(r), tonumber(g), tonumber(b)
    local luma = 299 * r + 587 * g + 114 * b
    if not PLACEHOLDERS[key(r, g, b)] and luma < outlineLuma then
      outline, outlineLuma = key(r, g, b), luma
    end
  end
end
pf:close()
if not outline then print("ERROR:palette.gpl has no fixed colors") return end
local char = { [outline] = "o", [key(255, 128, 255)] = "L", [key(255, 64, 255)] = "B", [key(255, 0, 255)] = "S" }

local pc = app.pixelColor
local dumped, empty = 0, 0
for i, frame in ipairs(spr.frames) do
  local cel = layer:cel(frame)
  local rows, opaque = {}, 0
  for y = 0, SIZE - 1 do
    local row = {}
    for x = 0, SIZE - 1 do
      local ch = "."
      if cel then
        local lx, ly = x - cel.position.x, y - cel.position.y
        if lx >= 0 and ly >= 0 and lx < cel.image.width and ly < cel.image.height then
          local px = cel.image:getPixel(lx, ly)
          local a = pc.rgbaA(px)
          if a == 255 then
            ch = char[key(pc.rgbaR(px), pc.rgbaG(px), pc.rgbaB(px))]
            if not ch then
              print(string.format("ERROR:frame %d pixel (%d, %d) is not outline or PH skin", i, x, y)) return
            end
            opaque = opaque + 1
          elseif a ~= 0 then
            print(string.format("ERROR:frame %d pixel (%d, %d) has alpha %d", i, x, y, a)) return
          end
        end
      end
      row[#row + 1] = ch
    end
    rows[#rows + 1] = table.concat(row)
  end
  local path = GRID_DIR .. string.format("f%02d.txt", i)
  if opaque == 0 then
    os.remove(path)
    empty = empty + 1
  else
    local f = io.open(path, "wb")
    if not f then print("ERROR:Cannot write " .. path) return end
    f:write(table.concat(rows, "\n"), "\n")
    f:close()
    dumped = dumped + 1
  end
end
for i = #spr.frames + 1, 99 do
  os.remove(GRID_DIR .. string.format("f%02d.txt", i))
end
print(string.format("OK dumped=%d empty=%d", dumped, empty))
```

- [ ] **Step 5: Write the idle-derivation, palette-swatch and onion-review scripts (scratch)**

Create `.superpowers/art-src/derive-idle.mjs`. It derives the breathing and blink frames f02–f06 from the rest pose f01. Its constants describe f01, so a change to f01's proportions only means editing those constants.

```js
// Derives the front-idle frames f02-f06 from the rest pose f01.
// Run from the repo root: node .superpowers/art-src/derive-idle.mjs
// The constants below describe f01. If f01's neck, chest or eyes move, update them first.
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = '.superpowers/art-src/body/';
const NECK_ROW = 28; // dropped in the rise pose, so shoulders, chest and arms move up 1 px
const CHEST_LAST_ROW = 37; // last row that moves up; it repeats once to close the gap
const EYE_XS = [29, 35]; // eye columns in f01
const EYE_TOP_ROW = 22; // f01's eyes are 1x2, on rows EYE_TOP_ROW and EYE_TOP_ROW + 1

const rest = readFileSync(`${DIR}f01.txt`, 'utf8').split(/\r?\n/).filter((row) => row.length > 0);
if (rest.length !== 64 || rest.some((row) => row.length !== 64)) {
  throw new Error('f01.txt must be 64 rows of 64 characters');
}
const crown = rest.findIndex((row) => /[^.]/.test(row));
if (crown < 1 || crown >= NECK_ROW) throw new Error(`f01 crown row ${crown} must be above NECK_ROW`);
for (const x of EYE_XS) {
  for (const y of [EYE_TOP_ROW, EYE_TOP_ROW + 1]) {
    if (rest[y][x] !== 'o') throw new Error(`f01 has no eye pixel at (${x}, ${y}); update EYE_XS/EYE_TOP_ROW`);
  }
}

// rise: rows NECK_ROW+1..CHEST_LAST_ROW move up 1 px (a small shrug); CHEST_LAST_ROW repeats.
const rise = [
  ...rest.slice(0, NECK_ROW),
  ...rest.slice(NECK_ROW + 1, CHEST_LAST_ROW + 1),
  rest[CHEST_LAST_ROW],
  ...rest.slice(CHEST_LAST_ROW + 1),
];
// top: the head and everything down to CHEST_LAST_ROW move up 1 px. The empty row above
// the crown drops out and CHEST_LAST_ROW repeats.
const top = [
  ...rest.slice(0, crown - 1),
  ...rest.slice(crown, CHEST_LAST_ROW + 1),
  rest[CHEST_LAST_ROW],
  ...rest.slice(CHEST_LAST_ROW + 1),
];

function put(rows, y, x, ch) {
  const row = rows[y];
  rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
}

// blink: the top pose with each eye closed to a 2-px lash line on its lower row,
// extended toward the face's center.
const blink = [...top];
for (const x of EYE_XS) {
  const inward = x < 32 ? 1 : -1;
  put(blink, EYE_TOP_ROW - 1, x, 'B');
  put(blink, EYE_TOP_ROW, x, 'o');
  put(blink, EYE_TOP_ROW, x + inward, 'o');
}

const frames = { 'f02.txt': rise, 'f03.txt': top, 'f04.txt': blink, 'f05.txt': top, 'f06.txt': rise };
for (const [name, rows] of Object.entries(frames)) {
  if (rows.length !== 64) throw new Error(`${name} has ${rows.length} rows`);
  writeFileSync(`${DIR}${name}`, `${rows.join('\n')}\n`);
  console.log(`wrote ${DIR}${name}`);
}
```

Create `.superpowers/art-src/palette-swatch.lua`. It renders the palette for Checkpoint A:

```lua
-- Renders art/palette.gpl as 32 px swatches, 8 per row, for the palette checkpoint.
local ROOT = "D:/Projects/Tracks"
local colors = {}
local pf = io.open(ROOT .. "/art/palette.gpl", "r")
if not pf then print("ERROR:Cannot read palette.gpl") return end
for line in pf:lines() do
  local r, g, b = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)")
  if r then colors[#colors + 1] = app.pixelColor.rgba(tonumber(r), tonumber(g), tonumber(b), 255) end
end
pf:close()
local COLS, SW = 8, 32
local rowsN = math.ceil(#colors / COLS)
local img = Image(COLS * SW, rowsN * SW, ColorMode.RGB)
for i, px in ipairs(colors) do
  local cx, cy = ((i - 1) % COLS) * SW, ((i - 1) // COLS) * SW
  for y = cy, cy + SW - 1 do
    for x = cx, cx + SW - 1 do img:putPixel(x, y, px) end
  end
end
img:saveAs(ROOT .. "/.superpowers/art-previews/palette.png")
print("OK colors=" .. #colors)
```

Create `.superpowers/art-src/onion-review.lua`. It renders the motion-review onion skins, using the sprite's own tags. Unlike `render_onion_skin`, it wraps at the side-run loop seam, so frame 8 is ghosted with 15 and 9 rather than with the turn frame. It also renders the two view transitions:

```lua
-- Onion-skin previews for the motion review, built from the sprite's own tags:
--   body-onion-fNN.png       side-run frame NN over the previous and next frame of the
--                            side-run loop (wrapping at the seam, unlike render_onion_skin)
--   body-transition-in.png   the turn frame over the last front-idle and first side-run frames
--   body-transition-out.png  the turn frame over the last side-run and first front-idle frames
local ROOT = "D:/Projects/Tracks"
local OUT_DIR = ROOT .. "/.superpowers/art-previews/"
local LAYER_NAME = "body"
local SCALE = 8
local GHOST_OPACITY = 100

local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
local layer = nil
for _, l in ipairs(spr.layers) do
  if l.name == LAYER_NAME then layer = l end
end
if not layer then print("ERROR:No layer named " .. LAYER_NAME) return end

local tags = {}
for _, t in ipairs(spr.tags) do
  tags[t.name] = { from = t.fromFrame.frameNumber, to = t.toFrame.frameNumber }
end
for _, name in ipairs({ "front-idle", "turn", "side-run" }) do
  if not tags[name] then print("ERROR:No tag named " .. name) return end
end

local function frameImage(i)
  local img = Image(spr.width, spr.height, ColorMode.RGB)
  local cel = layer:cel(spr.frames[i])
  if cel then img:drawImage(cel.image, cel.position) end
  return img
end

local white = app.pixelColor.rgba(255, 255, 255, 255)
local function render(main, ghosts, name)
  local comp = Image(spr.width, spr.height, ColorMode.RGB)
  for y = 0, comp.height - 1 do
    for x = 0, comp.width - 1 do comp:putPixel(x, y, white) end
  end
  for _, g in ipairs(ghosts) do
    comp:drawImage(frameImage(g), Point(0, 0), GHOST_OPACITY, BlendMode.NORMAL)
  end
  comp:drawImage(frameImage(main), Point(0, 0), 255, BlendMode.NORMAL)
  local big = Image(comp.width * SCALE, comp.height * SCALE, ColorMode.RGB)
  for y = 0, comp.height - 1 do
    for x = 0, comp.width - 1 do
      local v = comp:getPixel(x, y)
      for oy = 0, SCALE - 1 do
        for ox = 0, SCALE - 1 do big:putPixel(x * SCALE + ox, y * SCALE + oy, v) end
      end
    end
  end
  big:saveAs(OUT_DIR .. name)
  print(string.format("%s: frame %d over %d and %d", name, main, ghosts[1], ghosts[2]))
end

local run = tags["side-run"]
local n = run.to - run.from + 1
for k = 0, n - 1 do
  local prev = run.from + (k - 1) % n
  local nxt = run.from + (k + 1) % n
  render(run.from + k, { prev, nxt }, string.format("body-onion-f%02d.png", run.from + k))
end
local turn, idle = tags["turn"].from, tags["front-idle"]
render(turn, { idle.to, run.from }, "body-transition-in.png")
render(turn, { run.to, idle.from }, "body-transition-out.png")
print("OK onion=" .. (n + 2))
```

Run: `git status --porcelain .superpowers`. Expected: no output, because the folder is gitignored.

- [ ] **Step 6: Create the sprite through the MCP**

GUI rule: every MCP call reads `body.aseprite` from disk and saves it back. From this step on, check before each MCP edit that the user does not have `art/avatar/body.aseprite` open in Aseprite. If they say it is open, or you are unsure, ask them to save and close it first.

Make these calls in this order:
1. Call `mcp__aseprite__create_canvas` with `{"width": 64, "height": 64, "filename": "D:/Projects/Tracks/art/avatar/body.aseprite"}`.
   - Expected: `Canvas created successfully: D:/Projects/Tracks/art/avatar/body.aseprite`.
   - The canvas is RGB, with one transparent non-background layer `Layer 1` and one 100 ms frame.
2. Call `mcp__aseprite__run_lua_script` with `"filename": "D:/Projects/Tracks/art/avatar/body.aseprite"` and this `"script"`:
   ```lua
   local spr = app.activeSprite
   spr:setPalette(Palette{ fromFile = "D:/Projects/Tracks/art/palette.gpl" })
   spr:saveAs(spr.filename)
   print("OK colors=" .. #spr.palettes[1])
   ```
   Expected: `OK colors=<number of color rows in art/palette.gpl>`.
3. Call `mcp__aseprite__rename_layer` with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "layer_name": "Layer 1", "new_name": "body"}`. Expected: `Layer 'Layer 1' renamed to 'body' in D:/Projects/Tracks/art/avatar/body.aseprite`.
4. Call `mcp__aseprite__add_frames` with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "count": 14}`. Expected: `Added 14 frames to D:/Projects/Tracks/art/avatar/body.aseprite`. The sprite now has 15 empty frames.

- [ ] **Step 7: Set durations and tags, then verify**

Call `mcp__aseprite__set_frame_duration` 15 times, each with `"filename": "D:/Projects/Tracks/art/avatar/body.aseprite"`. Use these `(frame_index, duration_ms)` pairs: (1, 700), (2, 200), (3, 450), (4, 120), (5, 330), (6, 200), (7, 150), (8, 90), (9, 90), (10, 90), (11, 90), (12, 90), (13, 90), (14, 90), (15, 90).

Each call should return `Frame <n> duration set to <ms>ms in D:/Projects/Tracks/art/avatar/body.aseprite`.

Then call `mcp__aseprite__set_tag` three times, with the same filename and `"direction": "forward"`. MCP frames are 1-based, while the exported JSON will be 0-based:
- `{"name": "front-idle", "from_frame": 1, "to_frame": 6}`
- `{"name": "turn", "from_frame": 7, "to_frame": 7}`
- `{"name": "side-run", "from_frame": 8, "to_frame": 15}`

Then call `mcp__aseprite__get_sprite_info` with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite"}`. The expected output, exactly:
```
{"width":64,"height":64,"color_mode":"rgb","frames":15,"durations_ms":[700,200,450,120,330,200,150,90,90,90,90,90,90,90,90],"layers":[{"name":"body","visible":true,"opacity":255,"is_group":false,"parent":null}],"tags":[{"name":"front-idle","from":1,"to":6,"direction":"forward"},{"name":"turn","from":7,"to":7,"direction":"forward"},{"name":"side-run","from":8,"to":15,"direction":"forward"}]}
```

Why these timings:
- **front-idle** loops in 2000 ms: rest 700, rise 200, top 450, blink 120, top 330, fall 200. That gives one blink per loop, at the top of the breath.
  - The loop length divides 8000 ms, so the behavior loop's idles (4000–8000 ms, rounded up to whole loops) last 6 s or 8 s and never run past the spec's 4–8 s.
  - A 3000 ms loop would give 6 s or 9 s.
- **turn** holds for 150 ms.
- **side-run** is 8 × 90 ms = 720 ms per stride pair, about 167 steps per minute.

- [ ] **Step 8: Write the rest pose f01 and derive f02–f06**

Create `.superpowers/art-src/body/f01.txt` with exactly these 64 lines of 64 characters. It has already been rendered and checked:
- About 49 px from sole to crown: the crown is at row 15 and the soles on row 63.
- Symmetric about column 32, with a bounding box of x 20–44. From row 47 down there is a 1-px gap between the legs at x 32.
- Row 46 is the hip-check row. The hip run is x 26–38, with a 1-px gap to each hand.
- Light from the upper left: L on the left edge of each part, S on the right.
- The eyes are 1×2 at x 29 and 35, rows 22–23. The mouth is S at x 31–33, row 25.
- There are no eyebrows, because brows are drawn in the hair files.

```text
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
................................................................
..............................ooooo.............................
............................ooLBBBSoo...........................
...........................oLBBBBBBBSo..........................
...........................oLBBBBBBBSo..........................
...........................oLBBBBBBBSo..........................
...........................oLBBBBBBBSo..........................
..........................oLBBBBBBBBBSo.........................
..........................oLBoBBBBBoBSo.........................
..........................oLBoBBBBBoBSo.........................
...........................oLBBBBBBBSo..........................
...........................oLBBSSSBBSo..........................
............................oLBBBSSSo...........................
.............................ooooooo............................
..............................oSSSo.............................
...........................oooLSSSSooo..........................
.......................ooooLBBBBBBBBBSoooo......................
......................oLBBBBBBBBBBBBBBBBBSo.....................
.....................oLBSoLBBBBBBBBBBBSoLBSo....................
.....................oLBSoLBBBBBBBBBBBSoLBSo....................
.....................oLBSoLBBBBBBBBBBBSoLBSo....................
.....................oLBSoLBBBBBBBBBBBSoLBSo....................
.....................oLBSoLBBBBBBBBBBBSoLBSo....................
.....................oLBSoLBBBBBBBBBBBSoLBSo....................
.....................oLBSooLBBBBBBBBBSooLBSo....................
....................oLBSo..oLBBBBBBBSo..oLBSo...................
....................oLBSo..oLBBBBBBBSo..oLBSo...................
....................oLBSo..oLBBBBBBBSo..oLBSo...................
....................oLBSo..oLBBBBBBBSo..oLBSo...................
....................oLBSo.oLBBBBBBBBBSo.oLBSo...................
....................oLBSo.oLBBBBBBBBBSo.oLBSo...................
....................oLBSo.oLBBBBBBBBBSo.oLBSo...................
....................oLBSo.oLBBBBBBBBBSo.oLBSo...................
....................oLBSo.oLBBBSoLBBBSo.oLBSo...................
.....................ooo..oLBBSo.oLBBSo..ooo....................
..........................oLBBSo.oLBBSo.........................
..........................oLBBSo.oLBBSo.........................
..........................oLBBSo.oLBBSo.........................
..........................oLBBSo.oLBBSo.........................
...........................oLBSo.oLBSo..........................
...........................oLBSo.oLBSo..........................
..........................oLBBSo.oLBBSo.........................
..........................oLBBSo.oLBBSo.........................
...........................oLBSo.oLBSo..........................
...........................oLBSo.oLBSo..........................
...........................oLBSo.oLBSo..........................
...........................oLBSo.oLBSo..........................
..........................oLBBSo.oLBBSo.........................
.........................oLBBBSo.oLBBBSo........................
.........................ooooooo.ooooooo........................
```

Run: `node .superpowers/art-src/derive-idle.mjs`

Expected: five lines, `wrote .superpowers/art-src/body/f02.txt` … `f06.txt`. The derived frames are:
- **f02 rise:** shoulders, chest and arms up 1 px, with the neck absorbed (a small shrug).
- **f03 top:** the whole upper body up 1 px, with the crown at row 14.
- **f04 blink:** the top pose with the eyes closed, drawn as 2-px lash lines on row 22.
- **f05:** the same as top.
- **f06:** the same as rise.

The hips and legs (rows 38 and below) do not move.

- [ ] **Step 9: Paint and preview front-idle**

Call `mcp__aseprite__run_lua_script` with `"filename": "D:/Projects/Tracks/art/avatar/body.aseprite"` and `"script": "dofile(\"D:/Projects/Tracks/.superpowers/art-src/paint-body.lua\")"`. Later steps call this the **paint call**.

Expected output:
```
outline=#<the outline color from palette.gpl>
f01.txt opaque=741 top=15 x=20..44 center=32.0 row63=25..39
f02.txt opaque=759 top=15 x=20..44 center=32.0 row63=25..39
f03.txt opaque=764 top=14 x=20..44 center=32.0 row63=25..39
f04.txt opaque=764 top=14 x=20..44 center=32.0 row63=25..39
f05.txt opaque=764 top=14 x=20..44 center=32.0 row63=25..39
f06.txt opaque=759 top=15 x=20..44 center=32.0 row63=25..39
f07.txt missing (frame left unchanged)
…
f15.txt missing (frame left unchanged)
OK painted=6 missing=9
```
If `outline=` is not the color Task 14 intended as the outline (the `outline` entry in `art/palette.gpl`), stop and ask the user.

Then:
- Call `mcp__aseprite__export_frame` with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "frame_index": 1, "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/body-f01.png", "scale": 8}`.
- Call it again with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "frame_index": 4, "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/body-f04.png", "scale": 8}`.
- Read both PNGs. Check that the figure is centered, the blink is legible and nothing is clipped.

- [ ] **Step 10: Draw the turn frame f07**

Write `.superpowers/art-src/body/f07.txt` with the Write tool: 64 rows of 64 characters, legend `. o L B S`, shaded like f01.

The pose is ¾ front-right in a neutral "ready" stance, crown at row 15, bob 0. It is played in both directions, so it must read as halfway between f01 and side-run frame 15 (contact-near) and also as a start for frame 8 (down-near).
- **Head:** rows 15–27, with the skull at x 27–37 as in f01 and the face turned toward +x.
  - Near eye 1×2 at x 31 and far eye 1×2 at x 35, both on rows 22–23.
  - A 1-px nose bump on the right outline at (38, 24).
  - A 2-px mouth in S at x 34–35, row 25.
  - Only the near ear shows: a bump on the left side at x 26–27, rows 21–23.
- **Neck:** rows 28–29, x 31–35.
- **Torso:**
  - shoulders: row 30, x 25–38
  - chest: rows 31–37, x 26–38
  - waist: rows 38–42, x 27–37
  - hips: rows 43–47, x 27–37, with column 32 inside
  - The far (right) half of the chest is 1–2 px narrower than the near half and mostly S.
- **Near arm** (screen-left, the character's right): hangs at x 22–25, with the elbow bent slightly forward at ≈(24, 39). The hand is 3×3 at x 23–25, rows 45–47. Column 26 stays empty on rows 45–47, so the hand is 1 px clear of the hips.
- **Far arm:** mostly hidden behind the torso. It shows as a 2-px S strip at x 39–40, rows 32–42, with the hand at x 38–40 on **rows 43–45 only**.
- **Hip-check row 46:** the hips must be one run at x 27–37, centered on 32, with empty pixels on both sides. `body-art.test.ts` checks this.
- **Legs:** the near leg at x 27–31 and the far leg at x 33–37, with a gap at column 32 below row 48. Both soles sit on row 63. The feet turn toward +x (heel left, toe right): near sole x 26–32, far sole x 33–39.

Make the paint call (Step 9). Expected:
- the line `f07.txt opaque=… top=15 … row63=26..39`, give or take 1 px;
- `OK painted=7 missing=8`.

Then call `mcp__aseprite__export_frame` with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "frame_index": 7, "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/body-f07.png", "scale": 8}` and Read the PNG.

- [ ] **Step 11: Draw the key side-run pose f15 (contact-near)**

These side-view rules apply to every frame from f08 to f15. Coordinates are absolute cell pixels, with the bob included.
- **Facing and bob:** the figure faces +x (right), so the near limbs are the character's right ones. The bob is the crown-row offset. It moves the whole figure except the planted foot, and the knee absorbs it.
- **Head:** rows 15–27 plus the bob. The back of the skull is at x 28 and the face at x 38.
  - A nose bump at (39, 23).
  - An eye 1×2 at x 36, rows 22–23.
  - An ear arc at x 31–32, rows 21–23.
  - The mouth in S at (37, 25).
- **Neck:** rows 28–29, x 32–35.
- **Torso:** leans 1 px forward.
  - shoulders: row 30, x 29–37
  - chest: rows 31–37, x 29–37
  - waist: rows 38–42, x 29–35
  - pelvis: rows 43–47, x 28–36
  - The hip joint is at (32, 45 + bob), on the hip column x 32. The near shoulder joint is at (33, 32 + bob).
- **Hip-check row (45 + bob):** the run through x 32 is the pelvis. It must stay within x 27–37 and be centered within ±2 of x 32, so keep hands, forearms and the far arm off that row outside the pelvis. `body-art.test.ts` checks this.
- **Limb lengths:**
  - Upper arm ≈7 px, forearm ≈6 px, hand 3×3.
  - Thigh ≈9 px, shin ≈9 px.
  - Foot 6 px from heel to toe, and 3 rows tall including the sole outline.
- **Depth:**
  1. Draw the far arm and far leg first, behind everything, mostly in S plus outline.
  2. Then draw the torso.
  3. Then draw the near leg and near arm on top, with normal L/B/S.

  Occlusion is drawn, not computed: where the near arm crosses the torso, it overdraws it.
- **Soles:**
  - A planted sole is 6 px wide and flat on row 63. It moves exactly −4 px per frame, which is the belt speed.
  - In a flight frame, rows 62–63 are empty.
  - Both rules are checked by `body-art.test.ts`.

Write `.superpowers/art-src/body/f15.txt` as contact-near, the last frame of the loop:
- Bob 0, crown at row 15.
- Near leg forward, knee ≈(36, 54), sole flat on row 63 at **x 35–40**.
- Far leg behind, knee ≈(29, 53), foot kicked up behind: ankle ≈(22, 55), foot ≈x 18–23 on rows 55–58.
- Near arm back: elbow ≈(28, 37), hand ≈(29, 42).
- Far arm forward: elbow ≈(36, 37), hand ≈(39, 33).

Make the paint call (Step 9). Expected:
- the line `f15.txt opaque=… top=15 … row63=35..40`;
- `OK painted=8 missing=7`, with f08–f14 missing.

Then call `mcp__aseprite__export_frame` with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "frame_index": 15, "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/body-f15.png", "scale": 8}` and Read the PNG.

- [ ] **Step 12: Checkpoint A (palette and body)**

1. Call `mcp__aseprite__run_lua_script` with no filename and `"script": "dofile(\"D:/Projects/Tracks/.superpowers/art-src/palette-swatch.lua\")"`. Expected: `OK colors=<palette.gpl row count>`.
2. Load `SendUserFile` with ToolSearch query `select:SendUserFile`, max_results 1. Send these four files:
   - `D:/Projects/Tracks/.superpowers/art-previews/palette.png`
   - `D:/Projects/Tracks/.superpowers/art-previews/body-f01.png`
   - `D:/Projects/Tracks/.superpowers/art-previews/body-f07.png`
   - `D:/Projects/Tracks/.superpowers/art-previews/body-f15.png`
3. In the message:
   - Say that these are the palette and the base body, shown in the magenta placeholder skin that is swapped at runtime.
   - Name the three views: front rest, ¾ turn and side heel-strike.
   - Ask the user to approve the palette, the proportions and the style before the run cycle is drawn.
4. **Wait for the user's answer**, then apply any changes they ask for:
   - **Pixel changes:** edit the grids and repaint with the paint call. Read a grid before you rewrite it.
   - **f01 changed (by grid edit or by GUI edit plus dump):** f02–f06 must follow it.
     1. Update the `NECK_ROW`, `CHEST_LAST_ROW`, `EYE_XS` and `EYE_TOP_ROW` constants in `derive-idle.mjs` if the neck, chest or eyes moved.
     2. Run `node .superpowers/art-src/derive-idle.mjs`.
     3. Make the paint call.
     4. Re-export the Step 9 previews `body-f01.png` and `body-f04.png`.

     Skip the re-derive only if the user edited frames 2–6 themselves in the GUI. In that case keep their frames and ask before overwriting.
   - **Color changes:** edit `art/palette.gpl`, re-run the palette script from Step 6 call 2, make the paint call, and commit `art/palette.gpl` with this task.
   - **Edits in the Aseprite GUI:**
     1. The user opens the file, edits it, then **saves and closes** it.
     2. Before any further grid edit or paint call, call `mcp__aseprite__run_lua_script` with `"filename": "D:/Projects/Tracks/art/avatar/body.aseprite"` and `"script": "dofile(\"D:/Projects/Tracks/.superpowers/art-src/dump-body.lua\")"`. Later steps call this the **dump call**. Expected: `OK dumped=8 empty=7` (grids f01–f07 and f15). The grids now match the user's edit.
     3. If the dump reports a pixel that is not outline or PH skin, ask the user to repaint that pixel with an allowed color.
     4. Never run an MCP edit while the user has the file open.
5. Do not continue until the user approves.

- [ ] **Step 13: Draw side-run f08–f14**

Write each grid with the Write tool. These grids do not exist yet, because the dump never writes a grid for an empty frame. Follow the Step 11 rules:
- Keep the head and torso drawing identical from frame to frame, apart from the bob.
- Use the near and far roles in the table below.
- Joint positions marked ≈ are artistic targets.
- The bold sole spans are the plan. Exact requirements:
  - the −4 px shift and the 6-px sole width inside each stance (frames 15 → 8 → 9 and 11 → 12 → 13);
  - empty rows 62–63 in frames 10 and 14;
  - a planted foot in frames 8 and 15.

`body-art.test.ts` checks these, and the treadmill belt shifts by the same 4 px per frame.

| MCP frame (JSON index, offset) | Pose | Bob → crown row | Near leg | Far leg | Near arm (elbow → hand) | Far arm |
|---|---|---|---|---|---|---|
| 8 (7, 0) | down-near | +1 → 16 | planted, knee most bent ≈(36,55), sole **x 31–36** | swinging through, knee ≈(31,53), foot under hip ≈x 24–29 rows 55–58 | back, settling ≈(28,38) → (30,43) | forward, settling ≈(36,38) → (39,34) |
| 9 (8, 1) | pass-near | 0 → 15 | planted under/behind hip, knee ≈(33,54), sole **x 27–32** | knee forward-high ≈(36,51), foot tucked ≈x 30–35 rows 54–57 | passing at the side ≈(32,39) → (37,38) | passing, hidden behind torso |
| 10 (9, 2) | flight-1 | −1 → 14 | extended back pushing off, toe down, lowest pixel row 61 ≈x 22–27, **rows 62–63 empty** | forward, thigh near horizontal, knee ≈(39,48), foot ≈x 38–43 rows 56–58 | forward ≈(36,36) → (39,32) | back ≈(28,36) → (29,41) |
| 11 (10, 3) | contact-far | 0 → 15 | behind, knee ≈(29,53), foot kicked up ≈x 18–23 rows 55–58 | forward, knee ≈(36,54), sole **x 35–40** | forward ≈(36,37) → (39,33) | back ≈(28,37) → (29,42) |
| 12 (11, 4) | down-far | +1 → 16 | swinging through, knee ≈(31,53), foot under hip ≈x 24–29 rows 55–58 | planted, knee most bent ≈(36,55), sole **x 31–36** | forward, settling ≈(36,38) → (39,34) | back, settling ≈(28,38) → (30,43) |
| 13 (12, 5) | pass-far | 0 → 15 | knee forward-high ≈(36,51), foot tucked ≈x 30–35 rows 54–57; the near thigh overdraws the far leg | planted under/behind hip, knee ≈(33,54), sole **x 27–32** | passing, crosses in front of the torso ≈(32,39) → (37,38) | passing, hidden behind torso |
| 14 (13, 6) | flight-2 | −1 → 14 | forward, thigh near horizontal, knee ≈(39,48), foot ≈x 38–43 rows 56–58 | extended back pushing off, lowest pixel row 61 ≈x 22–27, **rows 62–63 empty** | back ≈(28,36) → (29,41) | forward ≈(36,36) → (39,32) |
| 15 (14, 7) | contact-near (Step 11) | 0 → 15 | forward, knee ≈(36,54), sole **x 35–40** | behind, knee ≈(29,53), foot kicked up ≈x 18–23 rows 55–58 | back ≈(28,37) → (29,42) | forward ≈(36,37) → (39,33) |

The near foot's stance runs across the loop seam: 15 → 8 → 9. Entering from `turn` lands on a planted, bent knee (frame 8). Leaving to `turn` happens from the heel-strike (frame 15).

Make the paint call (Step 9). Expected:
- `OK painted=15 missing=0`.
- Row 63 per frame:
  - f08 `row63=31..36`
  - f09 `row63=27..32`
  - f10 `row63=none`
  - f11 `row63=35..40`
  - f12 `row63=31..36`
  - f13 `row63=27..32`
  - f14 `row63=none`
  - f15 `row63=35..40`
- Top rows of 16, 15, 14, 15, 16, 15, 14, 15 for f08–f15. A difference of ±1 is acceptable for the lean.

Fix any grid that disagrees (Read it first, then rewrite it) and repaint.

- [ ] **Step 14: Motion review (self-check before the user sees it)**

1. Call `mcp__aseprite__run_lua_script` with `"filename": "D:/Projects/Tracks/art/avatar/body.aseprite"` and `"script": "dofile(\"D:/Projects/Tracks/.superpowers/art-src/onion-review.lua\")"`. Later steps call this the **onion call**. Expected:
   ```
   body-onion-f08.png: frame 8 over 15 and 9
   body-onion-f09.png: frame 9 over 8 and 10
   body-onion-f10.png: frame 10 over 9 and 11
   body-onion-f11.png: frame 11 over 10 and 12
   body-onion-f12.png: frame 12 over 11 and 13
   body-onion-f13.png: frame 13 over 12 and 14
   body-onion-f14.png: frame 14 over 13 and 15
   body-onion-f15.png: frame 15 over 14 and 8
   body-transition-in.png: frame 7 over 6 and 8
   body-transition-out.png: frame 7 over 15 and 1
   OK onion=10
   ```
2. Call `mcp__aseprite__export_tag` with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "tag_name": "side-run", "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/body-side-run.gif", "scale": 8}`.
3. Read the eight `D:/Projects/Tracks/.superpowers/art-previews/body-onion-fNN.png` files. Check each of these, including across the loop seam (f08 shows f15 as a ghost, and f15 shows f08):
   - Knees, feet and hands travel on smooth arcs.
   - The head moves at most 1 px between neighboring frames.
   - Within each stance, the planted foot moves exactly 4 px backward per frame and keeps the same sole shape.
   - The far limbs read as behind.
   - No pixel touches row 0 or the cell's left or right edge.
4. Read `D:/Projects/Tracks/.superpowers/art-previews/body-transition-in.png` and `D:/Projects/Tracks/.superpowers/art-previews/body-transition-out.png`. The hips, head and feet of the turn frame should sit between their ghosts, with no sideways jump.
5. Fix the grids and repaint, then repeat the onion call, until all of these hold.

- [ ] **Step 15: Export**

Run: `pnpm art:export`

Expected: exit code 0, with `art/avatar/body.aseprite` processed. Then run:
```bash
ls apps/web/src/assets/sprites
node -e "const j=require('./apps/web/src/assets/sprites/body.json');console.log(j.frames.length, j.frames.map(f=>f.duration).join(','), JSON.stringify(j.meta.frameTags.map(t=>[t.name,t.from,t.to,t.direction])))"
```
Expected: `ls` prints `body.json  body.png`, and the `node` line prints:
```
15 700,200,450,120,330,200,150,90,90,90,90,90,90,90,90 [["front-idle",0,5,"forward"],["turn",6,6,"forward"],["side-run",7,14,"forward"]]
```

- [ ] **Step 16: Run the body test and the art check**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/body-art.test.ts`
Expected: PASS, `Tests  11 passed (11)`.

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts`
Expected: PASS. For the body sheet, it checks:
- the 64×64 frames with an empty row 0;
- the tags, including the single-frame `turn`;
- alpha 0/255 and palette-only colors;
- that only the PH skin placeholders appear.

Failure messages identify frames in one of two ways:
- "frame i" is the 0-based JSON index, which is grid `f(i+1)`.
- "offset k" is a side-run offset, which is grid `f(8+k)`.

Fix that grid, repaint (paint call), and re-run Steps 15–16.

- [ ] **Step 17: Checkpoint B (animations)**

1. Call `mcp__aseprite__export_tag` three times, each with `"filename": "D:/Projects/Tracks/art/avatar/body.aseprite"` and `"scale": 8`:
   - `"tag_name": "front-idle"`, `"output_filename": "D:/Projects/Tracks/.superpowers/art-previews/body-front-idle.gif"`
   - `"tag_name": "turn"`, `"output_filename": "D:/Projects/Tracks/.superpowers/art-previews/body-turn.gif"`
   - `"tag_name": "side-run"`, `"output_filename": "D:/Projects/Tracks/.superpowers/art-previews/body-side-run.gif"`
2. Make the onion call (Step 14) so the transition previews are current.
3. With `SendUserFile`, send:
   - `D:/Projects/Tracks/.superpowers/art-previews/body-front-idle.gif`
   - `D:/Projects/Tracks/.superpowers/art-previews/body-turn.gif`
   - `D:/Projects/Tracks/.superpowers/art-previews/body-side-run.gif`
   - `D:/Projects/Tracks/.superpowers/art-previews/body-transition-in.png`
   - `D:/Projects/Tracks/.superpowers/art-previews/body-transition-out.png`
4. In the message, give these timings for approval:
   - front-idle: 6 frames in a 2.0 s loop, with one blink. Room idles last 6 s or 8 s, because they end on whole loops of the spec's 4–8 s.
   - turn: 1 frame, 150 ms.
   - side-run: 8 frames × 90 ms. Runs last about 8.6–15.1 s, also on whole loops. The run starts on a planted, bent-knee frame and ends on a heel-strike, so it never ends mid-air. The planted foot moves 4 px per frame, and that sets the treadmill belt speed.
   - The transition images show idle → turn → run and run → turn → idle overlaid, so any sideways jump between views would be visible.
5. **Wait for approval.** Apply changes as below, re-run Steps 15–16, and resend.
   - **Pose changes:** edit the grids (Read each one first) and repaint.
   - **Timing changes:** use `mcp__aseprite__set_frame_duration`.
     - The front-idle loop must stay at 2000 or 4000 ms: 2–4 s, and dividing 8000 ms.
     - Then update the numbers in Interfaces → Produces, Steps 7 and 15, and the Step 19 commit message.
   - **Frame-count changes:**
     1. Agree on the new frame table with the user first. Idle has 4–6 frames, run has 6–10, and the first and last run frames must be planted.
     2. Delete a frame with `mcp__aseprite__delete_frame`.
     3. Insert an empty frame before frame n with `mcp__aseprite__run_lua_script`, the body filename, and `"script": "local spr = app.activeSprite\nspr:newEmptyFrame(n)\nspr:saveAs(spr.filename)\nprint(\"OK frames=\" .. #spr.frames)"`, writing the number for n. Do not use `add_frames` for this, because it only appends copies at the end. A new frame takes the previous frame's duration and widens any tag it lands inside.
     4. **Immediately afterwards**, before any grid edit or paint call, make the dump call. It renumbers the grids to the new frame positions and deletes any grid past the last frame. Expected: `OK dumped=<frames with pixels> empty=<new empty frames>`.
     5. Set all three tags again with `mcp__aseprite__set_tag`, and every duration with `mcp__aseprite__set_frame_duration`. Check the result with `mcp__aseprite__get_sprite_info`.
     6. Update every hard-coded expectation:
        - Interfaces → Produces (tag ranges, durations, side-run order and belt hand-off);
        - the Step 7 durations and the `get_sprite_info` line;
        - the Step 15 JSON line;
        - `FLIGHT_OFFSETS` (and `BELT_SHIFT_PX`, if the travel changes) in `body-art.test.ts`;
        - the Step 19 commit message.
     7. `derive-idle.mjs` writes f02–f06 only. If the idle count changed, edit its `frames` map before running it again.
   - **GUI edits:** apply the Step 12 GUI rule (save and close, then the dump call). The expected result is now `OK dumped=15 empty=0`.
6. Do not start Task 16 until the user has approved both checkpoints.

- [ ] **Step 18: Full verification**

Run:
```bash
pnpm --filter @tracks/web test
pnpm --filter @tracks/web typecheck
pnpm --filter @tracks/web lint
git status --porcelain --untracked-files=all
```
Expected:
- All tests pass, typecheck and lint exit 0, and the output has no warnings.
- `git status` shows exactly the lines below. It also shows ` M art/palette.gpl` if the palette changed at Checkpoint A.
```
?? apps/web/src/assets/sprites/body.json
?? apps/web/src/assets/sprites/body.png
?? apps/web/src/features/avatar/__tests__/body-art.test.ts
?? art/avatar/body.aseprite
```

- [ ] **Step 19: Commit**

Add `art/palette.gpl` to the `git add` line only if it changed. If the user approved different timings or counts at Checkpoint B, replace the numbers in the message with the final `get_sprite_info` values.

```bash
git add art/avatar/body.aseprite apps/web/src/assets/sprites/body.png apps/web/src/assets/sprites/body.json apps/web/src/features/avatar/__tests__/body-art.test.ts
git commit -F - <<'EOF'
Draw the body sprite: front-idle, turn and side-run

art/avatar/body.aseprite is the timing reference for every avatar
layer; its export is committed. 64x64 cells, crown at y 15, anchor
(32, 63), hips on column 32 in every view, skin in the PH skin ramp.

- front-idle: 6 frames (rest, rise, top, blink, top, fall), 2000 ms
  loop, so whole-loop idles last 6 or 8 s
- turn: 1 frame, 3/4 front-right, 150 ms
- side-run: 8 frames x 90 ms (720 ms loop), from down-near to
  contact-near so a run never ends mid-air; flight at offsets 2 and 6;
  the planted foot moves 4 px toward -x per frame, so the treadmill
  belt shifts 4 px per frame (32 px per loop)

body-art.test.ts checks the spec's scale, hip column, timing and
belt hand-off rules on the export.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 20: Check that the export is reproducible**

Run: `pnpm art:export && git status --porcelain art apps/web/src/assets/sprites`

Expected: no output (spec "Done when" 3). If any files differ:
1. Inspect the diff with `git diff --stat`.
2. Find out why the export is not deterministic, and fix that before moving on.

---

### Task 16: Art: hair styles (short, curly, ponytail)

**Files:**
- Create: `art/avatar/hair-short.aseprite`, `art/avatar/hair-curly.aseprite`, `art/avatar/hair-ponytail.aseprite`
- Create (written by `pnpm art:export`, committed): `apps/web/src/assets/sprites/hair-short.png`, `apps/web/src/assets/sprites/hair-short.json`, `apps/web/src/assets/sprites/hair-curly.png`, `apps/web/src/assets/sprites/hair-curly.json`, `apps/web/src/assets/sprites/hair-ponytail.png`, `apps/web/src/assets/sprites/hair-ponytail.json`
- Test (run only, not edited): `apps/web/src/features/avatar/__tests__/art.test.ts`
- Scratch (under `.superpowers/`, gitignored, never committed): `.superpowers/art-previews/hair/lua/convert.lua`, `.superpowers/art-previews/hair/lua/dump.lua`, `.superpowers/art-previews/hair/lua/offsets.lua`, `.superpowers/art-previews/hair/lua/paint.lua`, `.superpowers/art-previews/hair/lua/check.lua`, `.superpowers/art-previews/hair/lua/occlusion.lua`, `.superpowers/art-previews/hair/lua/near-arm.lua` (written in Step 30), `.superpowers/art-previews/hair/preview-ramps.mjs`, `.superpowers/art-previews/hair/body-notes.txt`, and the preview `.aseprite` copies and PNGs in `.superpowers/art-previews/hair/`

**Interfaces:**
- Consumes:
  - `art/avatar/body.aseprite` and `apps/web/src/assets/sprites/body.json` (Task 15). Body is the timing reference: 64×64 cell, anchor (32, 63), tags `front-idle`, `turn` (1 frame) and `side-run`, all `forward`.
  - `PLACEHOLDER_RAMPS.hair` = `[0x80FFFF, 0x40FFFF, 0x00FFFF]` from `apps/web/src/features/avatar/palette.ts`. `SKIN_RAMPS["tone-3"]` and `HAIR_RAMPS["dark-brown"]` are used for previews only.
  - The sheet names `hair-short`, `hair-curly` and `hair-ponytail` in `HAIR_STYLE_OPTIONS` (`catalog.ts`).
  - The root script `art:export`, and `art.test.ts`, which validates every exported sheet.
- Produces:
  - The exported sheets for `SheetId` `"hair-short"`, `"hair-curly"` and `"hair-ponytail"`. `SHEETS` in `sheets.ts` picks them up through its eager glob, and `getSheet(id)` reads them.
  - `drawList(appearance, tag, frameOffset)` uses them as the hair layer, with the swap `buildSwap(PLACEHOLDER_RAMPS.hair, HAIR_RAMPS[appearance.hair_color])`.
  - Each sheet has 64×64 frames. Its frame count, `frames[].duration` and `meta.frameTags` (name, from, to, direction) are identical to `body.json`.
  - Each sheet uses only the PH hair ramp plus the body's outline color. No opaque pixel is on row 0 or in columns 0 and 63.
  - Each source has a hidden, locked `ref-body` layer plus the visible layer `hair`. The ponytail file also has a visible `ponytail` layer under `hair`. That layer passes `occlusion.lua` (spec §4 rule 6) in every frame.
  - Task 19's catalog-coverage assertion depends on these three sheets.

**Conventions for this task:**
- **MCP tool names:** the tools belong to the `aseprite` server and are called `mcp__aseprite__<tool>`. Arguments are shown as JSON.
- **Paths:** every path is absolute, with forward slashes, under `D:/Projects/Tracks`. If `git rev-parse --show-toplevel` prints a different root, use that root in every path, including the `dofile(...)` lines.
- **Frame numbering:** MCP frame numbers (`set_tag`, `export_frame`'s `frame_index`, `copy_cel`) are 1-based. Exported JSON `from`/`to` values are 0-based.
- **Left and right:** these always mean screen directions, left = −x and right = +x. They never mean the figure's own left and right.
- **Running helper scripts:** helpers run through `mcp__aseprite__run_lua_script`. Its `script` sets globals, then calls `dofile(...)`. Each call is a fresh Aseprite process, so globals do not carry over between calls. A run succeeded only when its output ends with a line starting `OK`. A run that prints an `ERROR:` line saved nothing.
- **Named values:** these are recorded in Step 2.
  - `N`, `IDLE_FROM`, `IDLE_TO`, `TURN`, `RUN_FROM` and `RUN_TO`
  - `IDLE_COUNT` and `RUN_COUNT`
  - `SCALE_IDLE` and `SCALE_RUN`
- **Grids:** a `ROWS` grid is the hair drawing itself. Write each grid against the dump of the frame it is for, following the drawing rules below.

**Drawing rules (every hair frame):**
1. **Characters.** `paint.lua` accepts five grid characters:
   - `.` is transparent.
   - `O` is the body's outline color, which `paint.lua` reads from `ref-body`.
   - `L`, `B` and `S` are PH hair `#80FFFF`, `#40FFFF` and `#00FFFF`.

   No other color goes on a hair layer. `check.lua` and `art.test` enforce this.
2. **Edges.** Where hair meets empty space, the edge is `O`. Where hair meets skin (fringe bottom, hairline, sideburns), the edge is `S` with no outline, so the face is not boxed in.
3. **Light direction.** Light comes from the side where the body's head shows `1` (PH skin light) in the dump.
   - Put `L` on that side and on top of each mass.
   - Put `S` on the opposite side and under each mass.
   - Use `B` everywhere else.
4. **Eyebrows.** Eyebrows are drawn in the hair files, as `S` in the row directly above the eye pixels.
   - Front view: 2 px over each eye.
   - Turn: 2 px over the near eye and 1 px over the far eye.
     - The near eye is the full-width eye nearer the head's center. On screen it is left (−x) of the far eye.
     - The far eye is the narrower one near the face's right (+x) edge.
   - Side: 2 px over the eye.
   - Brows do not change in blink frames.
   - Apart from the brows, hair never covers the eye pixels, the brow row, or any face feature recorded in `body-notes.txt` (mouth, nose, cheeks).
5. **Headroom and margins.**
   - The topmost hair pixel is no higher than crown row − 4.
   - Every hair pixel stays inside x 1..62, y 1..63, so row 0 and columns 0 and 63 stay empty. `paint.lua` refuses pixels outside that box and `check.lua` reports them.
6. **Occlusion (spec §4 rule 6).** Hair is drawn last, so it covers everything under it. Leave a pixel transparent wherever a nearer body part covers the hair:
   - **Front and turn views.** Hair that hangs behind the head (back volume, ponytail) shows only outside the head/neck silhouette and above the shoulder line. The shoulder line is the first row where the body is wider than the neck.
   - **Side-run.** The ponytail stays 1 px clear of the near arm, which is the arm drawn over the torso.
   - **Ponytail enforcement.** `occlusion.lua` enforces both rules for the `ponytail` layer in every frame:
     - In front-idle and turn frames, no tail pixel may sit on a body pixel.
     - In side-run frames, no tail pixel may sit on or next to the near-arm rectangles recorded in `near-arm.lua`.
7. **Reuse.** If a frame's head only moved, reuse the key frame's cel shifted by the Step 6 offset (`copy_cel` + `offset_cel_positions`). If a frame's head changed shape, meaning mismatches outside the eye pixels, give it its own grid.

- [ ] **Step 1: Preflight**

```bash
git rev-parse --show-toplevel
git rev-parse --abbrev-ref HEAD
git status --porcelain
ls art/avatar/body.aseprite apps/web/src/assets/sprites/body.png apps/web/src/assets/sprites/body.json
ls art/avatar/hair-*.aseprite
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
mkdir -p .superpowers/art-previews/hair/lua
```

Expected, in order:
- `D:/Projects/Tracks`
- `feat/avatar-room`
- No output from `git status --porcelain`.
- The three body paths listed.
- `ls: cannot access 'art/avatar/hair-*.aseprite': No such file or directory`
- The art test passes with `Test Files  1 passed (1)`.

If any `hair-*.aseprite` already exists, stop and report it. It is earlier work and must not be overwritten.

- [ ] **Step 2: Record body's timing**

Call `mcp__aseprite__get_sprite_info` with:

```json
{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite"}
```

Expected: JSON with `"width":64,"height":64,"color_mode":"rgb"`, and `tags` naming `front-idle`, `turn` and `side-run`, each with `"direction":"forward"`. The `turn` tag's `from` equals its `to`. Then:

```bash
node -e "const j=JSON.parse(require('node:fs').readFileSync('apps/web/src/assets/sprites/body.json','utf8'));console.log(j.frames.length, j.frames.map(f=>f.duration).join(','));console.log(JSON.stringify(j.meta.frameTags.map(t=>[t.name,t.from,t.to,t.direction])))"
```

Expected: the same frame count and the same durations. Each JSON `from`/`to` is the MCP value minus 1.

Record these values from `get_sprite_info`:
- `N` = `frames`
- `IDLE_FROM` / `IDLE_TO` = the `front-idle` from/to
- `TURN` = the `turn` from
- `RUN_FROM` / `RUN_TO` = the `side-run` from/to
- `IDLE_COUNT` = `IDLE_TO − IDLE_FROM + 1`
- `RUN_COUNT` = `RUN_TO − RUN_FROM + 1`
- `SCALE_IDLE` = `min(8, floor(24 / IDLE_COUNT))`
- `SCALE_RUN` = `min(8, floor(24 / RUN_COUNT))`

The two scales keep each per-tag review sheet at most 1536 px wide (24 × 64), below the Read tool's downscale threshold of about 1568 px. If either scale is below 2 (a tag of 13 or more frames), that tag's review uses `export_frame` at `"scale": 8` for each frame instead of a sheet.

- [ ] **Step 3: Write the helper scripts (Write tool)**

All seven files go under `.superpowers/` (gitignored). Each was verified on Aseprite 1.3.18.6. Write the files with the Write tool, not a shell heredoc, so the backslashes in `preview-ramps.mjs` survive.

`D:/Projects/Tracks/.superpowers/art-previews/hair/lua/convert.lua`:

```lua
-- Turns a fresh copy of body.aseprite into a hair source: one hidden, locked
-- "ref-body" layer holding the visible body composite of every frame, plus an
-- empty visible "hair" layer. Frames, durations and tags are left untouched.
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if spr.width ~= 64 or spr.height ~= 64 then print("ERROR:expected a 64x64 sprite") return end
if spr.colorMode ~= ColorMode.RGB then print("ERROR:sprite must be in RGB color mode") return end
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" or layer.name == "hair" then
    print("ERROR:already converted (found layer " .. layer.name .. ")") return
  end
end

local function drawVisible(layers, frame, img)
  for _, layer in ipairs(layers) do
    if layer.isVisible then
      if layer.isGroup then
        drawVisible(layer.layers, frame, img)
      else
        local cel = layer:cel(frame)
        if cel then img:drawImage(cel.image, cel.position) end
      end
    end
  end
end

local composites = {}
for i, frame in ipairs(spr.frames) do
  local img = Image(spr.width, spr.height, ColorMode.RGB)
  drawVisible(spr.layers, frame, img)
  composites[i] = img
end

local old = {}
for _, layer in ipairs(spr.layers) do old[#old + 1] = layer end

app.transaction(function()
  local ref = spr:newLayer()
  ref.name = "ref-body"
  for i, frame in ipairs(spr.frames) do
    spr:newCel(ref, frame, composites[i], Point(0, 0))
  end
  for _, layer in ipairs(old) do spr:deleteLayer(layer) end
  ref.isVisible = false
  ref.isEditable = false
  local hair = spr:newLayer()
  hair.name = "hair"
end)

spr:saveAs(spr.filename)
local names = {}
for _, layer in ipairs(spr.layers) do
  names[#names + 1] = layer.name .. (layer.isVisible and "(visible)" or "(hidden)")
end
print("OK layers=" .. table.concat(names, ",") .. " frames=" .. #spr.frames .. " tags=" .. #spr.tags)
```

`D:/Projects/Tracks/.superpowers/art-previews/hair/lua/dump.lua`:

```lua
-- Prints frame FRAME as a 64x64 character grid: ref-body underneath, every
-- other layer on top (hidden or not). Digits and lowercase letters are body
-- pixels; uppercase letters are pixels on a hair layer.
if type(FRAME) ~= "number" then print("ERROR:set FRAME before dofile") return end
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if FRAME < 1 or FRAME > #spr.frames then print("ERROR:FRAME out of range") return end
local frame = spr.frames[FRAME]
local pc = app.pixelColor
local ref = nil
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" then ref = layer end
end
if not ref then print("ERROR:no ref-body layer") return end

local FIXED = {
  ["#ff80ff"] = "1", ["#ff40ff"] = "2", ["#ff00ff"] = "3",
  ["#ffff80"] = "4", ["#ffff40"] = "5", ["#ffff00"] = "6",
  ["#80ffff"] = "L", ["#40ffff"] = "B", ["#00ffff"] = "S",
}
local POOL = "acdefghijkmnopqrtuvwxyz"
local letters, order = {}, {}
local function letterFor(hex)
  if not letters[hex] then
    local n = #order + 1
    if n > #POOL then return "?" end
    letters[hex] = POOL:sub(n, n)
    order[n] = hex
  end
  return letters[hex]
end

local grid = {}
for y = 0, 63 do
  grid[y] = {}
  for x = 0, 63 do grid[y][x] = "." end
end

local function paintLayer(layer, isHair)
  local cel = layer:cel(frame)
  if not cel then return end
  local img, ox, oy = cel.image, cel.position.x, cel.position.y
  for py = 0, img.height - 1 do
    for px = 0, img.width - 1 do
      local v = img:getPixel(px, py)
      local x, y = px + ox, py + oy
      if pc.rgbaA(v) > 0 and x >= 0 and x < 64 and y >= 0 and y < 64 then
        local hex = string.format("#%02x%02x%02x", pc.rgbaR(v), pc.rgbaG(v), pc.rgbaB(v))
        local ch = FIXED[hex]
        if not ch then
          ch = letterFor(hex)
          if isHair then ch = ch:upper() end
        end
        if pc.rgbaA(v) < 255 then ch = "%" end
        grid[y][x] = ch
      end
    end
  end
end

paintLayer(ref, false)
for _, layer in ipairs(spr.layers) do
  if layer.name ~= "ref-body" and not layer.isGroup then paintLayer(layer, true) end
end

local tagNames = {}
for _, t in ipairs(spr.tags) do
  if FRAME >= t.fromFrame.frameNumber and FRAME <= t.toFrame.frameNumber then
    tagNames[#tagNames + 1] = t.name
  end
end
print(string.format("frame %d  duration %d ms  tag %s", FRAME,
  math.floor(frame.duration * 1000 + 0.5), table.concat(tagNames, ",")))
local tens, ones = {}, {}
for x = 0, 63 do
  tens[#tens + 1] = tostring(math.floor(x / 10))
  ones[#ones + 1] = tostring(x % 10)
end
print("    " .. table.concat(tens))
print("    " .. table.concat(ones))
for y = 0, 63 do
  local row = {}
  for x = 0, 63 do row[#row + 1] = grid[y][x] end
  print(string.format("%3d %s", y, table.concat(row)))
end
local legend = { ". transparent", "1 2 3 PH skin light/base/shadow", "L B S PH hair light/base/shadow",
  "4 5 6 PH cloth (must not appear)", "% partial alpha (must not appear)" }
for _, hex in ipairs(order) do
  legend[#legend + 1] = letters[hex] .. " = " .. hex .. " on ref-body, " .. letters[hex]:upper() .. " = same color on a hair layer"
end
print("legend: " .. table.concat(legend, " | "))
```

`D:/Projects/Tracks/.superpowers/art-previews/hair/lua/offsets.lua`:

```lua
-- For frames FIRST..LAST, finds the (dx, dy) in -3..3 that best maps the head
-- of reference frame REF (12 rows from its crown) onto that frame's ref-body.
-- 0 mismatches means the head only moved, so REF's hair can be reused shifted.
if type(REF) ~= "number" or type(FIRST) ~= "number" or type(LAST) ~= "number" then
  print("ERROR:set REF, FIRST and LAST before dofile") return
end
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if REF < 1 or REF > #spr.frames or FIRST < 1 or LAST > #spr.frames or FIRST > LAST then
  print("ERROR:frame numbers out of range") return
end
local ref = nil
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" then ref = layer end
end
if not ref then print("ERROR:no ref-body layer") return end
local pc = app.pixelColor

local function frameImage(i)
  local img = Image(64, 64, ColorMode.RGB)
  local cel = ref:cel(spr.frames[i])
  if cel then img:drawImage(cel.image, cel.position) end
  return img
end

local function px(img, x, y)
  if x < 0 or y < 0 or x > 63 or y > 63 then return 0 end
  local v = img:getPixel(x, y)
  if pc.rgbaA(v) == 0 then return 0 end
  return v
end

local function crownRow(img)
  for y = 0, 63 do
    for x = 0, 63 do
      if px(img, x, y) ~= 0 then return y end
    end
  end
  return nil
end

local HEAD_ROWS = 12
local base = frameImage(REF)
local crown = crownRow(base)
if not crown then print("ERROR:reference frame is empty") return end
print(string.format("reference frame %d: crown row %d, head rows %d..%d", REF, crown, crown, crown + HEAD_ROWS - 1))
for i = FIRST, LAST do
  local img = frameImage(i)
  local best = { dx = 0, dy = 0, miss = math.huge }
  for dy = -3, 3 do
    for dx = -3, 3 do
      local miss = 0
      for y = crown, crown + HEAD_ROWS - 1 do
        for x = 0, 63 do
          if px(base, x, y) ~= px(img, x + dx, y + dy) then miss = miss + 1 end
        end
      end
      if miss < best.miss or (miss == best.miss and math.abs(dx) + math.abs(dy) < math.abs(best.dx) + math.abs(best.dy)) then
        best = { dx = dx, dy = dy, miss = miss }
      end
    end
  end
  local where = {}
  if best.miss > 0 and best.miss <= 12 then
    for y = crown, crown + HEAD_ROWS - 1 do
      for x = 0, 63 do
        if px(base, x, y) ~= px(img, x + best.dx, y + best.dy) then
          where[#where + 1] = string.format("(%d,%d)", x + best.dx, y + best.dy)
        end
      end
    end
  end
  print(string.format("frame %d: crown row %s, head offset dx=%d dy=%d vs frame %d, mismatched head pixels %d%s",
    i, tostring(crownRow(img)), best.dx, best.dy, REF, best.miss,
    #where > 0 and (" at " .. table.concat(where, " ")) or ""))
end
```

`D:/Projects/Tracks/.superpowers/art-previews/hair/lua/paint.lua`:

```lua
-- Replaces layer LAYER's cel in frame FRAME with the grid ROWS, whose first
-- character lands on (OX, OY). Characters: "." transparent, "O" the body's
-- outline color, "L" "B" "S" the PH hair light/base/shadow. Every pixel must
-- land inside x 1..62, y 1..63: row 0 and columns 0 and 63 stay empty.
if type(LAYER) ~= "string" or type(FRAME) ~= "number" or type(OX) ~= "number"
  or type(OY) ~= "number" or type(ROWS) ~= "table" then
  print("ERROR:set LAYER, FRAME, OX, OY and ROWS before dofile") return
end
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if FRAME < 1 or FRAME > #spr.frames then print("ERROR:FRAME out of range") return end
if LAYER == "ref-body" then print("ERROR:never paint on ref-body") return end
local target, ref = nil, nil
for _, layer in ipairs(spr.layers) do
  if layer.name == LAYER then target = layer end
  if layer.name == "ref-body" then ref = layer end
end
if not target then print("ERROR:layer " .. LAYER .. " not found") return end
if not ref then print("ERROR:no ref-body layer") return end
local pc = app.pixelColor

-- The outline is the body's: the topmost opaque pixel of column 32 in ref-body frame 1.
local refCel = ref:cel(spr.frames[1])
if not refCel then print("ERROR:ref-body frame 1 is empty") return end
local refImg = Image(64, 64, ColorMode.RGB)
refImg:drawImage(refCel.image, refCel.position)
local outline = nil
for y = 0, 63 do
  local v = refImg:getPixel(32, y)
  if pc.rgbaA(v) == 255 then outline = v break end
end
if not outline then print("ERROR:no opaque pixel in column 32 of ref-body frame 1") return end
local outlineHex = string.format("#%02x%02x%02x", pc.rgbaR(outline), pc.rgbaG(outline), pc.rgbaB(outline))
local PLACEHOLDERS = { "#ff80ff", "#ff40ff", "#ff00ff", "#80ffff", "#40ffff", "#00ffff", "#ffff80", "#ffff40", "#ffff00" }
for _, hex in ipairs(PLACEHOLDERS) do
  if hex == outlineHex then print("ERROR:detected outline " .. outlineHex .. " is a placeholder") return end
end

local COLORS = {
  O = pc.rgba(pc.rgbaR(outline), pc.rgbaG(outline), pc.rgbaB(outline), 255),
  L = pc.rgba(0x80, 0xff, 0xff, 255),
  B = pc.rgba(0x40, 0xff, 0xff, 255),
  S = pc.rgba(0x00, 0xff, 0xff, 255),
}

local img = Image(64, 64, ColorMode.RGB)
local count, minX, minY, maxX, maxY = 0, 64, 64, -1, -1
for r, row in ipairs(ROWS) do
  for c = 1, #row do
    local ch = row:sub(c, c)
    if ch ~= "." then
      local color = COLORS[ch]
      if not color then print("ERROR:unknown char '" .. ch .. "' in row " .. r) return end
      local x, y = OX + c - 1, OY + r - 1
      if x < 1 or x > 62 or y < 1 or y > 63 then
        print(string.format("ERROR:pixel (%d,%d) is outside x 1..62, y 1..63", x, y)) return
      end
      img:drawPixel(x, y, color)
      count = count + 1
      if x < minX then minX = x end
      if y < minY then minY = y end
      if x > maxX then maxX = x end
      if y > maxY then maxY = y end
    end
  end
end

app.transaction(function()
  local old = target:cel(spr.frames[FRAME])
  if old then spr:deleteCel(old) end
  spr:newCel(target, spr.frames[FRAME], img, Point(0, 0))
end)
spr:saveAs(spr.filename)
if count == 0 then
  print(string.format("OK %s frame %d cleared (0 pixels), outline %s", LAYER, FRAME, outlineHex))
else
  print(string.format("OK %s frame %d: %d pixels, bounds x %d..%d y %d..%d, outline %s",
    LAYER, FRAME, count, minX, maxX, minY, maxY, outlineHex))
end
```

`D:/Projects/Tracks/.superpowers/art-previews/hair/lua/check.lua`:

```lua
-- Read-only source check of a hair file against BODY (path to body.aseprite):
-- same frame count, durations and tags; ref-body hidden; every other layer
-- visible, Normal, 100% opacity; hair pixels only O/L/B/S at alpha 255; no
-- pixel on row 0 or in columns 0 and 63; every frame has at least one PH
-- hair pixel.
if type(BODY) ~= "string" then print("ERROR:set BODY before dofile") return end
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
local pc = app.pixelColor
local problems = {}
local function problem(msg) problems[#problems + 1] = msg end

local body = app.open(BODY)
if not body then print("ERROR:could not open " .. BODY) return end
if #body.frames ~= #spr.frames then
  problem(string.format("frame count %d, body has %d", #spr.frames, #body.frames))
else
  for i = 1, #spr.frames do
    local a = math.floor(spr.frames[i].duration * 1000 + 0.5)
    local b = math.floor(body.frames[i].duration * 1000 + 0.5)
    if a ~= b then problem(string.format("frame %d duration %d ms, body has %d ms", i, a, b)) end
  end
end
local function tagList(s)
  local out = {}
  for _, t in ipairs(s.tags) do
    out[#out + 1] = string.format("%s:%d-%d:%s", t.name, t.fromFrame.frameNumber, t.toFrame.frameNumber, tostring(t.aniDir))
  end
  return table.concat(out, " ")
end
local hairTags, bodyTags = tagList(spr), tagList(body)
if hairTags ~= bodyTags then problem("tags [" .. hairTags .. "] differ from body [" .. bodyTags .. "]") end
body:close()
app.activeSprite = spr

local ref, outline = nil, nil
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" then ref = layer end
end
if not ref then
  problem("no ref-body layer")
else
  if ref.isVisible then problem("ref-body is visible") end
  local cel = ref:cel(spr.frames[1])
  if cel then
    local img = Image(64, 64, ColorMode.RGB)
    img:drawImage(cel.image, cel.position)
    for y = 0, 63 do
      local v = img:getPixel(32, y)
      if pc.rgbaA(v) == 255 then
        outline = string.format("#%02x%02x%02x", pc.rgbaR(v), pc.rgbaG(v), pc.rgbaB(v))
        break
      end
    end
  end
end
local allowed = { ["#80ffff"] = true, ["#40ffff"] = true, ["#00ffff"] = true }
if outline then allowed[outline] = true end

local hairFrames = {}
for _, layer in ipairs(spr.layers) do
  if layer.name ~= "ref-body" then
    if layer.isGroup then problem("layer " .. layer.name .. " is a group") end
    if not layer.isVisible then problem("layer " .. layer.name .. " is hidden") end
    if layer.opacity ~= 255 then problem("layer " .. layer.name .. " opacity " .. layer.opacity) end
    if layer.blendMode ~= BlendMode.NORMAL then problem("layer " .. layer.name .. " blend mode is not Normal") end
    for fi, frame in ipairs(spr.frames) do
      local cel = layer:cel(frame)
      if cel then
        if cel.opacity ~= 255 then problem(string.format("%s frame %d cel opacity %d", layer.name, fi, cel.opacity)) end
        local img, ox, oy = cel.image, cel.position.x, cel.position.y
        for py = 0, img.height - 1 do
          for px = 0, img.width - 1 do
            local v = img:getPixel(px, py)
            local a = pc.rgbaA(v)
            if a > 0 then
              local x, y = px + ox, py + oy
              local hex = string.format("#%02x%02x%02x", pc.rgbaR(v), pc.rgbaG(v), pc.rgbaB(v))
              if a ~= 255 then problem(string.format("%s frame %d (%d,%d) alpha %d", layer.name, fi, x, y, a)) end
              if not allowed[hex] then problem(string.format("%s frame %d (%d,%d) color %s", layer.name, fi, x, y, hex)) end
              if x < 1 or x > 62 or y < 1 or y > 63 then
                problem(string.format("%s frame %d pixel (%d,%d) is outside x 1..62, y 1..63", layer.name, fi, x, y))
              end
              if hex ~= outline then hairFrames[fi] = true end
            end
          end
        end
      end
    end
  end
end
for fi = 1, #spr.frames do
  if not hairFrames[fi] then problem(string.format("frame %d has no PH hair pixel", fi)) end
end

if #problems == 0 then
  print(string.format("OK %d frames, tags %s, outline %s", #spr.frames, hairTags, tostring(outline)))
else
  for _, p in ipairs(problems) do print("PROBLEM:" .. p) end
  print(string.format("FAILED %d problem(s)", #problems))
end
```

`D:/Projects/Tracks/.superpowers/art-previews/hair/lua/occlusion.lua`:

```lua
-- Read-only spec §4 rule 6 check of the "ponytail" layer, frames FIRST..LAST
-- (default: every frame).
--   front-idle and turn frames: no ponytail pixel may sit on an opaque
--   ref-body pixel, because the tail hangs behind the head, neck and shoulders.
--   side-run frames: no ponytail pixel may sit on, or touch (8 neighbours), a
--   near-arm rectangle listed in NEAR_ARM[frame] = { {x1, y1, x2, y2}, ... }.
--   Every side-run frame in range needs a NEAR_ARM entry, and every rectangle
--   must cover at least one ref-body pixel.
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
local first, last = FIRST or 1, LAST or #spr.frames
if type(first) ~= "number" or type(last) ~= "number" or first < 1 or last > #spr.frames or first > last then
  print("ERROR:FIRST/LAST out of range") return
end
local arms = NEAR_ARM or {}
if type(arms) ~= "table" then print("ERROR:NEAR_ARM must be a table") return end
local ref, tail = nil, nil
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" then ref = layer end
  if layer.name == "ponytail" then tail = layer end
end
if not ref then print("ERROR:no ref-body layer") return end
if not tail then print("ERROR:no ponytail layer") return end
local pc = app.pixelColor

local function tagOf(fi)
  for _, t in ipairs(spr.tags) do
    if fi >= t.fromFrame.frameNumber and fi <= t.toFrame.frameNumber then return t.name end
  end
  return nil
end

local function layerImage(layer, frame)
  local img = Image(64, 64, ColorMode.RGB)
  local cel = layer:cel(frame)
  if cel then img:drawImage(cel.image, cel.position) end
  return img
end

local function opaque(img, x, y)
  return pc.rgbaA(img:getPixel(x, y)) > 0
end

local function listed(coords)
  local shown = {}
  for i = 1, math.min(#coords, 8) do shown[i] = coords[i] end
  local more = #coords > 8 and string.format(" and %d more", #coords - 8) or ""
  return table.concat(shown, " ") .. more
end

local problems = {}
local function problem(msg) problems[#problems + 1] = msg end
local runFrames = 0

for fi = first, last do
  local frame = spr.frames[fi]
  local tag = tagOf(fi)
  local body = layerImage(ref, frame)
  local pony = layerImage(tail, frame)
  if tag == "front-idle" or tag == "turn" then
    local hits = {}
    for y = 0, 63 do
      for x = 0, 63 do
        if opaque(pony, x, y) and opaque(body, x, y) then
          hits[#hits + 1] = string.format("(%d,%d)", x, y)
        end
      end
    end
    if #hits > 0 then
      problem(string.format("frame %d (%s): %d ponytail pixel(s) on the body at %s", fi, tag, #hits, listed(hits)))
    end
  elseif tag == "side-run" then
    runFrames = runFrames + 1
    local rects = arms[fi]
    if type(rects) ~= "table" or #rects == 0 then
      problem(string.format("frame %d (side-run): no NEAR_ARM entry", fi))
    else
      local valid = true
      for k, r in ipairs(rects) do
        if type(r) ~= "table" or #r ~= 4 then
          problem(string.format("frame %d NEAR_ARM rectangle %d is not {x1, y1, x2, y2}", fi, k))
          valid = false
        elseif r[1] > r[3] or r[2] > r[4] or r[1] < 0 or r[2] < 0 or r[3] > 63 or r[4] > 63 then
          problem(string.format("frame %d NEAR_ARM rectangle %d {%d, %d, %d, %d} is not inside 0..63 with x1 <= x2 and y1 <= y2",
            fi, k, r[1], r[2], r[3], r[4]))
          valid = false
        else
          local covers = false
          for y = r[2], r[4] do
            for x = r[1], r[3] do
              if opaque(body, x, y) then covers = true end
            end
          end
          if not covers then
            problem(string.format("frame %d NEAR_ARM rectangle %d {%d, %d, %d, %d} covers no body pixel",
              fi, k, r[1], r[2], r[3], r[4]))
            valid = false
          end
        end
      end
      if valid then
        local hits = {}
        for y = 0, 63 do
          for x = 0, 63 do
            if opaque(pony, x, y) then
              for _, r in ipairs(rects) do
                if x >= r[1] - 1 and x <= r[3] + 1 and y >= r[2] - 1 and y <= r[4] + 1 then
                  hits[#hits + 1] = string.format("(%d,%d)", x, y)
                  break
                end
              end
            end
          end
        end
        if #hits > 0 then
          problem(string.format("frame %d (side-run): %d ponytail pixel(s) on or within 1 px of the near arm at %s",
            fi, #hits, listed(hits)))
        end
      end
    end
  else
    problem(string.format("frame %d is in no front-idle, turn or side-run tag", fi))
  end
end

if #problems == 0 then
  print(string.format("OK ponytail occlusion frames %d..%d (%d side-run frame(s) checked against NEAR_ARM)",
    first, last, runFrames))
else
  for _, p in ipairs(problems) do print("PROBLEM:" .. p) end
  print(string.format("FAILED %d problem(s)", #problems))
end
```

`D:/Projects/Tracks/.superpowers/art-previews/hair/preview-ramps.mjs`:

```js
// Prints remap_colors_in_cel_range mappings for hair checkpoint previews:
// PH skin -> SKIN_RAMPS["tone-3"], PH hair -> HAIR_RAMPS["dark-brown"].
// Run from the repo root.
import { readFileSync } from "node:fs";

const src = readFileSync("apps/web/src/features/avatar/palette.ts", "utf8");
const hex = "(0x[0-9a-f]{6})";

function ramp(key) {
  const re = new RegExp(String.raw`["']${key}["']\s*:\s*\[\s*${hex}\s*,\s*${hex}\s*,\s*${hex}`, "i");
  const m = re.exec(src);
  if (!m) throw new Error(`ramp "${key}" not found in apps/web/src/features/avatar/palette.ts`);
  return m.slice(1, 4).map((h) => `#${h.slice(2).toLowerCase()}`);
}

const pairs = (from, to) => from.map((f, i) => ({ from: f, to: to[i] }));
console.log(
  JSON.stringify({
    skin: pairs(["#ff80ff", "#ff40ff", "#ff00ff"], ramp("tone-3")),
    hair: pairs(["#80ffff", "#40ffff", "#00ffff"], ramp("dark-brown")),
  }),
);
```

Run `node .superpowers/art-previews/hair/preview-ramps.mjs` once. Expected: one JSON line `{"skin":[{"from":"#ff80ff","to":"#......"},…],"hair":[…]}` with three pairs each. Keep the output; Steps 13, 23 and 34 use it.

- [ ] **Step 4: Create `hair-short.aseprite` from body**

The source starts as a copy of body, so it inherits body's frames, durations and tags. Call `mcp__aseprite__copy_sprite`:

```json
{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "output_filename": "D:/Projects/Tracks/art/avatar/hair-short.aseprite", "overwrite": false}
```

Expected: `Sprite copied to D:/Projects/Tracks/art/avatar/hair-short.aseprite`. Then call `mcp__aseprite__run_lua_script`:

```json
{"filename": "D:/Projects/Tracks/art/avatar/hair-short.aseprite", "script": "dofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/convert.lua\")"}
```

Expected: `OK layers=ref-body(hidden),hair(visible) frames=<N> tags=3`. Then call `mcp__aseprite__get_sprite_info` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-short.aseprite"}`. Expected:
- `durations_ms` and `tags` are identical to Step 2's.
- `layers` is `ref-body` (`"visible":false`) followed by `hair` (`"visible":true`).

- [ ] **Step 5: Run the checks and watch them fail (empty hair layer)**

Call `mcp__aseprite__run_lua_script`:

```json
{"filename": "D:/Projects/Tracks/art/avatar/hair-short.aseprite", "script": "BODY = \"D:/Projects/Tracks/art/avatar/body.aseprite\"\ndofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/check.lua\")"}
```

Expected: `PROBLEM:frame 1 has no PH hair pixel` through `PROBLEM:frame <N> has no PH hair pixel`, then `FAILED <N> problem(s)`. Any other `PROBLEM:` line means the conversion is wrong; stop and fix it. Then:

```bash
pnpm art:export
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
git status --porcelain
```

Expected:
- `art:export` exits 0.
- The art test FAILS with `Test Files  1 failed (1)`. The only failing assertion names `hair-short` and its missing PH hair color. Spec §5 requires each avatar sheet to contain at least one color of its ramp, and every hair-short frame is still transparent.
- `git status --porcelain` prints exactly the lines below. Nothing else changed, so body's re-export is byte-identical:

```
?? apps/web/src/assets/sprites/hair-short.json
?? apps/web/src/assets/sprites/hair-short.png
?? art/avatar/hair-short.aseprite
```

- [ ] **Step 6: Study the body frames (shared by all three styles)**

Call `mcp__aseprite__run_lua_script` with `filename` `D:/Projects/Tracks/art/avatar/hair-short.aseprite` three times:
- with script `FRAME = <IDLE_FROM>\ndofile("D:/Projects/Tracks/.superpowers/art-previews/hair/lua/dump.lua")`
- then with `FRAME = <TURN>` and the same `dofile` line
- then with `FRAME = <RUN_FROM>` and the same `dofile` line

Each output is a header, two column-index rows, 64 grid rows and a `legend:` line. Then run the offsets script twice:

```json
{"filename": "D:/Projects/Tracks/art/avatar/hair-short.aseprite", "script": "REF = <IDLE_FROM>\nFIRST = <IDLE_FROM>\nLAST = <IDLE_TO>\ndofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/offsets.lua\")"}
```

```json
{"filename": "D:/Projects/Tracks/art/avatar/hair-short.aseprite", "script": "REF = <RUN_FROM>\nFIRST = <RUN_FROM>\nLAST = <RUN_TO>\ndofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/offsets.lua\")"}
```

Each frame prints one line in this format: `frame f: crown row r, head offset dx=a dy=b vs frame REF, mismatched head pixels m[ at (x,y) …]`. Also dump every frame whose mismatched pixels are not all on the eyes (blink).

Write `D:/Projects/Tracks/.superpowers/art-previews/hair/body-notes.txt` with the Write tool. It holds:
- the Step 2 values.
- the outline color, which is the hex of the body-silhouette letter in the legend.
- for IDLE_FROM, TURN and RUN_FROM:
  - the crown row
  - the eye-pixel coordinates, with the near and far eye marked for TURN
  - the shoulder-line row
  - the light side, which is where `1` sits on the head
  - the visible ear's columns
- the coordinates of every other fixed-color face feature (mouth, nose, cheeks) per view. Spec §1 Style allows fixed colors on the body. Hair grids leave these pixels uncovered.
- the near-arm pixels in RUN_FROM.
- every offsets line.

Stop and report if either of these is true. Each one means Task 15 must fix the body first:
- The dumps already show eyebrows on the body. Spec §1 puts eyebrows in the hair files.
- In any dumped frame, a ref-body pixel inside the head sits in the brow row or above it. This counts only pixels that are not PH skin (`1`/`2`/`3`), the outline letter or an eye color. Such a pixel is likely a baked-in brow or hairline.

- [ ] **Step 7: hair-short — draw the front-idle key frame (IDLE_FROM)**

Design (front view): a short crop.
- A cap follows the skull with 1–2 px of volume above the crown and 1 px at each temple.
- A fringe covers the top 2–3 forehead rows. Its lower edge is ragged: `S` on every other pixel.
- Sideburns are 1 px wide and end above the middle of each ear. The ears stay visible.
- Two eyebrows sit per rule 4.

Write the grid against the IDLE_FROM dump. Call `mcp__aseprite__run_lua_script` with `filename` `D:/Projects/Tracks/art/avatar/hair-short.aseprite` and the `script` below. The values come from Steps 2 and 6, and `ROWS` is the drawing:

```lua
LAYER = "hair"
FRAME = <IDLE_FROM>
OX = <grid's left column>
OY = <grid's top row>
ROWS = {
  "<row 1 of the grid>",
  "<row 2 of the grid>",
}
dofile("D:/Projects/Tracks/.superpowers/art-previews/hair/lua/paint.lua")
```

Expected: `OK hair frame <IDLE_FROM>: <count> pixels, bounds x a..b y c..d, outline <the Step 6 outline hex>`. Re-run the dump for `FRAME = <IDLE_FROM>`. Re-paint until all of these hold:
- Uppercase hair pixels sit on the head.
- The eye pixels and the face features recorded in Step 6 are untouched, and the brows are in the row above the eyes.
- `c` ≥ crown row − 4.

- [ ] **Step 8: hair-short — fill the other front-idle frames**

Use the Step 6 idle offsets for each frame `f` from `IDLE_FROM + 1` to `IDLE_TO`:
- **Head only moved.** This means `m` is 0, or every mismatched pixel is an eye pixel (a blink).
  - Call `mcp__aseprite__copy_cel` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-short.aseprite", "layer_name": "hair", "source_frame": <IDLE_FROM>, "target_frame": <f>, "replace": true}`. Expected: `Cel copied on 'hair' from frame <IDLE_FROM> to <f> in …`.
  - If `dx`/`dy` is not 0,0, also call `mcp__aseprite__offset_cel_positions` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-short.aseprite", "layer_name": "hair", "start_frame": <f>, "end_frame": <f>, "dx": <dx>, "dy": <dy>}`. Expected: `Offset cel positions by (<dx>, <dy>) on 'hair' frames <f>-<f> in …`.
- **Head changed shape.** Paint `f` with its own grid: Step 7's call with `FRAME = <f>`, drawn against that frame's dump.

Dump the frame with the largest |dy| and confirm the hair moved with the head.

- [ ] **Step 9: hair-short — draw the turn frame (TURN)**

Design (¾ front-right, screen directions):
- The back of the head is on the left (−x). The cap is 1–2 px wider over it than over the face side (+x).
- The fringe sits right of center.
- The one visible ear is on the left (−x) half of the head. A 1 px sideburn sits just in front of it, on the ear's +x side. The right (+x) side of the head shows no ear and no sideburn.
- Behind the visible ear, on the left, hair reaches down to the nape.
- Brows follow rule 4: 2 px over the near eye, the full-width one nearer the head's center, and 1 px over the far eye, the narrow one near the +x edge.

Run Step 7's call with `FRAME = <TURN>` and a grid drawn against the TURN dump. Expected: an `OK hair frame <TURN>: …` line. Re-dump `FRAME = <TURN>` to verify.

- [ ] **Step 10: hair-short — draw the side-run key frame (RUN_FROM)**

Design (profile, facing right, +x):
- A cap covers the top and back of the skull, down to one row above the point where the neck starts at the back.
- The fringe tip sits 1–2 px over the forehead at the front (right).
- A 1 px sideburn sits just in front of the ear, and the ear stays visible.
- One 2 px brow sits over the eye.

Run Step 7's call with `FRAME = <RUN_FROM>` and a grid drawn against the RUN_FROM dump. Expected: an `OK hair frame <RUN_FROM>: …` line. Re-dump to verify.

- [ ] **Step 11: hair-short — fill the other side-run frames**

For each `f` from `RUN_FROM + 1` to `RUN_TO`, apply Step 8's rule using the Step 6 run offsets with `source_frame` `<RUN_FROM>`:
- If the head only moved: `copy_cel`, plus `offset_cel_positions` when the offset is not 0,0.
- If the head changed shape: its own grid via Step 7's call with `FRAME = <f>`.

Dump the frames at the smallest and the largest `dy` and verify them.

- [ ] **Step 12: hair-short — run the checks and see them pass**

Run Step 5's `check.lua` call. Expected: `OK <N> frames, tags front-idle:… turn:… side-run:…, outline <hex>`. Fix every `PROBLEM:` line before continuing. Then:

```bash
pnpm art:export
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
git status --porcelain
```

Expected:
- `art:export` exits 0.
- The art test PASSES with `Test Files  1 passed (1)`.
- `git status --porcelain` prints the same three `?? …hair-short…` lines as Step 5, and nothing else.

- [ ] **Step 13: hair-short — review it composited over the body**

Make a preview copy with real colors. The source file stays untouched.
1. Call `mcp__aseprite__copy_sprite` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-short.aseprite", "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-over-body.aseprite", "overwrite": true}`.
2. Call `mcp__aseprite__set_layer_visibility` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-over-body.aseprite", "layer_name": "ref-body", "visible": true}`.
3. Call `mcp__aseprite__remap_colors_in_cel_range` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-over-body.aseprite", "layer_name": "ref-body", "start_frame": 1, "end_frame": <N>, "mappings": <the "skin" array from Step 3>}`.
4. Call `mcp__aseprite__remap_colors_in_cel_range` with the same arguments, except `"layer_name": "hair"` and `"mappings": <the "hair" array from Step 3>`.
5. Call `mcp__aseprite__export_spritesheet` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-over-body.aseprite", "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-idle-sheet.png", "sheet_type": "horizontal", "scale": <SCALE_IDLE>, "tag_name": "front-idle"}`. Expected: `Sprite sheet exported to …hair-short-idle-sheet.png (horizontal)`.
6. Call it again with `"output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-run-sheet.png"`, `"scale": <SCALE_RUN>` and `"tag_name": "side-run"`. Expected: `Sprite sheet exported to …hair-short-run-sheet.png (horizontal)`.
7. Call `mcp__aseprite__export_frame` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-over-body.aseprite", "frame_index": <TURN>, "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-turn.png", "scale": 8}`. Expected: `Frame <TURN> exported to …hair-short-turn.png at 8x`.

If Step 2 found a scale below 2, export that tag's frames with `export_frame` at `"scale": 8` instead of items 5 and 6.

Open the three PNGs with the Read tool. Each one is at most 1536 px wide, so it is shown without downscaling. Check every frame:
- The hair sits on the head with no 1 px jumps between frames other than the head's own motion.
- The eyes, brows and recorded face features are visible.
- No hair covers the face below the fringe.
- The silhouette reads as short hair in all three views.

To fix a frame, re-paint it (Steps 7–11), then repeat Step 12 and this step.

- [ ] **Step 14: Commit hair-short**

```bash
git add art/avatar/hair-short.aseprite apps/web/src/assets/sprites/hair-short.png apps/web/src/assets/sprites/hair-short.json
git commit -F - <<'EOF'
Add short hair art for the athlete avatar

hair-short.aseprite starts from body.aseprite, so it has body's frames,
durations and front-idle/turn/side-run tags. A hidden, locked ref-body
layer holds the body frames it is drawn against. It uses only the PH
hair ramp and the shared outline, and carries the eyebrows.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
git status --porcelain
```

Expected: the commit succeeds and `git status --porcelain` prints nothing.

- [ ] **Step 15: Create `hair-curly.aseprite` from body**

Call `mcp__aseprite__copy_sprite` with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "output_filename": "D:/Projects/Tracks/art/avatar/hair-curly.aseprite", "overwrite": false}`. Expected: `Sprite copied to D:/Projects/Tracks/art/avatar/hair-curly.aseprite`.

Then call `mcp__aseprite__run_lua_script` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-curly.aseprite", "script": "dofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/convert.lua\")"}`. Expected: `OK layers=ref-body(hidden),hair(visible) frames=<N> tags=3`.

Finally, call `mcp__aseprite__get_sprite_info` on the new file. Expected: durations and tags identical to Step 2's.

- [ ] **Step 16: hair-curly — run the checks and watch them fail**

Call `mcp__aseprite__run_lua_script` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-curly.aseprite", "script": "BODY = \"D:/Projects/Tracks/art/avatar/body.aseprite\"\ndofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/check.lua\")"}`. Expected: `PROBLEM:frame k has no PH hair pixel` for every k from 1 to N, then `FAILED <N> problem(s)`. Then:

```bash
pnpm art:export
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
git status --porcelain
```

Expected:
- `art:export` exits 0.
- The art test FAILS. The only failing assertion names `hair-curly` (no PH hair color). `hair-short` passes.
- `git status --porcelain` prints exactly:

```
?? apps/web/src/assets/sprites/hair-curly.json
?? apps/web/src/assets/sprites/hair-curly.png
?? art/avatar/hair-curly.aseprite
```

- [ ] **Step 17: hair-curly — draw the front-idle key frame (IDLE_FROM)**

Design (front view):
- A rounded mass rises 3–4 px above the crown. At temple level it spreads 2–3 px beyond each side of the head, down to the middle of the ears.
- The exterior outline is scalloped: every 2–3 px along the edge, the `O` steps out 1 px to form a bump. The bumps stay inside x 1..62.
- Inside the mass, each curl is a 1–2 px `L` on `B` with an `S` pixel under it.
- A fringe of 2–3 curls crosses the forehead. Its scalloped lower edge is `S` and ends at least 1 row above the brow row.
- Two brows sit per rule 4.

Write the grid against the IDLE_FROM dump. Call `mcp__aseprite__run_lua_script` with `filename` `D:/Projects/Tracks/art/avatar/hair-curly.aseprite` and this `script`:

```lua
LAYER = "hair"
FRAME = <IDLE_FROM>
OX = <grid's left column>
OY = <grid's top row>
ROWS = {
  "<row 1 of the grid>",
  "<row 2 of the grid>",
}
dofile("D:/Projects/Tracks/.superpowers/art-previews/hair/lua/paint.lua")
```

Expected: `OK hair frame <IDLE_FROM>: …` with `y` min ≥ crown − 4. Then dump this file with `FRAME = <IDLE_FROM>` and `dofile("D:/Projects/Tracks/.superpowers/art-previews/hair/lua/dump.lua")`, and verify it as in Step 7.

- [ ] **Step 18: hair-curly — fill the other front-idle frames**

Apply Step 8's rule on `D:/Projects/Tracks/art/avatar/hair-curly.aseprite`, layer `hair`, source frame `<IDLE_FROM>`, using the Step 6 idle offsets:
- For frames whose head only moved: `mcp__aseprite__copy_cel`, then `mcp__aseprite__offset_cel_positions` when the offset is not 0,0.
- For frames whose head changed shape: Step 17's call with `FRAME = <f>`.

Dump the frame with the largest |dy| and verify it.

- [ ] **Step 19: hair-curly — draw the turn frame (TURN)**

Design (¾ front-right, screen directions):
- The mass reaches 1 px further on the back (left, −x) side than on the face (+x) side.
- The fringe curls sit right of center.
- The curls stop above the one visible ear on the left half of the head.
- Brows follow rule 4: near eye 2 px, far eye 1 px.

Run Step 17's call with `FRAME = <TURN>` and a grid drawn against the TURN dump. Expected: `OK hair frame <TURN>: …`. Re-dump to verify.

- [ ] **Step 20: hair-curly — draw the side-run key frame (RUN_FROM)**

Design (profile, facing right, +x):
- The mass rounds over the top and extends 3–4 px behind the back of the skull (−x), down to the nape.
- One curl sits over the forehead at the front (right).
- The ear's lower half stays visible.
- One 2 px brow sits over the eye.

Run Step 17's call with `FRAME = <RUN_FROM>` against the RUN_FROM dump. Expected: `OK hair frame <RUN_FROM>: …`. Re-dump to verify.

- [ ] **Step 21: hair-curly — fill the other side-run frames**

Apply Step 8's rule on `hair-curly.aseprite`, layer `hair`, source frame `<RUN_FROM>`, using the Step 6 run offsets for `f` from `RUN_FROM + 1` to `RUN_TO`. Dump the smallest-`dy` and largest-`dy` frames and verify them.

- [ ] **Step 22: hair-curly — run the checks and see them pass**

Run Step 16's `check.lua` call. Expected: `OK <N> frames, tags …, outline <hex>`, with no `PROBLEM:` lines. Then:

```bash
pnpm art:export
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
git status --porcelain
```

Expected:
- `art:export` exits 0.
- The art test PASSES with `Test Files  1 passed (1)`.
- `git status --porcelain` prints only the three `?? …hair-curly…` lines from Step 16.

- [ ] **Step 23: hair-curly — review it composited over the body**

1. Call `mcp__aseprite__copy_sprite` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-curly.aseprite", "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-over-body.aseprite", "overwrite": true}`.
2. Call `mcp__aseprite__set_layer_visibility` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-over-body.aseprite", "layer_name": "ref-body", "visible": true}`.
3. Call `mcp__aseprite__remap_colors_in_cel_range` on that copy with `"layer_name": "ref-body"`, `"start_frame": 1`, `"end_frame": <N>` and the `skin` mappings.
4. Call it again with `"layer_name": "hair"` and the `hair` mappings.
5. Call `mcp__aseprite__export_spritesheet` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-over-body.aseprite", "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-idle-sheet.png", "sheet_type": "horizontal", "scale": <SCALE_IDLE>, "tag_name": "front-idle"}`.
6. Call it again with `"output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-run-sheet.png"`, `"scale": <SCALE_RUN>` and `"tag_name": "side-run"`.
7. Call `mcp__aseprite__export_frame` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-over-body.aseprite", "frame_index": <TURN>, "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-turn.png", "scale": 8}`.

The expected outputs match Step 13's. Open the three PNGs with the Read tool and check every frame against Step 13's list. Also check two things:
- The curls read as curls rather than noise.
- The scalloped silhouette stays inside the cell.

To fix a frame, re-paint it, then repeat Step 22 and this step.

- [ ] **Step 24: Commit hair-curly**

```bash
git add art/avatar/hair-curly.aseprite apps/web/src/assets/sprites/hair-curly.png apps/web/src/assets/sprites/hair-curly.json
git commit -F - <<'EOF'
Add curly hair art for the athlete avatar

hair-curly.aseprite starts from body.aseprite (same frames, durations
and tags) and is drawn against a hidden, locked ref-body layer. The
rounded, scalloped volume stays well below row 0 of the 64x64 cell and
uses only the PH hair ramp and the shared outline, eyebrows included.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
git status --porcelain
```

Expected: the commit succeeds and `git status --porcelain` prints nothing.

- [ ] **Step 25: Create `hair-ponytail.aseprite` from body, with a `ponytail` layer**

Make the copy and convert it:
1. Call `mcp__aseprite__copy_sprite` with `{"filename": "D:/Projects/Tracks/art/avatar/body.aseprite", "output_filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "overwrite": false}`. Expected: `Sprite copied to …hair-ponytail.aseprite`.
2. Call `mcp__aseprite__run_lua_script` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "script": "dofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/convert.lua\")"}`. Expected: `OK layers=ref-body(hidden),hair(visible) frames=<N> tags=3`.

Add the tail layer below `hair`:
1. Call `mcp__aseprite__add_layer` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "layer_name": "ponytail"}`. Expected: `Layer 'ponytail' added to …`.
2. Call `mcp__aseprite__reorder_layer` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "layer_name": "ponytail", "position": 2}`. Expected: `Layer 'ponytail' moved to position 2 in …`.

Finally, call `mcp__aseprite__get_sprite_info`. Expected: `layers` in order `ref-body` (hidden), `ponytail` (visible), `hair` (visible), with durations and tags identical to Step 2's.

- [ ] **Step 26: hair-ponytail — run the checks and watch them fail**

Call `mcp__aseprite__run_lua_script` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "script": "BODY = \"D:/Projects/Tracks/art/avatar/body.aseprite\"\ndofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/check.lua\")"}`. Expected: `PROBLEM:frame k has no PH hair pixel` for every k from 1 to N, then `FAILED <N> problem(s)`.

Then run the occlusion check on the empty tail. No `near-arm.lua` exists yet. Call `mcp__aseprite__run_lua_script` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "script": "dofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/occlusion.lua\")"}`. Expected: `PROBLEM:frame <f> (side-run): no NEAR_ARM entry` for every f from RUN_FROM to RUN_TO, then `FAILED <RUN_COUNT> problem(s)`. No front-idle or turn frame is reported.

Then:

```bash
pnpm art:export
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
git status --porcelain
```

Expected:
- `art:export` exits 0.
- The art test FAILS. The only failing assertion names `hair-ponytail` (no PH hair color).
- `git status --porcelain` prints exactly:

```
?? apps/web/src/assets/sprites/hair-ponytail.json
?? apps/web/src/assets/sprites/hair-ponytail.png
?? art/avatar/hair-ponytail.aseprite
```

- [ ] **Step 27: hair-ponytail — draw the front-idle key frame on both layers (IDLE_FROM)**

Design (front view), the cap on the `hair` layer:
- The hair is pulled back flat: 1 px of volume above the crown and no fringe.
- The hairline is a smooth `S`-edged arc across the top of the forehead.
- An `S` center part runs up 2–3 px from the hairline at x = 32.
- The ears stay visible, and two brows sit per rule 4.

Design (front view), the tail on the `ponytail` layer:
- A 2 px wide strip peeks out on the left (−x) side of the neck, from jaw level down to the shoulder line.
- Every pixel stays outside the head/neck silhouette (rule 6).

Call `mcp__aseprite__run_lua_script` with `filename` `D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite` twice. First the cap:

```lua
LAYER = "hair"
FRAME = <IDLE_FROM>
OX = <cap grid's left column>
OY = <cap grid's top row>
ROWS = {
  "<row 1 of the cap grid>",
  "<row 2 of the cap grid>",
}
dofile("D:/Projects/Tracks/.superpowers/art-previews/hair/lua/paint.lua")
```

Then the tail:

```lua
LAYER = "ponytail"
FRAME = <IDLE_FROM>
OX = <tail grid's left column>
OY = <tail grid's top row>
ROWS = {
  "<row 1 of the tail grid>",
  "<row 2 of the tail grid>",
}
dofile("D:/Projects/Tracks/.superpowers/art-previews/hair/lua/paint.lua")
```

Expected: `OK hair frame <IDLE_FROM>: …` and `OK ponytail frame <IDLE_FROM>: …`. Dump `FRAME = <IDLE_FROM>` and verify it as in Step 7. Then call `mcp__aseprite__run_lua_script` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "script": "FIRST = <IDLE_FROM>\nLAST = <IDLE_FROM>\ndofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/occlusion.lua\")"}`. Expected: `OK ponytail occlusion frames <IDLE_FROM>..<IDLE_FROM> (0 side-run frame(s) checked against NEAR_ARM)`. A `PROBLEM:` line lists tail pixels that sit on the body. Clear them in the tail grid and re-paint until the check passes.

- [ ] **Step 28: hair-ponytail — fill the other front-idle frames on both layers**

Apply Step 8's rule on `D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite` from source frame `<IDLE_FROM>`, using the Step 6 idle offsets. Do it for the `hair` layer and again for the `ponytail` layer:
- Call `mcp__aseprite__copy_cel` with `"layer_name": "hair"`, then with `"layer_name": "ponytail"`.
- Apply the same `mcp__aseprite__offset_cel_positions` delta on both layers.
- For frames whose head changed shape, use Step 27's two paint calls with `FRAME = <f>`.

The offsets only compare the head, so breathing frames that move the neck or shoulders still get the copied tail. Check every front-idle frame by calling `mcp__aseprite__run_lua_script` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "script": "FIRST = <IDLE_FROM>\nLAST = <IDLE_TO>\ndofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/occlusion.lua\")"}`.

Expected: `OK ponytail occlusion frames <IDLE_FROM>..<IDLE_TO> (0 side-run frame(s) checked against NEAR_ARM)`. For each frame `f` named in a `PROBLEM:` line:
1. Dump `FRAME = <f>`.
2. Re-paint that frame's tail with its own grid drawn against the dump, using Step 27's tail call with `FRAME = <f>`.
3. Re-run this check until it prints `OK`.

Then dump the frame with the largest |dy| and verify it.

- [ ] **Step 29: hair-ponytail — draw the turn frame on both layers (TURN)**

Design (¾ front-right, screen directions):
- **Cap (`hair` layer).**
  - It matches the front view, with the back (left, −x) 1 px fuller.
  - The tie is a 2 px `O` band at the back-left of the head, about crown + 5, where the tail leaves. The tie is part of the cap grid.
  - The one visible ear, on the left half, stays visible.
  - Brows follow rule 4: near eye 2 px, far eye 1 px.
- **Tail (`ponytail` layer).** It is 3 px wide and runs from the tie down behind the neck to the shoulder line, on the left. It shows only outside the head/neck silhouette.

Run Step 27's two paint calls with `FRAME = <TURN>`, with grids drawn against the TURN dump. Expected: `OK hair frame <TURN>: …` and `OK ponytail frame <TURN>: …`. Re-dump to verify. Then run the occlusion check with `FIRST = <TURN>` and `LAST = <TURN>`, as in Step 27. Expected: `OK ponytail occlusion frames <TURN>..<TURN> (0 side-run frame(s) checked against NEAR_ARM)`.

- [ ] **Step 30: hair-ponytail — draw the side-run key frame on both layers (RUN_FROM)**

Design (profile, facing right, +x):
- **Cap (`hair` layer).**
  - It is smooth over the top, with the hairline at the front (right).
  - A 2 px `O` tie band sits at the back of the skull, about crown + 4 to crown + 5.
  - One 2 px brow sits over the eye, and the ear stays visible.
- **Tail (`ponytail` layer).**
  - It leaves the tie 3 px wide and tapers to 1–2 px.
  - It hangs back (−x) and down about 8–10 px, with the tip at shoulder level.
  - It stays 1 px clear of the near arm (rule 6).

Record the near arm first:
1. Dump `FRAME = <RUN_FROM>`.
2. Write `D:/Projects/Tracks/.superpowers/art-previews/hair/lua/near-arm.lua` with the Write tool, in this form:

```lua
NEAR_ARM = {
  [<RUN_FROM>] = { {<x1>, <y1>, <x2>, <y2>}, {<x1>, <y1>, <x2>, <y2>} },
}
```

The rectangles together cover every near-arm pixel in that dump, outline included:
- Use 1–4 rectangles that hug the arm, for example the upper arm, the forearm and the hand.
- A rectangle may include torso pixels the arm lies over.
- A rectangle must not include empty space behind the back. The check would report a tail pixel there as a false hit.
- Each rectangle is `{x1, y1, x2, y2}`, with `x1 ≤ x2` and `y1 ≤ y2`, inclusive.

Then run Step 27's two paint calls with `FRAME = <RUN_FROM>` against the RUN_FROM dump. Expected: two `OK … frame <RUN_FROM>: …` lines. Re-dump to verify.

Finally, call `mcp__aseprite__run_lua_script` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "script": "dofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/near-arm.lua\")\nFIRST = <RUN_FROM>\nLAST = <RUN_FROM>\ndofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/occlusion.lua\")"}`. Expected: `OK ponytail occlusion frames <RUN_FROM>..<RUN_FROM> (1 side-run frame(s) checked against NEAR_ARM)`.

- [ ] **Step 31: hair-ponytail — fill the side-run cap frames (`hair` layer)**

Apply Step 8's rule on `hair-ponytail.aseprite`, layer `hair` only, from source frame `<RUN_FROM>`. Use the Step 6 run offsets for `f` from `RUN_FROM + 1` to `RUN_TO`:
- If the head only moved: `copy_cel`, plus `offset_cel_positions` when the offset is not 0,0.
- If the head changed shape: Step 27's cap call with `FRAME = <f>`.

- [ ] **Step 32: hair-ponytail — draw the swinging tail in each side-run frame (`ponytail` layer)**

For each `f` from `RUN_FROM + 1` to `RUN_TO`, in order:
1. **Dump the frame.** Dump `FRAME = <f>`. It shows that frame's body and the cap from Step 31.
2. **Record the near arm.** Add `[<f>] = { … },` to `NEAR_ARM` in `near-arm.lua` with the Edit tool. The rectangles follow the same rules as in Step 30, and are read from this dump.
3. **Paint the tail.** Run Step 27's tail call with `FRAME = <f>`. Draw the RUN_FROM tail shape moved by this frame's head offset, then apply the swing:
   - When the head is at its lowest (the largest `dy` in the run offsets), move the tip up 1–2 px.
   - When the head is at its highest (the smallest `dy`), move the tip down 1–2 px and stream it back 1 px further.
   - In the other frames, keep the tip midway.
   - Keep the root attached to the tie.

   Expected: `OK ponytail frame <f>: …`.
4. **Check occlusion.** Run Step 30's occlusion call with `FIRST = <f>` and `LAST = <f>`. Expected: `OK ponytail occlusion frames <f>..<f> (1 side-run frame(s) checked against NEAR_ARM)`. If a `PROBLEM:` line lists tail pixels on or next to the arm, clear them in the grid and repeat item 3.
5. **Verify.** Re-dump `FRAME = <f>`. Confirm the root meets the tie and the tip sits where the swing rule puts it.

- [ ] **Step 33: hair-ponytail — run the checks and see them pass**

Run Step 26's `check.lua` call. Expected: `OK <N> frames, tags …, outline <hex>`, with no `PROBLEM:` lines.

Then check occlusion across every frame by calling `mcp__aseprite__run_lua_script` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "script": "dofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/near-arm.lua\")\ndofile(\"D:/Projects/Tracks/.superpowers/art-previews/hair/lua/occlusion.lua\")"}`. Expected: `OK ponytail occlusion frames 1..<N> (<RUN_COUNT> side-run frame(s) checked against NEAR_ARM)`.

Then:

```bash
pnpm art:export
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
git status --porcelain
```

Expected:
- `art:export` exits 0.
- The art test PASSES with `Test Files  1 passed (1)`.
- `git status --porcelain` prints only the three `?? …hair-ponytail…` lines from Step 26.

- [ ] **Step 34: hair-ponytail — review it composited over the body**

1. Call `mcp__aseprite__copy_sprite` with `{"filename": "D:/Projects/Tracks/art/avatar/hair-ponytail.aseprite", "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-over-body.aseprite", "overwrite": true}`.
2. Call `mcp__aseprite__set_layer_visibility` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-over-body.aseprite", "layer_name": "ref-body", "visible": true}`.
3. Call `mcp__aseprite__remap_colors_in_cel_range` on that copy with `"layer_name": "ref-body"`, `"start_frame": 1`, `"end_frame": <N>` and the `skin` mappings.
4. Call it twice more with the `hair` mappings, `"start_frame": 1` and `"end_frame": <N>`: once with `"layer_name": "hair"` and once with `"layer_name": "ponytail"`.
5. Call `mcp__aseprite__export_spritesheet` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-over-body.aseprite", "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-idle-sheet.png", "sheet_type": "horizontal", "scale": <SCALE_IDLE>, "tag_name": "front-idle"}`.
6. Call it again with `"output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-run-sheet.png"`, `"scale": <SCALE_RUN>` and `"tag_name": "side-run"`.
7. Call `mcp__aseprite__export_frame` with `{"filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-over-body.aseprite", "frame_index": <TURN>, "output_filename": "D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-turn.png", "scale": 8}`.

Open the three PNGs with the Read tool and check every frame against Step 13's list. Also check three things in the run sheet and the idle sheet:
- The tail swing reads as lagging the head bob.
- The tail never crosses the face or the near arm.
- In front view, the tail peeks out only beside the neck.

To fix a frame, re-paint it, then repeat Step 33 and this step.

- [ ] **Step 35: Commit hair-ponytail**

```bash
git add art/avatar/hair-ponytail.aseprite apps/web/src/assets/sprites/hair-ponytail.png apps/web/src/assets/sprites/hair-ponytail.json
git commit -F - <<'EOF'
Add ponytail hair art for the athlete avatar

hair-ponytail.aseprite starts from body.aseprite (same frames, durations
and tags) and is drawn against a hidden, locked ref-body layer. The cap
and the tail are separate visible layers, so the tail can swing with
the side-run bob. Only the PH hair ramp and the shared outline are
used, eyebrows included. Tail pixels a nearer body part covers are left
transparent: none sit on the body in front and turn views, and none
touch the near arm in side-run.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
git status --porcelain
```

Expected: the commit succeeds and `git status --porcelain` prints nothing.

- [ ] **Step 36: Export the hair checkpoint stills (8×, composited over body)**

The preview copies from Steps 13, 23 and 34 already match the committed sources. If any source changed after its review step, first redo items 1–4 of that review step (Step 13, 23 or 34). Then call `mcp__aseprite__export_frame` nine times, one call per row, each with `"scale": 8`:

| Style | `filename` | `frame_index` | `output_filename` |
|---|---|---|---|
| short | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-over-body.aseprite` | `<IDLE_FROM>` | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-front.png` |
| short | same as above | `<TURN>` | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-turn.png` |
| short | same as above | `<RUN_FROM>` | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-short-side.png` |
| curly | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-over-body.aseprite` | `<IDLE_FROM>` | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-front.png` |
| curly | same as above | `<TURN>` | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-turn.png` |
| curly | same as above | `<RUN_FROM>` | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-curly-side.png` |
| ponytail | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-over-body.aseprite` | `<IDLE_FROM>` | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-front.png` |
| ponytail | same as above | `<TURN>` | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-turn.png` |
| ponytail | same as above | `<RUN_FROM>` | `D:/Projects/Tracks/.superpowers/art-previews/hair/hair-ponytail-side.png` |

Each call is expected to print `Frame <n> exported to <png> at 8x`. Then:

```bash
ls .superpowers/art-previews/hair/*-front.png .superpowers/art-previews/hair/*-turn.png .superpowers/art-previews/hair/*-side.png
```

Expected: the nine PNGs are listed. Open each with the Read tool before sending it.

- [ ] **Step 37: Send the hair checkpoint to the user**

Load SendUserFile with the `ToolSearch` query `select:SendUserFile`, then send the nine PNGs from Step 36 with this message:

> Hair checkpoint (Task 16): short, curly and ponytail drawn over the body. These are 8× stills of front-idle frame 1, the turn frame and side-run frame 1, previewed with skin tone 3 and dark-brown hair. Reply with changes or approve. If you open any `art/avatar/hair-*.aseprite` in Aseprite, save and close it before I edit it again.

- [ ] **Step 38: Final verification**

```bash
pnpm --filter @tracks/web test
pnpm --filter @tracks/web typecheck
pnpm --filter @tracks/web lint
pnpm art:export
git status --porcelain art apps/web/src/assets/sprites
git log --oneline -3
```

Expected:
- Every web test file passes.
- `typecheck` and `lint` exit 0 with no warnings.
- `art:export` exits 0.
- `git status --porcelain art apps/web/src/assets/sprites` prints nothing, so exports are deterministic (spec Done-when 3).
- The log shows the ponytail, curly and short hair commits.

Any warning or error seen anywhere in this task is in scope and must be fixed (.claude/CLAUDE.md rule 26).

- [ ] **Step 39: Apply checkpoint feedback (only if the user asks for changes)**

1. **Ask before editing.** Ask the user to confirm that every hair file they opened in Aseprite is saved and closed. MCP calls read from and save to disk, and Aseprite does not reload changed files. Never edit a file the user says is open.
2. **Make the edits.**
   - MCP edits: re-paint the affected frames with the style's drawing steps (short 7–11, curly 17–21, ponytail 27–32).
   - For the ponytail, also update that frame's `NEAR_ARM` entry if the body changed, then re-run its occlusion check.
   - Edits the user made in the GUI: start from the same source file.
3. **Re-verify.**
   - Run the style's check calls from its check-and-pass step: `check.lua`, plus the full occlusion check for the ponytail. Then run `pnpm art:export` and the art test, expecting the same output as in that step (12, 22 or 33).
   - The `git status --porcelain` expectation of those steps (three `??` lines) does not apply here. The files are already committed, so it prints exactly these two lines, and nothing else:

     ```
      M apps/web/src/assets/sprites/hair-<style>.png
      M art/avatar/hair-<style>.aseprite
     ```

     A pixel-only edit leaves `hair-<style>.json` byte-identical. If ` M apps/web/src/assets/sprites/hair-<style>.json` appears, frames, durations or tags changed: run `check.lua`, and fix it before continuing.
   - Run the style's review step (13, 23 or 34), then Step 36's three exports for that style. Send them with SendUserFile.
4. **Commit.** Set `STYLE` to `short`, `curly` or `ponytail` and commit the source together with its exports:

```bash
STYLE=curly
git add "art/avatar/hair-$STYLE.aseprite" "apps/web/src/assets/sprites/hair-$STYLE.png" "apps/web/src/assets/sprites/hair-$STYLE.json"
git commit -F - <<EOF
Revise $STYLE hair after the hair checkpoint

Applies the user's checkpoint feedback; tags, frames and durations still
match body.aseprite and the art check passes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
git status --porcelain
```

Expected: the commit succeeds and `git status --porcelain` prints nothing.

---

### Task 17: Art: starter clothing (tee, shorts, shoes)

**Files:**
- Create: `art/avatar/shoes-starter.aseprite` (layers: `body-ref` hidden, `shoes` visible)
- Create: `art/avatar/bottom-starter-shorts.aseprite` (layers: `body-ref` hidden, `shorts` visible)
- Create: `art/avatar/top-starter-tee.aseprite` (layers: `body-ref` hidden, `tee` visible)
- Create (generated by `pnpm art:export`, committed): `apps/web/src/assets/sprites/shoes-starter.png`, `apps/web/src/assets/sprites/shoes-starter.json`, `apps/web/src/assets/sprites/bottom-starter-shorts.png`, `apps/web/src/assets/sprites/bottom-starter-shorts.json`, `apps/web/src/assets/sprites/top-starter-tee.png`, `apps/web/src/assets/sprites/top-starter-tee.json`
- Test (existing, unchanged): `apps/web/src/features/avatar/__tests__/art.test.ts`. It validates every exported sheet, so it picks up the three new sheets with no edit.
- Throwaway, gitignored (`.superpowers/`), never committed:
  - `.superpowers/art-tools/garment-lib.lua`, `check-garments.lua`, `make-garment-sources.lua`, `dump-body.lua`, `paint-garment.lua`, `composite-clothing.mts`
  - `.superpowers/art-tools/ops/shoes-starter.lua`, `ops/bottom-starter-shorts.lua`, `ops/top-starter-tee.lua`
  - `.superpowers/art-tools/rerun.lua` (only if an MCP call fails with a bare `Script failed:`, Step 4)
  - `.superpowers/art-backup/` (only if Step 19 has to discard or rebuild a source)
  - previews in `.superpowers/art-previews/`

**Interfaces:**
- Consumes:
  - `art/avatar/body.aseprite` and its export `apps/web/src/assets/sprites/body.json` (Task 15, user-approved). This is the timing reference: tags `front-idle`, `turn`, `side-run`, all `forward`. Skin uses the PH skin ramp, and there is one dark outline color.
  - `art/palette.gpl`
  - Root script `"art:export": "npx tsx scripts/export-art.ts"`
  - `art.test.ts`, which treats `top-*`, `bottom-*` and `shoes-*` sheets as avatar sheets swapped with the cloth ramp.
  - `palette.ts`: `PLACEHOLDER_RAMPS: { skin: Ramp; hair: Ramp; cloth: Ramp }`, `SKIN_RAMPS: Record<SkinTone, Ramp>`, `CLOTH_RAMPS: Record<TopItem | BottomItem | ShoesItem, Ramp>`
  - `swap.ts`: `type Swap = ReadonlyMap<number, number>`, `buildSwap(from: Ramp, to: Ramp): Swap`, `swapPixels(rgba: Uint8ClampedArray, swap: Swap): Uint8ClampedArray`
  - MCP tools `mcp__aseprite__run_lua_script(script: string, filename?: string)` and `mcp__aseprite__get_sprite_info(filename: string)`
- Produces:
  - Exported sheets with SheetIds `top-starter-tee`, `bottom-starter-shorts` and `shoes-starter`. `SHEETS` in `sheets.ts` loads them through `import.meta.glob`, and they are the `sheet` values of `TOP_OPTIONS`, `BOTTOM_OPTIONS` and `SHOES_OPTIONS` in `catalog.ts`.
  - Each sheet has body.json's frame count, `frames[].duration` and `meta.frameTags`, 64×64 frames, and only PH cloth `#FFFF80 #FFFF40 #FFFF00` plus the body outline color.

All MCP calls and scripts use the absolute root `D:/Projects/Tracks` (spec §4, Drawing workflow). If `git rev-parse --show-toplevel` prints a different path in Step 1, replace every `D:/Projects/Tracks` in this task with that path. **N** below is the body's frame count from Step 1.

Every `mcp__aseprite__run_lua_script` call in this task runs a tool file through `xpcall(dofile, debug.traceback, "<path>")` and prints `ERROR: ` plus the traceback if anything fails. Without that wrapper, an uncaught Lua error makes Aseprite exit 127 with the traceback on stdout. The MCP returns only stderr, which is empty, so you would get a bare `Script failed:`. Step 4 explains how to read a failed call.

- [ ] **Step 1: Preflight. Confirm Task 15's outputs, the MCP and the GUI state**

Run (Git Bash, repo root):
```bash
git rev-parse --show-toplevel
git branch --show-current
git status --porcelain
ls art/palette.gpl art/avatar/body.aseprite apps/web/src/assets/sprites/body.png apps/web/src/assets/sprites/body.json scripts/export-art.ts apps/web/src/features/avatar/palette.ts apps/web/src/features/avatar/swap.ts apps/web/src/features/avatar/__tests__/art.test.ts apps/web/node_modules/pngjs/package.json
ls art/avatar/top-starter-tee.aseprite art/avatar/bottom-starter-shorts.aseprite art/avatar/shoes-starter.aseprite
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
```
Expected:
- `D:/Projects/Tracks`
- `feat/avatar-room`
- empty status
- the first `ls` lists all 9 paths
- the second `ls` prints `No such file or directory` for all three
- art.test PASS

Then call `mcp__aseprite__get_sprite_info` with `{ "filename": "D:/Projects/Tracks/art/avatar/body.aseprite" }`.
- Expected: JSON with `"width":64,"height":64,"color_mode":"rgb"`, `"frames":N`, `durations_ms` and tags `front-idle`, `turn`, `side-run` (all `"direction":"forward"`). Record N and the tag ranges.
- If the tool is unavailable, stop: the MCP setup from spec §4 is missing.

Ask the user, and wait for the answer: "I'm about to create and edit art/avatar/shoes-starter, bottom-starter-shorts and top-starter-tee .aseprite through the Aseprite MCP. Please keep those three closed in Aseprite until I send the clothing checkpoint. If you want to open one before then, tell me first. Is the approved body.aseprite saved to disk?"

- [ ] **Step 2: Write the shared tool library**

```bash
mkdir -p .superpowers/art-tools/ops .superpowers/art-previews
```
Create `D:/Projects/Tracks/.superpowers/art-tools/garment-lib.lua`:
```lua
-- Shared helpers for the Task 17 clothing tools (throwaway, gitignored).
-- Loaded with dofile() by the other scripts in .superpowers/art-tools/.
local G = {}

G.ROOT = "D:/Projects/Tracks"
G.BODY = G.ROOT .. "/art/avatar/body.aseprite"
G.TOOLS = G.ROOT .. "/.superpowers/art-tools"
G.PREVIEWS = G.ROOT .. "/.superpowers/art-previews"
G.REF = "body-ref"

-- Clothing sources in draw order (body -> shoes -> bottom -> top), each with
-- the name of the one layer that holds the garment.
G.ORDER = { "shoes-starter", "bottom-starter-shorts", "top-starter-tee" }
G.LAYER = {
  ["shoes-starter"] = "shoes",
  ["bottom-starter-shorts"] = "shorts",
  ["top-starter-tee"] = "tee",
}

-- Placeholder ramps, packed 0xRRGGBB, equal to PLACEHOLDER_RAMPS in palette.ts.
G.SKIN = { light = 0xFF80FF, base = 0xFF40FF, shadow = 0xFF00FF }
G.CLOTH = { light = 0xFFFF80, base = 0xFFFF40, shadow = 0xFFFF00 }

G.N4 = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }
G.N8 = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 }, { 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 } }

local pc = app.pixelColor

function G.path(name)
  return G.ROOT .. "/art/avatar/" .. name .. ".aseprite"
end

function G.hex(rgb)
  return string.format("#%06X", rgb)
end

function G.ms(frame)
  return math.floor(frame.duration * 1000 + 0.5)
end

function G.skinShade(rgb)
  for shade, value in pairs(G.SKIN) do
    if value == rgb then return shade end
  end
  return nil
end

function G.isCloth(rgb)
  return rgb == G.CLOTH.light or rgb == G.CLOTH.base or rgb == G.CLOTH.shadow
end

-- A grid is { w, h, a = alpha[], c = packed rgb[] }, index y * w + x + 1.
function G.newGrid(w, h)
  local grid = { w = w, h = h, a = {}, c = {} }
  for i = 1, w * h do
    grid.a[i] = 0
    grid.c[i] = 0
  end
  return grid
end

function G.idx(grid, x, y)
  if x < 0 or y < 0 or x >= grid.w or y >= grid.h then return nil end
  return y * grid.w + x + 1
end

-- Opaque pixels overwrite; under the alpha 0/255 rule that equals Normal blend.
function G.addCel(grid, cel)
  if not cel then return end
  local pos = cel.position
  for it in cel.image:pixels() do
    local px = it()
    local a = pc.rgbaA(px)
    if a > 0 then
      local i = G.idx(grid, pos.x + it.x, pos.y + it.y)
      if i then
        grid.a[i] = a
        grid.c[i] = (pc.rgbaR(px) << 16) | (pc.rgbaG(px) << 8) | pc.rgbaB(px)
      end
    end
  end
end

local function addLayers(grid, layers, frame)
  for _, layer in ipairs(layers) do
    if layer.isVisible then
      if layer.isGroup then
        addLayers(grid, layer.layers, frame)
      else
        G.addCel(grid, layer:cel(frame))
      end
    end
  end
end

-- What a frame exports as: every visible layer, bottom to top.
function G.flatten(spr, frameNumber)
  local grid = G.newGrid(spr.width, spr.height)
  addLayers(grid, spr.layers, spr.frames[frameNumber])
  return grid
end

function G.layerGrid(spr, layer, frameNumber)
  local grid = G.newGrid(spr.width, spr.height)
  G.addCel(grid, layer:cel(spr.frames[frameNumber]))
  return grid
end

function G.toImage(grid)
  local img = Image(grid.w, grid.h, ColorMode.RGB)
  for y = 0, grid.h - 1 do
    for x = 0, grid.w - 1 do
      local i = y * grid.w + x + 1
      if grid.a[i] > 0 then
        local c = grid.c[i]
        img:drawPixel(x, y, pc.rgba((c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF, grid.a[i]))
      end
    end
  end
  return img
end

function G.topLayer(spr, name)
  for _, layer in ipairs(spr.layers) do
    if layer.name == name then return layer end
  end
  return nil
end

-- The body outline color: the most common color on the silhouette edge
-- (opaque pixels with a transparent or off-canvas 4-neighbor), all frames.
function G.outlineColor(body)
  local counts = {}
  for f = 1, #body.frames do
    local g = G.flatten(body, f)
    for y = 0, g.h - 1 do
      for x = 0, g.w - 1 do
        local i = G.idx(g, x, y)
        if g.a[i] > 0 then
          for _, d in ipairs(G.N4) do
            local j = G.idx(g, x + d[1], y + d[2])
            if j == nil or g.a[j] == 0 then
              counts[g.c[i]] = (counts[g.c[i]] or 0) + 1
              break
            end
          end
        end
      end
    end
  end
  local best, n = nil, 0
  for c, k in pairs(counts) do
    if k > n then best, n = c, k end
  end
  return best
end

function G.tags(spr)
  local list = {}
  for _, tag in ipairs(spr.tags) do
    list[#list + 1] = {
      name = tag.name,
      from = tag.fromFrame.frameNumber,
      to = tag.toFrame.frameNumber,
      forward = tag.aniDir == AniDir.FORWARD,
    }
  end
  return list
end

function G.tagOf(spr, frameNumber)
  for _, tag in ipairs(spr.tags) do
    if frameNumber >= tag.fromFrame.frameNumber and frameNumber <= tag.toFrame.frameNumber then
      return tag.name
    end
  end
  return "-"
end

-- Nearest-neighbor upscale onto an opaque background, for previews.
function G.savePreview(grid, scale, bg, file)
  local img = Image(grid.w * scale, grid.h * scale, ColorMode.RGB)
  local bgPx = pc.rgba((bg >> 16) & 0xFF, (bg >> 8) & 0xFF, bg & 0xFF, 255)
  for y = 0, grid.h - 1 do
    for x = 0, grid.w - 1 do
      local i = y * grid.w + x + 1
      local px = bgPx
      if grid.a[i] > 0 then
        local c = grid.c[i]
        px = pc.rgba((c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF, 255)
      end
      for sy = 0, scale - 1 do
        for sx = 0, scale - 1 do
          img:drawPixel(x * scale + sx, y * scale + sy, px)
        end
      end
    end
  end
  img:saveAs(file)
end

return G
```

- [ ] **Step 3: Write the failing test: the clothing source-rules check**

The check is read-only. It verifies:
- RGB mode, 64×64 canvas
- body's frame count, per-frame durations and tags (name, range, forward)
- a top-level hidden `body-ref` equal to the current flattened body (catches a stale reference)
- a visible garment layer, every visible layer at 255 opacity with Normal blend, every cel at 255
- per frame: alpha 0/255 only, colors only PH cloth plus the outline, at least one PH cloth pixel, nothing on row 0, nothing more than 1 px outside the body silhouette (catches misregistration against the body frame)

Create `D:/Projects/Tracks/.superpowers/art-tools/check-garments.lua`:
```lua
-- Checks the three clothing sources against body.aseprite and the source
-- rules (spec section 4). Read-only. Prints one line per problem and ends
-- with "RESULT: PASS" or "RESULT: FAIL (<n> problems)".
local G = dofile("D:/Projects/Tracks/.superpowers/art-tools/garment-lib.lua")

local problems = 0
local function fail(name, msg)
  problems = problems + 1
  print("FAIL " .. name .. ": " .. msg)
end

local body = app.open(G.BODY)
if not body then
  print("FAIL body: cannot open " .. G.BODY)
  print("RESULT: FAIL (1 problems)")
  return
end
local outline = G.outlineColor(body)
local bodyTags = G.tags(body)
local bodyGrids = {}
for f = 1, #body.frames do bodyGrids[f] = G.flatten(body, f) end
print("body: " .. #body.frames .. " frames, outline " .. G.hex(outline))

local function checkLayers(name, layers, depth)
  for _, layer in ipairs(layers) do
    if layer.isVisible then
      if layer.isGroup then
        checkLayers(name, layer.layers, depth + 1)
      else
        if layer.opacity ~= 255 then fail(name, "layer '" .. layer.name .. "' opacity " .. layer.opacity) end
        if layer.blendMode ~= BlendMode.NORMAL then fail(name, "layer '" .. layer.name .. "' is not Normal blend") end
        for _, cel in ipairs(layer.cels) do
          if cel.opacity ~= 255 then
            fail(name, "layer '" .. layer.name .. "' frame " .. cel.frameNumber .. " cel opacity " .. cel.opacity)
          end
        end
      end
    end
  end
end

local function sameGrid(a, b)
  for i = 1, a.w * a.h do
    if a.a[i] ~= b.a[i] or (a.a[i] > 0 and a.c[i] ~= b.c[i]) then return false end
  end
  return true
end

for _, name in ipairs(G.ORDER) do
  local path = G.path(name)
  local before = problems
  local spr = app.fs.isFile(path) and app.open(path) or nil
  if not spr then
    fail(name, "missing " .. path)
  else
    if spr.colorMode ~= ColorMode.RGB then fail(name, "not RGB color mode") end
    if spr.width ~= 64 or spr.height ~= 64 then fail(name, "canvas is " .. spr.width .. "x" .. spr.height) end
    if #spr.frames ~= #body.frames then
      fail(name, #spr.frames .. " frames, body has " .. #body.frames)
    else
      for f = 1, #body.frames do
        if G.ms(spr.frames[f]) ~= G.ms(body.frames[f]) then
          fail(name, "frame " .. f .. " lasts " .. G.ms(spr.frames[f]) .. " ms, body " .. G.ms(body.frames[f]) .. " ms")
        end
      end
    end
    local tags = G.tags(spr)
    if #tags ~= #bodyTags then fail(name, #tags .. " tags, body has " .. #bodyTags) end
    for _, bt in ipairs(bodyTags) do
      local match = nil
      for _, t in ipairs(tags) do
        if t.name == bt.name then match = t end
      end
      if not match then
        fail(name, "tag '" .. bt.name .. "' missing")
      elseif match.from ~= bt.from or match.to ~= bt.to or not match.forward then
        fail(name, "tag '" .. bt.name .. "' is " .. match.from .. "-" .. match.to .. " (body " .. bt.from .. "-" .. bt.to .. "), forward " .. tostring(match.forward))
      end
    end

    local ref = G.topLayer(spr, G.REF)
    local garment = G.topLayer(spr, G.LAYER[name])
    if not ref then fail(name, "no top-level '" .. G.REF .. "' layer") end
    if ref and ref.isVisible then fail(name, "'" .. G.REF .. "' must be hidden") end
    if not garment then fail(name, "no top-level '" .. G.LAYER[name] .. "' layer") end
    if garment and not garment.isVisible then fail(name, "'" .. G.LAYER[name] .. "' must be visible") end
    checkLayers(name, spr.layers, 0)

    if ref and #spr.frames == #body.frames then
      for f = 1, #spr.frames do
        if not sameGrid(G.layerGrid(spr, ref, f), bodyGrids[f]) then
          fail(name, "frame " .. f .. " body-ref differs from body.aseprite (re-run make-garment-sources.lua with MODE = \"refresh\")")
        end
      end
    end

    local frames = math.min(#spr.frames, #body.frames)
    for f = 1, frames do
      local g = G.flatten(spr, f)
      local b = bodyGrids[f]
      local cloth, bad, partial, off, top, first = 0, 0, 0, 0, 0, nil
      for y = 0, g.h - 1 do
        for x = 0, g.w - 1 do
          local i = G.idx(g, x, y)
          local a = g.a[i]
          if a > 0 then
            if a ~= 255 then partial = partial + 1 end
            local c = g.c[i]
            if G.isCloth(c) then
              cloth = cloth + 1
            elseif c ~= outline then
              bad = bad + 1
              first = first or ("(" .. x .. "," .. y .. ") " .. G.hex(c))
            end
            if y == 0 then top = top + 1 end
            local near = b.a[i] > 0
            if not near then
              for _, d in ipairs(G.N8) do
                local j = G.idx(b, x + d[1], y + d[2])
                if j and b.a[j] > 0 then near = true end
              end
            end
            if not near then off = off + 1 end
          end
        end
      end
      if cloth == 0 then fail(name, "frame " .. f .. " (" .. G.tagOf(spr, f) .. ") has no PH cloth pixel") end
      if bad > 0 then fail(name, "frame " .. f .. " has " .. bad .. " pixels that are neither PH cloth nor outline, first " .. first) end
      if partial > 0 then fail(name, "frame " .. f .. " has " .. partial .. " pixels with alpha other than 0 or 255") end
      if top > 0 then fail(name, "frame " .. f .. " has opaque pixels on row 0") end
      if off > 0 then fail(name, "frame " .. f .. " has " .. off .. " pixels more than 1 px outside the body silhouette") end
    end
    if problems == before then print("PASS " .. name .. ": " .. #spr.frames .. " frames") end
  end
end

if problems == 0 then
  print("RESULT: PASS")
else
  print("RESULT: FAIL (" .. problems .. " problems)")
end
```

- [ ] **Step 4: Run the check and see it fail**

Call `mcp__aseprite__run_lua_script` with:
```json
{ "script": "local ok, err = xpcall(dofile, debug.traceback, \"D:/Projects/Tracks/.superpowers/art-tools/check-garments.lua\"); if not ok then print(\"ERROR: \" .. err) end" }
```
Expected (FAIL):
```
body: N frames, outline #XXXXXX
FAIL shoes-starter: missing D:/Projects/Tracks/art/avatar/shoes-starter.aseprite
FAIL bottom-starter-shorts: missing D:/Projects/Tracks/art/avatar/bottom-starter-shorts.aseprite
FAIL top-starter-tee: missing D:/Projects/Tracks/art/avatar/top-starter-tee.aseprite
RESULT: FAIL (3 problems)
```
`#XXXXXX` must be the body's dark outline from palette.gpl. If it is a PH skin color, the body has no outline. Stop and raise it with the user, because Task 15's art breaks the "Dark outlines on characters" rule.

**Reading a failed call.** This applies to every `run_lua_script` call in Steps 4–19.
- **`ERROR: <file>:<line>: <message>` followed by `stack traceback:`.** This is an uncaught Lua error in the named tool or ops file, caught by the wrapper. Everything printed before it is still shown. Fix the line it names and repeat the same call. A check run that ends without a `RESULT:` line crashed this way.
- **The painter's `ERROR: ... (nothing saved)`.** This is the painter's own validation of an op. The source is unchanged.
- **`ERROR:` with a traceback printed after the painter's `SAVED` line.** The source was saved, and only the preview stage failed. Fix the cause and rerun the paint call.
- **A bare `Script failed:` with nothing after it.** Aseprite exited non-zero before the wrapper could catch anything, for example because of a typo in the one-line script itself. The MCP drops the output. Rerun the same script directly in Git Bash to see Aseprite's output. The middle line of the heredoc is the failing call's `script` value with each `\"` written as `"`:
  ```bash
  cat > .superpowers/art-tools/rerun.lua <<'EOF'
  local ok, err = xpcall(dofile, debug.traceback, "D:/Projects/Tracks/.superpowers/art-tools/check-garments.lua"); if not ok then print("ERROR: " .. err) end
  EOF
  "${ASEPRITE_PATH:-C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe}" --batch --script D:/Projects/Tracks/.superpowers/art-tools/rerun.lua
  ```

- [ ] **Step 5: Write the source generator**

The generator copies body.aseprite, so canvas, palette, frames, durations and tags are identical by construction. It flattens the body into one hidden `body-ref` layer (source rule 5) and adds one empty garment layer. It never overwrites a file. `MODE = "refresh"` re-syncs an existing file's body-ref, durations and tags after a body change.

Create `D:/Projects/Tracks/.superpowers/art-tools/make-garment-sources.lua`:
```lua
-- Creates the three clothing sources as copies of body.aseprite: same canvas,
-- palette, frames, durations and tags; the body flattened into one hidden
-- "body-ref" layer; one empty visible garment layer on top.
-- Existing files are never overwritten. With MODE = "refresh" set before
-- dofile(), existing files instead get body-ref, durations and tags re-synced
-- from body.aseprite and keep their garment pixels.
local G = dofile("D:/Projects/Tracks/.superpowers/art-tools/garment-lib.lua")

local body = app.open(G.BODY)
if not body then print("ERROR: cannot open " .. G.BODY) return end
if body.colorMode ~= ColorMode.RGB then print("ERROR: body.aseprite is not RGB") return end

local grids = {}
for f = 1, #body.frames do grids[f] = G.flatten(body, f) end

local function setRef(spr, ref)
  for f = 1, #spr.frames do
    local cel = ref:cel(spr.frames[f])
    if cel then spr:deleteCel(cel) end
    spr:newCel(ref, spr.frames[f], G.toImage(grids[f]), Point(0, 0))
  end
  ref.isVisible = false
end

for _, name in ipairs(G.ORDER) do
  local path = G.path(name)
  if not app.fs.isFile(path) then
    local spr = Sprite(body)
    local old = {}
    for _, layer in ipairs(spr.layers) do old[#old + 1] = layer end
    local ref = spr:newLayer()
    ref.name = G.REF
    for _, layer in ipairs(old) do spr:deleteLayer(layer) end
    for i = #spr.slices, 1, -1 do spr:deleteSlice(spr.slices[i]) end
    setRef(spr, ref)
    local garment = spr:newLayer()
    garment.name = G.LAYER[name]
    spr:saveAs(path)
    print("CREATED " .. path .. " (" .. #spr.frames .. " frames, layers " .. G.REF .. " hidden + " .. G.LAYER[name] .. ")")
    spr:close()
  elseif MODE == "refresh" then
    local spr = app.open(path)
    local ref = G.topLayer(spr, G.REF)
    if #spr.frames ~= #body.frames then
      print("ERROR: " .. name .. " has " .. #spr.frames .. " frames, body has " .. #body.frames .. "; its garment frames must be redrawn")
    elseif not ref then
      print("ERROR: " .. name .. " has no top-level " .. G.REF .. " layer")
    else
      for f = 1, #spr.frames do spr.frames[f].duration = body.frames[f].duration end
      for i = #spr.tags, 1, -1 do spr:deleteTag(spr.tags[i]) end
      for _, bt in ipairs(body.tags) do
        local tag = spr:newTag(bt.fromFrame.frameNumber, bt.toFrame.frameNumber)
        tag.name = bt.name
        tag.aniDir = bt.aniDir
        tag.color = bt.color
      end
      setRef(spr, ref)
      spr:saveAs(path)
      print("REFRESHED " .. path)
    end
    spr:close()
  else
    print("SKIP " .. path .. " exists (MODE = \"refresh\" re-syncs its body-ref)")
  end
end
```

- [ ] **Step 6: Create the three sources**

Call `mcp__aseprite__run_lua_script` with:
```json
{ "script": "local ok, err = xpcall(dofile, debug.traceback, \"D:/Projects/Tracks/.superpowers/art-tools/make-garment-sources.lua\"); if not ok then print(\"ERROR: \" .. err) end" }
```
Expected:
```
CREATED D:/Projects/Tracks/art/avatar/shoes-starter.aseprite (N frames, layers body-ref hidden + shoes)
CREATED D:/Projects/Tracks/art/avatar/bottom-starter-shorts.aseprite (N frames, layers body-ref hidden + shorts)
CREATED D:/Projects/Tracks/art/avatar/top-starter-tee.aseprite (N frames, layers body-ref hidden + tee)
```
Then call `mcp__aseprite__get_sprite_info` with `{ "filename": "D:/Projects/Tracks/art/avatar/top-starter-tee.aseprite" }`.
- Expected: `"color_mode":"rgb"`, the same `frames`, `durations_ms` and `tags` as body in Step 1.
- `"layers":[{"name":"body-ref","visible":false,...},{"name":"tee","visible":true,"opacity":255,...}]`

- [ ] **Step 7: Run the check. Only the drawing is missing now**

Make Step 4's call again. Expected (FAIL): only lines of the form `FAIL <name>: frame <f> (<tag>) has no PH cloth pixel`, one per frame of each of the three files, ending with `RESULT: FAIL (3N problems)`. Any other FAIL line (timing, tags, layers, body-ref) is a bug in Steps 5–6. Fix it before continuing.

- [ ] **Step 8: See art.test go red on the new sheets**

```bash
pnpm art:export
ls apps/web/src/assets/sprites/
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
```
Expected:
- `art:export` exits 0, and the listing includes the six new `shoes-starter`, `bottom-starter-shorts` and `top-starter-tee` `.png`/`.json` files.
- art.test FAILS with exactly 3 failed tests, one per new sheet. The sheets are fully transparent because body-ref is hidden and the garment layers are empty:
  ```
   FAIL  src/features/avatar/__tests__/art.test.ts > exported sheets > bottom-starter-shorts > uses only its own swap ramp's placeholders
   FAIL  src/features/avatar/__tests__/art.test.ts > exported sheets > shoes-starter > uses only its own swap ramp's placeholders
   FAIL  src/features/avatar/__tests__/art.test.ts > exported sheets > top-starter-tee > uses only its own swap ramp's placeholders
  ```
  Each one prints `AssertionError: expected [ Array(1) ] to deeply equal []`, and its diff's received line is `+   "uses no color of its swap ramp (#ffff80 #ffff40 #ffff00)",`. The summary reads `Tests  3 failed | <k> passed`.
- Every other test passes. That includes each new sheet's `uses only palette colors, at alpha 0 or 255`, `plays every tag forward, within its frames`, `uses 64x64 frames with a transparent top row` and `matches body.json frame count, durations and tags`. That proves the copy kept body's timing.

Do not commit these empty exports. Step 17 overwrites them.

- [ ] **Step 9: Dump the body as coordinate maps**

Create `D:/Projects/Tracks/.superpowers/art-tools/dump-body.lua`:
```lua
-- Prints each body frame as an ASCII map, cropped to the union bounding box
-- of all frames, with row numbers and a column ruler (absolute coordinates).
--   .  transparent      o  outline      l b d  skin light / base / shadow
--   *  any other color (eyes, mouth)
-- Optional globals set before dofile():
--   GARMENT = "<source basename>"  overlay that source's visible pixels in
--                                 capitals: L B D = cloth light/base/shadow,
--                                 O = garment outline
--   FRAMES = { 6, 7 }              only these frames (1-based)
local G = dofile("D:/Projects/Tracks/.superpowers/art-tools/garment-lib.lua")

local body = app.open(G.BODY)
if not body then print("ERROR: cannot open " .. G.BODY) return end
local outline = G.outlineColor(body)

local garment = nil
if GARMENT then
  garment = app.open(G.path(GARMENT))
  if not garment then print("ERROR: cannot open " .. G.path(GARMENT)) return end
  if #garment.frames ~= #body.frames then
    print("ERROR: " .. GARMENT .. " has " .. #garment.frames .. " frames, body has " .. #body.frames)
    return
  end
end

local frames = FRAMES
if frames then
  if type(frames) ~= "table" or #frames == 0 then print("ERROR: FRAMES must be a list such as { 6, 7 }") return end
  for _, f in ipairs(frames) do
    if math.type(f) ~= "integer" or f < 1 or f > #body.frames then
      print("ERROR: FRAMES entry " .. tostring(f) .. " is not a frame number 1-" .. #body.frames)
      return
    end
  end
else
  frames = {}
  for f = 1, #body.frames do frames[#frames + 1] = f end
end

local grids = {}
local x0, y0, x1, y1 = body.width, body.height, -1, -1
for f = 1, #body.frames do
  grids[f] = G.flatten(body, f)
  for y = 0, body.height - 1 do
    for x = 0, body.width - 1 do
      if grids[f].a[G.idx(grids[f], x, y)] > 0 then
        x0, y0 = math.min(x0, x), math.min(y0, y)
        x1, y1 = math.max(x1, x), math.max(y1, y)
      end
    end
  end
end
x0, y0 = math.max(0, x0 - 1), math.max(0, y0 - 1)
x1, y1 = math.min(body.width - 1, x1 + 1), math.min(body.height - 1, y1 + 1)

local SKIN_CH = { light = "l", base = "b", shadow = "d" }
local function ch(c)
  if c == outline then return "o" end
  local shade = G.skinShade(c)
  if shade then return SKIN_CH[shade] end
  return "*"
end
local function gch(c)
  if c == G.CLOTH.light then return "L" end
  if c == G.CLOTH.base then return "B" end
  if c == G.CLOTH.shadow then return "D" end
  if c == outline then return "O" end
  return "?"
end

local tens, ones = "    ", "    "
for x = x0, x1 do
  tens = tens .. tostring(math.floor(x / 10) % 10)
  ones = ones .. tostring(x % 10)
end

print("outline " .. G.hex(outline) .. "; columns " .. x0 .. "-" .. x1 .. ", rows " .. y0 .. "-" .. y1)
for _, f in ipairs(frames) do
  local b = grids[f]
  local g = garment and G.flatten(garment, f) or nil
  print("")
  print("frame " .. f .. " (" .. G.tagOf(body, f) .. ", " .. G.ms(body.frames[f]) .. " ms)" .. (GARMENT and (" + " .. GARMENT) or ""))
  print(tens)
  print(ones)
  for y = y0, y1 do
    local row = string.format("%3d ", y)
    for x = x0, x1 do
      local i = G.idx(b, x, y)
      if g and g.a[i] > 0 then
        row = row .. gch(g.c[i])
      elseif b.a[i] > 0 then
        row = row .. ch(b.c[i])
      else
        row = row .. "."
      end
    end
    print(row)
  end
end
```
Call `mcp__aseprite__run_lua_script` with:
```json
{ "script": "local ok, err = xpcall(dofile, debug.traceback, \"D:/Projects/Tracks/.superpowers/art-tools/dump-body.lua\"); if not ok then print(\"ERROR: \" .. err) end" }
```
Expected: an `outline #XXXXXX; columns a-b, rows c-d` header, then N maps. Each map has a `frame f (tag, ms)` title, a two-line column ruler (tens over ones) and one numbered line per row. Coordinates in the maps are the absolute cell coordinates used by every op below.

From the maps, note per frame:
- the neck and shoulder rows
- the row where the legs split (crotch)
- each foot's sole and ankle rows
- in `turn` (the ¾ view, its own drawing) and in `side-run`: which limbs are near, and where the near arm and near shin overlap the torso, hips or the other leg
- the skin bounding box of every near limb that overlaps a garment area, for the `limit` of its cut seed

- [ ] **Step 10: Write the garment painter**

The painter draws each garment against the hidden body-ref. Every masked body pixel is recolored from skin to PH cloth, keeping its light/base/shadow shade, and outline stays outline. The garment therefore follows the approved body's shape, shading and outline exactly, and never changes the silhouette.

Hems are automatic: cloth that touches bare skin becomes PH cloth shadow. Occlusion (spec §4, rule 6) is a `cut seed`. It removes a nearer limb's skin and its outline from the garment, so the body's limb shows through.

Create `D:/Projects/Tracks/.superpowers/art-tools/paint-garment.lua`:
```lua
-- Paints one garment layer from its ops file, drawn against the hidden
-- body-ref: every masked body pixel is recolored skin light/base/shadow ->
-- PH cloth light/base/shadow (outline stays outline), so the garment follows
-- the body's shape, shading and outline exactly. A cloth light/base pixel
-- that touches bare skin (4-neighbor, outside the mask) becomes PH cloth
-- shadow: the hem. Then "px" ops place single pixels.
-- Repaints EVERY frame of the garment layer; GUI touch-ups are lost, so put
-- touch-ups in "px" ops instead.
--
-- Set GARMENT = "<source basename>" before dofile(). Ops file:
-- .superpowers/art-tools/ops/<GARMENT>.lua returns one entry per frame
-- (1-based, same count as body). An entry is a list of ops applied in order:
--   { "add", rect = { x, y, w, h } }        mask += opaque body pixels in rect
--   { "add", poly = { x1, y1, x2, y2, ... } } same for a polygon (3+ points,
--                                            edges included)
--   { "cut", rect = ... } / { "cut", poly = ... }  mask -= region
--   { "cut", seed = { x, y }, limit = { x, y, w, h } }
--        mask -= the 4-connected skin component at the seed (flood stops at
--        outline, transparency and the optional limit rect) plus the outline
--        pixels 8-adjacent to it: a nearer limb, with its own outline
--   { "add", seed = ..., limit = ... }       mask += that component
--   { "px", at = { x, y }, color = "light" | "base" | "shadow" | "outline" | "clear" }
-- or { from = n, dx = 0, dy = 0 }: frame n's ops shifted by (dx, dy).
-- Afterwards it writes previews (body-ref plus every painted garment up to
-- this one, in draw order, 8x on the wall color) to
-- .superpowers/art-previews/<GARMENT>-fNN.png.
local G = dofile("D:/Projects/Tracks/.superpowers/art-tools/garment-lib.lua")

if not GARMENT or not G.LAYER[GARMENT] then
  print("ERROR: set GARMENT to shoes-starter, bottom-starter-shorts or top-starter-tee")
  return
end
local path = G.path(GARMENT)
local spr = app.open(path)
if not spr then print("ERROR: cannot open " .. path) return end
local ref = G.topLayer(spr, G.REF)
local layer = G.topLayer(spr, G.LAYER[GARMENT])
if not ref or not layer then print("ERROR: " .. GARMENT .. " needs top-level layers " .. G.REF .. " and " .. G.LAYER[GARMENT]) return end

local body = app.open(G.BODY)
if not body then print("ERROR: cannot open " .. G.BODY) return end
local outline = G.outlineColor(body)

local opsPath = G.TOOLS .. "/ops/" .. GARMENT .. ".lua"
local loaded, ops = pcall(dofile, opsPath)
if not loaded then print("ERROR: " .. tostring(ops)) return end
if type(ops) ~= "table" or #ops ~= #spr.frames then
  print("ERROR: " .. opsPath .. " must return " .. #spr.frames .. " frame entries")
  return
end

local function shifted(op, dx, dy)
  local out = { op[1], color = op.color }
  if op.rect then out.rect = { op.rect[1] + dx, op.rect[2] + dy, op.rect[3], op.rect[4] } end
  if op.limit then out.limit = { op.limit[1] + dx, op.limit[2] + dy, op.limit[3], op.limit[4] } end
  if op.seed then out.seed = { op.seed[1] + dx, op.seed[2] + dy } end
  if op.at then out.at = { op.at[1] + dx, op.at[2] + dy } end
  if op.poly then
    out.poly = {}
    for k = 1, #op.poly, 2 do
      out.poly[k] = op.poly[k] + dx
      out.poly[k + 1] = op.poly[k + 1] + dy
    end
  end
  return out
end

local function resolve(f, depth)
  local entry = ops[f]
  if type(entry) ~= "table" then error("frame " .. f .. ": entry is not a table") end
  if entry.from == nil then return entry end
  if depth > 8 then error("frame " .. f .. ": 'from' chain is longer than 8") end
  local list = {}
  for _, op in ipairs(resolve(entry.from, depth + 1)) do
    list[#list + 1] = shifted(op, entry.dx or 0, entry.dy or 0)
  end
  return list
end

local function rectSet(b, r)
  local set = {}
  for y = r[2], r[2] + r[4] - 1 do
    for x = r[1], r[1] + r[3] - 1 do
      local i = G.idx(b, x, y)
      if i then set[i] = true end
    end
  end
  return set
end

local function polySet(b, poly, f)
  if #poly < 6 or #poly % 2 ~= 0 then error("frame " .. f .. ": poly needs 3+ x,y pairs") end
  local xs, ys = {}, {}
  for k = 1, #poly, 2 do
    xs[#xs + 1] = poly[k]
    ys[#ys + 1] = poly[k + 1]
  end
  local set = {}
  local minX, maxX, minY, maxY = math.huge, -math.huge, math.huge, -math.huge
  for k = 1, #xs do
    minX, maxX = math.min(minX, xs[k]), math.max(maxX, xs[k])
    minY, maxY = math.min(minY, ys[k]), math.max(maxY, ys[k])
  end
  for y = minY, maxY do
    for x = minX, maxX do
      local inside, j = false, #xs
      for k = 1, #xs do
        if (ys[k] > y) ~= (ys[j] > y) and x < (xs[j] - xs[k]) * (y - ys[k]) / (ys[j] - ys[k]) + xs[k] then
          inside = not inside
        end
        j = k
      end
      local i = G.idx(b, x, y)
      if inside and i then set[i] = true end
    end
  end
  for k = 1, #xs do
    local x0, y0 = xs[k], ys[k]
    local x1, y1 = xs[k % #xs + 1], ys[k % #xs + 1]
    local dx, sx = math.abs(x1 - x0), x0 < x1 and 1 or -1
    local dy, sy = -math.abs(y1 - y0), y0 < y1 and 1 or -1
    local err = dx + dy
    while true do
      local i = G.idx(b, x0, y0)
      if i then set[i] = true end
      if x0 == x1 and y0 == y1 then break end
      local e2 = 2 * err
      if e2 >= dy then err = err + dy; x0 = x0 + sx end
      if e2 <= dx then err = err + dx; y0 = y0 + sy end
    end
  end
  return set
end

local function seedSet(b, op, f)
  local sx, sy = op.seed[1], op.seed[2]
  local l = op.limit or { 0, 0, b.w, b.h }
  local function inLimit(x, y)
    return x >= l[1] and y >= l[2] and x < l[1] + l[3] and y < l[2] + l[4]
  end
  local i0 = G.idx(b, sx, sy)
  if not i0 or b.a[i0] == 0 or not G.skinShade(b.c[i0]) then
    error("frame " .. f .. ": seed (" .. sx .. "," .. sy .. ") is not a skin pixel")
  end
  if not inLimit(sx, sy) then error("frame " .. f .. ": seed (" .. sx .. "," .. sy .. ") is outside its limit") end
  local set, stack = { [i0] = true }, { { sx, sy } }
  while #stack > 0 do
    local p = table.remove(stack)
    for _, d in ipairs(G.N4) do
      local nx, ny = p[1] + d[1], p[2] + d[2]
      local j = G.idx(b, nx, ny)
      if j and not set[j] and inLimit(nx, ny) and b.a[j] > 0 and G.skinShade(b.c[j]) then
        set[j] = true
        stack[#stack + 1] = { nx, ny }
      end
    end
  end
  local ring, n = {}, 0
  local x0, y0, x1, y1 = b.w, b.h, -1, -1
  for i in pairs(set) do
    local x, y = (i - 1) % b.w, (i - 1) // b.w
    n = n + 1
    x0, y0, x1, y1 = math.min(x0, x), math.min(y0, y), math.max(x1, x), math.max(y1, y)
    for _, d in ipairs(G.N8) do
      local j = G.idx(b, x + d[1], y + d[2])
      if j and not set[j] and inLimit(x + d[1], y + d[2]) and b.a[j] > 0 and b.c[j] == outline then ring[j] = true end
    end
  end
  for j in pairs(ring) do set[j] = true end
  print(string.format("  frame %d %s seed (%d,%d): %d skin px, x %d-%d, y %d-%d", f, op[1], sx, sy, n, x0, x1, y0, y1))
  return set
end

local COLORS = { light = G.CLOTH.light, base = G.CLOTH.base, shadow = G.CLOTH.shadow, outline = outline }

local function paintFrame(f, list)
  local b = G.layerGrid(spr, ref, f)
  local mask = {}
  for _, op in ipairs(list) do
    local kind = op[1]
    if kind == "add" or kind == "cut" then
      local set
      if op.rect then set = rectSet(b, op.rect)
      elseif op.poly then set = polySet(b, op.poly, f)
      elseif op.seed then set = seedSet(b, op, f)
      else error("frame " .. f .. ": " .. kind .. " needs rect, poly or seed") end
      for i in pairs(set) do
        if kind == "add" then
          if b.a[i] > 0 then mask[i] = true end
        else
          mask[i] = nil
        end
      end
    elseif kind ~= "px" then
      error("frame " .. f .. ": unknown op '" .. tostring(kind) .. "'")
    end
  end
  local out = G.newGrid(b.w, b.h)
  for i in pairs(mask) do
    local c = b.c[i]
    local shade = G.skinShade(c)
    out.a[i] = 255
    if shade then
      out.c[i] = G.CLOTH[shade]
    else
      out.c[i] = outline
      if c ~= outline then
        print(string.format("  WARN frame %d (%d,%d): body color %s under the garment became outline", f, (i - 1) % b.w, (i - 1) // b.w, G.hex(c)))
      end
    end
  end
  for i in pairs(mask) do
    if out.c[i] == G.CLOTH.light or out.c[i] == G.CLOTH.base then
      local x, y = (i - 1) % b.w, (i - 1) // b.w
      for _, d in ipairs(G.N4) do
        local j = G.idx(b, x + d[1], y + d[2])
        if j and not mask[j] and b.a[j] > 0 and G.skinShade(b.c[j]) then
          out.c[i] = G.CLOTH.shadow
          break
        end
      end
    end
  end
  for _, op in ipairs(list) do
    if op[1] == "px" then
      local i = G.idx(out, op.at[1], op.at[2])
      if not i then error("frame " .. f .. ": px (" .. op.at[1] .. "," .. op.at[2] .. ") is off the canvas") end
      if op.color == "clear" then
        out.a[i] = 0
      elseif COLORS[op.color] then
        out.a[i] = 255
        out.c[i] = COLORS[op.color]
      else
        error("frame " .. f .. ": px color must be light, base, shadow, outline or clear")
      end
    end
  end
  local counts, total = { [G.CLOTH.light] = 0, [G.CLOTH.base] = 0, [G.CLOTH.shadow] = 0, [outline] = 0 }, 0
  for i = 1, out.w * out.h do
    if out.a[i] > 0 then
      total = total + 1
      counts[out.c[i]] = counts[out.c[i]] + 1
    end
  end
  local cel = layer:cel(spr.frames[f])
  if cel then spr:deleteCel(cel) end
  if total > 0 then spr:newCel(layer, spr.frames[f], G.toImage(out), Point(0, 0)) end
  print(string.format("frame %2d (%s): %d px = light %d, base %d, shadow %d, outline %d", f, G.tagOf(spr, f), total,
    counts[G.CLOTH.light], counts[G.CLOTH.base], counts[G.CLOTH.shadow], counts[outline]))
end

local ok, err = pcall(function()
  for f = 1, #spr.frames do paintFrame(f, resolve(f, 0)) end
end)
if not ok then
  print("ERROR: " .. tostring(err) .. " (nothing saved)")
  return
end
spr:saveAs(path)
print("SAVED " .. path)

app.fs.makeAllDirectories(G.PREVIEWS)
local stack = {}
for _, name in ipairs(G.ORDER) do
  if name == GARMENT then
    stack[#stack + 1] = spr
    break
  end
  if app.fs.isFile(G.path(name)) then stack[#stack + 1] = app.open(G.path(name)) end
end
for f = 1, #spr.frames do
  local grid = G.layerGrid(spr, ref, f)
  for _, s in ipairs(stack) do
    local g = G.flatten(s, f)
    for i = 1, g.w * g.h do
      if g.a[i] > 0 then
        grid.a[i] = g.a[i]
        grid.c[i] = g.c[i]
      end
    end
  end
  G.savePreview(grid, 8, 0xD8C8A8, string.format("%s/%s-f%02d.png", G.PREVIEWS, GARMENT, f))
end
print(string.format("PREVIEWS %s/%s-f01.png .. -f%02d.png", G.PREVIEWS, GARMENT, #spr.frames))
```

**Ops rules (all three garments).** The ops files are data measured from Step 9's maps of the approved body. That is why their numbers can't be written into this plan.
- One entry per body frame, in order: exactly N entries. Coordinates are absolute (map row number and ruler column).
- `add` only ever takes opaque body pixels. A rect may overhang into transparency, but it must not reach body parts the garment leaves bare.
- Rule 6 applies to every frame: `front-idle`, the ¾ `turn` frame and `side-run`. Any nearer bare part that lies inside an add region gets `{ "cut", seed = { x, y }, limit = { x, y, w, h } }`.
  - The seed goes on one of the limb's `l`/`b`/`d` pixels.
  - `limit` boxes just that limb: its skin bounding box from the map, plus 1 px on every side for its outline. It never spans the torso band or the other arm.
  - The painter prints each seed's skin count and bbox. If the bbox reaches past the limb into the torso, the limb isn't outlined there. Tighten `limit`, or remove the limb with a `cut` poly instead.
  - Clothed parts of a cut limb (the near sleeve) are re-added with an `add` after the cut.
- Far limbs: a far-limb pixel inside a region stays only where that part of the far limb is clothed (far sleeve, far thigh, far foot). Otherwise cut it. The painter only recolors body pixels that are visible in the flattened body, so a far limb's hidden part is never drawn.
- Use `{ from = n, dx = .., dy = .. }` only where the map shows that the body's garment area is frame n moved by (dx, dy), such as run bob. A `from` frame also reuses frame n's seed and `limit`, so the near limb must be in the same place relative to the shift. Otherwise write the frame out.
- Hems are automatic, so don't draw them. `px` is only for a few deliberate details per frame (collar dip, toe cap), in PH cloth shades or `outline`. The check allows at most 1 px outside the silhouette.
- Pattern only, using numbers from a test body. Yours come from your maps. A side-run tee frame is a torso band, then a hole for the near arm, then the near sleeve added back. The test body's near arm skin was x 32–43, y 32–42 (the painter's seed line), so its limit is that box grown by 1 px for the outline: x 31–44, y 31–43.
  ```lua
  {
    { "add", poly = { 28, 31, 36, 31, 36, 44, 28, 44 } },
    { "cut", seed = { 32, 33 }, limit = { 31, 31, 14, 13 } },
    { "add", rect = { 27, 32, 11, 4 } },
  },
  ```

- [ ] **Step 11: Shoes: write the ops and paint**

Create `D:/Projects/Tracks/.superpowers/art-tools/ops/shoes-starter.lua` returning N entries:
- **front-idle:** each foot from its sole (the lowest body row of that foot, including the outline row) up to 1 row above the ankle. That is about the bottom 4 rows of each leg.
- **turn (¾, measured from the turn map, not copied from front-idle):** the same sole-to-ankle rule on each ¾ foot. If the map shows the near shin or foot overlapping the far foot, `cut` seed the near shin, with `limit` covering only the near shin rows above the near shoe.
- **side-run:** each foot's whole shape plus 1 row above it, in contact and flight frames alike (follow each foot as it lifts). Where the near shin crosses the far foot, keep the near shin in front with a `cut` seed on the shin, and a `limit` covering only the shin rows above the near shoe.

Call `mcp__aseprite__run_lua_script` with:
```json
{ "script": "GARMENT = \"shoes-starter\"; local ok, err = xpcall(dofile, debug.traceback, \"D:/Projects/Tracks/.superpowers/art-tools/paint-garment.lua\"); if not ok then print(\"ERROR: \" .. err) end" }
```
Expected:
- N lines `frame f (tag): P px = light a, base b, shadow c, outline d`, each with P > 0 and no `WARN` lines
- `SAVED D:/Projects/Tracks/art/avatar/shoes-starter.aseprite`
- `PREVIEWS ... shoes-starter-f01.png .. -fNN.png`

Any `ERROR:` line: see "Reading a failed call" in Step 4, fix the named frame's op, and rerun.

- [ ] **Step 12: Shoes: inspect, then check**

Read every `D:/Projects/Tracks/.superpowers/art-previews/shoes-starter-fNN.png` (8×, placeholders magenta/yellow on the wall color). Verify:
- both feet are shod in every frame
- shins and knees stay skin
- the near shin stays in front of the far shoe in side-run
- turn frame: both shoes follow the ¾ feet, and the near leg stays in front of the far shoe wherever they overlap
- the shoe line stays at the same height relative to the foot across each tag's frames

For any doubtful frame, overlay the garment on the map (garment pixels in capitals) with `mcp__aseprite__run_lua_script`:
```json
{ "script": "GARMENT = \"shoes-starter\"; FRAMES = { 6 }; local ok, err = xpcall(dofile, debug.traceback, \"D:/Projects/Tracks/.superpowers/art-tools/dump-body.lua\"); if not ok then print(\"ERROR: \" .. err) end" }
```
Put the doubtful frame numbers in `FRAMES`. Edit the ops and repeat Step 11 until it is right.

Then make Step 4's call. Expected on the first pass, while the shorts and tee are still empty:
```
body: N frames, outline #XXXXXX
PASS shoes-starter: N frames
FAIL bottom-starter-shorts: frame 1 (front-idle) has no PH cloth pixel
...
RESULT: FAIL (2N problems)
```
Every remaining FAIL is a `no PH cloth pixel` line for the shorts or the tee. On any later re-run, all three garments are already painted, so expect Step 16's PASS block instead.

- [ ] **Step 13: Shorts: write the ops and paint**

Create `D:/Projects/Tracks/.superpowers/art-tools/ops/bottom-starter-shorts.lua` returning N entries:
- **All views:** from the waist, 3 rows above the row where the legs split, down to mid-thigh, about 6 rows below the split (roughly half the thigh). Cover both legs, near and far.
- **front-idle:** hands hanging beside the hips stay skin. Keep the rect between the arms, or `cut` seed each hand.
- **turn (¾, measured from the turn map):** waist and split rows come from that map. If the near hand or forearm hangs over the hip, it is a `cut` seed limited to that arm, as in side-run. A far hand inside the region is cut too. The far thigh is covered only where the body shows it.
- **side-run:** the near hand or forearm swinging across the hips is a `cut` seed, limited to the arm. Any visible far hand inside the region is also cut.

Call `mcp__aseprite__run_lua_script` with:
```json
{ "script": "GARMENT = \"bottom-starter-shorts\"; local ok, err = xpcall(dofile, debug.traceback, \"D:/Projects/Tracks/.superpowers/art-tools/paint-garment.lua\"); if not ok then print(\"ERROR: \" .. err) end" }
```
Expected: N frame lines with P > 0, no `WARN`, a `SAVED .../bottom-starter-shorts.aseprite` line and a `PREVIEWS` line. The previews stack body + shoes + shorts. Any `ERROR:` line: see Step 4.

- [ ] **Step 14: Shorts: inspect, then check**

Read every `bottom-starter-shorts-fNN.png`. Verify:
- hands and forearms are skin and in front of the shorts in side-run
- turn frame: the near arm and hand stay skin and in front of the shorts, and the far leg shows shorts only where the body shows the far thigh
- the hem is level and doesn't jump between consecutive frames of a tag beyond the body's own motion
- the gap between the legs below the crotch stays open wherever the body has one

Use the overlay dump from Step 12 with `GARMENT = \"bottom-starter-shorts\"` for doubtful frames, and iterate Step 13 until it is right. Then make Step 4's call.

Expected on the first pass, while the tee is still empty: `PASS shoes-starter: N frames`, `PASS bottom-starter-shorts: N frames`, N `top-starter-tee ... has no PH cloth pixel` lines and `RESULT: FAIL (N problems)`. On any later re-run, expect Step 16's PASS block instead.

- [ ] **Step 15: Tee: write the ops and paint**

Create `D:/Projects/Tracks/.superpowers/art-tools/ops/top-starter-tee.lua` returning N entries. Read the shorts' top row per frame from Step 13's ops.
- **Torso, all views:** from the shoulder row (the first row below the neck where the silhouette widens) down to 1 row below the shorts' top row. The top is drawn over the bottom, so the two overlap and no midriff shows. The neck stays bare, and the automatic hem draws the collar.
  - On breathing frames, where the torso top moves but the waistline doesn't, write that frame's own rows. Don't `from`-shift it, so the hem never jumps.
- **front-idle sleeves:** each upper arm from the shoulder down 4 rows, as one `add` rect per arm. Forearms and hands stay skin.
- **turn (¾, rule 6, measured from the turn map):**
  - `add` the ¾ torso band.
  - If the near arm overlaps the torso edge, `cut` seed the near arm, limited to that arm. Then `add` back its sleeve: the first ~4 px of the near upper arm from the shoulder.
  - If the near arm doesn't overlap the torso, use one sleeve rect per arm as in front-idle.
  - The far upper arm gets a sleeve only where the body shows it beside the torso. A far forearm or hand inside the band is cut.
- **side-run (rule 6):**
  - `add` the torso band.
  - `cut` seed on the near arm, limited to the arm. This leaves the hole where the near arm crosses the torso.
  - `add` back the near sleeve: the first ~4 px of the near upper arm from the shoulder.
  - Where the far upper arm shows beside the torso, it is far sleeve. Any far forearm or hand inside the band is cut.

Call `mcp__aseprite__run_lua_script` with:
```json
{ "script": "GARMENT = \"top-starter-tee\"; local ok, err = xpcall(dofile, debug.traceback, \"D:/Projects/Tracks/.superpowers/art-tools/paint-garment.lua\"); if not ok then print(\"ERROR: \" .. err) end" }
```
Expected:
- N frame lines with P > 0 and no `WARN`
- every side-run frame also prints a `  frame f cut seed (x,y): k skin px, x a-b, y c-d` line, and so does the turn frame if it has a cut. Each bbox covers only the near arm.
- `SAVED .../top-starter-tee.aseprite` and `PREVIEWS` lines. The previews stack body + shoes + shorts + tee.

Any `ERROR:` line: see Step 4.

- [ ] **Step 16: Tee: inspect, then check (green)**

Read every `top-starter-tee-fNN.png`. Verify:
- In side-run, the near sleeve is over the torso, and the bare near forearm and hand are drawn over the tee (the hole) and over the shorts.
- Turn frame: the near forearm and hand are skin and in front of the tee. The far sleeve shows only where the body shows the far upper arm, and both sleeves read as the same length.
- No skin shows between the tee hem and the shorts.
- Head, neck, hands and forearms are skin.
- Sleeves have the same length on both arms in front-idle.
- Nothing flickers between consecutive frames of a tag.

Use the overlay dump from Step 12 with `GARMENT = \"top-starter-tee\"` for doubtful frames, and iterate Step 15 until it is right. Then make Step 4's call. Expected (PASS):
```
body: N frames, outline #XXXXXX
PASS shoes-starter: N frames
PASS bottom-starter-shorts: N frames
PASS top-starter-tee: N frames
RESULT: PASS
```

- [ ] **Step 17: Export and see art.test pass**

```bash
pnpm art:export
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts
pnpm --filter @tracks/web test
```
Expected:
- `art:export` exits 0.
- art.test PASS (0 failed), including the `shoes-starter`, `bottom-starter-shorts` and `top-starter-tee` tests that failed in Step 8.
- The full web suite PASSes with no warnings or console errors (rule 26). `sheets.ts` now parses the three new sheets through `import.meta.glob`.

- [ ] **Step 18: Write and run the checkpoint composite**

This throwaway script reads the exported sheets. It swaps them with the app's own `palette.ts` ramps and `swapPixels()`, and stacks them in the runtime draw order. It makes three outfits that use every clothing color once per slot, on three skin tones. The pairings include white shoes on tone-1 and black shorts on tone-6.

Create `D:/Projects/Tracks/.superpowers/art-tools/composite-clothing.mts`:
```ts
// Throwaway checkpoint composite (Task 17). Reads the EXPORTED sheets, swaps
// them with the app's own palette.ts ramps and swapPixels(), and stacks them
// in the runtime draw order (body -> shoes -> bottom -> top). Writes one PNG
// per outfit, 8x: one row per body tag, one column per frame, on the wall
// color. Three outfits use every clothing color once per slot.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { CLOTH_RAMPS, PLACEHOLDER_RAMPS, SKIN_RAMPS } from '../../apps/web/src/features/avatar/palette.js';
import { buildSwap, swapPixels, type Swap } from '../../apps/web/src/features/avatar/swap.js';

const ROOT = 'D:/Projects/Tracks';
const SPRITES = `${ROOT}/apps/web/src/assets/sprites`;
const OUT = `${ROOT}/.superpowers/art-previews`;
const SCALE = 8;
const GAP = 1;
const CELL = 64;
const BACKGROUND = 0xd8c8a8;

interface PngImage {
  width: number;
  height: number;
  data: Uint8Array;
}
interface PngModule {
  PNG: {
    new (options: { width: number; height: number }): PngImage;
    sync: { read(buffer: Uint8Array): PngImage; write(png: PngImage): Uint8Array };
  };
}
const { PNG } = createRequire(`${ROOT}/apps/web/package.json`)('pngjs') as PngModule;

interface SheetJson {
  frames: Array<{ frame: { x: number; y: number; w: number; h: number } }>;
  meta: { frameTags: Array<{ name: string; from: number; to: number }> };
}
interface Layer {
  id: string;
  json: SheetJson;
  width: number;
  rgba: Uint8ClampedArray;
}

function loadLayer(id: string, swap: Swap): Layer {
  const json = JSON.parse(readFileSync(`${SPRITES}/${id}.json`, 'utf8')) as SheetJson;
  const png = PNG.sync.read(readFileSync(`${SPRITES}/${id}.png`));
  const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
  return { id, json, width: png.width, rgba: swapPixels(rgba, swap) };
}

type SkinTone = keyof typeof SKIN_RAMPS;
type ClothItem = keyof typeof CLOTH_RAMPS;
const OUTFITS: ReadonlyArray<{ skin: SkinTone; shoes: ClothItem; bottom: ClothItem; top: ClothItem }> = [
  { skin: 'tone-1', shoes: 'starter-shoes-white', bottom: 'starter-shorts-navy', top: 'starter-tee-red' },
  { skin: 'tone-3', shoes: 'starter-shoes-black', bottom: 'starter-shorts-gray', top: 'starter-tee-blue' },
  { skin: 'tone-6', shoes: 'starter-shoes-red', bottom: 'starter-shorts-black', top: 'starter-tee-green' },
];

mkdirSync(OUT, { recursive: true });
OUTFITS.forEach((outfit, n) => {
  const cloth = (item: ClothItem): Swap => buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS[item]);
  const layers = [
    loadLayer('body', buildSwap(PLACEHOLDER_RAMPS.skin, SKIN_RAMPS[outfit.skin])),
    loadLayer('shoes-starter', cloth(outfit.shoes)),
    loadLayer('bottom-starter-shorts', cloth(outfit.bottom)),
    loadLayer('top-starter-tee', cloth(outfit.top)),
  ];
  const [body] = layers;
  if (!body) throw new Error('body sheet missing');
  for (const layer of layers) {
    if (layer.json.frames.length !== body.json.frames.length) {
      throw new Error(`${layer.id} has ${layer.json.frames.length} frames, body has ${body.json.frames.length}`);
    }
  }
  const tags = body.json.meta.frameTags;
  const cols = Math.max(...tags.map((t) => t.to - t.from + 1));
  const w = (cols * CELL + (cols + 1) * GAP) * SCALE;
  const h = (tags.length * CELL + (tags.length + 1) * GAP) * SCALE;
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) {
    out.data[i * 4] = (BACKGROUND >> 16) & 0xff;
    out.data[i * 4 + 1] = (BACKGROUND >> 8) & 0xff;
    out.data[i * 4 + 2] = BACKGROUND & 0xff;
    out.data[i * 4 + 3] = 255;
  }
  tags.forEach((tag, row) => {
    for (let index = tag.from; index <= tag.to; index++) {
      const ox = GAP + (index - tag.from) * (CELL + GAP);
      const oy = GAP + row * (CELL + GAP);
      for (const layer of layers) {
        const rect = layer.json.frames[index]?.frame;
        if (!rect) throw new Error(`${layer.id} has no frame ${index}`);
        for (let y = 0; y < rect.h; y++) {
          for (let x = 0; x < rect.w; x++) {
            const s = ((rect.y + y) * layer.width + rect.x + x) * 4;
            if ((layer.rgba[s + 3] ?? 0) === 0) continue;
            for (let sy = 0; sy < SCALE; sy++) {
              for (let sx = 0; sx < SCALE; sx++) {
                const d = (((oy + y) * SCALE + sy) * w + (ox + x) * SCALE + sx) * 4;
                out.data[d] = layer.rgba[s] ?? 0;
                out.data[d + 1] = layer.rgba[s + 1] ?? 0;
                out.data[d + 2] = layer.rgba[s + 2] ?? 0;
                out.data[d + 3] = 255;
              }
            }
          }
        }
      }
    }
  });
  const file = `${OUT}/clothing-outfit-${n + 1}.png`;
  writeFileSync(file, PNG.sync.write(out));
  console.log(`${file}: ${outfit.skin}, ${outfit.top}, ${outfit.bottom}, ${outfit.shoes} (rows: ${tags.map((t) => t.name).join(', ')})`);
});
```
Run:
```bash
npx tsx .superpowers/art-tools/composite-clothing.mts
```
Expected, three lines:
```
D:/Projects/Tracks/.superpowers/art-previews/clothing-outfit-1.png: tone-1, starter-tee-red, starter-shorts-navy, starter-shoes-white (rows: front-idle, turn, side-run)
D:/Projects/Tracks/.superpowers/art-previews/clothing-outfit-2.png: tone-3, starter-tee-blue, starter-shorts-gray, starter-shoes-black (rows: front-idle, turn, side-run)
D:/Projects/Tracks/.superpowers/art-previews/clothing-outfit-3.png: tone-6, starter-tee-green, starter-shorts-black, starter-shoes-red (rows: front-idle, turn, side-run)
```
Read all three PNGs yourself before sending. Verify:
- no magenta or yellow placeholder pixel anywhere (every pixel was swapped)
- the occlusion points from Steps 12, 14 and 16 hold in real colors, including the turn row
- every colorway reads against its skin tone and the wall. Check these in particular:
  - white shoes on tone-1 (outfit 1)
  - black shoes and gray shorts on tone-3, against the wall (outfit 2)
  - black shorts against the tone-6 thighs (outfit 3)

Anything wrong: fix the ops and re-run the affected garment's paint and inspect steps (11–16). Then run Step 17 (export, art.test and the web suite) and this step again.

- [ ] **Step 19: Clothing checkpoint with the user**

Load the tool with `ToolSearch` (`select:SendUserFile`). Send the three files:
- `D:/Projects/Tracks/.superpowers/art-previews/clothing-outfit-1.png`
- `D:/Projects/Tracks/.superpowers/art-previews/clothing-outfit-2.png`
- `D:/Projects/Tracks/.superpowers/art-previews/clothing-outfit-3.png`

Send them with this message: "Clothing checkpoint: starter tee, shorts and shoes on the approved body, in all three colors per slot (8x; rows front-idle, turn, side-run). Approve, or tell me what to change. If you open shoes-starter, bottom-starter-shorts or top-starter-tee .aseprite in Aseprite, please save and close them before I make changes."

Wait for an explicit approval. Do not continue without it.

Rules for every change loop in this step:
- **Before any MCP edit.** This means the painter (Steps 11, 13, 15) or a `make-garment-sources.lua` refresh or re-create. First ask: "Are shoes-starter, bottom-starter-shorts and top-starter-tee .aseprite saved and closed in Aseprite?" Wait for the answer. Don't edit a file the user says is open.
  - After the edit, tell the user: "Done. You can reopen them (File > Open, or Reopen Closed File)."
  - Read-only calls (the check, dump-body, `pnpm art:export`, Step 18) need the files saved, not closed.
- **Re-runs.** All three garments are already painted, so every check (Step 4's call) must print Step 16's PASS block: `PASS` for all three and `RESULT: PASS`. The FAIL expectations in Steps 12 and 14 apply to the first pass only.
- **GUI-edited garments.** Keep track of which garments the user has edited in the GUI. The painter repaints every frame from the ops file, so it would erase that work. Never run it on a GUI-edited garment without the consent described in the third path below.

Change paths:
1. **Change requested through me, garment not GUI-edited:** ask (above). Edit the ops, re-run Steps 11–18 for the affected garments (paint, inspect, check, export with art.test and the web suite, composite), and re-send.
2. **The user edits in the Aseprite GUI:** they save and close the file. Mark the garment as GUI-edited. Then:
   - Make Step 4's call. Expect `RESULT: PASS`. Any FAIL is a source-rule break in the GUI edit: tell the user which frame and rule.
   - Run Step 17's commands. Expect PASS.
   - Run Step 18, and re-send.
3. **Change requested through me on a GUI-edited garment:** don't run the painter on it. Offer the user two options:
   - (a) They make the change in the GUI, and then path 2 applies.
   - (b) With their explicit consent to discard the GUI edits, follow the steps below. The garment is no longer GUI-edited afterwards.
     1. Back the file up: `mkdir -p .superpowers/art-backup && cp art/avatar/<name>.aseprite .superpowers/art-backup/<name>-gui.aseprite`.
     2. Run the overlay dump (Step 12's call with `GARMENT` set to that garment, and `FRAMES` listing the frames they edited) and keep the output.
     3. Ask (above), then add `px` ops for every GUI change the user wants kept, read from that dump.
     4. Run path 1. Rerun the same overlay dump, and compare the kept pixels until they match.
4. **Body changes, same frame count (after the user re-approves the body):** ask (above), then call `mcp__aseprite__run_lua_script` with:
   ```json
   { "script": "MODE = \"refresh\"; local ok, err = xpcall(dofile, debug.traceback, \"D:/Projects/Tracks/.superpowers/art-tools/make-garment-sources.lua\"); if not ok then print(\"ERROR: \" .. err) end" }
   ```
   Expect three `REFRESHED` lines. Then re-run Steps 9–18. For a GUI-edited garment, follow path 3 instead of running its paint step.
5. **Body frame count changes from N to M:** the refresh prints `ERROR: <name> has N frames, body has M; its garment frames must be redrawn` and changes nothing.
   - If any garment is GUI-edited, first get the user's explicit consent to discard those edits.
   - Ask (above), then back up and delete the three sources:
     ```bash
     mkdir -p .superpowers/art-backup
     cp art/avatar/shoes-starter.aseprite art/avatar/bottom-starter-shorts.aseprite art/avatar/top-starter-tee.aseprite .superpowers/art-backup/
     rm art/avatar/shoes-starter.aseprite art/avatar/bottom-starter-shorts.aseprite art/avatar/top-starter-tee.aseprite
     ```
   - Re-run Step 6. Expect three `CREATED ... (M frames, ...)` lines.
   - Re-run Step 7. Expect only `no PH cloth pixel` lines and `RESULT: FAIL (3M problems)`.
   - Re-run Steps 9–18 with M in place of N. Rewrite every ops file from the new maps with M entries, because the old coordinates don't carry over. The first-pass expectations in Steps 12 and 14 apply again.

- [ ] **Step 20: Verify everything is clean**

```bash
pnpm art:export
pnpm --filter @tracks/web test
git status --porcelain
pnpm --filter @tracks/web typecheck
pnpm --filter @tracks/web lint
pnpm --filter @tracks/web build
```
Expected:
- The web suite, art.test included, PASSes against the final exports with no warnings or console errors (rule 26). This covers exports changed by the Step 18 or Step 19 loops.
- `git status --porcelain` prints exactly these lines and nothing else, so body and any other existing sheets re-exported byte-identically:
  ```
  ?? apps/web/src/assets/sprites/bottom-starter-shorts.json
  ?? apps/web/src/assets/sprites/bottom-starter-shorts.png
  ?? apps/web/src/assets/sprites/shoes-starter.json
  ?? apps/web/src/assets/sprites/shoes-starter.png
  ?? apps/web/src/assets/sprites/top-starter-tee.json
  ?? apps/web/src/assets/sprites/top-starter-tee.png
  ?? art/avatar/bottom-starter-shorts.aseprite
  ?? art/avatar/shoes-starter.aseprite
  ?? art/avatar/top-starter-tee.aseprite
  ```
- Typecheck, lint and build pass with zero errors and zero warnings. The build bundles the three new sheets through `sheets.ts`. Nothing under `.superpowers/` appears, because it is gitignored.

- [ ] **Step 21: Commit**

```bash
git add art/avatar/shoes-starter.aseprite art/avatar/bottom-starter-shorts.aseprite art/avatar/top-starter-tee.aseprite apps/web/src/assets/sprites/shoes-starter.png apps/web/src/assets/sprites/shoes-starter.json apps/web/src/assets/sprites/bottom-starter-shorts.png apps/web/src/assets/sprites/bottom-starter-shorts.json apps/web/src/assets/sprites/top-starter-tee.png apps/web/src/assets/sprites/top-starter-tee.json
git commit -F - <<'EOF'
Add starter tee, shorts and shoes art

Each clothing source is a copy of body.aseprite with the body flattened
into a hidden body-ref layer, so frames, durations and tags match body.
The garments use only the PH cloth ramp and the outline, and leave holes
where a nearer limb crosses them (source rule 6), so the fixed draw order
body, shoes, bottom, top shows near limbs in front. Exports regenerated
with pnpm art:export; the clothing checkpoint was approved.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 22: Confirm the export is reproducible on a clean tree**

```bash
pnpm art:export
git status --porcelain art apps/web/src/assets/sprites
```
Expected: no output (spec §5, Done when 3).

---

### Task 18: Art: room (background, treadmill, frame, trophies, medals, plant)

All art is made through the aseprite MCP. The server is named `aseprite`, so its tools appear as `mcp__aseprite__<tool>`. Every path below is absolute and starts with `D:/Projects/Tracks`, which is the output of `git rev-parse --show-toplevel`. If your checkout is somewhere else (a worktree, for example), replace that prefix in every path in Steps 10-22, including the `dofile(...)` lines.

The tool names and parameters were checked against `aseprite_mcp/tools/*.py`:
- `run_lua_script(script, filename="")`
- `create_slice(filename, name, x, y, width, height)`
- `set_slice_pivot(filename, name, x, y)`
- `list_slices(filename)`
- `export_frame(filename, frame_index, output_filename, scale)`
- `export_tag(filename, tag_name, output_filename, scale)`

**How the scripts report failure.** With `filename` omitted, `run_lua_script` runs `aseprite --batch --script <tmp>.lua`. When Lua raises an error, Aseprite prints the error to stdout and exits with code 127. On a non-zero exit the MCP returns only stderr, which is empty, so the reply is a bare `Script failed: ` with no text after it. To get the message back, every script below runs its body inside `pcall` and prints `ERROR: <message>`, and Aseprite then exits 0 so the MCP returns stdout.

- **A reply containing an `ERROR:` line** means the step failed. Read the message.
- **A bare `Script failed: ` with no text after it** means the script never started: either the pasted Lua has a syntax error or Aseprite failed to launch. To see that error, save the script with the Write tool as `D:/Projects/Tracks/.superpowers/art-lua/debug.lua`, then run this from the repo root in Git Bash: `"${ASEPRITE_PATH:-C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe}" --batch --script .superpowers/art-lua/debug.lua`. Aseprite prints the error with its line number.
- **The dedicated tools** (`create_slice`, `set_slice_pivot`, `list_slices`, `export_tag`) report their own failures as `Failed to ...: <reason>`.

**Files:**
- Create: `apps/web/src/features/avatar-room/__tests__/roomRules.ts` (pure helpers for the room art check)
- Test: `apps/web/src/features/avatar-room/__tests__/roomRules.test.ts`
- Test: `apps/web/src/features/avatar-room/__tests__/roomArt.test.ts`
- Create (via MCP): `art/room/background.aseprite`, `art/room/treadmill.aseprite`, `art/room/frame-bib.aseprite`, `art/room/trophy-gold.aseprite`, `art/room/trophy-silver.aseprite`, `art/room/trophy-bronze.aseprite`, `art/room/medal-gold.aseprite`, `art/room/medal-silver.aseprite`, `art/room/medal-bronze.aseprite`, `art/room/plant.aseprite`
- Create (generated by `pnpm art:export`): `apps/web/src/assets/sprites/{background,treadmill,frame-bib,trophy-gold,trophy-silver,trophy-bronze,medal-gold,medal-silver,medal-bronze,plant}.{png,json}` (20 files)
- Scratch files, gitignored and never committed: `.superpowers/art-lua/room-prelude.lua`, `.superpowers/art-previews/{room-preview.aseprite,room.png,room-run.gif,belt.gif}`

**Interfaces:**
- Consumes:
  - `art/palette.gpl` (Task 14). The scripts look up fixed colors by name: `outline`, `white`, `metal light`, `metal`, `metal shadow`, `belt stripe`, `belt`, `wall`, `wall shadow`, `trim`, `floor`, `floor lines`, `wood light`, `dark wood`, `wood shadow`, `glass light`, `glass`, `glass shadow`, `gold light`, `gold`, `gold shadow`, `bronze light`, `bronze`, `bronze shadow`, `red`, `red shadow`, `blue`, `blue shadow`, `leaf light`, `leaf`, `leaf shadow`, `terracotta`. No placeholder colors are used.
  - `art/avatar/body.aseprite` with `apps/web/src/assets/sprites/body.json` and `body.png` (Task 15). These give the `front-idle` and `side-run` tags, side-run's per-frame durations and the planted foot's travel. The travel is measured on ground row y = 63, which soles touch only in contact frames.
  - `pnpm art:export` (`scripts/export-art.ts`, Task 14).
  - `apps/web/src/features/avatar/__tests__/art.test.ts` (Task 14). It validates every exported sheet: palette-only colors, alpha 0 or 255, no placeholders in room sheets, forward tags, a `belt` tag with side-run's frame count and durations, a `rider` slice with a pivot, and every background slot slice.
  - `interface RgbaImage { width: number; height: number; data: Uint8Array }` from `apps/web/src/features/avatar/__tests__/sheetRules.ts` (Task 14).
  - Contract code from earlier tasks:
    - `SHEETS` and `getSheet(id, registry?)`, plus the types `SheetData`, `SheetId`, `SheetSlice` and `SheetFrame`, from `apps/web/src/features/avatar/sheets.ts`
    - `tagFrames(sheet, tag): TagFrame[]` from `apps/web/src/features/avatar/frames.ts`
    - `SAMPLE_ROOM` and `SampleRoom` from `apps/web/src/features/avatar-room/sampleRoom.ts`
    - `layoutRoom(room, registry?): RoomLayout` and `RoomLayout` from `apps/web/src/features/avatar-room/roomLayout.ts`
  - `pngjs`, `@types/pngjs` and `@types/node`, which Task 14 added as apps/web devDependencies.
- Produces:
  - Sheet IDs (`SheetId`, contract): `background`, `treadmill`, `frame-bib`, `trophy-gold`, `trophy-silver`, `trophy-bronze`, `medal-gold`, `medal-silver`, `medal-bronze`, `plant`. They are json-array exports. The glob in `sheets.ts` adds them to `SHEETS`, so no code changes.
  - `background.json` is one 180x120 frame. Its `meta.slices[].keys[0].bounds` are sprite-local:

    | slice | x | y | w | h | alignment | v1 item (size) | item draw position |
    |---|---|---|---|---|---|---|---|
    | `trophy-1` | 58 | 12 | 16 | 20 | standing | `trophy-gold` (14x18) | (59, 14) |
    | `trophy-2` | 77 | 12 | 16 | 20 | standing | `trophy-silver` (14x17) | (78, 15) |
    | `trophy-3` | 96 | 12 | 16 | 20 | standing | `trophy-bronze` (14x16) | (97, 16) |
    | `medal-1` | 61 | 52 | 14 | 20 | hanging | `medal-gold` (10x18) | (63, 52) |
    | `medal-2` | 78 | 52 | 14 | 20 | hanging | `medal-silver` (10x18) | (80, 52) |
    | `medal-3` | 95 | 52 | 14 | 20 | hanging | `medal-bronze` (10x18) | (97, 52) |
    | `frame` | 128 | 14 | 36 | 28 | hanging | `frame-bib` (32x24) | (130, 14) |
    | `equipment` | 94 | 62 | 84 | 50 | standing | `treadmill` (80x48) | (96, 64) |
    | `decor` | 18 | 72 | 24 | 40 | standing | `plant` (20x36) | (20, 76) |

    Each slot's width minus its item's width is even, so centering gives the same position whether it rounds down or to nearest. With the treadmill at (96, 64), the avatar's feet land at **(128, 101)**, and its 64x64 cell spans x 96..159 and y 38..101.
  - `treadmill.json` has N frames of 80x48, where N is the frame count of body's side-run.
    - Tag `belt`: from 0 to N-1, `forward`, with the same durations as side-run.
    - Slice `rider`: bounds {x 16, y 0, w 32, h 38}, pivot {x 16, y 37}. That puts the foot point at treadmill-local (32, 37).
    - Belt surface: x 6..59 on rows y = 38 and 39. Each frame moves the stripes S px toward -x, where S is the planted foot's travel per frame.
    - Stripe spacing P: the smallest divisor of N·S that is more than 2·S, at least 6, and at most (54 + (N-1)·S) / 2.
    - Above the belt, nothing is drawn left of x = 48. The console is at the right end.
  - New test helpers in `roomRules.ts` (not in the contract):
    - `type Rect = Pick<SheetFrame, 'x' | 'y' | 'w' | 'h'>`
    - `interface SoleSpan { left: number; right: number }`
    - `pixelAt(image: RgbaImage, x: number, y: number): number`
    - `rowPixels(image: RgbaImage, x0: number, y: number, length: number): number[]`
    - `soleSpan(image: RgbaImage, frame: Rect): SoleSpan | null`
    - `plantedFootTravels(soles: readonly (SoleSpan | null)[]): number[]`
    - `rowPeriod(row: readonly number[]): number | null`
    - `rowShift(from: readonly number[], to: readonly number[]): number | null`
    - `beltSpan(rows: readonly (readonly number[])[], from: number, to: number): { from: number; to: number } | null`
    - `beltMotionProblems(rows: readonly (readonly number[])[], travel: number): string[]`

- [ ] **Step 1: Write the failing test for the room art helpers**

Create `apps/web/src/features/avatar-room/__tests__/roomRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RgbaImage } from '../../avatar/__tests__/sheetRules.js';
import {
  beltMotionProblems,
  beltSpan,
  pixelAt,
  plantedFootTravels,
  rowPeriod,
  rowPixels,
  rowShift,
  soleSpan,
} from './roomRules.js';

const BELT = 0x2c2e36;
const STRIPE = 0x464a56;

/** A w x h image; `opaque` lists [x, y, 0xRRGGBB] pixels at alpha 255. */
function image(w: number, h: number, opaque: Array<[number, number, number]>): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  for (const [x, y, color] of opaque) {
    const o = (y * w + x) * 4;
    data[o] = (color >> 16) & 0xff;
    data[o + 1] = (color >> 8) & 0xff;
    data[o + 2] = color & 0xff;
    data[o + 3] = 255;
  }
  return { width: w, height: h, data };
}

/** A 32 px belt window (the rider slice's width): 2 px stripes every
 * `spacing` px, moved back by `offset` px. */
function beltRow(spacing: number, offset: number): number[] {
  return Array.from({ length: 32 }, (_, x) => ((x + offset) % spacing < 2 ? STRIPE : BELT));
}

/** n belt frames, each moved back `shift` px from the one before. */
function beltCycle(n: number, spacing: number, shift: number): number[][] {
  return Array.from({ length: n }, (_, i) => beltRow(spacing, (i * shift) % spacing));
}

describe('pixelAt', () => {
  it('packs an opaque pixel and returns -1 for transparent or outside pixels', () => {
    const img = image(2, 1, [[1, 0, 0x8c5e3c]]);
    expect(pixelAt(img, 1, 0)).toBe(0x8c5e3c);
    expect(pixelAt(img, 0, 0)).toBe(-1);
    expect(pixelAt(img, 2, 0)).toBe(-1);
  });
});

describe('rowPixels', () => {
  it('reads `length` pixels of one row, starting at x0', () => {
    const img = image(4, 2, [[2, 1, 0x8c5e3c]]);
    expect(rowPixels(img, 1, 1, 3)).toEqual([-1, 0x8c5e3c, -1]);
  });
});

describe('soleSpan', () => {
  it("reads the frame's bottom row, in frame-local x", () => {
    const img = image(8, 4, [
      [5, 3, 1],
      [6, 3, 1],
      [5, 1, 1],
    ]);
    expect(soleSpan(img, { x: 4, y: 0, w: 4, h: 4 })).toEqual({ left: 1, right: 2 });
  });

  it('is null in a flight frame', () => {
    expect(soleSpan(image(4, 4, [[1, 2, 1]]), { x: 0, y: 0, w: 4, h: 4 })).toBeNull();
  });
});

describe('plantedFootTravels', () => {
  it('measures the backward sole travel between contact frames, wrapping the loop', () => {
    // Only the last -> first pair (36 -> 34) adds the second travel.
    const soles = [
      { left: 34, right: 38 },
      null,
      { left: 38, right: 42 },
      { left: 36, right: 40 },
    ];
    expect(plantedFootTravels(soles)).toEqual([2, 2]);
  });

  it('skips foot changes and spans that move unevenly', () => {
    const soles = [
      { left: 30, right: 34 },
      { left: 36, right: 40 },
      { left: 35, right: 38 },
    ];
    expect(plantedFootTravels(soles)).toEqual([]);
  });
});

describe('rowPeriod', () => {
  it('finds the stripe spacing', () => {
    expect(rowPeriod(beltRow(8, 0))).toBe(8);
  });

  it('is null when no pattern repeats at least twice', () => {
    expect(rowPeriod([1, 2, 3, 4, 5, 6])).toBeNull();
  });
});

describe('rowShift', () => {
  it('measures how far the texture moved backward', () => {
    expect(rowShift(beltRow(8, 0), beltRow(8, 3))).toBe(3);
  });

  it('is null when no offset matches', () => {
    const plain = Array.from({ length: 32 }, () => BELT);
    expect(rowShift(beltRow(8, 0), plain)).toBeNull();
  });
});

describe('beltSpan', () => {
  const O = 0x1e1a24;

  it('grows from the part under the rider over the colors seen there, in every frame', () => {
    const rows = [
      [-1, O, BELT, STRIPE, BELT, BELT, STRIPE, BELT, O, -1],
      [-1, O, STRIPE, BELT, BELT, STRIPE, BELT, BELT, O, -1],
    ];
    expect(beltSpan(rows, 3, 5)).toEqual({ from: 2, to: 7 });
  });

  it('is null when a frame has a transparent pixel under the rider', () => {
    expect(beltSpan([[O, BELT, -1, BELT, O]], 1, 3)).toBeNull();
  });
});

describe('beltMotionProblems', () => {
  it('accepts a belt that moves with the planted foot and loops seamlessly', () => {
    expect(beltMotionProblems(beltCycle(8, 8, 2), 2)).toEqual([]);
  });

  it('measures stripe spacings longer than half the window across the cycle', () => {
    expect(beltMotionProblems(beltCycle(8, 20, 5), 5)).toEqual([]);
    expect(beltMotionProblems(beltCycle(8, 28, 7), 7)).toEqual([]);
  });

  it('reports a shift that differs from the foot travel', () => {
    expect(beltMotionProblems(beltCycle(8, 8, 2), 3)).toContain(
      'belt frame 0 -> 1 shifts 2 px (planted foot travels 3 px)',
    );
  });

  it('reports stripes too close together for the shift', () => {
    expect(beltMotionProblems(beltCycle(4, 6, 3), 3)).toEqual([
      'stripe spacing 6 px is not more than twice the 3 px shift',
    ]);
  });

  it('reports a cycle that does not move whole stripe spacings', () => {
    expect(beltMotionProblems(beltCycle(6, 8, 2), 2)).toEqual([
      'belt frame 5 -> 0 shifts 6 px (planted foot travels 2 px)',
      'one cycle shifts 12 px, not a whole number of 8 px stripe spacings',
    ]);
  });

  it('reports a belt without a repeating pattern', () => {
    expect(beltMotionProblems([[1, 2, 3, 4, 5, 6]], 2)).toContain(
      'the belt surface has no repeating stripe pattern',
    );
  });

  it('reports a belt with no frames', () => {
    expect(beltMotionProblems([], 2)).toEqual(['the belt has no frames']);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/roomRules.test.ts`
Expected: FAIL with `Error: Failed to resolve import "./roomRules.js" from "src/features/avatar-room/__tests__/roomRules.test.ts". Does the file exist?` (`Plugin: vite:import-analysis`), then `Test Files  1 failed (1)` and `Tests  no tests`.

- [ ] **Step 3: Implement the helpers**

Create `apps/web/src/features/avatar-room/__tests__/roomRules.ts`:

```ts
// Pure helpers for the room art check (roomArt.test.ts). They take decoded PNG
// pixels and plain numbers, so roomRules.test.ts covers them with hand-built
// inputs and no exported art.
import type { RgbaImage } from '../../avatar/__tests__/sheetRules.js';
import type { SheetFrame } from '../../avatar/sheets.js';

/** A source rect in a sheet PNG: a SheetFrame without its duration. */
export type Rect = Pick<SheetFrame, 'x' | 'y' | 'w' | 'h'>;

/** Leftmost and rightmost opaque x on a frame's bottom row, frame-local. */
export interface SoleSpan {
  left: number;
  right: number;
}

/** Packed 0xRRGGBB of an opaque pixel; -1 where alpha is 0 or outside the image. */
export function pixelAt(image: RgbaImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return -1;
  const o = (y * image.width + x) * 4;
  const d = image.data;
  if ((d[o + 3] ?? 0) === 0) return -1;
  return ((d[o] ?? 0) << 16) | ((d[o + 1] ?? 0) << 8) | (d[o + 2] ?? 0);
}

/** `length` pixelAt values of row y, starting at x0. */
export function rowPixels(image: RgbaImage, x0: number, y: number, length: number): number[] {
  return Array.from({ length }, (_, i) => pixelAt(image, x0 + i, y));
}

/** The sole on a frame's bottom row (the avatar's ground row, y = 63), or null
 * in a flight frame. */
export function soleSpan(image: RgbaImage, frame: Rect): SoleSpan | null {
  const row = rowPixels(image, frame.x, frame.y + frame.h - 1, frame.w);
  const left = row.findIndex((c) => c !== -1);
  if (left === -1) return null;
  const right = row.length - 1 - [...row].reverse().findIndex((c) => c !== -1);
  return { left, right };
}

/**
 * The planted foot's backward travel per frame: for each consecutive pair of
 * contact frames (the last wraps to the first) whose sole moved toward -x by
 * the same amount at both ends, that amount. Pairs where the feet change, or
 * where a sole changes width, are skipped.
 */
export function plantedFootTravels(soles: readonly (SoleSpan | null)[]): number[] {
  const travels: number[] = [];
  soles.forEach((a, i) => {
    const b = soles[(i + 1) % soles.length];
    if (!a || !b) return;
    const travel = a.left - b.left;
    if (travel > 0 && travel === a.right - b.right) travels.push(travel);
  });
  return travels;
}

/** Smallest p, at most half the row, with row[x] === row[x + p] everywhere;
 * null when no pattern repeats at least twice. */
export function rowPeriod(row: readonly number[]): number | null {
  for (let p = 1; p <= Math.floor(row.length / 2); p++) {
    let repeats = true;
    for (let x = 0; x + p < row.length; x++) {
      if (row[x] !== row[x + p]) {
        repeats = false;
        break;
      }
    }
    if (repeats) return p;
  }
  return null;
}

/** True when `to` is `from` moved k px toward -x: to[x] === from[x + k]
 * wherever both exist. */
function shiftsBy(from: readonly number[], to: readonly number[], k: number): boolean {
  for (let x = 0; x + k < from.length; x++) {
    if (to[x] !== from[x + k]) return false;
  }
  return true;
}

/** Smallest k, at most half the row, by which `to` is `from` moved toward -x
 * (backward under a right-facing runner); null when no offset matches. */
export function rowShift(from: readonly number[], to: readonly number[]): number | null {
  for (let k = 0; k <= Math.floor(from.length / 2); k++) {
    if (shiftsBy(from, to, k)) return k;
  }
  return null;
}

/**
 * The x range of the belt surface on one row of every belt frame: [from, to]
 * (the part under the rider) grown outward while each frame's pixel is a color
 * seen under the rider in some frame. null when a frame has a transparent
 * pixel under the rider.
 */
export function beltSpan(
  rows: readonly (readonly number[])[],
  from: number,
  to: number,
): { from: number; to: number } | null {
  const seen = rows.flatMap((row) => row.slice(from, to + 1));
  if (seen.length === 0 || seen.includes(-1)) return null;
  const colors = new Set(seen);
  const isBelt = (x: number): boolean => rows.every((row) => colors.has(row[x] ?? -1));
  let start = from;
  let end = to;
  while (start > 0 && isBelt(start - 1)) start--;
  while (isBelt(end + 1)) end++;
  return { from: start, to: end };
}

/**
 * The belt rules (spec section 1): `rows` is the belt surface in each belt
 * frame, over the same x range. Every step, including last to first, moves the
 * texture backward by the planted foot's `travel`; the stripe spacing is more
 * than twice that; one cycle moves a whole number of stripe spacings.
 */
export function beltMotionProblems(
  rows: readonly (readonly number[])[],
  travel: number,
): string[] {
  const first = rows[0];
  if (first === undefined) return ['the belt has no frames'];
  const problems: string[] = [];
  rows.forEach((row, i) => {
    const j = (i + 1) % rows.length;
    const next = rows[j] ?? first;
    if (shiftsBy(row, next, travel)) return;
    const shift = rowShift(row, next);
    const moved = shift === null ? 'by no single offset' : `${shift} px`;
    problems.push(`belt frame ${i} -> ${j} shifts ${moved} (planted foot travels ${travel} px)`);
  });
  // When every step moves the texture back by `travel`, the frames are windows
  // onto one strip: the first row plus the `travel` px each later frame shows
  // at its right end. Its period is measurable up to half the strip, which is
  // longer than one frame's row.
  const strip =
    problems.length === 0
      ? [...first, ...rows.slice(1).flatMap((row) => row.slice(row.length - travel))]
      : [...first];
  const spacing = rowPeriod(strip);
  if (spacing === null) return [...problems, 'the belt surface has no repeating stripe pattern'];
  if (2 * travel >= spacing) {
    problems.push(`stripe spacing ${spacing} px is not more than twice the ${travel} px shift`);
  }
  const cycle = rows.length * travel;
  if (cycle % spacing !== 0) {
    problems.push(
      `one cycle shifts ${cycle} px, not a whole number of ${spacing} px stripe spacings`,
    );
  }
  return problems;
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/roomRules.test.ts`
Expected: PASS, with `Test Files  1 passed (1)` and `Tests  19 passed (19)`.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint`
Expected: both exit 0 with no errors or warnings.

- [ ] **Step 6: Commit the helpers**

```bash
git add apps/web/src/features/avatar-room/__tests__/roomRules.ts apps/web/src/features/avatar-room/__tests__/roomRules.test.ts
git commit -F - <<'EOF'
test(web): add room art rules for belt motion and sole travel

Pure helpers for the room art check: the sole span and planted-foot
travel of body side-run, the belt surface span, and the belt's
per-frame shift and stripe period, measured on the belt joined into
one strip over a cycle. Unit-tested on hand-built pixels.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 7: Write the failing room art test**

Create `apps/web/src/features/avatar-room/__tests__/roomArt.test.ts`:

```ts
// @vitest-environment node
/// <reference types="node" />
// Room art check (spec section 1 Scale and belt rules, section 3 Room
// composition). It reads the committed exports in src/assets/sprites, so it
// needs no Aseprite. Palette, placeholder, tag and slice-presence rules for
// every sheet are in avatar/__tests__/art.test.ts; this file checks that the
// room pieces fit together, through the app's own registry and layout.
import { existsSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import type { RgbaImage } from '../../avatar/__tests__/sheetRules.js';
import { tagFrames } from '../../avatar/frames.js';
import {
  getSheet,
  SHEETS,
  type SheetData,
  type SheetId,
  type SheetSlice,
} from '../../avatar/sheets.js';
import { layoutRoom, type RoomLayout } from '../roomLayout.js';
import { SAMPLE_ROOM, type SampleRoom } from '../sampleRoom.js';
import {
  beltMotionProblems,
  beltSpan,
  pixelAt,
  plantedFootTravels,
  rowPixels,
  soleSpan,
  type Rect,
} from './roomRules.js';

const SPRITES_DIR = new URL('../../../assets/sprites/', import.meta.url);

/** The room's native size (spec section 1 Scale). */
const ROOM: Rect = { x: 0, y: 0, w: 180, h: 120 };
/** The avatar cell and its anchor pixel (spec section 1 Scale). */
const CELL = 64;
const ANCHOR = { x: 32, y: 63 };

interface LoadedSheet {
  sheet: SheetData;
  image: RgbaImage;
}

const loaded = new Map<SheetId, LoadedSheet>();

/** A sheet from the app's registry (SHEETS) with its decoded PNG. */
function load(id: SheetId): LoadedSheet {
  const cached = loaded.get(id);
  if (cached) return cached;
  const pngFile = new URL(`${id}.png`, SPRITES_DIR);
  if (!SHEETS.has(id) || !existsSync(pngFile)) {
    throw new Error(`${id}.json and ${id}.png must be exported (run pnpm art:export)`);
  }
  const result: LoadedSheet = {
    sheet: getSheet(id),
    image: PNG.sync.read(readFileSync(pngFile)),
  };
  loaded.set(id, result);
  return result;
}

/** Each background slot slice with the SAMPLE_ROOM item layoutRoom puts in it. */
function slotItems(room: SampleRoom): Array<[slot: string, item: SheetId]> {
  return [
    ...room.trophies.map((id, i): [string, SheetId] => [`trophy-${i + 1}`, id]),
    ...room.medals.map((id, i): [string, SheetId] => [`medal-${i + 1}`, id]),
    ['frame', room.frame],
    ['equipment', room.equipment],
    ['decor', room.decor],
  ];
}

/** layoutRoom(SAMPLE_ROOM) on the exported sheets, after checking each is exported. */
function sampleLayout(): RoomLayout {
  load('background');
  for (const [, id] of slotItems(SAMPLE_ROOM)) load(id);
  return layoutRoom(SAMPLE_ROOM);
}

function frameRect(sheet: SheetData, index: number): Rect {
  const frame = sheet.frames[index];
  if (!frame) throw new Error(`${sheet.id} has no frame ${index}`);
  return frame;
}

function tagRects(sheet: SheetData, tag: string): Rect[] {
  return tagFrames(sheet, tag).map(({ index }) => frameRect(sheet, index));
}

function slice(sheet: SheetData, name: string): SheetSlice {
  const found = sheet.slices.find((s) => s.name === name);
  if (!found) throw new Error(`${sheet.id} has no slice "${name}"`);
  return found;
}

/** treadmill's rider slice; its pivot (slice-relative) is the foot point. */
function rider(treadmill: SheetData): SheetSlice & { pivot: { x: number; y: number } } {
  const found = slice(treadmill, 'rider');
  const { pivot } = found;
  if (!pivot) throw new Error(`${treadmill.id}'s "rider" slice has no pivot`);
  return { ...found, pivot };
}

function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

describe('room art', () => {
  it('has a single-frame 180x120 background with no transparent pixel', () => {
    const { sheet, image } = load('background');
    expect(sheet.frames).toHaveLength(1);
    const frame = frameRect(sheet, 0);
    expect([frame.w, frame.h]).toEqual([ROOM.w, ROOM.h]);
    let holes = 0;
    for (let y = 0; y < frame.h; y++) {
      for (let x = 0; x < frame.w; x++) {
        if (pixelAt(image, frame.x + x, frame.y + y) === -1) holes++;
      }
    }
    expect(holes).toBe(0);
  });

  it('fits every v1 sample item in its slot and every placed sprite in the room', () => {
    const background = load('background').sheet;
    const problems: string[] = [];
    for (const [name, id] of slotItems(SAMPLE_ROOM)) {
      const slot = slice(background, name);
      const item = frameRect(load(id).sheet, 0);
      if (item.w > slot.w || item.h > slot.h) {
        problems.push(
          `${id} is ${item.w}x${item.h}, larger than slice ${name} (${slot.w}x${slot.h})`,
        );
      }
    }
    for (const sprite of sampleLayout().sprites) {
      const { w, h } = frameRect(getSheet(sprite.sheet), 0);
      if (!inside({ x: sprite.x, y: sprite.y, w, h }, ROOM)) {
        problems.push(`${sprite.sheet} at (${sprite.x}, ${sprite.y}) reaches outside the room`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('stands the avatar cell on the rider pivot, inside the room', () => {
    const feet = sampleLayout().avatarFeet;
    const cell: Rect = { x: feet.x - ANCHOR.x, y: feet.y - ANCHOR.y, w: CELL, h: CELL };
    expect(inside(cell, ROOM), `avatar cell ${JSON.stringify(cell)}`).toBe(true);
  });

  it('has a belt under the foot point, a clear rider area and a right-end console', () => {
    const { sheet, image } = load('treadmill');
    const r = rider(sheet);
    const footX = r.x + r.pivot.x;
    const beltY = r.y + r.pivot.y + 1;
    const right = r.x + r.w;
    const problems: string[] = [];
    sheet.frames.forEach((frame, i) => {
      if (pixelAt(image, frame.x + footX, frame.y + beltY) === -1) {
        problems.push(`frame ${i}: no belt under the foot point`);
      }
      // Above the belt, only the front (console) end may be drawn: nothing
      // over the rider area or behind it.
      for (let y = 0; y < beltY; y++) {
        for (let x = 0; x < right; x++) {
          if (pixelAt(image, frame.x + x, frame.y + y) !== -1) {
            problems.push(
              `frame ${i}: (${x}, ${y}) is drawn above the belt, left of x = ${right}`,
            );
            return;
          }
        }
      }
    });
    // The console end: something drawn in the upper half of the space above
    // the belt, right of the rider area.
    const first = frameRect(sheet, 0);
    const top = Math.floor(beltY / 2);
    let consolePixels = 0;
    for (let y = 0; y < top; y++) {
      for (let x = right; x < first.w; x++) {
        if (pixelAt(image, first.x + x, first.y + y) !== -1) consolePixels++;
      }
    }
    if (consolePixels === 0) {
      problems.push(
        `nothing is drawn above y = ${top} right of x = ${right}: no console at the right end`,
      );
    }
    expect(problems).toEqual([]);
  });

  it('moves the belt backward with the planted foot of body side-run', () => {
    const { sheet, image } = load('treadmill');
    const body = load('body');
    const soles = tagRects(body.sheet, 'side-run').map((frame) => soleSpan(body.image, frame));
    const travels = plantedFootTravels(soles);
    const noContact = 'side-run needs a planted sole moving backward on row 63';
    expect(travels.length, noContact).toBeGreaterThan(0);
    const varies = `planted-foot travel varies: ${travels.join(', ')} px`;
    expect(new Set(travels).size, varies).toBe(1);
    const travel = travels[0] ?? 0;

    const r = rider(sheet);
    const beltY = r.y + r.pivot.y + 1;
    const fullRows = tagRects(sheet, 'belt').map((frame) =>
      rowPixels(image, frame.x, frame.y + beltY, frame.w),
    );
    const span = beltSpan(fullRows, r.x, r.x + r.w - 1);
    if (!span) {
      throw new Error(`a belt frame has a transparent pixel under the rider on y = ${beltY}`);
    }
    const rows = fullRows.map((row) => row.slice(span.from, span.to + 1));
    expect(beltMotionProblems(rows, travel)).toEqual([]);
  });
});
```

- [ ] **Step 8: Run it and confirm it fails**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/roomArt.test.ts`
Expected: FAIL with `Tests  5 failed (5)`. The first three tests fail with `Error: background.json and background.png must be exported (run pnpm art:export)`. The last two fail with `Error: treadmill.json and treadmill.png must be exported (run pnpm art:export)`. body.json already exists from Task 15. If the run instead fails with `Failed to resolve import`, then a file from an earlier task is missing (`sheets.ts`, `frames.ts`, `sampleRoom.ts`, `roomLayout.ts` or `sheetRules.ts`). Stop and finish that task first.

- [ ] **Step 9: Prepare the workspace**

Run:

```bash
git rev-parse --show-toplevel
git branch --show-current
ls art/palette.gpl art/avatar/body.aseprite apps/web/src/assets/sprites/body.json apps/web/src/assets/sprites/body.png
mkdir -p art/room .superpowers/art-lua .superpowers/art-previews
git check-ignore -q .superpowers/art-lua/room-prelude.lua && echo "scratch is gitignored"
```

Expected output, in order:
1. `D:/Projects/Tracks`
2. `feat/avatar-room`
3. The four paths, with no `No such file` error.
4. `scratch is gitignored`

Then confirm the `mcp__aseprite__run_lua_script` tool is available. If it isn't, run `claude mcp get aseprite` and finish the MCP setup in spec section 4. The art/room files are new, so none of them can be open in the Aseprite GUI.

- [ ] **Step 10: Write the shared Lua prelude (scratch, not committed)**

With the Write tool, create `D:/Projects/Tracks/.superpowers/art-lua/room-prelude.lua`:

```lua
-- Shared helpers for the Task 18 room scripts. Each script passed to the
-- aseprite MCP's run_lua_script loads this file with dofile inside a pcall.
-- Not committed: .superpowers/ is gitignored.
local M = {}
M.ROOT = "D:/Projects/Tracks"
M.GPL = M.ROOT .. "/art/palette.gpl"
M.ROOM = M.ROOT .. "/art/room/"

-- Fixed colors are looked up by their art/palette.gpl name, so every pixel is
-- an exact palette color at alpha 255 (art.test.ts checks the exports).
local named, rgba = {}, false
local file = io.open(M.GPL, "r")
if not file then error("cannot open " .. M.GPL) end
for line in file:lines() do
  line = line:gsub("\r$", "")
  if line:match("^Channels:%s*RGBA") then rgba = true end
  local r, g, b, name
  if rgba then
    r, g, b, name = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)%s+%d+%s+(.-)%s*$")
  else
    r, g, b, name = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)%s+(.-)%s*$")
  end
  if r and name ~= "" then
    named[name] = app.pixelColor.rgba(tonumber(r), tonumber(g), tonumber(b), 255)
  end
end
file:close()

function M.C(name)
  local color = named[name]
  if color == nil then error("art/palette.gpl has no color named '" .. name .. "'") end
  return color
end

function M.rect(img, x, y, w, h, c)
  for yy = y, y + h - 1 do
    for xx = x, x + w - 1 do img:drawPixel(xx, yy, c) end
  end
end

function M.hline(img, x1, x2, y, c)
  for xx = x1, x2 do img:drawPixel(xx, y, c) end
end

function M.vline(img, x, y1, y2, c)
  for yy = y1, y2 do img:drawPixel(x, yy, c) end
end

-- Draws ASCII rows at (x0, y0): "." is transparent, any other character is
-- looked up in key (character -> palette.gpl color name).
function M.grid(img, x0, y0, rows, key)
  for y, row in ipairs(rows) do
    if #row ~= #rows[1] then
      error("grid row " .. y .. " has " .. #row .. " pixels, expected " .. #rows[1])
    end
    for x = 1, #row do
      local ch = row:sub(x, x)
      if ch ~= "." then
        local name = key[ch]
        if name == nil then error("grid has no color for '" .. ch .. "'") end
        img:drawPixel(x0 + x - 1, y0 + y - 1, M.C(name))
      end
    end
  end
end

-- An RGB sprite (never indexed) carrying art/palette.gpl, with one named layer.
function M.newSprite(w, h, layerName)
  local spr = Sprite(w, h, ColorMode.RGB)
  spr:setPalette(Palette{ fromFile = M.GPL })
  spr.layers[1].name = layerName
  return spr
end

-- Puts a single-frame image on layer 1, saves art/room/<id>.aseprite, closes.
function M.saveSingle(spr, img, id)
  spr:newCel(spr.layers[1], 1, img, Point(0, 0))
  spr:saveAs(M.ROOM .. id .. ".aseprite")
  print("OK " .. id .. " " .. spr.width .. "x" .. spr.height)
  spr:close()
end

return M
```

- [ ] **Step 11: Check that the palette has every room color**

Call `run_lua_script` with `filename` omitted and `script`:

```lua
local ok, err = pcall(function()
  local L = dofile("D:/Projects/Tracks/.superpowers/art-lua/room-prelude.lua")
  -- Every fixed color the room scripts use, by its art/palette.gpl name.
  local USED = {
    "outline", "white", "metal light", "metal", "metal shadow", "belt stripe", "belt",
    "wall", "wall shadow", "trim", "floor", "floor lines", "wood light", "dark wood",
    "wood shadow", "glass light", "glass", "glass shadow", "gold light", "gold",
    "gold shadow", "bronze light", "bronze", "bronze shadow", "red", "red shadow",
    "blue", "blue shadow", "leaf light", "leaf", "leaf shadow", "terracotta",
  }
  for _, name in ipairs(USED) do L.C(name) end
  -- The room colors fixed by the spec (section 1 Style).
  local SPEC = {
    wall = 0xd8c8a8, trim = 0xb59e7a, floor = 0x8c5e3c,
    ["floor lines"] = 0x7a5032, ["dark wood"] = 0x6e4b32, glass = 0x9fd0ef,
  }
  local pc = app.pixelColor
  for name, rgb in pairs(SPEC) do
    local c = L.C(name)
    local got = (pc.rgbaR(c) << 16) | (pc.rgbaG(c) << 8) | pc.rgbaB(c)
    if got ~= rgb then
      error(string.format("%s is #%06x, the spec says #%06x", name, got, rgb))
    end
  end
  print("OK palette: " .. #USED .. " room colors found, spec room colors match")
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

Expected: `OK palette: 32 room colors found, spec room colors match`.

If the reply is an `ERROR:` line ending in `art/palette.gpl has no color named '<name>'`, then Task 14's palette uses a different name for that color. Replace the name string with the palette.gpl name for the same color everywhere in Steps 11-19, and re-run this step. Don't add colors to palette.gpl in this task. If the `ERROR:` line ends in `<name> is #xxxxxx, the spec says #yyyyyy`, palette.gpl has drifted from spec section 1 Style. Stop and raise it with the user.

- [ ] **Step 12: Draw background.aseprite**

Call `run_lua_script` with `filename` omitted and `script`:

```lua
local ok, err = pcall(function()
  local L = dofile("D:/Projects/Tracks/.superpowers/art-lua/room-prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline

  -- background.aseprite: 180x120 wall, floor, window, shelf plank and medal-rack
  -- bar. No items are drawn into it; the slot slices are added with create_slice.
  local W, H = 180, 120
  local spr = L.newSprite(W, H, "room")
  local img = Image(W, H, ColorMode.RGB)

  -- Wall, with a shadow band under the ceiling and above the baseboard.
  rect(img, 0, 0, W, 84, C("wall"))
  rect(img, 0, 0, W, 2, C("wall shadow"))
  hline(img, 0, W - 1, 83, C("wall shadow"))

  -- Baseboard, then the floor. Floor items stand with their bottom row on y = 111.
  rect(img, 0, 84, W, 4, C("trim"))
  hline(img, 0, W - 1, 88, C("dark wood"))
  rect(img, 0, 89, W, 31, C("floor"))
  for _, y in ipairs({ 89, 96, 104, 112 }) do hline(img, 0, W - 1, y, C("floor lines")) end
  for _, band in ipairs({ { 90, 95, 30 }, { 97, 103, 10 }, { 105, 111, 30 }, { 113, 119, 10 } }) do
    local x = band[3]
    while x < W do
      vline(img, x, band[1], band[2], C("floor lines"))
      x = x + 40
    end
  end

  -- Window: dark wood frame (x 12..47, y 12..47), four 14x14 panes, sill below.
  rect(img, 12, 12, 36, 36, C("dark wood"))
  hline(img, 12, 47, 12, C("wood light"))
  hline(img, 12, 47, 47, C("wood shadow"))
  for _, pane in ipairs({ { 15, 15 }, { 31, 15 }, { 15, 31 }, { 31, 31 } }) do
    local px, py = pane[1], pane[2]
    rect(img, px, py, 14, 14, C("glass"))
    hline(img, px, px + 13, py, C("glass shadow"))
    vline(img, px, py, py + 13, C("glass shadow"))
    for i = 0, 5 do
      img:drawPixel(px + 4 + i, py + 10 - i, C("glass light"))
      img:drawPixel(px + 5 + i, py + 10 - i, C("glass light"))
    end
  end
  hline(img, 10, 49, 48, C("trim"))
  hline(img, 10, 49, 49, C("dark wood"))
  hline(img, 10, 49, 50, C("wall shadow"))

  -- Trophy shelf plank (x 56..113): trophies stand on its top row, y = 32.
  hline(img, 56, 113, 32, C("wood light"))
  hline(img, 56, 113, 33, C("dark wood"))
  hline(img, 56, 113, 34, C("wood shadow"))
  hline(img, 56, 113, 35, C("wall shadow"))
  for _, bx in ipairs({ 60, 108 }) do
    vline(img, bx, 35, 39, C("dark wood"))
    vline(img, bx + 1, 35, 39, C("wood shadow"))
  end

  -- Medal rack bar (x 58..111): medals hang from y = 52, just below it.
  hline(img, 58, 111, 50, C("wood light"))
  hline(img, 58, 111, 51, C("dark wood"))
  hline(img, 58, 111, 52, C("wall shadow"))
  img:drawPixel(59, 50, C("metal light"))
  img:drawPixel(110, 50, C("metal light"))

  L.saveSingle(spr, img, "background")
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

Expected: `OK background 180x120`.

- [ ] **Step 13: Add the nine slot slices**

Make one `create_slice` call per row of this table. Each call uses `filename` = `D:/Projects/Tracks/art/room/background.aseprite`.

| name | x | y | width | height |
|---|---|---|---|---|
| `trophy-1` | 58 | 12 | 16 | 20 |
| `trophy-2` | 77 | 12 | 16 | 20 |
| `trophy-3` | 96 | 12 | 16 | 20 |
| `medal-1` | 61 | 52 | 14 | 20 |
| `medal-2` | 78 | 52 | 14 | 20 |
| `medal-3` | 95 | 52 | 14 | 20 |
| `frame` | 128 | 14 | 36 | 28 |
| `equipment` | 94 | 62 | 84 | 50 |
| `decor` | 18 | 72 | 24 | 40 |

Each call returns `Slice '<name>' created at (<x>,<y>) <w>x<h> in D:/Projects/Tracks/art/room/background.aseprite`. A `Failed to create slice: Slice with that name already exists` reply means the slice is already there.

Then call `list_slices` with `filename` = `D:/Projects/Tracks/art/room/background.aseprite`. Expected: a JSON array of exactly these nine slices with these values, in any order.

- Standing slots (trophies, equipment, decor) have their bottom edge on the surface they stand on. The shelf top is y = 32, and the floor line is y = 112.
- Hanging slots (medals, frame) have their top edge just below the bar or at the hook.

Re-running Step 12 recreates the file without slices, so this step must then be repeated.

- [ ] **Step 14: Draw treadmill.aseprite with the belt**

Call `run_lua_script` with `filename` omitted and `script`:

```lua
local ok, err = pcall(function()
  local L = dofile("D:/Projects/Tracks/.superpowers/art-lua/room-prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline

  -- Treadmill layout, treadmill-local. 80x48 with the bottom row (y = 47) on
  -- the floor, runner facing +x. The belt surface is x 6..59 on y = 38 (two rows
  -- deep). Step 15's rider slice is x 16..47, y 0..37, with its pivot (the foot
  -- point) at (32, 37), so soles sit on the row just above the belt. Above the
  -- belt, nothing is drawn left of x = 48.
  local W, H = 80, 48
  local BELT_X1, BELT_X2, BELT_Y = 6, 59, 38

  -- 1. side-run timing and the planted foot's per-frame travel, read from
  --    body.aseprite (the timing reference). Row 63 is the ground row: soles
  --    touch it in contact frames only.
  local body = Sprite{ fromFile = L.ROOT .. "/art/avatar/body.aseprite" }
  local run
  for _, tag in ipairs(body.tags) do
    if tag.name == "side-run" then run = tag end
  end
  if run == nil then error("body.aseprite has no side-run tag") end
  local first, last = run.fromFrame.frameNumber, run.toFrame.frameNumber
  local n = last - first + 1
  local ground = body.height - 1
  local durations, soles = {}, {}
  for f = first, last do
    durations[#durations + 1] = body.frames[f].duration
    local flat = Image(body.width, body.height, ColorMode.RGB)
    flat:drawSprite(body, f)
    local left, right
    for x = 0, body.width - 1 do
      if app.pixelColor.rgbaA(flat:getPixel(x, ground)) > 0 then
        left = left or x
        right = x
      end
    end
    soles[#soles + 1] = left and { left, right } or false
  end
  body:close()

  -- A contact pair whose sole moved left by the same amount at both ends is the
  -- planted foot; pairs where the feet change are skipped. The loop wraps.
  local shift
  for i = 1, n do
    local a, b = soles[i], soles[i % n + 1]
    if a and b then
      local dl, dr = a[1] - b[1], a[2] - b[2]
      if dl == dr and dl > 0 then
        if shift ~= nil and shift ~= dl then
          error("side-run planted-foot travel is not constant: " .. shift .. " and " .. dl .. " px")
        end
        shift = dl
      end
    end
  end
  if shift == nil then
    error("no side-run frame pair has a planted sole moving backward on row " .. ground)
  end

  -- 2. Stripe spacing: the smallest divisor of one cycle's total shift that is
  --    more than twice the shift (so the belt never reads as reversing) and at
  --    least 6 px. One cycle then moves whole spacings, so the loop is seamless.
  --    roomArt.test.ts reads the belt surface (x 6..59) in every frame and
  --    joins the frames into one strip, 54 + (n - 1) * shift px long; it can
  --    measure a spacing of up to half that strip.
  local total = n * shift
  local maxSpacing = (BELT_X2 - BELT_X1 + 1 + (n - 1) * shift) // 2
  local spacing
  for d = math.max(2 * shift + 1, 6), math.min(total, maxSpacing) do
    if total % d == 0 then
      spacing = d
      break
    end
  end
  if spacing == nil then
    error(string.format(
      "no stripe spacing fits: side-run has %d frames with %d px of planted-foot travel, "
        .. "and no divisor of %d px is over %d px, at least 6 px and at most %d px",
      n, shift, total, 2 * shift, maxSpacing))
  end
  local STRIPE = 2

  -- 3. The sprite: a static frame layer and a belt layer, one frame per
  --    side-run frame with the same durations.
  local spr = L.newSprite(W, H, "frame")
  local beltLayer = spr:newLayer()
  beltLayer.name = "belt"
  for _ = 2, n do spr:newEmptyFrame() end
  for i = 1, n do spr.frames[i].duration = durations[i] end

  local o, ml, m, ms = C("outline"), C("metal light"), C("metal"), C("metal shadow")
  local static = Image(W, H, ColorMode.RGB)
  -- Deck: rear roller cap, side rail, bottom edge, legs and feet.
  hline(static, 4, 5, 38, o)
  vline(static, 3, 39, 43, o)
  hline(static, 4, 5, 39, ms)
  hline(static, 4, 63, 40, ml)
  rect(static, 4, 41, 60, 2, m)
  hline(static, 4, 63, 43, ms)
  hline(static, 4, 63, 44, o)
  rect(static, 7, 45, 2, 2, ms)
  rect(static, 64, 45, 2, 2, ms)
  hline(static, 6, 9, 47, o)
  hline(static, 63, 66, 47, o)
  -- Motor hood at the front (right) end of the deck.
  hline(static, 62, 71, 30, o)
  static:drawPixel(61, 31, o)
  hline(static, 62, 71, 31, ml)
  static:drawPixel(72, 31, o)
  for y = 32, 43 do
    static:drawPixel(60, y, o)
    static:drawPixel(61, y, ml)
    hline(static, 62, 71, y, m)
    static:drawPixel(72, y, ms)
    static:drawPixel(73, y, o)
  end
  hline(static, 60, 73, 44, o)
  -- Upright post from the hood to the console.
  for y = 9, 29 do
    static:drawPixel(67, y, o)
    static:drawPixel(68, y, m)
    static:drawPixel(69, y, ms)
    static:drawPixel(70, y, o)
  end
  -- Handlebar reaching back toward the runner, with a dark grip.
  hline(static, 54, 66, 10, o)
  hline(static, 55, 66, 11, ml)
  hline(static, 55, 66, 12, m)
  hline(static, 54, 66, 13, o)
  rect(static, 54, 11, 4, 2, o)
  -- Console at the right end: screen and two buttons.
  hline(static, 61, 76, 1, o)
  for y = 2, 7 do
    static:drawPixel(60, y, o)
    hline(static, 61, 76, y, ms)
    static:drawPixel(77, y, o)
  end
  hline(static, 61, 76, 8, o)
  rect(static, 62, 3, 8, 2, C("glass"))
  hline(static, 62, 69, 5, C("glass shadow"))
  hline(static, 63, 64, 3, C("glass light"))
  rect(static, 71, 3, 2, 2, C("red"))
  rect(static, 74, 3, 2, 2, C("blue"))

  -- Belt frame i (0-based) moves the stripes back (toward -x) by i * shift.
  local beltBase, beltStripe = C("belt"), C("belt stripe")
  for i = 0, n - 1 do
    local belt = Image(W, H, ColorMode.RGB)
    local offset = (i * shift) % spacing
    for x = BELT_X1, BELT_X2 do
      local c = beltBase
      if (x - BELT_X1 + offset) % spacing < STRIPE then c = beltStripe end
      belt:drawPixel(x, BELT_Y, c)
      belt:drawPixel(x, BELT_Y + 1, c)
    end
    spr:newCel(spr.layers[1], i + 1, static, Point(0, 0))
    spr:newCel(beltLayer, i + 1, belt, Point(0, 0))
  end

  local tag = spr:newTag(1, n)
  tag.name = "belt"
  tag.aniDir = AniDir.FORWARD
  spr:saveAs(L.ROOM .. "treadmill.aseprite")
  local list = {}
  for i = 1, n do list[i] = tostring(math.floor(durations[i] * 1000 + 0.5)) end
  print(string.format(
    "OK treadmill %dx%d: belt %d frames [%s] ms, shift %d px, stripe spacing %d px",
    W, H, n, table.concat(list, ","), shift, spacing))
  spr:close()
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

Expected: `OK treadmill 80x48: belt <N> frames [<durations>] ms, shift <S> px, stripe spacing <P> px`.
- N and the durations must equal body's side-run tag.
- S must be the planted foot's travel per frame.
- P must be more than 2*S, must divide N*S, and must be at most (54 + (N-1)*S) / 2.

For example, an 8-frame side-run at 90 ms with 2 px of travel prints `OK treadmill 80x48: belt 8 frames [90,90,90,90,90,90,90,90] ms, shift 2 px, stripe spacing 8 px`. The same run with 5 px of travel gets spacing 20, and with 7 px it gets spacing 28.

If the reply is an `ERROR:` line, stop and raise it with the user in these cases. Don't edit body in this task.
- The line ends in `body.aseprite has no side-run tag`.
- The line ends in `no side-run frame pair has a planted sole moving backward on row 63`, or contains `side-run planted-foot travel is not constant`. Either means body.aseprite breaks the spec's ground-row rule.
- The line contains `no stripe spacing fits`. Side-run's frame count and travel then leave no spacing that obeys the belt rules and that roomArt.test.ts can measure. An example is 7 frames at 7 px.

- [ ] **Step 15: Add the rider slice and its pivot**

Make these three calls, all on the same file:
1. `create_slice` with `filename` = `D:/Projects/Tracks/art/room/treadmill.aseprite`, `name` = `rider`, `x` = 16, `y` = 0, `width` = 32, `height` = 38.
2. `set_slice_pivot` with the same `filename`, `name` = `rider`, `x` = 16, `y` = 37.
3. `list_slices` with the same `filename`.

Expected: `[{"name": "rider", "x": 16, "y": 0, "width": 32, "height": 38, "pivot": {"x": 16, "y": 37}}]`, which puts the foot point at treadmill-local (32, 37). Re-running Step 14 recreates the file without the slice, so this step must then be repeated.

- [ ] **Step 16: Draw frame-bib.aseprite**

Call `run_lua_script` with `filename` omitted and `script`:

```lua
local ok, err = pcall(function()
  local L = dofile("D:/Projects/Tracks/.superpowers/art-lua/room-prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline

  -- frame-bib.aseprite: a framed race bib, 32x24, hung top-center from its slot.
  local W, H = 32, 24
  local spr = L.newSprite(W, H, "frame-bib")
  local img = Image(W, H, ColorMode.RGB)
  rect(img, 0, 0, W, H, C("wood shadow"))
  rect(img, 1, 1, W - 2, H - 2, C("dark wood"))
  hline(img, 1, W - 2, 1, C("wood light"))
  vline(img, 1, 1, H - 2, C("wood light"))
  rect(img, 3, 3, 26, 18, C("wall shadow"))
  rect(img, 6, 5, 20, 14, C("white"))
  rect(img, 6, 5, 20, 2, C("red"))
  hline(img, 6, 25, 7, C("red shadow"))
  rect(img, 6, 16, 20, 2, C("blue"))
  hline(img, 6, 25, 18, C("blue shadow"))
  for _, pin in ipairs({ { 7, 6 }, { 24, 6 }, { 7, 17 }, { 24, 17 } }) do
    img:drawPixel(pin[1], pin[2], C("metal light"))
  end
  -- Race number 42.
  L.grid(img, 12, 9, {
    "k.k.kkk",
    "k.k...k",
    "kkk.kkk",
    "..k.k..",
    "..k.kkk",
  }, { k = "outline" })
  L.saveSingle(spr, img, "frame-bib")
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

Expected: `OK frame-bib 32x24`.

- [ ] **Step 17: Draw the three trophies**

Call `run_lua_script` with `filename` omitted and `script`:

```lua
local ok, err = pcall(function()
  local L = dofile("D:/Projects/Tracks/.superpowers/art-lua/room-prelude.lua")

  -- trophy-gold/-silver/-bronze.aseprite: 14 px wide, standing bottom-center on
  -- the shelf. L/M/S are the metal's light/base/shadow; taller stems rank higher.
  local CUP = {
    "..oooooooooo..",
    "..oLLMMMMMSo..",
    "oooLMMMMMMSooo",
    "o.oLMMMMMMSo.o",
    "o.oLMMMMMMSo.o",
    "oooLMMMMMMSooo",
    "..oLMMMMMMSo..",
    "...oLMMMMSo...",
    "....oLMMSo....",
  }
  local STEM = ".....oMSo....."
  local BASE = {
    "....oLMMSo....",
    "..oooooooooo..",
    "..ollllllllo..",
    "..oddMMMMddo..",
    "..oddddddddo..",
    "..oooooooooo..",
  }
  local METALS = {
    { id = "trophy-gold", L = "gold light", M = "gold", S = "gold shadow", stem = 3 },
    { id = "trophy-silver", L = "metal light", M = "metal", S = "metal shadow", stem = 2 },
    { id = "trophy-bronze", L = "bronze light", M = "bronze", S = "bronze shadow", stem = 1 },
  }
  for _, metal in ipairs(METALS) do
    local rows = {}
    for _, row in ipairs(CUP) do rows[#rows + 1] = row end
    for _ = 1, metal.stem do rows[#rows + 1] = STEM end
    for _, row in ipairs(BASE) do rows[#rows + 1] = row end
    local spr = L.newSprite(#rows[1], #rows, "trophy")
    local img = Image(spr.width, spr.height, ColorMode.RGB)
    L.grid(img, 0, 0, rows, {
      o = "outline", L = metal.L, M = metal.M, S = metal.S, l = "wood light", d = "dark wood",
    })
    L.saveSingle(spr, img, metal.id)
  end
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

Expected, in this order: `OK trophy-gold 14x18`, `OK trophy-silver 14x17`, `OK trophy-bronze 14x16`.

- [ ] **Step 18: Draw the three medals**

Call `run_lua_script` with `filename` omitted and `script`:

```lua
local ok, err = pcall(function()
  local L = dofile("D:/Projects/Tracks/.superpowers/art-lua/room-prelude.lua")

  -- medal-gold/-silver/-bronze.aseprite: 10x18, hung top-center from the rack.
  -- A red and blue ribbon, then a disc in the medal's metal (L/M/S).
  local MEDAL = {
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    "..oRrBbo..",
    "...oMMo...",
    "..oooooo..",
    ".oLLMMMSo.",
    "oLLMMMMMSo",
    "oLMMMMMMSo",
    "oLMMMMMMSo",
    "oMMMMMMSSo",
    ".oMMMMSSo.",
    "..oSSSSo..",
    "...oooo...",
  }
  local METALS = {
    { id = "medal-gold", L = "gold light", M = "gold", S = "gold shadow" },
    { id = "medal-silver", L = "metal light", M = "metal", S = "metal shadow" },
    { id = "medal-bronze", L = "bronze light", M = "bronze", S = "bronze shadow" },
  }
  for _, metal in ipairs(METALS) do
    local spr = L.newSprite(#MEDAL[1], #MEDAL, "medal")
    local img = Image(spr.width, spr.height, ColorMode.RGB)
    L.grid(img, 0, 0, MEDAL, {
      o = "outline", R = "red", r = "red shadow", B = "blue", b = "blue shadow",
      L = metal.L, M = metal.M, S = metal.S,
    })
    L.saveSingle(spr, img, metal.id)
  end
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

Expected: `OK medal-gold 10x18`, `OK medal-silver 10x18`, `OK medal-bronze 10x18`.

- [ ] **Step 19: Draw plant.aseprite**

Call `run_lua_script` with `filename` omitted and `script`:

```lua
local ok, err = pcall(function()
  local L = dofile("D:/Projects/Tracks/.superpowers/art-lua/room-prelude.lua")
  local C = L.C

  -- plant.aseprite: a potted snake plant, 20x36, standing bottom-center on the floor.
  local W, H = 20, 36
  local spr = L.newSprite(W, H, "plant")
  local img = Image(W, H, ColorMode.RGB)
  -- One pointed leaf centered on column cx, from its tip row down into the pot.
  local function leaf(cx, tip)
    img:drawPixel(cx, tip, C("outline"))
    img:drawPixel(cx - 1, tip + 1, C("outline"))
    img:drawPixel(cx, tip + 1, C("leaf light"))
    img:drawPixel(cx + 1, tip + 1, C("outline"))
    for y = tip + 2, 26 do
      img:drawPixel(cx - 2, y, C("outline"))
      img:drawPixel(cx - 1, y, C("leaf light"))
      img:drawPixel(cx, y, C("leaf"))
      img:drawPixel(cx + 1, y, C("leaf shadow"))
      img:drawPixel(cx + 2, y, C("outline"))
    end
  end
  -- Back leaves first, so nearer leaves overlap them.
  leaf(3, 14)
  leaf(16, 11)
  leaf(6, 5)
  leaf(13, 3)
  leaf(10, 0)
  L.grid(img, 0, 26, {
    "...oooooooooooooo...",
    "...ollllllllllllo...",
    "...oTTTTTTTTTTTso...",
    "...oooooooooooooo...",
    "....oTTTTTTTTTso....",
    "....oTTTTTTTTTso....",
    "....oTTTTTTTTTso....",
    ".....oTTTTTTTso.....",
    ".....oTTTTTTTso.....",
    "......oooooooo......",
  }, { o = "outline", l = "bronze light", T = "terracotta", s = "bronze shadow" })
  L.saveSingle(spr, img, "plant")
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

Expected: `OK plant 20x36`.

- [ ] **Step 20: Export**

Run: `pnpm art:export`
Expected: exit 0. Task 14's script prints one line per source, for the ten art/room sources and the avatar sources: `exported art/room/<name>.aseprite -> apps/web/src/assets/sprites/<name>.png + <name>.json`. It ends with `art:export: <n> sheet(s) exported with <Aseprite path>`.

- [ ] **Step 21: Run the art checks and confirm they pass**

Run: `pnpm --filter @tracks/web exec vitest run src/features/avatar-room/__tests__/roomArt.test.ts src/features/avatar/__tests__/art.test.ts`
Expected: PASS, with `Test Files  2 passed (2)` and 0 failed.
- `roomArt.test.ts` passes all 5 of its tests.
- `art.test.ts` passes its palette, placeholder and tag tests for each of the ten room sheets. It also passes `treadmill`'s "has a belt timed like side-run and a rider slice with a pivot" test and `background`'s "has every slot slice" test.

- [ ] **Step 22: Render the checkpoint previews**

Call `run_lua_script` with `filename` omitted and `script`:

```lua
local ok, err = pcall(function()
  local L = dofile("D:/Projects/Tracks/.superpowers/art-lua/room-prelude.lua")
  -- Room checkpoint preview. Writes nothing under art/ or apps/web: the output
  -- goes to .superpowers/art-previews (gitignored).
  local OUT = L.ROOT .. "/.superpowers/art-previews/room-preview.aseprite"

  local function open(path)
    local spr = Sprite{ fromFile = path }
    if spr == nil then error("cannot open " .. path) end
    return spr
  end
  local function slice(spr, name)
    for _, s in ipairs(spr.slices) do
      if s.name == name then return s end
    end
    error(spr.filename .. " has no slice " .. name)
  end
  local function tag(spr, name)
    for _, t in ipairs(spr.tags) do
      if t.name == name then return t end
    end
    error(spr.filename .. " has no tag " .. name)
  end

  -- Copies the opaque pixels of one sprite frame onto dst at (x, y). Drawing a
  -- sprite straight onto a non-empty image fills its transparent area instead.
  local function blit(dst, spr, frame, x, y)
    local flat = Image(spr.width, spr.height, ColorMode.RGB)
    flat:drawSprite(spr, frame)
    for py = 0, spr.height - 1 do
      for px = 0, spr.width - 1 do
        local c = flat:getPixel(px, py)
        if app.pixelColor.rgbaA(c) > 0 then dst:drawPixel(x + px, y + py, c) end
      end
    end
  end

  -- Same alignment as roomLayout.ts (spec section 3 Room composition).
  local function stand(b, w, h) return b.x + (b.width - w) // 2, b.y + b.height - h end
  local function hang(b, w) return b.x + (b.width - w) // 2, b.y end

  local bg = open(L.ROOM .. "background.aseprite")
  local placed = {}
  local function place(id, sliceName, hanging)
    local item = open(L.ROOM .. id .. ".aseprite")
    local b = slice(bg, sliceName).bounds
    local x, y
    if hanging then x, y = hang(b, item.width) else x, y = stand(b, item.width, item.height) end
    placed[#placed + 1] = { spr = item, x = x, y = y }
  end
  -- Draw order: background, frame, trophies, medals, plant, then treadmill and avatar.
  place("frame-bib", "frame", true)
  place("trophy-gold", "trophy-1", false)
  place("trophy-silver", "trophy-2", false)
  place("trophy-bronze", "trophy-3", false)
  place("medal-gold", "medal-1", true)
  place("medal-silver", "medal-2", true)
  place("medal-bronze", "medal-3", true)
  place("plant", "decor", false)

  local tm = open(L.ROOM .. "treadmill.aseprite")
  local tx, ty = stand(slice(bg, "equipment").bounds, tm.width, tm.height)
  local rider = slice(tm, "rider")
  local feetX = tx + rider.bounds.x + rider.pivot.x
  local feetY = ty + rider.bounds.y + rider.pivot.y
  local body = open(L.ROOT .. "/art/avatar/body.aseprite")
  local idle = tag(body, "front-idle").fromFrame.frameNumber
  local run = tag(body, "side-run")
  local belt = tag(tm, "belt").fromFrame.frameNumber

  -- Frame 1: idle on the stopped belt. Then side-run frame i on belt frame i.
  local shots = { { bodyFrame = idle, beltFrame = belt, duration = 0.5 } }
  for i = 0, run.toFrame.frameNumber - run.fromFrame.frameNumber do
    local f = run.fromFrame.frameNumber + i
    shots[#shots + 1] = { bodyFrame = f, beltFrame = belt + i, duration = body.frames[f].duration }
  end

  local out = Sprite(bg.width, bg.height, ColorMode.RGB)
  for _ = 2, #shots do out:newEmptyFrame() end
  for i, shot in ipairs(shots) do
    local img = Image(bg.width, bg.height, ColorMode.RGB)
    blit(img, bg, 1, 0, 0)
    for _, p in ipairs(placed) do blit(img, p.spr, 1, p.x, p.y) end
    blit(img, tm, shot.beltFrame, tx, ty)
    blit(img, body, shot.bodyFrame, feetX - 32, feetY - 63)
    out:newCel(out.layers[1], i, img, Point(0, 0))
    out.frames[i].duration = shot.duration
  end
  local idleTag = out:newTag(1, 1)
  idleTag.name = "idle"
  local runTag = out:newTag(2, #shots)
  runTag.name = "run"
  out:saveAs(OUT)
  print(string.format("OK preview: treadmill at (%d, %d), avatar feet at (%d, %d), %d run frames",
    tx, ty, feetX, feetY, #shots - 1))
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

Expected: `OK preview: treadmill at (96, 64), avatar feet at (128, 101), <N> run frames`. An `ERROR:` line ending in `has no slice <name>` means Step 12 or 14 was re-run without then re-running Step 13 or 15.

Then make three export calls:
- `export_frame` with `filename` = `D:/Projects/Tracks/.superpowers/art-previews/room-preview.aseprite`, `frame_index` = 1, `output_filename` = `D:/Projects/Tracks/.superpowers/art-previews/room.png`, `scale` = 8. At 8x the 180x120 room is 1440x960.
- `export_tag` with `filename` = `D:/Projects/Tracks/.superpowers/art-previews/room-preview.aseprite`, `tag_name` = `run`, `output_filename` = `D:/Projects/Tracks/.superpowers/art-previews/room-run.gif`, `scale` = 4.
- `export_tag` with `filename` = `D:/Projects/Tracks/art/room/treadmill.aseprite`, `tag_name` = `belt`, `output_filename` = `D:/Projects/Tracks/.superpowers/art-previews/belt.gif`, `scale` = 8.

Expected replies:
- `Frame 1 exported to D:/Projects/Tracks/.superpowers/art-previews/room.png at 8x`
- `Tag 'run' exported to D:/Projects/Tracks/.superpowers/art-previews/room-run.gif`
- `Tag 'belt' exported to D:/Projects/Tracks/.superpowers/art-previews/belt.gif`

- [ ] **Step 23: Room checkpoint (user approval required)**

Send the three files with `SendUserFile`. If that tool is deferred, load it first with ToolSearch `select:SendUserFile`. The files are `D:/Projects/Tracks/.superpowers/art-previews/room.png`, `room-run.gif` and `belt.gif`. Use this message:

"Room checkpoint: room.png is the 8x still, idle on the stopped belt. room-run.gif is the 4x side-run on the moving belt; the planted foot should stay put on the belt. belt.gif is the 8x belt loop. The runner is the raw body sheet in its placeholder magenta, without hair or clothes; the app swaps in the real skin color and draws the other layers on top. Approve, or tell me what to change."

Do not commit until the user approves. If the user asks for a change, edit the script in Steps 12-19 and re-run it. Re-running Step 12 means Step 13 must be re-run too, and re-running Step 14 means Step 15 must be re-run too. If the user prefers to edit in the Aseprite GUI, they save and close the file first, and reopen it after any MCP edit (spec section 4). After any change, repeat Steps 20-23.

- [ ] **Step 24: Verify the whole web package**

Run: `pnpm --filter @tracks/web test && pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint && git status --porcelain art apps/web/src/assets/sprites`
Expected:
- Every test passes, with 0 failed.
- Typecheck and lint exit 0.
- The status lists only new files: `?? art/room/`, plus 20 lines of the form `?? apps/web/src/assets/sprites/<id>.json` or `<id>.png`, one pair per room sheet.
- No line starts with ` M`. One would mean an avatar export changed.

- [ ] **Step 25: Commit the room art**

```bash
git add art/room apps/web/src/assets/sprites/{background,treadmill,frame-bib,trophy-gold,trophy-silver,trophy-bronze,medal-gold,medal-silver,medal-bronze,plant}.{png,json} apps/web/src/features/avatar-room/__tests__/roomArt.test.ts
git commit -F - <<'EOF'
feat(art): draw the room, treadmill and v1 sample items

background (180x120, with the nine slot slices), treadmill (belt tag
timed like body side-run and shifting with the planted foot, rider
slice with the foot point as pivot, console at the right end),
frame-bib, three trophies, three medals and a plant, with their
exports. roomArt.test.ts checks the background, slot fit and
layoutRoom(SAMPLE_ROOM) placement, the clear rider area, the console
and the belt motion.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 26: Verify the export is reproducible**

Run: `pnpm art:export && git status --porcelain art apps/web/src/assets/sprites`
Expected: the export succeeds, and `git status --porcelain` prints nothing because the exports are byte-identical (spec Done-when 3).

---

### Task 19: Art coverage check + room integration in the browser

**Files:**
- Modify: `apps/web/src/features/avatar/__tests__/art.test.ts` (add 4 import statements after the file's last `import`; append one `describe` block at the end of the file)
- Create (gitignored scratch under `.superpowers/`, never committed): `.superpowers/room-check/room-check.mjs`
- Output (gitignored): `.superpowers/room-check/out/` (`frame-NN.png`, `timeline.txt`, `room-desktop.png`, `room-iphone-se.png`, `mcp-*.png`)
- Changed for a moment in Step 2, then restored from git by the same command: `apps/web/src/assets/sprites/{hair-curly,plant}.{json,png}` (removed), `apps/web/src/assets/sprites/background.json` and `apps/web/src/assets/sprites/treadmill.json` (edited)
- Modify only if Steps 3 or 9-11 find a defect. Use the Step 12 table to find the owner. Write a failing test first wherever logic is involved.
  - `apps/web/src/features/avatar-room/{behavior,roomLayout}.ts`, `apps/web/src/features/avatar-room/{RoomPage,RoomScene}.tsx`, and their tests in `apps/web/src/features/avatar-room/__tests__/`
  - `apps/web/src/features/avatar/{frames,layers,palette,swap,fitScale,appearance,catalog,useAvatar,canvas,usePixelCanvas}.ts`, and their tests in `apps/web/src/features/avatar/__tests__/`
  - Art: `art/avatar/<name>.aseprite` or `art/room/<name>.aseprite`, plus the matching `apps/web/src/assets/sprites/<name>.png` and `apps/web/src/assets/sprites/<name>.json` written by `pnpm art:export`

**Interfaces:**
Consumes:
- `apps/web/src/features/avatar/catalog.ts`: `BODY_SHEET`, `AVATAR_SHEET_IDS: readonly SheetId[]`, `HAIR_STYLE_OPTIONS: Record<HairStyle, Option & { sheet: SheetId }>`, `TOP_OPTIONS: Record<TopItem, Option & { sheet: SheetId }>`, `BOTTOM_OPTIONS: Record<BottomItem, Option & { sheet: SheetId }>`, `SHOES_OPTIONS: Record<ShoesItem, Option & { sheet: SheetId }>`
- `apps/web/src/features/avatar/sheets.ts`: `type SheetId`, `SHEETS: ReadonlyMap<SheetId, SheetData>`, `getSheet(id: SheetId, registry?: ReadonlyMap<SheetId, SheetData>): SheetData` (`SheetData.frames: SheetFrame[]`, `tags: SheetTag[]`, `slices: SheetSlice[]`; a slice's `pivot` is `{ x: number; y: number } | null`)
- `apps/web/src/features/avatar-room/sampleRoom.ts`: `interface SampleRoom`, `SAMPLE_ROOM`
- `apps/web/src/features/avatar-room/roomLayout.ts`: `layoutRoom(room: SampleRoom, registry?): RoomLayout` (`sprites: PlacedSprite[]`, `avatarFeet: { x: number; y: number }`)
- `apps/web/src/features/avatar/appearance.ts`: `describeAppearance(a: AvatarAppearance): string` (called in the browser through Vite dev)
- DOM contract from Tasks 10-12 and the existing layout:
  - RoomScene renders `<canvas role="img" aria-label={describeAppearance(appearance)} data-ready="true">`.
  - RoomPage has the `Edit avatar` link. Its unreachable state is a `role="alert"` "Can't reach the server" message plus a `Retry` button.
  - CreatorPage has radios whose `value` is the item ID, plus `Save` and, in edit mode, `Cancel`.
  - LoginPage has `#email`/`#password` (labels `Email`/`Password`) and the `Sign In`, `Create Account` and `Don't have an account? Sign up` buttons.
  - The Header has `Sign out`.
- Exports from Tasks 15-18 in `apps/web/src/assets/sprites/` (`body.json` tags `front-idle`/`turn`/`side-run`, `treadmill.json` tag `belt`)

Produces: no new app exports. art.test.ts gains the `describe('catalog and sample room coverage')` block. It has five tests: four from the brief, plus one plan-added test backed by the spec. The gitignored browser check script is `.superpowers/room-check/room-check.mjs`.

- [ ] **Step 1: Add the catalog-coverage block to art.test.ts**

art.test.ts (Task 14) already imports `describe`, `expect` and `it` from `'vitest'`. Add these import statements after its last `import` statement. If the file already imports from one of these four modules, merge the names into that statement, so that no binding is declared twice:

```ts
import { layoutRoom } from '../../avatar-room/roomLayout.js';
import { SAMPLE_ROOM, type SampleRoom } from '../../avatar-room/sampleRoom.js';
import {
  AVATAR_SHEET_IDS,
  BODY_SHEET,
  BOTTOM_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  TOP_OPTIONS,
} from '../catalog.js';
import { SHEETS, getSheet, type SheetId } from '../sheets.js';
```

Then append this block at the end of the file. Its constants and helpers live inside the `describe` callback, so they cannot clash with Task 14's top-level names:

```ts

// Catalog coverage (Task 19). Everything the app draws must resolve through the
// SHEETS registry (import.meta.glob over src/assets/sprites), and the room art
// must carry the slices and tags that layoutRoom and RoomScene read. The checks
// above validate whatever is exported; these fail when something is not exported.
describe('catalog and sample room coverage', () => {
  /** Native room size (spec §1 Scale). */
  const roomW = 180;
  const roomH = 120;

  /** background.aseprite holds one slot slice per SAMPLE_ROOM item (spec §3). */
  function slotSlices(room: SampleRoom): string[] {
    return [
      ...room.trophies.map((_, i) => `trophy-${i + 1}`),
      ...room.medals.map((_, i) => `medal-${i + 1}`),
      'frame',
      'equipment',
      'decor',
    ];
  }

  function unexported(ids: readonly SheetId[]): SheetId[] {
    return [...new Set(ids)].filter((id) => !SHEETS.has(id)).sort();
  }

  it('exports every catalog base sprite and every AVATAR_SHEET_IDS sheet', () => {
    const catalogSheets: SheetId[] = [
      BODY_SHEET,
      ...Object.values(HAIR_STYLE_OPTIONS).map((option) => option.sheet),
      ...Object.values(TOP_OPTIONS).map((option) => option.sheet),
      ...Object.values(BOTTOM_OPTIONS).map((option) => option.sheet),
      ...Object.values(SHOES_OPTIONS).map((option) => option.sheet),
    ];
    expect(
      unexported([...catalogSheets, ...AVATAR_SHEET_IDS]),
      'avatar sheets with no export in src/assets/sprites',
    ).toEqual([]);
  });

  it('exports the background and every SAMPLE_ROOM item', () => {
    const roomSheets: SheetId[] = [
      'background',
      ...SAMPLE_ROOM.trophies,
      ...SAMPLE_ROOM.medals,
      SAMPLE_ROOM.frame,
      SAMPLE_ROOM.equipment,
      SAMPLE_ROOM.decor,
    ];
    expect(unexported(roomSheets), 'room sheets with no export in src/assets/sprites').toEqual([]);
  });

  it('gives the background a slot slice for every SAMPLE_ROOM item', () => {
    const names = new Set(getSheet('background').slices.map((slice) => slice.name));
    expect(
      slotSlices(SAMPLE_ROOM).filter((name) => !names.has(name)),
      'slot slices missing from background.json',
    ).toEqual([]);
  });

  it('gives the equipment a belt tag and a rider slice with a pivot', () => {
    const equipment = getSheet(SAMPLE_ROOM.equipment);
    expect(
      equipment.tags.map((tag) => tag.name),
      `${equipment.id}.json tags`,
    ).toContain('belt');
    const rider = equipment.slices.find((slice) => slice.name === 'rider');
    expect(rider?.pivot ?? null, `${equipment.id}.json rider slice pivot`).not.toBeNull();
  });

  // Plan-added, beyond the Task 19 brief. Backed by spec §1 Scale (the room is
  // 180x120) and §3 Rendering (draw at integer art-pixel coordinates). It also
  // runs layoutRoom once over the real exports. It does not require sprites to
  // stay inside the room: the spec sets no such rule.
  it('lays out the sample room on whole pixels over a 180x120 background', () => {
    const backdrop = getSheet('background').frames[0];
    expect(backdrop ? [backdrop.w, backdrop.h] : null, 'background.json frame 0 size').toEqual([
      roomW,
      roomH,
    ]);
    const { sprites, avatarFeet } = layoutRoom(SAMPLE_ROOM);
    const offGrid = sprites
      .filter((sprite) => !Number.isInteger(sprite.x) || !Number.isInteger(sprite.y))
      .map((sprite) => `${sprite.sheet} at (${sprite.x}, ${sprite.y})`);
    if (!Number.isInteger(avatarFeet.x) || !Number.isInteger(avatarFeet.y)) {
      offGrid.push(`avatar feet at (${avatarFeet.x}, ${avatarFeet.y})`);
    }
    expect(offGrid, 'layout positions not on whole art pixels').toEqual([]);
  });
});
```

- [ ] **Step 2: Watch every coverage test fail, then restore the exports**

Tasks 15-18 already exported everything, so the new block passes as written. To prove that each of the five tests can fail, break the committed exports once and then restore them from git.

First, confirm the sprites folder has no uncommitted changes, because the restore below discards them:

```bash
test -z "$(git status --porcelain apps/web/src/assets/sprites)" && echo "sprites clean"
```
Expected: `sprites clean`. If nothing prints, stop. Commit the pending exports together with their source first (Step 12 art commit), then rerun this check.

Next, run the command below. It removes `hair-curly` and `plant`, renames the `decor` slice, and deletes the rider pivot. It then runs the block and always restores the folder from git:

```bash
S=apps/web/src/assets/sprites; rm "$S/hair-curly.json" "$S/hair-curly.png" "$S/plant.json" "$S/plant.png" && node -e "const fs = require('node:fs'); const edit = (file, change) => { const json = JSON.parse(fs.readFileSync(file, 'utf8')); change(json); fs.writeFileSync(file, JSON.stringify(json)); }; edit('$S/background.json', (j) => { j.meta.slices.find((s) => s.name === 'decor').name = 'decor-moved'; }); edit('$S/treadmill.json', (j) => { delete j.meta.slices.find((s) => s.name === 'rider').keys[0].pivot; });" && pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts -t "catalog and sample room coverage"; git checkout -- "$S" && test -z "$(git status --porcelain "$S")" && echo "sprites restored"
```

The command's exit code comes from the restore, not from vitest. Read vitest's summary instead. Expected:
```
FAIL  src/features/avatar/__tests__/art.test.ts > catalog and sample room coverage > exports every catalog base sprite and every AVATAR_SHEET_IDS sheet
AssertionError: avatar sheets with no export in src/assets/sprites: expected [ 'hair-curly' ] to deeply equal []
FAIL  src/features/avatar/__tests__/art.test.ts > catalog and sample room coverage > exports the background and every SAMPLE_ROOM item
AssertionError: room sheets with no export in src/assets/sprites: expected [ 'plant' ] to deeply equal []
FAIL  src/features/avatar/__tests__/art.test.ts > catalog and sample room coverage > gives the background a slot slice for every SAMPLE_ROOM item
AssertionError: slot slices missing from background.json: expected [ 'decor' ] to deeply equal []
FAIL  src/features/avatar/__tests__/art.test.ts > catalog and sample room coverage > gives the equipment a belt tag and a rider slice with a pivot
AssertionError: treadmill.json rider slice pivot: expected null not to be null
FAIL  src/features/avatar/__tests__/art.test.ts > catalog and sample room coverage > lays out the sample room on whole pixels over a 180x120 background
Error: … (thrown by layoutRoom/getSheet; it names `plant`, `decor` or `rider`, whichever layoutRoom reads first)
Tests  5 failed | <n> skipped
```
The `<n>` skipped tests are Task 14's, filtered out by `-t`. The last line printed is `sprites restored`. If a test passes here, it is not checking what it claims: fix the test and rerun this step.

- [ ] **Step 3: Run the whole art check green**

```bash
pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts --reporter=verbose
```

Expected: every test passes, including these five:
```
✓ … > catalog and sample room coverage > exports every catalog base sprite and every AVATAR_SHEET_IDS sheet
✓ … > catalog and sample room coverage > exports the background and every SAMPLE_ROOM item
✓ … > catalog and sample room coverage > gives the background a slot slice for every SAMPLE_ROOM item
✓ … > catalog and sample room coverage > gives the equipment a belt tag and a rider slice with a pivot
✓ … > catalog and sample room coverage > lays out the sample room on whole pixels over a 180x120 background
Test Files  1 passed (1)
```

If one fails, fix it where it belongs:
- **The first four tests, or the frame size in the fifth:** the art is wrong or not exported, because the spec fixes these names and sizes. Run `pnpm art:export`, or fix the source through the MCP following the spec §4 workflow. Commit the source and its exports with the Step 12 art commit, then rerun this step.
- **The whole-pixel check in the fifth test:** this is a `roomLayout.ts` defect. The spec says to draw at integer coordinates, whatever the parity of slice and sprite widths. Fix it test-first via the Step 12 table.
- **A failure that only goes away if a spec rule changes:** stop and ask the user. Do not edit the test or the spec on your own.

- [ ] **Step 4: Typecheck, lint and run the web suite**

```bash
pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint && pnpm --filter @tracks/web test
```

Expected: `tsc --noEmit` and `eslint .` exit 0 with no output. Vitest reports every test file passed, with no `Not implemented` errors or other stderr noise.

- [ ] **Step 5: Commit the coverage check**

```bash
git add apps/web/src/features/avatar/__tests__/art.test.ts
git commit -F - <<'EOF'
test(web): check the art covers the catalog and the sample room

Every catalog base sprite, AVATAR_SHEET_IDS entry and SAMPLE_ROOM item must
resolve through SHEETS. background.json needs a slot slice per sample item and
the treadmill a belt tag and a rider pivot. The background must be 180x120 and
layoutRoom over the real exports must place everything on whole art pixels.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 6: Bring up local Supabase, Redis and the migrations**

```bash
supabase status
```
Expected: `supabase local development setup is running.` If it is not running, run `supabase start` and wait for it to print its key table.

```bash
docker compose up -d && supabase migration up --local && pnpm --filter @tracks/types build && test -f apps/api/.env && test -f apps/web/.env && echo "env ok"
```
Expected:
- The Redis container is `Running` or `Started`.
- `supabase migration up` either applies `20261004120000_create_avatars.sql` and `20261004120100_grant_user_profiles_service_role.sql`, or prints `Local database is up to date.`
- The types build exits 0.
- The last line is `env ok`. If an `.env` file is missing, fill it in from README "Step 4: Configure environment variables", using the `supabase start` values.

Use `migration up`, not `db reset`, so that local data is kept. Local email confirmation is off (`supabase/config.toml` sets `enable_confirmations = false`), so sign-up signs the user straight in.

- [ ] **Step 7: Start the dev servers**

```bash
netstat -ano | grep -E ':(3000|5173) .*LISTENING'
```
Expected: no output. If a stale dev server from an earlier task holds one of the ports, stop it with `taskkill //PID <pid> //T //F` and rerun the check.

Start `pnpm dev` with the Bash tool's `run_in_background: true`. It keeps running, so note its task id for Step 13. Then wait for both servers. curl does the retrying itself, so no `sleep` is needed:

```bash
curl --retry 30 --retry-delay 2 --retry-connrefused -sf http://localhost:3000/health && echo && curl --retry 30 --retry-delay 2 --retry-connrefused -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/
```
Expected: `{"success":true,"data":{"status":"ok","timestamp":"…"}}`, then `200`.

- [ ] **Step 8: Write the browser check script (gitignored, not committed)**

Run `mkdir -p .superpowers/room-check`, then write `.superpowers/room-check/room-check.mjs`:

```js
// Task 19 browser check of the avatar room against the running local stack.
// Run from the repo root: node .superpowers/room-check/room-check.mjs .superpowers/room-check/out
// Signs up a fresh user, creates an avatar, checks the room canvas on desktop
// (1280x800 @1) and iPhone SE (375x667 @2), records the animation, checks the
// unreachable-API state, and writes frame-NN.png, timeline.txt and two
// screenshots to <out-dir>.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const require = createRequire(join(ROOT, 'package.json'));
const { chromium, devices } = require('@playwright/test');

const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: node room-check.mjs <out-dir>');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const WEB = process.env.WEB_URL ?? 'http://localhost:5173/';
const API = process.env.API_URL ?? 'http://localhost:3000';
const SAMPLE_MS = Number(process.env.SAMPLE_MS ?? 45000);
const EMAIL = `rc-${Date.now()}@example.test`;
const PASSWORD = 'room-check-Passw0rd!';
const CHOSEN = {
  skin_tone: 'tone-4',
  hair_style: 'curly',
  hair_color: 'blonde',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};
const READY = 'canvas[role="img"][data-ready="true"]';
const SPRITES = join(ROOT, 'apps/web/src/assets/sprites');
const AVATAR_URL = `${API}/avatar`;

const failures = [];
// The spec-mandated 404 for a brand-new user's GET /avatar (AVATAR_NOT_FOUND,
// spec section 2). Chromium logs it as a console error, which conflicts with
// .claude/CLAUDE.md rule 26, so Step 9 hands it to the user for a decision.
const notFound = [];
// GET /avatar requests refused while the error-state check blocks the API.
const refused = [];

function check(ok, message) {
  if (!ok) failures.push(message);
}

// Every console error or warning fails the check, except the two cases above,
// each accepted only in the window where it is expected.
function watch(page, label, state) {
  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    const url = msg.location().url;
    const line = `[${label}] console.${type}: ${text} (${url})`;
    const avatarError = type === 'error' && url === AVATAR_URL;
    if (
      avatarError &&
      state.newUser &&
      text.startsWith('Failed to load resource: the server responded with a status of 404')
    ) {
      notFound.push(line);
    } else if (
      avatarError &&
      state.apiBlocked &&
      text === 'Failed to load resource: net::ERR_CONNECTION_REFUSED'
    ) {
      refused.push(line);
    } else {
      failures.push(line);
    }
  });
  page.on('pageerror', (err) => failures.push(`[${label}] uncaught: ${err.message}`));
}

async function fillCredentials(page) {
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
}

async function measure(page) {
  return page.locator(READY).evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const doc = document.scrollingElement ?? document.documentElement;
    const main = document.querySelector('main');
    return {
      label: canvas.getAttribute('aria-label'),
      cssW: rect.width,
      cssH: rect.height,
      backingW: canvas.width,
      backingH: canvas.height,
      scrolls:
        doc.scrollWidth > doc.clientWidth ||
        doc.scrollHeight > doc.clientHeight ||
        (main !== null &&
          (main.scrollWidth > main.clientWidth || main.scrollHeight > main.clientHeight)),
    };
  });
}

// Reads the room canvas back at native 180x120 on every animation frame, hashes
// it, and returns each distinct image (as a 4x PNG data URL) plus the timeline
// of which image was on screen when.
async function sample(page, ms) {
  return page.evaluate(async (durationMs) => {
    const source = document.querySelector('canvas[role="img"][data-ready="true"]');
    if (!(source instanceof HTMLCanvasElement)) throw new Error('room canvas is not ready');
    const w = 180;
    const h = 120;
    const small = document.createElement('canvas');
    small.width = w;
    small.height = h;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    const big = document.createElement('canvas');
    big.width = w * 4;
    big.height = h * 4;
    const bctx = big.getContext('2d');
    if (!sctx || !bctx) throw new Error('no 2D context');
    sctx.imageSmoothingEnabled = false;
    bctx.imageSmoothingEnabled = false;
    const indexByHash = new Map();
    const images = [];
    const segments = [];
    const t0 = performance.now();
    await new Promise((resolve) => {
      function tick(now) {
        sctx.clearRect(0, 0, w, h);
        sctx.drawImage(source, 0, 0, w, h);
        const data = sctx.getImageData(0, 0, w, h).data;
        let hash = 0x811c9dc5;
        for (let i = 0; i < data.length; i++) {
          hash ^= data[i];
          hash = Math.imul(hash, 0x01000193);
        }
        hash >>>= 0;
        let index = indexByHash.get(hash);
        if (index === undefined) {
          index = images.length;
          indexByHash.set(hash, index);
          bctx.clearRect(0, 0, big.width, big.height);
          bctx.drawImage(small, 0, 0, big.width, big.height);
          images.push(big.toDataURL('image/png'));
        }
        const t = Math.round(now - t0);
        const last = segments[segments.length - 1];
        if (last && last.image === index) last.end = t;
        else segments.push({ image: index, start: t, end: t });
        if (now - t0 < durationMs) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    return { images, segments };
  }, ms);
}

function tagDurations(file, tag) {
  const json = JSON.parse(readFileSync(join(SPRITES, file), 'utf8'));
  const found = json.meta.frameTags.find((t) => t.name === tag);
  if (!found) throw new Error(`${file} has no tag ${tag}`);
  return json.frames.slice(found.from, found.to + 1).map((f) => f.duration);
}

const name = (i) => `frame-${String(i).padStart(2, '0')}`;
const browser = await chromium.launch();
try {
  // Desktop: sign up, create, save, reload.
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  const state = { newUser: true, apiBlocked: false };
  watch(page, 'desktop', state);
  await page.goto(WEB);
  await page.getByRole('button', { name: "Don't have an account? Sign up", exact: true }).click();
  await fillCredentials(page);
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await page.waitForURL(/#\/create$/, { timeout: 15000 });
  for (const value of Object.values(CHOSEN)) await page.locator(`input[type="radio"][value="${value}"]`).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/#\/$/, { timeout: 15000 });
  await page.locator(READY).waitFor({ timeout: 15000 });
  state.newUser = false;
  check(
    notFound.length === 1,
    `${notFound.length} GET /avatar 404s for the new user; expected exactly 1 (the cached null must not be refetched)`,
  );
  const afterSave = await measure(page);

  await page.reload();
  await page.locator(READY).waitFor({ timeout: 15000 });
  check(/#\/$/.test(page.url()), `after reload the URL is ${page.url()}, expected #/`);
  const room = await measure(page);
  // Vite dev serves app modules by path, so the expected label comes from the
  // app's own describeAppearance.
  const described = await page.evaluate(async (appearance) => {
    const mod = await import('/src/features/avatar/appearance.ts');
    return mod.describeAppearance(appearance);
  }, CHOSEN);
  check(room.label === described, `aria-label is "${room.label}", expected "${described}"`);
  check(room.label === afterSave.label, `aria-label changed on reload: "${afterSave.label}" -> "${room.label}"`);
  check(room.cssW === 900 && room.cssH === 600, `desktop canvas is ${room.cssW}x${room.cssH} CSS px, expected 900x600`);
  check(room.backingW === 900 && room.backingH === 600, `desktop backing store is ${room.backingW}x${room.backingH}, expected 900x600`);
  check(!room.scrolls, 'desktop document or <main> scrolls');

  const { images, segments } = await sample(page, SAMPLE_MS);
  images.forEach((url, i) => {
    writeFileSync(join(OUT, `${name(i)}.png`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  });
  const lines = segments.map((s, i) => {
    const next = segments[i + 1];
    const duration = next ? next.start - s.start : s.end - s.start;
    return `${String(s.start).padStart(6)} ms  ${String(duration).padStart(5)} ms  ${name(s.image)}`;
  });
  writeFileSync(join(OUT, 'timeline.txt'), `${lines.join('\n')}\n`);
  await page.screenshot({ path: join(OUT, 'room-desktop.png') });

  const idle = tagDurations('body.json', 'front-idle');
  const turn = tagDurations('body.json', 'turn');
  const run = tagDurations('body.json', 'side-run');
  const belt = tagDurations('treadmill.json', 'belt');
  check(
    images.length <= idle.length + turn.length + run.length,
    `${images.length} distinct room images; at most ${idle.length + turn.length + run.length} (idle + turn + run) expected, so a layer or the belt is out of sync`,
  );
  check(images.length >= 3, `only ${images.length} distinct room images in ${SAMPLE_MS} ms; the room is not animating`);

  // Error state (rule 24, spec section 3 Data): with the API unreachable, a
  // reload shows "Can't reach the server" and Retry at #/ with no redirect, and
  // Retry brings the room back once the API answers again.
  const apiRoutes = `${API}/**`;
  state.apiBlocked = true;
  await page.route(apiRoutes, (route) => route.abort('connectionrefused'));
  await page.reload();
  await page.getByRole('alert').filter({ hasText: /Can.t reach the server/ }).waitFor({ timeout: 20000 });
  check(/#\/$/.test(page.url()), `with the API unreachable the URL is ${page.url()}, expected #/`);
  const retry = page.getByRole('button', { name: 'Retry', exact: true });
  check(await retry.isVisible(), 'no Retry button in the unreachable state');
  await page.unroute(apiRoutes);
  state.apiBlocked = false;
  await retry.click();
  await page.locator(READY).waitFor({ timeout: 15000 });
  const recovered = await measure(page);
  check(/#\/$/.test(page.url()), `after Retry the URL is ${page.url()}, expected #/`);
  check(recovered.label === room.label, `after Retry the aria-label is "${recovered.label}", expected "${room.label}"`);
  check(
    refused.length >= 1 && refused.length <= 2,
    `${refused.length} refused GET /avatar while the API was blocked; expected 1 or 2 (the first try plus queryClient's retry: 1)`,
  );

  // Phone: sign in as the same user at iPhone SE size.
  const phone = await browser.newContext({ ...devices['iPhone SE (3rd gen)'] });
  const phonePage = await phone.newPage();
  watch(phonePage, 'iphone-se', { newUser: false, apiBlocked: false });
  await phonePage.goto(WEB);
  await fillCredentials(phonePage);
  await phonePage.getByRole('button', { name: 'Sign In', exact: true }).click();
  await phonePage.locator(READY).waitFor({ timeout: 15000 });
  const small = await measure(phonePage);
  check(small.cssW === 360 && small.cssH === 240, `iPhone SE canvas is ${small.cssW}x${small.cssH} CSS px, expected 360x240`);
  check(small.backingW === 720 && small.backingH === 480, `iPhone SE backing store is ${small.backingW}x${small.backingH}, expected 720x480`);
  check(!small.scrolls, 'iPhone SE document or <main> scrolls');
  check(small.label === room.label, `iPhone SE aria-label "${small.label}" differs from desktop "${room.label}"`);
  await phonePage.screenshot({ path: join(OUT, 'room-iphone-se.png') });

  console.log(`user: ${EMAIL}`);
  console.log(`aria-label: ${room.label}`);
  console.log(`desktop canvas ${room.cssW}x${room.cssH} css, ${room.backingW}x${room.backingH} backing`);
  console.log(`iPhone SE canvas ${small.cssW}x${small.cssH} css, ${small.backingW}x${small.backingH} backing`);
  console.log(`body.json front-idle ms: ${idle.join(' ')}`);
  console.log(`body.json turn ms: ${turn.join(' ')}`);
  console.log(`body.json side-run ms: ${run.join(' ')}`);
  console.log(`treadmill.json belt ms: ${belt.join(' ')}`);
  console.log(`${images.length} distinct images, ${segments.length} segments in ${SAMPLE_MS} ms`);
  console.log(`sequence: ${segments.map((s) => String(s.image).padStart(2, '0')).join(' ')}`);
  console.log(`error state: alert and Retry at #/ after ${refused.length} refused GET /avatar; room back after Retry`);
  for (const line of notFound) console.log(`spec-404: ${line}`);
} catch (err) {
  failures.push(`flow failed: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await browser.close();
}

if (failures.length > 0) {
  for (const line of failures) console.log(`FAIL ${line}`);
  process.exit(1);
}
console.log('ROOM CHECK PASSED');
```

Confirm git ignores it: `git check-ignore -v .superpowers/room-check/room-check.mjs` should print `.gitignore:12:.superpowers/	.superpowers/room-check/room-check.mjs`.

- [ ] **Step 9: Run the browser check**

Run it with a Bash `timeout` of 300000 ms. The browser install step is a no-op when Chromium is already present.

```bash
pnpm exec playwright install chromium && node .superpowers/room-check/room-check.mjs .superpowers/room-check/out
```

The run takes about 75 s, because it samples the room for 45 s. Expected stdout:
- `user: rc-<timestamp>@example.test`
- `aria-label: Your athlete: …`. The script has already checked that this equals `describeAppearance(chosen)` from the running app. With Task 5's labels it reads `Your athlete: tone 4 skin, curly blonde hair, blue tee, black shorts, red shoes`.
- `desktop canvas 900x600 css, 900x600 backing` (k = 5 at 1280x800 @1)
- `iPhone SE canvas 360x240 css, 720x480 backing` (k = 4 at 375x667 @2)
- Four `… ms:` lines with the body.json and treadmill.json durations. The belt line equals the side-run line.
- `N distinct images, M segments in 45000 ms`, then a `sequence:` line
- `error state: alert and Retry at #/ after 2 refused GET /avatar; room back after Retry`. A count of `1` is also accepted, if Task 9's `useAvatar` sets its own `retry`.
- Exactly one `spec-404: [desktop] console.error: Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:3000/avatar)` line. The script fails if there are zero or more than one.
- The last line is `ROOM CHECK PASSED`, with exit code 0.

Any `FAIL …` line is a defect to fix in Step 12. That covers any other console error or warning, an uncaught error, a wrong size, scrolling, a redirect after reload, a label mismatch, a missing or looping error state, a 404 count other than 1, and too many distinct images (a layer or the belt is out of sync).

**Report the `spec-404` line to the user. Do not dismiss it.** Spec §2 requires `GET /avatar` to answer 404 `AVATAR_NOT_FOUND` for a user with no avatar. Chromium logs every non-2xx response as a console error, so every first-time user produces this line, and that conflicts with .claude/CLAUDE.md rule 26. Do not change the API contract on your own. In the task report, quote the line and ask the user to choose:
- keep it as the spec says, or
- have `GET /avatar` return 200 with `data: null`. That means changing spec §2/§3, the API route and its tests, and `useAvatar` with its tests, in a follow-up task.

Then carry on with Step 10.

- [ ] **Step 10: Review the recorded cycle and frames**

Read `.superpowers/room-check/out/timeline.txt`. Then view (Read tool) `frame-00.png` through the last frame, plus `room-desktop.png` and `room-iphone-se.png`. Confirm each point:
1. **Idle first:** the timeline opens with the idle images cycling. Each segment's duration matches the `front-idle` durations in order, within ±34 ms (two rAF frames). The first turn arrives within 8000 ms plus one idle loop, and always at the end of a whole loop.
2. **Turn in:** next comes one segment of a new image, lasting the `turn` duration (±34 ms). That image is the ¾ front-right view.
3. **Run:** next, new images cycle with the `side-run` durations in order, for 8000–15000 ms plus up to one loop. The last run segment before the second turn is the image that precedes the run's first image elsewhere in the cycle. So the run ends on a whole loop and never cuts on a flight frame.
4. **Turn out, then idle:** the same turn image appears again, followed by the same idle images as at the start.
5. **Belt synced:** in an idle frame and in the turn frame, the belt stripes are identical (belt frame 0). Between two consecutive run frames, the stripes shift backward and the planted foot stays put relative to the belt.
6. **Composition:**
   - The avatar stands on the treadmill deck and never shifts sideways between the idle, turn and run views.
   - In the turn and run frames, the avatar faces right (+x), toward the console.
   - The avatar is drawn over the treadmill deck, and no room piece covers any part of it.
   - It shows tone 4 skin, curly blonde hair, a blue tee, black shorts and red shoes.
   - Outlines are dark, and no placeholder magenta, cyan or yellow is visible.
   - The trophies stand on the shelf, the medals hang from the rack, the bib frame hangs on the wall, the plant stands on the floor, and the console is at the treadmill's right end.
7. **Screenshots:** the canvas is centered in the stage, with Edit avatar below it at full size. Nothing is clipped, including the header email and Sign out at 375 px. There are no blurry or uneven pixels.

Anything that does not match is a defect for Step 12.

- [ ] **Step 11: Visual confirmation in a real browser (CLAUDE.md rules 22-25)**

Step 9's script already covers rule 24's error state. This step covers what is left: visual confirmation on desktop and mobile, the hidden-tab edge case, and multi-user state on one device.

**Pick the browser tool.**
- First, load the `claude-in-chrome` skill.
- If it reports that browser tools are not available (the Claude in Chrome extension is not set up), use the Playwright MCP instead. Load it with ToolSearch query `select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_resize,mcp__plugin_playwright_playwright__browser_console_messages,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_evaluate,mcp__plugin_playwright_playwright__browser_click,mcp__plugin_playwright_playwright__browser_fill_form,mcp__plugin_playwright_playwright__browser_snapshot,mcp__plugin_playwright_playwright__browser_wait_for,mcp__plugin_playwright_playwright__browser_tabs` (max_results 10).
- If neither works, stop and ask the user to do 11.1-11.8 by hand in Chrome. Give them the Step 9 `user:` email and the password `room-check-Passw0rd!`. Do not skip this step or mark the task done without it.

With the Playwright MCP:
- Clicks use `browser_click` with a `target` ref taken from `browser_snapshot`.
- Fields use `browser_fill_form` with targets `#email` and `#password` (type `textbox`).
- Screenshots use `browser_take_screenshot` with `scale: "device"` and a `filename` under `.superpowers/room-check/out/` (for example `.superpowers/room-check/out/mcp-01.png`). View them with Read.

The measurement below is used by 11.3, 11.5 and 11.8 (`browser_evaluate`, `function`):

```js
() => {
  const c = document.querySelector('canvas[role="img"][data-ready="true"]');
  const main = document.querySelector('main');
  const doc = document.scrollingElement ?? document.documentElement;
  if (!(c instanceof HTMLCanvasElement) || !main) return 'room canvas not ready';
  const r = c.getBoundingClientRect();
  return {
    dpr: window.devicePixelRatio,
    cssW: r.width,
    cssH: r.height,
    backingW: c.width,
    backingH: c.height,
    label: c.getAttribute('aria-label'),
    scrolls:
      doc.scrollWidth > doc.clientWidth ||
      doc.scrollHeight > doc.clientHeight ||
      main.scrollWidth > main.clientWidth ||
      main.scrollHeight > main.clientHeight,
  };
}
```

1. **Sign in.**
   - `browser_navigate` to `http://localhost:5173/`. This is a fresh document load, so later console reads cover everything after it.
   - If the header shows a different email (left over from an earlier task), click `Sign out` first.
   - Sign in with the Step 9 `user:` email and `room-check-Passw0rd!`, then click `Sign In`.
2. **Desktop size:** `browser_resize` to 1280x800.
3. **Desktop check.**
   - Run the measurement. Expect `backingW = 180·k`, `backingH = 120·k` and `cssW = backingW / dpr`, with `k = max(1, floor(min(1024·dpr/180, 676·dpr/120)))`. At DPR 1 that is k = 5: 900x600 backing and 900x600 CSS. Also expect `scrolls: false` and the Step 9 aria-label.
   - Watch for at least 30 s: take a screenshot, then `browser_wait_for` `{ time: 3 }`, about ten times. Together the screenshots must show the front idle (breathing, and a blink when caught) and the profile run with the belt moved under the planted foot.
   - The belt is still in every non-run screenshot.
   - The single turn frame is too short to catch reliably here; Step 10's recording covers it.
4. **Console:** `browser_console_messages` with `level: "warning"` returns nothing. This user already has an avatar, so not even the 404 may appear.
5. **Mobile.**
   - `browser_resize` to 375x667 and run the measurement. Expect `k = max(1, floor(min(375·dpr/180, 543·dpr/120)))`. The 543 is 667 minus the 56 px header and the 68 px Edit avatar row.
   - At DPR 1, k = 2: backing 360x240, CSS 360x240. At DPR 2, k = 4: backing 720x480, CSS 360x240.
   - Expect `scrolls: false`.
   - Take a screenshot. The canvas is centered, Edit avatar is fully visible below it, and the header email and Sign out are not clipped.
6. **Edit and Cancel.**
   - Click `Edit avatar`. `browser_snapshot` shows the saved choices checked: tone 4, curly, blonde, blue tee, black shorts, red shoes.
   - Click `Cancel`. The URL is `#/`, the measurement shows the room again (the canvas has `data-ready="true"`), and the next screenshot shows the front idle.
7. **Hidden tab (rule 24 edge case, spec §3 dt clamp).**
   - `browser_tabs` `{ action: "new", url: "about:blank" }`, then `browser_wait_for` `{ time: 10 }`, then `browser_tabs` `{ action: "select", index: 0 }`.
   - Take two screenshots 2 s apart. The room is still drawn and still animating, in a valid state: front, ¾ or profile, never blank or a mix of views.
   - `browser_tabs` `{ action: "close", index: 1 }`. `browser_console_messages` at `warning` is still empty.
8. **Multi-user on one device (rule 24).**
   - Click `Sign out`, then `Don't have an account? Sign up`. Fill a new address `rc-b-<timestamp>@example.test` with the same password and click `Create Account`.
   - The app lands on `#/create` in create mode with the first option of every group checked (`DEFAULT_APPEARANCE`), not the first user's choices.
   - `browser_console_messages` at `warning` now shows exactly one line: the same spec 404 for `http://localhost:3000/avatar` that Step 9 reports. Nothing else may appear.
   - Click `Sign out`, then sign in again as the Step 9 user. The room returns, and the measurement's `label` equals the Step 9 aria-label.

Anything that does not match is a defect for Step 12.

- [ ] **Step 12: Fix every defect found, test first (skip this step when Steps 3, 9, 10 and 11 were all clean)**

Rule 26 applies: nothing here is "pre-existing". Fix one defect at a time. Use `superpowers:systematic-debugging` to find the owning module:

| Symptom | Owning module | Test that pins the fix |
|---|---|---|
| Wrong phase order or durations, or a run that stops mid-cycle | `apps/web/src/features/avatar-room/behavior.ts` | its test in `apps/web/src/features/avatar-room/__tests__/` |
| Wrong frame within a tag | `apps/web/src/features/avatar/frames.ts` | its test in `apps/web/src/features/avatar/__tests__/` |
| Layer misaligned, in the wrong order, or taken from the wrong tag | `apps/web/src/features/avatar/layers.ts` | its test in `apps/web/src/features/avatar/__tests__/` |
| Wrong colors or a visible placeholder | `apps/web/src/features/avatar/palette.ts` / `swap.ts` | their tests in `apps/web/src/features/avatar/__tests__/` |
| Item or avatar in the wrong place, or positions off whole pixels | `apps/web/src/features/avatar-room/roomLayout.ts` | its test in `apps/web/src/features/avatar-room/__tests__/` |
| Wrong k for a given stage size and DPR | `apps/web/src/features/avatar/fitScale.ts` | its test in `apps/web/src/features/avatar/__tests__/` |
| Right k but wrong backing or CSS size, or blur after a resize | `apps/web/src/features/avatar/usePixelCanvas.ts` (adapter: move the arithmetic into `fitScale.ts` first) | the `fitScale` test, then the Step 9 size checks |
| aria-label does not match the chosen appearance | `apps/web/src/features/avatar/appearance.ts` (`describeAppearance`) or the labels in `catalog.ts` | their tests in `apps/web/src/features/avatar/__tests__/` |
| Redirect after reload, a refetch loop or 404 count ≠ 1, or a missing or looping unreachable state | `apps/web/src/features/avatar/useAvatar.ts` or `apps/web/src/features/avatar-room/RoomPage.tsx` | an RTL test in `apps/web/src/features/avatar/__tests__/` (useAvatar) or `apps/web/src/features/avatar-room/__tests__/` (RoomPage), with mocked `api`, a fresh `QueryClient({ defaultOptions: { queries: { retry: false } } })` and `useAuthStore.setState({ user })` (spec §5) |
| Document or `<main>` scrolls, canvas not centered, Edit avatar clipped | Tailwind classes in `RoomPage.tsx` / `RoomScene.tsx` | no unit test (jsdom has no layout): the failing Step 9 check is the red test; rerun it until it passes |
| Belt out of sync, a frame from the wrong state, or redraws on every rAF | `apps/web/src/features/avatar-room/RoomScene.tsx` (adapter: move the decision into `behavior.ts` or `layers.ts` first) | the pure function's test in that module's `__tests__/` |
| Any other console error or warning | the module in the message's stack | its RTL test if it reproduces in jsdom; otherwise the Step 9 check |
| Missing export, slice, tag or pivot; wrong frame size; wrong pixels | the art source | art.test.ts (Step 3) and Step 10 |

For each code defect:
1. Add an `it(...)` to the owning test file that pins the correct behavior with literal inputs: no fake timers and no canvas.
2. Run `pnpm --filter @tracks/web exec vitest run <that test file>` and watch it fail for the same reason seen in the browser.
3. Fix the module, then rerun until it passes.

If the faulty decision lives in a DOM adapter (`RoomScene.tsx`, `canvas.ts` or `usePixelCanvas.ts`), first move that decision into a pure, exported function in `behavior.ts`, `layers.ts`, `roomLayout.ts` or `fitScale.ts`, and test it there. Examples are choosing the belt frame or deciding to redraw only when a frame changes. The adapter then calls the new function. Name it in the commit body and in the task report.

After each code fix, run `pnpm --filter @tracks/web test && pnpm --filter @tracks/web typecheck && pnpm --filter @tracks/web lint`, then rerun Steps 9-11. Commit each fix on its own, with every file you changed (the module, its test, and any adapter that now calls the new function):

```bash
git add <fixed module path> <its test file path>
git commit -F - <<'EOF'
fix(avatar-room): <what was wrong, in one line>

<symptom seen in the browser and the test that now pins it>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

Use the `fix(avatar):` prefix for modules in `features/avatar/`.

For an art defect, including one found in Step 3:
1. Fix the source through the MCP (spec §4: absolute paths, and no edits while the user has the file open).
2. Re-export and check that only that sprite changed:

```bash
pnpm art:export && git status --porcelain art apps/web/src/assets/sprites
```
Expected: only `art/<avatar-or-room>/<name>.aseprite`, `apps/web/src/assets/sprites/<name>.json` and `apps/web/src/assets/sprites/<name>.png` are listed.

3. Run `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts` and confirm it is green.
4. Commit the source and its exports together:

```bash
git add art/<avatar-or-room>/<name>.aseprite apps/web/src/assets/sprites/<name>.json apps/web/src/assets/sprites/<name>.png
git commit -F - <<'EOF'
fix(art): <what was wrong in <name>, in one line>

<symptom, the check that caught it (art.test.ts test name or Step 9-11 point), and what changed in the source>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

Repeat until Step 3 is green, Step 9 prints `ROOM CHECK PASSED`, and Steps 10-11 are clean. The one `spec-404` line waits on the user's decision from Step 9.

- [ ] **Step 13: Stop the dev servers and the browser**

If Step 11 used the Playwright MCP, call `mcp__plugin_playwright_playwright__browser_close`. Stop the background `pnpm dev` with TaskStop, using its task id from Step 7. Then:

```bash
netstat -ano | grep -E ':(3000|5173) .*LISTENING'
```
Expected: no output. If a child process outlived turbo, run `taskkill //PID <pid> //T //F` for each PID listed. Leave Supabase and Redis running for the e2e task.

- [ ] **Step 14: Final repo-wide verification**

```bash
pnpm typecheck && pnpm lint && pnpm test && git status --porcelain
```

Expected: turbo reports every typecheck, lint and test task successful. `git status --porcelain` prints nothing, or only `?? .playwright-mcp/`. The Step 5 commit and any Step 12 fix commits hold all changes, and git ignores `.superpowers/`.

`.playwright-mcp/` is the Playwright MCP's folder of console logs and snapshots, created if Step 11 used the Playwright MCP. Do not commit it and do not edit `.gitignore` here: Task 20 Step 2 adds `.playwright-mcp/` to `.gitignore`. Any other line is unfinished work: commit it with the change it belongs to.

In the task report, include:
- the Step 9 `spec-404` decision request
- the names of any new pure functions from Step 12

---

### Task 20: E2E, CI Playwright step, visual approval, done check

**Files:**
- Create: `e2e/avatar.spec.ts`, the local-only avatar flow from spec §5 e2e
- Create: `e2e/package.json`. This makes `e2e/` an ES module folder so the spec can import the web catalog. Playwright compiles the root `e2e/` folder as CommonJS, and `@tracks/types` exports only an `"import"` condition.
- Modify: `.gitignore`. After line 12 (`.superpowers/`), add `test-results/` and `playwright-report/`, which local Playwright runs create, and `.playwright-mcp/`, which Playwright MCP browser checks create.
- Modify: `.github/workflows/ci.yml` (lines 46-48). Insert one step between `playwright install --with-deps` and `playwright test`.
- Test: `e2e/avatar.spec.ts`
- Scratch only, never committed. They go in `C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/`, written `$T` below: `check-ci.py`, `check-build.sh`, `pages-check.mjs`, `capture.mjs`, `*.log`, `out/*.png`.

**Interfaces:**
Consumes:
- `describeAppearance(a: AvatarAppearance): string` from `apps/web/src/features/avatar/appearance.ts`
- `SKIN_TONE_OPTIONS`, `HAIR_STYLE_OPTIONS`, `HAIR_COLOR_OPTIONS`, `TOP_OPTIONS`, `BOTTOM_OPTIONS` and `SHOES_OPTIONS` from `apps/web/src/features/avatar/catalog.ts`. Each is a `Record<…, Option …>`; the spec uses `.label`.
- The CreatorPage/OptionGroup DOM:
  - One `<fieldset>` per field, with legends `Skin tone`, `Hair style`, `Hair color`, `Top`, `Bottom` and `Shoes`.
  - Each option is an `<input type="radio">`. Its `value` is the item ID and its accessible name is the catalog label.
  - a `Save` button and, in edit mode, a `Cancel` link (`<a>` rendered by `Button asChild` around `<Link to="/">`).
- The RoomPage/RoomScene DOM:
  - `<canvas role="img" aria-label={describeAppearance(appearance)} data-ready="true">`.
  - An `Edit avatar` link to `#/create`.
  - An unreachable state: `role="alert"` with "Can't reach the server", plus a `Retry` button.
- `apps/web/src/assets/sprites/body.json`, tags `front-idle` and `turn`. The format is json-array: `frames[i].duration` and `meta.frameTags`.
- Root scripts `test:db` and `art:export`. The pgTAP file `supabase/tests/database/avatars.test.sql`. The art check `apps/web/src/features/avatar/__tests__/art.test.ts`.

Produces:
- The Playwright test `a new player creates an avatar, reloads the room and edits the avatar` in `e2e/avatar.spec.ts`. It is skipped when `process.env['CI']` is set.
- `e2e/package.json`: `{ "private": true, "type": "module" }`
- A ci.yml step, placed directly before `pnpm exec playwright test`: `grep -v '^REDIS_URL=' apps/api/.env.example > apps/api/.env && cp apps/web/.env.example apps/web/.env`
- No new TypeScript exports

**Fix rule (applies to every step that finds a bug).** When a check fails, the app, the art or an earlier task's code is wrong. Never edit an assertion or an expected value to match the bug.
1. Use superpowers:systematic-debugging to find the cause. Fix it in the owning task's files. If a unit test can show the bug, write that failing test first (superpowers:test-driven-development).
2. Run the owning task's tests (`pnpm --filter <package> exec vitest run <its test files>`), then `pnpm typecheck` and `pnpm lint`.
3. Commit only the fix. Stage its exact paths. Never use `git add -A` or `git add .`, and never stage a Task 20 file that the fix does not change:
```bash
git add <each fixed path>
git commit -F - <<'EOF'
Fix <what was wrong, in a few words>

<What the Task 20 check showed, the cause, and why the change fixes it.>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```
4. Rerun the step that failed, then continue. Committed fixes never show in later `git status` checks. If a fix lands during Steps 24-30, rerun Steps 19-23 before Step 31.

- [ ] **Step 1: See that Playwright's output folders are not ignored**

```bash
git check-ignore test-results/ playwright-report/ .playwright-mcp/; echo "exit $?"
```
Expected: only `exit 1`. The trailing slashes matter. Without them, `git check-ignore` cannot match a `dir/` pattern against a folder that does not exist yet.

- [ ] **Step 2: Ignore them**

Edit `.gitignore` and replace the last line, `.superpowers/`, with:

```gitignore
.superpowers/
test-results/
playwright-report/
.playwright-mcp/
```

```bash
git check-ignore test-results/ playwright-report/ .playwright-mcp/; echo "exit $?"
```
Expected: `test-results/`, `playwright-report/`, `.playwright-mcp/`, then `exit 0`.

- [ ] **Step 3: Write the e2e spec**

Create `e2e/avatar.spec.ts`:

```ts
import { test, expect, type Locator, type Page } from '@playwright/test';
import { describeAppearance } from '../apps/web/src/features/avatar/appearance.js';
import {
  SKIN_TONE_OPTIONS,
  HAIR_STYLE_OPTIONS,
  HAIR_COLOR_OPTIONS,
  TOP_OPTIONS,
  BOTTOM_OPTIONS,
  SHOES_OPTIONS,
} from '../apps/web/src/features/avatar/catalog.js';

type Appearance = Parameters<typeof describeAppearance>[0];
type Field = keyof Appearance;

test.skip(!!process.env['CI'], 'needs local Supabase + Redis');

const PASSWORD = 'e2e-password-123';

// The creator's fieldsets, in page order
const GROUPS: ReadonlyArray<{ legend: string; field: Field }> = [
  { legend: 'Skin tone', field: 'skin_tone' },
  { legend: 'Hair style', field: 'hair_style' },
  { legend: 'Hair color', field: 'hair_color' },
  { legend: 'Top', field: 'top' },
  { legend: 'Bottom', field: 'bottom' },
  { legend: 'Shoes', field: 'shoes' },
];

// Every field differs from DEFAULT_APPEARANCE (the first value of each enum).
// Red hair next to the default red tee is why radio lookups are scoped to their group.
const chosen: Appearance = {
  skin_tone: 'tone-4',
  hair_style: 'curly',
  hair_color: 'red',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};

function optionLabel(appearance: Appearance, field: Field): string {
  switch (field) {
    case 'skin_tone':
      return SKIN_TONE_OPTIONS[appearance.skin_tone].label;
    case 'hair_style':
      return HAIR_STYLE_OPTIONS[appearance.hair_style].label;
    case 'hair_color':
      return HAIR_COLOR_OPTIONS[appearance.hair_color].label;
    case 'top':
      return TOP_OPTIONS[appearance.top].label;
    case 'bottom':
      return BOTTOM_OPTIONS[appearance.bottom].label;
    case 'shoes':
      return SHOES_OPTIONS[appearance.shoes].label;
  }
}

function radio(page: Page, legend: string, name: string): Locator {
  return page.getByRole('group', { name: legend }).getByRole('radio', { name, exact: true });
}

async function expectRoom(page: Page, appearance: Appearance): Promise<void> {
  // data-ready is set once every sheet has loaded and the first frame is drawn
  await expect(page.locator('canvas[data-ready="true"]')).toHaveAccessibleName(
    describeAppearance(appearance),
    { timeout: 15_000 },
  );
  await expect(page).toHaveURL(/#\/$/);
}

test('a new player creates an avatar, reloads the room and edits the avatar', async ({ page }) => {
  test.slow();
  // The local database persists between runs, so every run signs up a new address
  const email = `e2e-${Date.now()}@example.test`;

  await page.goto('/');
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create Account' }).click();

  // No avatar yet: RoomPage sends the new player to the creator
  await expect(page).toHaveURL(/#\/create$/, { timeout: 15_000 });

  const recorded: Record<Field, string> = {
    skin_tone: '',
    hair_style: '',
    hair_color: '',
    top: '',
    bottom: '',
    shoes: '',
  };
  for (const { legend, field } of GROUPS) {
    const option = radio(page, legend, optionLabel(chosen, field));
    await option.check();
    recorded[field] = await option.inputValue();
  }
  expect(recorded).toEqual(chosen);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expectRoom(page, chosen);

  // A reload refetches the saved avatar and stays in the room
  await page.reload();
  await expectRoom(page, chosen);

  // Edit mode is prefilled with the saved appearance
  await page.getByRole('link', { name: 'Edit avatar' }).click();
  await expect(page).toHaveURL(/#\/create$/);
  for (const { legend, field } of GROUPS) {
    await expect(
      page.getByRole('group', { name: legend }).getByRole('radio', { checked: true }),
    ).toHaveValue(recorded[field]);
  }

  // Changing one field and saving goes through the update path
  const updated: Appearance = { ...chosen, hair_color: 'blonde' };
  await radio(page, 'Hair color', optionLabel(updated, 'hair_color')).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expectRoom(page, updated);

  await page.reload();
  await expectRoom(page, updated);
});
```

- [ ] **Step 4: Load the spec and see it fail**

```bash
pnpm exec playwright test --list e2e/avatar.spec.ts
```

`--list` only loads the spec files; it does not start the webServers. Expected: exit 1 with
`Error: No "exports" main defined in D:\Projects\Tracks\apps\web\node_modules\@tracks\types\package.json`.
The code frame points at the first `@tracks/types` import under `apps\web\src\features\avatar\`, and the run ends with `Total: 0 tests in 0 files`. Playwright compiles the root `e2e/` folder as CommonJS, so it runs `require('@tracks/types')`, and that package exports only an `"import"` condition.

- [ ] **Step 5: Make `e2e/` an ES module folder**

Create `e2e/package.json`. It is not a workspace package, because `pnpm-workspace.yaml` covers only `apps/*` and `packages/*`.

```json
{
  "private": true,
  "type": "module"
}
```

- [ ] **Step 6: Load the spec again and see it pass**

```bash
pnpm exec playwright test --list e2e/avatar.spec.ts
```

Expected:
```
Listing tests:
  avatar.spec.ts:70:1 › a new player creates an avatar, reloads the room and edits the avatar
Total: 1 test in 1 file
```
The run might fail instead with `TypeError: (intermediate value).glob is not a function`, with the code frame at the `import.meta.glob(...)` call in `sheets.ts`. That means a module reachable from `appearance.ts` or `catalog.ts` imports a runtime value from `sheets.ts`. Type-only imports are not the cause, because Playwright's Babel already drops `import type` and `import { type SheetId }`. Apply the fix rule. Move that runtime use out of every module `appearance.ts` and `catalog.ts` can reach, so they import `sheets.ts` for types only. Per the contract, they need only the `SheetId` type. Do not just rewrite the import as `import type`, because that breaks the module that uses the value. Then rerun this step.

- [ ] **Step 7: Check that the local stack is up**

```bash
supabase status
docker compose up -d
for f in apps/api/.env apps/web/.env; do if [ ! -f "$f" ]; then echo "MISSING $f"; elif grep -q '<from supabase start>' "$f"; then echo "PLACEHOLDER LEFT in $f"; else echo "$f filled in"; fi; done
curl -s -o /dev/null -w "3000: %{http_code}\n" http://localhost:3000/health; curl -s -o /dev/null -w "5173: %{http_code}\n" http://localhost:5173/
```

Expected:
- `supabase status` (CLI 2.98.1) prints `supabase local development setup is running.` and an `APIs` table with the row `Project URL │ http://127.0.0.1:54321`.
  - A `Stopped services: [supabase_imgproxy_tracks_app supabase_pooler_tracks_app]` line is normal for this config, as is an "A new version of Supabase CLI is available" notice.
  - If it says the stack is not running, run `supabase start` and rerun this step.
- `docker compose up -d` reports the redis container as `Running` or `Started`.
- The loop prints `apps/api/.env filled in` and `apps/web/.env filled in`.
  - `MISSING` means you must copy that app's `.env.example` to `.env`.
  - `PLACEHOLDER LEFT` means that `.env` still has a `<from supabase start>` value. Fill in every such value from `supabase status`, as the README describes.
- Both curls print `000`, so nothing is listening yet. If either port answers, stop that dev server before Step 9.

- [ ] **Step 8: Run the avatar e2e against the real app**

```bash
pnpm exec playwright test e2e/avatar.spec.ts --reporter=line
```

Expected: `Running 1 test using 1 worker`, then a `[1/1] … avatar.spec.ts:70:1 › a new player creates an avatar, reloads the room and edits the avatar` line and `1 passed (…s)`.
- `--reporter=line` stops the html reporter from opening a report server that blocks when a test fails.
- A failure means the app is wrong, so apply the fix rule.
- If a click fails with `<div class="… tsqd-open-btn-container"> … intercepts pointer events`, the dev-only TanStack Query devtools toggle is covering that control. It is fixed to the bottom-right in dev. That is a layout bug in the owning task's page.

- [ ] **Step 9: Run the suite as CI would (avatar spec skipped)**

```bash
CI=1 pnpm exec playwright test --reporter=line
```

With `CI` set, `reuseExistingServer` is false, so Playwright starts its own servers and ports 3000 and 5173 must be free (Step 7). Expected: `Running 4 tests using 1 worker`, then `1 skipped` and `3 passed`. The skipped test is the one in `avatar.spec.ts`, and the three `auth.spec.ts` tests pass.

- [ ] **Step 10: Commit the e2e flow**

```bash
git status --porcelain
```
Expected: exactly ` M .gitignore`, `?? e2e/avatar.spec.ts` and `?? e2e/package.json`. Fixes are already committed under the fix rule, and `test-results/` is ignored.

```bash
git add e2e/avatar.spec.ts e2e/package.json .gitignore
git commit -F - <<'EOF'
Add avatar e2e flow and ignore Playwright output

e2e/avatar.spec.ts signs up a new player, saves a non-default avatar,
checks the room canvas's readiness and accessible name across a reload,
then edits the hair color and checks the update survives a reload. It
skips in CI, which has no local Supabase or Redis. e2e/package.json makes
the folder ESM so the spec can import the web catalog (@tracks/types
exports only an "import" condition). .gitignore now covers test-results/,
playwright-report/ and the Playwright MCP's .playwright-mcp/ folder.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 11: Write the CI step check and see it fail**

Create `$T/check-ci.py`, where `$T` is `C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20`:

```python
import sys
import yaml

path = sys.argv[1] if len(sys.argv) > 1 else '.github/workflows/ci.yml'
with open(path, encoding='utf-8') as f:
    steps = yaml.safe_load(f)['jobs']['check']['steps']
runs = [step.get('run') for step in steps]
i = runs.index('pnpm exec playwright test')
expected = "grep -v '^REDIS_URL=' apps/api/.env.example > apps/api/.env && cp apps/web/.env.example apps/web/.env"
assert runs[i - 1] == expected, f'step before playwright test is: {runs[i - 1]!r}'
assert runs.count(expected) == 1, 'the .env step must appear exactly once'
print('ci.yml OK: .env step sits directly before playwright test')
```

```bash
python C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/check-ci.py
```

Expected: exit 1 with `AssertionError: step before playwright test is: 'pnpm exec playwright install --with-deps'`.

- [ ] **Step 12: Add the CI step**

In `.github/workflows/ci.yml`, replace lines 46-48:

```yaml
      - run: pnpm exec playwright install --with-deps

      - run: pnpm exec playwright test
```

with:

```yaml
      - run: pnpm exec playwright install --with-deps

      # The API dev server (tsx watch --env-file=.env) exits without apps/api/.env, so
      # create both .env files from the examples. REDIS_URL is dropped: CI has no Redis,
      # so rate limiting stays in memory. auth.spec.ts only needs the placeholder values.
      - run: grep -v '^REDIS_URL=' apps/api/.env.example > apps/api/.env && cp apps/web/.env.example apps/web/.env

      - run: pnpm exec playwright test
```

- [ ] **Step 13: Check the step and its effect**

```bash
python C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/check-ci.py
T=C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/ci-sim && rm -rf "$T" && mkdir -p "$T/apps/api" "$T/apps/web" && cp apps/api/.env.example "$T/apps/api/" && cp apps/web/.env.example "$T/apps/web/" && (cd "$T" && grep -v '^REDIS_URL=' apps/api/.env.example > apps/api/.env && cp apps/web/.env.example apps/web/.env) && grep -c '' "$T/apps/api/.env"; grep -c REDIS_URL "$T/apps/api/.env"; cmp "$T/apps/web/.env" apps/web/.env.example && echo "web .env matches example"
```

The simulation works on scratch copies and never touches the real `apps/*/.env`. Expected: `ci.yml OK: .env step sits directly before playwright test`, then `8`, `0` and `web .env matches example`.

- [ ] **Step 14: Commit the CI fix**

```bash
git add .github/workflows/ci.yml
git commit -F - <<'EOF'
Create .env files before the CI Playwright run

The API dev server (tsx watch --env-file=.env) exits without
apps/api/.env, so no Playwright test ran in CI. Copy both examples,
minus REDIS_URL so rate limiting stays in memory without a Redis server.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
EOF
```

- [ ] **Step 15: Write the build-warning check and confirm Task 12's vendor split**

Create `$T/check-build.sh`:

```bash
#!/usr/bin/env bash
# Builds @tracks/web (tsc --noEmit && vite build) and fails when the build exits non-zero
# or writes anything to stderr besides pnpm's "$ <script>" echo line. Vite prints its
# "(!) Some chunks are larger than 500 kB" warning there. Run from the repo root.
# Scratch only, never committed.
set -u
err=$(pnpm --filter @tracks/web build 2>&1 >/dev/null)
status=$?
extra=$(printf '%s\n' "$err" | grep -v -e '^\$ ' -e '^$')
if [ "$status" -ne 0 ]; then
  echo "FAIL: web build exited $status"
  printf '%s\n' "$err"
  exit 1
fi
if [ -n "$extra" ]; then
  echo "FAIL: web build wrote to stderr:"
  printf '%s\n' "$extra"
  exit 1
fi
echo "OK: web build wrote nothing to stderr"
```

```bash
bash C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/check-build.sh
ls apps/web/dist/assets/*.js
```

Expected: `OK: web build wrote nothing to stderr`, and `index-`, `react-`, `rolldown-runtime-`, `supabase-` and `vendor-` `.js` files. Task 12 Steps 19-21 split vendor code into these chunks. A FAIL showing `(!) Some chunks are larger than 500 kB` means that split is missing or broken. Fix it in Task 12's apps/web/vite.config.ts under the fix rule.

- [ ] **Steps 16-18: (none. Task 12 Steps 19-21 already split the vendor chunks.)**

- [ ] **Step 19: Done-when 2: typecheck and lint**

```bash
set -o pipefail; T=C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20
pnpm typecheck 2>&1 | tee "$T/typecheck.log"; echo "typecheck exit $?"
pnpm lint 2>&1 | tee "$T/lint.log"; echo "lint exit $?"
grep -n -E '[Ww]arn|WARN|problem' "$T/typecheck.log" "$T/lint.log" || echo 'no warnings'
```

Expected: `typecheck exit 0` and `lint exit 0`. Each run ends with `Tasks: N successful, N total`, the two numbers equal, and there is no `Failed:` line. Last comes `no warnings`, because rule 26 allows no warnings anywhere. Do not use `grep -i` here: Git Bash's grep aborts on these UTF-8 logs.

- [ ] **Step 20: Done-when 2: test and build**

```bash
set -o pipefail; T=C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20
pnpm test 2>&1 | tee "$T/test.log"; echo "test exit $?"
pnpm build 2>&1 | tee "$T/build.log"; echo "build exit $?"
grep -n -E 'stderr \||Not implemented|[Ww]arn|WARN|\(!\)' "$T/test.log" "$T/build.log" || echo 'no stray output'
```

Expected: `test exit 0` and `build exit 0`. Each ends with `Tasks: N successful, N total`, the two numbers equal, and every Vitest summary shows only passed tests. Last comes `no stray output`. A match means a bug under the fix rule, such as a jsdom `Not implemented`, a React `act` warning or a Vite `(!)` line. The one exception is a match that is only part of a test's name, so read each match.

- [ ] **Step 21: Done-when 2: database tests after a reset**

```bash
supabase db reset
pnpm test:db
```

`supabase db reset` wipes local data and proves that both migrations apply. It ends with `Finished supabase db reset`. `pnpm test:db` (`supabase test db`) prints `avatars.test.sql .. ok`, `All tests successful.` and `Result: PASS`.

- [ ] **Step 22: Done-when 2: the full Playwright suite after the reset**

```bash
pnpm exec playwright test --reporter=line
```

Expected: `Running 4 tests`, then `4 passed`. Ports 3000 and 5173 must be free, or Playwright reuses whatever is listening there.

- [ ] **Step 23: Done-when 3: the art export is reproducible**

```bash
git status --porcelain
pnpm art:export
git status --porcelain art apps/web/src/assets/sprites
```

Expected:
- The first `git status` prints nothing. If it prints anything, a fix was left uncommitted, so go back to the fix rule.
- `pnpm art:export` exits 0.
- The last command prints nothing.

If the last command lists files:
- **Only `apps/web/src/assets/sprites/*` changed.** The committed exports are stale against the committed sources.
  1. Run `pnpm --filter @tracks/web exec vitest run src/features/avatar/__tests__/art.test.ts`, which must pass.
  2. Open each changed PNG with Read and confirm it is the intended art.
  3. Commit:
     ```bash
     git add apps/web/src/assets/sprites
     git commit -F - <<'EOF'
     Re-export sprites from committed sources

     pnpm art:export changed the committed exports, so they were stale
     against the committed .aseprite sources. Commit the fresh exports so
     a clean export leaves the tree unchanged.

     Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
     Claude-Session: https://claude.ai/code/session_01GGAVezZ132jFD75eqcubE3
     EOF
     ```
  4. Rerun Step 20, then this step. If a second export changes files again, the export is not deterministic. That is a bug in `scripts/export-art.ts`, so apply the fix rule.
- **Anything under `art/` changed.** The export wrote to a source, which is a bug in `scripts/export-art.ts`. Restore the committed sources with `git restore art`, then fix the script under the fix rule.

- [ ] **Step 24: Done-when 4: build like GitHub Pages**

```bash
MSYS2_ENV_CONV_EXCL=VITE_BASE_PATH VITE_BASE_PATH=/tracks/ VITE_API_BASE_URL= bash C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/check-build.sh
grep -o 'src="/tracks/assets/[^"]*\.js"' apps/web/dist/index.html
if grep -q 'localhost:3000' apps/web/dist/assets/*.js; then echo 'FAIL: an API URL is inlined'; else echo 'OK: no API URL inlined'; fi
```

- `MSYS2_ENV_CONV_EXCL` stops Git Bash from rewriting `/tracks/` to `C:/Program Files/Git/tracks/`.
- The empty `VITE_API_BASE_URL=` overrides `apps/web/.env`. Vite gives process env priority even when the value is empty.
- The build is the one deploy-staging.yml runs: `pnpm --filter @tracks/web build`.

Expected: `OK: web build wrote nothing to stderr`, then `src="/tracks/assets/index-<hash>.js"` and `OK: no API URL inlined`.

- [ ] **Step 25: Done-when 4: the Pages build shows the unreachable state**

Create `$T/pages-check.mjs`:

```js
// Done-when 4: a Pages-style build (base /tracks/, VITE_API_BASE_URL empty) shows the
// server-unreachable state and never redirects. Scratch only, never committed.
// Run from the repo root while `vite preview` serves that build on :4199.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(resolve(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:4199/tracks/';
const OUT = join(import.meta.dirname, 'out');
mkdirSync(OUT, { recursive: true });

const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  const avatarResponse = page.waitForResponse((r) => new URL(r.url()).pathname === '/avatar', {
    timeout: 30_000,
  });
  await page.goto(BASE);
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel('Email').fill(`pages-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('pages-password-123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  // With an empty VITE_API_BASE_URL the GET goes to the page's own origin, like GitHub Pages
  const res = await avatarResponse;
  console.log(`GET ${res.url()} -> ${res.status()} ${res.headers()['content-type'] ?? ''}`);

  const alert = page.getByRole('alert').filter({ hasText: /reach the server/i });
  await alert.waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.waitForTimeout(1000);
  await alert.waitFor();
  console.log(`URL after Retry: ${page.url()}`);
  if (!page.url().endsWith('#/')) failures.push(`redirected away from #/ to ${page.url()}`);
  await page.screenshot({ path: join(OUT, 'pages-unreachable-iphone-se.png') });
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`FAIL\n  ${failures.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('PASS: the Pages build shows the server-unreachable state');
}
```

Start the preview in the background (Bash `run_in_background: true`):
```bash
MSYS2_ENV_CONV_EXCL=VITE_BASE_PATH VITE_BASE_PATH=/tracks/ pnpm --filter @tracks/web exec vite preview --port 4199 --strictPort
```
Then, in the foreground:
```bash
curl --retry 30 --retry-delay 1 --retry-connrefused -s -o /dev/null -w "%{http_code}\n" http://localhost:4199/tracks/
node C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/pages-check.mjs
```

Expected: `200`, then:
```
GET http://localhost:4199/avatar -> 404 text/plain
URL after Retry: http://localhost:4199/tracks/#/
PASS: the Pages build shows the server-unreachable state
```
`/avatar` is outside the `/tracks/` base, so `vite preview` answers it with a non-JSON 404, just as GitHub Pages answers with an HTML 404. api.ts turns that into code `UNKNOWN`. The real staging Pages deploy is checked after merge (Done-when 4).

- [ ] **Step 26: Stop the preview and restore the normal web build**

Stop the background preview with TaskStop (load it first with ToolSearch `select:TaskStop`). On Windows, TaskStop can end the pnpm wrapper while the node child keeps listening, so always check the port. Then:
```bash
curl -s -o /dev/null -w "4199: %{http_code}\n" http://localhost:4199/tracks/
```
If this prints anything other than `4199: 000`, run this in PowerShell, then rerun the curl: `Get-NetTCPConnection -LocalPort 4199 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -Confirm:$false }`.
```bash
bash C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/check-build.sh
grep -o 'src="/assets/[^"]*\.js"' apps/web/dist/index.html
```
Expected: `4199: 000`, `OK: web build wrote nothing to stderr` and `src="/assets/index-<hash>.js"`.

- [ ] **Step 27: Write the visual capture script**

Create `$T/capture.mjs`:

```js
// Spec §5 Visual: creator and room captures for user approval. Scratch only, never committed.
// Run from the repo root while the API (:3000) and web (:5173) dev servers are up.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo = process.cwd();
const require = createRequire(resolve(repo, 'package.json'));
const { chromium, devices } = require('@playwright/test');

const BASE = 'http://localhost:5173';
const OUT = join(import.meta.dirname, 'out');
const EMAIL = `visual-${Date.now()}@example.test`;
const PASSWORD = 'visual-password-123';

// Non-default picks so every palette swap shows; values are catalog item IDs
const PICKS = [
  ['Skin tone', 'tone-3'],
  ['Hair style', 'curly'],
  ['Hair color', 'auburn'],
  ['Top', 'starter-tee-blue'],
  ['Bottom', 'starter-shorts-black'],
  ['Shoes', 'starter-shoes-red'],
];

// The dev server mounts <ReactQueryDevtools>, whose fixed bottom-right toggle never
// ships in a production build. Hide it (visibility keeps its box for the overlap check).
const HIDE_DEVTOOLS_CSS =
  '.tsqd-parent-container, .tsqd-parent-container * { visibility: hidden !important; }';

function descriptor(name) {
  // Every capture runs in Chromium (CLAUDE.md rule 10: Chrome device emulation)
  const { defaultBrowserType: _unused, ...options } = devices[name];
  return options;
}

// Spec §1 Scale: k = fitScale(...), backing width 180·k, CSS width = backing ÷ DPR
const TARGETS = [
  { slug: 'iphone-se', options: descriptor('iPhone SE (3rd gen)'), backing: 720, css: 360 },
  { slug: 'iphone-14', options: descriptor('iPhone 14'), backing: 1080, css: 360 },
  { slug: 'pixel-7', options: descriptor('Pixel 7'), backing: 1080, css: 1080 / 2.625 },
  {
    slug: 'desktop',
    options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
    backing: 900,
    css: 900,
  },
];

// Math.random() is stubbed to 0 in every capture page, so idle lasts
// ceil(4000 / idleLoop) · idleLoop ms, then one turn frame, then the run lasts at least 8 s
const body = JSON.parse(readFileSync(resolve(repo, 'apps/web/src/assets/sprites/body.json'), 'utf8'));
function tagMs(name) {
  const tag = body.meta.frameTags.find((t) => t.name === name);
  if (!tag) throw new Error(`body.json has no ${name} tag`);
  let ms = 0;
  for (let i = tag.from; i <= tag.to; i += 1) ms += body.frames[i].duration;
  return ms;
}
const idleLoopMs = tagMs('front-idle');
const RUN_CAPTURE_DELAY_MS = Math.ceil(4000 / idleLoopMs) * idleLoopMs + tagMs('turn') + 1000;

const docOverflow = () => {
  const el = document.documentElement;
  const main = document.querySelector('main');
  return {
    x: Math.max(el.scrollWidth - el.clientWidth, main ? main.scrollWidth - main.clientWidth : 0),
    y: Math.max(el.scrollHeight - el.clientHeight, main ? main.scrollHeight - main.clientHeight : 0),
  };
};
const canvasHasPixels = () => {
  const source = document.querySelector('canvas');
  if (!source || source.width === 0) return false;
  // Read back a fresh copy, so polling never triggers Chrome's repeated-readback warning on the app's canvas
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext('2d');
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
  return false;
};
// Names of the listed buttons and links that the (hidden) devtools toggle would cover in dev
const coveredByDevtools = (names) => {
  const toggle = document.querySelector('.tsqd-open-btn-container');
  if (!toggle) return [];
  const t = toggle.getBoundingClientRect();
  return [...document.querySelectorAll('button, a')]
    .filter((b) => names.includes((b.textContent ?? '').trim()))
    .filter((b) => {
      const r = b.getBoundingClientRect();
      return r.left < t.right && t.left < r.right && r.top < t.bottom && t.top < r.bottom;
    })
    .map((b) => (b.textContent ?? '').trim());
};

const failures = [];
function check(ok, message) {
  if (!ok) failures.push(message);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  // 1. Sign up a fresh player and save a non-default avatar
  const setup = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await setup.newPage();
  await page.goto(`${BASE}/`);
  await page.addStyleTag({ content: HIDE_DEVTOOLS_CSS });
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.waitForURL(/#\/create$/, { timeout: 30_000 });
  await page.getByRole('group', { name: 'Skin tone' }).waitFor();
  await page.waitForFunction(canvasHasPixels);
  await page.screenshot({ path: join(OUT, 'creator-new-desktop.png') });
  for (const [legend, value] of PICKS) {
    await page
      .getByRole('group', { name: legend })
      .locator(`input[type="radio"][value="${value}"]`)
      .check();
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/#\/$/);
  await page.locator('canvas[data-ready="true"]').waitFor({ timeout: 30_000 });
  const storageState = await setup.storageState();
  await setup.close();

  // 2. Room (idle, then run) and creator (edit mode) on every device
  for (const target of TARGETS) {
    const context = await browser.newContext({ ...target.options, storageState });
    await context.addInitScript(() => {
      Math.random = () => 0;
    });
    const p = await context.newPage();
    const consoleProblems = [];
    p.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleProblems.push(`${msg.type()}: ${msg.text()}`);
      }
    });
    p.on('pageerror', (err) => consoleProblems.push(`pageerror: ${err.message}`));

    await p.goto(`${BASE}/#/`);
    await p.addStyleTag({ content: HIDE_DEVTOOLS_CSS });
    const room = p.locator('canvas[data-ready="true"]');
    await room.waitFor({ timeout: 30_000 });
    const size = await room.evaluate((c) => ({
      backing: c.width,
      css: c.getBoundingClientRect().width,
      dpr: window.devicePixelRatio,
    }));
    const roomOverflow = await p.evaluate(docOverflow);
    await p.screenshot({ path: join(OUT, `room-idle-${target.slug}.png`) });
    await p.waitForTimeout(RUN_CAPTURE_DELAY_MS);
    await p.screenshot({ path: join(OUT, `room-run-${target.slug}.png`) });

    await p.getByRole('link', { name: 'Edit avatar' }).click();
    await p.waitForURL(/#\/create$/);
    await p.getByRole('group', { name: 'Skin tone' }).waitFor();
    await p.waitForFunction(canvasHasPixels);
    const creatorOverflow = await p.evaluate(docOverflow);
    await p.screenshot({ path: join(OUT, `creator-top-${target.slug}.png`) });
    await p.getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded();
    const covered = await p.evaluate(coveredByDevtools, ['Save', 'Cancel']);
    await p.screenshot({ path: join(OUT, `creator-bottom-${target.slug}.png`) });

    check(size.backing === target.backing, `${target.slug}: room backing width ${size.backing}, expected ${target.backing}`);
    check(Math.abs(size.css - target.css) < 0.1, `${target.slug}: room CSS width ${size.css}, expected ${target.css}`);
    check(roomOverflow.x <= 0 && roomOverflow.y <= 0, `${target.slug}: room document or <main> scrolls ${JSON.stringify(roomOverflow)}`);
    check(creatorOverflow.x <= 0 && creatorOverflow.y <= 0, `${target.slug}: creator document or <main> scrolls ${JSON.stringify(creatorOverflow)}`);
    check(covered.length === 0, `${target.slug}: the dev-only devtools toggle covers ${covered.join(', ')}`);
    check(consoleProblems.length === 0, `${target.slug}: console\n    ${consoleProblems.join('\n    ')}`);
    console.log(
      `${target.slug}: room ${size.css.toFixed(2)} CSS px (backing ${size.backing}, DPR ${size.dpr}); ` +
        `overflow room ${roomOverflow.x}/${roomOverflow.y}, creator ${creatorOverflow.x}/${creatorOverflow.y}; ` +
        `devtools covers ${covered.length}; console problems ${consoleProblems.length}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`FAIL\n  ${failures.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${TARGETS.length} devices, captures in ${OUT}`);
}
```

```bash
node --check C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/capture.mjs && echo syntax-ok
```
Expected: `syntax-ok`.

- [ ] **Step 28: Start both dev servers**

Run each command in the background (Bash `run_in_background: true`), as two separate calls:
```bash
pnpm --filter @tracks/api dev
```
```bash
pnpm --filter @tracks/web dev
```
Then, in the foreground:
```bash
curl --retry 60 --retry-delay 1 --retry-connrefused -s -o /dev/null -w "api %{http_code}\n" http://localhost:3000/health
curl --retry 60 --retry-delay 1 --retry-connrefused -s -o /dev/null -w "web %{http_code}\n" http://localhost:5173/
```
Expected: `api 200` and `web 200`.

- [ ] **Step 29: Capture the creator and the room on every device**

```bash
node C:/Users/littl/AppData/Local/Temp/claude/D--Projects-Tracks/0efdcabf-f8e3-4530-a3dc-8729df97ba36/scratchpad/task20/capture.mjs
```
(Bash timeout 300000.) Expected:
```
iphone-se: room 360.00 CSS px (backing 720, DPR 2); overflow room 0/0, creator 0/0; devtools covers 0; console problems 0
iphone-14: room 360.00 CSS px (backing 1080, DPR 3); overflow room 0/0, creator 0/0; devtools covers 0; console problems 0
pixel-7: room 411.43 CSS px (backing 1080, DPR 2.625); overflow room 0/0, creator 0/0; devtools covers 0; console problems 0
desktop: room 900.00 CSS px (backing 900, DPR 1); overflow room 0/0, creator 0/0; devtools covers 0; console problems 0
PASS: 4 devices, captures in C:\Users\littl\AppData\Local\Temp\claude\D--Projects-Tracks\0efdcabf-f8e3-4530-a3dc-8729df97ba36\scratchpad\task20\out
```
- The pass test is the script's own ±0.1 px tolerance, so a Pixel 7 reading of `411.42` after layout rounding is fine.
- The iPhone SE line is the evaluate check the spec requires: a 360 CSS px canvas at 375×667 and no document or `<main>` scroll (Task 19 Step 9 makes the same check on iPhone SE and desktop).
- Each of these is a bug under the fix rule (rule 26):
  - a `FAIL` line;
  - a devtools overlap, because the dev-only toggle would block that button in Step 8's e2e;
  - a console error, warning or page error.

  Restart the servers if the fix needs it, then rerun this step.

- [ ] **Step 30: Inspect the captures and send them to the user**

Open every PNG in `$T/out/` with the Read tool:
- `creator-new-desktop.png`
- `creator-top-<slug>.png` and `creator-bottom-<slug>.png`
- `room-idle-<slug>.png` and `room-run-<slug>.png`
- `pages-unreachable-iphone-se.png`

The slugs are `iphone-se`, `iphone-14`, `pixel-7` and `desktop`, so there are 18 files in all. Check each one:
- The pixels are crisp, with no smoothing.
- The avatar's feet sit on the treadmill.
- `room-run-*` shows the side-run pose on the belt. If it shows the idle pose, RoomScene is not taking its rng from `Math.random`, so investigate it under the fix rule.
- The creator's buttons are reachable in `creator-bottom-*`.
- No text is clipped and nothing overflows horizontally.
- The TanStack Query devtools toggle does not appear. capture.mjs hides it on purpose, because it exists only on the dev server.

Then load SendUserFile with ToolSearch `select:SendUserFile` and send all 18 files to the user.

- [ ] **Step 31: Stop the dev servers and confirm a clean tree**

If any fix was committed during Steps 24-30, rerun Steps 19-23 first, with the dev servers stopped as below. Stop both background dev servers with TaskStop. Then:
```bash
curl -s -o /dev/null -w "3000: %{http_code}\n" http://localhost:3000/health; curl -s -o /dev/null -w "5173: %{http_code}\n" http://localhost:5173/
```
If either port prints anything other than `000`, TaskStop left the node child running. Run this in PowerShell, then rerun the curl: `Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -Confirm:$false }`.
```bash
git status --porcelain
git log --format=%s main..HEAD | grep -x -F -e 'Add avatar e2e flow and ignore Playwright output' -e 'Create .env files before the CI Playwright run'
```
Expected:
- `3000: 000` and `5173: 000`.
- An empty `git status`.
- The grep prints `Create .env files before the CI Playwright run` and `Add avatar e2e flow and ignore Playwright output`. Any `Fix …` or `Re-export sprites …` commits from the fix rule may sit between them. That is expected.

- [ ] **Step 32: Done-when 5: get the user's approval**

Ask the user to review the 18 captures:
- The creator in create mode and edit mode.
- The room idling and running on iPhone SE, iPhone 14, Pixel 7 and desktop 1280×800.
- The Pages unreachable state.

Tell them two things about the dev-server captures. The dev-only TanStack Query devtools toggle in the bottom-right is hidden, because it never ships in a production build. capture.mjs also checked that the toggle covers neither Save nor Cancel.

Ask them to approve these captures. Also ask them to confirm that their approval of the 8× `export_tag` animation GIFs from the art checkpoints still stands. Wait for an explicit answer.

If they ask for changes:
1. Make each change under the fix rule (owning task's files, its tests, typecheck, lint, commit).
2. Rerun Steps 19-26. These cover typecheck, lint, test, build, the database, the full e2e including the avatar flow, art reproducibility and the Pages check.
3. Recapture and resend with Steps 28-30.
4. Rerun Step 31.
5. Ask again.

The task is done only when the user has approved. The CI half of Done-when 2 runs on the pull request, and the staging Pages half of Done-when 4 runs after merge. superpowers:finishing-a-development-branch handles both. Do not push without the user's go-ahead.

---
