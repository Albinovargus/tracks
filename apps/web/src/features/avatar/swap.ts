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
