# Room World: Scrollable Full-Screen Room — Design (v2)

**Date:** 2026-10-06
**Status:** Approved in brainstorming, section by section. Awaiting written-spec review.
**Builds on:** `2026-10-04-athlete-avatar-room-design.md` (v1). Everything in v1 not
changed here still holds.

## Purpose

v1 draws the room as a 180×120 landscape strip under the app header. The room is the
app's main screen and will grow into the athlete's gym/house: a world of places that
unlock and upgrade with the user's activity, with customization baked into tappable
objects. This iteration turns the strip into that world's foundation: a full-screen,
horizontally scrollable world with the app chrome laid over the art, and the first
tappable object.

## Scope

**In:**
- A world of places wider and taller than any screen, drawn at a whole-number pixel
  scale that always covers the screen (crop, never letterbox).
- Horizontal scrolling between places (swipe, trackpad, wheel, keyboard, place dots).
  Wider screens see more of the world without scrolling.
- On the room screen only: the header (email, Sign out), the sidebar and Edit avatar
  become overlay controls on the art. Other screens keep the normal shell.
- The existing items (trophies, medals, bib frame, treadmill) re-placed in the new
  places, with the treadmill idle/turn/run loop unchanged.
- One hotspot: tapping the mirror opens the character editor.

**Out (later iterations, in this order):**
1. Medal shelf picker (a hotspot that opens a picker).
2. Per-user room state (DB + API).
3. Activity-driven house upgrades and place unlocks.
4. Athlete wandering, and the weights area with a lift animation.

**Also out:** a mirror that reflects the avatar; pixel-art (Aseprite-drawn) UI
controls; `prefers-reduced-motion` and the other tracked post-v1 chores.

## Decisions from brainstorming

| Axis | Choice | Rejected |
|------|--------|----------|
| Camera | **Cover scale + native scroller** (below) | Fixed density (needs 480+ px tall art); custom drag gestures (re-builds native momentum, a11y, trackpad) |
| World art | **Modular places**, one sprite per place | One big background sprite (upgrades and unlocks would redraw it) |
| Overlay style | **Floating glass controls** (shadcn) | Pixel-art UI (more art, a font, hard email text); can be layered on later |

A single canvas the size of the world is not an option: iOS caps a canvas at about
16.7M pixels, and 630×270 art px at k = 10 is about 17M.

## 1. Shell and overlay chrome

### Routing

AppShell's auth guard moves into its own element, so the room renders without the
shell:

```
'/'  → <RequireAuth>              session check + "Loading..." screen (moved out of AppShell)
   index       → <RoomPage>       full-bleed; draws its own overlay chrome
   (layout)    → <AppShell>       Sidebar + Header, unchanged for every other screen
      'create' → <CreatorPage>
```

- `RequireAuth` keeps AppShell's current behavior: while auth loads it shows the
  `h-[100dvh]` "Loading..." screen with safe-area padding; with no session it navigates
  to `/login`; otherwise it renders `<Outlet />`.
- `AppShell` keeps its Sidebar, Header, `h-[100dvh]` and safe-area padding, and loses
  only the guard.

### Room screen

- RoomPage's root is `relative h-[100dvh] w-full overflow-hidden`. The art runs under
  the notch and home indicator; only the overlay controls are padded with
  `env(safe-area-inset-*)`. This is the one exception to v1's "pages never add
  h-[100dvh] or safe-area padding" rule.

### Overlay controls

Glass style: `bg-background/70 backdrop-blur-sm`, rounded, a soft shadow, every
control `min-h-11` (44 px).

- **Top-left — Menu button** (`aria-label="Menu"`, lucide `Menu` icon). Opens a
  left-side `Sheet` with the Tracks title, the nav links, the user's email and Sign out.
- **Top-right — Edit avatar.** Still a `<Link to="/create">` named "Edit avatar" (the
  e2e selector depends on it).
- **Bottom-center — place dots.** `<nav aria-label="Places">` with one `<button>` per
  place, named by the place's `label`, `aria-current="true"` on the place whose center
  is nearest the viewport center. A small visible dot sits inside a 44×44 target.
  Tapping scrolls smoothly to that place's centered position.
- The chrome is mounted in every RoomPage state (loading, loaded, error, room load
  failure), so Sign out is always reachable (keeps the v1 fix in 7dd7e82).

### Shared pieces (no drift between Sidebar and Sheet)

- `navItems` moves from `Sidebar.tsx` to `components/layout/navItems.ts`; Sidebar and
  the menu Sheet both render it.
- The email + Sign out block becomes `components/layout/AccountControls.tsx` (email
  truncates, Sign out keeps its 44 px target); Header and the Sheet both render it.

## 2. The world and the art model

### Places

Each place is its own `art/room/place-<id>.aseprite`: RGB, alpha 0/255, `art/palette.gpl`
colors only, one frame, exactly **270 px tall** (`WORLD_H`). Left to right:

| Place id | Width | Contents | Slices |
|----------|-------|----------|--------|
| `door-left` | 120 | Wall with a closed door (a future place unlocks here) | none |
| `trophy-wall` | 130 | Trophy shelf, medal rack, bib frame | `trophy-1..3`, `medal-1..3`, `frame` |
| `treadmill-corner` | 130 | Window, treadmill (home: the camera opens here) | `equipment` |
| `mirror-corner` | 130 | Full-length mirror, empty decor spot | `hotspot-mirror`, `decor` |
| `door-right` | 120 | Wall with a closed door | none |

The world is 630×270. Its size is read from the art (sum of place widths, shared
height), never from code constants. The narrowest phone view is about 117 art px
(iPhone 14), so each place keeps its key content and hotspots within its central
110 px. The widths are a starting point; the art
checkpoints may adjust them, and nothing in code depends on the exact values.

- **Seams:** new `prelude.lua` helpers draw the shared wall, baseboard and floor rows
  (same y positions, same colors, a pattern whose period divides every place width),
  so adjacent places join without a visible seam.
- **Slots** keep their v1 names and slice semantics (sprite-local bounds; pivot relative
  to the slice top-left). Item art (trophies, medals, bib frame, treadmill) is reused
  unchanged.
- **Hotspots** are slices named `hotspot-<id>`. The mirror is part of the
  `mirror-corner` art, not a separate item sprite.
- `background.aseprite`, its export and `room/background.lua` are deleted.
  `ROOM_SLOT_SLICES` in `sheetRules.ts` is replaced by per-place slice rules.

### Tools (`art/tools/room/`)

- One script per place, `place-<id>.lua` (each **saves** to `art/room/`, or to
  `ROOM_OUT` when set, like the v1 room scripts).
- `world-preview.lua` lays out every place side by side with the items and the
  avatar's first `front-idle` frame on the treadmill, and writes a PNG to
  `.superpowers/art-previews/` for checkpoints. `preview.lua` (v1) is replaced by it.
- `art/README.md` is updated: pipeline, tool table, "How to add a room item or slot",
  a new "How to add a place", and the extension points below.

### Art checkpoints (user approval, previews via the Aseprite MCP)

1. **Block-out:** every place at its real size in flat shapes, items placed, avatar on
   the treadmill, rendered as a world strip plus phone-sized crops (iPhone 14 at
   home, desktop 1280×800).
2. **Final:** the finished places, including the mirror and both doors.

### Code model — `world.ts` (replaces `sampleRoom.ts`)

```ts
export const PlaceIdSchema = z.enum([
  'door-left', 'trophy-wall', 'treadmill-corner', 'mirror-corner', 'door-right',
]);
export const HotspotIdSchema = z.enum(['mirror']);

export interface PlaceDef {
  id: PlaceId;
  sheet: SheetId;          // 'place-<id>'
  label: string;           // shown on the place dot, e.g. 'Trophy wall'
  items: { slot: string; sheet: SheetId }[];
}

export const WORLD: PlaceDef[];            // ordered left → right
export const HOME_PLACE: PlaceId = 'treadmill-corner';
export const AVATAR_SPOT = { place: 'treadmill-corner', slot: 'equipment' } as const;
```

`WORLD` holds the v1 sample items in their new places. `decor` stays empty.
(`PlaceDef` is code-only data, not shared with the API, so an interface over
`z.infer` is acceptable here; ids that may cross the wire later are `z.enum`s now.)

### Layout — `layoutWorld` (replaces `layoutRoom`)

`layoutWorld(world, registry = SHEETS): WorldLayout` is pure:

```ts
interface WorldLayout {
  width: number;                       // sum of place widths
  height: number;                      // the shared place height
  places: { id: PlaceId; label: string; x: number; w: number }[];
  sprites: PlacedSprite[];             // world coordinates, draw order
  hotspots: { id: HotspotId; x: number; y: number; w: number; h: number }[];
  avatarFeet: { x: number; y: number };
}
```

- Places are laid out left to right from x = 0.
- **Draw order:** each place background left to right, then every place's items in
  slot order (frame, trophies, medals, decor, equipment), then the avatar (drawn by
  RoomScene, as in v1). Nothing is drawn in front of the avatar.
- **Alignment** is decided by slot kind, as in v1: `trophy-*`, `equipment`, `decor`
  stand (bottom-center on the slice's bottom edge); `medal-*`, `frame` hang
  (top-center on the slice's top edge). An odd leftover rounds left.
- **Avatar feet:** the `AVATAR_SPOT` slot's item must be the equipment: it needs a
  `belt` tag and a `rider` slice with a pivot; feet = item position + rider bounds +
  pivot. The equipment is `animated: true`, so `spriteFrame` is unchanged.
- **Throws** (with the sheet and slice named) on: places of different heights, a
  missing slot slice, an item slot not in its place, a `hotspot-*` slice whose id is
  not in `HotspotIdSchema`, a missing `belt` tag or `rider` pivot, an `AVATAR_SPOT`
  that names an unknown place or an empty slot.

`behavior.ts` and `spriteFrame` are unchanged: the treadmill loop only gets a new
anchor.

## 3. Camera, rendering and hotspots

### Scale — `coverScale`

Added to `apps/web/src/features/avatar/fitScale.ts`, pure:

```ts
coverScale(deviceW, deviceH, worldW, worldH) =
  max(1, ceil(deviceH / worldH), ceil(deviceW / worldW))
```

The smallest whole scale at which the world covers the screen in both directions.
With the 630×270 world:

| Viewport (CSS, DPR) | k | Visible art px | Avatar (48 art px) |
|---------------------|---|----------------|--------------------|
| iPhone SE 375×667 @2 | 5 | 150×267 | 120 CSS px |
| iPhone 14 390×844 @3 | 10 | 117×253 | 160 CSS px |
| Pixel 7 412×915 @2.625 | 9 | 120×267 | 165 CSS px |
| Phone landscape 844×390 @3 | 5 | 506×234 | 80 CSS px |
| Desktop 1280×800 @1 | 3 | 427×267 | 144 CSS px |
| Desktop 1920×1080 @1 | 4 | 480×270 | 192 CSS px |

`fitScale` and `usePixelCanvas` stay as they are for the creator's `AvatarSprite`; the
room no longer uses them.

### DOM

```
scroller   absolute inset-0, overflow-x-auto, overflow-y-hidden, overscroll-x-contain,
           scrollbar hidden, tabIndex=0, aria-label="Room"
  track    relative, width = worldW·k/dpr CSS px, height 100%
    canvas         sticky left-0 top-0, viewport-sized
    snap markers   one per place, absolutely positioned at the place's center
    hotspot layer  one <button> per hotspot, world-positioned
```

### `useWorldCanvas(worldW, worldH)` (new, in `avatar-room/`)

Returns `{ scrollerRef, canvasRef, view, generation, cameraRef }`, where
`view = { k, dpr, backingW, backingH, camY }`.

- **Resize** (ResizeObserver on the scroller's content box, plus the DPR media query
  re-armed on change, as in `usePixelCanvas`): `backingW = round(cssW·dpr)`,
  `backingH = round(cssH·dpr)`, canvas CSS size = backing ÷ dpr,
  `k = coverScale(backingW, backingH, worldW, worldH)`,
  `camY = worldH·k − backingH` (≥ 0 by construction; the floor is bottom-anchored and
  any crop comes off the top). `imageSmoothingEnabled = false`. A callback that
  changes none of k, dpr, backingW, backingH leaves the canvas alone. Otherwise it
  bumps `generation` inside `flushSync`, as in v1, so the redraw happens before the
  browser paints the cleared canvas.
- **Camera:** pure `cameraX(scrollLeftCss, dpr, k, worldW, backingW) =
  clamp(round(scrollLeftCss·dpr), 0, worldW·k − backingW)`, in device pixels. The
  scroll listener (passive) writes it to `cameraRef`. Drawing uses
  `setTransform(k, 0, 0, k, −camX, −camY)`. Because camX and camY are whole device
  pixels, every art pixel stays exactly k device pixels while scrolling is smooth.
- **Start position:** after the first size, `scrollLeft` centers `HOME_PLACE`
  (clamped to the scroll range).
- **Re-anchor:** when k or the viewport changes, the world x at the viewport's center
  stays at the center.
- **Snapping:** pure `shouldSnap(visibleArtW, places)` is true when the visible art
  width is less than twice the narrowest place. Then the scroller gets
  `snap-x snap-mandatory` and markers `snap-center` (one swipe = one place, on phones
  and portrait tablets); otherwise free scrolling.
- **Wheel:** a non-passive `wheel` listener turns a mostly-vertical wheel delta into
  horizontal scroll (`scrollLeft += deltaY`, `preventDefault`) for mouse users.
  Trackpad horizontal gestures pass through.
- **Keyboard:** the focused scroller scrolls with arrow keys natively.

### RoomScene changes

- `ROOM_W`/`ROOM_H` go; the size comes from `layoutWorld`.
- `drawRoom` clears the viewport (identity transform), sets the camera transform,
  skips sprites whose rect misses the camera rect (culling), then draws the avatar.
- The paint key becomes `generation|camX|tag|frameOffset`; the existing rAF loop
  picks up camera changes, so scrolling needs no extra loop.
- The canvas keeps `role="img"`, the `describeAppearance` label and `data-ready`.
- The v1 deferred finding is fixed while here: after a draw failure, the redraw hook
  no longer retries or re-reports on later resizes.

### Hotspots

- Each `layoutWorld` hotspot renders a transparent `<button>` in the track at
  `left = x·k/dpr`, `top = (y·k − camY)/dpr`, size `w·k/dpr × h·k/dpr` CSS px, grown
  evenly about its center to at least 44×44. It scrolls with the art for free.
- Visuals: no fill at rest, a `focus-visible` ring, a light tint while pressed.
- `HOTSPOT_ACTIONS: Record<HotspotId, { label: string; to: string }>`; the mirror is
  `{ label: 'Mirror: edit avatar', to: '/create' }`. The button's accessible name is
  the label; activating it navigates. The medal shelf picker (next iteration) widens
  the action type to also open a picker.
- Hotspots render only once the room has drawn (`data-ready`), so they never float
  over a blank or failed canvas.

## 4. Errors, testing and verification

### Errors and states

- **Avatar loading:** a full-screen `Skeleton` (`role="status"`, "Loading your room")
  under the chrome.
- **No avatar:** redirect to `#/create`, unchanged.
- **Can't reach the server:** the v1 alert + Retry, centered, chrome on top.
- **Room art load or draw failure** (including a `layoutWorld` throw, which happens
  inside `loadRoomArt`): Sentry + "Couldn't load the room." + Retry, as in v1.

### Unit tests (Vitest, pure)

- `coverScale`: the device table above, k never below 1, cover holds in both axes.
- `cameraX`: clamping at both ends, whole device pixels.
- Start position and re-anchor math.
- `shouldSnap`: phone vs desktop widths.
- `layoutWorld` with a fixture registry: place x offsets, draw order, standing and
  hanging alignment, `avatarFeet`, hotspot rects in world coordinates, and every throw.

### Art tests (against the committed exports)

- Every place sheet: 270 px tall, one frame, palette-only, alpha 0/255.
- Seams: each place's leftmost and rightmost columns match a shared reference column
  (wall, baseboard and floor rows).
- Every slot named in `WORLD` exists in its place; every `hotspot-*` id is in
  `HotspotIdSchema`; every sheet in `WORLD` is exported.
- The v1 belt and sole tests stay.

### Component tests

- `useWorldCanvas` with a mocked ResizeObserver and matchMedia (the `usePixelCanvas`
  test style): backing size, k, camY, generation bumps, unchanged callbacks are no-ops.
- RoomPage: the Menu sheet shows the email and Sign out, and Sign out signs out; the
  Edit avatar link; the mirror button goes to `/create`; place dots set `aria-current`
  and scroll; the chrome is present in the loading, error and failure states.
- `RequireAuth`: the loading screen and the `/login` redirect (moved from the AppShell
  tests). AppShell on `/create` keeps the Header, Sidebar nav and the 375 px email
  truncation.

### E2E

- `e2e/avatar.spec.ts` passes unchanged (it waits on `canvas[data-ready="true"]` and
  clicks the "Edit avatar" link).
- New step: tap the mirror, land in the creator, go back.

### Browser verification (CLAUDE.md rules 22–26)

- Viewports: iPhone SE, iPhone 14, Pixel 7, a landscape phone, desktop 1280×800 and
  1920×1080.
- Swipe and snap, place dots, wheel, keyboard; crisp pixels while scrolling and after
  resizing; the page body never scrolls sideways (the room scroller is the one
  intentional horizontal scroller); chrome clear of safe areas.
- Loading, error and retry states; two tabs as different users; a clean console.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all clean.

## Files

| Area | Files |
|------|-------|
| Routing / shell | `router.tsx`, new `components/layout/RequireAuth.tsx`, `AppShell.tsx`, `Header.tsx`, `Sidebar.tsx`, new `navItems.ts`, new `AccountControls.tsx` |
| Room | `RoomPage.tsx`, `RoomScene.tsx`, new `useWorldCanvas.ts`, new `RoomChrome.tsx`, new `world.ts` (replaces `sampleRoom.ts`), `roomLayout.ts` (`layoutWorld`), new `camera.ts` (`cameraX`, start/re-anchor, `shouldSnap`) |
| Shared avatar | `avatar/fitScale.ts` (`coverScale`), `avatar/__tests__/sheetRules.ts` |
| Art | `art/room/place-*.aseprite`, `art/tools/room/place-*.lua`, `world-preview.lua`, `prelude.lua`; delete `background.*` and `preview.lua`; `art/README.md` |
| Exports | `apps/web/src/assets/sprites/place-*.png/json`; delete `background.png/json` |
| Tests | the tests listed above; `AppShell.test.tsx` split; `e2e/avatar.spec.ts` mirror step |
