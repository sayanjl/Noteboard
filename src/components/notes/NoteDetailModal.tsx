import { useEffect } from "react";
import { X, Maximize2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { RichTextEditor } from "./RichTextEditor";
import { TableNote } from "./TableNote";
import { ColumnNote } from "./ColumnNote";
import { FileNote } from "./FileNote";
import { LinkNote } from "./LinkNote";
import { YouTubeNote } from "./YouTubeNote";
import { TwitterNote } from "./TwitterNote";
import { InstagramNote } from "./InstagramNote";
import type { Note } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<Note["type"], string> = {
  text: "Text note", image: "Image", file: "File", link: "Link",
  table: "Table", columns: "Columns", group: "Group",
  youtube: "YouTube", twitter: "Tweet", instagram: "Instagram",
};

function noteTitle(note: Note): string {
  switch (note.type) {
    case "text": {
      const line = (note.content.text ?? "")
        .replace(/^#{1,6}\s+/m, "").split("\n")[0].trim();
      return line.slice(0, 60) || "(empty)";
    }
    case "image":   return note.content.fileName ?? "Image";
    case "file":    return note.content.fileName ?? "File";
    case "link":    return note.content.linkTitle || note.content.url?.replace(/^https?:\/\//, "").slice(0, 60) || "Link";
    case "table":   return `Table · ${note.content.tableRows?.length ?? 0} rows`;
    case "columns": return `Columns · ${note.content.columnPanels?.length ?? 0} panels`;
    case "group":   return note.content.groupName ?? "Group";
    default:        return note.content.url?.replace(/^https?:\/\//, "").slice(0, 60) ?? note.type;
  }
}

// ── Text detail view ──────────────────────────────────────────────────────────

function TextDetail({ note }: { note: Note }) {
  const updateNote = useStore((s) => s.updateNote);
  const text = note.content.text ?? "";
  return (
    <RichTextEditor
      content={text}
      onChange={(md) => updateNote(note.id, { content: { ...note.content, text: md } })}
      editable
      showToolbar
      toolbarIconSize={14}
      placeholder="Start writing…"
      contentClassName="px-8 py-5 text-sm leading-relaxed"
    />
  );
}

// ── Per-type content ───────────────────────────────────────────────────────────

const WIDGET_TYPES = new Set(["table", "columns", "file", "youtube", "twitter", "instagram"]);

function DetailContent({ note }: { note: Note }) {
  const isWidget = WIDGET_TYPES.has(note.type);

  const inner = (() => {
    switch (note.type) {
      case "text":      return <TextDetail note={note} />;
      case "image":     return (
        <div className="flex-1 flex items-center justify-center p-8">
          <img
            src={note.content.url ?? note.content.storagePath ?? ""}
            alt={note.content.fileName ?? "Image"}
            className="max-w-full max-h-full object-contain rounded-xl shadow-sm"
            draggable={false}
          />
        </div>
      );
      case "link":      return <div className="flex-1 overflow-auto"><LinkNote note={note} /></div>;
      case "table":     return <TableNote    note={note} />;
      case "columns":   return <ColumnNote   note={note} />;
      case "file":      return <FileNote     note={note} />;
      case "youtube":   return <YouTubeNote  note={note} />;
      case "twitter":   return <TwitterNote  note={note} />;
      case "instagram": return <InstagramNote note={note} />;
      default:          return null;
    }
  })();

  if (isWidget) {
    return (
      <div className="flex flex-col" style={{ height: "clamp(320px, 55vh, 560px)" }}>
        {inner}
      </div>
    );
  }

  // text / image / link: fill the available modal height
  return <div className="flex-1 flex flex-col min-h-0">{inner}</div>;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function NoteDetailModal() {
  const detailNoteId  = useStore((s) => s.detailNoteId);
  const setDetailNote = useStore((s) => s.setDetailNote);
  const focusNote     = useStore((s) => s.focusNote);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const notes = useStore((s) => s.notesByBoard[activeBoardId ?? ""] ?? []);

  const note = notes.find((n) => n.id === detailNoteId) ?? null;

  // Close on Escape
  useEffect(() => {
    if (!note) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setDetailNote(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [note, setDetailNote]);

  if (!note) return null;

  const handleLocate = () => {
    setDetailNote(null);
    if (activeBoardId) focusNote(note.id, activeBoardId);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
      onClick={() => setDetailNote(null)}
    >
      <div
        className={`relative w-full max-w-4xl max-h-[88vh] bg-[var(--color-card)] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--color-border)] ${
          note.type === "text" ? "min-h-[65vh]" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-foreground)] truncate leading-snug">
              {noteTitle(note)}
            </p>
            <p className="text-[11px] text-[var(--color-muted-foreground)] capitalize leading-tight mt-0.5">
              {TYPE_LABEL[note.type]}
            </p>
          </div>

          {/* Locate on canvas */}
          <button
            className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors flex-shrink-0"
            onClick={handleLocate}
            title="Go to note on canvas"
          >
            <Maximize2 size={12} />
            Find on canvas
          </button>

          {/* Close */}
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors flex-shrink-0"
            onClick={() => setDetailNote(null)}
            title="Close (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col">
          <DetailContent note={note} />
        </div>
      </div>
    </div>
  );
}
