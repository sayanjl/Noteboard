import { useState } from "react";
import { Share2, Copy, Check, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { generateShareToken, buildShareUrl } from "@/lib/share";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  boardId: string;
}

export function ShareButton({ boardId }: ShareButtonProps) {
  const board = useStore((s) => s.boards.find((b) => b.id === boardId));
  const setShareToken = useStore((s) => s.setShareToken);
  const [copied, setCopied] = useState(false);

  // Only show when Supabase is configured
  if (!supabase || !board) return null;

  const shareToken = board.shareToken;
  const shareUrl = shareToken ? buildShareUrl(shareToken) : null;

  const enable = () => setShareToken(boardId, generateShareToken());
  const revoke = () => setShareToken(boardId, null);

  const copyUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-2.5 flex-shrink-0">
          <Share2 className="w-3.5 h-3.5" />
          Share
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-xl animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Share board</h3>
            <Popover.Close asChild>
              <button className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Popover.Close>
          </div>

          {shareToken ? (
            <>
              <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
                Anyone with this link can view the board (read-only).
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl ?? ""}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-foreground)] outline-none cursor-text"
                />
                <Button
                  size="icon"
                  variant={copied ? "default" : "ghost"}
                  className="h-8 w-8 flex-shrink-0 transition-all"
                  onClick={copyUrl}
                  title="Copy link"
                >
                  {copied
                    ? <Check className="w-3.5 h-3.5" />
                    : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <button
                onClick={revoke}
                className="mt-2.5 text-xs text-red-500 hover:underline"
              >
                Revoke link
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
                Generate a shareable link so anyone can view this board without signing in.
              </p>
              <Button className="w-full h-8 text-sm" onClick={enable}>
                Create share link
              </Button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
