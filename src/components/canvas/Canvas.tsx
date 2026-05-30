import React, { useRef, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useCanvas } from "@/hooks/useCanvas";
import { NoteWrapper } from "./NoteWrapper";
import { ArrowsLayer } from "./ArrowsLayer";
import { measureImage } from "@/lib/imageSize";
import type { Note } from "@/lib/types";

const EMPTY_NOTES: Note[] = [];

interface CanvasProps {
  boardId: string;
}

export function Canvas({ boardId }: CanvasProps) {
  const notes          = useStore((s) => s.notesByBoard[boardId] ?? EMPTY_NOTES);
  const clearSelection = useStore((s) => s.clearSelection);
  const addNote        = useStore((s) => s.addNote);
  const addConnection  = useStore((s) => s.addConnection);
  const groupNotes     = useStore((s) => s.groupNotes);
  const showDotGrid    = useStore((s) => s.showDotGrid);

  const { viewport, spaceDown, startPan, movePan, endPan, applyZoom, screenToCanvas } =
    useCanvas(boardId);

  const containerRef = useRef<HTMLDivElement>(null);
  const middleDown   = useRef(false);
  const [panMode,  setPanMode]  = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ── Marquee selection rect (canvas coordinates) ───────────────────────────
  const [selRect, setSelRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // ── clientToCanvas: screenToCanvas + container-rect correction ───────────
  // screenToCanvas only subtracts viewport.x/y — it doesn't know the container
  // is offset from the window edge by the sidebar. We fix that here.
  const clientToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
      return screenToCanvas(clientX - rect.left, clientY - rect.top);
    },
    [screenToCanvas]
  );

  // ── Connection drag state ─────────────────────────────────────────────────
  const [connectingFrom, setConnectingFrom] = useState<{
    noteId: string;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const [mouseCanvas,      setMouseCanvas]      = useState({ x: 0, y: 0 });
  const [connectHoverTarget, setConnectHoverTarget] = useState<string | null>(null);

  // Stable refs for use inside native event-listener closures
  const clientToCanvasRef = useRef(clientToCanvas);
  const notesRef          = useRef(notes);
  const boardIdRef        = useRef(boardId);
  useLayoutEffect(() => { clientToCanvasRef.current = clientToCanvas; }, [clientToCanvas]);
  useLayoutEffect(() => { notesRef.current = notes; },                  [notes]);
  useLayoutEffect(() => { boardIdRef.current = boardId; },              [boardId]);

  // Called by NoteWrapper handle – attaches listeners immediately (no useEffect,
  // avoids React StrictMode double-fire tearing them down mid-drag)
  const handleStartConnect = useCallback(
    (noteId: string, anchorX: number, anchorY: number) => {
      setMouseCanvas({ x: anchorX, y: anchorY });
      setConnectingFrom({ noteId, anchorX, anchorY });
      setConnectHoverTarget(null);

      const onMove = (e: MouseEvent) => {
        const pos = clientToCanvasRef.current(e.clientX, e.clientY);
        setMouseCanvas(pos);

        // Highlight the note under the cursor
        const hit = notesRef.current.find(
          (n) =>
            n.id !== noteId &&
            pos.x >= n.x && pos.x <= n.x + n.width &&
            pos.y >= n.y && pos.y <= n.y + n.height
        );
        setConnectHoverTarget(hit?.id ?? null);
      };

      const onUp = (e: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup",   onUp);

        const pos = clientToCanvasRef.current(e.clientX, e.clientY);
        const target = notesRef.current.find(
          (n) =>
            n.id !== noteId &&
            pos.x >= n.x && pos.x <= n.x + n.width &&
            pos.y >= n.y && pos.y <= n.y + n.height
        );
        if (target) {
          addConnection({ boardId: boardIdRef.current, fromNoteId: noteId, toNoteId: target.id });
        }
        setConnectingFrom(null);
        setConnectHoverTarget(null);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup",   onUp);
    },
    [addConnection]
  );

  // ── Canvas pan + marquee selection ───────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Cancel connection drag on empty canvas click
      if (connectingFrom && (e.target as HTMLElement).dataset.canvas === "true") {
        setConnectingFrom(null);
        setConnectHoverTarget(null);
        return;
      }
      const isMiddle   = e.button === 1;
      const isSpacePan = spaceDown.current && e.button === 0;
      if (isMiddle || isSpacePan) {
        e.preventDefault();
        middleDown.current = true;
        startPan(e.clientX, e.clientY);
        return;
      }
      if ((e.target as HTMLElement).dataset.canvas !== "true") return;

      // ── Left-click on empty canvas: clear selection + start marquee ────────
      clearSelection();

      const startPos = clientToCanvasRef.current(e.clientX, e.clientY);
      // Mutable local rect tracked by the closure (avoids stale state in onUp)
      let cur = { x1: startPos.x, y1: startPos.y, x2: startPos.x, y2: startPos.y };
      let dragged = false;

      const onMove = (me: MouseEvent) => {
        const p = clientToCanvasRef.current(me.clientX, me.clientY);
        cur = { x1: startPos.x, y1: startPos.y, x2: p.x, y2: p.y };
        dragged = true;
        setSelRect({ ...cur });
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup",   onUp);
        setSelRect(null);

        if (!dragged) return;

        const minX = Math.min(cur.x1, cur.x2);
        const maxX = Math.max(cur.x1, cur.x2);
        const minY = Math.min(cur.y1, cur.y2);
        const maxY = Math.max(cur.y1, cur.y2);

        // Ignore tiny accidental drags
        if (maxX - minX < 4 && maxY - minY < 4) return;

        // Collect IDs of visible notes that intersect the rect
        const collapsed = new Set(
          notesRef.current
            .filter((n) => n.type === "group" && n.content.collapsed)
            .map((n) => n.id)
        );
        const hit = notesRef.current
          .filter((n) => !n.content.groupId || !collapsed.has(n.content.groupId))
          .filter(
            (n) =>
              n.x < maxX && n.x + n.width  > minX &&
              n.y < maxY && n.y + n.height > minY
          )
          .map((n) => n.id);

        if (hit.length > 0) {
          useStore.getState().setSelection(hit);
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup",   onUp);
    },
    [spaceDown, startPan, clearSelection, connectingFrom]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => { if (middleDown.current) movePan(e.clientX, e.clientY); },
    [movePan]
  );

  const handleMouseUp = useCallback(() => { middleDown.current = false; endPan(); }, [endPan]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (e.ctrlKey || e.metaKey) {
        applyZoom(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        useStore.getState().setViewport(boardId, {
          x: viewport.x - e.deltaX,
          y: viewport.y - e.deltaY,
        });
      }
    },
    [applyZoom, boardId, viewport]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Double-click on empty canvas → new text note ─────────────────────────

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).dataset.canvas !== "true") return;
      if (connectingFrom) return;
      const pos  = clientToCanvas(e.clientX, e.clientY);
      const maxZ = notes.reduce((m, n) => Math.max(m, n.zIndex), 0);
      addNote({
        type: "text", boardId,
        x: pos.x - 120, y: pos.y - 80,
        width: 240, height: 160,
        zIndex: maxZ + 1,
        content: { text: "" },
      });
    },
    [clientToCanvas, connectingFrom, notes, boardId, addNote]
  );

  // ── Drag-and-drop images ──────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      const maxZ = notes.reduce((m, n) => Math.max(m, n.zIndex), 0);
      // Drop position in canvas coords (centre of the drop point)
      const cx = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const cy = (e.clientY - rect.top  - viewport.y) / viewport.zoom;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url  = URL.createObjectURL(file);
        const { width, height } = await measureImage(url);
        addNote({
          type: "image", boardId,
          x: cx - width  / 2 + i * 24,
          y: cy - height / 2 + i * 24,
          width, height,
          zIndex: maxZ + 1 + i,
          content: { url, fileName: file.name },
        });
      }
    },
    [notes, viewport, boardId, addNote]
  );

  // ── Spacebar pan cursor ───────────────────────────────────────────────────

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.code === "Space" && !e.repeat) setPanMode(true);  };
    const onUp   = (e: KeyboardEvent) => { if (e.code === "Space") setPanMode(false); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup",   onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup",   onUp);
    };
  }, []);

  // ── Ctrl+G: group selected notes ─────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        const selectedIds = Object.keys(useStore.getState().selectedNoteIds);
        if (selectedIds.length >= 2) {
          groupNotes(selectedIds, boardId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boardId, groupNotes]);

  const cursorClass = connectingFrom ? "cursor-crosshair" : panMode ? "canvas-pan" : "canvas-default";
  const sorted = [...notes].sort((a, b) => a.zIndex - b.zIndex);

  // Hide members of collapsed groups
  const collapsedGroupIds = new Set(
    notes.filter((n) => n.type === "group" && n.content.collapsed).map((n) => n.id)
  );
  const visibleNotes = sorted.filter(
    (n) => !n.content.groupId || !collapsedGroupIds.has(n.content.groupId)
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden bg-[var(--color-background)] ${cursorClass}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-canvas="true"
    >
      {dragOver && (
        <div className="absolute inset-0 z-50 pointer-events-none border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary)]/5 flex items-center justify-center">
          <p className="text-[var(--color-primary)] text-sm font-medium select-none">Drop images here</p>
        </div>
      )}

      {showDotGrid && <DotGrid x={viewport.x} y={viewport.y} zoom={viewport.zoom} />}

      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          willChange: "transform",
        }}
      >
        <ArrowsLayer
          boardId={boardId}
          notes={visibleNotes}
          connectingFrom={connectingFrom}
          mouseCanvas={mouseCanvas}
        />

        {visibleNotes.map((note) => (
          <NoteWrapper
            key={note.id}
            note={note}
            boardId={boardId}
            screenToCanvas={screenToCanvas}
            isConnecting={!!connectingFrom}
            isConnectTarget={connectHoverTarget === note.id}
            onStartConnect={handleStartConnect}
          />
        ))}

        {/* Marquee selection rectangle */}
        {selRect && (
          <div
            className="absolute pointer-events-none rounded"
            style={{
              left:   Math.min(selRect.x1, selRect.x2),
              top:    Math.min(selRect.y1, selRect.y2),
              width:  Math.abs(selRect.x2 - selRect.x1),
              height: Math.abs(selRect.y2 - selRect.y1),
              border: "1.5px dashed var(--color-primary)",
              background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
              zIndex: 99999,
            }}
          />
        )}
      </div>

      <div className="absolute bottom-4 right-4 text-xs text-[var(--color-muted-foreground)] select-none pointer-events-none">
        {Math.round(viewport.zoom * 100)}%
        {connectingFrom && (
          <span className="ml-2 text-[var(--color-primary)] font-medium animate-pulse">
            Connecting… release over a note
          </span>
        )}
      </div>
    </div>
  );
}

function DotGrid({ x, y, zoom }: { x: number; y: number; zoom: number }) {
  const spacing = 24 * zoom;
  const dotSize = Math.max(1, zoom);
  const offsetX = ((x % spacing) + spacing) % spacing;
  const offsetY = ((y % spacing) + spacing) % spacing;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dot-grid" x={offsetX} y={offsetY} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <circle cx={spacing / 2} cy={spacing / 2} r={dotSize} fill="var(--color-border)" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  );
}
