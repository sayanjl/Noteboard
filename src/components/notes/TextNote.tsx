import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Note } from "@/lib/types";
import { RichTextEditor } from "./RichTextEditor";

export function TextNote({ note }: { note: Note }) {
  const updateNote = useStore((s) => s.updateNote);
  const [editing, setEditing] = useState(false);

  const bg       = note.color ?? "var(--color-card)";
  const fontSize = note.fontSize ?? 14;
  const text     = note.content.text ?? "";

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: bg, fontSize }}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      <RichTextEditor
        content={text}
        onChange={(md) => updateNote(note.id, { content: { ...note.content, text: md } })}
        editable={editing}
        onBlur={() => setEditing(false)}
        showToolbar={editing}
        toolbarIconSize={12}
        placeholder="Double-click to edit…"
        contentClassName="px-3 py-2.5 text-[1em] leading-relaxed"
      />
    </div>
  );
}
