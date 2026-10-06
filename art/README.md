# Art

Pixel art for the athlete avatar and the room: the Aseprite sources, the tools that
draw and check them, and how to extend both. The full rules are in two design specs:

- `docs/superpowers/specs/2026-10-04-athlete-avatar-room-design.md` (v1): §1 Art and
  §4 Art Pipeline.
- `docs/superpowers/specs/2026-10-06-room-world-design.md` (room world): §2 The world
  and the art model (places, the dollhouse cutaway, grounding) and §3 Camera, rendering
  and hotspots. These supersede v1 §3 "Room composition".

## Pipeline

- **Sources:** `art/avatar/*.aseprite` (body, garments, hair) and `art/room/*.aseprite`:
  the five world places (`place-*.aseprite`) and the items (treadmill, trophies, medals,
  bib frame). There is no single room background. All are RGB, alpha 0 or 255, and use
  only `art/palette.gpl`.
- **Export:** `pnpm art:export` (`scripts/export-art.ts`) exports every `art/**/*.aseprite`
  to `apps/web/src/assets/sprites/<name>.png` + `<name>.json`. The exports are
  committed, so CI and Pages never need Aseprite. It uses `ASEPRITE_PATH`, or the Steam install.
- **Palette swap:** recolorable pixels are drawn in placeholder ramps (light, base,
  shadow): PH skin `#ff80ff #ff40ff #ff00ff`, PH hair `#80ffff #40ffff #00ffff`, PH cloth
  `#ffff80 #ffff40 #ffff00`. At runtime `apps/web/src/features/avatar/palette.ts`
  (`PLACEHOLDER_RAMPS`, `SKIN_RAMPS`, `HAIR_RAMPS`, `CLOTH_RAMPS`) and `swap.ts`
  (`buildSwap`, `swapPixels`) replace them with the user's colors.
- **Checks** (they run in `pnpm test` against the committed exports):
  `apps/web/src/features/avatar/__tests__/art.test.ts` (palette, sheets, tags, slices,
  catalog coverage), `body-art.test.ts` (body shape and side-run feet) and
  `apps/web/src/features/avatar-room/__tests__/roomArt.test.ts` (belt motion, sole travel,
  and the world: places 270 tall, seamless edge columns, slots and hotspots in the
  central 110 px, items that fit their slots).
- **Aseprite MCP:** the tools run through the `aseprite` MCP server
  (`run_lua_script`), registered once per machine with local scope; see spec §4
  "MCP setup, one-time".

## Tools (`art/tools/`)

Lua tools run inside Aseprite. Aseprite's `dofile` needs an absolute path, so every
call sets one global, `ROOT` (the repo root, forward slashes), and the tools derive all
other paths from it through `lib/paths.lua`:

```
run_lua_script(filename = "<ROOT>/art/avatar/body.aseprite",   -- only for tools that use the open sprite
  script = 'ROOT = "<repo root>"; dofile(ROOT .. "/art/tools/body/dump-body.lua")')
```

Node tools (`.mjs`, `.mts`) find the repo from their own location; run them from
anywhere (`node art/tools/body/check-run.mjs`, `npx tsx art/tools/garments/composite.mts`).
Every file's header says what it does, what it needs and whether it saves. Previews go
to `.superpowers/art-previews/` (gitignored); never commit them.

| Folder | Tools |
| --- | --- |
| `body/` | `grids/fNN.txt` (one 64x64 char grid per body frame: `.` `o` `L` `B` `S`), `gridlib.mjs`, `build-run.mjs` (f08-f15), `build-turn.mjs` (f07), `derive-idle.mjs` (f02-f06 from f01), `check-run.mjs`, `preview-grid.mjs`, `paint-body.lua` (grids -> body, **saves**), `dump-body.lua` (body -> grids), `onion-review.lua` |
| `garments/` | `lib.lua` (`G.ORDER`, `G.LAYER`), `make-sources.lua`, `map.lua`, `ops/<garment>.lua`, `paint.lua` (**saves**; `CHECK = true` does not), `check.lua`, `montage.lua`, `composite.mts` |
| `hair/` | `convert.lua` (**saves**), `dump.lua`, `offsets.lua`, `paint.lua` (**saves**), `check.lua`, `ponytail-near-arm.lua` + `occlusion.lua`, `snap.lua` |
| `room/` | `prelude.lua` (`C`, `rect`, `grid`, `saveSingle`, `slice`, `shell`, `newPlace`, `cloud`, `door`, world constants), `check-palette.lua`, `place-<id>.lua` (5, each **saves**), `treadmill.lua`, `frame-bib.lua`, `trophies.lua`, `medals.lua` (each **saves** to `art/room/`), `world-preview.lua` (read-only) |
| `lib/` | `paths.lua`, `compare-sprites.lua`, `palette-swatch.lua` |

Checks that leave the sources untouched (run them after any change):

- body: `dump-body.lua` on `body.aseprite`, then `git status art/tools/body/grids` must
  be clean; `node art/tools/body/check-run.mjs` must end `CHECK OK`.
- garments: `garments/check.lua` must end `RESULT: PASS`; `paint.lua` with
  `CHECK = true` must print `CHECK PASS` for each garment.
- hair: `hair/check.lua` on each `hair-*.aseprite` must print `OK`; on the ponytail,
  `ponytail-near-arm.lua` then `occlusion.lua` must print `OK`.
- room: set `ROOM_OUT = ROOT .. "/.superpowers/art-previews/room-check"`, run the place
  scripts (they save there instead of `art/room/`), then `lib/compare-sprites.lua` with
  `CANDIDATE_DIR = ROOM_OUT` and `IDS = { "place-door-left", "place-trophy-wall",
  "place-treadmill-corner", "place-mirror-corner", "place-door-right" }` must end
  `RESULT: PASS`. The item scripts check the same way with their own `IDS`.

`paint-body.lua`, `make-sources.lua` with `MODE = "refresh"`, and the hair `convert.lua`
and `paint.lua` have no read-only mode, so they were not re-run when the tools moved;
the dump and check runs above cover the same art. Run them only when you mean to change
a source, then `pnpm art:export`.

## Avatar layering

The avatar draws `body -> shoes -> bottom -> top -> hair`
(`apps/web/src/features/avatar/layers.ts` `drawList`). Every layer sheet is 64x64 and
carries the body's frames, frame durations and tags (`front-idle`, `turn`,
`side-run`); `art.test.ts` enforces it. Garment and hair sources keep a hidden copy of
the body (`body-ref` in garments, `ref-body` in hair) to draw against.

## How to add an animation tag (for example `walk` or `lift`)

1. **Body.** Add the frames to `body.aseprite` and draw them as grids in
   `art/tools/body/grids/` (write a builder next to `build-run.mjs` for a cycle), then
   run `paint-body.lua` and `dump-body.lua`.
2. **Tag.** Add the tag in Aseprite, forward, over the new frames.
3. **Code.** Add the name to `AnimationTag` in
   `apps/web/src/features/avatar/frames.ts` and to `AVATAR_TAGS` in
   `apps/web/src/features/avatar/__tests__/sheetRules.ts`. TypeScript then points at
   every `Record<AnimationTag, ...>`, such as `frames` in `RoomScene.tsx`.
4. **Every layer.** Redraw EVERY hair and garment sheet for the new frames.
   Garments: `make-sources.lua` with `MODE = "refresh"` (re-syncs `body-ref`, frames,
   durations and tags), `map.lua` to measure, new entries in `ops/<garment>.lua`,
   `paint.lua`, `check.lua`. Hair: re-sync `ref-body` (see Decisions), add the frames and
   tag, then `offsets.lua`, `paint.lua`, `check.lua` (and `occlusion.lua` for the ponytail).
5. **Export:** `pnpm art:export`, then `pnpm test`.
6. **Behavior:** add a phase and its tag in
   `apps/web/src/features/avatar-room/behavior.ts`.

The cost: each new body animation is drawn once per layer sheet, which is 6 sheets on
top of the body today (3 hair styles, 3 garments). Add animations before the wardrobe
grows; every new garment or hairstyle multiplies the work of every later animation.

## The room world

The room is a row of places side by side (`WORLD` in
`apps/web/src/features/avatar-room/world.ts`): door-left 120, trophy-wall 130,
treadmill-corner 130 (home), mirror-corner 130 and door-right 120 px wide, all 270 px
tall. `world-preview.lua` composites them with their items and writes the world plus
phone and desktop crops to `.superpowers/art-previews/world/`.

Each place is a dollhouse cutaway. `L.shell` in `prelude.lua` draws every shared row,
so the places join without a seam:

| Rows | What |
| --- | --- |
| 0..47 | sky (phones crop up to ~17 rows, landscape phones ~36); clouds per place (`L.cloud`) |
| 48..71 | roof: ridge, five shingle courses, eave (`ROOF_Y`) |
| 72..107 | attic, rafters every 10 px, a purlin (`ATTIC_Y`) |
| 108..119 | attic floor, joists, the room's cornice (`CEILING_Y`) |
| 120..203 | back wall (`WALL_Y`); v1's room rows map to y + 120 |
| 204..208 | baseboard (`BASEBOARD_Y`) |
| 209..269 | floor (`FLOOR_Y`); items stand on y 231 (`STAND_Y`); the place dots overlay the front rows |

The rules every place follows:

- **Seams.** Every row is one color across, except patterns that keep off
  x % 10 = 0 and 9 (`every10` in `prelude.lua`, and plank ends at x = 10 or 30 mod 40).
  With widths a multiple of 10, columns 0 and w - 1 always match.
- **Depth lanes.** The back wall meets the floor at y 209. Things against the wall
  (doors, the mirror, the sneakers) stand on the wall line, y 209..212. Free-standing
  equipment stands forward on `STAND_Y`.
- **One light.** Light comes from the window, upper left. Wall-mounted and wall-adjacent
  things cast `wall shadow` down and to the right (`wood light` where it crosses the
  baseboard). Things on the floor sit on a 1-2 px `floor lines` contact shadow,
  slightly wider than their base.
- **Baked-in props.** Props that never change (the towel and jump rope, the sneakers, the
  mats) are drawn into the place art. Anything per user is an item in a slot. Item
  shadows belong in the item's own art, because items are swappable.

## How to extend the room

- **Add an item:** draw `art/room/<id>.aseprite` (copy `frame-bib.lua`). Add
  `{ slot, sheet }` to its place's `items` in `world.ts` `WORLD` and to
  `world-preview.lua`'s `WORLD`. Then run `pnpm art:export` and `pnpm test`.
- **Add a slot:** add the slice in the place's script, inside the central 110 px. If it
  is a new kind, add it to `slotAlignment` in `roomLayout.ts` (standing items sit
  bottom-center, hanging items hang top-center).
- **Add a place:** write a new `place-<id>.lua` built on `L.newPlace(w)` (w a multiple of
  10, 270 tall via the shell). Add the id to `PlaceIdSchema`, a `PlaceDef` in `WORLD` at
  its position, and the same entry in `world-preview.lua`. Then run `pnpm art:export` and
  `pnpm test`; the seam and safe-band tests check it.
- **Add a hotspot:** add a `hotspot-<id>` slice in the place art, the id in
  `HotspotIdSchema`, and an entry in `HOTSPOT_ACTIONS`. `hotspotBox` in `camera.ts` grows
  small hotspots to the 44 px touch minimum.

## Extension points in code

- **`apps/web/src/features/avatar-room/behavior.ts`** (`BehaviorPhase`, `NEXT_PHASE`,
  `PHASE_TAG`): a pure state machine, no clock and an injected rng. Today it is a fixed
  `idle -> turn-in -> run -> turn-out` loop. New activities become new phases plus a
  chooser that replaces the fixed `NEXT_PHASE` step.
- **`roomLayout.ts`** (`layoutWorld`, `slotAlignment`, `spriteFrame`): pure. It lays out
  the places, slots, hotspots and the avatar spot. The athlete's feet are anchored to the
  `rider` slice pivot of the item in `AVATAR_SPOT`'s slot (`avatarFeet`). Wandering needs
  an avatar position and depth ordering here, so the athlete can stand in front of or
  behind items.
- **`camera.ts`** and **`useWorldCanvas.ts`**: the scale, horizontal scrolling, snapping to
  places, and hotspot boxes.
- **`world.ts`**: what the world shows (`WORLD`, `HOME_PLACE`, `AVATAR_SPOT`,
  `HOTSPOT_ACTIONS`). Per-user room state replaces `WORLD` later.
- **`RoomScene.tsx`** (`drawRoom`): the draw loop. The treadmill belt animates only
  during `side-run` (`spriteFrame` shows belt frame 0 in every other tag).
- **Mirroring:** there is no flip support yet. A draw-time horizontal flip in the
  avatar draw (`drawAvatar` in `apps/web/src/features/avatar/canvas.ts`) would let
  left-facing walking reuse the right-facing frames.
- **Room size:** the world is the places side by side, 270 px tall. The scale is
  `coverScale` in `apps/web/src/features/avatar/fitScale.ts`, applied by `camera.ts`
  `viewFor`.

## Decisions

- Planted side-run soles are 8 px long and move 4 px per frame, which matches the
  treadmill belt (`treadmill.lua` derives the belt from the body; `roomArt.test.ts`
  checks it).
- Garments may extend at most 1 px outside the body silhouette (`garments/check.lua`).
- The plant was removed from v1. The `decor` slot is kept in the mirror corner, empty
  in `WORLD`.
- Palette swap ramps run light > base > shadow.
- The hair files' hidden `ref-body` predates the side-run toe change: frames 8-15
  show the older feet. It never exports, so the art is right, but re-sync it from
  `body.aseprite` before drawing new hair frames.
- Places are 270 px tall and share the `L.shell` rows. Plank ends never touch a place's
  edge columns, so places join without seams.
- The room keeps v1's proportions (an 84 px wall over a 48 px athlete) inside a
  dollhouse cutaway. The room once filled the whole 270 rows, and the user found it read
  as "a house for giants".
