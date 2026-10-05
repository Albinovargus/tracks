import { useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { fitScale } from './fitScale.js';

/**
 * Pixel-perfect sizing for one canvas of native size nativeW×nativeH (spec §3 Rendering).
 *
 * Attach `stageRef` to a container and `canvasRef` to a <canvas> inside it; both stay
 * mounted for the component's lifetime. The stage must take its size from its parent,
 * never from the canvas. On every ResizeObserver callback for the stage, and on every
 * devicePixelRatio change:
 * - k = fitScale(stage content box width, height, dpr, nativeW, nativeH)
 * - backing store nativeW·k × nativeH·k; CSS size = backing ÷ dpr, so each art pixel is
 *   exactly k device pixels
 * - imageSmoothingEnabled = false and setTransform(k, 0, 0, k, 0, 0) again, because
 *   resizing resets the context; callers draw in art-pixel coordinates
 *
 * Resizing also clears the canvas, so `generation` increments after every resize and
 * callers redraw when it changes. It stays 0 until the first size is applied. A callback
 * that changes neither k nor the DPR leaves the canvas, and `generation`, untouched.
 */
export function usePixelCanvas(
  nativeW: number,
  nativeH: number,
): {
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  scale: number;
  generation: number;
} {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (stage === null || canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('Canvas 2D context is unavailable');

    // Set by the observer, whose first callback fires as soon as observe() is called.
    let availW = 0;
    let availH = 0;
    let applied: { k: number; dpr: number } | null = null;
    let media: MediaQueryList | null = null;

    const resize = (): void => {
      const dpr = window.devicePixelRatio;
      const k = fitScale(availW, availH, dpr, nativeW, nativeH);
      // Assigning canvas.width or height clears the bitmap even when the value is the
      // same, so a callback that changes neither k nor the DPR must not touch the canvas.
      if (applied !== null && applied.k === k && applied.dpr === dpr) return;
      applied = { k, dpr };
      canvas.width = nativeW * k;
      canvas.height = nativeH * k;
      canvas.style.width = `${(nativeW * k) / dpr}px`;
      canvas.style.height = `${(nativeH * k) / dpr}px`;
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      // The canvas is blank now. flushSync commits on the sync lane, and React then
      // flushes that commit's passive effects at once, so callers' redraw effects run
      // inside this callback, before the browser paints the cleared canvas.
      flushSync(() => {
        setScale(k);
        setGeneration((g) => g + 1);
      });
    };

    // A resolution query matches only the DPR it was built with. When it stops
    // matching, re-arm it for the new DPR and resize.
    const onDprChange = (): void => {
      watchDpr();
      resize();
    };
    const watchDpr = (): void => {
      media?.removeEventListener('change', onDprChange);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      media.addEventListener('change', onDprChange);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        availW = entry.contentRect.width;
        availH = entry.contentRect.height;
      }
      resize();
    });
    observer.observe(stage);
    watchDpr();

    return () => {
      observer.disconnect();
      media?.removeEventListener('change', onDprChange);
    };
  }, [nativeW, nativeH]);

  return { stageRef, canvasRef, scale, generation };
}
