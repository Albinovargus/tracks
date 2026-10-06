import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { AvatarAppearance } from "@tracks/types";
import type { LoadedSheets } from "../../avatar/canvas.js";
import type { SheetData } from "../../avatar/sheets.js";
import type { WorldView } from "../camera.js";
import type { WorldSize } from "../useWorldCanvas.js";

const { loadSheetCanvas, loadAvatarSheets, drawAvatar, captureException, world } =
  vi.hoisted(() => ({
    loadSheetCanvas: vi.fn(),
    loadAvatarSheets: vi.fn(),
    drawAvatar: vi.fn(),
    captureException: vi.fn(),
    // The mocked useWorldCanvas publishes its setter, camera ref and last size here.
    world: {
      set: (_view: WorldView | null, _generation: number): void => {},
      camera: { current: 0 } as { current: number },
      size: null as WorldSize | null,
    },
  }));

vi.mock("@sentry/react", () => ({ captureException }));

// jsdom cannot decode images or draw (.claude/CLAUDE.md rule 26), so the canvas adapter is faked.
vi.mock("../../avatar/canvas.js", () => ({
  loadSheetCanvas,
  loadAvatarSheets,
  drawAvatar,
}));

// jsdom has no ResizeObserver or matchMedia: the view stays null until a test calls show().
vi.mock("../useWorldCanvas.js", async () => {
  const { useRef, useState } = await import("react");
  return {
    useWorldCanvas: (size: WorldSize | null) => {
      const scrollerRef = useRef<HTMLDivElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const cameraRef = useRef(0);
      const [state, setState] = useState<{
        view: WorldView | null;
        generation: number;
      }>({
        view: null,
        generation: 0,
      });
      world.set = (view, generation) => setState({ view, generation });
      world.camera = cameraRef;
      world.size = size;
      return { scrollerRef, canvasRef, cameraRef, ...state };
    },
  };
});

// The room and body sheets come from the fixture registry instead of the exported art.
vi.mock("../../avatar/sheets.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../avatar/sheets.js")>();
  const { roomRegistry } = await import("./roomFixtures.js");
  const registry = roomRegistry();
  return {
    ...actual,
    SHEETS: registry,
    getSheet: (id: string, from: ReadonlyMap<string, SheetData> = registry) =>
      actual.getSheet(id, from),
  };
});

import { describeAppearance } from "../../avatar/appearance.js";
import { RoomScene } from "../RoomScene.js";

const APPEARANCE: AvatarAppearance = {
  skin_tone: "tone-3",
  hair_style: "curly",
  hair_color: "auburn",
  top: "starter-tee-blue",
  bottom: "starter-shorts-black",
  shoes: "starter-shoes-red",
};
const EDITED: AvatarAppearance = { ...APPEARANCE, hair_color: "blonde" };

const AVATAR_SHEETS: LoadedSheets = new Map();

/** The fixture world is 340x80 (roomFixtures.ts); at k 1 all of it is on screen. */
const VIEW_ALL: WorldView = { k: 1, dpr: 1, backingW: 340, backingH: 80, camY: 0 };
/** k 2 on a 200x160 screen: 100 art px wide, so only part of the world shows. */
const VIEW_PART: WorldView = { k: 2, dpr: 1, backingW: 200, backingH: 160, camY: 0 };
// The fixture treadmill stands at (154, 35), so its rider pivot puts the feet at (186, 68).
const FEET_X = 186;
const FEET_Y = 68;

const ctx = { clearRect: vi.fn(), drawImage: vi.fn(), setTransform: vi.fn() };
const pendingFrames = new Map<number, FrameRequestCallback>();
let lastFrameId = 0;

/** Runs every queued rAF callback once, at `now` ms. */
function flushFrame(now: number): void {
  const callbacks = [...pendingFrames.values()];
  pendingFrames.clear();
  act(() => {
    for (const callback of callbacks) callback(now);
  });
}

/** Plays a useWorldCanvas resize: the canvas is cleared and the generation moves on. */
function show(view: WorldView, generation: number): void {
  act(() => world.set(view, generation));
}

/** RoomScene under a router, so its hotspot links can render and navigate. */
function renderScene(appearance: AvatarAppearance) {
  const router = createMemoryRouter([
    { path: "/", element: <RoomScene appearance={appearance} /> },
    { path: "/create", element: <h1>Creator stub</h1> },
  ]);
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}

let switchTo: (a: AvatarAppearance) => void = () => {};

/** Holds the appearance in state so a test can hand RoomScene a new look. */
function Switchable({ initial }: { initial: AvatarAppearance }) {
  const [appearance, setAppearance] = useState(initial);
  switchTo = setAppearance;
  return <RoomScene appearance={appearance} />;
}

function renderSwitchable(appearance: AvatarAppearance) {
  const router = createMemoryRouter([
    { path: "/", element: <Switchable initial={appearance} /> },
  ]);
  return render(<RouterProvider router={router} />);
}

/** Renders the scene and waits for its sheets to load, which starts the rAF loop. */
async function mountScene(appearance: AvatarAppearance) {
  const view = renderScene(appearance);
  await waitFor(() => expect(pendingFrames.size).toBe(1));
  return view;
}

/** The scene's one canvas, found even while it is hidden behind the error message. */
function roomCanvas(): HTMLElement {
  return screen.getByRole("img", { hidden: true });
}

/** Undoes a test-only Element.prototype.scrollTo (jsdom has none). */
let restoreScrollTo: () => void = () => {};

describe("RoomScene", () => {
  beforeEach(() => {
    pendingFrames.clear();
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback): number => {
        lastFrameId += 1;
        pendingFrames.set(lastFrameId, callback);
        return lastFrameId;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
      pendingFrames.delete(id);
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    // rng 0: idle lasts exactly 4000 ms, the shortest idle.
    vi.spyOn(Math, "random").mockReturnValue(0);
    ctx.clearRect.mockReset();
    ctx.drawImage.mockReset();
    ctx.setTransform.mockReset();
    drawAvatar.mockReset();
    captureException.mockReset();
    loadSheetCanvas
      .mockReset()
      .mockResolvedValue(document.createElement("canvas"));
    loadAvatarSheets.mockReset().mockResolvedValue(AVATAR_SHEETS);
  });

  afterEach(() => {
    cleanup();
    restoreScrollTo();
    restoreScrollTo = () => {};
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sets data-ready only once the first frame is drawn on a sized canvas", async () => {
    await mountScene(APPEARANCE);
    expect(roomCanvas()).toHaveAccessibleName(describeAppearance(APPEARANCE));
    expect(roomCanvas()).not.toHaveAttribute("data-ready");

    // Generation 0: useWorldCanvas has not sized the canvas, and its first resize would wipe a frame.
    flushFrame(0);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    expect(roomCanvas()).not.toHaveAttribute("data-ready");

    show(VIEW_ALL, 1);
    flushFrame(16);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(13);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      "front-idle",
      0,
      FEET_X,
      FEET_Y,
    );
    expect(roomCanvas()).toHaveAttribute("data-ready", "true");
    expect(pendingFrames.size).toBe(1);
  });

  it("redraws only when the frame or the canvas size changes", async () => {
    await mountScene(APPEARANCE);
    show(VIEW_ALL, 1);
    flushFrame(0);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    // Still front-idle frame 0 (frames are 100 ms long).
    flushFrame(16);
    flushFrame(50);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    flushFrame(116);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      "front-idle",
      1,
      FEET_X,
      FEET_Y,
    );

    // A resize clears the canvas, so the same frame is drawn again.
    show(VIEW_ALL, 2);
    flushFrame(132);
    expect(ctx.clearRect).toHaveBeenCalledTimes(3);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      "front-idle",
      1,
      FEET_X,
      FEET_Y,
    );
  });

  it("redraws the current frame as soon as a resize clears the canvas", async () => {
    await mountScene(APPEARANCE);
    show(VIEW_ALL, 1);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(roomCanvas()).toHaveAttribute("data-ready", "true");

    flushFrame(0);
    flushFrame(116);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);

    // No rAF tick in between: the wiped canvas is repainted at once with the same frame.
    show(VIEW_ALL, 2);
    expect(ctx.clearRect).toHaveBeenCalledTimes(3);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      "front-idle",
      1,
      FEET_X,
      FEET_Y,
    );
  });

  it("clamps a long gap between frames to 250 ms", async () => {
    await mountScene(APPEARANCE);
    show(VIEW_ALL, 1);
    flushFrame(0);

    // Unclamped, 10 s would finish the 4 s idle and the 150 ms turn and land in the run.
    flushFrame(10_000);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      "front-idle",
      2,
      FEET_X,
      FEET_Y,
    );

    // It carries on from there: 350 ms into idle is frame 3.
    flushFrame(10_100);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      "front-idle",
      3,
      FEET_X,
      FEET_Y,
    );
  });

  it("shows an error instead of the room when a sheet fails to load", async () => {
    const error = new Error('Failed to load sprite sheet image "plant"');
    loadSheetCanvas.mockRejectedValue(error);
    renderScene(APPEARANCE);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the room.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toHaveClass(
      "min-h-11",
    );
    expect(captureException).toHaveBeenCalledWith(error);
    expect(roomCanvas()).not.toBeVisible();
    expect(roomCanvas()).not.toHaveAttribute("data-ready");
    expect(pendingFrames.size).toBe(0);
  });

  it("shows the error and stops the loop when a draw fails", async () => {
    const error = new Error('Sheet canvas "body|" is not loaded');
    drawAvatar.mockImplementation(() => {
      throw error;
    });
    await mountScene(APPEARANCE);
    show(VIEW_ALL, 1);
    flushFrame(0);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the room.",
    );
    expect(captureException).toHaveBeenCalledWith(error);
    expect(roomCanvas()).not.toHaveAttribute("data-ready");
    expect(pendingFrames.size).toBe(0);
  });

  it("reports a draw failure to Sentry once, however often the canvas resizes", async () => {
    drawAvatar.mockImplementation(() => {
      throw new Error('Sheet canvas "body|" is not loaded');
    });
    await mountScene(APPEARANCE);
    show(VIEW_ALL, 1);
    flushFrame(0);
    expect(captureException).toHaveBeenCalledTimes(1);

    // Each resize or rotate moves the generation on, which used to redraw and re-report.
    show(VIEW_ALL, 2);
    show(VIEW_ALL, 3);
    show(VIEW_ALL, 4);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(pendingFrames.size).toBe(0);
  });

  it("loads and draws the room again on Retry after a draw failure", async () => {
    drawAvatar.mockImplementationOnce(() => {
      throw new Error('Sheet canvas "body|" is not loaded');
    });
    await mountScene(APPEARANCE);
    show(VIEW_ALL, 1);
    flushFrame(0);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the room.",
    );
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toHaveClass("min-h-11");
    expect(loadAvatarSheets).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(pendingFrames.size).toBe(1));
    expect(loadAvatarSheets).toHaveBeenCalledTimes(2);
    show(VIEW_ALL, 1);
    flushFrame(16);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      "front-idle",
      0,
      FEET_X,
      FEET_Y,
    );
    expect(roomCanvas()).toBeVisible();
    expect(roomCanvas()).toHaveAttribute("data-ready", "true");
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("reports again when a retry fails again", async () => {
    const error = new Error('Sheet canvas "body|" is not loaded');
    drawAvatar.mockImplementation(() => {
      throw error;
    });
    await mountScene(APPEARANCE);
    show(VIEW_ALL, 1);
    flushFrame(0);
    expect(captureException).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(pendingFrames.size).toBe(1));
    show(VIEW_ALL, 1);
    show(VIEW_ALL, 2);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the room.",
    );
    expect(captureException).toHaveBeenCalledTimes(2);
    expect(captureException).toHaveBeenLastCalledWith(error);
  });

  it("drops data-ready while a new appearance loads", async () => {
    renderSwitchable(APPEARANCE);
    await waitFor(() => expect(pendingFrames.size).toBe(1));
    show(VIEW_ALL, 1);
    flushFrame(0);
    expect(roomCanvas()).toHaveAttribute("data-ready", "true");

    let finishLoad: (sheets: LoadedSheets) => void = () => {};
    loadAvatarSheets.mockReturnValueOnce(
      new Promise<LoadedSheets>((resolve) => {
        finishLoad = resolve;
      }),
    );
    act(() => switchTo(EDITED));

    expect(roomCanvas()).toHaveAccessibleName(describeAppearance(EDITED));
    expect(roomCanvas()).not.toHaveAttribute("data-ready");
    // The old look's loop has stopped and the new one waits for its sheets.
    expect(pendingFrames.size).toBe(0);
    expect(loadAvatarSheets).toHaveBeenLastCalledWith(EDITED);

    finishLoad(AVATAR_SHEETS);
    await waitFor(() => expect(pendingFrames.size).toBe(1));
    show(VIEW_ALL, 1);
    flushFrame(1000);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      EDITED,
      "front-idle",
      0,
      FEET_X,
      FEET_Y,
    );
    expect(roomCanvas()).toHaveAttribute("data-ready", "true");
  });

  it("clears a failed load when the appearance changes", async () => {
    loadSheetCanvas.mockRejectedValueOnce(
      new Error('Failed to load sprite sheet image "plant"'),
    );
    renderSwitchable(APPEARANCE);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    act(() => switchTo(EDITED));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await waitFor(() => expect(pendingFrames.size).toBe(1));
    show(VIEW_ALL, 1);
    flushFrame(0);
    expect(roomCanvas()).toBeVisible();
    expect(roomCanvas()).toHaveAccessibleName(describeAppearance(EDITED));
    expect(roomCanvas()).toHaveAttribute("data-ready", "true");
  });

  it("passes the world size and home center to useWorldCanvas", async () => {
    await mountScene(APPEARANCE);
    // treadmill-corner is x 140..239 in the fixture world.
    expect(world.size).toEqual({ width: 340, height: 80, homeX: 190 });
  });

  it("draws through the camera and skips sprites outside it", async () => {
    await mountScene(APPEARANCE);
    show(VIEW_PART, 1);
    flushFrame(0);
    // Art x 0..100: door-left, trophy-wall and its six trophies and medals.
    expect(ctx.drawImage).toHaveBeenCalledTimes(8);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, -0, -0);

    // Scroll: camera at 300 device px is art x 150..250.
    world.camera.current = 300;
    ctx.drawImage.mockClear();
    flushFrame(16);
    // treadmill-corner, mirror-corner, treadmill.
    expect(ctx.drawImage).toHaveBeenCalledTimes(3);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, -300, -0);
    expect(drawAvatar).toHaveBeenLastCalledWith(
      ctx,
      AVATAR_SHEETS,
      APPEARANCE,
      "front-idle",
      0,
      FEET_X,
      FEET_Y,
    );
  });

  it("shows the mirror link only once the room has drawn, and it opens the creator", async () => {
    const { router } = await mountScene(APPEARANCE);
    expect(
      screen.queryByRole("link", { name: "Mirror: edit avatar" }),
    ).not.toBeInTheDocument();

    show(VIEW_ALL, 1);
    flushFrame(0);
    const mirror = screen.getByRole("link", { name: "Mirror: edit avatar" });
    // Hotspot (260, 10) 20x60 at k 1: grown to 44 wide about its center.
    expect(mirror).toHaveStyle({
      left: "248px",
      top: "10px",
      width: "44px",
      height: "60px",
    });

    fireEvent.click(mirror);
    expect(
      await screen.findByRole("heading", { name: "Creator stub" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/create");
  });

  it("lists the places as dots with home current, and a dot scrolls to its place", async () => {
    const scrollTo = vi.fn();
    if ("scrollTo" in Element.prototype) {
      vi.spyOn(Element.prototype, "scrollTo").mockImplementation(scrollTo);
    } else {
      // jsdom has no Element.scrollTo: define it for this test only.
      Object.defineProperty(Element.prototype, "scrollTo", {
        configurable: true,
        writable: true,
        value: scrollTo,
      });
      restoreScrollTo = () => {
        Reflect.deleteProperty(Element.prototype, "scrollTo");
      };
    }
    await mountScene(APPEARANCE);
    show(VIEW_PART, 1);
    flushFrame(0);

    const dots = within(
      screen.getByRole("navigation", { name: "Places" }),
    ).getAllByRole("button");
    expect(dots.map((d) => d.getAttribute("aria-label"))).toEqual([
      "Left door",
      "Trophy wall",
      "Treadmill",
      "Mirror",
      "Right door",
    ]);
    expect(screen.getByRole("button", { name: "Treadmill" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Mirror" }));
    // Mirror center 270 at k 2 on a 200 px screen: camera 440, max 480.
    expect(scrollTo).toHaveBeenCalledWith({ left: 440, behavior: "smooth" });

    const scroller = screen.getByRole("region", { name: "Room" });
    act(() => {
      scroller.scrollLeft = 440;
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByRole("button", { name: "Mirror" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("snaps one place per swipe only when the screen is narrower than two places", async () => {
    await mountScene(APPEARANCE);
    show(VIEW_PART, 1); // 100 art px visible; narrowest place 40: no snap
    const scroller = screen.getByRole("region", { name: "Room" });
    expect(scroller).not.toHaveClass("snap-mandatory");
    show({ k: 4, dpr: 1, backingW: 200, backingH: 320, camY: 0 }, 2); // 50 < 80
    expect(scroller).toHaveClass("snap-x", "snap-mandatory");
  });

  it("makes the track as wide as the world at the current scale", async () => {
    await mountScene(APPEARANCE);
    show(VIEW_PART, 1);
    const track = screen.getByRole("img", { hidden: true }).parentElement;
    expect(track).toHaveStyle({ width: "680px" });
  });
});
