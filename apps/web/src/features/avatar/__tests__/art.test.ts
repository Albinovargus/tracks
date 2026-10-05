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

  function isSheetId(id: SheetId | undefined): id is SheetId {
    return id !== undefined;
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
    // The decor slot is optional: an empty slot has no sheet to export.
    const roomSheets: SheetId[] = [
      'background',
      ...SAMPLE_ROOM.trophies,
      ...SAMPLE_ROOM.medals,
      SAMPLE_ROOM.frame,
      SAMPLE_ROOM.equipment,
      ...[SAMPLE_ROOM.decor].filter(isSheetId),
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
