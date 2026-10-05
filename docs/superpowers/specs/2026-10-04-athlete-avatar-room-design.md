# Athlete Avatar & Room — Design (v1)

**Date:** 2026-10-04
**Status:** Approved in brainstorming. Revised after the written-spec review, with
the user's decisions recorded at the end. Awaiting final spec approval.

## Purpose

Tracks will pull Garmin and Strava workout data. Completing goals and competing
in activities will earn customizable rewards for the player's athlete avatar. The
**main screen** is that avatar idling in a customizable space.

This spec covers v1 of that core: create an avatar and watch it idle in its room.
Workout data, goals and rewards come later; v1 must not block them.

## Scope

**In:**
- Character creator: skin tone, hair style and color, starter clothing.
- Room as the main screen: the avatar idles and periodically runs on a treadmill.
- Trophy shelf, medal rack and wall frame with sample items.
- Avatar persisted through the API to Supabase.
- Aseprite-based art pipeline with committed sources and exports.

**Out:**
- Rewards and unlock logic, and owned items.
- Garmin and Strava integration.
- Hosting the API.
- Sound.
- Avatar walking around the room.

## 1. Art & Animation

### View

The room is shown in **side view**: a flat back wall facing the camera, with a
floor below it. Reasons:

- Running, cycling and rowing read best in profile.
- Trophies, medals and frames sit flat on the wall and are fully visible.
- Only one direction needs animating.

The room has **slots**, not free placement. Slot positions come from the art
(slices, see §3 Room composition), not from code.

| Slot | Contents | v1 sample |
|------|----------|-----------|
| Trophy shelf | Trophies | `trophy-gold`, `trophy-silver`, `trophy-bronze` |
| Medal rack | Medals | `medal-gold`, `medal-silver`, `medal-bronze` |
| Wall frame | Framed bib or poster | `frame-bib` |
| Equipment | Exercise equipment | `treadmill` |
| Decor | Decor items | `plant` |

**Avatar position:** the avatar never leaves the treadmill. It idles front-facing
on the stopped belt, turns (¾ frame), then runs in profile on the same spot. Side frames face right (+x), and the treadmill's console
is at its right end. Nothing is drawn in front of the avatar in v1.

### Scale

- **Room:** native 180×120 px (3:2), drawn at an integer number of **device**
  pixels per art pixel (rule in §3 Rendering). Full-bleed under the 56 px header:
  - iPhone SE (375 px, DPR 2): 4 → 360 CSS px wide.
  - iPhone 14 (390 px, DPR 3): 6 → 360 CSS px.
  - Pixel 7 (412 px, DPR 2.625): 6 → about 411 CSS px.
  - Desktop 1280×800 at DPR 1 (1024 px beside the sidebar): 5 → 900 CSS px.
- **Avatar:** about 48 px from sole to crown, not counting hair volume. Every
  avatar frame uses a shared **64×64 cell**.
  - The cell is a hard bound: body, every hairstyle, the run bob and future
    headwear stay inside it. The crown sits around y ≈ 15.
  - Ground row y = 63: soles touch it in contact frames and lift above it in
    flight frames. The anchor pixel is (32, 63).
  - The `front-idle` body centerline and the `side-run` hip column are both
    x = 32, so switching views does not shift the figure.

### Views and animation tags

| Tag | View | Frames | Use |
|-----|------|--------|-----|
| `front-idle` | front | ~4–6: breathing, one blink per loop (loop ≈ 2–4 s) | Creator preview (frame 0, static), room idle |
| `turn` | ¾ (front-right) | 1 | Transition both ways between idle and run |
| `side-run` | side | ~8 | Treadmill run cycle |

- Every avatar layer and every future item needs **three drawings: front, ¾
  (the single `turn` frame) and side**. This was the user's choice: a smoother
  transition was judged worth one extra drawing per item.
- The `turn` frame keeps the same anchor (32, 63), and its hip column sits at
  x = 32 like the other views.
- `body.aseprite` is the timing reference. Every other avatar layer file has the
  same tags with identical `from`/`to`, direction and per-frame durations.
- All tags play `forward`; pingpong and reverse are not used. Any ease-back is
  drawn as explicit frames.
- Exact counts and durations are set when body is drawn and approved at the
  animations checkpoint. Code reads them from the exported JSON and never
  hard-codes them.

The treadmill file has a `belt` tag:
- Same frame count and per-frame durations as `side-run`. During run, belt frame
  *i* is drawn with side-run frame *i*; otherwise belt frame 0 is shown.
- Each belt frame shifts the belt texture backward by the planted foot's
  per-frame travel in body's contact frames, so the foot doesn't slide.
- Stripe spacing is more than twice that shift, so the belt never reads as
  running in reverse. One cycle's total shift is a whole number of stripe
  spacings, so the loop is seamless.

Other room pieces are static.

### Layers and palette swap

Each layer is drawn once. Skin, hair and clothing colors are produced at runtime
by swapping reserved **placeholder ramps**. Each ramp has exactly 3 shades,
`[light, base, shadow]`:

| Ramp | Placeholder RGB (light, base, shadow) | Used by |
|------|---------------------------------------|---------|
| `PH skin` | `#FF80FF #FF40FF #FF00FF` | body |
| `PH hair` | `#80FFFF #40FFFF #00FFFF` | hair-* |
| `PH cloth` | `#FFFF80 #FFFF40 #FFFF00` | top, bottom and shoes sheets |

- Each avatar sheet carries placeholders of exactly one ramp and receives exactly
  one swap. Sheets are swapped independently, so one cloth ramp serves every
  clothing slot. Anything that must follow hair color, such as eyebrows, is drawn
  in the hair files.
- Outlines are one fixed dark color shared by all layers, never swapped.
- Placeholders are identified by exact RGB value, never by GPL color name
  (Aseprite rewrites names on save). They are saturated key hues, and every
  fixed color differs from every placeholder by at least 32 in at least one RGB
  channel (checked in §5).
- `PLACEHOLDER_RAMPS` and every target ramp (per skin tone, hair color and
  clothing item ID, 3 hex values each) are defined once in
  `apps/web/src/features/avatar/palette.ts`. Target ramps are not in
  `art/palette.gpl`.

| Layer (draw order) | v1 options |
|--------------------|------------|
| body | 6 skin tones (palette swap) |
| shoes | Starter shoes in 3 colors (palette swap) |
| bottom | Starter shorts in 3 colors (palette swap) |
| top | Starter tee in 3 colors (palette swap) |
| hair | 3 styles × 8 colors (palette swap) |

Each clothing color is its own **item ID**, e.g. `starter-tee-red`. The web
catalog maps every item ID to a **base sprite plus a color swap**: the three
starter tees share one `top-starter-tee` drawing. Later reward items can map to
their own unique sprite, with or without a swap.

### Style

- `art/palette.gpl`: about 32 fixed colors plus the 9 placeholder entries. The
  ~32 limit counts fixed colors only.
- The runtime swap matches exact RGB, so every exported pixel is either fully
  transparent or an exact palette color at alpha 255 (Source rules in §4).
- Dark outlines on characters.
- Warm interior lighting. The palette starts from the approved brainstorm
  mockup's room colors: wall `#d8c8a8`, trim `#b59e7a`, floor `#8c5e3c`,
  floor-board lines `#7a5032`, dark wood for shelves and frames `#6e4b32`, window
  glass `#9fd0ef`. Only its colors and mood carry over. The mockup is not
  committed (`.superpowers/` is gitignored), and its 160×90 canvas and ~24 px
  runner are superseded by Scale above.

## 2. Data & API

### Shared catalog — `packages/types/src/avatar.schema.ts`

- **Single source of truth for option IDs:**
  - `SkinToneSchema` — `z.enum`, 6 values.
  - `HairStyleSchema` — 3 values.
  - `HairColorSchema` — 8 values.
  - `TopItemSchema`, `BottomItemSchema`, `ShoesItemSchema` — starter items, e.g.
    `starter-tee-red`, `starter-shorts-navy`.
- **`AvatarAppearanceSchema`** — `{ skin_tone, hair_style, hair_color, top, bottom, shoes }`.
- **`AvatarSchema`** — appearance plus `created_at` and `updated_at`, using the
  offset-tolerant timestamp schema.
- **Types** come from `z.infer`, are exported from `src/index.ts`, and are tested
  per the package rules.

Clothing is stored as **item IDs per slot**, so future reward items are just more
IDs.

### Database — new migration

```sql
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

alter table public.avatars enable row level security;
revoke all on table public.avatars from anon, authenticated;
grant select, insert, update, delete on table public.avatars to service_role;

create trigger set_updated_at
  before update on public.avatars
  for each row execute function public.set_updated_at();
```

- **RLS** enabled with **no policies**, and anon and authenticated hold no table
  privileges. Only the API's service-role client reads or writes the table
  (ADR-002), so Zod validation now, and item ownership later, are enforced in one
  place.
- **Grants are explicit.** Supabase no longer auto-grants new public tables to the
  Data API roles (default for new projects since 2026-05-30, for all projects from
  2026-10-30). Without the grant, hosted `GET`/`PUT /avatar` fail with 42501 → 500.
  The local CLI (2.98.1) still auto-grants, so local tests can't catch a missing
  grant.
- **`updated_at`** is maintained by the existing `public.set_updated_at()`
  function, through the trigger above.
- **Validation:** allowed values are enforced only by the API's Zod schemas, not
  database enums or CHECK constraints. This is safe because the API is the only
  writer. Adding an option changes only the catalog.
- **`user_profiles` grant fix** (separate migration, pre-existing gap with the
  same cause): `grant select, insert, update, delete on table public.user_profiles to service_role;`.
  Its existing RLS policies and trigger are unchanged.
- **Catalog IDs are append-only.** Never rename or remove an ID unless a migration
  first rewrites the rows that store it. Responses are validated against the same
  enums, so a stale stored ID makes `GET /avatar` fail with 500.

### API — three-file rule

`plugins/avatar.ts`, `services/avatar.service.ts`, and the schemas above. Both
routes use `preHandler: [fastify.authenticate]`. `user_id` always comes from
`request.user.id`; Zod strips any `user_id` sent in the body.

| Route | Behavior | `schema.response` |
|-------|----------|-------------------|
| `GET /avatar` | 200 `ApiSuccess<Avatar>`. No row → `reply.code(404).send({ success: false, error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' } })` | `200: ApiSuccessSchema(AvatarSchema)`, `404: ApiErrorSchema` |
| `PUT /avatar` | Body `AvatarAppearance` (all six fields, replaced together) → upsert → 200 `ApiSuccess<Avatar>`. Invalid body → 400 `ApiError`, code `FST_ERR_VALIDATION` | `200: ApiSuccessSchema(AvatarSchema)`, `400: ApiErrorSchema` |

Declaring 404 is required: Fastify's typed `reply.code()` rejects undeclared
codes (same pattern as `plugins/uploads.ts` declaring 400).

`avatar.service.ts`:
- `getByUserId(userId): Promise<Avatar | null>` runs
  `.select('*').eq('user_id', userId).maybeSingle()`. It throws on a real error
  and returns null when there is no row. Do not copy the `.single()` example in
  apps/api/CLAUDE.md: with no row it throws PGRST116, which becomes a 500.
- `upsertForUser(userId, appearance)` runs
  `.upsert({ user_id: userId, ...appearance }, { onConflict: 'user_id' }).select().single()`.
  It never sends `created_at` or `updated_at`, so an update keeps `created_at`
  and the trigger sets `updated_at`.

`app.ts` changes (required):
- **Error handler first.** Move `app.setErrorHandler(...)` above the auth plugin
  registration (step 6), so it also covers health and feature routes. Registered
  after them, as today, those routes fall back to Fastify's default handler: 400
  bodies have no `success` field, and a declared `400: ApiErrorSchema` becomes a
  500 `FST_ERR_FAILED_ERROR_SERIALIZATION`. Update the Registration Order list in
  apps/api/CLAUDE.md to match.
- **CORS allows PUT.** Add `methods: ['GET', 'HEAD', 'POST', 'PUT']` to the
  `@fastify/cors` registration. @fastify/cors 11 defaults to GET, HEAD and POST,
  so the browser's preflight for `PUT /avatar` (Authorization plus a JSON body)
  fails.

### Future, not built

An `owned_items` table. `PUT /avatar` will then also verify ownership of equipped
items. Nothing above changes shape.

## 3. Web App

### Routing (hash router)

- AppShell's children become `{ index: true, element: <RoomPage /> }` and
  `{ path: 'create', element: <CreatorPage /> }`. Both get AppShell's auth guard,
  its Header (email and Sign out), `h-[100dvh]` and safe-area insets.
- AppShell's `<main>` drops `p-4` (it becomes `flex-1 overflow-y-auto`), so each
  page owns its padding: CreatorPage uses `p-4`, RoomPage is full-bleed. Pages
  never add `h-[100dvh]` or safe-area padding of their own.
- Delete `pages/DashboardPage.tsx` and its entries in the README tree and in
  `scripts/init.ts` TARGET_FILES. Sidebar `navItems` becomes
  `[{ path: '/', label: 'Room' }]`.
- LoginPage is unchanged (it navigates to `/`). RoomPage decides where the user
  goes, using the outcomes in Data below: no avatar → `#/create`.
- The room's **Edit avatar** action opens `#/create` prefilled with the current
  appearance.

### Feature folders (`src/features/<name>/`)

- **`avatar/`** — shared rendering:
  - **Catalog:** one `Record<z.infer<typeof XSchema>, Entry>` per option set, so
    every ID must have an entry. Each entry has a display `label` (e.g. 'Red tee',
    'Curly', 'Tone 3') plus its base sprite and/or swap.
  - `DEFAULT_APPEARANCE`: the first value of each enum, `satisfies AvatarAppearance`.
  - `describeAppearance(appearance)`: a sentence built from the labels, e.g.
    "Your athlete: tone 3 skin, curly black hair, red tee, navy shorts, white
    shoes".
  - `palette.ts`: `PLACEHOLDER_RAMPS` and every target ramp.
  - Sprite-sheet loading and the swap cache, in one thin canvas adapter
    (`canvas.ts`) that holds no logic.
  - Pure functions: `swapPixels`, `drawList`, `frameAt`, `fitScale`.
  - `drawAvatar` and the pixel-canvas sizing helper (see Rendering).
  - `<AvatarSprite>`: a canvas component that takes an appearance, an animation
    tag and a frame. It renders `role="img"` with
    `aria-label={describeAppearance(appearance)}`.
- **`avatar-creator/`** — `CreatorPage`:
  - **Mode:** create when `useAvatar` returns `null`, edit when an avatar exists.
    Pickers render only after the GET resolves, so form state starts once.
  - **Initial appearance:** create → `DEFAULT_APPEARANCE`; edit → prefilled.
  - **Layout:** the root is `flex h-full flex-col` (plus its `p-4`). The preview
    box at the top is `h-[40dvh] w-full shrink-0` and stays fixed. The pickers,
    then the error message and buttons, scroll below it in a
    `flex-1 min-h-0 overflow-y-auto` region.
  - **Preview:** `<AvatarSprite>` fills the preview box and shows `front-idle`
    frame 0, static. It updates on every picker change but does not animate:
    RoomScene's rAF loop is the app's only animation driver.
  - **Pickers:** one native `<fieldset>` with a `<legend>` per field ('Skin tone',
    'Hair style', 'Hair color', 'Top', 'Bottom', 'Shoes').
    - Each option is an `<input type="radio">` whose `value` is the item ID,
      inside a `relative` `<label>` (`size-11` for swatch options, `h-11 min-w-11` for text options such as hair styles) that also holds the swatch or text.
      Its accessible name is the catalog label.
    - The input is hidden with `peer absolute inset-0 m-0 cursor-pointer opacity-0`,
      covering the label, so it stays the hit target for taps and for
      Playwright's `check()`. Never use `sr-only`: a clipped input can't be hit,
      and `check()` times out.
    - Tap area at least 44×44 px (`size-11` swatches, `h-11 min-w-11` text). The checked option shows a visible ring or check
      (`peer-checked:`), and keyboard focus shows a ring (`peer-focus-visible:`),
      so selection is not shown by color alone.
    - Options sit in `flex flex-wrap gap-2`, never a horizontal scroller.
  - **Randomize** picks each of the six fields independently and uniformly from
    its enum. The result may equal the current appearance.
  - **Cancel** (edit mode only, `min-h-11`) returns to `#/` without saving.
    Phones have no Sidebar, so this is the only way back.
  - **Save** calls `PUT /avatar` and is disabled while pending.
    - Success: write the result into the `useAvatar` cache (see Data), then
      navigate to `#/`.
    - Failure: stay on the page with the choices kept, and show an inline
      `role="alert"` message above the buttons, styled like LoginPage's error box
      (`rounded-md bg-destructive/10 p-3 text-sm text-destructive`). No toast: no
      `<Toaster>` is mounted.
- **`avatar-room/`**:
  - `RoomPage`: root `flex h-full w-full flex-col items-center`. It holds a stage
    (`flex-1 min-h-0 w-full`, content centered) containing `<RoomScene>`, and
    below it the Edit avatar control,
    `<Button asChild variant="secondary"><Link to="/create"><Pencil /> Edit avatar</Link></Button>`
    (the default size is `min-h-11`), with `shrink-0 my-3`.
  - `RoomScene`: the single room canvas.
    - Sized from the stage (ResizeObserver on the stage, not the window or
      `<main>`) with the rule in Rendering, and centered in it.
    - Owns the rAF loop (Behavior loop below).
    - `role="img"` with `aria-label={describeAppearance(appearance)}`.
    - Sets `data-ready="true"` once every sheet it needs has loaded and the first
      frame is drawn. If a sheet fails to load, it shows an error message instead
      and never sets `data-ready`.
  - `sampleRoom.ts`: the hard-coded v1 contents, replaced by owned items later:
    `SAMPLE_ROOM = { trophies: ['trophy-gold', 'trophy-silver', 'trophy-bronze'], medals: ['medal-gold', 'medal-silver', 'medal-bronze'], frame: 'frame-bib', equipment: 'treadmill', decor: 'plant' }`.
  - `behavior.ts`: the state machine below.

### Rendering

- Plain **Canvas 2D**, no game engine. One canvas per scene; no stacked canvases.
- **Pixel-perfect sizing**, one shared helper used by `RoomScene` and
  `<AvatarSprite>`. For native size W×H (room 180×120, avatar cell 64×64):
  - `k = fitScale(availW, availH, dpr, W, H) = max(1, floor(min(availW·dpr / W, availH·dpr / H)))`,
    where availW × availH is the container's CSS content box and
    `dpr = window.devicePixelRatio`.
  - Backing store W·k × H·k; CSS size = backing size ÷ dpr. Each art pixel is
    exactly k device pixels, including on fractional-DPR phones such as Pixel 7.
  - After every resize, set `ctx.imageSmoothingEnabled = false` and
    `ctx.setTransform(k, 0, 0, k, 0, 0)` again, because resizing resets the
    context. Draw at integer art-pixel coordinates.
  - The canvas also gets CSS `image-rendering: pixelated`.
  - Recompute on ResizeObserver callbacks and on DPR change (a
    `matchMedia('(resolution: <dpr>dppx)')` change listener).
- **Sheet data** comes from the exported JSON: source rects from
  `frames[i].frame`, durations from `frames[i].duration`, tag ranges from
  `meta.frameTags` (0-based), positions from `meta.slices`. Never compute rects
  from the frame index (e.g. `i × 64`). Avatar tag ranges and durations are read
  from `body.json` and apply to every layer.
- **Palette swap:**
  `swapPixels(rgba: Uint8ClampedArray, swap: ReadonlyMap<number, number>): Uint8ClampedArray`
  is pure. Colors are packed `0xRRGGBB`. It returns a new array, maps each opaque
  pixel's RGB through `swap`, and leaves alpha unchanged.
  - The adapter draws a sheet onto a detached `document.createElement('canvas')`,
    runs `getImageData` → `swapPixels` → `putImageData`, and caches that canvas
    per (sheet, swap) when the sheet loads.
  - Not `OffscreenCanvas`: its 2D context needs Safari 16.4+, and Capacitor 8
    supports iOS 15.
- **Layers:** `drawList(appearance, tag, frameIndex)` is pure and returns the
  ordered `{ sheet, swap, rect }` list: body, shoes, bottom, top, hair.
  `drawAvatar(ctx, sheets, appearance, tag, frameIndex, feetX, feetY)` draws it
  with the cell's anchor pixel (32, 63) at (feetX, feetY). `<AvatarSprite>` is a
  thin wrapper around it; `RoomScene` calls it on the room canvas.

### Room composition

- **Slot positions are Aseprite slices**, not TypeScript constants:
  - `background.aseprite`: `trophy-1`..`trophy-3`, `medal-1`..`medal-3`, `frame`,
    `equipment`, `decor`, one slice per sample item.
  - `treadmill.aseprite`: `rider`, whose pivot is the foot point on the belt.
  - Read `meta.slices[].keys[0]`: bounds are sprite-local (not sheet)
    coordinates, and the pivot is relative to the slice's top-left.
- **Alignment:** standing items (trophies, plant, treadmill) are drawn
  bottom-center on their slice's bottom edge. Hanging items (medals, frame) are
  drawn top-center on their slice's top edge.
- **Avatar:** its feet anchor sits on the treadmill's `rider` pivot (treadmill
  draw position + rider bounds + pivot) in every state. It never moves.
- **Draw order:** background → frame → trophies → medals → plant → treadmill
  (current `belt` frame) → avatar.

### Behavior loop

```
idle (4–8 s, front-idle)
  → turn (1 frame)
  → run (8–15 s, side-run + treadmill belt)
  → turn
  → idle
```

- `step(state, dtMs, rng, timings): BehaviorState` is pure: it reads no clock and
  sets no timers. `rng: () => number` returns values in [0, 1) and is injected.
  `timings` comes from `body.json`: the `front-idle` and `side-run` loop lengths
  and the `turn` frame duration.
- It starts in idle. Durations are drawn on entry: idle `4000 + rng()·4000` ms,
  run `8000 + rng()·7000` ms. `turn` lasts its exported frame duration.
- When the idle or run duration has elapsed, the switch happens at the end of the
  current tag loop, so a run never cuts on a flight frame.
- `frameAt(tagFrames, msInState)` picks the looping frame index from the
  per-frame durations. The belt uses side-run's index during run and frame 0
  otherwise.
- `RoomScene`'s single rAF loop is the only driver. It clamps dt to ≤ 250 ms, so
  resuming a hidden tab or backgrounded app continues instead of skipping states,
  and it redraws only when a frame changes.

### Data

- TanStack Query hooks: `useAvatar` and `useSaveAvatar`, via `api.get` and
  `api.put`. No raw `fetch`, no new Zustand store. `api.ts` and `queryClient.ts`
  are unchanged.
- `useAvatar` and `useSaveAvatar` read the user with
  `useAuthStore((s) => s.user)` (`store/auth.store.ts`), never `useAuth()`:
  every `useAuth()` call runs `getSession()` and `getUser()` (a network request)
  and adds an `onAuthStateChange` subscription. `useAvatar` uses
  `queryKey: ['avatar', user?.id]` with `enabled: !!user`, so a different user
  signing in on the same device refetches.
- Its queryFn returns the unwrapped `Avatar`, or `null` when the thrown value
  parses as `ApiErrorSchema` with `error.code === 'AVATAR_NOT_FOUND'`. Anything
  else is rethrown. "No avatar yet" is therefore a success: it is not retried and
  not reported to Sentry.
- **Never classify by HTTP status.** api.ts doesn't expose it, and the Pages
  build (`VITE_API_BASE_URL` empty while the API is unhosted) gets GitHub Pages'
  HTML 404 for `/avatar`, which api.ts throws as code `UNKNOWN`.
- Outcomes, for both RoomPage and CreatorPage:

| `useAvatar` | Shows |
|-------------|-------|
| pending | A CSS-only `Skeleton`: RoomPage `aspect-[3/2] w-full max-h-full` in the stage; CreatorPage fills the preview box. No ResizeObserver or matchMedia (it is not mocked in UI tests, and jsdom has neither) |
| `null` | RoomPage: `navigate('/create', { replace: true })`. CreatorPage: create mode |
| an `Avatar` | The room, or the creator in edit mode |
| error (fetch `TypeError`, `UNKNOWN`, 5xx, 401, anything else) | A centered "Can't reach the server" message (`role="alert"`) and a `min-h-11` Retry button that calls `refetch()`. Never redirects |

- `useSaveAvatar`'s `onSuccess` calls
  `queryClient.setQueryData(['avatar', user?.id], res.data)` before the creator
  navigates to `#/`. Without it, the app-wide 5-minute `staleTime` would show the
  old appearance, or bounce a new user from a cached `null` back to `#/create`.

## 4. Art Pipeline

### MCP setup, one-time

1. Install uv:
   `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
   (installs to `%USERPROFILE%\.local\bin`, already on PATH).
2. Clone `https://github.com/diivi/aseprite-mcp` to
   `C:\Users\<you>\tools\aseprite-mcp`, outside the repo. Run `uv sync` there
   once, so the first MCP start doesn't install dependencies.
3. Register it with **local** scope. It is stored in `~/.claude.json`; nothing is
   committed and no `.mcp.json` is created, because both paths are per machine:
   ```
   claude mcp add --scope local --env "ASEPRITE_PATH=C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe" --transport stdio aseprite -- uv --directory "C:\Users\<you>\tools\aseprite-mcp" run -m aseprite_mcp
   ```
   Use absolute paths (`~` is not expanded). Keep `--transport stdio` between
   `--env` and the server name, or the CLI reads the name as an env pair.
4. Start a new Claude Code session to load it; check it with
   `claude mcp get aseprite`.

### Sources — `art/`, committed

- `art/palette.gpl`: the ~32 fixed colors plus the 9 placeholder entries, with
  exactly the RGB values in `PLACEHOLDER_RAMPS`. The MCP has no tool that loads a
  `.gpl`, so sources get it with `set_palette` (a hex list) or `run_lua_script`
  with `spr:setPalette(Palette{ fromFile = '<checkout>/art/palette.gpl' })`.
- `art/avatar/`:
  - `body.aseprite` (the timing reference)
  - `hair-<style>.aseprite`
  - one file per base clothing sprite: `top-starter-tee.aseprite`,
    `bottom-starter-shorts.aseprite`, `shoes-starter.aseprite`
- `art/room/`:
  - `background.aseprite`: wall, floor, window, shelf plank and medal-rack bar,
    plus the slot slices. No items are drawn into it.
  - `treadmill.aseprite`: `belt` tag and `rider` slice; console at the right end.
  - `frame-bib.aseprite`
  - `trophy-gold`, `trophy-silver`, `trophy-bronze`, `medal-gold`,
    `medal-silver`, `medal-bronze` (one `.aseprite` each)
  - `plant.aseprite`

### Source rules

The runtime swap matches exact RGB, so:

1. Sources stay in RGB color mode, never indexed (index 0 becomes transparent).
2. Visible layers and cels are 100% opacity with Normal blend.
3. Every pixel has alpha 0 or 255.
4. Every opaque pixel is an exact `palette.gpl` color. Shade with darker colors of
   the same ramp (swappable areas use only their ramp's placeholder shades),
   never with opacity, blend modes or `adjust_hsl`. Two-color dithering between
   palette colors is fine.
5. Reference layers, such as a body copied into a hair file, stay hidden; only
   visible layers are exported.
6. **Occlusion is drawn, not computed.** There is one body shape, so every
   clothing and hair frame is drawn against the matching body frame, and it
   leaves transparent the pixels a nearer body part covers. Example: in
   `side-run`, the near arm crosses in front of the torso, so the tee frame has
   a hole there and draws only the near sleeve. That is how a fixed draw order
   (body → shoes → bottom → top → hair) shows near limbs in front of clothing and
   far limbs behind it, without per-limb layers.

### Export — `pnpm art:export`

- Root script `"art:export": "npx tsx scripts/export-art.ts"`.
- **Aseprite path:** `ASEPRITE_PATH` if set (the MCP registration's env doesn't
  reach this script); otherwise
  `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe` if that
  file exists; otherwise exit non-zero with a message naming both.
- For each `art/**/*.aseprite`, delete any existing `<name>.png` and
  `<name>.json` in `apps/web/src/assets/sprites/`, then call `execFile` (an args
  array, because the path has spaces) with exactly
  `--batch <src> --sheet <out>.png --data <out>.json --format json-array --list-tags --list-slices`.
  That gives the default horizontal strip with untrimmed frame rects. Add no
  other sheet flags (no trim, packing, split layers or ignore-empty).
- Aseprite exits 0 even when a source fails to load, leaving a 0-byte JSON. After
  each call, check that the PNG exists and the JSON parses with at least one
  frame; otherwise exit non-zero and print Aseprite's output.
- `meta.image` is written relative to the JSON, so committed exports are
  machine-independent.
- **Exports are committed**, so CI and Pages never need Aseprite.

### Drawing workflow

- Art is authored through the MCP.
- **Absolute paths only.** Every MCP tool call uses absolute forward-slash paths
  rooted at the checkout in use (`git rev-parse --show-toplevel`), e.g.
  `D:/Projects/Tracks/art/avatar/body.aseprite`, for sources and outputs alike.
  Relative paths resolve inside the MCP clone (`uv --directory` sets the server's
  cwd), where Aseprite silently creates folders; `..` is rejected.
- Previews (`export_frame`, `export_tag`) go to
  `<checkout>/.superpowers/art-previews/` (gitignored), never into `art/` or
  `apps/web/src/assets/`.
- MCP `set_tag` frame numbers are 1-based; exported JSON `from`/`to` are 0-based.
- Checkpoints go to the user with SendUserFile: palette and body, hair, clothing,
  animations, room. Stills are `export_frame` at 8×; animations (`front-idle`,
  `turn`, `side-run`, `belt`) are `export_tag` GIFs at 8×.
- **GUI edits happen between MCP edits, not during them.** Each MCP call reads the
  file from disk and saves it back, and Aseprite doesn't reload a file changed on
  disk. So the user saves and closes a file before Claude edits it through the
  MCP, and reopens it afterwards (File > Open, or Reopen Closed File). Claude
  doesn't edit a file the user says is open, and asks when unsure.
- After any GUI edit, run `pnpm art:export` and commit the source and its exports
  together.

## 5. Testing & Done

### Automated (TDD)

- **types:**
  - Schemas accept valid appearances.
  - They reject unknown IDs and missing fields.
- **api** (service mocked, like existing tests):
  - `GET /avatar`: `getByUserId` resolving null → 404 with `success: false` and
    `error.code === 'AVATAR_NOT_FOUND'`; resolving an Avatar → 200.
  - `PUT /avatar`: `upsertForUser` is called with the test token's user id and the
    parsed body, and the route returns 200.
  - Invalid IDs → 400 with `success: false` and
    `error.code === 'FST_ERR_VALIDATION'`. Checking the body proves the moved
    error handler covers feature routes.
  - 401 without auth. The PUT case sends a valid body, because body validation
    runs before the preHandler auth hook (no auth plus a bad body gives 400).
  - CORS preflight: `OPTIONS /avatar` with `Origin: http://localhost:5173`,
    `Access-Control-Request-Method: PUT` and
    `Access-Control-Request-Headers: authorization,content-type` → 204 with an
    `access-control-allow-methods` header that includes PUT.
- **db** (pgTAP, local only; not part of `pnpm test`, so CI and deploys stay
  Supabase-free):
  - `supabase/tests/database/avatars.test.sql`, run by a new root script
    `"test:db": "supabase test db"` after `supabase db reset`. The reset proves
    the migration applies; it also wipes local data.
  - The file runs `begin; create extension if not exists pgtap with schema extensions; select plan(n); … select * from finish(); rollback;`.
  - As postgres: insert auth.users A and B and an avatars row for each, with
    `created_at = updated_at = '2000-01-01'` (`now()` is fixed inside the test
    transaction).
  - RLS is enabled on public.avatars (`pg_class.relrowsecurity`).
  - As `authenticated` with `request.jwt.claims` sub = A: select, insert and
    update on public.avatars all throw 42501, including on A's own row.
  - As `anon`: select throws 42501.
  - `has_table_privilege('service_role', 'public.user_profiles', 'select')` and
    `'update'` are both true (covers the grant fix).
  - As `service_role`: select works, and `insert … on conflict (user_id) do update`
    changes A's `hair_style`, keeps `created_at` at 2000-01-01 and moves
    `updated_at` forward.
- **web logic:**
  - `swapPixels` on hand-built `Uint8ClampedArray` buffers.
  - `drawList` layer ordering.
  - Behavior state machine and `frameAt`: transitions and durations, with
    explicit `dtMs` values, a stub `rng` (e.g. `() => 0`, `() => 0.999`) and
    literal timings. No fake timers.
  - `fitScale` for the room (180×120): (375, 551, DPR 2) → 4;
    (412, 715, DPR 2.625) → 6; (179, 500, DPR 1) → 1.
  - `DEFAULT_APPEARANCE` parses with `AvatarAppearanceSchema`, and every catalog
    option has a label.
  - **Art-matches-catalog check** (`// @vitest-environment node`):
    - Reads the committed `apps/web/src/assets/sprites/*.json` and `*.png` and
      `art/palette.gpl` with `node:fs`, and decodes PNGs with `pngjs`
      (`PNG.sync.read`, always RGBA). Add `pngjs`, `@types/pngjs` and
      `@types/node` as apps/web devDependencies, and start the file with
      `/// <reference types="node" />`, because TS 6 includes no `@types`
      automatically. Parse palette.gpl tolerating CRLF, a `Channels: RGBA` line
      and 4-column rows.
    - palette.gpl sits outside apps/web, so turbo.json gains a
      `"@tracks/web#test"` task with `"dependsOn": ["^build"]` and
      `"inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/art/palette.gpl"]`. Otherwise
      turbo's cache replays a stale pass after a palette-only change.
    - Every catalog entry's base sprite, and every `SAMPLE_ROOM` ID, resolves to
      an exported sheet.
    - Every avatar sheet's frames are 64×64, with no opaque pixel on row 0
      (catches clipping).
    - Every avatar sheet (body, hair-*, top-*, bottom-*, shoes-*) has the tags
      `front-idle`, `turn` and `side-run`, and the same frame count,
      `frames[].duration` and `meta.frameTags` (name, from, to, direction) as
      body.json. Every direction is `forward`.
    - `treadmill.json` has a `belt` tag with the same frame count and per-frame
      durations as body's `side-run`, and a `rider` slice with a pivot.
      `background.json` has every slot slice.
    - Every pixel has alpha 0 or 255, and every opaque color is in palette.gpl.
    - Every placeholder color in a sheet belongs to the one ramp that sheet's
      swap replaces, and the sheet contains at least one color of that ramp. Room
      sheets, and sheets used without a swap, contain no placeholder colors.
    - Every target ramp has 3 entries. palette.gpl contains each of the 9
      `PLACEHOLDER_RAMPS` colors exactly once, and every other palette.gpl color
      differs from every placeholder by at least 32 in at least one RGB channel.
- **web UI** (jsdom has no canvas, image decoding or ImageData):
  - CreatorPage and RoomPage tests `vi.mock` the `<AvatarSprite>` and `RoomScene`
    modules with a stub `<div role="img" aria-label=…>`, so no canvas mounts and
    jsdom prints no 'Not implemented' error (.claude/CLAUDE.md rule 26). The native `canvas`
    package is not added. Real drawing is covered by e2e and the visual checks.
  - Tests use a fresh `QueryClient` with `retry: false` and mock `api`, and seed
    the user with `useAuthStore.setState({ user })`.
  - `__tests__/App.test.tsx` wraps `<App />` in a `QueryClientProvider` (fresh
    client). The provider lives only in main.tsx, and AppShell renders
    `<Outlet />` as soon as `isLoading` is false, redirecting to `/login` only in
    an effect. So the index RoomPage mounts once, and without a provider
    `useAvatar`'s `useQuery` throws "No QueryClient set" (.claude/CLAUDE.md rule 26).
  - Room: an Avatar → the room; a rejection
    `{ success: false, error: { code: 'AVATAR_NOT_FOUND', message } }` →
    `/create`; `new TypeError('Failed to fetch')` and
    `{ success: false, error: { code: 'UNKNOWN', message: 'Not Found' } }` → the
    unreachable state, with no redirect.
  - Room as user A with an avatar, then `useAuthStore.setState({ user: userB })`
    → a new GET runs and B's not-found redirects to `/create`.
  - Creator: a new user starts from `DEFAULT_APPEARANCE`; edit mode prefills;
    Cancel returns without saving; Save navigates; a failed save keeps the
    choices and shows the error.
  - After Edit → Save, without a reload, the room renders the saved appearance
    without another GET, and reopening Edit prefills it.
- **e2e** (Playwright, local only; see Decisions):
  - Needs the README local stack: `supabase start`, `docker compose up -d`, and
    both `.env` files filled in. `e2e/avatar.spec.ts` starts with
    `test.skip(!!process.env['CI'], 'needs local Supabase + Redis')`.
  - Signs up a unique address each run (`e2e-${Date.now()}@example.test`),
    because the local DB persists.
  - Flow: sign up → creator → in every group, check a non-default option with
    `getByRole('group', { name: legend }).getByRole('radio', { name, exact: true }).check()`
    (scoped, so 'Red' hair and 'Red tee' can't both match) and record its value → save → the room
    canvas has `data-ready="true"` and the accessible name
    `describeAppearance(chosen)` → reload → the same, with no redirect to
    `#/create` → Edit avatar → each group's checked radio has the recorded value
    → change the hair color → save → reload shows the new color (covers the
    update path).
- **CI Playwright step**: ci.yml gains one step directly before
  `pnpm exec playwright test`:
  `run: grep -v '^REDIS_URL=' apps/api/.env.example > apps/api/.env && cp apps/web/.env.example apps/web/.env`
  - Without the files, the API dev server (`tsx watch --env-file=.env`) exits
    before any test runs. auth.spec.ts only checks the login page, so the
    placeholder Supabase values are enough.
  - `REDIS_URL` is dropped so rate limiting stays in memory. CI has no Redis, and
    app.ts's `new Redis(redisUrl)` has no `'error'` listener, so ioredis would
    log `Unhandled error event: ECONNREFUSED` repeatedly (.claude/CLAUDE.md rule 26).

### Visual

- Playwright captures for user approval, at each device's own scale factor (not
  DPR 1): `devices['iPhone SE (3rd gen)']` (375×667 @2), `devices['iPhone 14']`
  (@3), `devices['Pixel 7']` (@2.625), and desktop 1280×800. Screenshots of the
  creator and the room, sent with SendUserFile.
- At 375×667 the room canvas is 360 CSS px wide, and the document has no
  horizontal or vertical scroll.
- Animations are reviewed as the 8× `export_tag` GIFs from the art checkpoints.

### Done when

1. A new player can create an avatar and see it idle and run in the room, locally.
2. In CI: typecheck, lint, test, build and ci.yml's Playwright step
   (`auth.spec.ts`, booted by the CI Playwright step above) pass. Locally, after
   `supabase db reset`: `pnpm test:db` and the full Playwright suite pass
   (see Decisions).
3. Art is committed as `.aseprite` sources plus exports. On a clean tree,
   `pnpm art:export` leaves `git status --porcelain art apps/web/src/assets/sprites`
   empty.
4. The Pages build still deploys and shows the server-unreachable state until the
   API is hosted. The `UNKNOWN`-code UI test covers this before merge, and it is
   checked on the staging Pages deploy.
5. The user has approved the creator, room and animation captures.

## Decisions (user, 2026-10-04)

1. **Avatar cell:** 64×64, with a ~48 px figure (sole to crown) and anchor
   (32, 63).
2. **Transition:** keep the ¾ `turn` frame. Every current and future item is
   drawn in three views: front, ¾ and side.
3. **Idle spot:** the avatar stays on the treadmill deck in every state. Side
   frames face right, and the console is at the treadmill's right end.
4. **E2E:** local only. `avatar.spec.ts` skips in CI, and CI's Playwright step is
   repaired so `auth.spec.ts` runs there.
5. **`user_profiles` grants:** fixed on this branch with its own migration (§2
   Database), per .claude/CLAUDE.md rule 26.
