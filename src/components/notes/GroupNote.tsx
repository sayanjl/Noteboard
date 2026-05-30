import { useState } from "react";
import { ChevronRight, ChevronDown, Layers } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Note } from "@/lib/types";

interface GroupNoteProps {
  note: Note;
}

export function GroupNote({ note }: GroupNoteProps) {
  const updateNote          = useStore((s) => s.updateNote);
  const toggleGroupCollapse = useStore((s) => s.toggleGroupCollapse);
  const notes               = useStore((s) => s.notesByBoard[note.boardId] ?? []);

  const collapsed   = note.content.collapsed ?? false;
  const name        = note.content.groupName ?? "Group";
  const memberCount = notes.filter((n) => n.content.groupId === note.id).length;

  const [editing,  setEditing]  = useState(false);
  const [editName, setEditName] = useState(name);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleGroupCollapse(note.id, note.boardId);
  };

  const handleNameDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setEditName(name);
  };

  const commitName = () => {
    setEditing(false);
    const trimmed = editName.trim() || "Group";
    if (trimmed !== name) {
      updateNote(note.id, { content: { ...note.content, groupName: trimmed } });
    }
  };

  return (
    // Outer container: pointer-events off so the empty body passes clicks through to the
    // NoteWrapper drag handler below (which sits at a lower z-index but still receives events
    // since this layer is transparent to pointer events).
    <div className="w-full h-full flex flex-col" style={{ pointerEvents: "none" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 h-11 shrink-0 rounded-t-lg bg-[var(--color-primary)]/10 border-b border-dashed border-[var(--color-primary)]/30 cursor-grab active:cursor-grabbing"
        style={{ pointerEvents: "auto" }}
      >
        {/* Collapse toggle */}
        <button
          className="w-5 h-5 flex items-center justify-center rounded text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleToggle}
          title={collapsed ? "Expand group" : "Collapse group"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Editable name */}
        {editing ? (
          <input
            className="flex-1 min-w-0 text-sm font-medium bg-transparent border-none outline-none text-[var(--color-foreground)]"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-sm font-medium text-[var(--color-foreground)] truncate cursor-text"
            onDoubleClick={handleNameDoubleClick}
          >
            {name}
          </span>
        )}

        {/* Member count badge */}
        <div className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] shrink-0">
          <Layers size={11} />
          <span>{memberCount}</span>
        </div>
      </div>

      {/* ── Body (expanded only) ────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="flex-1 rounded-b-lg bg-[var(--color-primary)]/5" />
      )}
    </div>
  );
}
