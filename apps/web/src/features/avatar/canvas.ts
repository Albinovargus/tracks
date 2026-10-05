import type { AvatarAppearance } from '@tracks/types';
import type { AnimationTag } from './frames.js';
import { drawList } from './layers.js';
import { getSheet, type SheetData, type SheetId } from './sheets.js';
import { swapKey, swapPixels, type Swap } from './swap.js';

// Thin DOM adapter (spec §3 Rendering). What to draw is decided by the tested pure
// modules (drawList, swapPixels, swapKey, getSheet); this file only loads sheet images,
// applies each swap once, caches the result and blits it. jsdom has no canvas, so no unit
// test mounts this file: the e2e run and the visual captures cover real drawing.

/** Swapped sheet canvases keyed by `${sheet.id}|${swapKey(swap)}`. */
export type LoadedSheets = ReadonlyMap<string, HTMLCanvasElement>;

// Anchor pixel of the shared 64×64 avatar cell: centerline x = 32, ground row y = 63.
const ANCHOR_X = 32;
const ANCHOR_Y = 63;

// An empty swap maps nothing, so a sheet loaded with `null` keeps its exported colors.
const NO_SWAP: Swap = new Map<number, number>();

const cache = new Map<string, Promise<HTMLCanvasElement>>();

function sheetKey(id: SheetId, swap: Swap | null): string {
  return `${id}|${swapKey(swap)}`;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D context is unavailable');
  return ctx;
}

function loadImage(sheet: SheetData): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite sheet image "${sheet.id}"`));
    img.src = sheet.imageUrl;
  });
}

// A detached <canvas>, never an OffscreenCanvas: its 2D context needs Safari 16.4+,
// and Capacitor 8 supports iOS 15.
async function renderSheet(sheet: SheetData, swap: Swap | null): Promise<HTMLCanvasElement> {
  const img = await loadImage(sheet);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = context2d(canvas);
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(swapPixels(pixels.data, swap ?? NO_SWAP));
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/**
 * The sheet drawn onto a detached canvas with `swap` applied (`null` keeps the exported
 * colors). Cached per (sheet, swap), so each combination is decoded and swapped once.
 * A failed load is evicted, so a later mount can try again.
 */
export function loadSheetCanvas(sheet: SheetData, swap: Swap | null): Promise<HTMLCanvasElement> {
  const key = sheetKey(sheet.id, swap);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const pending = renderSheet(sheet, swap);
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  return pending;
}

/**
 * Loads every (sheet, swap) pair `drawAvatar` needs for `appearance`. The pairs come
 * from `drawList`, the same source `drawAvatar` reads, and do not depend on the tag or
 * frame, so any tag's frame 0 lists them.
 */
export async function loadAvatarSheets(
  appearance: AvatarAppearance,
  registry?: ReadonlyMap<SheetId, SheetData>,
): Promise<LoadedSheets> {
  const items = drawList(appearance, 'front-idle', 0, registry);
  const entries = await Promise.all(
    items.map(async (item): Promise<[string, HTMLCanvasElement]> => [
      sheetKey(item.sheet, item.swap),
      await loadSheetCanvas(getSheet(item.sheet, registry), item.swap),
    ]),
  );
  return new Map(entries);
}

/**
 * Draws the avatar's layers (body, shoes, bottom, top, hair) for `frameOffset` within
 * `tag`, with the cell's anchor pixel (32, 63) at (feetX, feetY) in art pixels.
 * `sheets` must come from `loadAvatarSheets` for this same appearance.
 */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  sheets: LoadedSheets,
  appearance: AvatarAppearance,
  tag: AnimationTag,
  frameOffset: number,
  feetX: number,
  feetY: number,
  registry?: ReadonlyMap<SheetId, SheetData>,
): void {
  for (const item of drawList(appearance, tag, frameOffset, registry)) {
    const key = sheetKey(item.sheet, item.swap);
    const source = sheets.get(key);
    if (source === undefined) throw new Error(`Sheet canvas "${key}" is not loaded`);
    const { x, y, w, h } = item.rect;
    ctx.drawImage(source, x, y, w, h, feetX - ANCHOR_X, feetY - ANCHOR_Y, w, h);
  }
}
