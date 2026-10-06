import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { AvatarAppearance } from "@tracks/types";
import type { SheetData } from "../../avatar/sheets.js";

const { loadSheetCanvas, loadAvatarSheets, drawAvatar, captureException } =
  vi.hoisted(() => ({
    loadSheetCanvas: vi.fn(),
    loadAvatarSheets: vi.fn(),
    drawAvatar: vi.fn(),
    captureException: vi.fn(),
  }));

vi.mock("@sentry/react", () => ({ captureException }));

// The same module paths RoomScene imports: no image is decoded and nothing is drawn.
vi.mock("../../avatar/canvas.js", () => ({
  loadSheetCanvas,
  loadAvatarSheets,
  drawAvatar,
}));

// Plain refs and no view: no ResizeObserver, no matchMedia, no getContext.
vi.mock("../useWorldCanvas.js", async () => {
  const { useRef } = await import("react");
  return {
    useWorldCanvas: () => ({
      scrollerRef: useRef<HTMLDivElement | null>(null),
      canvasRef: useRef<HTMLCanvasElement | null>(null),
      cameraRef: useRef(0),
      view: null,
      generation: 0,
    }),
  };
});

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

import { RoomScene } from "../RoomScene.js";

const APPEARANCE: AvatarAppearance = {
  skin_tone: "tone-3",
  hair_style: "curly",
  hair_color: "auburn",
  top: "starter-tee-blue",
  bottom: "starter-shorts-black",
  shoes: "starter-shoes-red",
};

describe("RoomScene when a sprite sheet fails to load", () => {
  let requestFrame = vi.fn((_callback: FrameRequestCallback): number => 1);

  beforeEach(() => {
    requestFrame = vi.fn((_callback: FrameRequestCallback): number => 1);
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    captureException.mockReset();
    drawAvatar.mockReset();
    loadSheetCanvas
      .mockReset()
      .mockResolvedValue(document.createElement("canvas"));
    loadAvatarSheets.mockReset().mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: "an avatar layer sheet",
      fail: (error: Error) => loadAvatarSheets.mockRejectedValue(error),
      error: new Error('Failed to load sprite sheet image "hair-curly"'),
    },
    {
      name: "a room sheet",
      fail: (error: Error) => loadSheetCanvas.mockRejectedValue(error),
      error: new Error('Failed to load sprite sheet image "treadmill"'),
    },
  ])(
    "shows the error and never sets data-ready when $name fails",
    async ({ fail, error }) => {
      // Not mocked: a call would reach jsdom and print "Not implemented".
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
      fail(error);

      const router = createMemoryRouter([
        { path: "/", element: <RoomScene appearance={APPEARANCE} /> },
      ]);
      render(<RouterProvider router={router} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't load the room.",
      );
      expect(screen.getByRole("button", { name: "Retry" })).toHaveClass(
        "min-h-11",
      );
      expect(captureException).toHaveBeenCalledWith(error);
      const canvas = screen.getByRole("img", { hidden: true });
      expect(canvas).not.toHaveAttribute("data-ready", "true");
      expect(canvas).not.toHaveAttribute("data-ready");
      expect(canvas).not.toBeVisible();
      expect(getContext).not.toHaveBeenCalled();
      expect(requestFrame).not.toHaveBeenCalled();
      expect(drawAvatar).not.toHaveBeenCalled();
    },
  );
});
