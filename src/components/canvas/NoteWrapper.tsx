import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { Maximize2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Note } from "@/lib/types";
import { TextNote } from "../notes/TextNote";
import { ImageNote } from "../notes/ImageNote";
import { YouTubeNote } from "../notes/YouTubeNote";
import { TwitterNote } from "../notes/TwitterNote";
import { InstagramNote } from "../notes/InstagramNote";
import { FileNote } from "../notes/FileNote";
import { LinkNote } from "../notes/LinkNote";
import { GroupNote } from "../notes/GroupNote";
import { TableNote } from "../notes/TableNote";
import { ColumnNote } from "../notes/ColumnNote";
import { NoteContextMenu } from "./NoteContextMenu";
import { ResizeHandle } from "./ResizeHandle";

const EMPTY_NOTES: Note[] = [];
type Side = "top" | "right" | "bottom" | "left";

const EMBED_TYPES = new Set(["youtube", "twitter", "instagram"]);

// ── Connection handle dot ─────────────────────────────────────────────────────

interface HandleProps {
  side: Side;
  onMouseDown: (e: React.MouseEvent, side: Side) => void;
  onMouseEnter: () => void;
}

function ConnectHandle({ side, onMouseDown, onMouseEnter }: HandleProps) {
  const style: React.CSSProperties = {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "var(--color-primary)",
    border: "2.5px solid white",
    boxShadow: "0 1px 4px rgba(0,0,0,.3)",
    cursor: "crosshair",
    zIndex: 30,
  };
  switch (side) {
    case "top":    Object.assign(style, { top: -6, left: "50%", transform: "translateX(-50%)" }); break;
    case "right":  Object.assign(style, { right: -6, top: "50%", transform: "translateY(-50%)" }); break;
    case "bottom": Object.assign(style, { bottom: -6, left: "50%", transform: "translateX(-50%)" }); break;
    case "left":   Object.assign(style, { left: -6, top: "50%", transform: "translateY(-50%)" }); break;
  }
  return (
    <div
      style={style}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onMouseDown(e, side); }}
      onMouseEnter={onMouseEnter}
    />
  );
}

// ── NoteWrapper ───────────────────────────────────────────────────────────────

interface NoteWrapperProps {
  note: Note;
  boardId: string;
  screenToCanvas: (sx: number, sy: number) => { x: number; y: number };
  isConnecting: boolean;
  isConnectTarget: boolean;
  onStartConnect: (noteId: string, anchorX: number, anchorY: number) => void;
}

export const NoteWrapper = React.memo(function NoteWrapper({
  note,
  boardId,
  screenToCanvas,
  isConnecting,
  isConnectTarget,
  onStartConnect,
}: NoteWrapperProps) {
  const updateNote    = useStore((s) => s.updateNote);
  const updateNotes   = useStore((s) => s.updateNotes);
  const notes         = useStore((s) => s.notesByBoard[boardId] ?? EMPTY_NOTES);
  const selected      = useStore((s) => Boolean(s.selectedNoteIds[note.id]));
  const setSelection  = useStore((s) => s.setSelection);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const bringToFront  = useStore((s) => s.bringToFront);
  const snapToGrid    = useStore((s) => s.snapToGrid);
  const setDetailNote = useStore((s) => s.setDetailNote);

  const GRID = 24;
  const isEmbed = EMBED_TYPES.has(note.type);
  const isGroup = note.type === "group";

  const [dragging,    setDragging]    = useState(false);
  const [hovered,     setHovered]     = useState(false);
  const [interacting, setInteracting] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onNoteEnter = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setHovered(true);
  }, []);

  const onNoteLeave = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setHovered(false), 200);
  }, []);

  useEffect(() => { if (!selected) setInteracting(false); }, [selected]);

  useEffect(() => {
    if (!interacting) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setInteracting(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interacting]);

  // Refs for live drag state (avoid stale closures)
  const dragPosRef  = useRef({ x: note.x, y: note.y });
  const noteElRef   = useRef<HTMLDivElement>(null);
  const dragStart   = useRef({ mx: 0, my: 0, nx: 0, ny: 0 });
  const isDragging  = useRef(false);
  const interactingRef = useRef(false);
  // Keep a live-updated notes ref for use in closures
  const notesRef = useRef(notes);
  useLayoutEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { interactingRef.current = interacting; }, [interacting]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      if (interactingRef.current) return;

      if (e.shiftKey) { toggleSelection(note.id); return; }
      if (!selected) setSelection([note.id]);
      bringToFront(note.id);

      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      dragStart.current = { mx: canvasPos.x, my: canvasPos.y, nx: note.x, ny: note.y };
      isDragging.current = false;
      dragPosRef.current = { x: note.x, y: note.y };

      const onMove = (me: MouseEvent) => {
        const cp = screenToCanvas(me.clientX, me.clientY);
        const dx = cp.x - dragStart.current.mx;
        const dy = cp.y - dragStart.current.my;

        if (!isDragging.current && Math.abs(dx) + Math.abs(dy) > 4) {
          isDragging.current = true;
          setDragging(true);
        }
        if (!isDragging.current) return;

        const rawX = dragStart.current.nx + dx;
        const rawY = dragStart.current.ny + dy;
        const newX = snapToGrid ? Math.round(rawX / GRID) * GRID : rawX;
        const newY = snapToGrid ? Math.round(rawY / GRID) * GRID : rawY;
        dragPosRef.current = { x: newX, y: newY };

        if (noteElRef.current) {
          noteElRef.current.style.transform = `translate(${newX}px, ${newY}px) rotate(1.5deg)`;
        }

        // Broadcast live position so ArrowsLayer redraws in real-time
        useStore.getState().setLiveDragPosition(note.id, { x: newX, y: newY });

        // For group notes: move member DOM elements + broadcast their live positions
        if (note.type === "group") {
          const memberDx = newX - dragStart.current.nx;
          const memberDy = newY - dragStart.current.ny;
          notesRef.current
            .filter((n) => n.content.groupId === note.id)
            .forEach((member) => {
              const memberNewX = member.x + memberDx;
              const memberNewY = member.y + memberDy;
              useStore.getState().setLiveDragPosition(member.id, { x: memberNewX, y: memberNewY });
              const el = document.querySelector(`[data-noteid="${member.id}"]`) as HTMLElement | null;
              if (el) {
                el.style.transition = "none";
                el.style.transform  = `translate(${memberNewX}px, ${memberNewY}px)`;
              }
            });
        }
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup",   onUp);

        if (isDragging.current) {
          const finalPos = dragPosRef.current;

          const patches: Array<{ id: string } & Partial<Note>> = [
            { id: note.id, x: finalPos.x, y: finalPos.y },
          ];

          // For group notes: commit member positions and restore their transitions
          if (note.type === "group") {
            const memberDx = finalPos.x - note.x;
            const memberDy = finalPos.y - note.y;
            notesRef.current
              .filter((n) => n.content.groupId === note.id)
              .forEach((member) => {
                patches.push({ id: member.id, x: member.x + memberDx, y: member.y + memberDy });
                const el = document.querySelector(`[data-noteid="${member.id}"]`) as HTMLElement | null;
                if (el) el.style.transition = "";
              });
          }

          updateNotes(patches);

          // ── Auto (un)group: re-evaluate membership based on final drop position ──
          // Find the smallest group whose bounds contain the note's centre.
          // This handles drop-in, drop-out, and group-to-group moves in one pass.
          if (note.type !== "group") {
            const cx = finalPos.x + note.width  / 2;
            const cy = finalPos.y + note.height / 2;

            const target = notesRef.current
              .filter((n) => n.type === "group")
              .filter((g) =>
                cx >= g.x && cx <= g.x + g.width &&
                cy >= g.y && cy <= g.y + g.height
              )
              // prefer the smallest (innermost) group when they overlap
              .sort((a, b) => a.width * a.height - b.width * b.height)[0];

            const newGroupId = target?.id;
            if (newGroupId !== note.content.groupId) {
              useStore.getState().updateNote(note.id, {
                content: { ...note.content, groupId: newGroupId },
              });
            }
          }
        }

        useStore.getState().clearLiveDragPositions();
        isDragging.current = false;
        setDragging(false);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup",   onUp);
    },
    [note, selected, screenToCanvas, setSelection, toggleSelection, bringToFront, updateNote, updateNotes, snapToGrid]
  );

  // Connection handle interaction
  const handleStartConnect = useCallback(
    (_e: React.MouseEvent, side: Side) => {
      const anchors: Record<Side, { x: number; y: number }> = {
        top:    { x: note.x + note.width / 2,  y: note.y },
        right:  { x: note.x + note.width,       y: note.y + note.height / 2 },
        bottom: { x: note.x + note.width / 2,  y: note.y + note.height },
        left:   { x: note.x,                   y: note.y + note.height / 2 },
      };
      onStartConnect(note.id, anchors[side].x, anchors[side].y);
    },
    [note, onStartConnect]
  );

  const showHandles = (hovered || selected) && !isConnecting && !dragging;

  return (
    <NoteContextMenu note={note}>
      <div
        ref={noteElRef}
        data-noteid={note.id}
        className={`absolute select-none ${
          isGroup ? "pointer-events-none" : dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          width: note.width, height: note.height,
          left: 0, top: 0,
          zIndex: note.zIndex,
          transform: `translate(${note.x}px, ${note.y}px) rotate(${dragging ? 1.5 : 0}deg)`,
          transition: dragging ? "none" : "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)",
          willChange: dragging ? "transform" : "auto",
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={isGroup ? undefined : onNoteEnter}
        onMouseLeave={isGroup ? undefined : onNoteLeave}
      >
        {/* Connection handles — shown on hover/select, outside inner div; hidden for groups */}
        {showHandles && !isGroup && (["top", "right", "bottom", "left"] as Side[]).map((side) => (
          <ConnectHandle key={side} side={side} onMouseDown={handleStartConnect} onMouseEnter={onNoteEnter} />
        ))}

        {/* Open-in-full-view button — top-right corner, shown on hover/select */}
        {showHandles && !isGroup && (
          <div style={{ position: "absolute", top: -9, right: -9, zIndex: 35 }}>
            <button
              className="w-[22px] h-[22px] rounded-full bg-[var(--color-card)] border border-[var(--color-border)] shadow flex items-center justify-center text-[var(--color-muted-foreground)] hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)] hover:border-[var(--color-primary)] transition-all"
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onClick={(e) => { e.stopPropagation(); setDetailNote(note.id); }}
              title="Open full view"
            >
              <Maximize2 size={10} />
            </button>
          </div>
        )}

        <div
          className={`relative w-full h-full rounded-lg shadow-md transition-all duration-150 ${
            isGroup ? "" : "overflow-hidden"
          } ${
            isConnectTarget
              ? "ring-2 ring-green-400 shadow-lg shadow-green-200/60 scale-[1.03]"
              : selected
              ? `ring-2 ring-[var(--color-primary)] shadow-lg ${isGroup ? "ring-dashed" : ""}`
              : "hover:shadow-lg"
          }`}
          style={isGroup ? { pointerEvents: "none" } : undefined}
          onMouseEnter={isGroup ? onNoteEnter : undefined}
          onMouseLeave={isGroup ? onNoteLeave : undefined}
        >
          <NoteContent note={note} />

          {/* Transparent interact overlay for embeds */}
          {isEmbed && !interacting && (
            <div
              className="absolute inset-0 z-10"
              title="Double-click to interact"
              onDoubleClick={(e) => { e.stopPropagation(); setInteracting(true); }}
            />
          )}

          {/* Exit interact mode button */}
          {isEmbed && interacting && (
            <button
              className="absolute top-1.5 right-1.5 z-20 w-6 h-6 rounded-full bg-black/60 text-white text-sm flex items-center justify-center hover:bg-black/80 transition-colors leading-none"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setInteracting(false); }}
              title="Exit interact mode (Esc)"
            >
              ×
            </button>
          )}

          {selected && (
            <ResizeHandle note={note} screenToCanvas={screenToCanvas} />
          )}
        </div>
      </div>
    </NoteContextMenu>
  );
});

function NoteContent({ note }: { note: Note }) {
  switch (note.type) {
    case "text":      return <TextNote note={note} />;
    case "image":     return <ImageNote note={note} />;
    case "youtube":   return <YouTubeNote note={note} />;
    case "twitter":   return <TwitterNote note={note} />;
    case "instagram": return <InstagramNote note={note} />;
    case "file":      return <FileNote note={note} />;
    case "link":      return <LinkNote note={note} />;
    case "group":     return <GroupNote note={note} />;
    case "table":     return <TableNote   note={note} />;
    case "columns":   return <ColumnNote  note={note} />;
    default:          return null;
  }
}
