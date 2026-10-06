import { loopLength, tagFrames, type AnimationTag } from '../avatar/frames.js';
import type { SheetData } from '../avatar/sheets.js';

/**
 * Room behavior: idle (front-idle) -> turn-in (turn) -> run (side-run)
 * -> turn-out (turn) -> idle. Pure: no clock, no timers; rng is injected.
 */
export type BehaviorPhase = 'idle' | 'turn-in' | 'run' | 'turn-out';

export interface BehaviorTimings {
  /** One front-idle loop in ms (sum of its frame durations in body.json). */
  idleLoopMs: number;
  /** One side-run loop in ms. */
  runLoopMs: number;
  /** How long the turn tag shows, in ms. */
  turnMs: number;
}

export interface BehaviorState {
  phase: BehaviorPhase;
  /** Time spent in the current phase; pass it to frameAt for the tag frame. */
  msInPhase: number;
  /** The phase ends when msInPhase reaches this. */
  targetMs: number;
}

const IDLE_MIN_MS = 4000;
const IDLE_SPREAD_MS = 4000;
const RUN_MIN_MS = 8000;
const RUN_SPREAD_MS = 7000;

const NEXT_PHASE: Record<BehaviorPhase, BehaviorPhase> = {
  idle: 'turn-in',
  'turn-in': 'run',
  run: 'turn-out',
  'turn-out': 'idle',
};

const PHASE_TAG: Record<BehaviorPhase, AnimationTag> = {
  idle: 'front-idle',
  'turn-in': 'turn',
  run: 'side-run',
  'turn-out': 'turn',
};

/** Rounds up to whole loops, so the switch lands at the end of a tag loop. */
function wholeLoops(ms: number, loopMs: number): number {
  return Math.ceil(ms / loopMs) * loopMs;
}

/** A phase's duration, drawn on entry. Only idle and run consume rng. */
function phaseTarget(phase: BehaviorPhase, rng: () => number, timings: BehaviorTimings): number {
  switch (phase) {
    case 'idle':
      return wholeLoops(IDLE_MIN_MS + rng() * IDLE_SPREAD_MS, timings.idleLoopMs);
    case 'run':
      return wholeLoops(RUN_MIN_MS + rng() * RUN_SPREAD_MS, timings.runLoopMs);
    case 'turn-in':
    case 'turn-out':
      return timings.turnMs;
  }
}

export function initialBehavior(rng: () => number, timings: BehaviorTimings): BehaviorState {
  return { phase: 'idle', msInPhase: 0, targetMs: phaseTarget('idle', rng, timings) };
}

export function step(
  state: BehaviorState,
  dtMs: number,
  rng: () => number,
  timings: BehaviorTimings,
): BehaviorState {
  // Zero dt changes nothing; a negative or non-finite dt would corrupt
  // msInPhase (or never leave the loop). Either way, hand back the same object.
  if (!Number.isFinite(dtMs) || dtMs <= 0) return state;
  let phase = state.phase;
  let targetMs = state.targetMs;
  let msInPhase = state.msInPhase + dtMs;
  while (msInPhase >= targetMs) {
    msInPhase -= targetMs;
    phase = NEXT_PHASE[phase];
    targetMs = phaseTarget(phase, rng, timings);
  }
  return { phase, msInPhase, targetMs };
}

export function tagForPhase(phase: BehaviorPhase): AnimationTag {
  return PHASE_TAG[phase];
}

/** A tag's loop length in ms; throws unless it is a positive, finite number. */
function tagLoopMs(sheet: SheetData, tag: AnimationTag): number {
  const ms = loopLength(tagFrames(sheet, tag));
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(`Sheet "${sheet.id}": tag "${tag}" must last longer than 0 ms, got ${ms}`);
  }
  return ms;
}

/** Reads the timings from body.json, the timing reference for every avatar layer. */
export function timingsFromSheet(body: SheetData): BehaviorTimings {
  return {
    idleLoopMs: tagLoopMs(body, 'front-idle'),
    runLoopMs: tagLoopMs(body, 'side-run'),
    turnMs: tagLoopMs(body, 'turn'),
  };
}
