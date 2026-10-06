import { describe, expect, it } from 'vitest';
import type { SheetData } from '../../avatar/sheets.js';
import {
  initialBehavior,
  step,
  tagForPhase,
  timingsFromSheet,
  type BehaviorPhase,
  type BehaviorState,
  type BehaviorTimings,
} from '../behavior.js';

const TIMINGS: BehaviorTimings = { idleLoopMs: 1000, runLoopMs: 800, turnMs: 150 };

const rngLow = (): number => 0;
const rngHigh = (): number => 0.999;

/** Returns the given values in order and throws if called more often than that. */
function rngSequence(...values: number[]): () => number {
  let calls = 0;
  return () => {
    const value = values[calls];
    calls += 1;
    if (value === undefined) {
      throw new Error(`rng called ${calls} times but only ${values.length} values were stubbed`);
    }
    return value;
  };
}

/** A frozen state: any mutation inside step() throws (ES modules are strict). */
function state(phase: BehaviorPhase, msInPhase: number, targetMs: number): BehaviorState {
  return Object.freeze({ phase, msInPhase, targetMs });
}

describe('initialBehavior', () => {
  it('starts idle at 0 ms with the shortest idle when rng is 0', () => {
    expect(initialBehavior(rngLow, TIMINGS)).toEqual({
      phase: 'idle',
      msInPhase: 0,
      targetMs: 4000,
    });
  });

  it('rounds the longest idle (7996 ms) up to whole front-idle loops', () => {
    expect(initialBehavior(rngHigh, TIMINGS).targetMs).toBe(8000);
  });

  it('rounds up when the idle loop does not divide 4000 ms', () => {
    const timings: BehaviorTimings = { ...TIMINGS, idleLoopMs: 1500 };
    expect(initialBehavior(rngLow, timings).targetMs).toBe(4500);
  });

  it('ends idle on the first loop boundary at or after the drawn duration', () => {
    const timings: BehaviorTimings = { ...TIMINGS, idleLoopMs: 1500 };
    for (const r of [0, 0.13, 0.5, 0.77, 0.999]) {
      const drawn = 4000 + r * 4000;
      const target = initialBehavior(() => r, timings).targetMs;
      expect(target % 1500).toBe(0);
      expect(target).toBeGreaterThanOrEqual(drawn);
      expect(target).toBeLessThan(drawn + 1500);
    }
  });
});

describe('step', () => {
  it('stays idle until the idle target is reached', () => {
    expect(step(initialBehavior(rngLow, TIMINGS), 3999, rngLow, TIMINGS)).toEqual({
      phase: 'idle',
      msInPhase: 3999,
      targetMs: 4000,
    });
  });

  it('switches to turn-in exactly when idle reaches its target', () => {
    expect(step(state('idle', 3999, 4000), 1, rngLow, TIMINGS)).toEqual({
      phase: 'turn-in',
      msInPhase: 0,
      targetMs: 150,
    });
  });

  it('runs a full cycle idle -> turn-in -> run -> turn-out -> idle', () => {
    const idle = initialBehavior(rngLow, TIMINGS);
    const turnIn = step(idle, 4000, rngLow, TIMINGS);
    expect(turnIn).toEqual({ phase: 'turn-in', msInPhase: 0, targetMs: 150 });
    const run = step(turnIn, 150, rngLow, TIMINGS);
    expect(run).toEqual({ phase: 'run', msInPhase: 0, targetMs: 8000 });
    const turnOut = step(run, 8000, rngLow, TIMINGS);
    expect(turnOut).toEqual({ phase: 'turn-out', msInPhase: 0, targetMs: 150 });
    const idleAgain = step(turnOut, 150, rngLow, TIMINGS);
    expect(idleAgain).toEqual({ phase: 'idle', msInPhase: 0, targetMs: 4000 });
  });

  it('rounds the longest run (14993 ms) up to whole side-run loops', () => {
    expect(step(state('turn-in', 0, 150), 150, rngHigh, TIMINGS)).toEqual({
      phase: 'run',
      msInPhase: 0,
      targetMs: 15200,
    });
  });

  it('draws a fresh duration on each idle and run entry and none for turns', () => {
    const rng = rngSequence(0, 0.999, 0.999);
    const idle = initialBehavior(rng, TIMINGS);
    expect(idle.targetMs).toBe(4000);
    const turnIn = step(idle, 4000, rng, TIMINGS);
    const run = step(turnIn, 150, rng, TIMINGS);
    expect(run).toEqual({ phase: 'run', msInPhase: 0, targetMs: 15200 });
    const turnOut = step(run, 15200, rng, TIMINGS);
    const idleAgain = step(turnOut, 150, rng, TIMINGS);
    expect(idleAgain).toEqual({ phase: 'idle', msInPhase: 0, targetMs: 8000 });
  });

  it('carries leftover dt across two transitions in one step', () => {
    // 100 ms finishes idle, 150 ms is the whole turn-in, 150 ms lands in run.
    expect(step(state('idle', 3900, 4000), 400, rngLow, TIMINGS)).toEqual({
      phase: 'run',
      msInPhase: 150,
      targetMs: 8000,
    });
  });

  it('carries a dt longer than a whole cycle around the loop', () => {
    const cycleMs = 4000 + 150 + 8000 + 150;
    expect(step(initialBehavior(rngLow, TIMINGS), cycleMs + 50, rngLow, TIMINGS)).toEqual({
      phase: 'idle',
      msInPhase: 50,
      targetMs: 4000,
    });
  });

  it('adds dt within a phase and keeps the drawn target', () => {
    expect(step(state('run', 100, 8000), 16.5, rngHigh, TIMINGS)).toEqual({
      phase: 'run',
      msInPhase: 116.5,
      targetMs: 8000,
    });
  });

  it('returns the same state for zero, negative and non-finite dt', () => {
    const s = state('run', 100, 8000);
    expect(step(s, 0, rngLow, TIMINGS)).toBe(s);
    expect(step(s, -50, rngLow, TIMINGS)).toBe(s);
    expect(step(s, Number.NaN, rngLow, TIMINGS)).toBe(s);
    expect(step(s, Number.POSITIVE_INFINITY, rngLow, TIMINGS)).toBe(s);
  });

  it('does not mutate the state it is given', () => {
    const s = state('idle', 3900, 4000);
    step(s, 400, rngLow, TIMINGS);
    expect(s).toEqual({ phase: 'idle', msInPhase: 3900, targetMs: 4000 });
  });
});

describe('tagForPhase', () => {
  it('maps each phase to the avatar tag it plays', () => {
    expect(tagForPhase('idle')).toBe('front-idle');
    expect(tagForPhase('turn-in')).toBe('turn');
    expect(tagForPhase('run')).toBe('side-run');
    expect(tagForPhase('turn-out')).toBe('turn');
  });
});

/** A body sheet laid out like the export: front-idle, then turn, then side-run. */
function bodySheet(idle: number[], turn: number[], run: number[]): SheetData {
  const durations = [...idle, ...turn, ...run];
  return {
    id: 'body',
    imageUrl: '/sprites/body.png',
    frames: durations.map((duration, i) => ({ x: i * 64, y: 0, w: 64, h: 64, duration })),
    tags: [
      { name: 'front-idle', from: 0, to: idle.length - 1, direction: 'forward' },
      { name: 'turn', from: idle.length, to: idle.length + turn.length - 1, direction: 'forward' },
      {
        name: 'side-run',
        from: idle.length + turn.length,
        to: durations.length - 1,
        direction: 'forward',
      },
    ],
    slices: [],
  };
}

describe('timingsFromSheet', () => {
  it('sums the front-idle and side-run frame durations and reads the turn frame', () => {
    const body = bodySheet([700, 100, 700, 500], [150], [80, 120, 100, 100, 80, 120, 100, 100]);
    expect(timingsFromSheet(body)).toEqual({ idleLoopMs: 2000, runLoopMs: 800, turnMs: 150 });
  });

  it('throws on a zero-length tag instead of handing step() a 0 ms phase', () => {
    const body = bodySheet([500, 500], [0], [100, 100]);
    expect(() => timingsFromSheet(body)).toThrow(
      'Sheet "body": tag "turn" must last longer than 0 ms, got 0',
    );
  });
});
