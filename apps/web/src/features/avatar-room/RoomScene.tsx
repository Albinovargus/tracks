import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import * as Sentry from "@sentry/react";
import type { AvatarAppearance } from "@tracks/types";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import { describeAppearance } from "../avatar/appearance.js";
import {
  drawAvatar,
  loadAvatarSheets,
  loadSheetCanvas,
  type LoadedSheets,
} from "../avatar/canvas.js";
import { BODY_SHEET } from "../avatar/catalog.js";
import {
  frameAt,
  tagFrames,
  type AnimationTag,
  type TagFrame,
} from "../avatar/frames.js";
import { getSheet } from "../avatar/sheets.js";
import {
  initialBehavior,
  step,
  tagForPhase,
  timingsFromSheet,
  type BehaviorTimings,
} from "./behavior.js";
import {
  cameraX,
  centerWorldX,
  hotspotBox,
  nearestPlace,
  overlaps,
  scrollLeftCentering,
  shouldSnap,
  type WorldView,
} from "./camera.js";
import { clampDt } from "./clock.js";
import { PlaceDots } from "./PlaceDots.js";
import {
  layoutWorld,
  spriteFrame,
  type PlacedSprite,
  type WorldLayout,
} from "./roomLayout.js";
import { useWorldCanvas, type WorldSize } from "./useWorldCanvas.js";
import { HOME_PLACE, HOTSPOT_ACTIONS } from "./world.js";

/** Everything one appearance needs on screen, loaded and swapped up front. */
interface RoomArt {
  appearance: AvatarAppearance;
  layout: WorldLayout;
  size: WorldSize;
  room: { sprite: PlacedSprite; image: HTMLCanvasElement }[];
  avatar: LoadedSheets;
  timings: BehaviorTimings;
  frames: Record<AnimationTag, TagFrame[]>;
}

/** The world size plus the center of HOME_PLACE, where the camera opens. */
function worldSize(layout: WorldLayout): WorldSize {
  const home = layout.places.find((p) => p.id === HOME_PLACE);
  if (!home) throw new Error(`The world has no home place "${HOME_PLACE}"`);
  return {
    width: layout.width,
    height: layout.height,
    homeX: home.x + home.w / 2,
  };
}

async function loadRoomArt(appearance: AvatarAppearance): Promise<RoomArt> {
  const layout = layoutWorld();
  const size = worldSize(layout);
  const body = getSheet(BODY_SHEET);
  const timings = timingsFromSheet(body);
  const frames: Record<AnimationTag, TagFrame[]> = {
    "front-idle": tagFrames(body, "front-idle"),
    turn: tagFrames(body, "turn"),
    "side-run": tagFrames(body, "side-run"),
  };
  const [room, avatar] = await Promise.all([
    Promise.all(
      layout.sprites.map(async (sprite) => ({
        sprite,
        image: await loadSheetCanvas(getSheet(sprite.sheet), null),
      })),
    ),
    loadAvatarSheets(appearance),
  ]);
  return { appearance, layout, size, room, avatar, timings, frames };
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  art: RoomArt,
  view: WorldView,
  camX: number,
  tag: AnimationTag,
  frameOffset: number,
): void {
  const { k, backingW, backingH, camY } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, backingW, backingH);
  // Whole device px offsets: each art pixel stays exactly k device px.
  ctx.setTransform(k, 0, 0, k, -camX, -camY);
  const visible = {
    x: camX / k,
    y: camY / k,
    w: backingW / k,
    h: backingH / k,
  };
  for (const { sprite, image } of art.room) {
    const rect = spriteFrame(sprite, tag, frameOffset);
    if (!overlaps({ x: sprite.x, y: sprite.y, w: rect.w, h: rect.h }, visible))
      continue;
    ctx.drawImage(
      image,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      sprite.x,
      sprite.y,
      rect.w,
      rect.h,
    );
  }
  const feet = art.layout.avatarFeet;
  drawAvatar(ctx, art.avatar, art.appearance, tag, frameOffset, feet.x, feet.y);
}

/** One string per distinct look, built from the six appearance fields. */
function appearanceKey(a: AvatarAppearance): string {
  return [
    a.skin_tone,
    a.hair_style,
    a.hair_color,
    a.top,
    a.bottom,
    a.shoes,
  ].join("|");
}

/** The room world. Its rAF loop is the app's only animation driver. */
export function RoomScene({ appearance }: { appearance: AvatarAppearance }) {
  // Each Retry is a fresh attempt: bumping it remounts the canvas, which loads and draws again.
  const [attempt, setAttempt] = useState(0);
  // A new look (say, a refetch after an edit on another device) remounts the
  // canvas, so data-ready and any earlier load error never carry over to it.
  return (
    <RoomCanvas
      key={`${appearanceKey(appearance)}#${attempt}`}
      appearance={appearance}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

function RoomCanvas({
  appearance,
  onRetry,
}: {
  appearance: AvatarAppearance;
  onRetry: () => void;
}) {
  const [art, setArt] = useState<RoomArt | null>(null);
  const { scrollerRef, canvasRef, view, generation, cameraRef } =
    useWorldCanvas(art?.size ?? null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // A resize clears the canvas: the loop sees the new generation, and the
  // effect below redraws the current frame at once so the canvas never sits blank.
  const generationRef = useRef(generation);
  const viewRef = useRef<WorldView | null>(view);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    generationRef.current = generation;
    viewRef.current = view;
  }, [generation, view]);

  useEffect(() => {
    let cancelled = false;
    loadRoomArt(appearance).then(
      (loaded) => {
        if (!cancelled) setArt(loaded);
      },
      (error: unknown) => {
        if (cancelled) return;
        Sentry.captureException(error);
        setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [appearance]);

  useEffect(() => {
    // No context until the sheets are in: a failed load never asks for one.
    if (!art) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let behavior = initialBehavior(Math.random, art.timings);
    let lastTime: number | null = null;
    let current: { tag: AnimationTag; frameOffset: number } = {
      tag: "front-idle",
      frameOffset: 0,
    };
    let drawnKey = "";
    let announced = false;
    // Set by the first draw error, so later resizes neither redraw nor report it again.
    let stopped = false;
    let frameId = 0;

    // Draws the current frame unless it is already on the sized canvas at this camera.
    // Returns false on a draw error.
    const paint = (): boolean => {
      // Generation 0: useWorldCanvas has not sized the canvas yet, and its first
      // resize would wipe this frame right after data-ready announced it.
      const sizedGeneration = generationRef.current;
      const sizedView = viewRef.current;
      const camX = cameraRef.current;
      const key = `${sizedGeneration}|${camX}|${current.tag}|${current.frameOffset}`;
      if (stopped) return false;
      if (sizedGeneration === 0 || sizedView === null) return true;
      if (key === drawnKey) return true;
      try {
        drawRoom(ctx, art, sizedView, camX, current.tag, current.frameOffset);
      } catch (error) {
        stopped = true;
        Sentry.captureException(error);
        setFailed(true);
        return false;
      }
      drawnKey = key;
      if (!announced) {
        announced = true;
        setReady(true);
      }
      return true;
    };

    const tick = (now: number): void => {
      // A tab back from the background resumes where it was (see clock.ts).
      const dtMs = lastTime === null ? 0 : clampDt(now - lastTime);
      lastTime = now;
      behavior = step(behavior, dtMs, Math.random, art.timings);
      const tag = tagForPhase(behavior.phase);
      current = {
        tag,
        frameOffset: frameAt(art.frames[tag], behavior.msInPhase),
      };
      if (!paint()) return;
      frameId = requestAnimationFrame(tick);
    };

    redrawRef.current = () => {
      if (!paint()) cancelAnimationFrame(frameId);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      redrawRef.current = null;
      cancelAnimationFrame(frameId);
    };
  }, [art, canvasRef, cameraRef]);

  // After the resize effect's wipe (or once the art arrives on an already sized canvas), repaint now.
  useEffect(() => {
    redrawRef.current?.();
  }, [generation, art]);

  // The dot for the place nearest the viewport's center; null until the world is sized.
  const [currentPlace, setCurrentPlace] = useState<number | null>(null);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !art || !view) return;
    const update = (): void => {
      const camX = cameraX(scroller.scrollLeft, view, art.layout.width);
      setCurrentPlace(
        nearestPlace(centerWorldX(camX, view), art.layout.places),
      );
    };
    // A resize can keep or clamp scrollLeft without a scroll event: read it now too.
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [art, view, scrollerRef]);
  const homeIndex = art
    ? art.layout.places.findIndex((p) => p.id === HOME_PLACE)
    : 0;

  const pickPlace = (index: number): void => {
    const place = art?.layout.places[index];
    if (!place || !view || !art) return;
    scrollerRef.current?.scrollTo({
      left: scrollLeftCentering(place.x + place.w / 2, view, art.layout.width),
      behavior: "smooth",
    });
  };

  // CSS px per art px: the scroll track and its overlays are laid out in CSS px.
  const s = view ? view.k / view.dpr : 1;
  // Hotspots and dots appear only over a drawn room.
  const shown = ready && !failed;
  // The root fills its parent; useWorldCanvas measures the scroller, which fills the root.
  return (
    <div className="relative size-full overflow-hidden">
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center">
          <p
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            Couldn't load the room.
          </p>
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
      <div
        ref={scrollerRef}
        role="region"
        aria-label="Room"
        tabIndex={0}
        hidden={failed}
        className={cn(
          "absolute inset-0 overflow-x-auto overflow-y-hidden overscroll-x-contain outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          view &&
            art &&
            shouldSnap(view, art.layout.places) &&
            "snap-x snap-mandatory",
        )}
      >
        <div
          className="relative h-full"
          style={{ width: view && art ? `${art.layout.width * s}px` : "100%" }}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={describeAppearance(appearance)}
            data-ready={shown ? "true" : undefined}
            className="sticky top-0 left-0 block [image-rendering:pixelated]"
          />
          {view &&
            art?.layout.places.map((place) => (
              // A point, not the place's span: a snap area wider than the screen lets
              // the scroller rest anywhere inside it, so one swipe might not move a place.
              <div
                key={place.id}
                aria-hidden
                className="pointer-events-none absolute top-0 h-full w-0 snap-center"
                style={{ left: `${(place.x + place.w / 2) * s}px` }}
              />
            ))}
          {shown &&
            view &&
            art?.layout.hotspots.map((hotspot) => {
              const action = HOTSPOT_ACTIONS[hotspot.id];
              const box = hotspotBox(hotspot, view);
              return (
                <Link
                  key={hotspot.id}
                  to={action.to}
                  aria-label={action.label}
                  className="absolute rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:bg-white/15"
                  style={{
                    left: `${box.left}px`,
                    top: `${box.top}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                  }}
                />
              );
            })}
        </div>
      </div>
      {shown && view && art && (
        <PlaceDots
          places={art.layout.places}
          current={currentPlace ?? homeIndex}
          onPick={pickPlace}
        />
      )}
    </div>
  );
}
