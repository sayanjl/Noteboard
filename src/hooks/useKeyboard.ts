import { useEffect } from "react";
import { useStore } from "@/lib/store";
import type { Note } from "@/lib/types";

const EMPTY_NOTES: Note[] = [];

export function useKeyboard(boardId: string) {
  const deleteNotes = useStore((s) => s.deleteNotes);
  const selectedNoteIds = useStore((s) => s.selectedNoteIds);
  const updateNote = useStore((s) => s.updateNote);
  const notes = useStore((s) => s.notesByBoard[boardId] ?? EMPTY_NOTES);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const ids = Object.keys(selectedNoteIds);
      if (ids.length === 0) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteNotes(ids);
        return;
      }

      const NUDGE = e.shiftKey ? 10 : 2;
      const dx = e.key === "ArrowLeft" ? -NUDGE : e.key === "ArrowRight" ? NUDGE : 0;
      const dy = e.key === "ArrowUp" ? -NUDGE : e.key === "ArrowDown" ? NUDGE : 0;
      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        ids.forEach((id) => {
          const note = notes.find((n) => n.id === id);
          if (note) updateNote(id, { x: note.x + dx, y: note.y + dy });
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteNotes, selectedNoteIds, updateNote, notes]);
}
