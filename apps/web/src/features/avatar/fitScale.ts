/**
 * Device pixels per art pixel for a w×h native canvas inside an
 * availW×availH CSS content box: the largest whole number that fits, never
 * below 1. Each art pixel is then exactly k device pixels, including on
 * fractional-DPR phones (Pixel 7 at 2.625).
 */
export function fitScale(
  availW: number,
  availH: number,
  dpr: number,
  w: number,
  h: number,
): number {
  return Math.max(1, Math.floor(Math.min((availW * dpr) / w, (availH * dpr) / h)));
}
