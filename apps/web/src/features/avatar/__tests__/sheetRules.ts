// Pure helpers for the art check (art.test.ts). They take decoded PNG pixels and
// parsed Aseprite JSON and return one message per problem (empty = valid), so
// they are unit-tested in sheetRules.test.ts without any exported art.
import { z } from 'zod';
import { hex } from './paletteRules.js';

/** Every avatar frame is one shared 64x64 cell (spec §1 Scale). */
export const AVATAR_CELL = 64;

/** Tags every avatar sheet carries, with body.json's timing. */
export const AVATAR_TAGS = ['front-idle', 'turn', 'side-run'] as const;

/** Slot slices background.aseprite must define (spec §3 Room composition). */
export const ROOM_SLOT_SLICES = [
  'trophy-1',
  'trophy-2',
  'trophy-3',
  'medal-1',
  'medal-2',
  'medal-3',
  'frame',
  'equipment',
  'decor',
] as const;

/** Decoded RGBA pixels, row-major, 4 bytes per pixel (pngjs PNG.sync.read). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const RectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

/** The subset of `aseprite --format json-array --list-tags --list-slices`
 * output the art check reads. Unknown keys are stripped. */
export const AsepriteJsonSchema = z.object({
  frames: z.array(z.object({ frame: RectSchema, duration: z.number().int().positive() })).min(1),
  meta: z.object({
    size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
    frameTags: z.array(
      z.object({
        name: z.string(),
        from: z.number().int().nonnegative(),
        to: z.number().int().nonnegative(),
        direction: z.string(),
      }),
    ),
    slices: z.array(
      z.object({
        name: z.string(),
        keys: z
          .array(
            z.object({
              frame: z.number().int().nonnegative(),
              bounds: RectSchema,
              pivot: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
            }),
          )
          .min(1),
      }),
    ),
  }),
});

export type AsepriteJson = z.infer<typeof AsepriteJsonSchema>;

export function parseAsepriteJson(json: unknown): AsepriteJson {
  return AsepriteJsonSchema.parse(json);
}

export type SwapRampName = 'skin' | 'hair' | 'cloth';

/** The placeholder ramp a sheet's runtime swap replaces (same rule as
 * layers.ts: body → skin, hair-* → hair, clothing → cloth); null = unswapped. */
export function swapRampFor(sheetId: string): SwapRampName | null {
  if (sheetId === 'body') return 'skin';
  if (sheetId.startsWith('hair-')) return 'hair';
  if (/^(top|bottom|shoes)-/.test(sheetId)) return 'cloth';
  return null;
}

/** Avatar layer sheets: body, hair-*, top-*, bottom-*, shoes-*. */
export function isAvatarSheet(sheetId: string): boolean {
  return swapRampFor(sheetId) !== null;
}

function alphaAt(image: RgbaImage, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4 + 3] ?? 0;
}

function colorAt(image: RgbaImage, x: number, y: number): number {
  const o = (y * image.width + x) * 4;
  const d = image.data;
  return ((d[o] ?? 0) << 16) | ((d[o + 1] ?? 0) << 8) | (d[o + 2] ?? 0);
}

/** Every pixel has alpha 0 or 255, and every opaque color is in the palette. */
export function pixelProblems(image: RgbaImage, palette: ReadonlySet<number>): string[] {
  let partial = 0;
  let firstPartial = '';
  const offPalette = new Map<number, string>();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const alpha = alphaAt(image, x, y);
      if (alpha === 0) continue;
      if (alpha !== 255) {
        if (partial === 0) firstPartial = `(${x}, ${y})`;
        partial++;
        continue;
      }
      const color = colorAt(image, x, y);
      if (!palette.has(color) && !offPalette.has(color)) offPalette.set(color, `(${x}, ${y})`);
    }
  }
  const problems: string[] = [];
  if (partial > 0) {
    problems.push(`${partial} pixels have alpha other than 0 or 255, first at ${firstPartial}`);
  }
  for (const [color, at] of offPalette) {
    problems.push(`color ${hex(color)} at ${at} is not in palette.gpl`);
  }
  return problems;
}

/** The distinct colors of the image's alpha-255 pixels. */
export function opaqueColors(image: RgbaImage): Set<number> {
  const colors = new Set<number>();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (alphaAt(image, x, y) === 255) colors.add(colorAt(image, x, y));
    }
  }
  return colors;
}

/**
 * A swapped sheet uses placeholders of its own ramp only, and at least one of
 * them; an unswapped sheet (ramp null) uses no placeholder at all.
 */
export function placeholderProblems(
  colors: ReadonlySet<number>,
  ramp: readonly number[] | null,
  placeholders: readonly number[],
): string[] {
  const problems: string[] = [];
  for (const color of colors) {
    if (!placeholders.includes(color)) continue;
    if (ramp === null) {
      problems.push(`placeholder ${hex(color)} is used, but this sheet is not palette-swapped`);
    } else if (!ramp.includes(color)) {
      problems.push(
        `placeholder ${hex(color)} is not in this sheet's swap ramp (${ramp.map(hex).join(' ')})`,
      );
    }
  }
  if (ramp !== null && !ramp.some((c) => colors.has(c))) {
    problems.push(`uses no color of its swap ramp (${ramp.map(hex).join(' ')})`);
  }
  return problems;
}

/** Avatar frames are 64x64 cells inside the PNG with a fully transparent
 * row 0 (anything there was clipped by the cell). */
export function cellProblems(image: RgbaImage, data: AsepriteJson): string[] {
  const problems: string[] = [];
  data.frames.forEach(({ frame }, i) => {
    if (frame.w !== AVATAR_CELL || frame.h !== AVATAR_CELL) {
      problems.push(`frame ${i} is ${frame.w}x${frame.h} (expected ${AVATAR_CELL}x${AVATAR_CELL})`);
      return;
    }
    if (frame.x + frame.w > image.width || frame.y + frame.h > image.height) {
      problems.push(`frame ${i} lies outside the ${image.width}x${image.height} PNG`);
      return;
    }
    for (let dx = 0; dx < frame.w; dx++) {
      if (alphaAt(image, frame.x + dx, frame.y) !== 0) {
        problems.push(`frame ${i} has a non-transparent pixel on row 0 at x = ${dx}`);
        return;
      }
    }
  });
  return problems;
}

/** Required tags exist, every tag plays forward, and every range is in bounds. */
export function tagProblems(data: AsepriteJson, required: readonly string[]): string[] {
  const problems: string[] = [];
  const tags = data.meta.frameTags;
  for (const name of required) {
    if (!tags.some((t) => t.name === name)) problems.push(`missing tag "${name}"`);
  }
  for (const tag of tags) {
    if (tag.direction !== 'forward') {
      problems.push(`tag "${tag.name}" plays ${tag.direction} (expected forward)`);
    }
    if (tag.from > tag.to || tag.to >= data.frames.length) {
      problems.push(
        `tag "${tag.name}" covers frames ${tag.from}-${tag.to}, outside the ${data.frames.length} frames`,
      );
    }
  }
  return problems;
}

/** body's `turn` tag is the single ¾ frame (spec §1 Views and animation tags). */
export function turnFrameProblems(data: AsepriteJson): string[] {
  const turn = data.meta.frameTags.find((t) => t.name === 'turn');
  if (!turn || turn.from === turn.to) return [];
  return [`tag "turn" covers ${turn.to - turn.from + 1} frames (expected 1)`];
}

function durations(data: AsepriteJson, from = 0, to = data.frames.length - 1): number[] {
  return data.frames.slice(from, to + 1).map((f) => f.duration);
}

function tagList(data: AsepriteJson): string {
  return data.meta.frameTags.map((t) => `${t.name} ${t.from}-${t.to} ${t.direction}`).join(', ');
}

/** An avatar layer has body.json's frame count, per-frame durations and tags. */
export function timingProblems(data: AsepriteJson, body: AsepriteJson): string[] {
  const problems: string[] = [];
  if (data.frames.length !== body.frames.length) {
    problems.push(`has ${data.frames.length} frames (body has ${body.frames.length})`);
  }
  const own = durations(data).join(',');
  const ref = durations(body).join(',');
  if (own !== ref) problems.push(`frame durations [${own}] differ from body [${ref}]`);
  if (tagList(data) !== tagList(body)) {
    problems.push(`tags [${tagList(data)}] differ from body [${tagList(body)}]`);
  }
  return problems;
}

/** treadmill's `belt` tag has the frame count and durations of body's `side-run`. */
export function beltProblems(treadmill: AsepriteJson, body: AsepriteJson): string[] {
  const belt = treadmill.meta.frameTags.find((t) => t.name === 'belt');
  if (!belt) return ['missing tag "belt"'];
  const run = body.meta.frameTags.find((t) => t.name === 'side-run');
  if (!run) return ['body has no "side-run" tag'];
  const beltDurations = durations(treadmill, belt.from, belt.to);
  const runDurations = durations(body, run.from, run.to);
  if (beltDurations.length !== runDurations.length) {
    return [`belt has ${beltDurations.length} frames (body side-run has ${runDurations.length})`];
  }
  const own = beltDurations.join(',');
  const ref = runDurations.join(',');
  return own === ref ? [] : [`belt durations [${own}] differ from body side-run [${ref}]`];
}

/** Each named slice exists; with needPivot, its first key has a pivot. */
export function sliceProblems(
  data: AsepriteJson,
  names: readonly string[],
  needPivot: boolean,
): string[] {
  const problems: string[] = [];
  for (const name of names) {
    const slice = data.meta.slices.find((s) => s.name === name);
    if (!slice) {
      problems.push(`missing slice "${name}"`);
    } else if (needPivot && slice.keys[0]?.pivot === undefined) {
      problems.push(`slice "${name}" has no pivot`);
    }
  }
  return problems;
}
