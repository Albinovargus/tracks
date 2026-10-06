import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import {
  cameraX,
  centerWorldX,
  scrollLeftCentering,
  viewFor,
  type WorldView,
} from "./camera.js";

/** The world's size in art px and the world x the camera opens centered on. */
export interface WorldSize {
  width: number;
  height: number;
  homeX: number;
}

/** CSS px per wheel line (WheelEvent.deltaMode 1, e.g. Firefox mouse wheels). */
const LINE_PX = 16;

/**
 * Sizing and camera for the room world (room world spec §3).
 *
 * Attach `scrollerRef` to the horizontal scroller (it must take its size from its
 * parent) and `canvasRef` to the sticky canvas inside its track. On every
 * ResizeObserver callback and devicePixelRatio change the canvas backing store
 * becomes the viewport in device px, k = coverScale, and `generation` increments
 * inside flushSync so callers redraw before the cleared canvas is painted. The
 * camera (`cameraRef`, device px) follows the scroll position; a resize keeps the
 * world x at the viewport's center centered, and the first size centers homeX.
 */
export function useWorldCanvas(size: WorldSize | null): {
  scrollerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  view: WorldView | null;
  generation: number;
  cameraRef: RefObject<number>;
} {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef(0);
  const [view, setView] = useState<WorldView | null>(null);
  const [generation, setGeneration] = useState(0);
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const homeX = size?.homeX ?? 0;

  useEffect(() => {
    const scroller = scrollerRef.current;
    const canvas = canvasRef.current;
    if (scroller === null || canvas === null || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("Canvas 2D context is unavailable");

    let cssW = 0;
    let cssH = 0;
    let applied: WorldView | null = null;
    let media: MediaQueryList | null = null;

    const resize = (): void => {
      const dpr = window.devicePixelRatio;
      const backingW = Math.round(cssW * dpr);
      const backingH = Math.round(cssH * dpr);
      // A hidden or collapsed stage: keep the last good canvas.
      if (backingW === 0 || backingH === 0) return;
      // Assigning canvas.width clears the bitmap even with the same value.
      if (
        applied !== null &&
        applied.dpr === dpr &&
        applied.backingW === backingW &&
        applied.backingH === backingH
      ) {
        return;
      }
      const focusX = applied === null ? homeX : centerWorldX(cameraRef.current, applied);
      const next = viewFor(backingW, backingH, dpr, width, height);
      const scrollLeft = scrollLeftCentering(focusX, next, width);
      applied = next;
      canvas.width = backingW;
      canvas.height = backingH;
      canvas.style.width = `${backingW / dpr}px`;
      canvas.style.height = `${backingH / dpr}px`;
      ctx.imageSmoothingEnabled = false;
      // Set before the commit: callers' redraw effects run inside flushSync.
      cameraRef.current = cameraX(scrollLeft, next, width);
      flushSync(() => {
        setView(next);
        setGeneration((g) => g + 1);
      });
      // The track has its new width now, so the offset is inside the scroll range.
      scroller.scrollLeft = scrollLeft;
    };

    const onScroll = (): void => {
      if (applied === null) return;
      // Layout already has a new width the ResizeObserver hasn't reported yet (a
      // snap-mandatory scroller re-snaps on resize first). Measured against the old
      // view this scroll would move the focus, so resize() re-anchors from the last
      // camera instead and sets the scroll position itself.
      if (Math.abs(scroller.clientWidth - applied.backingW / applied.dpr) >= 1) return;
      cameraRef.current = cameraX(scroller.scrollLeft, applied, width);
    };

    const onWheel = (event: WheelEvent): void => {
      // Pinch-zoom and Ctrl+wheel browser zoom arrive as ctrlKey wheels.
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      scroller.scrollLeft += event.deltaMode === 1 ? event.deltaY * LINE_PX : event.deltaY;
      onScroll();
    };

    const onDprChange = (): void => {
      watchDpr();
      resize();
    };
    const watchDpr = (): void => {
      media?.removeEventListener("change", onDprChange);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      media.addEventListener("change", onDprChange);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        cssW = entry.contentRect.width;
        cssH = entry.contentRect.height;
      }
      resize();
    });
    observer.observe(scroller);
    watchDpr();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      observer.disconnect();
      media?.removeEventListener("change", onDprChange);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [width, height, homeX]);

  return { scrollerRef, canvasRef, view, generation, cameraRef };
}
