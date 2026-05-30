import { useRef, useCallback, useState, useEffect } from "react";
import { useStore, DEFAULT_VIEWPORT, applyThemeToDOM } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Canvas } from "@/components/canvas/Canvas";
import { Toolbar } from "@/components/canvas/Toolbar";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { NoteDetailModal } from "@/components/notes/NoteDetailModal";
import { usePaste } from "@/hooks/usePaste";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useRealtimeNotes } from "@/hooks/useRealtimeNotes";
import { ShareButton } from "@/components/share/ShareButton";
import { PanelLeft, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = 240;

function UserMenu({ userId }: { userId: string }) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, [userId]);

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span
        className="text-xs text-[var(--color-muted-foreground)] truncate max-w-[140px]"
        title={email}
      >
        {email}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={() => supabase?.auth.signOut()}
        title="Sign out"
      >
        <LogOut className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export default function App() {
  const activeBoardId  = useStore((s) => s.activeBoardId);
  const activeBoard    = useStore((s) =>
    s.activeBoardId ? s.boards.find((b) => b.id === s.activeBoardId) : undefined
  );
  const sidebarOpen   = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const viewport      = useStore((s) =>
    activeBoardId ? (s.viewports[activeBoardId] ?? DEFAULT_VIEWPORT) : DEFAULT_VIEWPORT
  );
  const userId = useStore((s) => s.userId);

  const containerRef   = useRef<HTMLDivElement>(null);
  const [sidebarWidth,  setSidebarWidth]  = useState(SIDEBAR_DEFAULT);
  const [resizing,      setResizing]      = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);

  // ── System theme change listener (when theme = "system") ────────────────────
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeToDOM("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // ── Canvas centre (for toolbar + paste spawning) ─────────────────────────────
  const getCanvasCenter = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (rect.width  / 2 - viewport.x) / viewport.zoom,
      y: (rect.height / 2 - viewport.y) / viewport.zoom,
    };
  }, [viewport]);

  usePaste({ boardId: activeBoardId ?? "", getCanvasCenter });
  useKeyboard(activeBoardId ?? "");
  useRealtimeNotes(activeBoardId);

  // ── Sidebar resize drag ───────────────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);

    const startX     = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (me: MouseEvent) => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth + me.clientX - startX));
      setSidebarWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [sidebarWidth]);

  if (!activeBoardId) {
    return (
      <div className="flex h-screen items-center justify-center text-[var(--color-muted-foreground)] text-sm">
        No board selected
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="relative flex-shrink-0 flex flex-col"
          style={{ width: sidebarWidth }}
        >
          <Sidebar />

          {/* Resize handle — sits on the right edge of the sidebar */}
          <div
            className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize z-20 group"
            onMouseDown={handleResizeStart}
          >
            {/* Highlight strip (shows on hover / while resizing) */}
            <div className={`h-full w-[2px] ml-[1.5px] rounded-full transition-colors ${
              resizing
                ? "bg-[var(--color-primary)]/60"
                : "bg-transparent group-hover:bg-[var(--color-primary)]/30"
            }`} />
          </div>
        </div>
      )}

      {/* Transparent full-screen overlay while resizing keeps cursor stable */}
      {resizing && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize select-none" />
      )}

      {/* ── Main area ─────────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-card)] flex-shrink-0 z-30">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
            <PanelLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-[var(--color-foreground)] truncate">
            {activeBoard?.name ?? "Board"}
          </span>
          <ShareButton boardId={activeBoardId} />

          {/* Right-side actions */}
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            {userId && <UserMenu userId={userId} />}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => setShowSettings((v) => !v)}
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <Canvas boardId={activeBoardId} />
        <Toolbar boardId={activeBoardId} canvasCenter={getCanvasCenter} />
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <NoteDetailModal />
    </div>
  );
}
