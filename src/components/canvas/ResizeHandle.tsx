import React, { useRef } from "react";
import { useStore } from "@/lib/store";
import type { Note } from "@/lib/types";

interface ResizeHandleProps {
  note: Note;
  screenToCanvas: (sx: number, sy: number) => { x: number; y: number };
}

const MIN_SIZE = 80;

export function ResizeHandle({ note, screenToCanvas }: ResizeHandleProps) {
  const updateNote = useStore((s) => s.updateNote);
  const startRef = useRef({ mx: 0, my: 0, w: 0, h: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const cp = screenToCanvas(e.clientX, e.clientY);
    startRef.current = { mx: cp.x, my: cp.y, w: note.width, h: note.height };

    const onMove = (me: MouseEvent) => {
      const cp = screenToCanvas(me.clientX, me.clientY);
      const dx = cp.x - startRef.current.mx;
      const dy = cp.y - startRef.current.my;
      updateNote(note.id, {
        width: Math.max(MIN_SIZE, startRef.current.w + dx),
        height: Math.max(MIN_SIZE, startRef.current.h + dy),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
      style={{ pointerEvents: "auto" }}
      onMouseDown={onMouseDown}
    >
      <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-sm bg-[var(--color-primary)] opacity-80" />
    </div>
  );
}
