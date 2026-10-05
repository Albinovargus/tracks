/** Three shades of one color, each packed 0xRRGGBB: [light, base, shadow]. */
export type Ramp = readonly [number, number, number];

/** Exact-RGB replacement table: packed 0xRRGGBB source -> packed 0xRRGGBB target. */
export type Swap = ReadonlyMap<number, number>;

/** Maps each shade of `from` to the shade at the same position in `to`. */
export function buildSwap(from: Ramp, to: Ramp): Swap {
  return new Map<number, number>([
    [from[0], to[0]],
    [from[1], to[1]],
    [from[2], to[2]],
  ]);
}

function hex6(color: number): string {
  return color.toString(16).padStart(6, '0');
}

/**
 * Stable cache key for a swap. `null` and an empty swap both mean "draw the
 * sheet as exported" and share the key "none"; otherwise the key lists
 * `from:to` hex pairs sorted by source color, so insertion order never matters.
 */
export function swapKey(swap: Swap | null): string {
  if (swap === null || swap.size === 0) return 'none';
  return [...swap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([from, to]) => `${hex6(from)}:${hex6(to)}`)
    .join(',');
}

/**
 * Returns a recolored copy of an RGBA buffer (ImageData layout). Every fully
 * opaque pixel (alpha 255) has its packed 0xRRGGBB looked up in `swap` and
 * replaced when found; other pixels are copied as-is. Alpha is never changed
 * and the input is not mutated. The result is ArrayBuffer-backed, so it can go
 * straight into `new ImageData(result, w, h)`.
 */
export function swapPixels(rgba: Uint8ClampedArray, swap: Swap): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(rgba);
  if (swap.size === 0) return out;
  for (let i = 0; i + 3 < out.length; i += 4) {
    if (out[i + 3] !== 255) continue;
    const rgb = ((out[i] ?? 0) << 16) | ((out[i + 1] ?? 0) << 8) | (out[i + 2] ?? 0);
    const to = swap.get(rgb);
    if (to === undefined) continue;
    out[i] = (to >> 16) & 0xff;
    out[i + 1] = (to >> 8) & 0xff;
    out[i + 2] = to & 0xff;
  }
  return out;
}
