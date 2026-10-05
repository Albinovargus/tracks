import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { AvatarAppearance } from "@tracks/types";
import type { LoadedSheets } from "../../avatar/canvas.js";
import type { SheetData } from "../../avatar/sheets.js";

const {
  loadSheetCanvas,
  loadAvatarSheets,
  drawAvatar,
  captureException,
  pixel,
} = vi.hoisted(() => ({
  loadSheetCanvas: vi.fn(),
  loadAvatarSheets: vi.fn(),
  drawAvatar: vi.fn(),
  captureException: vi.fn(),
  // The mocked usePixelCanvas publishes its setter here so a test can play a resize.
  pixel: { setGeneration: (_generation: number): void => {} },
}));

vi.mock("@sentry/react", () => ({ captureException }));

// jsdom cannot decode images or draw (.claude/CLAUDE.md rule 26), so the canvas adapter is faked.
vi.mock("../../avatar/canvas.js", () => ({
  loadSheetCanvas,
  loadAvatarSheets,
  drawAvatar,
}));

// jsdom has no ResizeObserver or matchMedia: generation stays 0 until a test calls resize().
vi.mock("../../avatar/usePixelCanvas.js", async () => {
  const { useRef, useState } = await import("react");
  return {
    usePixelCanvas: () => {
      const stageRef = useRef<HTMLDivElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const [generation, setGeneration] = useState(0);
      pixel.setGeneration = setGeneration;
      return { stageRef, canvasRef, scale: 1, generation };
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
// The fixture treadmill stands at (64, 70), so its rider pivot puts the feet at (96, 103).
const FEET_X = 96;
const FEET_Y = 103;

const ctx = { clearRect: vi.fn(), drawImage: vi.fn() };
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

/** Plays a usePixelCanvas resize: the canvas is cleared and the generation moves on. */
function resize(generation: number): void {
  act(() => pixel.setGeneration(generation));
}

/** Renders the scene and waits for its sheets to load, which starts the rAF loop. */
async function mountScene(appearance: AvatarAppearance) {
  const view = render(<RoomScene appearance={appearance} />);
  await waitFor(() => expect(pendingFrames.size).toBe(1));
  return view;
}

/** The scene's one canvas, found even while it is hidden behind the error message. */
function roomCanvas(): HTMLElement {
  return screen.getByRole("img", { hidden: true });
}

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
    drawAvatar.mockReset();
    captureException.mockReset();
    loadSheetCanvas
      .mockReset()
      .mockResolvedValue(document.createElement("canvas"));
    loadAvatarSheets.mockReset().mockResolvedValue(AVATAR_SHEETS);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sets data-ready only once the first frame is drawn on a sized canvas", async () => {
    await mountScene(APPEARANCE);
    expect(roomCanvas()).toHaveAccessibleName(describeAppearance(APPEARANCE));
    expect(roomCanvas()).not.toHaveAttribute("data-ready");

    // Generation 0: usePixelCanvas has not sized the canvas, and its first resize would wipe a frame.
    flushFrame(0);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    expect(roomCanvas()).not.toHaveAttribute("data-ready");

    resize(1);
    flushFrame(16);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(10);
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
    resize(1);
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
    resize(2);
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
    resize(1);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(roomCanvas()).toHaveAttribute("data-ready", "true");

    flushFrame(0);
    flushFrame(116);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);

    // No rAF tick in between: the wiped canvas is repainted at once with the same frame.
    resize(2);
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
    resize(1);
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
    render(<RoomScene appearance={APPEARANCE} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the room. Refresh the page to try again.",
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
    resize(1);
    flushFrame(0);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the room.",
    );
    expect(captureException).toHaveBeenCalledWith(error);
    expect(roomCanvas()).not.toHaveAttribute("data-ready");
    expect(pendingFrames.size).toBe(0);
  });

  it("drops data-ready while a new appearance loads", async () => {
    const { rerender } = await mountScene(APPEARANCE);
    resize(1);
    flushFrame(0);
    expect(roomCanvas()).toHaveAttribute("data-ready", "true");

    let finishLoad: (sheets: LoadedSheets) => void = () => {};
    loadAvatarSheets.mockReturnValueOnce(
      new Promise<LoadedSheets>((resolve) => {
        finishLoad = resolve;
      }),
    );
    rerender(<RoomScene appearance={EDITED} />);

    expect(roomCanvas()).toHaveAccessibleName(describeAppearance(EDITED));
    expect(roomCanvas()).not.toHaveAttribute("data-ready");
    // The old look's loop has stopped and the new one waits for its sheets.
    expect(pendingFrames.size).toBe(0);
    expect(loadAvatarSheets).toHaveBeenLastCalledWith(EDITED);

    finishLoad(AVATAR_SHEETS);
    await waitFor(() => expect(pendingFrames.size).toBe(1));
    resize(1);
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
    const { rerender } = render(<RoomScene appearance={APPEARANCE} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    rerender(<RoomScene appearance={EDITED} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await waitFor(() => expect(pendingFrames.size).toBe(1));
    resize(1);
    flushFrame(0);
    expect(roomCanvas()).toBeVisible();
    expect(roomCanvas()).toHaveAccessibleName(describeAppearance(EDITED));
    expect(roomCanvas()).toHaveAttribute("data-ready", "true");
  });
});
