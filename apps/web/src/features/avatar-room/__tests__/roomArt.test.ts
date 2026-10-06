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
import { layoutWorld } from '../roomLayout.js';
import { WORLD } from '../world.js';
import {
  beltMotionProblems,
  beltSpan,
  columnPixels,
  outsideSafeBand,
  pixelAt,
  plantedFootTravels,
  rowPixels,
  soleSpan,
  type Rect,
} from './roomRules.js';

const SPRITES_DIR = new URL('../../../assets/sprites/', import.meta.url);

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

/** World geometry (room world spec section 2). */
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
