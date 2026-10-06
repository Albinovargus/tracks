import { tagFrames, type AnimationTag } from "../avatar/frames.js";
import {
  getSheet,
  SHEETS,
  type SheetData,
  type SheetFrame,
  type SheetId,
  type SheetSlice,
} from "../avatar/sheets.js";
import {
  AVATAR_SPOT,
  HotspotIdSchema,
  WORLD,
  type AvatarSpot,
  type HotspotId,
  type PlaceDef,
  type PlaceId,
} from "./world.js";

export interface PlacedSprite {
  sheet: SheetId;
  /** Top-left draw position in world px. */
  x: number;
  y: number;
  /** True for the equipment: it plays its `belt` tag in step with the run. */
  animated: boolean;
}

type Registry = ReadonlyMap<SheetId, SheetData>;
type Alignment = "standing" | "hanging";

const RIDER_SLICE = "rider";
const BELT_TAG = "belt";

function findSlice(sheet: SheetData, name: string): SheetSlice {
  const found = sheet.slices.find((s) => s.name === name);
  if (!found) throw new Error(`Sheet "${sheet.id}" has no slice "${name}"`);
  return found;
}

function firstFrame(sheet: SheetData): SheetFrame {
  const frame = sheet.frames[0];
  if (!frame) throw new Error(`Sheet "${sheet.id}" has no frames`);
  return frame;
}

/**
 * Standing items sit bottom-centered on the slot's bottom edge; hanging items
 * hang top-centered from its top edge. An odd leftover rounds to the left.
 */
function place(
  id: SheetId,
  slot: SheetSlice,
  alignment: Alignment,
  registry: Registry,
  animated = false,
): PlacedSprite {
  const item = firstFrame(getSheet(id, registry));
  return {
    sheet: id,
    x: slot.x + Math.floor((slot.w - item.w) / 2),
    y: alignment === "standing" ? slot.y + slot.h - item.h : slot.y,
    animated,
  };
}

/**
 * Pure: the sheet rect to draw for a placed sprite. Static sprites use frame 0.
 * The animated equipment shows belt frame i with side-run frame i, and belt
 * frame 0 in every other tag.
 */
export function spriteFrame(
  sprite: PlacedSprite,
  tag: AnimationTag,
  frameOffset: number,
  registry: Registry = SHEETS,
): SheetFrame {
  const sheet = getSheet(sprite.sheet, registry);
  if (!sprite.animated) return firstFrame(sheet);
  const offset = tag === "side-run" ? frameOffset : 0;
  const index = tagFrames(sheet, BELT_TAG)[offset]?.index;
  const rect = index === undefined ? undefined : sheet.frames[index];
  if (!rect)
    throw new Error(`Sheet "${sheet.id}" has no "${BELT_TAG}" frame ${offset}`);
  return rect;
}

export interface WorldPlace {
  id: PlaceId;
  label: string;
  /** Left edge in world px. */
  x: number;
  w: number;
}

export interface Hotspot {
  id: HotspotId;
  /** World px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldLayout {
  /** Sum of the place widths, in art px. */
  width: number;
  /** The shared place height, in art px. */
  height: number;
  places: WorldPlace[];
  /** Draw order: every place left to right, then each place's items in its `items` order. */
  sprites: PlacedSprite[];
  hotspots: Hotspot[];
  /** Where the avatar cell's anchor pixel (32, 63) goes, in world px. */
  avatarFeet: { x: number; y: number };
}

const HOTSPOT_PREFIX = "hotspot-";

/** Hanging items hang top-center from their slot; the other known kinds stand bottom-center. */
export function slotAlignment(slot: string): Alignment {
  if (slot === "frame" || /^medal-\d+$/.test(slot)) return "hanging";
  if (slot === "equipment" || slot === "decor" || /^trophy-\d+$/.test(slot)) return "standing";
  throw new Error(`Unknown slot kind "${slot}"`);
}

/** The foot point on equipment placed at `sprite`: its rider slice pivot, in world px. */
function equipmentFeet(sprite: PlacedSprite, registry: Registry): { x: number; y: number } {
  const equipment = getSheet(sprite.sheet, registry);
  if (!equipment.tags.some((t) => t.name === BELT_TAG)) {
    throw new Error(`Sheet "${equipment.id}" has no "${BELT_TAG}" tag`);
  }
  const rider = findSlice(equipment, RIDER_SLICE);
  if (!rider.pivot) {
    throw new Error(`Slice "${RIDER_SLICE}" in sheet "${equipment.id}" has no pivot`);
  }
  return { x: sprite.x + rider.x + rider.pivot.x, y: sprite.y + rider.y + rider.pivot.y };
}

/** Pure: lays the world's places out left to right and positions every sprite and hotspot. */
export function layoutWorld(
  world: readonly PlaceDef[] = WORLD,
  spot: AvatarSpot = AVATAR_SPOT,
  registry: Registry = SHEETS,
): WorldLayout {
  const first = world[0];
  if (first === undefined) throw new Error("The world has no places");
  if (!world.some((p) => p.id === spot.place)) {
    throw new Error(`The avatar spot names place "${spot.place}", which is not in the world`);
  }
  const height = firstFrame(getSheet(first.sheet, registry)).h;
  const places: WorldPlace[] = [];
  const backgrounds: PlacedSprite[] = [];
  const items: PlacedSprite[] = [];
  const hotspots: Hotspot[] = [];
  let avatarFeet: { x: number; y: number } | null = null;
  let x = 0;

  for (const def of world) {
    const sheet = getSheet(def.sheet, registry);
    const frame = firstFrame(sheet);
    if (frame.h !== height) {
      throw new Error(
        `Place sheet "${sheet.id}" is ${frame.h} px tall; every place must be ${height} px tall`,
      );
    }
    places.push({ id: def.id, label: def.label, x, w: frame.w });
    backgrounds.push({ sheet: def.sheet, x, y: 0, animated: false });

    for (const s of sheet.slices) {
      if (!s.name.startsWith(HOTSPOT_PREFIX)) continue;
      const id = HotspotIdSchema.safeParse(s.name.slice(HOTSPOT_PREFIX.length));
      if (!id.success) {
        throw new Error(`Sheet "${sheet.id}" has slice "${s.name}", which is not a known hotspot`);
      }
      hotspots.push({ id: id.data, x: x + s.x, y: s.y, w: s.w, h: s.h });
    }

    for (const item of def.items) {
      const isSpot = def.id === spot.place && item.slot === spot.slot;
      const local = place(item.sheet, findSlice(sheet, item.slot), slotAlignment(item.slot), registry, isSpot);
      const sprite = { ...local, x: local.x + x };
      items.push(sprite);
      if (isSpot) avatarFeet = equipmentFeet(sprite, registry);
    }
    x += frame.w;
  }

  if (avatarFeet === null) {
    throw new Error(
      `Place "${spot.place}" has no item in slot "${spot.slot}" for the avatar to stand on`,
    );
  }
  return { width: x, height, places, sprites: [...backgrounds, ...items], hotspots, avatarFeet };
}
