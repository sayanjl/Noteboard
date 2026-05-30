import { useState, useEffect, useRef } from "react";
import { Eye, AlertCircle } from "lucide-react";
import type { Note, Board } from "@/lib/types";
import { fetchSharedBoard, fetchSharedNotes } from "@/lib/share";
import { supabase } from "@/lib/supabase";
import { TextNote } from "@/components/notes/TextNote";
import { ImageNote } from "@/components/notes/ImageNote";
import { YouTubeNote } from "@/components/notes/YouTubeNote";
import { TwitterNote } from "@/components/notes/TwitterNote";
import { InstagramNote } from "@/components/notes/InstagramNote";
import { LinkNote } from "@/components/notes/LinkNote";
import { FileNote } from "@/components/notes/FileNote";

// ── Note type switcher (read-only — no store dependency) ──────────────────────

function NoteContent({ note }: { note: Note }) {
  switch (note.type) {
    case "text":      return <TextNote note={note} />;
    case "image":     return <ImageNote note={note} />;
    case "youtube":   return <YouTubeNote note={note} />;
    case "twitter":   return <TwitterNote note={note} />;
    case "instagram": return <InstagramNote note={note} />;
    case "link":      return <LinkNote note={note} />;
    case "file":      return <FileNote note={note} />;
    default:          return null;
  }
}

// ── SharedBoardViewer ─────────────────────────────────────────────────────────

interface Viewport { x: number; y: number; zoom: number }
const INIT_VP: Viewport = { x: 0, y: 0, zoom: 1 };

export function SharedBoardViewer({ token }: { token: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vp, setVp] = useState<Viewport>(INIT_VP);

  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!supabase) {
      setError("Sharing requires Supabase to be configured.");
      setLoading(false);
      return;
    }
    Promise.all([fetchSharedBoard(token), fetchSharedNotes(token)])
      .then(([b, n]) => {
        if (!b) setError("Board not found or sharing has been disabled.");
        else { setBoard(b); setNotes(n); }
        setLoading(false);
      })
      .catch(() => { setError("Failed to load board."); setLoading(false); });
  }, [token]);

  // ── Pan/zoom handlers ───────────────────────────────────────────────────────

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-noteid]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setVp((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const onPointerUp = () => { isPanning.current = false; };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setVp((v) => ({ ...v, zoom: Math.max(0.1, Math.min(4, v.zoom * factor)) }));
    } else {
      setVp((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
  };

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-[var(--color-background)]">
        <AlertCircle className="w-8 h-8 text-[var(--color-muted-foreground)]" />
        <p className="text-sm text-[var(--color-muted-foreground)] text-center max-w-xs">{error}</p>
      </div>
    );
  }

  const sorted = [...notes].sort((a, b) => a.zIndex - b.zIndex);
  const gridSize = 24 * vp.zoom;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-card)] flex-shrink-0 z-10">
        <span className="text-sm font-semibold text-[var(--color-foreground)] truncate flex-1">
          {board?.name ?? "Shared Board"}
        </span>
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-muted-foreground)] bg-[var(--color-muted)] px-2.5 py-1 rounded-full flex-shrink-0 uppercase tracking-wide">
          <Eye className="w-3 h-3" />
          View only
        </div>
      </div>

      {/* Canvas */}
      <div
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ userSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${vp.x % gridSize}px ${vp.y % gridSize}px`,
          }}
        />

        {/* Notes layer */}
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}
        >
          {sorted.map((note) => (
            <div
              key={note.id}
              data-noteid={note.id}
              className="absolute rounded-xl overflow-hidden shadow-md border border-[var(--color-border)]"
              style={{
                left: note.x,
                top: note.y,
                width: note.width,
                height: note.height,
                zIndex: note.zIndex,
              }}
            >
              <NoteContent note={note} />
            </div>
          ))}
        </div>

        {notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-[var(--color-muted-foreground)]">This board is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
