import { describe, expect, it } from "vitest";
import {
  cameraX,
  centerWorldX,
  hotspotBox,
  maxCameraX,
  nearestPlace,
  overlaps,
  scrollLeftCentering,
  shouldSnap,
  viewFor,
  type WorldView,
} from "../camera.js";

const W = 630;
const H = 270;
/** The spec's places: door, trophy wall, treadmill corner (home), mirror corner, door. */
const PLACES = [
  { x: 0, w: 120 },
  { x: 120, w: 130 },
  { x: 250, w: 130 },
  { x: 380, w: 130 },
  { x: 510, w: 120 },
];
const HOME_CENTER = 315;

const IPHONE_14 = viewFor(1170, 2532, 3, W, H);
const DESKTOP = viewFor(1280, 800, 1, W, H);
const PIXEL_7 = viewFor(1082, 2402, 2.625, W, H);

describe("viewFor", () => {
  it("bottom-anchors the world: camY is the device px cropped off the top", () => {
    expect(IPHONE_14).toEqual({ k: 10, dpr: 3, backingW: 1170, backingH: 2532, camY: 168 });
    expect(DESKTOP).toEqual({ k: 3, dpr: 1, backingW: 1280, backingH: 800, camY: 10 });
  });
});

describe("cameraX", () => {
  it("is the scroll offset in whole device px", () => {
    expect(cameraX(100.2, IPHONE_14, W)).toBe(301);
    // Fractional DPR: 100 CSS px * 2.625 = 262.5 rounds to 263.
    expect(cameraX(100, PIXEL_7, W)).toBe(263);
    expect(Number.isInteger(cameraX(33.3, PIXEL_7, W))).toBe(true);
  });

  it("clamps to the world at both ends", () => {
    expect(maxCameraX(IPHONE_14, W)).toBe(5130);
    expect(cameraX(-5, IPHONE_14, W)).toBe(0);
    expect(cameraX(5000, IPHONE_14, W)).toBe(5130);
  });
});

describe("scrollLeftCentering and centerWorldX", () => {
  it("centers a world x in the viewport", () => {
    // camX = 315 * 10 - 1170 / 2 = 2565 device px = 855 CSS px
    expect(scrollLeftCentering(HOME_CENTER, IPHONE_14, W)).toBe(855);
    expect(scrollLeftCentering(HOME_CENTER, DESKTOP, W)).toBe(305);
    expect(centerWorldX(2565, IPHONE_14)).toBe(315);
  });

  it("clamps to the scroll range near the world's ends", () => {
    expect(scrollLeftCentering(0, IPHONE_14, W)).toBe(0);
    expect(scrollLeftCentering(W, IPHONE_14, W)).toBe(5130 / 3);
  });

  it("round-trips through cameraX", () => {
    const left = scrollLeftCentering(HOME_CENTER, PIXEL_7, W);
    const camX = cameraX(left, PIXEL_7, W);
    expect(Math.abs(centerWorldX(camX, PIXEL_7) - HOME_CENTER)).toBeLessThan(1 / PIXEL_7.k);
  });
});

describe("shouldSnap", () => {
  it("snaps when the screen shows less than two of the narrowest place", () => {
    expect(shouldSnap(IPHONE_14, PLACES)).toBe(true); // 117 art px visible
    expect(shouldSnap(viewFor(1640, 2360, 2, W, H), PLACES)).toBe(true); // iPad portrait, 182
    expect(shouldSnap(DESKTOP, PLACES)).toBe(false); // 427
    expect(shouldSnap(viewFor(2532, 1170, 3, W, H), PLACES)).toBe(false); // landscape phone, 506
  });

  it("never snaps an empty world", () => {
    expect(shouldSnap(IPHONE_14, [])).toBe(false);
  });
});

describe("nearestPlace", () => {
  it("picks the place whose center is nearest", () => {
    expect(nearestPlace(HOME_CENTER, PLACES)).toBe(2);
    expect(nearestPlace(0, PLACES)).toBe(0);
    expect(nearestPlace(W, PLACES)).toBe(4);
    expect(nearestPlace(185, PLACES)).toBe(1);
  });
});

describe("overlaps", () => {
  it("is true only when the rects share area", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(overlaps(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false); // touching edges
    expect(overlaps(a, { x: -5, y: 20, w: 30, h: 5 })).toBe(false);
  });
});

describe("hotspotBox", () => {
  it("maps an art rect to CSS px under the bottom-anchored camera", () => {
    const box = hotspotBox({ x: 400, y: 180, w: 24, h: 70 }, IPHONE_14);
    expect(box.left).toBeCloseTo(1333.333, 2);
    expect(box.top).toBe(544); // (1800 - 168) / 3
    expect(box.width).toBe(80);
    expect(box.height).toBeCloseTo(233.333, 2);
  });

  it("grows a small rect evenly about its center to 44x44 CSS px", () => {
    const view: WorldView = DESKTOP; // k 3, dpr 1, camY 10
    expect(hotspotBox({ x: 30, y: 200, w: 6, h: 6 }, view)).toEqual({
      left: 77,
      top: 577,
      width: 44,
      height: 44,
    });
  });
});
