import { useState } from "react";
import { Play } from "lucide-react";
import type { Note } from "@/lib/types";
import { getYouTubeId } from "@/lib/embeds";

interface YouTubeNoteProps {
  note: Note;
}

export function YouTubeNote({ note }: YouTubeNoteProps) {
  const url = note.content.url ?? "";
  const id = getYouTubeId(url);
  const [active, setActive] = useState(false);

  if (!id) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--color-muted)] text-[var(--color-muted-foreground)] text-sm">
        Invalid YouTube URL
      </div>
    );
  }

  const thumb = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

  if (!active) {
    return (
      <div
        className="relative w-full h-full bg-black overflow-hidden cursor-pointer group"
        onClick={() => setActive(true)}
      >
        <img src={thumb} alt="YouTube thumbnail" className="w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black">
      <iframe
        className="w-full h-full"
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  );
}
