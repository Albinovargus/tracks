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
