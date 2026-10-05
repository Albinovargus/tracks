import { describe, expect, it } from "vitest";
import { layoutRoom, spriteFrame, type PlacedSprite } from "../roomLayout.js";
import { SAMPLE_ROOM, type SampleRoom } from "../sampleRoom.js";
import {
  BELT,
  RIDER,
  SLOTS,
  roomRegistry,
  sheet,
  slice,
} from "./roomFixtures.js";

function placed(sprites: PlacedSprite[], id: string): PlacedSprite | undefined {
  return sprites.find((s) => s.sheet === id);
}

describe("layoutRoom", () => {
  it("lists sprites in draw order: background, frame, trophies, medals, plant, treadmill", () => {
    const { sprites } = layoutRoom(SAMPLE_ROOM, roomRegistry());
    expect(sprites.map((s) => s.sheet)).toEqual([
      "background",
      "frame-bib",
      "trophy-gold",
      "trophy-silver",
      "trophy-bronze",
      "medal-gold",
      "medal-silver",
      "medal-bronze",
      "plant",
      "treadmill",
    ]);
  });

  it("draws the background at the origin and animates only the treadmill", () => {
    const { sprites } = layoutRoom(SAMPLE_ROOM, roomRegistry());
    expect(sprites[0]).toEqual({
      sheet: "background",
      x: 0,
      y: 0,
      animated: false,
    });
    expect(sprites.filter((s) => s.animated).map((s) => s.sheet)).toEqual([
      "treadmill",
    ]);
  });

  it("stands trophies, the plant and the treadmill bottom-centered on their slice bottom edge", () => {
    const { sprites } = layoutRoom(SAMPLE_ROOM, roomRegistry());
    // trophy-1 is (10, 20) 16x18 and trophy-gold is 10x14: x = 10 + (16 - 10) / 2, y = 20 + 18 - 14
    expect(placed(sprites, "trophy-gold")).toMatchObject({ x: 13, y: 24 });
    // An odd leftover rounds down: x = 30 + floor((16 - 9) / 2)
    expect(placed(sprites, "trophy-silver")).toMatchObject({ x: 33, y: 26 });
    expect(placed(sprites, "trophy-bronze")).toMatchObject({ x: 54, y: 28 });
    // decor is (150, 70) 20x40 and plant is 14x30
    expect(placed(sprites, "plant")).toMatchObject({ x: 153, y: 80 });
    // equipment is (60, 60) 80x50 and treadmill is 72x40
    expect(placed(sprites, "treadmill")).toMatchObject({ x: 64, y: 70 });
  });

  it("hangs the frame and medals top-centered from their slice top edge", () => {
    const { sprites } = layoutRoom(SAMPLE_ROOM, roomRegistry());
    // frame is (70, 12) 24x30 and frame-bib is 20x26
    expect(placed(sprites, "frame-bib")).toMatchObject({ x: 72, y: 12 });
    // medal-1 is (100, 10) 12x20 and medal-gold is 8x12
    expect(placed(sprites, "medal-gold")).toMatchObject({ x: 102, y: 10 });
    expect(placed(sprites, "medal-silver")).toMatchObject({ x: 116, y: 10 });
    expect(placed(sprites, "medal-bronze")).toMatchObject({ x: 130, y: 10 });
  });

  it("puts the avatar feet on the treadmill rider pivot", () => {
    // treadmill drawn at (64, 70) + rider bounds (20, 10) + pivot (12, 23)
    expect(layoutRoom(SAMPLE_ROOM, roomRegistry()).avatarFeet).toEqual({
      x: 96,
      y: 103,
    });
  });

  it("fills slots in order from the room contents", () => {
    const room: SampleRoom = {
      ...SAMPLE_ROOM,
      trophies: ["trophy-bronze"],
      medals: [],
    };
    const { sprites } = layoutRoom(room, roomRegistry());
    expect(sprites.map((s) => s.sheet)).toEqual([
      "background",
      "frame-bib",
      "trophy-bronze",
      "plant",
      "treadmill",
    ]);
    // trophy-bronze (8x10) now stands in trophy-1, (10, 20) 16x18
    expect(placed(sprites, "trophy-bronze")).toMatchObject({ x: 14, y: 28 });
  });

  it("throws naming the slice when the background lacks a slot", () => {
    const background = sheet("background", 180, 120, {
      slices: SLOTS.filter((s) => s.name !== "medal-3"),
    });
    expect(() => layoutRoom(SAMPLE_ROOM, roomRegistry([background]))).toThrow(
      "medal-3",
    );
  });

  it("throws naming the sheet when an item has no exported sheet", () => {
    const room: SampleRoom = { ...SAMPLE_ROOM, decor: "cactus" };
    expect(() => layoutRoom(room, roomRegistry())).toThrow("cactus");
  });

  it("throws when the equipment has no rider slice", () => {
    const treadmill = sheet("treadmill", 72, 40, { frames: 4, tags: [BELT] });
    expect(() => layoutRoom(SAMPLE_ROOM, roomRegistry([treadmill]))).toThrow(
      "rider",
    );
  });

  it("throws when the rider slice has no pivot", () => {
    const treadmill = sheet("treadmill", 72, 40, {
      frames: 4,
      tags: [BELT],
      slices: [slice("rider", 20, 10, 24, 24)],
    });
    expect(() => layoutRoom(SAMPLE_ROOM, roomRegistry([treadmill]))).toThrow(
      /rider.*pivot/,
    );
  });

  it("throws when the equipment has no belt tag", () => {
    const treadmill = sheet("treadmill", 72, 40, {
      frames: 4,
      slices: [RIDER],
    });
    expect(() => layoutRoom(SAMPLE_ROOM, roomRegistry([treadmill]))).toThrow(
      "belt",
    );
  });
});

describe("spriteFrame", () => {
  const registry = roomRegistry();
  const { sprites } = layoutRoom(SAMPLE_ROOM, registry);
  const plant = placed(sprites, "plant");
  const treadmill = placed(sprites, "treadmill");
  if (!plant || !treadmill)
    throw new Error("fixture layout is missing the plant or treadmill");

  it("uses frame 0 for a static sprite in every state", () => {
    const frame0 = { x: 0, y: 0, w: 14, h: 30, duration: 100 };
    expect(spriteFrame(plant, "front-idle", 0, registry)).toEqual(frame0);
    expect(spriteFrame(plant, "side-run", 2, registry)).toEqual(frame0);
  });

  it("draws belt frame i with side-run frame i", () => {
    // belt offset 0 is sheet frame 1 and offset 2 is sheet frame 3
    expect(spriteFrame(treadmill, "side-run", 0, registry)).toMatchObject({
      x: 72,
    });
    expect(spriteFrame(treadmill, "side-run", 2, registry)).toMatchObject({
      x: 216,
    });
  });

  it.each(["front-idle", "turn"] as const)(
    "shows belt frame 0 during %s",
    (tag) => {
      expect(spriteFrame(treadmill, tag, 3, registry)).toMatchObject({ x: 72 });
    },
  );

  it("throws when the run offset is past the end of the belt", () => {
    expect(() => spriteFrame(treadmill, "side-run", 3, registry)).toThrow(
      "belt",
    );
  });
});
