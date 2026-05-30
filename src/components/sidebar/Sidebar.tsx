import { useState } from "react";
import {
  Plus, Folder, FolderOpen, FileText, ChevronRight, ChevronDown,
  Search, Pencil, Trash2, FolderInput, Loader2,
  Image, Link, File, Layers, Table2, Columns2, Play, AlignLeft,
} from "lucide-react";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from "@radix-ui/react-context-menu";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Board, Folder as FolderType, Note } from "@/lib/types";

// ── Shared context-menu item style ────────────────────────────────────────────
const menuItemCls =
  "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md cursor-default select-none outline-none " +
  "text-[var(--color-foreground)] data-[highlighted]:bg-[var(--color-muted)] transition-colors";
const menuDestructiveCls =
  "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md cursor-default select-none outline-none " +
  "text-red-500 data-[highlighted]:bg-red-50 transition-colors";
const menuContentCls =
  "z-50 min-w-[160px] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-xl " +
  "animate-in fade-in-0 zoom-in-95";

// ── Note type icon ────────────────────────────────────────────────────────────

function NoteIcon({ type }: { type: Note["type"] }) {
  const cls = "w-3 h-3 flex-shrink-0 opacity-60";
  switch (type) {
    case "text":      return <AlignLeft className={cls} />;
    case "image":     return <Image     className={cls} />;
    case "file":      return <File      className={cls} />;
    case "link":      return <Link      className={cls} />;
    case "table":     return <Table2    className={cls} />;
    case "columns":   return <Columns2  className={cls} />;
    case "group":     return <Layers    className={cls} />;
    case "youtube":
    case "twitter":
    case "instagram": return <Play      className={cls} />;
    default:          return <FileText  className={cls} />;
  }
}

// ── Note preview label ────────────────────────────────────────────────────────

function noteLabel(note: Note): string {
  switch (note.type) {
    case "text": {
      const firstLine = (note.content.text ?? "")
        .split("\n")
        .find((l) => l.trim().length > 0) ?? "";
      return firstLine.replace(/^#{1,6}\s+/, "").trim().slice(0, 48) || "(empty)";
    }
    case "image":   return note.content.fileName ?? "Image";
    case "file":    return note.content.fileName ?? "File";
    case "link":    return (
      note.content.linkTitle ||
      note.content.url?.replace(/^https?:\/\//, "").slice(0, 40) ||
      "Link"
    );
    case "table": {
      const r = note.content.tableRows?.length    ?? 0;
      const c = note.content.tableColumns?.length ?? 0;
      return `${r} rows · ${c} cols`;
    }
    case "columns": {
      const n = note.content.columnPanels?.length ?? 0;
      return `${n} column${n !== 1 ? "s" : ""}`;
    }
    case "group":   return note.content.groupName ?? "Group";
    case "youtube":
    case "twitter":
    case "instagram":
      return note.content.url?.replace(/^https?:\/\//, "").slice(0, 40) ?? note.type;
    default:        return note.type;
  }
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const boards        = useStore((s) => s.boards);
  const folders       = useStore((s) => s.folders);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const userId        = useStore((s) => s.userId);
  const loadedBoards  = useStore((s) => s.loadedBoards);
  const setActiveBoard  = useStore((s) => s.setActiveBoard);
  const createBoard   = useStore((s) => s.createBoard);
  const createFolder  = useStore((s) => s.createFolder);

  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleFolder = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const query = search.toLowerCase();
  const matchesSearch = (name: string) => !query || name.toLowerCase().includes(query);

  const rootFolders = folders.filter((f) => !f.parentFolderId && matchesSearch(f.name));
  const rootBoards  = boards.filter((b)  => !b.parentFolderId && matchesSearch(b.name));

  const handleNewBoard = (parentFolderId?: string | null) => {
    const name = prompt("Board name:")?.trim();
    if (!name) return;
    const board = createBoard(name, parentFolderId);
    setActiveBoard(board.id);
  };
  const handleNewFolder = () => {
    const name = prompt("Folder name:")?.trim();
    if (name) createFolder(name);
  };

  return (
    <aside className="flex flex-col h-full w-full border-r border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold text-[var(--color-foreground)]">Boards</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="New folder" onClick={handleNewFolder}>
            <Folder className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="New board" onClick={() => handleNewBoard(null)}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <input
            className="bg-transparent text-sm flex-1 outline-none text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {rootFolders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder} folders={folders} boards={boards}
            activeBoardId={activeBoardId} userId={userId} loadedBoards={loadedBoards}
            expanded={expanded} toggleFolder={toggleFolder}
            setActiveBoard={setActiveBoard} matchesSearch={matchesSearch}
            depth={0} onNewBoard={handleNewBoard}
          />
        ))}
        {rootBoards.map((board) => (
          <BoardRow
            key={board.id}
            board={board} active={board.id === activeBoardId}
            userId={userId} loadedBoards={loadedBoards} folders={folders}
            onClick={() => setActiveBoard(board.id)} depth={0}
          />
        ))}
        {rootFolders.length === 0 && rootBoards.length === 0 && (
          <p className="text-xs text-[var(--color-muted-foreground)] px-2 py-3 text-center">
            {query ? "No results" : "No boards yet"}
          </p>
        )}
      </div>
    </aside>
  );
}

// ── FolderRow ─────────────────────────────────────────────────────────────────

function FolderRow({
  folder, folders, boards, activeBoardId, userId, loadedBoards,
  expanded, toggleFolder, setActiveBoard, matchesSearch, depth, onNewBoard,
}: {
  folder: FolderType; folders: FolderType[]; boards: Board[];
  activeBoardId: string | null; userId: string | null;
  loadedBoards: Record<string, boolean>;
  expanded: Set<string>; toggleFolder: (id: string) => void;
  setActiveBoard: (id: string) => void; matchesSearch: (n: string) => boolean;
  depth: number; onNewBoard: (id?: string | null) => void;
}) {
  const renameFolder = useStore((s) => s.renameFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const isOpen       = expanded.has(folder.id);
  const childFolders = folders.filter((f) => f.parentFolderId === folder.id && matchesSearch(f.name));
  const childBoards  = boards.filter((b)  => b.parentFolderId === folder.id && matchesSearch(b.name));
  const FolderIconEl = isOpen ? FolderOpen : Folder;

  const handleRename = () => {
    const name = prompt("Rename folder:", folder.name)?.trim();
    if (name && name !== folder.name) renameFolder(folder.id, name);
  };
  const handleDelete = () => {
    const inside = boards.filter((b) => b.parentFolderId === folder.id).length;
    const msg = inside > 0
      ? `Delete "${folder.name}" and move its ${inside} board(s) to root?`
      : `Delete folder "${folder.name}"?`;
    if (confirm(msg)) deleteFolder(folder.id);
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            className="flex items-center gap-1.5 w-full py-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors text-left"
            style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: 8 }}
            onClick={() => toggleFolder(folder.id)}
          >
            {isOpen
              ? <ChevronDown  className="w-3.5 h-3.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
            }
            <FolderIconEl className="w-3.5 h-3.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
            <span className="text-sm truncate text-[var(--color-foreground)]">{folder.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className={menuContentCls}>
          <ContextMenuItem className={menuItemCls} onSelect={() => onNewBoard(folder.id)}>
            <Plus className="w-3.5 h-3.5" /> New Board inside
          </ContextMenuItem>
          <ContextMenuItem className={menuItemCls} onSelect={handleRename}>
            <Pencil className="w-3.5 h-3.5" /> Rename
          </ContextMenuItem>
          <ContextMenuSeparator className="h-px bg-[var(--color-border)] my-1" />
          <ContextMenuItem className={menuDestructiveCls} onSelect={handleDelete}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isOpen && (
        <div>
          {childFolders.map((f) => (
            <FolderRow
              key={f.id} folder={f} folders={folders} boards={boards}
              activeBoardId={activeBoardId} userId={userId} loadedBoards={loadedBoards}
              expanded={expanded} toggleFolder={toggleFolder} setActiveBoard={setActiveBoard}
              matchesSearch={matchesSearch} depth={depth + 1} onNewBoard={onNewBoard}
            />
          ))}
          {childBoards.map((b) => (
            <BoardRow
              key={b.id} board={b} active={b.id === activeBoardId}
              userId={userId} loadedBoards={loadedBoards} folders={folders}
              onClick={() => setActiveBoard(b.id)} depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── BoardRow ──────────────────────────────────────────────────────────────────

function BoardRow({
  board, active, userId, loadedBoards, folders, onClick, depth,
}: {
  board: Board; active: boolean; userId: string | null;
  loadedBoards: Record<string, boolean>; folders: FolderType[];
  onClick: () => void; depth: number;
}) {
  const renameBoard   = useStore((s) => s.renameBoard);
  const deleteBoard   = useStore((s) => s.deleteBoard);
  const moveBoard     = useStore((s) => s.moveBoard);
  const setDetailNote = useStore((s) => s.setDetailNote);
  // Subscribe to notes so the list updates in real-time
  const notes         = useStore((s) => s.notesByBoard[board.id] ?? []);

  const isLoading = active && !!userId && !loadedBoards[board.id];

  // Top-level notes only (no group members, no group containers) sorted newest-front first
  const visibleNotes = notes
    .filter((n) => !n.content.groupId && n.type !== "group")
    .sort((a, b) => b.zIndex - a.zIndex);

  const [notesOpen, setNotesOpen] = useState(true);

  const handleRename = () => {
    const name = prompt("Rename board:", board.name)?.trim();
    if (name && name !== board.name) renameBoard(board.id, name);
  };
  const handleDelete = () => {
    if (confirm(`Delete board "${board.name}"? All notes will be lost.`)) deleteBoard(board.id);
  };

  const pl = `${24 + depth * 16}px`;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 w-full py-1.5 rounded-lg transition-colors text-left",
              active
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
            )}
            style={{ paddingLeft: pl, paddingRight: 8 }}
            onClick={onClick}
          >
            {/* Expand/collapse toggle — visible when active */}
            {active ? (
              <button
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setNotesOpen((v) => !v); }}
                title={notesOpen ? "Collapse notes" : "Expand notes"}
              >
                {notesOpen
                  ? <ChevronDown  className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />
                }
              </button>
            ) : (
              <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
            )}

            <span className="text-sm truncate flex-1">{board.name}</span>

            {/* Note count badge */}
            {active && visibleNotes.length > 0 && (
              <span className="text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded-full bg-white/20 leading-none">
                {visibleNotes.length}
              </span>
            )}
            {isLoading && <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin opacity-70" />}
          </button>
        </ContextMenuTrigger>

        <ContextMenuContent className={menuContentCls}>
          <ContextMenuItem className={menuItemCls} onSelect={handleRename}>
            <Pencil className="w-3.5 h-3.5" /> Rename
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger className={menuItemCls}>
              <FolderInput className="w-3.5 h-3.5" /> Move to folder
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className={menuContentCls}>
              <ContextMenuItem
                className={menuItemCls}
                onSelect={() => moveBoard(board.id, null)}
                style={{ opacity: board.parentFolderId ? 1 : 0.4 }}
              >
                Root (no folder)
              </ContextMenuItem>
              {folders.length > 0 && <ContextMenuSeparator className="h-px bg-[var(--color-border)] my-1" />}
              {folders.map((f) => (
                <ContextMenuItem
                  key={f.id} className={menuItemCls}
                  onSelect={() => moveBoard(board.id, f.id)}
                  style={{ opacity: board.parentFolderId === f.id ? 0.4 : 1 }}
                >
                  <Folder className="w-3.5 h-3.5" /> {f.name}
                </ContextMenuItem>
              ))}
              {folders.length === 0 && (
                <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">No folders yet</p>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator className="h-px bg-[var(--color-border)] my-1" />
          <ContextMenuItem className={menuDestructiveCls} onSelect={handleDelete}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* ── Note list ─────────────────────────────────────────────────────── */}
      {active && notesOpen && visibleNotes.length > 0 && (
        <div className="mt-0.5 mb-1">
          {visibleNotes.map((note) => (
            <button
              key={note.id}
              className="flex items-center gap-2 w-full py-1 rounded-lg hover:bg-[var(--color-muted)] transition-colors text-left group"
              style={{ paddingLeft: `${40 + depth * 16}px`, paddingRight: 8 }}
              onClick={() => setDetailNote(note.id)}
              title={noteLabel(note)}
            >
              <NoteIcon type={note.type} />
              <span className="text-xs text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)] truncate flex-1 transition-colors">
                {noteLabel(note)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
