import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { classifyUrl, isUrl } from "@/lib/embeds";
import type { Note } from "@/lib/types";

const EMPTY_NOTES: Note[] = [];

interface UsePasteOptions {
  boardId: string;
  getCanvasCenter: () => { x: number; y: number };
}

export function usePaste({ boardId, getCanvasCenter }: UsePasteOptions) {
  const addNote = useStore((s) => s.addNote);
  const notes = useStore((s) => s.notesByBoard[boardId] ?? EMPTY_NOTES);

  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      // Don't intercept if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const items = Array.from(e.clipboardData?.items ?? []);
      const maxZ = notes.reduce((m, n) => Math.max(m, n.zIndex), 0);
      const center = getCanvasCenter();
      const spawnAt = { x: center.x - 120, y: center.y - 80 };

      const spawn = (partial: Omit<Note, "id" | "boardId" | "createdAt" | "updatedAt" | "zIndex" | "x" | "y">) =>
        addNote({ ...partial, boardId, zIndex: maxZ + 1, x: spawnAt.x, y: spawnAt.y });

      // Check for image data
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          spawn({ type: "image", width: 280, height: 200, content: { url, fileName: "pasted-image" } });
          return;
        }
      }

      // Text / URL
      const textItem = items.find((i) => i.kind === "string" && i.type === "text/plain");
      if (!textItem) return;

      textItem.getAsString((text) => {
        const trimmed = text.trim();
        if (isUrl(trimmed)) {
          const kind = classifyUrl(trimmed);
          if (kind === "youtube") {
            spawn({ type: "youtube", width: 320, height: 200, content: { url: trimmed } });
          } else if (kind === "twitter") {
            spawn({ type: "twitter", width: 280, height: 320, content: { url: trimmed } });
          } else if (kind === "instagram") {
            spawn({ type: "instagram", width: 280, height: 360, content: { url: trimmed } });
          } else {
            spawn({ type: "link", width: 240, height: 120, content: { url: trimmed } });
          }
        } else {
          spawn({ type: "text", width: 240, height: 160, content: { text: trimmed }, color: "#fef9c3" });
        }
      });
    };

    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [boardId, addNote, notes, getCanvasCenter]);
}
