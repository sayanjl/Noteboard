import { useEffect, useState } from "react";
import type { Note } from "@/lib/types";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

interface InstagramNoteProps {
  note: Note;
}

export function InstagramNote({ note }: InstagramNoteProps) {
  const url = note.content.url ?? "";
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const process = () => {
      window.instgrm?.Embeds.process();
      setLoaded(true);
    };
    if (!document.getElementById("instagram-embed-script")) {
      const script = document.createElement("script");
      script.id = "instagram-embed-script";
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
      script.onload = process;
      document.body.appendChild(script);
    } else {
      process();
    }
  }, [url]);

  return (
    <div
      className="relative w-full h-full overflow-auto bg-white"
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="w-8 h-8 rounded-full border-2 border-pink-400 border-t-transparent animate-spin" />
        </div>
      )}
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ minWidth: 0, width: "100%" }}
      />
    </div>
  );
}
