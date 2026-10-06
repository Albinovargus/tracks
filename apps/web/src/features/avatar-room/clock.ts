/** The longest gap one rAF tick may feed the behavior machine. */
export const MAX_DT_MS = 250;

/**
 * Pure: the frame delta RoomScene passes to step(). A hidden tab or
 * backgrounded app resumes where it was instead of skipping states, and a
 * clock that steps backwards adds nothing. NaN passes through; step() treats
 * a non-finite dt as no time.
 */
export function clampDt(dtMs: number): number {
  return Math.min(Math.max(dtMs, 0), MAX_DT_MS);
}
