import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Trash2, GripHorizontal } from "lucide-react";
import { useStore } from "@/lib/store";
import { nanoid } from "@/lib/nanoid";
import type { Note, ColumnPanel } from "@/lib/types";

// ── Inline markdown renderer ──────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*"))
      return <em key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} className="font-mono text-[0.85em] bg-[var(--color-muted)] px-0.5 rounded">{p.slice(1, -1)}</code>;
    return p;
  });
}

function renderText(text: string): React.ReactNode {
  if (!text.trim()) return null;
  return text.split("\n").map((line, i) => {
    if (line.startsWith("# "))  return <p key={i} className="text-base font-bold leading-snug mb-1">{renderInline(line.slice(2))}</p>;
    if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold leading-snug mb-1">{renderInline(line.slice(3))}</p>;
    if (line.startsWith("### "))return <p key={i} className="text-xs font-bold leading-snug mb-1">{renderInline(line.slice(4))}</p>;
    if (line.startsWith("- ") || line.startsWith("* "))
      return <div key={i} className="flex gap-1.5 leading-relaxed"><span className="opacity-40 mt-px">•</span><span>{renderInline(line.slice(2))}</span></div>;
    if (/^\d+\.\s/.test(line)) {
      const [num, ...rest] = line.split(". ");
      return <div key={i} className="flex gap-1.5 leading-relaxed"><span className="opacity-40 min-w-[1.2em] text-right">{num}.</span><span>{renderInline(rest.join(". "))}</span></div>;
    }
    if (line.startsWith("> "))
      return <div key={i} className="border-l-2 border-[var(--color-primary)]/40 pl-2 text-[var(--color-muted-foreground)] leading-relaxed italic">{renderInline(line.slice(2))}</div>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i} className="leading-relaxed">{renderInline(line)}</p>;
  });
}

// ── Panel editor ──────────────────────────────────────────────────────────────

interface PanelProps {
  panel: ColumnPanel;
  isLast: boolean;
  canDelete: boolean;
  onChange: (text: string) => void;
  onDelete: () => void;
}

function Panel({ panel, isLast, canDelete, onChange, onDelete }: PanelProps) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      className={`flex-1 min-w-0 flex flex-col relative group/panel ${
        !isLast ? "border-r border-[var(--color-border)]" : ""
      }`}
    >
      {/* Delete column button — hover only, hidden when only 1 column */}
      {canDelete && (
        <button
          className="absolute top-1 right-1 z-10 opacity-0 group-hover/panel:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-red-500"
          onMouseDown={stop}
          onClick={(e) => { stop(e); onDelete(); }}
          title="Remove column"
        >
          <Trash2 size={10} />
        </button>
      )}

      {editing ? (
        <textarea
          ref={textareaRef}
          className="flex-1 w-full h-full resize-none bg-transparent text-xs leading-relaxed text-[var(--color-foreground)] p-2.5 outline-none border-none font-mono placeholder:text-[var(--color-muted-foreground)]"
          value={panel.text}
          placeholder="Type here… (markdown supported)"
          onMouseDown={stop}
          onChange={(e) => { stop(e); onChange(e.target.value); }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            stop(e);
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <div
          className="flex-1 p-2.5 text-xs text-[var(--color-foreground)] overflow-auto cursor-text"
          onMouseDown={stop}
          onClick={(e) => { stop(e); setEditing(true); }}
        >
          {panel.text
            ? renderText(panel.text)
            : <span className="text-[var(--color-muted-foreground)]">Click to edit…</span>
          }
        </div>
      )}
    </div>
  );
}

// ── ColumnNote ────────────────────────────────────────────────────────────────

export function makeDefaultColumnContent() {
  return {
    columnPanels: [
      { id: nanoid(8), text: "" },
      { id: nanoid(8), text: "" },
    ] satisfies ColumnPanel[],
  };
}

interface ColumnNoteProps { note: Note }

export function ColumnNote({ note }: ColumnNoteProps) {
  const updateNote = useStore((s) => s.updateNote);
  const panels: ColumnPanel[] = note.content.columnPanels ?? [];

  const save = useCallback(
    (next: ColumnPanel[]) => {
      updateNote(note.id, { content: { ...note.content, columnPanels: next } });
    },
    [note, updateNote]
  );

  const addPanel = () => {
    if (panels.length >= 4) return;
    save([...panels, { id: nanoid(8), text: "" }]);
  };

  const removePanel = (id: string) => {
    if (panels.length <= 1) return;
    save(panels.filter((p) => p.id !== id));
  };

  const updatePanel = (id: string, text: string) => {
    save(panels.map((p) => (p.id === id ? { ...p, text } : p)));
  };

  return (
    // Outer div: NO onMouseDown stop — drag handle below bubbles freely
    <div className="w-full h-full flex flex-col bg-[var(--color-card)] overflow-hidden">

      {/* Drag handle */}
      <div className="flex items-center justify-between h-5 px-2 flex-shrink-0 bg-[var(--color-muted)] border-b border-[var(--color-border)] cursor-grab select-none">
        <div className="flex items-center gap-1.5">
          <GripHorizontal size={11} className="text-[var(--color-muted-foreground)]" />
          <span className="text-[10px] text-[var(--color-muted-foreground)]">
            {panels.length} column{panels.length !== 1 ? "s" : ""}
          </span>
        </div>
        {/* Add column button */}
        {panels.length < 4 && (
          <button
            className="flex items-center gap-0.5 text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); addPanel(); }}
            title="Add column"
          >
            <Plus size={10} /> col
          </button>
        )}
      </div>

      {/* Columns — stopPropagation here prevents accidental drag while editing */}
      <div
        className="flex-1 flex overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {panels.map((panel, i) => (
          <Panel
            key={panel.id}
            panel={panel}
            isLast={i === panels.length - 1}
            canDelete={panels.length > 1}
            onChange={(text) => updatePanel(panel.id, text)}
            onDelete={() => removePanel(panel.id)}
          />
        ))}
      </div>
    </div>
  );
}
