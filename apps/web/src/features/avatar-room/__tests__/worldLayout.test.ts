import { describe, expect, it } from "vitest";
import { layoutWorld, slotAlignment, spriteFrame, type PlacedSprite } from "../roomLayout.js";
import { AVATAR_SPOT, WORLD, type PlaceDef } from "../world.js";
import { BELT, MIRROR_SLICES, RIDER, roomRegistry, sheet, SHELF_SLOTS, slice } from "./roomFixtures.js";

function placed(sprites: PlacedSprite[], id: string): PlacedSprite | undefined {
  return sprites.find((s) => s.sheet === id);
}

function withPlace(id: PlaceDef["id"], change: Partial<PlaceDef>): PlaceDef[] {
  return WORLD.map((p) => (p.id === id ? { ...p, ...change } : p));
}

describe("slotAlignment", () => {
  it("hangs the frame and medals and stands everything else", () => {
    expect(slotAlignment("frame")).toBe("hanging");
    expect(slotAlignment("medal-2")).toBe("hanging");
    expect(slotAlignment("trophy-1")).toBe("standing");
    expect(slotAlignment("equipment")).toBe("standing");
    expect(slotAlignment("decor")).toBe("standing");
  });

  it("rejects an unknown slot kind", () => {
    expect(() => slotAlignment("shelf")).toThrow('Unknown slot kind "shelf"');
  });
});

describe("layoutWorld", () => {
  const registry = roomRegistry();
  const layout = layoutWorld(WORLD, AVATAR_SPOT, registry);

  it("lays the places out left to right and takes the size from the art", () => {
    expect(layout.width).toBe(340);
    expect(layout.height).toBe(80);
    expect(layout.places).toEqual([
      { id: "door-left", label: "Left door", x: 0, w: 40 },
      { id: "trophy-wall", label: "Trophy wall", x: 40, w: 100 },
      { id: "treadmill-corner", label: "Treadmill", x: 140, w: 100 },
      { id: "mirror-corner", label: "Mirror", x: 240, w: 60 },
      { id: "door-right", label: "Right door", x: 300, w: 40 },
    ]);
  });

  it("draws every place, then each place's items, in order", () => {
    expect(layout.sprites.map((s) => s.sheet)).toEqual([
      "place-door-left",
      "place-trophy-wall",
      "place-treadmill-corner",
      "place-mirror-corner",
      "place-door-right",
      "frame-bib",
      "trophy-gold",
      "trophy-silver",
      "trophy-bronze",
      "medal-gold",
      "medal-silver",
      "medal-bronze",
      "treadmill",
    ]);
    expect(placed(layout.sprites, "place-treadmill-corner")).toEqual({
      sheet: "place-treadmill-corner",
      x: 140,
      y: 0,
      animated: false,
    });
  });

  it("places items in world coordinates, standing or hanging by slot kind", () => {
    // trophy-wall starts at x 40. frame (70, 12) 24x30, frame-bib 20x26: hangs.
    expect(placed(layout.sprites, "frame-bib")).toMatchObject({ x: 112, y: 12 });
    // trophy-1 (10, 20) 16x18, trophy-gold 10x14: stands.
    expect(placed(layout.sprites, "trophy-gold")).toMatchObject({ x: 53, y: 24 });
    // An odd leftover rounds left: 40 + 30 + floor(7 / 2).
    expect(placed(layout.sprites, "trophy-silver")).toMatchObject({ x: 73, y: 26 });
    expect(placed(layout.sprites, "medal-silver")).toMatchObject({ x: 66, y: 45 });
    // treadmill-corner starts at x 140. equipment (10, 25) 80x50, treadmill 72x40.
    expect(placed(layout.sprites, "treadmill")).toMatchObject({ x: 154, y: 35, animated: true });
  });

  it("animates only the equipment the avatar stands on", () => {
    expect(layout.sprites.filter((s) => s.animated).map((s) => s.sheet)).toEqual(["treadmill"]);
  });

  it("puts the avatar feet on the rider pivot", () => {
    // (154, 35) + rider bounds (20, 10) + pivot (12, 23)
    expect(layout.avatarFeet).toEqual({ x: 186, y: 68 });
  });

  it("finds hotspots from hotspot-* slices, in world coordinates", () => {
    expect(layout.hotspots).toEqual([{ id: "mirror", x: 260, y: 10, w: 20, h: 60 }]);
  });

  it("stands a decor item in the mirror corner when one is listed", () => {
    const world = withPlace("mirror-corner", { items: [{ slot: "decor", sheet: "plant" }] });
    // decor (40, 30) 16x45 at x 240, plant 14x30
    expect(placed(layoutWorld(world, AVATAR_SPOT, registry).sprites, "plant")).toMatchObject({
      x: 281,
      y: 45,
    });
  });

  it("throws on places of different heights", () => {
    const short = sheet("place-mirror-corner", 60, 70, { slices: MIRROR_SLICES });
    expect(() => layoutWorld(WORLD, AVATAR_SPOT, roomRegistry([short]))).toThrow(
      /place-mirror-corner.*70/,
    );
  });

  it("throws naming the slice when a place lacks an item's slot", () => {
    const shelf = sheet("place-trophy-wall", 100, 80, {
      slices: SHELF_SLOTS.filter((s) => s.name !== "medal-3"),
    });
    expect(() => layoutWorld(WORLD, AVATAR_SPOT, roomRegistry([shelf]))).toThrow("medal-3");
  });

  it("throws on a hotspot slice that is not a known hotspot", () => {
    const mirror = sheet("place-mirror-corner", 60, 80, {
      slices: [...MIRROR_SLICES, slice("hotspot-window", 0, 0, 5, 5)],
    });
    expect(() => layoutWorld(WORLD, AVATAR_SPOT, roomRegistry([mirror]))).toThrow("hotspot-window");
  });

  it("throws naming the sheet when an item has no exported sheet", () => {
    const world = withPlace("mirror-corner", { items: [{ slot: "decor", sheet: "cactus" }] });
    expect(() => layoutWorld(world, AVATAR_SPOT, registry)).toThrow("cactus");
  });

  it("throws when the avatar spot's place is not in the world", () => {
    const world = WORLD.filter((p) => p.id !== "treadmill-corner");
    expect(() => layoutWorld(world, AVATAR_SPOT, registry)).toThrow("treadmill-corner");
  });

  it("throws when the avatar spot's slot is empty", () => {
    const world = withPlace("treadmill-corner", { items: [] });
    expect(() => layoutWorld(world, AVATAR_SPOT, registry)).toThrow(/no item in slot "equipment"/);
  });

  it("throws on an empty world", () => {
    expect(() => layoutWorld([], AVATAR_SPOT, registry)).toThrow("no places");
  });

  it.each([
    ["no rider slice", sheet("treadmill", 72, 40, { frames: 4, tags: [BELT] }), "rider"],
    [
      "a rider without a pivot",
      sheet("treadmill", 72, 40, { frames: 4, tags: [BELT], slices: [slice("rider", 20, 10, 24, 24)] }),
      /rider.*pivot/,
    ],
    ["no belt tag", sheet("treadmill", 72, 40, { frames: 4, slices: [RIDER] }), "belt"],
  ])("throws when the equipment has %s", (_name, treadmill, message) => {
    expect(() => layoutWorld(WORLD, AVATAR_SPOT, roomRegistry([treadmill]))).toThrow(message);
  });
});

describe("spriteFrame", () => {
  const registry = roomRegistry();
  const { sprites } = layoutWorld(
    withPlace("mirror-corner", { items: [{ slot: "decor", sheet: "plant" }] }),
    AVATAR_SPOT,
    registry,
  );
  const plant = placed(sprites, "plant");
  const treadmill = placed(sprites, "treadmill");
  if (!plant || !treadmill) throw new Error("fixture layout is missing the plant or treadmill");

  it("uses frame 0 for a static sprite in every state", () => {
    const frame0 = { x: 0, y: 0, w: 14, h: 30, duration: 100 };
    expect(spriteFrame(plant, "front-idle", 0, registry)).toEqual(frame0);
    expect(spriteFrame(plant, "side-run", 2, registry)).toEqual(frame0);
  });

  it("draws belt frame i with side-run frame i", () => {
    // belt offset 0 is sheet frame 1 and offset 2 is sheet frame 3
    expect(spriteFrame(treadmill, "side-run", 0, registry)).toMatchObject({ x: 72 });
    expect(spriteFrame(treadmill, "side-run", 2, registry)).toMatchObject({ x: 216 });
  });

  it.each(["front-idle", "turn"] as const)("shows belt frame 0 during %s", (tag) => {
    expect(spriteFrame(treadmill, tag, 3, registry)).toMatchObject({ x: 72 });
  });

  it("throws when the run offset is past the end of the belt", () => {
    expect(() => spriteFrame(treadmill, "side-run", 3, registry)).toThrow("belt");
  });
});
