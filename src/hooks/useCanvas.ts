import { useRef, useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

export function useCanvas(boardId: string) {
  const setViewport = useStore((s) => s.setViewport);
  const viewport = useStore((s) => s.viewports[boardId] ?? DEFAULT_VIEWPORT);

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, vpx: 0, vpy: 0 });
  const spaceDown = useRef(false);

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - viewport.x) / viewport.zoom,
      y: (sy - viewport.y) / viewport.zoom,
    }),
    [viewport]
  );

  const startPan = useCallback(
    (sx: number, sy: number) => {
      isPanning.current = true;
      panStart.current = { x: sx, y: sy, vpx: viewport.x, vpy: viewport.y };
    },
    [viewport]
  );

  const movePan = useCallback(
    (sx: number, sy: number) => {
      if (!isPanning.current) return;
      const dx = sx - panStart.current.x;
      const dy = sy - panStart.current.y;
      setViewport(boardId, { x: panStart.current.vpx + dx, y: panStart.current.vpy + dy });
    },
    [boardId, setViewport]
  );

  const endPan = useCallback(() => {
    isPanning.current = false;
  }, []);

  const applyZoom = useCallback(
    (delta: number, cx: number, cy: number) => {
      const factor = delta > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * factor));
      // Zoom toward cursor
      const newX = cx - (cx - viewport.x) * (newZoom / viewport.zoom);
      const newY = cy - (cy - viewport.y) * (newZoom / viewport.zoom);
      setViewport(boardId, { zoom: newZoom, x: newX, y: newY });
    },
    [boardId, viewport, setViewport]
  );

  // Track spacebar for pan mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) spaceDown.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return {
    viewport,
    isPanning,
    spaceDown,
    screenToCanvas,
    startPan,
    movePan,
    endPan,
    applyZoom,
  };
}
