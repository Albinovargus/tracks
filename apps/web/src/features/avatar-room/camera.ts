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
