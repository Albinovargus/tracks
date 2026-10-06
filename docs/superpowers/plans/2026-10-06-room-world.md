# Room World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 180×120 room strip into a full-screen, horizontally scrollable world of places, with the app chrome floating over the art and a mirror that opens the character editor.

**Architecture:** The world is a row of per-place Aseprite sprites (all 270 px tall) laid out by a pure `layoutWorld`. A viewport-sized canvas sits `sticky` inside a native horizontal scroller whose track is as wide as the world; `scrollLeft` drives a whole-device-pixel camera, and the scale is the smallest whole number at which the world covers the screen (`coverScale`). The room route leaves AppShell and draws its own glass overlay controls; hotspots are real links positioned from `hotspot-*` slices.

**Tech Stack:** React 19, React Router 7 (hash, data mode), Tailwind v4, shadcn/ui (Button, Sheet), Vitest + Testing Library (jsdom), Playwright, Aseprite Lua via the `aseprite` MCP server.

**Spec:** `docs/superpowers/specs/2026-10-06-room-world-design.md` (builds on `docs/superpowers/specs/2026-10-04-athlete-avatar-room-design.md`). Read both before starting any task.

## Global Constraints

- Branch: `feat/room-world` (already created; the spec is committed on it).
- Hash routing only (`createHashRouter`); React Router data mode. Navigation uses `<Link>` / `useNavigate`.
- `h-[100dvh]` only, never `h-screen` / `100vh`. Every tappable element is at least 44×44 CSS px (`min-h-11`, `size-11`, or the hotspot growth rule).
- Tailwind v4: no `tailwind.config.js`. No TypeScript `enum` (use `z.enum`). No `any`.
- Errors in the room go to `Sentry.captureException` (from `@sentry/react`), as in v1.
- Art: RGB sprites, alpha 0 or 255, `art/palette.gpl` colors only, looked up by name through `prelude.lua` `L.C(name)`. Previews go to `.superpowers/art-previews/` and are never committed. Exports (`apps/web/src/assets/sprites/*.png|json`) are committed; regenerate with `pnpm art:export`.
- World geometry: every place is exactly **270 px** tall; every place width is a multiple of **10**; slots and hotspots lie within each place's central **110 px**. Floor rows are shared (`prelude.lua` `L.shell`).
- Art scripts run through the Aseprite MCP: `run_lua_script(script = 'ROOT = "D:/Projects/Tracks"; dofile(ROOT .. "/art/tools/room/<script>.lua")')`. Scripts print `OK ...` or `ERROR: ...`; treat `ERROR` as a failure.
- Art checkpoints need the user's approval. A subagent cannot talk to the user: it stops at the checkpoint and reports the preview paths; the controller shows the images to the user (Read each PNG first) and resumes the task with the user's answer.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Out of scope (tracked chores, do not start): `prefers-reduced-motion`, pgTAP in CI, linting `e2e/`/`scripts/`/`art/tools/`, typed Supabase client, the missing Prettier base config, the vitest "jsdom created N times" hint.
- Commands: `pnpm --filter @tracks/web test -- <path>` runs one web test file; `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` at the root.

## Review Focus

1. **Rotating or resizing mid-scroll** (phone rotation, desktop window drag): the place under the viewport center must stay centered, never jump back to home. Pinned in Task 5 ("re-anchors on resize").
2. **Mouse wheels that report in lines** (Firefox, `deltaMode === 1`) and trackpad horizontal swipes: a line-mode wheel must still move a useful distance, and a horizontal swipe must not be hijacked. Pinned in Task 5 ("wheel" tests).
3. **Fractional DPR** (Pixel 7, 2.625): backing size and camera offsets must stay whole device pixels so the art never blurs or shimmers while scrolling. Pinned in Task 1 (`cameraX` at 2.625) and Task 5 (backing rounding).
4. **A zero-size stage** (a hidden tab, Capacitor resume, a collapsed layout): the canvas must not be resized to 0×0 or divide by zero. Pinned in Task 5 ("ignores a zero-size callback").
5. **An expired session on any screen**: both the room (now outside AppShell) and the creator must send the user to `/login`. Pinned in Task 2 (`RequireAuth` redirect test).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/web/src/features/avatar/fitScale.ts` | + `coverScale` (pure) |
| `apps/web/src/features/avatar-room/camera.ts` (new) | Pure camera math: `WorldView`, `viewFor`, `cameraX`, `scrollLeftCentering`, `centerWorldX`, `shouldSnap`, `nearestPlace`, `overlaps`, `hotspotBox` |
| `apps/web/src/features/avatar-room/world.ts` (new, replaces `sampleRoom.ts`) | `WORLD`, `HOME_PLACE`, `AVATAR_SPOT`, `HOTSPOT_ACTIONS`, id schemas |
| `apps/web/src/features/avatar-room/roomLayout.ts` | `layoutWorld` (replaces `layoutRoom`), `slotAlignment`, `spriteFrame` (unchanged) |
| `apps/web/src/features/avatar-room/useWorldCanvas.ts` (new) | Sizing, DPR watch, scroll → camera, wheel → horizontal |
| `apps/web/src/features/avatar-room/RoomScene.tsx` | Loads art, rAF loop, scroller/track/canvas DOM, hotspots, snap markers |
| `apps/web/src/features/avatar-room/PlaceDots.tsx` (new) | The place dot nav |
| `apps/web/src/features/avatar-room/RoomChrome.tsx` (new) | Menu button + Sheet, Edit avatar |
| `apps/web/src/features/avatar-room/RoomPage.tsx` | Full-screen page: state switch + chrome |
| `apps/web/src/components/layout/RequireAuth.tsx` (new) | Auth guard + loading screen |
| `apps/web/src/components/layout/NavLinks.tsx` (new) | `navItems` + the link list (Sidebar and menu Sheet) |
| `apps/web/src/components/layout/AccountControls.tsx` (new) | Email + Sign out (Header and menu Sheet) |
| `apps/web/src/components/layout/{AppShell,Header,Sidebar}.tsx` | Guard removed; use the shared pieces |
| `apps/web/src/router.tsx` | `RequireAuth` → room + (`AppShell` → create) |
| `art/tools/room/prelude.lua` | + `WORLD_H`, floor constants, `L.shell`, `L.newPlace` |
| `art/tools/room/place-*.lua` (new ×5), `world-preview.lua` (new) | Place sources and the world preview |
| `art/room/place-*.aseprite` (new ×5) | Place sources |
| Deleted | `sampleRoom.ts`, `art/room/background.aseprite`, `art/tools/room/background.lua`, `art/tools/room/preview.lua`, `assets/sprites/background.png|json` |

---

### Task 1: Pure camera math

**Files:**
- Modify: `apps/web/src/features/avatar/fitScale.ts`
- Create: `apps/web/src/features/avatar-room/camera.ts`
- Test: `apps/web/src/features/avatar/__tests__/fitScale.test.ts` (append), `apps/web/src/features/avatar-room/__tests__/camera.test.ts` (new)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `coverScale(deviceW: number, deviceH: number, worldW: number, worldH: number): number`
  - `interface WorldView { k: number; dpr: number; backingW: number; backingH: number; camY: number }`
  - `interface Rect { x: number; y: number; w: number; h: number }`
  - `interface PlaceSpan { x: number; w: number }`
  - `interface CssBox { left: number; top: number; width: number; height: number }`
  - `viewFor(backingW, backingH, dpr, worldW, worldH): WorldView`
  - `maxCameraX(view: WorldView, worldW: number): number`
  - `cameraX(scrollLeftCss: number, view: WorldView, worldW: number): number`
  - `scrollLeftCentering(worldX: number, view: WorldView, worldW: number): number`
  - `centerWorldX(camX: number, view: WorldView): number`
  - `shouldSnap(view: WorldView, places: readonly PlaceSpan[]): boolean`
  - `nearestPlace(worldX: number, places: readonly PlaceSpan[]): number`
  - `overlaps(a: Rect, b: Rect): boolean`
  - `hotspotBox(rect: Rect, view: WorldView, minCss?: number): CssBox`

- [ ] **Step 1: Write the failing `coverScale` tests** (append to `fitScale.test.ts`; keep its existing imports style)

```ts
import { coverScale } from '../fitScale.js';

describe('coverScale', () => {
  // The 630x270 world from the spec, on backing sizes in device px.
  it.each([
    ['iPhone SE 375x667 @2', 750, 1334, 5],
    ['iPhone 14 390x844 @3', 1170, 2532, 10],
    ['Pixel 7 412x915 @2.625', 1082, 2402, 9],
    ['phone landscape 844x390 @3', 2532, 1170, 5],
    ['desktop 1280x800 @1', 1280, 800, 3],
    ['desktop 1920x1080 @1', 1920, 1080, 4],
    ['ultrawide 3440x1440 @1', 3440, 1440, 6],
  ])('covers %s at k = %i', (_name, w, h, k) => {
    expect(coverScale(w, h, 630, 270)).toBe(k);
  });

  it('raises k until the width is covered too on a short, very wide screen', () => {
    // Height alone needs 2; 5000 / 630 needs 8.
    expect(coverScale(5000, 300, 630, 270)).toBe(8);
  });

  it('never goes below 1, even for an empty stage', () => {
    expect(coverScale(100, 100, 630, 270)).toBe(1);
    expect(coverScale(0, 0, 630, 270)).toBe(1);
  });

  it('covers the screen in both directions', () => {
    for (const [w, h] of [[750, 1334], [1170, 2532], [1082, 2402], [2532, 1170], [1280, 800]]) {
      const k = coverScale(w, h, 630, 270);
      expect(630 * k).toBeGreaterThanOrEqual(w);
      expect(270 * k).toBeGreaterThanOrEqual(h);
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @tracks/web test -- src/features/avatar/__tests__/fitScale.test.ts`
Expected: FAIL — `coverScale` is not exported.

- [ ] **Step 3: Add `coverScale` to `fitScale.ts`** (below `fitScale`)

```ts
/**
 * Device pixels per art pixel for a worldW×worldH world behind a
 * deviceW×deviceH backing store: the smallest whole number at which the world
 * covers the screen in both directions, never below 1. The excess is cropped,
 * never letterboxed (room world spec §3 Scale).
 */
export function coverScale(
  deviceW: number,
  deviceH: number,
  worldW: number,
  worldH: number,
): number {
  return Math.max(1, Math.ceil(deviceH / worldH), Math.ceil(deviceW / worldW));
}
```

- [ ] **Step 4: Run it to see it pass** (same command). Expected: PASS.

- [ ] **Step 5: Write the failing camera tests** — `apps/web/src/features/avatar-room/__tests__/camera.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  cameraX,
  centerWorldX,
  hotspotBox,
  maxCameraX,
  nearestPlace,
  overlaps,
  scrollLeftCentering,
  shouldSnap,
  viewFor,
  type WorldView,
} from "../camera.js";

const W = 630;
const H = 270;
/** The spec's places: door, trophy wall, treadmill corner (home), mirror corner, door. */
const PLACES = [
  { x: 0, w: 120 },
  { x: 120, w: 130 },
  { x: 250, w: 130 },
  { x: 380, w: 130 },
  { x: 510, w: 120 },
];
const HOME_CENTER = 315;

const IPHONE_14 = viewFor(1170, 2532, 3, W, H);
const DESKTOP = viewFor(1280, 800, 1, W, H);
const PIXEL_7 = viewFor(1082, 2402, 2.625, W, H);

describe("viewFor", () => {
  it("bottom-anchors the world: camY is the device px cropped off the top", () => {
    expect(IPHONE_14).toEqual({ k: 10, dpr: 3, backingW: 1170, backingH: 2532, camY: 168 });
    expect(DESKTOP).toEqual({ k: 3, dpr: 1, backingW: 1280, backingH: 800, camY: 10 });
  });
});

describe("cameraX", () => {
  it("is the scroll offset in whole device px", () => {
    expect(cameraX(100.2, IPHONE_14, W)).toBe(301);
    // Fractional DPR: 100 CSS px * 2.625 = 262.5 rounds to 263.
    expect(cameraX(100, PIXEL_7, W)).toBe(263);
    expect(Number.isInteger(cameraX(33.3, PIXEL_7, W))).toBe(true);
  });

  it("clamps to the world at both ends", () => {
    expect(maxCameraX(IPHONE_14, W)).toBe(5130);
    expect(cameraX(-5, IPHONE_14, W)).toBe(0);
    expect(cameraX(5000, IPHONE_14, W)).toBe(5130);
  });
});

describe("scrollLeftCentering and centerWorldX", () => {
  it("centers a world x in the viewport", () => {
    // camX = 315 * 10 - 1170 / 2 = 2565 device px = 855 CSS px
    expect(scrollLeftCentering(HOME_CENTER, IPHONE_14, W)).toBe(855);
    expect(scrollLeftCentering(HOME_CENTER, DESKTOP, W)).toBe(305);
    expect(centerWorldX(2565, IPHONE_14)).toBe(315);
  });

  it("clamps to the scroll range near the world's ends", () => {
    expect(scrollLeftCentering(0, IPHONE_14, W)).toBe(0);
    expect(scrollLeftCentering(W, IPHONE_14, W)).toBe(5130 / 3);
  });

  it("round-trips through cameraX", () => {
    const left = scrollLeftCentering(HOME_CENTER, PIXEL_7, W);
    const camX = cameraX(left, PIXEL_7, W);
    expect(Math.abs(centerWorldX(camX, PIXEL_7) - HOME_CENTER)).toBeLessThan(1 / PIXEL_7.k);
  });
});

describe("shouldSnap", () => {
  it("snaps when the screen shows less than two of the narrowest place", () => {
    expect(shouldSnap(IPHONE_14, PLACES)).toBe(true); // 117 art px visible
    expect(shouldSnap(viewFor(1640, 2360, 2, W, H), PLACES)).toBe(true); // iPad portrait, 182
    expect(shouldSnap(DESKTOP, PLACES)).toBe(false); // 427
    expect(shouldSnap(viewFor(2532, 1170, 3, W, H), PLACES)).toBe(false); // landscape phone, 506
  });

  it("never snaps an empty world", () => {
    expect(shouldSnap(IPHONE_14, [])).toBe(false);
  });
});

describe("nearestPlace", () => {
  it("picks the place whose center is nearest", () => {
    expect(nearestPlace(HOME_CENTER, PLACES)).toBe(2);
    expect(nearestPlace(0, PLACES)).toBe(0);
    expect(nearestPlace(W, PLACES)).toBe(4);
    expect(nearestPlace(185, PLACES)).toBe(1);
  });
});

describe("overlaps", () => {
  it("is true only when the rects share area", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(overlaps(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false); // touching edges
    expect(overlaps(a, { x: -5, y: 20, w: 30, h: 5 })).toBe(false);
  });
});

describe("hotspotBox", () => {
  it("maps an art rect to CSS px under the bottom-anchored camera", () => {
    const box = hotspotBox({ x: 400, y: 180, w: 24, h: 70 }, IPHONE_14);
    expect(box.left).toBeCloseTo(1333.333, 2);
    expect(box.top).toBe(544); // (1800 - 168) / 3
    expect(box.width).toBe(80);
    expect(box.height).toBeCloseTo(233.333, 2);
  });

  it("grows a small rect evenly about its center to 44x44 CSS px", () => {
    const view: WorldView = DESKTOP; // k 3, dpr 1, camY 10
    expect(hotspotBox({ x: 30, y: 200, w: 6, h: 6 }, view)).toEqual({
      left: 77,
      top: 577,
      width: 44,
      height: 44,
    });
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `pnpm --filter @tracks/web test -- src/features/avatar-room/__tests__/camera.test.ts`
Expected: FAIL — cannot resolve `../camera.js`.

- [ ] **Step 7: Write `camera.ts`**

```ts
// Pure camera math for the scrollable room world (room world spec §3). Units:
// art px are world pixels, device px are backing-store pixels, CSS px are
// layout pixels (device px / dpr).
import { coverScale } from "../avatar/fitScale.js";

/** One sized world canvas: k device px per art px, and the bottom-anchored crop. */
export interface WorldView {
  k: number;
  dpr: number;
  backingW: number;
  backingH: number;
  /** Device px cropped off the world's top: worldH·k − backingH, never negative. */
  camY: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A place's horizontal extent in art px. */
export interface PlaceSpan {
  x: number;
  w: number;
}

export interface CssBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Minimum hotspot size in CSS px (.claude/CLAUDE.md rule 12). */
const MIN_TOUCH = 44;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function viewFor(
  backingW: number,
  backingH: number,
  dpr: number,
  worldW: number,
  worldH: number,
): WorldView {
  const k = coverScale(backingW, backingH, worldW, worldH);
  return { k, dpr, backingW, backingH, camY: worldH * k - backingH };
}

/** The largest camera offset, in device px. */
export function maxCameraX(view: WorldView, worldW: number): number {
  return Math.max(0, worldW * view.k - view.backingW);
}

/** The camera's left edge in whole device px for a scroll offset in CSS px. */
export function cameraX(scrollLeftCss: number, view: WorldView, worldW: number): number {
  return clamp(Math.round(scrollLeftCss * view.dpr), 0, maxCameraX(view, worldW));
}

/** The scrollLeft (CSS px) that centers world x `worldX`, clamped to the scroll range. */
export function scrollLeftCentering(worldX: number, view: WorldView, worldW: number): number {
  const camX = clamp(
    Math.round(worldX * view.k - view.backingW / 2),
    0,
    maxCameraX(view, worldW),
  );
  return camX / view.dpr;
}

/** The world x (art px) at the viewport's center for camera camX. */
export function centerWorldX(camX: number, view: WorldView): number {
  return (camX + view.backingW / 2) / view.k;
}

/** Snap one place per swipe when the screen shows less than two of the narrowest place. */
export function shouldSnap(view: WorldView, places: readonly PlaceSpan[]): boolean {
  if (places.length === 0) return false;
  const narrowest = Math.min(...places.map((p) => p.w));
  return view.backingW / view.k < 2 * narrowest;
}

/** Index of the place whose center is nearest world x. */
export function nearestPlace(worldX: number, places: readonly PlaceSpan[]): number {
  let best = 0;
  let bestDistance = Infinity;
  places.forEach((p, i) => {
    const distance = Math.abs(p.x + p.w / 2 - worldX);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/** True when the rects share some area (touching edges do not count). */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Grows [start, start + size) evenly about its center to at least `min`. */
function grow(start: number, size: number, min: number): [number, number] {
  if (size >= min) return [start, size];
  return [start - (min - size) / 2, min];
}

/**
 * Where a hotspot's art rect sits in the scroll track, in CSS px, grown to at
 * least minCss×minCss. The track scrolls, so only the vertical crop applies.
 */
export function hotspotBox(rect: Rect, view: WorldView, minCss = MIN_TOUCH): CssBox {
  const s = view.k / view.dpr;
  const [left, width] = grow(rect.x * s, rect.w * s, minCss);
  const [top, height] = grow((rect.y * view.k - view.camY) / view.dpr, rect.h * s, minCss);
  return { left, top, width, height };
}
```

- [ ] **Step 8: Run both test files to see them pass**

Run: `pnpm --filter @tracks/web test -- src/features/avatar-room/__tests__/camera.test.ts src/features/avatar/__tests__/fitScale.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add apps/web/src/features/avatar/fitScale.ts apps/web/src/features/avatar/__tests__/fitScale.test.ts apps/web/src/features/avatar-room/camera.ts apps/web/src/features/avatar-room/__tests__/camera.test.ts
git commit -m "feat(room): cover scale and pure camera math for the room world

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Split the auth guard out of AppShell; share nav and account controls

The room keeps rendering inside AppShell in this task (Task 7 moves it out), so the app looks unchanged.

**Files:**
- Create: `apps/web/src/components/layout/RequireAuth.tsx`, `NavLinks.tsx`, `AccountControls.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`, `Header.tsx`, `Sidebar.tsx`, `apps/web/src/router.tsx`
- Test: `apps/web/src/__tests__/RequireAuth.test.tsx` (new), `apps/web/src/__tests__/AppShell.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `apps/web/src/hooks/useAuth.ts` (`{ session, user, isLoading, signOut }`), `cn` from `apps/web/src/lib/utils.ts`.
- Produces:
  - `RequireAuth(): JSX.Element` — route element rendering `<Outlet />`.
  - `navItems: readonly { path: string; label: string }[]`, `NavLinks({ onNavigate?: () => void }): JSX.Element` (a `<nav>` of 44 px links).
  - `AccountControls({ className?: string }): JSX.Element` (email + Sign out).

- [ ] **Step 1: Write the failing `RequireAuth` test** — `apps/web/src/__tests__/RequireAuth.test.tsx`

```tsx
import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

const auth = vi.hoisted(() => ({
  state: { session: null as { access_token: string } | null, isLoading: false },
}));

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({ ...auth.state, user: null, signOut: vi.fn() }),
}));

import { RequireAuth } from '../components/layout/RequireAuth.js';

function renderGuarded(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>Login page</p> },
      {
        path: '/',
        element: <RequireAuth />,
        children: [
          { index: true, element: <p>Room page</p> },
          { path: 'create', element: <p>Creator page</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('RequireAuth', () => {
  afterEach(cleanup);

  it('shows a full-height loading screen while auth resolves', () => {
    auth.state = { session: null, isLoading: true };
    renderGuarded('/');

    const loading = screen.getByText('Loading...');
    expect(loading.parentElement).toHaveClass('h-[100dvh]');
    expect(screen.queryByText('Room page')).not.toBeInTheDocument();
  });

  it.each(['/', '/create'])('sends a signed-out user on %s to /login', async (path) => {
    auth.state = { session: null, isLoading: false };
    const router = renderGuarded(path);

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('renders the page for a signed-in user', () => {
    auth.state = { session: { access_token: 'token-a' }, isLoading: false };
    renderGuarded('/create');

    expect(screen.getByText('Creator page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @tracks/web test -- src/__tests__/RequireAuth.test.tsx`
Expected: FAIL — cannot resolve `RequireAuth.js`.

- [ ] **Step 3: Create `RequireAuth.tsx`** (the guard and loading screen move here verbatim from AppShell)

```tsx
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth.js';

/** Guards every signed-in screen: a loading screen while auth resolves, /login without a session. */
export function RequireAuth() {
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

  return <Outlet />;
}
```

- [ ] **Step 4: Run it to see it pass** (same command). Expected: PASS.

- [ ] **Step 5: Create `NavLinks.tsx` and `AccountControls.tsx`**

`apps/web/src/components/layout/NavLinks.tsx`:

```tsx
import { Link, useLocation } from 'react-router';

/** The signed-in app's destinations, shared by the Sidebar and the room's menu. */
export const navItems = [{ path: '/', label: 'Room' }] as const;

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <nav className="p-2">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={onNavigate}
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
  );
}
```

`apps/web/src/components/layout/AccountControls.tsx`:

```tsx
import { useAuth } from '../../hooks/useAuth.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/button.js';

/** The signed-in email (truncating) and Sign out, shared by the Header and the room's menu. */
export function AccountControls({ className }: { className?: string }) {
  const { user, signOut } = useAuth();

  return (
    <div className={cn('flex min-w-0 items-center gap-4', className)}>
      <span className="min-w-0 truncate text-sm text-muted-foreground" title={user?.email}>
        {user?.email}
      </span>
      <Button variant="ghost" onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Use them in Header, Sidebar and AppShell; wire the router**

`Header.tsx` becomes:

```tsx
import { AccountControls } from './AccountControls.js';

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <div />
      <AccountControls />
    </header>
  );
}
```

`Sidebar.tsx` becomes:

```tsx
import { NavLinks } from './NavLinks.js';

export function Sidebar() {
  return (
    <aside className="hidden w-64 border-r border-border bg-muted/50 md:block">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-lg font-semibold">Tracks</span>
      </div>
      <NavLinks />
    </aside>
  );
}
```

`AppShell.tsx` loses the guard (no `useAuth`, `useNavigate`, `useEffect`, loading branch):

```tsx
import { Outlet } from 'react-router';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';

/** The normal app frame (sidebar, header, scrolling main). Auth is checked by RequireAuth above it. */
export function AppShell() {
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

`router.tsx` (room stays inside AppShell until Task 7):

```tsx
import { createHashRouter } from 'react-router';
import { AppShell } from './components/layout/AppShell.js';
import { RequireAuth } from './components/layout/RequireAuth.js';
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
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <RoomPage /> },
          { path: 'create', element: <CreatorPage /> },
        ],
      },
    ],
  },
]);
```

- [ ] **Step 7: Update `AppShell.test.tsx`**

AppShell no longer reads `session`/`isLoading`, so keep the `useAuth` mock (Header still uses it through AccountControls) and keep all four existing tests unchanged; they still describe AppShell. No guard test stays here (it moved to `RequireAuth.test.tsx`).

- [ ] **Step 8: Run the web tests**

Run: `pnpm --filter @tracks/web test`
Expected: PASS (including `AppShell.test.tsx`, `RequireAuth.test.tsx`, `AvatarEditFlow.test.tsx`).

- [ ] **Step 9: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add apps/web/src/components/layout apps/web/src/router.tsx apps/web/src/__tests__/RequireAuth.test.tsx apps/web/src/__tests__/AppShell.test.tsx
git commit -m "refactor(web): move the auth guard into RequireAuth and share nav and account controls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Block out the world places (art) — Checkpoint A

**Files:**
- Modify: `art/tools/room/prelude.lua`
- Create: `art/tools/room/place-door-left.lua`, `place-trophy-wall.lua`, `place-treadmill-corner.lua`, `place-mirror-corner.lua`, `place-door-right.lua`, `world-preview.lua`
- Create (by running the scripts): `art/room/place-*.aseprite` (5); exports `apps/web/src/assets/sprites/place-*.png|json` (via `pnpm art:export`)

**Interfaces:**
- Consumes: `prelude.lua` (`L.C`, `L.rect`, `L.hline`, `L.vline`, `L.grid`, `L.newSprite`, `L.slice`, `L.saveSingle`, `L.OUT`, `L.BODY`, `L.PREVIEWS`).
- Produces:
  - `L.WORLD_H = 270`, `L.BASEBOARD_Y = 234`, `L.FLOOR_Y = 239`, `L.STAND_Y = 261`, `L.SAFE_W = 110`
  - `L.shell(img, w)` — draws the shared wall, baseboard and floor rows
  - `L.newPlace(w)` → `spr, img` (an RGB sprite `w`×270 with layer `place`, plus its shell image; errors when `w % 10 ~= 0`)
  - Sheets `place-door-left` (120 wide), `place-trophy-wall` (130), `place-treadmill-corner` (130), `place-mirror-corner` (130), `place-door-right` (120), all 270 tall, one frame.
  - Slices (place-local): trophy-wall `trophy-1..3`, `medal-1..3`, `frame`; treadmill-corner `equipment`; mirror-corner `hotspot-mirror`, `decor`.

Geometry rule: a v1 room y maps to `y + 150` in a place (the v1 floor moves to the bottom of the 270 px world). Wall rows 0–233, baseboard 234–238, floor 239–269, floor items stand with their bottom row on y = 261.

- [ ] **Step 1: Add the shared shell to `prelude.lua`** (insert before `return M`)

```lua
-- The world (room world spec §2): every place sprite is WORLD_H tall and draws
-- these shared rows with M.shell, so adjacent places join without a seam. A v1
-- room y maps to y + 150 here: the floor sits at the bottom of the world.
M.WORLD_H = 270
M.BASEBOARD_Y = 234 -- trim rows 234..237, dark wood row 238
M.FLOOR_Y = 239 -- floor rows 239..269
M.STAND_Y = 261 -- floor items stand with their bottom row here
M.SAFE_W = 110 -- slots and hotspots stay within each place's central 110 px

-- Wall, baseboard and floor across a place w px wide. Plank ends sit at
-- x = 10 or 30 (mod 40) by band, so with w a multiple of 10 columns 0 and w - 1
-- are always plain floor: every place's edge columns match.
function M.shell(img, w)
  local C = M.C
  M.rect(img, 0, 0, w, M.BASEBOARD_Y, C("wall"))
  M.rect(img, 0, 0, w, 2, C("wall shadow"))
  M.hline(img, 0, w - 1, M.BASEBOARD_Y - 1, C("wall shadow"))
  M.rect(img, 0, M.BASEBOARD_Y, w, 4, C("trim"))
  M.hline(img, 0, w - 1, M.BASEBOARD_Y + 4, C("dark wood"))
  M.rect(img, 0, M.FLOOR_Y, w, M.WORLD_H - M.FLOOR_Y, C("floor"))
  for _, y in ipairs({ 239, 246, 254, 262 }) do M.hline(img, 0, w - 1, y, C("floor lines")) end
  for _, band in ipairs({ { 240, 245, 30 }, { 247, 253, 10 }, { 255, 261, 30 }, { 263, 269, 10 } }) do
    local x = band[3]
    while x < w - 1 do
      M.vline(img, x, band[1], band[2], C("floor lines"))
      x = x + 40
    end
  end
end

-- A new place: an RGB sprite w x WORLD_H with layer "place", and its shell image.
-- Draw on img, add slices to spr, then M.saveSingle(spr, img, "place-<id>").
function M.newPlace(w)
  if w % 10 ~= 0 then error("place width " .. w .. " is not a multiple of 10") end
  local spr = M.newSprite(w, M.WORLD_H, "place")
  local img = Image(w, M.WORLD_H, ColorMode.RGB)
  M.shell(img, w)
  return spr, img
end
```

- [ ] **Step 2: Write `place-treadmill-corner.lua`** (the template the other places copy)

```lua
-- Draws place-treadmill-corner.aseprite (130x270): the home place, with a window and the treadmill slot.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-treadmill-corner.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline
  local W = 130
  local spr, img = L.newPlace(W)

  -- Window (v1 window moved here, y + 150): dark wood frame x 23..58, y 162..197,
  -- four 14x14 panes, sill below.
  local wx, wy = 23, 162
  rect(img, wx, wy, 36, 36, C("dark wood"))
  hline(img, wx, wx + 35, wy, C("wood light"))
  hline(img, wx, wx + 35, wy + 35, C("wood shadow"))
  for _, pane in ipairs({ { 3, 3 }, { 19, 3 }, { 3, 19 }, { 19, 19 } }) do
    local px, py = wx + pane[1], wy + pane[2]
    rect(img, px, py, 14, 14, C("glass"))
    hline(img, px, px + 13, py, C("glass shadow"))
    vline(img, px, py, py + 13, C("glass shadow"))
    for i = 0, 5 do
      img:drawPixel(px + 4 + i, py + 10 - i, C("glass light"))
      img:drawPixel(px + 5 + i, py + 10 - i, C("glass light"))
    end
  end
  hline(img, wx - 2, wx + 37, wy + 36, C("trim"))
  hline(img, wx - 2, wx + 37, wy + 37, C("dark wood"))
  hline(img, wx - 2, wx + 37, wy + 38, C("wall shadow"))

  -- The treadmill stands bottom-centered in this slot, bottom row on L.STAND_Y.
  L.slice(spr, "equipment", 23, 212, 84, 50)
  L.saveSingle(spr, img, "place-treadmill-corner")
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

- [ ] **Step 3: Write the other four place scripts** (same header, `pcall` wrapper and `L.newPlace` / `L.saveSingle` pattern as Step 2; the block-out uses flat shapes, Task 8 adds detail)

`place-trophy-wall.lua` (W = 130): the v1 shelf, rack and frame shifted by x − 45, y + 150.
- Trophy shelf plank x 11..68: `hline` y 182 `wood light`, 183 `dark wood`, 184 `wood shadow`, 185 `wall shadow`; brackets at x 15 and 63 (`vline` 185..189 `dark wood`, next column `wood shadow`).
- Medal rack bar x 13..66: y 200 `wood light`, 201 `dark wood`, 202 `wall shadow`; pins `metal light` at (14, 200) and (65, 200).
- Slices: `trophy-1` (13, 162, 16, 20), `trophy-2` (32, 162, 16, 20), `trophy-3` (51, 162, 16, 20), `medal-1` (16, 202, 14, 20), `medal-2` (33, 202, 14, 20), `medal-3` (50, 202, 14, 20), `frame` (83, 164, 36, 28).

`place-mirror-corner.lua` (W = 130):
- A full-length standing mirror, 30×76, x 50..79, y 186..261 (bottom row on `L.STAND_Y`): a 3 px `dark wood` frame with a `wood light` top/left edge and `wood shadow` bottom/right edge, `glass` inside with a `glass shadow` left column and two diagonal `glass light` streaks like the window panes, and two 3×2 `dark wood` feet at the bottom corners.
- Slices: `hotspot-mirror` (50, 186, 30, 76) — exactly the mirror; `decor` (14, 222, 24, 40) — empty this iteration.

`place-door-left.lua` and `place-door-right.lua` (W = 120 each):
- A closed door 32×64 at x 44..75, y 175..238 (it replaces the baseboard there, down to the floor line): `dark wood` 2 px frame, `wood light` panel with two inset `wood shadow` panel outlines, a 2×2 `metal light` knob on the side facing the world's middle (door-left: knob right, at x 69; door-right: knob left, at x 49), y 207.
- No slices.

- [ ] **Step 4: Run the five place scripts through the Aseprite MCP**

For each id: `run_lua_script(script = 'ROOT = "D:/Projects/Tracks"; dofile(ROOT .. "/art/tools/room/place-<id>.lua")')`
Expected: `OK place-<id> 130x270` (or `120x270`) for each.

- [ ] **Step 5: Write `world-preview.lua`**

```lua
-- World composite preview: every place side by side with its items and the avatar,
-- laid out like roomLayout.ts layoutWorld, plus phone and desktop crops at home.
-- Read-only: writes PNGs to .superpowers/art-previews/world/ (gitignored).
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/world-preview.lua")').
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local OUT = L.PREVIEWS .. "/world"
  app.fs.makeAllDirectories(OUT)

  -- Keep in step with WORLD and HOME_PLACE in apps/web/src/features/avatar-room/world.ts.
  local WORLD = {
    { sheet = "place-door-left", items = {} },
    { sheet = "place-trophy-wall", items = {
      { "frame", "frame-bib" },
      { "trophy-1", "trophy-gold" }, { "trophy-2", "trophy-silver" }, { "trophy-3", "trophy-bronze" },
      { "medal-1", "medal-gold" }, { "medal-2", "medal-silver" }, { "medal-3", "medal-bronze" },
    } },
    { sheet = "place-treadmill-corner", items = { { "equipment", "treadmill" } }, home = true },
    { sheet = "place-mirror-corner", items = {} },
    { sheet = "place-door-right", items = {} },
  }

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
  -- Copies the opaque pixels of one sprite frame onto dst at (x, y).
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
  -- Same rule as roomLayout.ts slotAlignment.
  local function hanging(slot) return slot == "frame" or slot:match("^medal%-%d+$") ~= nil end

  -- Places left to right; every place must be the same height.
  local places, W, H = {}, 0, nil
  for _, def in ipairs(WORLD) do
    local spr = open(L.OUT .. def.sheet .. ".aseprite")
    if H == nil then H = spr.height end
    if spr.height ~= H then error(def.sheet .. " is " .. spr.height .. " tall, expected " .. H) end
    places[#places + 1] = { def = def, spr = spr, x = W }
    W = W + spr.width
  end

  -- Draw order as in layoutWorld: every place, then each place's items, then the avatar.
  local img = Image(W, H, ColorMode.RGB)
  for _, p in ipairs(places) do blit(img, p.spr, 1, p.x, 0) end
  local feetX, feetY, homeCenter
  for _, p in ipairs(places) do
    if p.def.home then homeCenter = p.x + p.spr.width // 2 end
    for _, item in ipairs(p.def.items) do
      local spr = open(L.OUT .. item[2] .. ".aseprite")
      local b = slice(p.spr, item[1]).bounds
      local ix = p.x + b.x + (b.width - spr.width) // 2
      local iy = hanging(item[1]) and b.y or (b.y + b.height - spr.height)
      local frame = 1
      if item[1] == "equipment" then
        frame = tag(spr, "belt").fromFrame.frameNumber
        local r = slice(spr, "rider")
        feetX, feetY = ix + r.bounds.x + r.pivot.x, iy + r.bounds.y + r.pivot.y
      end
      blit(img, spr, frame, ix, iy)
    end
  end
  if feetX == nil then error("no equipment item: nowhere to stand the avatar") end
  if homeCenter == nil then error("no home place") end
  local body = open(L.BODY)
  blit(img, body, tag(body, "front-idle").fromFrame.frameNumber, feetX - 32, feetY - 63)

  -- A bottom-anchored w x h crop centered on world x cx, clamped to the world.
  local function crop(w, h, cx)
    local left = math.max(0, math.min(W - w, cx - w // 2))
    local c = Image(w, h, ColorMode.RGB)
    c:drawImage(img, Point(-left, -(H - h)))
    return c
  end
  -- Saves src as <OUT>/<name>.png, upscaled nearest-neighbor by `scale`.
  local function save(src, name, scale)
    local spr = Sprite(src.width, src.height, ColorMode.RGB)
    spr:newCel(spr.layers[1], 1, src, Point(0, 0))
    if scale > 1 then app.command.SpriteSize{ ui = false, scale = scale, method = "nearest" } end
    spr:saveCopyAs(OUT .. "/" .. name .. ".png")
    spr:close()
  end
  save(img, "world", 2)
  save(crop(117, 253, homeCenter), "iphone14-home", 3) -- spec §3 table: k 10 @3
  save(crop(427, 267, homeCenter), "desktop-1280x800-home", 2) -- k 3 @1
  print(string.format("OK world %dx%d, home center x %d, avatar feet (%d, %d)", W, H, homeCenter, feetX, feetY))
end)
if not ok then print("ERROR: " .. tostring(err)) end
```

- [ ] **Step 6: Run the preview and look at it**

Run: `run_lua_script(script = 'ROOT = "D:/Projects/Tracks"; dofile(ROOT .. "/art/tools/room/world-preview.lua")')`
Expected: `OK world 630x270, home center x 315, avatar feet (...)`.
Read `.superpowers/art-previews/world/world.png`, `iphone14-home.png` and `desktop-1280x800-home.png` and check: no seams between places, the treadmill and avatar fully inside the iPhone crop, every pixel nearest-neighbor (no blur). If `SpriteSize` blurred the upscale, change `method` (Aseprite's resize methods are nearest-neighbor by default; omit `method` if `"nearest"` is rejected).

- [ ] **Step 7: CHECKPOINT A — stop and report**

Stop here and report the three preview paths and the place widths to the controller. The controller shows the images to the user and asks for approval of the block-out (layout, proportions, what fills the upper wall). Apply the user's changes to the place scripts, re-run Steps 4 and 6, and repeat until the user approves. Record the approval and any rulings in the task report.

- [ ] **Step 8: Export and run the art tests**

Run: `pnpm art:export` then `pnpm --filter @tracks/web test -- src/features/avatar/__tests__/art.test.ts src/features/avatar-room/__tests__/roomArt.test.ts`
Expected: PASS. The new `place-*` sheets pass the existing per-sheet palette and alpha checks; the v1 background checks are untouched.

- [ ] **Step 9: Commit** (sources, scripts and exports; never `.superpowers/`)

```bash
git add art/tools/room/prelude.lua art/tools/room/place-*.lua art/tools/room/world-preview.lua art/room/place-*.aseprite apps/web/src/assets/sprites/place-*
git commit -m "art(room): block out the world places and the world preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: World model and `layoutWorld`

`layoutRoom`, `sampleRoom.ts` and the background stay in place until Task 6, so the app keeps working.

**Files:**
- Create: `apps/web/src/features/avatar-room/world.ts`
- Modify: `apps/web/src/features/avatar-room/roomLayout.ts`
- Modify: `apps/web/src/features/avatar-room/__tests__/roomFixtures.ts`, `roomRules.ts`, `roomRules.test.ts`
- Test: `apps/web/src/features/avatar-room/__tests__/worldLayout.test.ts` (new), `roomArt.test.ts` (append), `apps/web/src/features/avatar/__tests__/art.test.ts` (append)

**Interfaces:**
- Consumes: `getSheet`, `SHEETS`, `SheetData`, `SheetId`, `SheetSlice`, `SheetFrame` from `../avatar/sheets.js`; `PlacedSprite` from `roomLayout.ts`; place sheets from Task 3.
- Produces (in `world.ts`):
  - `PlaceIdSchema = z.enum(['door-left','trophy-wall','treadmill-corner','mirror-corner','door-right'])`, `type PlaceId`
  - `HotspotIdSchema = z.enum(['mirror'])`, `type HotspotId`
  - `interface PlaceItem { slot: string; sheet: SheetId }`, `interface PlaceDef { id: PlaceId; sheet: SheetId; label: string; items: PlaceItem[] }`, `interface AvatarSpot { place: PlaceId; slot: string }`
  - `WORLD: readonly PlaceDef[]`, `HOME_PLACE: PlaceId`, `AVATAR_SPOT: AvatarSpot`, `HOTSPOT_ACTIONS: Record<HotspotId, { label: string; to: string }>`
- Produces (in `roomLayout.ts`):
  - `interface WorldPlace { id: PlaceId; label: string; x: number; w: number }`
  - `interface Hotspot { id: HotspotId; x: number; y: number; w: number; h: number }`
  - `interface WorldLayout { width: number; height: number; places: WorldPlace[]; sprites: PlacedSprite[]; hotspots: Hotspot[]; avatarFeet: { x: number; y: number } }`
  - `slotAlignment(slot: string): "standing" | "hanging"`
  - `layoutWorld(world?: readonly PlaceDef[], spot?: AvatarSpot, registry?: ReadonlyMap<SheetId, SheetData>): WorldLayout`
- Produces (in `roomRules.ts`): `columnPixels(image, x, y0, length): number[]`, `outsideSafeBand(rects, placeW, safeW): string[]`
- Fixture (in `roomFixtures.ts`): `roomRegistry()` now also holds the five `place-*` sheets below.

- [ ] **Step 1: Add the fixture place sheets** — in `roomFixtures.ts`, add these constants and add the five sheets to the `sheets` array in `roomRegistry` (keep everything else):

```ts
/** Fixture place slices (place-local). The fixture world is 340x80: door-left 40,
 * trophy-wall 100, treadmill-corner 100, mirror-corner 60, door-right 40. */
export const SHELF_SLOTS: SheetSlice[] = [
  slice("trophy-1", 10, 20, 16, 18),
  slice("trophy-2", 30, 20, 16, 18),
  slice("trophy-3", 50, 20, 16, 18),
  slice("medal-1", 10, 45, 12, 20),
  slice("medal-2", 24, 45, 12, 20),
  slice("medal-3", 38, 45, 12, 20),
  slice("frame", 70, 12, 24, 30),
];
export const HOME_SLOTS: SheetSlice[] = [slice("equipment", 10, 25, 80, 50)];
export const MIRROR_SLICES: SheetSlice[] = [
  slice("hotspot-mirror", 20, 10, 20, 60),
  slice("decor", 40, 30, 16, 45),
];
export const PLACE_H = 80;
```

```ts
    sheet("place-door-left", 40, PLACE_H),
    sheet("place-trophy-wall", 100, PLACE_H, { slices: SHELF_SLOTS }),
    sheet("place-treadmill-corner", 100, PLACE_H, { slices: HOME_SLOTS }),
    sheet("place-mirror-corner", 60, PLACE_H, { slices: MIRROR_SLICES }),
    sheet("place-door-right", 40, PLACE_H),
```

- [ ] **Step 2: Write the failing `layoutWorld` tests** — `apps/web/src/features/avatar-room/__tests__/worldLayout.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { layoutWorld, slotAlignment, type PlacedSprite } from "../roomLayout.js";
import { AVATAR_SPOT, WORLD, type PlaceDef } from "../world.js";
import { BELT, MIRROR_SLICES, RIDER, roomRegistry, sheet, SHELF_SLOTS, slice } from "./roomFixtures.js";

function placed(sprites: PlacedSprite[], id: string): PlacedSprite | undefined {
  return sprites.find((s) => s.sheet === id);
}

function withPlace(id: PlaceDef["id"], change: Partial<PlaceDef>): PlaceDef[] {
  return WORLD.map((p) => (p.id === id ? { ...p, ...change } : p));
}

describe("slotAlignment", () => {
  it("hangs the frame and medals and stands everything else", () => {
    expect(slotAlignment("frame")).toBe("hanging");
    expect(slotAlignment("medal-2")).toBe("hanging");
    expect(slotAlignment("trophy-1")).toBe("standing");
    expect(slotAlignment("equipment")).toBe("standing");
    expect(slotAlignment("decor")).toBe("standing");
  });

  it("rejects an unknown slot kind", () => {
    expect(() => slotAlignment("shelf")).toThrow('Unknown slot kind "shelf"');
  });
});

describe("layoutWorld", () => {
  const registry = roomRegistry();
  const layout = layoutWorld(WORLD, AVATAR_SPOT, registry);

  it("lays the places out left to right and takes the size from the art", () => {
    expect(layout.width).toBe(340);
    expect(layout.height).toBe(80);
    expect(layout.places).toEqual([
      { id: "door-left", label: "Left door", x: 0, w: 40 },
      { id: "trophy-wall", label: "Trophy wall", x: 40, w: 100 },
      { id: "treadmill-corner", label: "Treadmill", x: 140, w: 100 },
      { id: "mirror-corner", label: "Mirror", x: 240, w: 60 },
      { id: "door-right", label: "Right door", x: 300, w: 40 },
    ]);
  });

  it("draws every place, then each place's items, in order", () => {
    expect(layout.sprites.map((s) => s.sheet)).toEqual([
      "place-door-left",
      "place-trophy-wall",
      "place-treadmill-corner",
      "place-mirror-corner",
      "place-door-right",
      "frame-bib",
      "trophy-gold",
      "trophy-silver",
      "trophy-bronze",
      "medal-gold",
      "medal-silver",
      "medal-bronze",
      "treadmill",
    ]);
    expect(placed(layout.sprites, "place-treadmill-corner")).toEqual({
      sheet: "place-treadmill-corner",
      x: 140,
      y: 0,
      animated: false,
    });
  });

  it("places items in world coordinates, standing or hanging by slot kind", () => {
    // trophy-wall starts at x 40. frame (70, 12) 24x30, frame-bib 20x26: hangs.
    expect(placed(layout.sprites, "frame-bib")).toMatchObject({ x: 112, y: 12 });
    // trophy-1 (10, 20) 16x18, trophy-gold 10x14: stands.
    expect(placed(layout.sprites, "trophy-gold")).toMatchObject({ x: 53, y: 24 });
    // An odd leftover rounds left: 40 + 30 + floor(7 / 2).
    expect(placed(layout.sprites, "trophy-silver")).toMatchObject({ x: 73, y: 26 });
    expect(placed(layout.sprites, "medal-silver")).toMatchObject({ x: 66, y: 45 });
    // treadmill-corner starts at x 140. equipment (10, 25) 80x50, treadmill 72x40.
    expect(placed(layout.sprites, "treadmill")).toMatchObject({ x: 154, y: 35, animated: true });
  });

  it("animates only the equipment the avatar stands on", () => {
    expect(layout.sprites.filter((s) => s.animated).map((s) => s.sheet)).toEqual(["treadmill"]);
  });

  it("puts the avatar feet on the rider pivot", () => {
    // (154, 35) + rider bounds (20, 10) + pivot (12, 23)
    expect(layout.avatarFeet).toEqual({ x: 186, y: 68 });
  });

  it("finds hotspots from hotspot-* slices, in world coordinates", () => {
    expect(layout.hotspots).toEqual([{ id: "mirror", x: 260, y: 10, w: 20, h: 60 }]);
  });

  it("stands a decor item in the mirror corner when one is listed", () => {
    const world = withPlace("mirror-corner", { items: [{ slot: "decor", sheet: "plant" }] });
    // decor (40, 30) 16x45 at x 240, plant 14x30
    expect(placed(layoutWorld(world, AVATAR_SPOT, registry).sprites, "plant")).toMatchObject({
      x: 281,
      y: 45,
    });
  });

  it("throws on places of different heights", () => {
    const short = sheet("place-mirror-corner", 60, 70, { slices: MIRROR_SLICES });
    expect(() => layoutWorld(WORLD, AVATAR_SPOT, roomRegistry([short]))).toThrow(
      /place-mirror-corner.*70/,
    );
  });

  it("throws naming the slice when a place lacks an item's slot", () => {
    const shelf = sheet("place-trophy-wall", 100, 80, {
      slices: SHELF_SLOTS.filter((s) => s.name !== "medal-3"),
    });
    expect(() => layoutWorld(WORLD, AVATAR_SPOT, roomRegistry([shelf]))).toThrow("medal-3");
  });

  it("throws on a hotspot slice that is not a known hotspot", () => {
    const mirror = sheet("place-mirror-corner", 60, 80, {
      slices: [...MIRROR_SLICES, slice("hotspot-window", 0, 0, 5, 5)],
    });
    expect(() => layoutWorld(WORLD, AVATAR_SPOT, roomRegistry([mirror]))).toThrow("hotspot-window");
  });

  it("throws naming the sheet when an item has no exported sheet", () => {
    const world = withPlace("mirror-corner", { items: [{ slot: "decor", sheet: "cactus" }] });
    expect(() => layoutWorld(world, AVATAR_SPOT, registry)).toThrow("cactus");
  });

  it("throws when the avatar spot's place is not in the world", () => {
    const world = WORLD.filter((p) => p.id !== "treadmill-corner");
    expect(() => layoutWorld(world, AVATAR_SPOT, registry)).toThrow("treadmill-corner");
  });

  it("throws when the avatar spot's slot is empty", () => {
    const world = withPlace("treadmill-corner", { items: [] });
    expect(() => layoutWorld(world, AVATAR_SPOT, registry)).toThrow(/no item in slot "equipment"/);
  });

  it("throws on an empty world", () => {
    expect(() => layoutWorld([], AVATAR_SPOT, registry)).toThrow("no places");
  });

  it.each([
    ["no rider slice", sheet("treadmill", 72, 40, { frames: 4, tags: [BELT] }), "rider"],
    [
      "a rider without a pivot",
      sheet("treadmill", 72, 40, { frames: 4, tags: [BELT], slices: [slice("rider", 20, 10, 24, 24)] }),
      /rider.*pivot/,
    ],
    ["no belt tag", sheet("treadmill", 72, 40, { frames: 4, slices: [RIDER] }), "belt"],
  ])("throws when the equipment has %s", (_name, treadmill, message) => {
    expect(() => layoutWorld(WORLD, AVATAR_SPOT, roomRegistry([treadmill]))).toThrow(message);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm --filter @tracks/web test -- src/features/avatar-room/__tests__/worldLayout.test.ts`
Expected: FAIL — cannot resolve `../world.js`.

- [ ] **Step 4: Create `world.ts`**

```ts
import { z } from "zod";
import type { SheetId } from "../avatar/sheets.js";

/** The world's places, left to right (room world spec §2). */
export const PlaceIdSchema = z.enum([
  "door-left",
  "trophy-wall",
  "treadmill-corner",
  "mirror-corner",
  "door-right",
]);
export type PlaceId = z.infer<typeof PlaceIdSchema>;

/** Tappable objects, from `hotspot-<id>` slices in the place art. */
export const HotspotIdSchema = z.enum(["mirror"]);
export type HotspotId = z.infer<typeof HotspotIdSchema>;

/** An item drawn in one of its place's slot slices. */
export interface PlaceItem {
  slot: string;
  sheet: SheetId;
}

// Code-only data, not shared with the API: interfaces are fine here. Ids that may
// cross the wire later are z.enums already.
export interface PlaceDef {
  id: PlaceId;
  /** The place art, `place-<id>`. */
  sheet: SheetId;
  /** Shown on the place dot. */
  label: string;
  /** Drawn in this order after every place background. */
  items: PlaceItem[];
}

/** The slot whose item the avatar stands on: equipment with a `belt` tag and a `rider` pivot. */
export interface AvatarSpot {
  place: PlaceId;
  slot: string;
}

/** What the world shows. Hard-coded here; per-user room state replaces it later. */
export const WORLD: readonly PlaceDef[] = [
  { id: "door-left", sheet: "place-door-left", label: "Left door", items: [] },
  {
    id: "trophy-wall",
    sheet: "place-trophy-wall",
    label: "Trophy wall",
    items: [
      { slot: "frame", sheet: "frame-bib" },
      { slot: "trophy-1", sheet: "trophy-gold" },
      { slot: "trophy-2", sheet: "trophy-silver" },
      { slot: "trophy-3", sheet: "trophy-bronze" },
      { slot: "medal-1", sheet: "medal-gold" },
      { slot: "medal-2", sheet: "medal-silver" },
      { slot: "medal-3", sheet: "medal-bronze" },
    ],
  },
  {
    id: "treadmill-corner",
    sheet: "place-treadmill-corner",
    label: "Treadmill",
    items: [{ slot: "equipment", sheet: "treadmill" }],
  },
  // The decor slot stays empty this iteration.
  { id: "mirror-corner", sheet: "place-mirror-corner", label: "Mirror", items: [] },
  { id: "door-right", sheet: "place-door-right", label: "Right door", items: [] },
];

/** The camera opens centered on this place. */
export const HOME_PLACE: PlaceId = "treadmill-corner";

export const AVATAR_SPOT: AvatarSpot = { place: "treadmill-corner", slot: "equipment" };

/** What tapping each hotspot does. The medal shelf picker adds a picker action later. */
export const HOTSPOT_ACTIONS: Record<HotspotId, { label: string; to: string }> = {
  mirror: { label: "Mirror: edit avatar", to: "/create" },
};
```

- [ ] **Step 5: Add `layoutWorld` to `roomLayout.ts`**

Add the imports `import { AVATAR_SPOT, HotspotIdSchema, WORLD, type AvatarSpot, type HotspotId, type PlaceDef, type PlaceId } from "./world.js";` and append below `layoutRoom` (rename nothing yet; `place` stays as is):

```ts
export interface WorldPlace {
  id: PlaceId;
  label: string;
  /** Left edge in world px. */
  x: number;
  w: number;
}

export interface Hotspot {
  id: HotspotId;
  /** World px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldLayout {
  /** Sum of the place widths, in art px. */
  width: number;
  /** The shared place height, in art px. */
  height: number;
  places: WorldPlace[];
  /** Draw order: every place left to right, then each place's items in its `items` order. */
  sprites: PlacedSprite[];
  hotspots: Hotspot[];
  /** Where the avatar cell's anchor pixel (32, 63) goes, in world px. */
  avatarFeet: { x: number; y: number };
}

const HOTSPOT_PREFIX = "hotspot-";

/** Hanging items hang top-center from their slot; the other known kinds stand bottom-center. */
export function slotAlignment(slot: string): Alignment {
  if (slot === "frame" || /^medal-\d+$/.test(slot)) return "hanging";
  if (slot === "equipment" || slot === "decor" || /^trophy-\d+$/.test(slot)) return "standing";
  throw new Error(`Unknown slot kind "${slot}"`);
}

/** The foot point on equipment placed at `sprite`: its rider slice pivot, in world px. */
function equipmentFeet(sprite: PlacedSprite, registry: Registry): { x: number; y: number } {
  const equipment = getSheet(sprite.sheet, registry);
  if (!equipment.tags.some((t) => t.name === BELT_TAG)) {
    throw new Error(`Sheet "${equipment.id}" has no "${BELT_TAG}" tag`);
  }
  const rider = findSlice(equipment, RIDER_SLICE);
  if (!rider.pivot) {
    throw new Error(`Slice "${RIDER_SLICE}" in sheet "${equipment.id}" has no pivot`);
  }
  return { x: sprite.x + rider.x + rider.pivot.x, y: sprite.y + rider.y + rider.pivot.y };
}

/** Pure: lays the world's places out left to right and positions every sprite and hotspot. */
export function layoutWorld(
  world: readonly PlaceDef[] = WORLD,
  spot: AvatarSpot = AVATAR_SPOT,
  registry: Registry = SHEETS,
): WorldLayout {
  const first = world[0];
  if (first === undefined) throw new Error("The world has no places");
  if (!world.some((p) => p.id === spot.place)) {
    throw new Error(`The avatar spot names place "${spot.place}", which is not in the world`);
  }
  const height = firstFrame(getSheet(first.sheet, registry)).h;
  const places: WorldPlace[] = [];
  const backgrounds: PlacedSprite[] = [];
  const items: PlacedSprite[] = [];
  const hotspots: Hotspot[] = [];
  let avatarFeet: { x: number; y: number } | null = null;
  let x = 0;

  for (const def of world) {
    const sheet = getSheet(def.sheet, registry);
    const frame = firstFrame(sheet);
    if (frame.h !== height) {
      throw new Error(
        `Place sheet "${sheet.id}" is ${frame.h} px tall; every place must be ${height} px tall`,
      );
    }
    places.push({ id: def.id, label: def.label, x, w: frame.w });
    backgrounds.push({ sheet: def.sheet, x, y: 0, animated: false });

    for (const s of sheet.slices) {
      if (!s.name.startsWith(HOTSPOT_PREFIX)) continue;
      const id = HotspotIdSchema.safeParse(s.name.slice(HOTSPOT_PREFIX.length));
      if (!id.success) {
        throw new Error(`Sheet "${sheet.id}" has slice "${s.name}", which is not a known hotspot`);
      }
      hotspots.push({ id: id.data, x: x + s.x, y: s.y, w: s.w, h: s.h });
    }

    for (const item of def.items) {
      const isSpot = def.id === spot.place && item.slot === spot.slot;
      const local = place(item.sheet, findSlice(sheet, item.slot), slotAlignment(item.slot), registry, isSpot);
      const sprite = { ...local, x: local.x + x };
      items.push(sprite);
      if (isSpot) avatarFeet = equipmentFeet(sprite, registry);
    }
    x += frame.w;
  }

  if (avatarFeet === null) {
    throw new Error(
      `Place "${spot.place}" has no item in slot "${spot.slot}" for the avatar to stand on`,
    );
  }
  return { width: x, height, places, sprites: [...backgrounds, ...items], hotspots, avatarFeet };
}
```

- [ ] **Step 6: Run it to see it pass** (same command as Step 3). Expected: PASS. Then run `src/features/avatar-room/__tests__/roomLayout.test.ts` — still PASS (layoutRoom untouched; the extra fixture sheets do not affect it).

- [ ] **Step 7: Add the art-rule helpers with tests** — append to `roomRules.ts`:

```ts
/** `length` pixelAt values of column x, starting at y0. */
export function columnPixels(image: RgbaImage, x: number, y0: number, length: number): number[] {
  return Array.from({ length }, (_, i) => pixelAt(image, x, y0 + i));
}

/** One message per rect reaching outside the central `safeW` px of a place `placeW` px wide. */
export function outsideSafeBand(
  rects: readonly { name: string; x: number; w: number }[],
  placeW: number,
  safeW: number,
): string[] {
  const left = Math.floor((placeW - safeW) / 2);
  const right = left + safeW;
  return rects
    .filter((r) => r.x < left || r.x + r.w > right)
    .map((r) => `${r.name} spans x ${r.x}..${r.x + r.w - 1}, outside the central ${safeW} px (${left}..${right - 1})`);
}
```

and append to `roomRules.test.ts` (import the two names alongside the existing imports):

```ts
describe("columnPixels", () => {
  it("reads a column top to bottom, -1 where transparent or outside", () => {
    const image = { width: 1, height: 2, data: new Uint8Array([1, 2, 3, 255, 0, 0, 0, 0]) };
    expect(columnPixels(image, 0, 0, 3)).toEqual([0x010203, -1, -1]);
  });
});

describe("outsideSafeBand", () => {
  it("names rects outside the central band and passes the rest", () => {
    // 130 wide, 110 safe: x 10..119.
    expect(
      outsideSafeBand(
        [
          { name: "ok", x: 10, w: 110 },
          { name: "left", x: 9, w: 5 },
          { name: "right", x: 100, w: 21 },
        ],
        130,
        110,
      ),
    ).toEqual([
      "left spans x 9..13, outside the central 110 px (10..119)",
      "right spans x 100..120, outside the central 110 px (10..119)",
    ]);
  });
});
```

Run: `pnpm --filter @tracks/web test -- src/features/avatar-room/__tests__/roomRules.test.ts` — Expected: PASS.

- [ ] **Step 8: Add the world art tests against the exports** — append to `roomArt.test.ts` (add imports: `layoutWorld` from `../roomLayout.js`; `WORLD` from `../world.js`; `columnPixels`, `outsideSafeBand` from `./roomRules.js`):

```ts
/** World geometry (room world spec §2). */
const PLACE_H = 270;
const SAFE_W = 110;

describe('world art', () => {
  it('draws every place 270 px tall, one frame, a multiple of 10 wide, with no hole', () => {
    const problems: string[] = [];
    for (const place of WORLD) {
      const { sheet, image } = load(place.sheet);
      const frame = frameRect(sheet, 0);
      if (sheet.frames.length !== 1) problems.push(`${place.sheet} has ${sheet.frames.length} frames`);
      if (frame.h !== PLACE_H) problems.push(`${place.sheet} is ${frame.h} px tall`);
      if (frame.w % 10 !== 0) problems.push(`${place.sheet} is ${frame.w} px wide`);
      for (let y = 0; y < frame.h; y++) {
        for (let x = 0; x < frame.w; x++) {
          if (pixelAt(image, frame.x + x, frame.y + y) === -1) {
            problems.push(`${place.sheet} has a transparent pixel at (${x}, ${y})`);
            y = frame.h;
            break;
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('joins places without a seam: every edge column matches the first place', () => {
    const firstPlace = WORLD[0];
    if (!firstPlace) throw new Error('WORLD is empty');
    const ref = load(firstPlace.sheet);
    const refFrame = frameRect(ref.sheet, 0);
    const reference = columnPixels(ref.image, refFrame.x, refFrame.y, PLACE_H);
    const problems: string[] = [];
    for (const place of WORLD) {
      const { sheet, image } = load(place.sheet);
      const frame = frameRect(sheet, 0);
      for (const [side, x] of [['left', 0], ['right', frame.w - 1]] as const) {
        const column = columnPixels(image, frame.x + x, frame.y, PLACE_H);
        const row = column.findIndex((c, y) => c !== reference[y]);
        if (row !== -1) problems.push(`${place.sheet} ${side} edge differs at y = ${row}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps every slot and hotspot within the central 110 px of its place', () => {
    const problems = WORLD.flatMap((place) => {
      const { sheet } = load(place.sheet);
      return outsideSafeBand(sheet.slices, frameRect(sheet, 0).w, SAFE_W).map(
        (p) => `${place.sheet}: ${p}`,
      );
    });
    expect(problems).toEqual([]);
  });

  it('fits every WORLD item in its slot', () => {
    const problems: string[] = [];
    for (const place of WORLD) {
      const placeSheet = load(place.sheet).sheet;
      for (const item of place.items) {
        const slot = slice(placeSheet, item.slot);
        const art = frameRect(load(item.sheet).sheet, 0);
        if (art.w > slot.w || art.h > slot.h) {
          problems.push(`${item.sheet} is ${art.w}x${art.h}, larger than ${place.sheet} slice ${item.slot} (${slot.w}x${slot.h})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('lays out the world on whole pixels with the avatar cell inside it', () => {
    const layout = layoutWorld();
    const world: Rect = { x: 0, y: 0, w: layout.width, h: layout.height };
    const problems: string[] = [];
    for (const sprite of layout.sprites) {
      const { w, h } = frameRect(getSheet(sprite.sheet), 0);
      if (!Number.isInteger(sprite.x) || !Number.isInteger(sprite.y)) {
        problems.push(`${sprite.sheet} at (${sprite.x}, ${sprite.y}) is off the pixel grid`);
      }
      if (!inside({ x: sprite.x, y: sprite.y, w, h }, world)) {
        problems.push(`${sprite.sheet} at (${sprite.x}, ${sprite.y}) reaches outside the world`);
      }
    }
    const feet = layout.avatarFeet;
    const cell: Rect = { x: feet.x - ANCHOR.x, y: feet.y - ANCHOR.y, w: CELL, h: CELL };
    if (!inside(cell, world)) problems.push(`avatar cell ${JSON.stringify(cell)} is outside the world`);
    expect(layout.hotspots.map((h) => h.id)).toEqual(['mirror']);
    expect(problems).toEqual([]);
  });
});
```

And in `art.test.ts`, inside `describe('catalog and sample room coverage', ...)`, add (import `WORLD` from `../../avatar-room/world.js`):

```ts
  it('exports every WORLD place and item', () => {
    const worldSheets: SheetId[] = WORLD.flatMap((place) => [
      place.sheet,
      ...place.items.map((item) => item.sheet),
    ]);
    expect(unexported(worldSheets), 'world sheets with no export in src/assets/sprites').toEqual([]);
  });
```

- [ ] **Step 9: Run the room and art tests**

Run: `pnpm --filter @tracks/web test -- src/features/avatar-room src/features/avatar/__tests__/art.test.ts`
Expected: PASS. If a world-art test fails, the Task 3 art breaks a spec rule: fix the place script, re-run it, `pnpm art:export`, and re-run (the art was approved at Checkpoint A, so only fix rule violations without changing the look; report any visible change).

- [ ] **Step 10: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add apps/web/src/features/avatar-room apps/web/src/features/avatar/__tests__/art.test.ts
git commit -m "feat(room): world model and layoutWorld over per-place art

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `useWorldCanvas`

**Files:**
- Create: `apps/web/src/features/avatar-room/useWorldCanvas.ts`
- Test: `apps/web/src/features/avatar-room/__tests__/useWorldCanvas.test.tsx`

**Interfaces:**
- Consumes (Task 1): `viewFor`, `cameraX`, `centerWorldX`, `scrollLeftCentering`, `WorldView`.
- Produces:
  - `interface WorldSize { width: number; height: number; homeX: number }`
  - `useWorldCanvas(size: WorldSize | null): { scrollerRef: RefObject<HTMLDivElement | null>; canvasRef: RefObject<HTMLCanvasElement | null>; view: WorldView | null; generation: number; cameraRef: RefObject<number> }`
  - Contract: `generation` is 0 and `view` null until the first non-zero size; every applied resize sets the canvas backing store to the viewport in device px, bumps `generation` inside `flushSync`, sets `cameraRef.current` (device px) **before** that commit, then sets `scroller.scrollLeft`. Scroll events update `cameraRef.current`. A mostly vertical wheel scrolls horizontally.

- [ ] **Step 1: Write the failing tests** — `useWorldCanvas.test.tsx`. Reuse the fakes from `apps/web/src/features/avatar/__tests__/usePixelCanvas.test.tsx` (copy `FakeResizeObserver`, `fakeMatchMedia`, the `getContext` spy and the `devicePixelRatio` setup, lines 1–100 of that file) and add:

```tsx
const WORLD = { width: 630, height: 270, homeX: 315 };

// The hook's camera is a ref (no re-render on scroll), so the probe hands it out.
let probeCamera: { current: number } = { current: -1 };

function Probe({ size }: { size: WorldSize | null }) {
  const { scrollerRef, canvasRef, view, generation, cameraRef } = useWorldCanvas(size);
  probeCamera = cameraRef;
  return (
    <div ref={scrollerRef} data-testid="scroller">
      <canvas ref={canvasRef} data-testid="canvas" />
      <output data-testid="state">{JSON.stringify({ view, generation })}</output>
    </div>
  );
}

function state(): { view: WorldView | null; generation: number; camera: number } {
  const rendered = JSON.parse(screen.getByTestId("state").textContent ?? "{}");
  return { ...rendered, camera: probeCamera.current };
}

/** Plays a ResizeObserver callback for a CSS content box. */
function observe(width: number, height: number): void {
  act(() => {
    const observer = observers[observers.length - 1];
    if (!observer) throw new Error("no ResizeObserver");
    observer.callback(
      [{ contentRect: { width, height } } as ResizeObserverEntry],
      observer as unknown as ResizeObserver,
    );
  });
}

describe("useWorldCanvas", () => {
  it("does nothing until the world size is known", () => {
    render(<Probe size={null} />);
    expect(observers).toHaveLength(0);
    expect(state()).toMatchObject({ view: null, generation: 0 });
  });

  it("sizes the backing store to the viewport and covers it with the world", () => {
    setDpr(3);
    render(<Probe size={WORLD} />);
    observe(390, 844);

    const canvas = screen.getByTestId("canvas") as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([1170, 2532]);
    expect([canvas.style.width, canvas.style.height]).toEqual(["390px", "844px"]);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(state()).toEqual({
      view: { k: 10, dpr: 3, backingW: 1170, backingH: 2532, camY: 168 },
      generation: 1,
      camera: 2565,
    });
  });

  it("opens centered on the home place", () => {
    setDpr(3);
    render(<Probe size={WORLD} />);
    observe(390, 844);
    expect(screen.getByTestId("scroller").scrollLeft).toBe(855);
  });

  it("rounds a fractional-DPR backing store to whole device px", () => {
    setDpr(2.625);
    render(<Probe size={WORLD} />);
    observe(412, 915);
    const canvas = screen.getByTestId("canvas") as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([1082, 2402]);
    expect(state().view?.k).toBe(9);
    expect(Number.isInteger(state().camera)).toBe(true);
  });

  it("ignores a zero-size callback", () => {
    setDpr(2);
    render(<Probe size={WORLD} />);
    observe(0, 0);
    const canvas = screen.getByTestId("canvas") as HTMLCanvasElement;
    expect(state()).toMatchObject({ view: null, generation: 0 });
    expect(canvas.width).toBe(300); // jsdom's default, untouched
  });

  it("leaves the canvas alone when a callback changes nothing", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800);
    observe(1280, 800);
    expect(state().generation).toBe(1);
  });

  it("re-anchors on resize: the world x at the center stays centered", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800); // k 3, home centered: camera 305
    const scroller = screen.getByTestId("scroller");
    // The user scrolls to the trophy wall: center world x = (60 + 640) / 3 ≈ 233.
    act(() => {
      scroller.scrollLeft = 60;
      scroller.dispatchEvent(new Event("scroll"));
    });
    observe(800, 1280); // rotate: k becomes 5
    const view = state().view;
    if (!view) throw new Error("no view");
    expect(view.k).toBe(5);
    expect(Math.abs(centerWorldX(state().camera, view) - (60 + 640) / 3)).toBeLessThan(1);
    expect(scroller.scrollLeft).toBe(state().camera / view.dpr);
  });

  it("moves the camera with the scroll position, clamped to the world", () => {
    setDpr(3);
    render(<Probe size={WORLD} />);
    observe(390, 844);
    const scroller = screen.getByTestId("scroller");
    act(() => {
      scroller.scrollLeft = 100;
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(state().camera).toBe(300);
  });

  it("turns a vertical wheel into horizontal scroll, lines into px", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800);
    const scroller = screen.getByTestId("scroller");
    const start = scroller.scrollLeft;

    const pixels = new WheelEvent("wheel", { deltaY: 40, cancelable: true });
    scroller.dispatchEvent(pixels);
    expect(pixels.defaultPrevented).toBe(true);
    expect(scroller.scrollLeft).toBe(start + 40);

    const lines = new WheelEvent("wheel", { deltaY: 3, deltaMode: 1, cancelable: true });
    scroller.dispatchEvent(lines);
    expect(scroller.scrollLeft).toBe(start + 40 + 48);
  });

  it("leaves a horizontal (trackpad) wheel to the browser", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800);
    const scroller = screen.getByTestId("scroller");
    const start = scroller.scrollLeft;
    const swipe = new WheelEvent("wheel", { deltaX: 30, deltaY: 5, cancelable: true });
    scroller.dispatchEvent(swipe);
    expect(swipe.defaultPrevented).toBe(false);
    expect(scroller.scrollLeft).toBe(start);
  });

  it("resizes again when the DPR changes", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800);
    setDpr(2);
    act(() => {
      queries[queries.length - 1]?.listener?.({} as MediaQueryListEvent);
    });
    expect(state().view).toMatchObject({ dpr: 2, backingW: 2560, backingH: 1600 });
    expect(state().generation).toBe(2);
  });
});
```

(`setDpr(n)` sets `window.devicePixelRatio` with `Object.defineProperty(window, 'devicePixelRatio', { value: n, configurable: true })`; copy the existing helper if `usePixelCanvas.test.tsx` has one, otherwise add it. Import `centerWorldX` and `type WorldView` from `../camera.js`, `useWorldCanvas` and `type WorldSize` from `../useWorldCanvas.js`.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @tracks/web test -- src/features/avatar-room/__tests__/useWorldCanvas.test.tsx`
Expected: FAIL — cannot resolve `../useWorldCanvas.js`.

- [ ] **Step 3: Write `useWorldCanvas.ts`**

```ts
import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import {
  cameraX,
  centerWorldX,
  scrollLeftCentering,
  viewFor,
  type WorldView,
} from "./camera.js";

/** The world's size in art px and the world x the camera opens centered on. */
export interface WorldSize {
  width: number;
  height: number;
  homeX: number;
}

/** CSS px per wheel line (WheelEvent.deltaMode 1, e.g. Firefox mouse wheels). */
const LINE_PX = 16;

/**
 * Sizing and camera for the room world (room world spec §3).
 *
 * Attach `scrollerRef` to the horizontal scroller (it must take its size from its
 * parent) and `canvasRef` to the sticky canvas inside its track. On every
 * ResizeObserver callback and devicePixelRatio change the canvas backing store
 * becomes the viewport in device px, k = coverScale, and `generation` increments
 * inside flushSync so callers redraw before the cleared canvas is painted. The
 * camera (`cameraRef`, device px) follows the scroll position; a resize keeps the
 * world x at the viewport's center centered, and the first size centers homeX.
 */
export function useWorldCanvas(size: WorldSize | null): {
  scrollerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  view: WorldView | null;
  generation: number;
  cameraRef: RefObject<number>;
} {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef(0);
  const [view, setView] = useState<WorldView | null>(null);
  const [generation, setGeneration] = useState(0);
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const homeX = size?.homeX ?? 0;

  useEffect(() => {
    const scroller = scrollerRef.current;
    const canvas = canvasRef.current;
    if (scroller === null || canvas === null || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("Canvas 2D context is unavailable");

    let cssW = 0;
    let cssH = 0;
    let applied: WorldView | null = null;
    let media: MediaQueryList | null = null;

    const resize = (): void => {
      const dpr = window.devicePixelRatio;
      const backingW = Math.round(cssW * dpr);
      const backingH = Math.round(cssH * dpr);
      // A hidden or collapsed stage: keep the last good canvas.
      if (backingW === 0 || backingH === 0) return;
      // Assigning canvas.width clears the bitmap even with the same value.
      if (
        applied !== null &&
        applied.dpr === dpr &&
        applied.backingW === backingW &&
        applied.backingH === backingH
      ) {
        return;
      }
      const focusX = applied === null ? homeX : centerWorldX(cameraRef.current, applied);
      const next = viewFor(backingW, backingH, dpr, width, height);
      const scrollLeft = scrollLeftCentering(focusX, next, width);
      applied = next;
      canvas.width = backingW;
      canvas.height = backingH;
      canvas.style.width = `${backingW / dpr}px`;
      canvas.style.height = `${backingH / dpr}px`;
      ctx.imageSmoothingEnabled = false;
      // Set before the commit: callers' redraw effects run inside flushSync.
      cameraRef.current = cameraX(scrollLeft, next, width);
      flushSync(() => {
        setView(next);
        setGeneration((g) => g + 1);
      });
      // The track has its new width now, so the offset is inside the scroll range.
      scroller.scrollLeft = scrollLeft;
    };

    const onScroll = (): void => {
      if (applied !== null) cameraRef.current = cameraX(scroller.scrollLeft, applied, width);
    };

    const onWheel = (event: WheelEvent): void => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      scroller.scrollLeft += event.deltaMode === 1 ? event.deltaY * LINE_PX : event.deltaY;
      onScroll();
    };

    const onDprChange = (): void => {
      watchDpr();
      resize();
    };
    const watchDpr = (): void => {
      media?.removeEventListener("change", onDprChange);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      media.addEventListener("change", onDprChange);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        cssW = entry.contentRect.width;
        cssH = entry.contentRect.height;
      }
      resize();
    });
    observer.observe(scroller);
    watchDpr();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      observer.disconnect();
      media?.removeEventListener("change", onDprChange);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [width, height, homeX]);

  return { scrollerRef, canvasRef, view, generation, cameraRef };
}
```

- [ ] **Step 4: Run the tests to see them pass** (same command). Expected: PASS. jsdom's `scrollLeft` is a plain stored number (no clamping), which is what these tests rely on.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add apps/web/src/features/avatar-room/useWorldCanvas.ts apps/web/src/features/avatar-room/__tests__/useWorldCanvas.test.tsx
git commit -m "feat(room): useWorldCanvas sizes the world canvas and follows the scroll

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Draw the world in RoomScene; hotspots and place dots; retire the v1 background

**Files:**
- Create: `apps/web/src/features/avatar-room/PlaceDots.tsx`
- Modify: `apps/web/src/features/avatar-room/RoomScene.tsx`, `roomLayout.ts` (delete `layoutRoom`, `RoomLayout`)
- Delete: `apps/web/src/features/avatar-room/sampleRoom.ts`, `apps/web/src/features/avatar-room/__tests__/roomLayout.test.ts` (move its `spriteFrame` tests into `worldLayout.test.ts`), `art/room/background.aseprite`, `art/tools/room/background.lua`, `art/tools/room/preview.lua`, `apps/web/src/assets/sprites/background.png`, `apps/web/src/assets/sprites/background.json`
- Modify tests: `RoomScene.test.tsx`, `RoomScene.loadError.test.tsx`, `roomArt.test.ts`, `roomFixtures.ts`, `apps/web/src/features/avatar/__tests__/art.test.ts`, `sheetRules.ts`, `sheetRules.test.ts`
- Modify: `art/tools/lib/compare-sprites.lua` (usage comment: `IDS = { "place-treadmill-corner", "treadmill" }`)

**Interfaces:**
- Consumes: `layoutWorld`, `WorldLayout`, `WorldPlace`, `spriteFrame`, `PlacedSprite` (Task 4); `HOME_PLACE`, `HOTSPOT_ACTIONS` (Task 4); `useWorldCanvas`, `WorldSize` (Task 5); `cameraX`, `centerWorldX`, `hotspotBox`, `nearestPlace`, `overlaps`, `scrollLeftCentering`, `shouldSnap`, `WorldView` (Task 1).
- Produces:
  - `RoomScene({ appearance }: { appearance: AvatarAppearance })` — unchanged props; renders a full-size scroller (`role="region"`, `aria-label="Room"`) holding the canvas (`role="img"`, `data-ready`), snap markers, hotspot links, and `<PlaceDots>`. It fills its parent (`absolute inset-0` is the parent's job; its root is `relative size-full`).
  - `PlaceDots({ places, current, onPick }: { places: readonly WorldPlace[]; current: number; onPick: (index: number) => void })`

- [ ] **Step 1: Rewrite the RoomScene tests first** (`RoomScene.test.tsx`)

Change the mocks and constants at the top:

```tsx
const { loadSheetCanvas, loadAvatarSheets, drawAvatar, captureException, world } = vi.hoisted(() => ({
  loadSheetCanvas: vi.fn(),
  loadAvatarSheets: vi.fn(),
  drawAvatar: vi.fn(),
  captureException: vi.fn(),
  // The mocked useWorldCanvas publishes its setter, camera ref and last size here.
  world: {
    set: (_view: WorldView | null, _generation: number): void => {},
    camera: { current: 0 } as { current: number },
    size: null as WorldSize | null,
  },
}));

// jsdom has no ResizeObserver or matchMedia: the view stays null until a test calls show().
vi.mock("../useWorldCanvas.js", async () => {
  const { useRef, useState } = await import("react");
  return {
    useWorldCanvas: (size: WorldSize | null) => {
      const scrollerRef = useRef<HTMLDivElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const cameraRef = useRef(0);
      const [state, setState] = useState<{ view: WorldView | null; generation: number }>({
        view: null,
        generation: 0,
      });
      world.set = (view, generation) => setState({ view, generation });
      world.camera = cameraRef;
      world.size = size;
      return { scrollerRef, canvasRef, cameraRef, ...state };
    },
  };
});
```

(Remove the `usePixelCanvas` mock and the `pixel` hoisted value. Keep the canvas-adapter, Sentry and `sheets.js` mocks. Import `type WorldView` from `../camera.js` and `type WorldSize` from `../useWorldCanvas.js`. Wrap every `render(<RoomScene ... />)` in a router so the hotspot links can render:)

```tsx
function renderScene(appearance: AvatarAppearance) {
  const router = createMemoryRouter([
    { path: "/", element: <RoomScene appearance={appearance} /> },
    { path: "/create", element: <h1>Creator stub</h1> },
  ]);
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}

/** The fixture world is 340x80 (roomFixtures.ts); at k 1 all of it is on screen. */
const VIEW_ALL: WorldView = { k: 1, dpr: 1, backingW: 340, backingH: 80, camY: 0 };
/** k 2 on a 200x160 screen: 100 art px wide, so only part of the world shows. */
const VIEW_PART: WorldView = { k: 2, dpr: 1, backingW: 200, backingH: 160, camY: 0 };
// The fixture treadmill stands at (154, 35), so its rider pivot puts the feet at (186, 68).
const FEET_X = 186;
const FEET_Y = 68;

/** Plays a useWorldCanvas resize: the canvas is cleared and the generation moves on. */
function show(view: WorldView, generation: number): void {
  act(() => world.set(view, generation));
}
```

`ctx` gains `setTransform: vi.fn()` (reset it in `beforeEach`). `mountScene` uses `renderScene` and for re-renders (`drops data-ready while a new appearance loads`) replace `rerender(<RoomScene appearance={EDITED} />)` with a small wrapper component holding the appearance in state, or render the router with a `key`-less element whose appearance comes from a mutable variable plus `router.navigate('/')`; the simplest is:

```tsx
function Switchable({ initial }: { initial: AvatarAppearance }) {
  const [appearance, setAppearance] = useState(initial);
  switchTo = setAppearance;
  return <RoomScene appearance={appearance} />;
}
let switchTo: (a: AvatarAppearance) => void = () => {};
```

used as the `/` route element in that one test (`act(() => switchTo(EDITED))`).

Mechanical replacements in every existing test: `resize(n)` → `show(VIEW_ALL, n)`; drawImage counts `9` → `13`; `FEET_X`/`FEET_Y` use the new constants. All behaviors the v1 tests pin (data-ready only after a sized draw, redraw only on change, immediate redraw on resize, 250 ms clamp, load and draw errors, one Sentry report per failure, Retry) stay.

Add these tests:

```tsx
  it("passes the world size and home center to useWorldCanvas", async () => {
    await mountScene(APPEARANCE);
    // treadmill-corner is x 140..239 in the fixture world.
    expect(world.size).toEqual({ width: 340, height: 80, homeX: 190 });
  });

  it("draws through the camera and skips sprites outside it", async () => {
    await mountScene(APPEARANCE);
    show(VIEW_PART, 1);
    flushFrame(0);
    // Art x 0..100: door-left, trophy-wall and its six trophies and medals.
    expect(ctx.drawImage).toHaveBeenCalledTimes(8);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, -0, -0);

    // Scroll: camera at 300 device px is art x 150..250.
    world.camera.current = 300;
    ctx.drawImage.mockClear();
    flushFrame(16);
    // treadmill-corner, mirror-corner, treadmill.
    expect(ctx.drawImage).toHaveBeenCalledTimes(3);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, -300, -0);
    expect(drawAvatar).toHaveBeenLastCalledWith(ctx, AVATAR_SHEETS, APPEARANCE, "front-idle", 0, FEET_X, FEET_Y);
  });

  it("shows the mirror link only once the room has drawn, and it opens the creator", async () => {
    const { router } = await mountScene(APPEARANCE);
    expect(screen.queryByRole("link", { name: "Mirror: edit avatar" })).not.toBeInTheDocument();

    show(VIEW_ALL, 1);
    flushFrame(0);
    const mirror = screen.getByRole("link", { name: "Mirror: edit avatar" });
    // Hotspot (260, 10) 20x60 at k 1: grown to 44 wide about its center.
    expect(mirror).toHaveStyle({ left: "248px", top: "10px", width: "44px", height: "60px" });

    fireEvent.click(mirror);
    expect(await screen.findByRole("heading", { name: "Creator stub" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/create");
  });

  it("lists the places as dots with home current, and a dot scrolls to its place", async () => {
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo;
    await mountScene(APPEARANCE);
    show(VIEW_PART, 1);
    flushFrame(0);

    const dots = within(screen.getByRole("navigation", { name: "Places" })).getAllByRole("button");
    expect(dots.map((d) => d.getAttribute("aria-label"))).toEqual([
      "Left door",
      "Trophy wall",
      "Treadmill",
      "Mirror",
      "Right door",
    ]);
    expect(screen.getByRole("button", { name: "Treadmill" })).toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: "Mirror" }));
    // Mirror center 270 at k 2 on a 200 px screen: camera 440, max 480.
    expect(scrollTo).toHaveBeenCalledWith({ left: 440, behavior: "smooth" });

    const scroller = screen.getByRole("region", { name: "Room" });
    act(() => {
      scroller.scrollLeft = 440;
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByRole("button", { name: "Mirror" })).toHaveAttribute("aria-current", "true");
  });

  it("snaps one place per swipe only when the screen is narrower than two places", async () => {
    await mountScene(APPEARANCE);
    show(VIEW_PART, 1); // 100 art px visible; narrowest place 40: no snap
    const scroller = screen.getByRole("region", { name: "Room" });
    expect(scroller).not.toHaveClass("snap-mandatory");
    show({ k: 4, dpr: 1, backingW: 200, backingH: 320, camY: 0 }, 2); // 50 < 80
    expect(scroller).toHaveClass("snap-x", "snap-mandatory");
  });

  it("makes the track as wide as the world at the current scale", async () => {
    await mountScene(APPEARANCE);
    show(VIEW_PART, 1);
    const track = screen.getByRole("img", { hidden: true }).parentElement;
    expect(track).toHaveStyle({ width: "680px" });
  });
```

Note on `-0`: `setTransform(k, 0, 0, k, -camX, -camY)` passes `-0` when the camera is 0; the expectations above use `-0` deliberately (Vitest's equality distinguishes `0` and `-0`).

`RoomScene.loadError.test.tsx`: replace its `usePixelCanvas` mock with the same `useWorldCanvas` mock shape (plain refs, `view: null`, `generation: 0`) and wrap the render in `createMemoryRouter` + `RouterProvider` as above. Its assertions stay.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @tracks/web test -- src/features/avatar-room/__tests__/RoomScene.test.tsx src/features/avatar-room/__tests__/RoomScene.loadError.test.tsx`
Expected: FAIL (RoomScene still uses `usePixelCanvas` and `layoutRoom`).

- [ ] **Step 3: Write `PlaceDots.tsx`**

```tsx
import { cn } from "../../lib/utils.js";
import type { WorldPlace } from "./roomLayout.js";

/** One dot per place; tapping a dot scrolls to that place. The current place is aria-current. */
export function PlaceDots({
  places,
  current,
  onPick,
}: {
  places: readonly WorldPlace[];
  current: number;
  onPick: (index: number) => void;
}) {
  return (
    <nav
      aria-label="Places"
      className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 flex -translate-x-1/2 rounded-full bg-background/70 px-1 shadow-sm backdrop-blur-sm"
    >
      {places.map((place, i) => (
        <button
          key={place.id}
          type="button"
          aria-label={place.label}
          aria-current={i === current ? "true" : undefined}
          onClick={() => onPick(i)}
          className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className={cn("size-2 rounded-full", i === current ? "bg-foreground" : "bg-foreground/30")}
          />
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Rewrite `RoomScene.tsx`**

Keep `appearanceKey`, `RoomScene` (the retry/remount wrapper) and the load/error/rAF structure. Replace:

- imports: drop `usePixelCanvas`, `layoutRoom`, `RoomLayout`, `SAMPLE_ROOM`, `ROOM_W`/`ROOM_H`; add `Link` from `react-router`, `cn` from `../../lib/utils.js`, the Task 1/4/5 names listed under Interfaces, and `PlaceDots`.
- `RoomArt`:

```tsx
interface RoomArt {
  appearance: AvatarAppearance;
  layout: WorldLayout;
  size: WorldSize;
  room: { sprite: PlacedSprite; image: HTMLCanvasElement }[];
  avatar: LoadedSheets;
  timings: BehaviorTimings;
  frames: Record<AnimationTag, TagFrame[]>;
}

/** The world size plus the center of HOME_PLACE, where the camera opens. */
function worldSize(layout: WorldLayout): WorldSize {
  const home = layout.places.find((p) => p.id === HOME_PLACE);
  if (!home) throw new Error(`The world has no home place "${HOME_PLACE}"`);
  return { width: layout.width, height: layout.height, homeX: home.x + home.w / 2 };
}
```

In `loadRoomArt`: `const layout = layoutWorld();` and `size: worldSize(layout)` in the returned object (a throw here takes the existing load-error path).

- `drawRoom`:

```tsx
function drawRoom(
  ctx: CanvasRenderingContext2D,
  art: RoomArt,
  view: WorldView,
  camX: number,
  tag: AnimationTag,
  frameOffset: number,
): void {
  const { k, backingW, backingH, camY } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, backingW, backingH);
  // Whole device px offsets: each art pixel stays exactly k device px.
  ctx.setTransform(k, 0, 0, k, -camX, -camY);
  const visible = { x: camX / k, y: camY / k, w: backingW / k, h: backingH / k };
  for (const { sprite, image } of art.room) {
    const rect = spriteFrame(sprite, tag, frameOffset);
    if (!overlaps({ x: sprite.x, y: sprite.y, w: rect.w, h: rect.h }, visible)) continue;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, sprite.x, sprite.y, rect.w, rect.h);
  }
  const feet = art.layout.avatarFeet;
  drawAvatar(ctx, art.avatar, art.appearance, tag, frameOffset, feet.x, feet.y);
}
```

- In `RoomCanvas`: `const { scrollerRef, canvasRef, view, generation, cameraRef } = useWorldCanvas(art?.size ?? null);` (move the `art` state above this call). Keep `generationRef`; add `viewRef` and sync both in the same effect:

```tsx
  const viewRef = useRef<WorldView | null>(view);
  useEffect(() => {
    generationRef.current = generation;
    viewRef.current = view;
  }, [generation, view]);
```

  In `paint`: read `const sizedView = viewRef.current; const camX = cameraRef.current;`; return `true` early when `sizedGeneration === 0 || sizedView === null`; the key becomes `` `${sizedGeneration}|${camX}|${current.tag}|${current.frameOffset}` ``; call `drawRoom(ctx, art, sizedView, camX, current.tag, current.frameOffset)`. Add `cameraRef` to the loop effect's dependency array.

- The current place for the dots:

```tsx
  const [currentPlace, setCurrentPlace] = useState<number | null>(null);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !art || !view) return;
    const update = (): void => {
      const camX = cameraX(scroller.scrollLeft, view, art.layout.width);
      setCurrentPlace(nearestPlace(centerWorldX(camX, view), art.layout.places));
    };
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [art, view, scrollerRef]);
  const homeIndex = art ? art.layout.places.findIndex((p) => p.id === HOME_PLACE) : 0;

  const pickPlace = (index: number): void => {
    const place = art?.layout.places[index];
    if (!place || !view || !art) return;
    scrollerRef.current?.scrollTo({
      left: scrollLeftCentering(place.x + place.w / 2, view, art.layout.width),
      behavior: "smooth",
    });
  };
```

- The returned JSX (the error block keeps its text, Retry button and classes; it is centered over the screen):

```tsx
  const s = view ? view.k / view.dpr : 1;
  // Hotspots and dots appear only over a drawn room.
  const shown = ready && !failed;
  return (
    <div className="relative size-full overflow-hidden">
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center">
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Couldn't load the room.
          </p>
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
      <div
        ref={scrollerRef}
        role="region"
        aria-label="Room"
        tabIndex={0}
        hidden={failed}
        className={cn(
          "absolute inset-0 overflow-x-auto overflow-y-hidden overscroll-x-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          view && art && shouldSnap(view, art.layout.places) && "snap-x snap-mandatory",
        )}
      >
        <div
          className="relative h-full"
          style={{ width: view && art ? `${art.layout.width * s}px` : "100%" }}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={describeAppearance(appearance)}
            data-ready={ready && !failed ? "true" : undefined}
            className="sticky top-0 left-0 block [image-rendering:pixelated]"
          />
          {view &&
            art?.layout.places.map((place) => (
              <div
                key={place.id}
                aria-hidden
                className="pointer-events-none absolute top-0 h-full snap-center"
                style={{ left: `${place.x * s}px`, width: `${place.w * s}px` }}
              />
            ))}
          {shown &&
            view &&
            art?.layout.hotspots.map((hotspot) => {
              const action = HOTSPOT_ACTIONS[hotspot.id];
              const box = hotspotBox(hotspot, view);
              return (
                <Link
                  key={hotspot.id}
                  to={action.to}
                  aria-label={action.label}
                  className="absolute rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:bg-white/15"
                  style={{
                    left: `${box.left}px`,
                    top: `${box.top}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                  }}
                />
              );
            })}
        </div>
      </div>
      {shown && view && art && (
        <PlaceDots
          places={art.layout.places}
          current={currentPlace ?? homeIndex}
          onPick={pickPlace}
        />
      )}
    </div>
  );
```

- [ ] **Step 5: Run the RoomScene tests to see them pass** (Step 2 command). Expected: PASS.

- [ ] **Step 6: Retire `layoutRoom`, `sampleRoom.ts` and the v1 background**

- `roomLayout.ts`: delete `layoutRoom` and `RoomLayout`; keep `place`, `findSlice`, `firstFrame`, `spriteFrame`, the `PlacedSprite` type and the Task 4 code.
- Move the four `describe("spriteFrame")` tests from `roomLayout.test.ts` into `worldLayout.test.ts`, building the sprites with `layoutWorld(withPlace("mirror-corner", { items: [{ slot: "decor", sheet: "plant" }] }), AVATAR_SPOT, registry)` instead of `layoutRoom(WITH_DECOR, ...)`; the expected belt rects are unchanged (`x: 72`, `x: 216`, frame 0 of the plant). Delete `roomLayout.test.ts`.
- `git rm apps/web/src/features/avatar-room/sampleRoom.ts art/room/background.aseprite art/tools/room/background.lua art/tools/room/preview.lua apps/web/src/assets/sprites/background.png apps/web/src/assets/sprites/background.json` (`pnpm art:export` never prunes stale exports, so delete them by hand).
- `roomFixtures.ts`: remove `SLOTS` and the `background` sheet.
- `roomArt.test.ts`: delete `ROOM`, `slotItems`, `sampleLayout`, and the two tests that read the background ("has a single-frame 180x120 background…", "fits every v1 sample item…") and "stands the avatar cell on the rider pivot, inside the room" (the world-art test covers it). Remove the `layoutRoom`/`SAMPLE_ROOM` imports. The treadmill and belt tests stay.
- `art.test.ts`: remove the `if (id === 'background')` block, `slotSlices`, `roomW`/`roomH`, and the tests "exports the background and every SAMPLE_ROOM item", "gives the background a slot slice…", "lays out the sample room on whole pixels…". Change "gives the equipment a belt tag…" to read the equipment from `WORLD` (the `AVATAR_SPOT` item): `const equipment = getSheet(WORLD.find((p) => p.id === AVATAR_SPOT.place)?.items.find((i) => i.slot === AVATAR_SPOT.slot)?.sheet ?? '');`. Remove the `SAMPLE_ROOM`/`layoutRoom` imports and `ROOM_SLOT_SLICES`.
- `sheetRules.ts`: delete `ROOM_SLOT_SLICES`. `sheetRules.test.ts`: delete "names every room slot slice"; in "treats room sheets as unswapped…" replace `'background'` with `'place-trophy-wall'`.
- `compare-sprites.lua` line 5: `IDS = { "place-treadmill-corner", "treadmill" }`.

- [ ] **Step 7: Run everything**

Run: `pnpm --filter @tracks/web test` then `pnpm typecheck && pnpm lint`
Expected: all PASS, no warnings. `grep -rn "layoutRoom\|SAMPLE_ROOM\|sampleRoom\|ROOM_SLOT_SLICES" apps/web/src art/tools` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add -A apps/web/src art
git commit -m "feat(room): draw the scrollable world with a camera, hotspots and place dots

Retires layoutRoom, sampleRoom and the 180x120 background.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Full-screen room page with overlay chrome

**Files:**
- Create: `apps/web/src/features/avatar-room/RoomChrome.tsx`
- Modify: `apps/web/src/features/avatar-room/RoomPage.tsx`, `apps/web/src/router.tsx`
- Test: `apps/web/src/features/avatar-room/__tests__/RoomPage.test.tsx`, `apps/web/src/__tests__/AvatarEditFlow.test.tsx`

**Interfaces:**
- Consumes: `NavLinks`, `AccountControls` (Task 2); `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetClose` from `components/ui/sheet.tsx`; `RoomScene` (Task 6).
- Produces: `RoomChrome({ showEdit }: { showEdit: boolean })`; `RoomPage` is the full-screen route element (`relative h-[100dvh] w-full overflow-hidden`).

- [ ] **Step 1: Write the failing RoomPage chrome tests** — in `RoomPage.test.tsx` add a `useAuth` mock (RoomChrome's AccountControls uses it; `useAvatar` keeps using the store):

```tsx
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("../../../hooks/useAuth.js", () => ({
  useAuth: () => ({
    session: { access_token: "token-a" },
    user: { id: "user-a", email: "a@example.com" },
    isLoading: false,
    signOut,
  }),
}));
```

and these tests (keep every existing test; "shows the unreachable state…" keeps asserting Edit avatar is absent):

```tsx
  it("fills the screen and draws no app shell", async () => {
    get.mockResolvedValue(FOUND);
    renderRoom();
    const room = await screen.findByRole("img", { name: describeAppearance(APPEARANCE) });
    expect(room.closest(".h-\\[100dvh\\]")).not.toBeNull();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("opens a menu with the nav, the email and Sign out", async () => {
    get.mockResolvedValue(FOUND);
    renderRoom();
    const menu = await screen.findByRole("button", { name: "Menu" });
    expect(menu).toHaveClass("size-11");
    fireEvent.click(menu);

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("link", { name: "Room" })).toHaveAttribute("href", "/");
    expect(within(sheet).getByText("a@example.com")).toHaveClass("truncate");
    expect(within(sheet).getByRole("button", { name: "Close menu" })).toHaveClass("size-11");
    fireEvent.click(within(sheet).getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["loading", () => get.mockReturnValue(new Promise(() => {}))],
    ["unreachable", () => get.mockRejectedValue(new TypeError("Failed to fetch"))],
    ["loaded", () => get.mockResolvedValue(FOUND)],
  ])("keeps the menu (and Sign out) reachable while %s", async (_state, setup) => {
    setup();
    renderRoom();
    expect(await screen.findByRole("button", { name: "Menu" })).toBeInTheDocument();
  });
```

(Import `within` from `@testing-library/react`.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @tracks/web test -- src/features/avatar-room/__tests__/RoomPage.test.tsx`
Expected: FAIL — no Menu button.

- [ ] **Step 3: Write `RoomChrome.tsx`**

```tsx
import { useState } from "react";
import { Link } from "react-router";
import { Menu, Pencil, X } from "lucide-react";
import { AccountControls } from "../../components/layout/AccountControls.js";
import { NavLinks } from "../../components/layout/NavLinks.js";
import { Button } from "../../components/ui/button.js";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../components/ui/sheet.js";
import { cn } from "../../lib/utils.js";

/** Floating glass controls over the room art. */
const GLASS = "pointer-events-auto rounded-full bg-background/70 shadow-sm backdrop-blur-sm hover:bg-background/90";

/** The room screen's app chrome, laid over the art inside the safe areas. */
export function RoomChrome({ showEdit }: { showEdit: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] pr-[calc(env(safe-area-inset-right)+0.75rem)] pl-[calc(env(safe-area-inset-left)+0.75rem)]">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Menu" className={GLASS}>
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
        >
          <SheetHeader className="flex-row items-center justify-between border-b border-border">
            <SheetTitle className="text-lg font-semibold">Tracks</SheetTitle>
            <SheetDescription className="sr-only">Navigation and account</SheetDescription>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close menu">
                <X />
              </Button>
            </SheetClose>
          </SheetHeader>
          <NavLinks onNavigate={() => setOpen(false)} />
          <AccountControls className="mt-auto justify-between border-t border-border p-4" />
        </SheetContent>
      </Sheet>
      {showEdit && (
        <Button asChild variant="ghost" className={cn(GLASS)}>
          <Link to="/create">
            <Pencil /> Edit avatar
          </Link>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `RoomPage.tsx`'s render**

Keep the hook calls, the `/create` redirect effect and the error copy; change only the markup:

```tsx
  let content: React.ReactNode;
  if (!avatar && isError) {
    content = (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center">
        <div role="alert" className="space-y-1">
          <p className="font-medium">Can't reach the server</p>
          <p className="text-sm text-muted-foreground">Check your connection, then try again.</p>
        </div>
        <Button variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  } else if (avatar) {
    content = (
      <div className="absolute inset-0">
        <RoomScene appearance={avatar} />
      </div>
    );
  } else {
    content = (
      <Skeleton role="status" aria-label="Loading your room" className="absolute inset-0 rounded-none" />
    );
  }

  // Full-bleed: the art runs under the notch and home indicator; RoomChrome pads
  // its controls with the safe-area insets (room world spec §1).
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      {content}
      <RoomChrome showEdit={Boolean(avatar)} />
    </div>
  );
```

(Remove the now-unused `Link` and `Pencil` imports; import `RoomChrome`; `import type { ReactNode } from "react"` if you prefer that to `React.ReactNode`.)

- [ ] **Step 5: Move the room out of AppShell in `router.tsx`**

```tsx
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      // The room draws its own chrome over the art (room world spec §1).
      { index: true, element: <RoomPage /> },
      {
        element: <AppShell />,
        children: [{ path: 'create', element: <CreatorPage /> }],
      },
    ],
  },
```

- [ ] **Step 6: Update `AvatarEditFlow.test.tsx`**

Replace `// #/ is the room, inside AppShell's <main>, full-bleed.` and its `main` assertion with:

```tsx
    // #/ is the room: full screen, outside AppShell (no <main>).
    const room = await screen.findByTestId('room-scene');
    expect(room).toHaveAccessibleName(describeAppearance(initialAppearance));
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
```

The `/create` assertions (`main` first child has `p-4`) stay.

- [ ] **Step 7: Run all web tests, typecheck, lint**

Run: `pnpm --filter @tracks/web test && pnpm typecheck && pnpm lint`
Expected: PASS, no warnings, no console errors in the test output (Radix logs a warning when `SheetContent` lacks a title or description — both are present).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(room): full-screen room with floating menu and Edit avatar controls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Finish the place art — Checkpoint B — and update the art docs

**Files:**
- Modify: `art/tools/room/place-*.lua`, `art/room/place-*.aseprite`, `apps/web/src/assets/sprites/place-*`
- Modify: `art/README.md`, `art/tools/room/check-palette.lua` (only if a new palette color name is used)

**Interfaces:**
- Consumes: the approved block-out (Task 3), the running app (Tasks 6–7).
- Produces: final place art with the same sizes and slices (or updated slices that still pass the Task 4 world-art tests); `art/README.md` describing the world.

- [ ] **Step 1: Add detail to every place** within the Checkpoint A layout and the Global Constraints (palette names only; edges stay plain shell columns; slots and hotspots stay in the central 110 px): wood grain on the doors, a mirror frame with a highlight and a faint reflection tint (no avatar reflection), shelf and rack shading, a skirting shadow under wall objects, and whatever the user asked for at Checkpoint A for the upper wall. Do not change slice sizes unless the user asked.

- [ ] **Step 2: Re-run the place scripts, then `world-preview.lua`**, and look at the three PNGs.

- [ ] **Step 3: CHECKPOINT B — stop and report** the preview paths. The controller shows them to the user, plus a screenshot of the running app at 390×844 and at 1280×800 (`pnpm dev`, sign in, room). Iterate until the user approves.

- [ ] **Step 4: Export and test**

Run: `pnpm art:export && pnpm --filter @tracks/web test`
Expected: PASS.

- [ ] **Step 5: Update `art/README.md`**

- Pipeline: room sources are `art/room/place-*.aseprite` and the items; no background.
- Tools table, `room/` row: `prelude.lua` (`C`, `rect`, `grid`, `saveSingle`, `slice`, `shell`, `newPlace`, world constants), `check-palette.lua`, `place-<id>.lua` (5, each **saves**), `treadmill.lua`, `frame-bib.lua`, `trophies.lua`, `medals.lua`, `world-preview.lua` (read-only).
- Room check: run the place scripts with `ROOM_OUT` set, then `compare-sprites.lua` with `IDS = { "place-door-left", "place-trophy-wall", "place-treadmill-corner", "place-mirror-corner", "place-door-right" }`.
- Replace "How to add a room item or slot" with:
  - **Add an item:** draw `art/room/<id>.aseprite` (copy `frame-bib.lua`), add `{ slot, sheet }` to its place's `items` in `world.ts` `WORLD` and to `world-preview.lua`'s `WORLD`, `pnpm art:export`, `pnpm test`.
  - **Add a slot:** add the slice in the place's script (inside the central 110 px), and a kind to `slotAlignment` in `roomLayout.ts` if it is a new kind.
  - **Add a place:** a new `place-<id>.lua` built on `L.newPlace(w)` (w a multiple of 10, 270 tall via the shell), the id in `PlaceIdSchema`, a `PlaceDef` in `WORLD` at its position, the same entry in `world-preview.lua`, `pnpm art:export`, `pnpm test` (the seam and safe-band tests check it).
  - **Add a hotspot:** a `hotspot-<id>` slice in the place art, the id in `HotspotIdSchema`, an entry in `HOTSPOT_ACTIONS`.
- Extension points: `roomLayout.ts` `layoutWorld` (places, slots, hotspots, avatar spot); `camera.ts` and `useWorldCanvas.ts` (scale and scrolling); `world.ts` (what the world shows; per-user room state replaces `WORLD` later); "Room size" now reads: the world is the places side by side, 270 tall; the scale is `coverScale` in `fitScale.ts`.
- Decisions: add "Places are 270 px tall and share the `L.shell` rows; plank ends never touch a place's edge columns, so places join without seams."

- [ ] **Step 6: Commit**

```bash
git add art apps/web/src/assets/sprites
git commit -m "art(room): finish the world places and document the world pipeline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: End-to-end check and full verification

**Files:**
- Modify: `e2e/avatar.spec.ts`
- Modify (only if verification finds a problem): whatever file owns it

**Interfaces:**
- Consumes: the whole feature.
- Produces: a verified branch ready for review.

- [ ] **Step 1: Add the mirror step to `e2e/avatar.spec.ts`** — after the final `await expectRoom(page, updated);` that follows the second Save, before the last reload:

```ts
  // The mirror in the room opens the creator too
  await page.getByRole('link', { name: 'Mirror: edit avatar' }).click();
  await expect(page).toHaveURL(/#\/create$/);
  await page.goBack();
  await expectRoom(page, updated);
```

- [ ] **Step 2: Run the e2e suite** (local Supabase and the dev servers as in v1; see `e2e/package.json`)

Run: `pnpm --filter e2e test` (or the script named in `e2e/package.json`)
Expected: PASS.

- [ ] **Step 3: Run the whole repo's checks**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all PASS with no warnings beyond the tracked vitest "jsdom created N times" hint.

- [ ] **Step 4: Browser verification (CLAUDE.md rules 22–26)** with `pnpm dev`, signed in, through Claude in Chrome or Playwright MCP:
  - Viewports: 375×667 (iPhone SE), 390×844 (iPhone 14), 412×915 (Pixel 7), 844×390 (landscape phone), 1280×800, 1920×1080.
  - At each: the room fills the screen; Menu and Edit avatar sit inside the safe area; the dots are centered at the bottom; the page body has no horizontal scroll (`document.documentElement.scrollWidth === innerWidth`); the art is crisp.
  - Phones: swipe left and right; it snaps one place per swipe; dots follow. Desktop: wheel scrolls sideways; trackpad horizontal scroll works; Tab reaches Menu → Edit avatar → room → mirror link → dots; arrow keys scroll the focused room.
  - Resize the desktop window while scrolled to the trophy wall: the trophy wall stays centered.
  - Tap the mirror → creator; Back → room. Menu → Sign out → login.
  - States: kill the API (loading → "Can't reach the server" with Menu still present); Retry once it is back.
  - Two browser profiles signed in as different users: each sees their own avatar; editing in one shows after refetch in the other.
  - Console: no errors or warnings.
  Fix anything found in the task that owns it (re-run that task's tests), then repeat this step.

- [ ] **Step 5: Commit**

```bash
git add e2e/avatar.spec.ts
git commit -m "test(e2e): the room mirror opens the creator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
