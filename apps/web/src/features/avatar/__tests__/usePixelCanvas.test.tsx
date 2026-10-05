import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { usePixelCanvas } from '../usePixelCanvas.js';

// jsdom has no ResizeObserver, no matchMedia and no canvas. This file stubs all three and
// sets devicePixelRatio, so the hook's sizing runs for real while nothing is drawn.

const NATIVE_W = 180;
const NATIVE_H = 120;

type ChangeListener = (event: MediaQueryListEvent) => void;

interface FakeQuery {
  media: string;
  listener: ChangeListener | null;
  removed: ChangeListener[];
}

interface FakeContext {
  imageSmoothingEnabled: boolean;
  setTransform: Mock;
}

let observers: FakeResizeObserver[] = [];
let queries: FakeQuery[] = [];
let ctx: FakeContext;
let consoleError: MockInstance<typeof console.error>;

class FakeResizeObserver {
  readonly callback: ResizeObserverCallback;
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

function fakeMatchMedia(media: string) {
  const query: FakeQuery = { media, listener: null, removed: [] };
  queries.push(query);
  return {
    media,
    matches: true,
    addEventListener: (_type: string, listener: ChangeListener) => {
      query.listener = listener;
    },
    removeEventListener: (_type: string, listener: ChangeListener) => {
      query.removed.push(listener);
    },
  };
}

function last<T>(items: T[]): T {
  const item = items[items.length - 1];
  if (item === undefined) throw new Error('expected at least one item');
  return item;
}

function Harness() {
  const { stageRef, canvasRef, scale, generation } = usePixelCanvas(NATIVE_W, NATIVE_H);
  return (
    <div ref={stageRef} data-testid="stage" data-scale={scale} data-generation={generation}>
      <canvas ref={canvasRef} data-testid="canvas" />
    </div>
  );
}

function mount() {
  const view = render(<Harness />);
  return {
    ...view,
    stage: screen.getByTestId('stage'),
    canvas: screen.getByTestId('canvas') as HTMLCanvasElement,
  };
}

/** One ResizeObserver callback for the stage's new CSS content box. */
function resizeStage(width: number, height: number): void {
  const observer = last(observers);
  act(() => {
    observer.callback(
      [{ contentRect: { width, height } } as unknown as ResizeObserverEntry],
      observer as unknown as ResizeObserver,
    );
  });
}

/** The window moves to a screen with a different DPR: the armed query stops matching. */
function changeDpr(dpr: number): void {
  vi.stubGlobal('devicePixelRatio', dpr);
  const query = last(queries);
  const listener = query.listener;
  if (listener === null) throw new Error(`no change listener on ${query.media}`);
  act(() => {
    listener({ matches: false, media: query.media } as MediaQueryListEvent);
  });
}

beforeEach(() => {
  observers = [];
  queries = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('matchMedia', fakeMatchMedia);
  vi.stubGlobal('devicePixelRatio', 2);
  ctx = { imageSmoothingEnabled: true, setTransform: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  consoleError = vi.spyOn(console, 'error');
});

afterEach(() => {
  cleanup();
  const errors = [...consoleError.mock.calls];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  expect(errors).toEqual([]);
});

describe('usePixelCanvas', () => {
  it('observes the stage, arms the DPR query and leaves the canvas alone until the first size', () => {
    const { stage, canvas } = mount();

    expect(last(observers).observed).toEqual([stage]);
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 2dppx)']);
    expect(stage.dataset.generation).toBe('0');
    expect(canvas.width).toBe(300); // the HTML default: not sized yet
    expect(ctx.setTransform).not.toHaveBeenCalled();
  });

  it('sizes the 180x120 room crisply on an iPhone SE stage (375x551 CSS at DPR 2)', () => {
    const { stage, canvas } = mount();

    resizeStage(375, 551); // k = floor(min(750 / 180, 1102 / 120)) = 4

    expect(canvas.width).toBe(720);
    expect(canvas.height).toBe(480);
    expect(canvas.style.width).toBe('360px');
    expect(canvas.style.height).toBe('240px');
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.setTransform).toHaveBeenCalledTimes(1);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(4, 0, 0, 4, 0, 0);
    expect(stage.dataset.scale).toBe('4');
    expect(stage.dataset.generation).toBe('1');
  });

  it('re-sizes when the phone rotates, and skips a resize that keeps k', () => {
    const { stage, canvas } = mount();
    resizeStage(375, 551);

    // The browser resets the context when the canvas is resized.
    ctx.imageSmoothingEnabled = true;
    resizeStage(667, 319); // landscape: k = floor(min(1334 / 180, 638 / 120)) = 5

    expect(canvas.width).toBe(900);
    expect(canvas.height).toBe(600);
    expect(canvas.style.width).toBe('450px');
    expect(canvas.style.height).toBe('300px');
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(5, 0, 0, 5, 0, 0);
    expect(stage.dataset.scale).toBe('5');
    expect(stage.dataset.generation).toBe('2');

    // A window resize that keeps k = 5 must not clear the canvas or bump generation.
    resizeStage(680, 330);

    expect(canvas.width).toBe(900);
    expect(ctx.setTransform).toHaveBeenCalledTimes(2);
    expect(stage.dataset.generation).toBe('2');
  });

  it('re-sizes when the window moves to a DPR 3 screen, and re-arms the DPR query', () => {
    const { stage, canvas } = mount();
    resizeStage(375, 551);
    const firstQuery = last(queries);

    ctx.imageSmoothingEnabled = true;
    changeDpr(3); // k = floor(min(1125 / 180, 1653 / 120)) = 6

    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(720);
    expect(canvas.style.width).toBe('360px');
    expect(canvas.style.height).toBe('240px');
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(6, 0, 0, 6, 0, 0);
    expect(stage.dataset.scale).toBe('6');
    expect(stage.dataset.generation).toBe('2');

    // The old query is disarmed and a new one watches the new DPR.
    expect(firstQuery.removed).toEqual([firstQuery.listener]);
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 2dppx)', '(resolution: 3dppx)']);
    expect(last(queries).listener).not.toBeNull();

    // The resize callback that follows a DPR change, with the same CSS box, is a no-op.
    resizeStage(375, 551);

    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(720);
    expect(ctx.setTransform).toHaveBeenCalledTimes(2);
    expect(stage.dataset.generation).toBe('2');
  });

  it('disconnects the observer and the DPR listener on unmount', () => {
    const { unmount } = mount();
    const observer = last(observers);
    const query = last(queries);

    unmount();

    expect(observer.disconnected).toBe(true);
    expect(query.removed).toEqual([query.listener]);
  });
});
