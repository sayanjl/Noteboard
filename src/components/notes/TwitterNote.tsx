import { Tweet } from "react-tweet";
import type { Note } from "@/lib/types";
import { getTwitterId } from "@/lib/embeds";

interface TwitterNoteProps {
  note: Note;
}

export function TwitterNote({ note }: TwitterNoteProps) {
  const url = note.content.url ?? "";
  const id = getTwitterId(url);

  if (!id) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--color-muted)] text-[var(--color-muted-foreground)] text-sm">
        Invalid Tweet URL
      </div>
    );
  }

  return (
    <div
      className="w-full h-full overflow-auto bg-white"
      style={{ "--tweet-container-margin": "0px" } as React.CSSProperties}
    >
      <Tweet id={id} />
    </div>
  );
}
