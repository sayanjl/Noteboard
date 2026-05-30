import { Link } from "lucide-react";
import type { Note } from "@/lib/types";

interface LinkNoteProps {
  note: Note;
}

export function LinkNote({ note }: LinkNoteProps) {
  const url = note.content.url ?? "";
  const title = note.content.linkTitle;           // undefined = loading
  const description = note.content.linkDescription;
  const image = note.content.linkImage;
  const favicon = note.content.linkFavicon;
  const isLoading = title === undefined;

  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}

  const openUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[var(--color-card)]">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        <span className="text-[10px] text-[var(--color-muted-foreground)] truncate max-w-[80%]">{host}</span>
      </div>
    );
  }

  const hasImage = !!image;

  return (
    <div
      className="w-full h-full flex flex-col bg-[var(--color-card)] overflow-hidden cursor-pointer select-none"
      onDoubleClick={openUrl}
    >
      {/* OG image banner */}
      {hasImage && (
        <div className="flex-shrink-0 w-full overflow-hidden bg-[var(--color-muted)]" style={{ height: "44%" }}>
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* Text section */}
      <div className="flex flex-col gap-1 p-3 flex-1 min-h-0 overflow-hidden">
        {/* Favicon + host */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              className="w-3.5 h-3.5 flex-shrink-0 rounded-sm"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <Link className="w-3.5 h-3.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
          )}
          <span className="text-[10px] font-medium text-[var(--color-muted-foreground)] uppercase tracking-wide truncate">
            {host}
          </span>
        </div>

        {/* Title */}
        {title ? (
          <p className="text-sm font-semibold text-[var(--color-foreground)] line-clamp-2 leading-snug flex-shrink-0">
            {title}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)] truncate flex-shrink-0">{url}</p>
        )}

        {/* Description — only show when no image (space is limited with image) */}
        {description && !hasImage && (
          <p className="text-xs text-[var(--color-muted-foreground)] line-clamp-2 leading-snug flex-shrink-0">
            {description}
          </p>
        )}

        {/* URL chip */}
        <div className="mt-auto pt-1 flex-shrink-0">
          <div className="inline-flex items-center gap-1 rounded-full bg-[var(--color-muted)] px-2 py-0.5 max-w-full overflow-hidden">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
            <span className="text-[9px] text-[var(--color-muted-foreground)] truncate leading-none">
              {host || url}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
