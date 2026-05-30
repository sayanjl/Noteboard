import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { Note } from "@/lib/types";

interface ImageNoteProps {
  note: Note;
}

export function ImageNote({ note }: ImageNoteProps) {
  const src = note.content.url ?? note.content.storagePath ?? "";
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="w-full h-full bg-[var(--color-muted)] flex flex-col items-center justify-center gap-2 text-[var(--color-muted-foreground)]">
        <ImageOff className="w-8 h-8 opacity-40" />
        <span className="text-xs opacity-60">{note.content.fileName ?? "Image"}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full group bg-[var(--color-muted)] overflow-hidden">
      <img
        src={src}
        alt={note.content.fileName ?? "Image"}
        className="w-full h-full object-contain"
        draggable={false}
        onError={() => setBroken(true)}
      />
      {note.content.fileName && (
        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
          {note.content.fileName}
        </div>
      )}
    </div>
  );
}
