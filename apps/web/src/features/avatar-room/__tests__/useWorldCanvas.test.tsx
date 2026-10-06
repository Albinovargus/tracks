import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { centerWorldX, type WorldView } from "../camera.js";
import { useWorldCanvas, type WorldSize } from "../useWorldCanvas.js";

// jsdom has no ResizeObserver, no matchMedia and no canvas. This file stubs all three and
// sets devicePixelRatio, so the hook's sizing runs for real while nothing is drawn.

type ChangeListener = (event: MediaQueryListEvent) => void;

interface FakeQuery {
  media: string;
  listener: ChangeListener | null;
  removed: ChangeListener[];
}

interface FakeContext {
  imageSmoothingEnabled: boolean;
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

function setDpr(dpr: number): void {
  vi.stubGlobal("devicePixelRatio", dpr);
}

beforeEach(() => {
  observers = [];
  queries = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("matchMedia", fakeMatchMedia);
  vi.stubGlobal("devicePixelRatio", 2);
  ctx = { imageSmoothingEnabled: true };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  consoleError = vi.spyOn(console, "error");
});

afterEach(() => {
  cleanup();
  const errors = [...consoleError.mock.calls];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  expect(errors).toEqual([]);
});

const WORLD = { width: 630, height: 270, homeX: 315 };

// The hook's camera is a ref (no re-render on scroll), so the probe hands it out.
let probeCamera: { current: number } = { current: -1 };

function Probe({ size }: { size: WorldSize | null }) {
  const { scrollerRef, canvasRef, view, generation, cameraRef } = useWorldCanvas(size);
  probeCamera = cameraRef;
  return (
    <div ref={scrollerRef} data-testid="scroller">
      <canvas ref={canvasRef} data-testid="canvas" />
      <output data-testid="state">{JSON.stringify({ view, generation })}</output>
    </div>
  );
}

function state(): { view: WorldView | null; generation: number; camera: number } {
  const rendered = JSON.parse(screen.getByTestId("state").textContent ?? "{}");
  return { ...rendered, camera: probeCamera.current };
}

/** Gives the scroller the layout width a browser would report (jsdom has no layout). */
function layoutWidth(width: number): void {
  Object.defineProperty(screen.getByTestId("scroller"), "clientWidth", {
    configurable: true,
    value: Math.round(width),
  });
}

/** Plays a ResizeObserver callback for a CSS content box, after layout has that width. */
function observe(width: number, height: number): void {
  layoutWidth(width);
  act(() => {
    const observer = observers[observers.length - 1];
    if (!observer) throw new Error("no ResizeObserver");
    observer.callback(
      [{ contentRect: { width, height } } as ResizeObserverEntry],
      observer as unknown as ResizeObserver,
    );
  });
}

describe("useWorldCanvas", () => {
  it("does nothing until the world size is known", () => {
    render(<Probe size={null} />);
    expect(observers).toHaveLength(0);
    expect(state()).toMatchObject({ view: null, generation: 0 });
  });

  it("sizes the backing store to the viewport and covers it with the world", () => {
    setDpr(3);
    render(<Probe size={WORLD} />);
    observe(390, 844);

    const canvas = screen.getByTestId("canvas") as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([1170, 2532]);
    expect([canvas.style.width, canvas.style.height]).toEqual(["390px", "844px"]);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(state()).toEqual({
      view: { k: 10, dpr: 3, backingW: 1170, backingH: 2532, camY: 168 },
      generation: 1,
      camera: 2565,
    });
  });

  it("opens centered on the home place", () => {
    setDpr(3);
    render(<Probe size={WORLD} />);
    observe(390, 844);
    expect(screen.getByTestId("scroller").scrollLeft).toBe(855);
  });

  it("rounds a fractional-DPR backing store to whole device px", () => {
    setDpr(2.625);
    render(<Probe size={WORLD} />);
    observe(412, 915);
    const canvas = screen.getByTestId("canvas") as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([1082, 2402]);
    expect(state().view?.k).toBe(9);
    expect(Number.isInteger(state().camera)).toBe(true);
  });

  it("ignores a zero-size callback", () => {
    setDpr(2);
    render(<Probe size={WORLD} />);
    observe(0, 0);
    const canvas = screen.getByTestId("canvas") as HTMLCanvasElement;
    expect(state()).toMatchObject({ view: null, generation: 0 });
    expect(canvas.width).toBe(300); // jsdom's default, untouched
  });

  it("leaves the canvas alone when a callback changes nothing", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800);
    observe(1280, 800);
    expect(state().generation).toBe(1);
  });

  it("re-anchors on resize: the world x at the center stays centered", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800); // k 3, home centered: camera 305
    const scroller = screen.getByTestId("scroller");
    // The user scrolls to the trophy wall: center world x = (60 + 640) / 3 ≈ 233.
    act(() => {
      scroller.scrollLeft = 60;
      scroller.dispatchEvent(new Event("scroll"));
    });
    observe(800, 1280); // rotate: k becomes 5
    const view = state().view;
    if (!view) throw new Error("no view");
    expect(view.k).toBe(5);
    expect(Math.abs(centerWorldX(state().camera, view) - (60 + 640) / 3)).toBeLessThan(1);
    expect(scroller.scrollLeft).toBe(state().camera / view.dpr);
  });

  it("re-anchors from before the resize when the browser re-snaps first", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(600, 700);
    const scroller = screen.getByTestId("scroller");
    act(() => {
      scroller.scrollLeft = 255;
      scroller.dispatchEvent(new Event("scroll"));
    });
    const before = state().view;
    if (!before) throw new Error("no view");
    const focus = centerWorldX(state().camera, before);
    // The window widens: layout has the new width, and a snap-mandatory scroller
    // re-snaps (firing scroll) before the ResizeObserver callback runs.
    layoutWidth(1000);
    act(() => {
      scroller.scrollLeft = 55;
      scroller.dispatchEvent(new Event("scroll"));
    });
    observe(1000, 700);
    const view = state().view;
    if (!view) throw new Error("no view");
    expect(Math.abs(centerWorldX(state().camera, view) - focus)).toBeLessThan(1);
    expect(scroller.scrollLeft).toBe(state().camera / view.dpr);
  });

  it("converts the scroll position to a whole-device-px camera", () => {
    setDpr(3);
    render(<Probe size={WORLD} />);
    observe(390, 844);
    const scroller = screen.getByTestId("scroller");
    act(() => {
      scroller.scrollLeft = 100;
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(state().camera).toBe(300);
  });

  it("turns a vertical wheel into horizontal scroll, lines into px", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800);
    const scroller = screen.getByTestId("scroller");
    const start = scroller.scrollLeft;

    const pixels = new WheelEvent("wheel", { deltaY: 40, cancelable: true });
    scroller.dispatchEvent(pixels);
    expect(pixels.defaultPrevented).toBe(true);
    expect(scroller.scrollLeft).toBe(start + 40);

    const lines = new WheelEvent("wheel", { deltaY: 3, deltaMode: 1, cancelable: true });
    scroller.dispatchEvent(lines);
    expect(scroller.scrollLeft).toBe(start + 40 + 48);
  });

  it("leaves a horizontal (trackpad) wheel to the browser", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800);
    const scroller = screen.getByTestId("scroller");
    const start = scroller.scrollLeft;
    const swipe = new WheelEvent("wheel", { deltaX: 30, deltaY: 5, cancelable: true });
    scroller.dispatchEvent(swipe);
    expect(swipe.defaultPrevented).toBe(false);
    expect(scroller.scrollLeft).toBe(start);
  });

  it("leaves a ctrl+wheel (pinch or browser zoom) to the browser", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800);
    const scroller = screen.getByTestId("scroller");
    const start = scroller.scrollLeft;
    const zoom = new WheelEvent("wheel", { deltaY: 40, ctrlKey: true, cancelable: true });
    scroller.dispatchEvent(zoom);
    expect(zoom.defaultPrevented).toBe(false);
    expect(scroller.scrollLeft).toBe(start);
  });

  it("removes its listeners and disconnects the observer on unmount", () => {
    setDpr(1);
    const { unmount } = render(<Probe size={WORLD} />);
    observe(1280, 800);
    const scroller = screen.getByTestId("scroller");
    const observer = observers[observers.length - 1];
    const query = queries[queries.length - 1];
    const start = scroller.scrollLeft;

    unmount();

    expect(observer?.disconnected).toBe(true);
    expect(query?.removed.length).toBeGreaterThan(0);
    const wheel = new WheelEvent("wheel", { deltaY: 40, cancelable: true });
    scroller.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(scroller.scrollLeft).toBe(start);
  });

  it("resizes again when the DPR changes", () => {
    setDpr(1);
    render(<Probe size={WORLD} />);
    observe(1280, 800);
    setDpr(2);
    act(() => {
      queries[queries.length - 1]?.listener?.({} as MediaQueryListEvent);
    });
    expect(state().view).toMatchObject({ dpr: 2, backingW: 2560, backingH: 1600 });
    expect(state().generation).toBe(2);
  });
});
