import type { SheetData } from './sheets.js';

export type AnimationTag = 'front-idle' | 'turn' | 'side-run';

/** One frame of a tag: its absolute index in the sheet and its duration in ms. */
export interface TagFrame {
  index: number;
  duration: number;
}

/** The frames of `tag` in play order, read from the sheet's own tag range. */
export function tagFrames(sheet: SheetData, tag: string): TagFrame[] {
  const range = sheet.tags.find((t) => t.name === tag);
  if (!range) {
    throw new Error(`Sprite sheet "${sheet.id}" has no tag "${tag}"`);
  }
  const frames: TagFrame[] = [];
  for (let index = range.from; index <= range.to; index++) {
    const frame = sheet.frames[index];
    if (!frame) {
      throw new Error(`Sprite sheet "${sheet.id}" tag "${tag}" points at missing frame ${index}`);
    }
    frames.push({ index, duration: frame.duration });
  }
  return frames;
}

/** Total duration of one pass through the frames, in ms. */
export function loopLength(frames: TagFrame[]): number {
  return frames.reduce((total, frame) => total + frame.duration, 0);
}

/**
 * The 0-based offset within `frames` showing at `msInState`, looping forward.
 * A frame starts exactly when the previous frames' durations have elapsed.
 */
export function frameAt(frames: TagFrame[], msInState: number): number {
  const total = loopLength(frames);
  if (total <= 0) return 0;
  let t = ((msInState % total) + total) % total;
  for (const [offset, frame] of frames.entries()) {
    if (t < frame.duration) return offset;
    t -= frame.duration;
  }
  return frames.length - 1;
}
