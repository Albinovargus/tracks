# Art

Pixel art for the athlete avatar and the room: the Aseprite sources, the tools that
draw and check them, and how to extend both. The full rules are in the design spec,
`docs/superpowers/specs/2026-10-04-athlete-avatar-room-design.md` (§1 Art, §3 Room
composition, §4 Art Pipeline).

## Pipeline

- **Sources:** `art/avatar/*.aseprite` (body, garments, hair) and `art/room/*.aseprite`
  (background and items). All are RGB, alpha 0 or 255, and use only `art/palette.gpl`.
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
  `apps/web/src/features/avatar-room/__tests__/roomArt.test.ts` (belt motion, sole travel).
- **Aseprite MCP:** the tools run through the `aseprite` MCP server
  (`run_lua_script`), registered once per machine with local scope; see spec §4
  "MCP setup, one-time".

## Tools (`art/tools/`)

Lua tools run inside Aseprite. Aseprite's `dofile` needs an absolute path, so every
call sets one global, `ROOT` (the repo root, forward slashes), and the tools derive all
other paths from it through `lib/paths.lua`:

```
run_lua_script(filename = "<ROOT>/art/avatar/body.aseprite",   -- only for tools that use the open sprite
  script = 'ROOT = "D:/Projects/Tracks"; dofile(ROOT .. "/art/tools/body/dump-body.lua")')
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
| `room/` | `prelude.lua`, `check-palette.lua`, `background.lua`, `treadmill.lua`, `frame-bib.lua`, `trophies.lua`, `medals.lua` (each **saves** to `art/room/`), `preview.lua` |
| `lib/` | `paths.lua`, `compare-sprites.lua`, `palette-swatch.lua` |

Checks that leave the sources untouched (run them after any change):

- body: `dump-body.lua` on `body.aseprite`, then `git status art/tools/body/grids` must
  be clean; `node art/tools/body/check-run.mjs` must end `CHECK OK`.
- garments: `garments/check.lua` must end `RESULT: PASS`; `paint.lua` with
  `CHECK = true` must print `CHECK PASS` for each garment.
- hair: `hair/check.lua` on each `hair-*.aseprite` must print `OK`; on the ponytail,
  `ponytail-near-arm.lua` then `occlusion.lua` must print `OK`.
- room: set `ROOM_OUT = ROOT .. "/.superpowers/art-previews/room-check"`, run the room
  scripts (they save there instead of `art/room/`), then `lib/compare-sprites.lua` with
  `CANDIDATE_DIR = ROOM_OUT` and the sheet `IDS` must end `RESULT: PASS`.

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

## How to add a room item or slot

1. Draw `art/room/<id>.aseprite`: RGB, `art/palette.gpl` colors only. Add a script to
   `art/tools/room/` (copy `frame-bib.lua`; `prelude.lua` has `C`, `rect`, `grid`,
   `saveSingle`, `slice`).
2. A new slot needs a slice in `background.aseprite` (add it to `SLOTS` in
   `room/background.lua`) and its name in `ROOM_SLOT_SLICES` in
   `apps/web/src/features/avatar/__tests__/sheetRules.ts`.
3. Reference the item in `apps/web/src/features/avatar-room/sampleRoom.ts` (`SampleRoom`, `SAMPLE_ROOM`).
4. Check that `layoutRoom` in `roomLayout.ts` places that slot kind (standing items sit
   bottom-center, hanging items hang top-center) and that `room/preview.lua` matches.
5. `pnpm art:export`, then `pnpm test`.

## Extension points in code

- **`apps/web/src/features/avatar-room/behavior.ts`** (`BehaviorPhase`, `NEXT_PHASE`,
  `PHASE_TAG`): a pure state machine, no clock and an injected rng. Today it is a fixed
  `idle -> turn-in -> run -> turn-out` loop. New activities become new phases plus a
  chooser that replaces the fixed `NEXT_PHASE` step.
- **`roomLayout.ts`** (`layoutRoom`, `spriteFrame`): pure. The athlete's feet are
  anchored to the treadmill's `rider` slice pivot (`avatarFeet`). Wandering needs an
  avatar position and depth ordering here, so the athlete can stand in front of or
  behind items.
- **`RoomScene.tsx`** (`drawRoom`): the draw loop. The treadmill belt animates only
  during `side-run` (`spriteFrame` shows belt frame 0 in every other tag).
- **Mirroring:** there is no flip support yet. A draw-time horizontal flip in the
  avatar draw (`drawAvatar` in `apps/web/src/features/avatar/canvas.ts`) would let
  left-facing walking reuse the right-facing frames.
- **Room size:** the background is 180x120 landscape (`ROOM_W`, `ROOM_H` in
  `RoomScene.tsx`), scaled by the integer `fitScale` (`apps/web/src/features/avatar/fitScale.ts`,
  via `usePixelCanvas.ts`). The planned full-screen portrait room with the UI over the
  art changes it here, plus `room/background.lua` and its slots.

## Decisions

- Planted side-run soles are 8 px long and move 4 px per frame, which matches the
  treadmill belt (`treadmill.lua` derives the belt from the body; `roomArt.test.ts`
  checks it).
- Garments may extend at most 1 px outside the body silhouette (`garments/check.lua`).
- The plant was removed from v1; the `decor` slot is kept, empty in `SAMPLE_ROOM`.
- Palette swap ramps run light > base > shadow.
- The hair files' hidden `ref-body` predates the side-run toe change: frames 8-15
  show the older feet. It never exports, so the art is right, but re-sync it from
  `body.aseprite` before drawing new hair frames.
