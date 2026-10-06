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
