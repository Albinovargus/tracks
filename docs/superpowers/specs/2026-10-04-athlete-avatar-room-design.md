# Athlete Avatar & Room — Design (v1)

**Date:** 2026-10-04
**Status:** Approved in brainstorming; awaiting written-spec review

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
- Trophy shelf and medal rack with sample items.
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

The room has **slots**, not free placement:

| Slot | Contents |
|------|----------|
| Trophy shelf | Trophies |
| Medal rack | Medals |
| Wall frame | Framed bib or poster |
| Equipment | Treadmill in v1 |
| Decor | Plant in v1 |

### Scale

- **Room:** native 180×120 px (3:2), rendered at integer scale.
  - Phone: 2× (360 px wide, fits the 375 px minimum).
  - Desktop: 4× or more.
- **Avatar:** about 48 px tall. Every avatar frame uses a shared **48×48 cell**,
  anchored bottom-center at the feet.

### Views and animation tags

Every avatar layer file contains the same tags, with the same frame counts and
durations:

| Tag | View | Frames | Use |
|-----|------|--------|-----|
| `front-idle` | front | ~4 (breathing, occasional blink) | Creator preview, room idle |
| `turn` | ¾ | 1 | Transition between idle and run |
| `side-run` | side | ~8 | Treadmill run cycle |

The treadmill file has a `belt` tag (2–4 frames). Other room pieces are static.

### Layers and palette swap

Each layer is drawn once. Skin and hair colors are produced at runtime by swapping
reserved **placeholder colors** in the shared palette.

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

- Limited palette of about 32 colors, in `art/palette.gpl`.
- Dark outlines on characters.
- Warm interior lighting, matching the approved mockup.

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
```

- **RLS** enabled. Users can select, insert and update only their own row
  (`auth.uid() = user_id`).
- **`updated_at`** is maintained by the existing `public.set_updated_at()` trigger
  function.
- **Validation:** allowed values are enforced by the API's Zod schemas, not database
  enums, so adding an option changes only the catalog.

### API — three-file rule

`plugins/avatar.ts`, `services/avatar.service.ts`, and the schemas above. Both
routes use `preHandler: [fastify.authenticate]`.

| Route | Behavior |
|-------|----------|
| `GET /avatar` | 200 `ApiSuccess<Avatar>`, or 404 `AVATAR_NOT_FOUND` |
| `PUT /avatar` | Body `AvatarAppearance` → upsert → 200 `ApiSuccess<Avatar>`; invalid body → 400 |

### Future, not built

An `owned_items` table. `PUT /avatar` will then also verify ownership of equipped
items. Nothing above changes shape.

## 3. Web App

### Routing (hash router)

- After login, `GET /avatar`:
  - 404 → `#/create`.
  - Otherwise `#/` shows the **room**, which replaces `DashboardPage` as the index
    route.
- The room has an **Edit avatar** action. It opens `#/create` prefilled with the
  current appearance.

### Feature folders (`src/features/<name>/`)

- **`avatar/`** — shared rendering:
  - Catalog-to-sprite mapping.
  - Sprite-sheet loading.
  - Palette swap.
  - Layer compositing.
  - An `<AvatarSprite>` canvas component that takes an appearance, an animation
    tag and a frame.
- **`avatar-creator/`** — `CreatorPage`:
  - Large live `front-idle` preview at the top; pickers scroll below.
  - Skin swatches; hair style and color pickers; one picker per clothing slot.
  - Touch targets `min-h-11`.
  - **Randomize** sets a random valid appearance.
  - **Save** calls `PUT /avatar`, then navigates to `#/`.
- **`avatar-room/`** — `RoomPage`:
  - A canvas scene at the largest integer scale that fits the viewport.
  - Safe-area aware, using `h-[100dvh]`.
  - Composes the room sprites and the avatar.

### Rendering

- Plain **Canvas 2D** with `imageSmoothingEnabled = false`. No game engine.
- **Per frame:** draw body, shoes, bottom, top, then hair from their sheets.
- **Palette swap:** happens once per (sheet, swap) when the sheet loads. Results are
  cached as offscreen canvases.

### Behavior loop

A pure, unit-tested state machine driven by elapsed time, with randomized
durations:

```
idle (4–8 s, front-idle)
  → turn (1 frame)
  → run (8–15 s, side-run + treadmill belt)
  → turn
  → idle
```

### Data

- TanStack Query hooks: `useAvatar` and `useSaveAvatar`, via `api.get` and
  `api.put`.
- No raw `fetch`, no new Zustand store.
- **API unreachable** (e.g. the Pages build while the API is unhosted): the room and
  creator show a "Can't reach the server" state instead of redirect-looping.

## 4. Art Pipeline

### MCP setup, one-time

- Install `uv`.
- Clone `diivi/aseprite-mcp` to `~/tools/aseprite-mcp`, outside the repo.
- Register it as a **project-scoped** Claude Code MCP server with
  `ASEPRITE_PATH=C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`.
- Start a new session to load it.

### Sources — `art/`, committed

- `art/palette.gpl` — the shared palette. It includes the reserved placeholder
  colors for skin and hair ramps.
- `art/avatar/`:
  - `body.aseprite`
  - `hair-<style>.aseprite`
  - one file per base clothing sprite: `top-starter-tee.aseprite`,
    `bottom-starter-shorts.aseprite`, `shoes-starter.aseprite`
- `art/room/`:
  - `background.aseprite`
  - `treadmill.aseprite` (`belt` tag)
  - `trophy-*.aseprite`, `medal-*.aseprite`
  - `plant.aseprite`

### Export — `pnpm art:export`

- A Node script, `scripts/export-art.ts`. It runs Aseprite in batch mode on each
  source and writes a PNG sheet plus JSON (`json-array` with tags) per file to
  `apps/web/src/assets/sprites/`.
- **Exports are committed**, so CI and Pages never need Aseprite.
- The script reads `ASEPRITE_PATH` and fails clearly if it is missing.

### Drawing workflow

- Art is authored through the MCP, checked with `export_frame` previews.
- Screenshots go to the user at checkpoints: palette and body, hair, clothing,
  animations, room.
- The user may edit the sources in Aseprite at any time and re-export.

## 5. Testing & Done

### Automated (TDD)

- **types:**
  - Schemas accept valid appearances.
  - They reject unknown IDs and missing fields.
- **api** (service mocked, like existing tests):
  - `GET /avatar` returns 404 before creation and 200 after.
  - `PUT` upserts.
  - 400 on invalid IDs, 401 without auth.
- **db:**
  - The migration applies to local Supabase.
  - RLS check: a user cannot read another user's avatar.
- **web logic:**
  - Palette swap.
  - Behavior state machine timings, using fake timers.
  - Layer ordering.
  - **Art-matches-catalog check:**
    - Every catalog ID maps to an exported base sheet, with the required tags and
      a 48×48 frame size.
    - Every swap it references uses only placeholder colors present in that sheet.
- **web UI:**
  - Creator prefills, saves and navigates.
  - Room handles the 404 redirect and the server-unreachable state.
- **e2e** (Playwright, local): sign up → creator → choose → save → room canvas
  renders → reload keeps the appearance.

### Visual

Screenshots of the creator and the room at phone and desktop sizes are sent to the
user, who approves the look.

### Done when

1. A new player can create an avatar and see it idle and run in the room, locally.
2. typecheck, lint, test, build and e2e all pass.
3. Art is committed as `.aseprite` sources plus exports; `pnpm art:export`
   regenerates them.
4. The Pages build still deploys and shows the server-unreachable state until the
   API is hosted.
