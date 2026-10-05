import { z } from 'zod';

/** An export's basename in src/assets/sprites/, e.g. 'body', 'hair-short', 'treadmill'. */
export type SheetId = string;

/** A frame's source rect in the sheet PNG plus its duration in ms. */
export interface SheetFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  duration: number;
}

/** A 0-based, inclusive frame range from meta.frameTags. */
export interface SheetTag {
  name: string;
  from: number;
  to: number;
  direction: string;
}

/** A slice's sprite-local bounds; the pivot is relative to the slice's top-left. */
export interface SheetSlice {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pivot: { x: number; y: number } | null;
}

export interface SheetData {
  id: SheetId;
  imageUrl: string;
  frames: SheetFrame[];
  tags: SheetTag[];
  slices: SheetSlice[];
}

const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const SliceKeySchema = z.object({
  bounds: RectSchema,
  pivot: z.object({ x: z.number(), y: z.number() }).optional(),
});

/** The parts of Aseprite's `--format json-array --list-tags --list-slices` output the app reads. */
const AsepriteExportSchema = z.object({
  frames: z
    .array(z.object({ frame: RectSchema, duration: z.number().nonnegative() }))
    .min(1),
  meta: z.object({
    frameTags: z
      .array(
        z.object({
          name: z.string(),
          from: z.number().int().nonnegative(),
          to: z.number().int().nonnegative(),
          direction: z.string(),
        }),
      )
      .default([]),
    slices: z
      .array(
        z.object({
          name: z.string(),
          keys: z.tuple([SliceKeySchema], SliceKeySchema),
        }),
      )
      .default([]),
  }),
});

/**
 * Reads an Aseprite json-array export. Source rects come from frames[i].frame
 * (never from the frame index), durations from frames[i].duration, tag ranges
 * from meta.frameTags and slices from meta.slices[].keys[0].
 */
export function parseSheet(id: SheetId, json: unknown, imageUrl: string): SheetData {
  const parsed = AsepriteExportSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Sprite sheet "${id}" is not a valid Aseprite json-array export: ${z.prettifyError(parsed.error)}`,
    );
  }
  const { frames, meta } = parsed.data;
  return {
    id,
    imageUrl,
    frames: frames.map(({ frame, duration }) => ({
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
      duration,
    })),
    tags: meta.frameTags.map(({ name, from, to, direction }) => ({ name, from, to, direction })),
    slices: meta.slices.map(({ name, keys: [{ bounds, pivot }] }) => ({
      name,
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      pivot: pivot ? { x: pivot.x, y: pivot.y } : null,
    })),
  };
}

function basename(path: string, ext: string): string {
  const file = path.slice(path.lastIndexOf('/') + 1);
  return file.endsWith(ext) ? file.slice(0, -ext.length) : file;
}

/**
 * Pairs each `<name>.json` module with the `<name>.png` URL of the same
 * basename. Keys are import.meta.glob paths. SHEETS is built with this; it is
 * exported only so the pairing can be unit-tested without real exports.
 */
export function buildRegistry(
  jsonModules: Record<string, unknown>,
  pngUrls: Record<string, string>,
): ReadonlyMap<SheetId, SheetData> {
  const urls = new Map<string, string>();
  for (const [path, url] of Object.entries(pngUrls)) {
    urls.set(basename(path, '.png'), url);
  }
  const registry = new Map<SheetId, SheetData>();
  for (const [path, json] of Object.entries(jsonModules)) {
    const id = basename(path, '.json');
    const url = urls.get(id);
    if (url === undefined) {
      throw new Error(`Sprite sheet "${id}" has a JSON export but no ${id}.png next to it`);
    }
    registry.set(id, parseSheet(id, json, url));
  }
  return registry;
}

const jsonModules = import.meta.glob<unknown>('../../assets/sprites/*.json', {
  eager: true,
  import: 'default',
});
const pngUrls = import.meta.glob<string>('../../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Every committed export in src/assets/sprites/, keyed by basename. */
export const SHEETS: ReadonlyMap<SheetId, SheetData> = buildRegistry(jsonModules, pngUrls);

export function getSheet(
  id: SheetId,
  registry: ReadonlyMap<SheetId, SheetData> = SHEETS,
): SheetData {
  const sheet = registry.get(id);
  if (!sheet) {
    throw new Error(
      `Sprite sheet "${id}" is not exported (expected src/assets/sprites/${id}.json and ${id}.png)`,
    );
  }
  return sheet;
}
