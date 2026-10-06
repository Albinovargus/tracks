import { describe, expect, it } from "vitest";
import { initialBehavior, step, timingsFromSheet } from "../behavior.js";
import { clampDt, MAX_DT_MS } from "../clock.js";
import { BODY } from "./roomFixtures.js";

// The fixture body: a 400 ms front-idle loop, a 150 ms turn, a 240 ms side-run loop.
const TIMINGS = timingsFromSheet(BODY);
const rngLow = (): number => 0;

describe("clampDt", () => {
  it.each([
    ["a tab left in the background for 10 minutes", 600_000, 250],
    ["a clock that went backwards", -5, 0],
    ["an ordinary 60 fps frame", 16, 16],
  ])("clamps %s", (_name, dtMs, expected) => {
    expect(clampDt(dtMs)).toBe(expected);
  });

  it("caps dt at MAX_DT_MS, which is 250 ms", () => {
    expect(MAX_DT_MS).toBe(250);
    expect(clampDt(MAX_DT_MS)).toBe(MAX_DT_MS);
  });

  it("resumes a backgrounded tab in idle instead of jumping to the run", () => {
    const idle = initialBehavior(rngLow, TIMINGS);
    expect(idle).toEqual({ phase: "idle", msInPhase: 0, targetMs: 4000 });

    expect(step(idle, clampDt(600_000), rngLow, TIMINGS)).toEqual({
      phase: "idle",
      msInPhase: 250,
      targetMs: 4000,
    });
    // Without the clamp even a 4.4 s gap would skip idle and the turn: 4000 + 150 + 250.
    expect(step(idle, 4400, rngLow, TIMINGS).phase).toBe("run");
  });
});
