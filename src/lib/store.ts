import { create } from "zustand";
import type { Note, Board, Folder, Connection } from "./types";
import { nanoid } from "./nanoid";
import { supabase } from "./supabase";
import {
  noteToRow, rowToNote, boardToRow, rowToBoard,
  folderToRow, rowToFolder,
  type NoteRow, type BoardRow, type FolderRow,
} from "./db";
import {
  cacheSaveBoard, cacheSaveFolder, cacheSaveNote,
  cacheDeleteBoard, cacheDeleteFolder, cacheDeleteNote,
  cacheLoadBoards, cacheLoadFolders, cacheLoadNotes,
  cacheSaveConnection, cacheDeleteConnection, cacheLoadConnections,
} from "./sqliteCache";

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

const DEFAULT_BOARD_ID = "default-board";
export const DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };

// ── Theme + settings helpers (run synchronously before first render) ──────────

export type Theme = "light" | "dark" | "system";

export function applyThemeToDOM(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

function loadSetting<T>(key: string, fallback: T, parse?: (v: string) => T): T {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return parse ? parse(v) : (v as unknown as T);
  } catch { return fallback; }
}

const _theme      = loadSetting<Theme>("nb_theme",   "system");
const _dotGrid    = loadSetting("nb_dotgrid",   true,  (v) => v !== "false");
const _noteW      = loadSetting("nb_note_w",    240,   (v) => parseInt(v) || 240);
const _noteH      = loadSetting("nb_note_h",    160,   (v) => parseInt(v) || 160);
const _fontSize   = loadSetting("nb_font_size", 14,    (v) => parseInt(v) || 14);

// Apply theme immediately so there's no flash on load
applyThemeToDOM(_theme);

// ── Debounced Supabase note writes ────────────────────────────────────────────
const _pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedNoteWrite(note: Note) {
  if (!supabase) return;
  const { id } = note;
  if (_pendingWrites.has(id)) clearTimeout(_pendingWrites.get(id));
  _pendingWrites.set(id, setTimeout(() => {
    _pendingWrites.delete(id);
    if (!supabase) return;
    supabase.from("notes").upsert(noteToRow(note)).then(({ error }) => {
      if (error) console.error("[supabase] upsert note:", error.message);
    });
  }, 400));
}

// ── Store interface ───────────────────────────────────────────────────────────

interface AppState {
  boards: Board[];
  folders: Folder[];
  activeBoardId: string | null;
  notesByBoard: Record<string, Note[]>;
  selectedNoteIds: Record<string, true>;
  viewports: Record<string, CanvasViewport>;
  sidebarOpen: boolean;
  snapToGrid: boolean;

  userId: string | null;
  loadedBoards: Record<string, boolean>;
  connectionsByBoard: Record<string, Connection[]>;

  setActiveBoard: (id: string) => void;
  createBoard: (name: string, parentFolderId?: string | null) => Board;
  renameBoard: (id: string, name: string) => void;
  moveBoard: (boardId: string, folderId: string | null) => void;
  deleteBoard: (id: string) => void;

  createFolder: (name: string, parentFolderId?: string | null) => Folder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;

  addNote: (note: Omit<Note, "id" | "createdAt" | "updatedAt">) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;
  updateNotes: (patches: Array<{ id: string } & Partial<Note>>) => void;
  deleteNotes: (ids: string[]) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;

  setViewport: (boardId: string, vp: Partial<CanvasViewport>) => void;
  focusNote: (noteId: string, boardId: string) => void;

  detailNoteId: string | null;
  setDetailNote: (id: string | null) => void;
  toggleSidebar: () => void;
  toggleSnapToGrid: () => void;

  addConnection: (c: Omit<Connection, "id">) => void;
  deleteConnection: (id: string, boardId: string) => void;

  groupNotes: (noteIds: string[], boardId: string) => void;
  ungroupNotes: (groupId: string, boardId: string) => void;
  toggleGroupCollapse: (groupId: string, boardId: string) => void;

  // Live positions broadcast during drag so ArrowsLayer updates in real-time
  liveDragPositions: Record<string, { x: number; y: number }>;
  setLiveDragPosition: (id: string, pos: { x: number; y: number }) => void;
  clearLiveDragPositions: () => void;

  // User settings
  theme: Theme;
  showDotGrid: boolean;
  defaultNoteWidth: number;
  defaultNoteHeight: number;
  defaultFontSize: number;
  setTheme: (t: Theme) => void;
  toggleDotGrid: () => void;
  setNoteDefaults: (patch: { width?: number; height?: number; fontSize?: number }) => void;

  setUserId: (id: string | null) => void;
  setShareToken: (boardId: string, token: string | null) => void;
  loadFromCache: () => Promise<void>;
  hydrateFromSupabase: () => Promise<void>;
  loadBoardNotes: (boardId: string) => Promise<void>;
  _applyRemoteNote: (note: Note) => void;
  _removeRemoteNote: (id: string, boardId: string) => void;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const initialBoards: Board[] = [{
  id: DEFAULT_BOARD_ID,
  name: "My Board",
  parentFolderId: null,
  ownerId: "local",
  shareToken: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}];

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()((set, get) => ({
  boards: initialBoards,
  folders: [],
  activeBoardId: DEFAULT_BOARD_ID,
  notesByBoard: { [DEFAULT_BOARD_ID]: [] },
  selectedNoteIds: {},
  viewports: { [DEFAULT_BOARD_ID]: DEFAULT_VIEWPORT },
  sidebarOpen: true,
  snapToGrid: false,
  userId: null,
  loadedBoards: {},
  connectionsByBoard: { [DEFAULT_BOARD_ID]: [] },
  liveDragPositions: {},
  detailNoteId: null,
  theme: _theme,
  showDotGrid: _dotGrid,
  defaultNoteWidth: _noteW,
  defaultNoteHeight: _noteH,
  defaultFontSize: _fontSize,

  // ── Board actions ───────────────────────────────────────────────────────────

  setActiveBoard: (id) => {
    set({ activeBoardId: id, selectedNoteIds: {} });
    const { userId, loadedBoards, loadBoardNotes } = get();
    if (userId && !loadedBoards[id]) {
      loadBoardNotes(id);
    }
  },

  createBoard: (name, parentFolderId = null) => {
    const userId = get().userId ?? "local";
    const board: Board = {
      id: nanoid(), name, parentFolderId,
      ownerId: userId, shareToken: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    set((s) => ({
      boards: [...s.boards, board],
      notesByBoard: { ...s.notesByBoard, [board.id]: [] },
      viewports: { ...s.viewports, [board.id]: DEFAULT_VIEWPORT },
      loadedBoards: { ...s.loadedBoards, [board.id]: true },
    }));
    cacheSaveBoard(board).catch(console.error);
    if (supabase && userId !== "local") {
      supabase.from("boards").insert(boardToRow(board)).then(({ error }) => {
        if (error) console.error("[supabase] create board:", error.message);
      });
    }
    return board;
  },

  renameBoard: (id, name) => {
    const now = new Date().toISOString();
    set((s) => ({
      boards: s.boards.map((b) =>
        b.id === id ? { ...b, name, updatedAt: now } : b
      ),
    }));
    const board = get().boards.find((b) => b.id === id);
    if (board) cacheSaveBoard({ ...board, name, updatedAt: now }).catch(console.error);
    if (supabase) {
      supabase.from("boards").update({ name, updated_at: now }).eq("id", id).then(({ error }) => {
        if (error) console.error("[supabase] rename board:", error.message);
      });
    }
  },

  moveBoard: (boardId, folderId) => {
    set((s) => ({
      boards: s.boards.map((b) =>
        b.id === boardId ? { ...b, parentFolderId: folderId } : b
      ),
    }));
    const board = get().boards.find((b) => b.id === boardId);
    if (board) cacheSaveBoard({ ...board, parentFolderId: folderId }).catch(console.error);
    if (supabase) {
      supabase.from("boards").update({ parent_folder_id: folderId }).eq("id", boardId).then(({ error }) => {
        if (error) console.error("[supabase] move board:", error.message);
      });
    }
  },

  deleteBoard: (id) =>
    set((s) => {
      const remaining = s.boards.filter((b) => b.id !== id);
      const { [id]: _n, ...notesByBoard } = s.notesByBoard;
      const { [id]: _v, ...viewports } = s.viewports;
      const { [id]: _l, ...loadedBoards } = s.loadedBoards;
      cacheDeleteBoard(id).catch(console.error);
      if (supabase) {
        supabase.from("boards").delete().eq("id", id).then(({ error }) => {
          if (error) console.error("[supabase] delete board:", error.message);
        });
      }
      return {
        boards: remaining, notesByBoard, viewports, loadedBoards,
        activeBoardId:
          s.activeBoardId === id ? (remaining[0]?.id ?? null) : s.activeBoardId,
      };
    }),

  // ── Folder actions ──────────────────────────────────────────────────────────

  createFolder: (name, parentFolderId = null) => {
    const userId = get().userId ?? "local";
    const folder: Folder = {
      id: nanoid(), name, parentFolderId,
      ownerId: userId, createdAt: new Date().toISOString(),
    };
    set((s) => ({ folders: [...s.folders, folder] }));
    cacheSaveFolder(folder).catch(console.error);
    if (supabase && userId !== "local") {
      supabase.from("folders").insert(folderToRow(folder)).then(({ error }) => {
        if (error) console.error("[supabase] create folder:", error.message);
      });
    }
    return folder;
  },

  renameFolder: (id, name) => {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
    const folder = get().folders.find((f) => f.id === id);
    if (folder) cacheSaveFolder({ ...folder, name }).catch(console.error);
    if (supabase) {
      supabase.from("folders").update({ name }).eq("id", id).then(({ error }) => {
        if (error) console.error("[supabase] rename folder:", error.message);
      });
    }
  },

  deleteFolder: (id) => {
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      boards: s.boards.map((b) =>
        b.parentFolderId === id ? { ...b, parentFolderId: null } : b
      ),
    }));
    cacheDeleteFolder(id).catch(console.error);
    if (supabase) {
      supabase.from("folders").delete().eq("id", id).then(({ error }) => {
        if (error) console.error("[supabase] delete folder:", error.message);
      });
    }
  },

  // ── Note actions ────────────────────────────────────────────────────────────

  addNote: (partial) => {
    const note: Note = {
      ...partial, id: nanoid(),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    set((s) => ({
      notesByBoard: {
        ...s.notesByBoard,
        [note.boardId]: [...(s.notesByBoard[note.boardId] ?? []), note],
      },
    }));
    cacheSaveNote(note).catch(console.error);
    if (supabase && get().userId) {
      supabase.from("notes").insert(noteToRow(note)).then(({ error }) => {
        if (error) console.error("[supabase] add note:", error.message);
      });
    }
    return note;
  },

  updateNote: (id, patch) => {
    const boardId = get().activeBoardId;
    if (!boardId) return;
    let updated: Note | undefined;
    set((s) => {
      const notes = s.notesByBoard[boardId];
      if (!notes) return s;
      const newNotes = notes.map((n) => {
        if (n.id !== id) return n;
        updated = { ...n, ...patch, updatedAt: new Date().toISOString() };
        return updated;
      });
      return { notesByBoard: { ...s.notesByBoard, [boardId]: newNotes } };
    });
    if (updated) {
      cacheSaveNote(updated).catch(console.error);
      if (supabase && get().userId) debouncedNoteWrite(updated);
    }
  },

  updateNotes: (patches) => {
    const boardId = get().activeBoardId;
    if (!boardId) return;
    const patchMap = new Map(patches.map((p) => [p.id, p]));
    const updatedNotes: Note[] = [];
    set((s) => {
      const notes = s.notesByBoard[boardId];
      if (!notes) return s;
      return {
        notesByBoard: {
          ...s.notesByBoard,
          [boardId]: notes.map((n) => {
            const p = patchMap.get(n.id);
            if (!p) return n;
            const u = { ...n, ...p, updatedAt: new Date().toISOString() };
            updatedNotes.push(u);
            return u;
          }),
        },
      };
    });
    updatedNotes.forEach((u) => cacheSaveNote(u).catch(console.error));
    if (supabase && get().userId) updatedNotes.forEach(debouncedNoteWrite);
  },

  deleteNotes: (ids) => {
    const boardId = get().activeBoardId;
    if (!boardId) return;
    const idSet = new Set(ids);
    const allNotes = get().notesByBoard[boardId] ?? [];
    // Also remove connections that reference deleted notes
    const deadConns = (get().connectionsByBoard[boardId] ?? []).filter(
      (c) => idSet.has(c.fromNoteId) || idSet.has(c.toNoteId)
    );
    // If deleting a group note, collect its members to ungroup them
    const deletedGroupIds = ids.filter((id) => allNotes.find((n) => n.id === id)?.type === "group");
    const deletedGroupIdSet = new Set(deletedGroupIds);
    // Members that need cache update (their groupId is being removed)
    const ungroupedMembers: typeof allNotes = [];
    set((s) => {
      const next: Record<string, true> = { ...s.selectedNoteIds };
      ids.forEach((id) => delete next[id]);
      return {
        notesByBoard: {
          ...s.notesByBoard,
          [boardId]: (s.notesByBoard[boardId] ?? [])
            .filter((n) => !idSet.has(n.id))
            .map((n) => {
              if (n.content.groupId && deletedGroupIdSet.has(n.content.groupId)) {
                const { groupId: _g, ...newContent } = n.content;
                const updated = { ...n, content: newContent, updatedAt: new Date().toISOString() };
                ungroupedMembers.push(updated);
                return updated;
              }
              return n;
            }),
        },
        connectionsByBoard: {
          ...s.connectionsByBoard,
          [boardId]: (s.connectionsByBoard[boardId] ?? []).filter(
            (c) => !idSet.has(c.fromNoteId) && !idSet.has(c.toNoteId)
          ),
        },
        selectedNoteIds: next,
      };
    });
    ids.forEach((id) => cacheDeleteNote(id).catch(console.error));
    ungroupedMembers.forEach((n) => cacheSaveNote(n).catch(console.error));
    deadConns.forEach((c) => cacheDeleteConnection(c.id).catch(console.error));
    if (supabase && get().userId) {
      supabase.from("notes").delete().in("id", ids).then(({ error }) => {
        if (error) console.error("[supabase] delete notes:", error.message);
      });
    }
  },

  bringToFront: (id) => {
    const notes = get().notesByBoard[get().activeBoardId ?? ""] ?? [];
    const maxZ = notes.reduce((m, n) => Math.max(m, n.zIndex), 0);
    get().updateNote(id, { zIndex: maxZ + 1 });
  },

  sendToBack: (id) => {
    const notes = get().notesByBoard[get().activeBoardId ?? ""] ?? [];
    const minZ = notes.reduce((m, n) => Math.min(m, n.zIndex), 0);
    get().updateNote(id, { zIndex: minZ - 1 });
  },

  // ── Selection ────────────────────────────────────────────────────────────────

  setSelection: (ids) => {
    const next: Record<string, true> = {};
    ids.forEach((id) => { next[id] = true; });
    set({ selectedNoteIds: next });
  },

  toggleSelection: (id) =>
    set((s) => {
      if (s.selectedNoteIds[id]) {
        const next = { ...s.selectedNoteIds };
        delete next[id];
        return { selectedNoteIds: next };
      }
      return { selectedNoteIds: { ...s.selectedNoteIds, [id]: true } };
    }),

  clearSelection: () => set({ selectedNoteIds: {} }),

  // ── Viewport / UI ────────────────────────────────────────────────────────────

  setDetailNote: (id) => set({ detailNoteId: id }),

  focusNote: (noteId, boardId) => {
    const note = (get().notesByBoard[boardId] ?? []).find((n) => n.id === noteId);
    if (!note) return;
    // Estimate canvas area (window minus sidebar ~280px and topbar ~40px)
    const cw = Math.max(400, window.innerWidth  - 280);
    const ch = Math.max(300, window.innerHeight -  40);
    const pad = 80;
    const zoom = Math.min(2, Math.max(0.4,
      Math.min(cw / (note.width + pad * 2), ch / (note.height + pad * 2))
    ));
    get().setViewport(boardId, {
      x: cw / 2 - (note.x + note.width  / 2) * zoom,
      y: ch / 2 - (note.y + note.height / 2) * zoom,
      zoom,
    });
  },

  setViewport: (boardId, vp) =>
    set((s) => ({
      viewports: {
        ...s.viewports,
        [boardId]: { ...(s.viewports[boardId] ?? DEFAULT_VIEWPORT), ...vp },
      },
    })),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  // ── Connections ───────────────────────────────────────────────────────────────

  addConnection: (partial) => {
    const conn: Connection = { ...partial, id: nanoid() };
    // Don't create duplicates
    const existing = get().connectionsByBoard[conn.boardId] ?? [];
    if (existing.some((c) => c.fromNoteId === conn.fromNoteId && c.toNoteId === conn.toNoteId)) return;
    set((s) => ({
      connectionsByBoard: {
        ...s.connectionsByBoard,
        [conn.boardId]: [...(s.connectionsByBoard[conn.boardId] ?? []), conn],
      },
    }));
    cacheSaveConnection(conn).catch(console.error);
  },

  deleteConnection: (id, boardId) => {
    set((s) => ({
      connectionsByBoard: {
        ...s.connectionsByBoard,
        [boardId]: (s.connectionsByBoard[boardId] ?? []).filter((c) => c.id !== id),
      },
    }));
    cacheDeleteConnection(id).catch(console.error);
  },

  // ── Group actions ─────────────────────────────────────────────────────────────

  groupNotes: (noteIds, boardId) => {
    const notes = get().notesByBoard[boardId] ?? [];
    const members = notes.filter((n) => noteIds.includes(n.id));
    if (members.length < 2) return;

    const HEADER_HEIGHT = 44;
    const PADDING = 16;
    const minX = Math.min(...members.map((n) => n.x)) - PADDING;
    const minY = Math.min(...members.map((n) => n.y)) - HEADER_HEIGHT - PADDING;
    const maxX = Math.max(...members.map((n) => n.x + n.width)) + PADDING;
    const maxY = Math.max(...members.map((n) => n.y + n.height)) + PADDING;
    const minZ = Math.min(...members.map((n) => n.zIndex));
    const groupHeight = maxY - minY;

    const group: Note = {
      id: nanoid(), boardId,
      type: "group",
      x: minX, y: minY,
      width: maxX - minX, height: groupHeight,
      zIndex: minZ - 1,
      content: { groupName: "Group", collapsed: false, expandedHeight: groupHeight },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    set((s) => {
      const boardNotes = s.notesByBoard[boardId] ?? [];
      const updatedNotes = boardNotes.map((n) => {
        if (!noteIds.includes(n.id)) return n;
        return { ...n, content: { ...n.content, groupId: group.id }, updatedAt: new Date().toISOString() };
      });
      return {
        notesByBoard: { ...s.notesByBoard, [boardId]: [...updatedNotes, group] },
        selectedNoteIds: { [group.id]: true },
      };
    });

    cacheSaveNote(group).catch(console.error);
    members.forEach((m) => {
      const updated = { ...m, content: { ...m.content, groupId: group.id }, updatedAt: new Date().toISOString() };
      cacheSaveNote(updated).catch(console.error);
    });
  },

  ungroupNotes: (groupId, boardId) => {
    const notes = get().notesByBoard[boardId] ?? [];
    const members = notes.filter((n) => n.content.groupId === groupId);

    set((s) => {
      const boardNotes = s.notesByBoard[boardId] ?? [];
      return {
        notesByBoard: {
          ...s.notesByBoard,
          [boardId]: boardNotes
            .filter((n) => n.id !== groupId)
            .map((n) => {
              if (n.content.groupId !== groupId) return n;
              const { groupId: _g, ...newContent } = n.content;
              return { ...n, content: newContent, updatedAt: new Date().toISOString() };
            }),
        },
        selectedNoteIds: {},
      };
    });

    cacheDeleteNote(groupId).catch(console.error);
    members.forEach((m) => {
      const { groupId: _g, ...newContent } = m.content;
      cacheSaveNote({ ...m, content: newContent, updatedAt: new Date().toISOString() }).catch(console.error);
    });
  },

  toggleGroupCollapse: (groupId, boardId) => {
    const COLLAPSED_HEIGHT = 48;
    const notes = get().notesByBoard[boardId] ?? [];
    const group = notes.find((n) => n.id === groupId);
    if (!group) return;

    const willCollapse = !group.content.collapsed;
    const newHeight = willCollapse ? COLLAPSED_HEIGHT : (group.content.expandedHeight ?? group.height);
    const newContent = {
      ...group.content,
      collapsed: willCollapse,
      expandedHeight: willCollapse ? group.height : group.content.expandedHeight,
    };

    set((s) => ({
      notesByBoard: {
        ...s.notesByBoard,
        [boardId]: (s.notesByBoard[boardId] ?? []).map((n) =>
          n.id !== groupId ? n : { ...n, height: newHeight, content: newContent, updatedAt: new Date().toISOString() }
        ),
      },
    }));

    const updated = get().notesByBoard[boardId]?.find((n) => n.id === groupId);
    if (updated) cacheSaveNote(updated).catch(console.error);
  },

  setLiveDragPosition: (id, pos) =>
    set((s) => ({ liveDragPositions: { ...s.liveDragPositions, [id]: pos } })),

  clearLiveDragPositions: () => set({ liveDragPositions: {} }),

  // ── Settings ──────────────────────────────────────────────────────────────────

  setTheme: (theme) => {
    set({ theme });
    try { localStorage.setItem("nb_theme", theme); } catch {}
    applyThemeToDOM(theme);
  },

  toggleDotGrid: () =>
    set((s) => {
      const next = !s.showDotGrid;
      try { localStorage.setItem("nb_dotgrid", String(next)); } catch {}
      return { showDotGrid: next };
    }),

  setNoteDefaults: (patch) =>
    set((s) => {
      const next = {
        defaultNoteWidth:  patch.width    ?? s.defaultNoteWidth,
        defaultNoteHeight: patch.height   ?? s.defaultNoteHeight,
        defaultFontSize:   patch.fontSize ?? s.defaultFontSize,
      };
      try {
        localStorage.setItem("nb_note_w",    String(next.defaultNoteWidth));
        localStorage.setItem("nb_note_h",    String(next.defaultNoteHeight));
        localStorage.setItem("nb_font_size", String(next.defaultFontSize));
      } catch {}
      return next;
    }),

  // ── Supabase + cache sync ─────────────────────────────────────────────────────

  setUserId: (id) => set({ userId: id }),

  setShareToken: (boardId, token) => {
    set((s) => ({
      boards: s.boards.map((b) =>
        b.id === boardId ? { ...b, shareToken: token } : b
      ),
    }));
    const board = get().boards.find((b) => b.id === boardId);
    if (board) cacheSaveBoard({ ...board, shareToken: token }).catch(console.error);
    if (supabase) {
      supabase.from("boards").update({ share_token: token }).eq("id", boardId).then(({ error }) => {
        if (error) console.error("[supabase] set share token:", error.message);
      });
    }
  },

  loadFromCache: async () => {
    const [boards, folders] = await Promise.all([cacheLoadBoards(), cacheLoadFolders()]);
    if (boards.length === 0) return; // no cache yet

    const activeBoardId = boards[0].id;
    set({
      boards, folders, activeBoardId,
      notesByBoard: Object.fromEntries(boards.map((b) => [b.id, []])),
      connectionsByBoard: Object.fromEntries(boards.map((b) => [b.id, []])),
      loadedBoards: {},
      viewports: Object.fromEntries(boards.map((b) => [b.id, DEFAULT_VIEWPORT])),
      selectedNoteIds: {},
    });

    // Load cached notes + connections for active board
    const [notes, connections] = await Promise.all([
      cacheLoadNotes(activeBoardId),
      cacheLoadConnections(activeBoardId),
    ]);
    if (notes.length > 0 || connections.length > 0) {
      set((s) => ({
        notesByBoard: { ...s.notesByBoard, [activeBoardId]: notes },
        connectionsByBoard: { ...s.connectionsByBoard, [activeBoardId]: connections },
        loadedBoards: { ...s.loadedBoards, [activeBoardId]: true },
      }));
    }
  },

  hydrateFromSupabase: async () => {
    if (!supabase) return;
    const userId = get().userId;
    if (!userId) return;

    const [{ data: boardRows, error: boardErr }, { data: folderRows }] = await Promise.all([
      supabase.from("boards").select("*").order("created_at", { ascending: true }),
      supabase.from("folders").select("*").order("created_at", { ascending: true }),
    ]);

    if (boardErr) {
      console.error("[supabase] load boards:", boardErr.message);
      return;
    }

    let boards = (boardRows as BoardRow[] ?? []).map(rowToBoard);
    const folders = (folderRows as FolderRow[] ?? []).map(rowToFolder);

    // First-time user — create a default board
    if (boards.length === 0) {
      const now = new Date().toISOString();
      const board: Board = {
        id: nanoid(), name: "My Board", parentFolderId: null,
        ownerId: userId, shareToken: null, createdAt: now, updatedAt: now,
      };
      const { error } = await supabase.from("boards").insert(boardToRow(board));
      if (!error) boards = [board];
    }

    // Update cache with authoritative Supabase data
    boards.forEach((b) => cacheSaveBoard(b).catch(console.error));
    folders.forEach((f) => cacheSaveFolder(f).catch(console.error));

    const activeBoardId = boards[0]?.id ?? null;
    set({
      boards, folders, activeBoardId,
      notesByBoard: Object.fromEntries(boards.map((b) => [b.id, []])),
      connectionsByBoard: Object.fromEntries(boards.map((b) => [b.id, []])),
      loadedBoards: {},
      viewports: Object.fromEntries(boards.map((b) => [b.id, DEFAULT_VIEWPORT])),
      selectedNoteIds: {},
    });

    if (activeBoardId) {
      await get().loadBoardNotes(activeBoardId);
    }
  },

  loadBoardNotes: async (boardId: string) => {
    // 1. Show cached notes + connections immediately (zero latency)
    const [cached, cachedConns] = await Promise.all([
      cacheLoadNotes(boardId),
      cacheLoadConnections(boardId),
    ]);
    if (cached.length > 0 || cachedConns.length > 0) {
      set((s) => ({
        notesByBoard: { ...s.notesByBoard, [boardId]: cached },
        connectionsByBoard: { ...s.connectionsByBoard, [boardId]: cachedConns },
      }));
    }

    // 2. Fetch authoritative notes from Supabase
    if (!supabase) {
      set((s) => ({ loadedBoards: { ...s.loadedBoards, [boardId]: true } }));
      return;
    }
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("board_id", boardId)
      .order("z_index", { ascending: true });
    if (error) {
      console.error("[supabase] load notes:", error.message);
      set((s) => ({ loadedBoards: { ...s.loadedBoards, [boardId]: true } }));
      return;
    }
    const notes = (data as NoteRow[]).map(rowToNote);

    // 3. Update cache with fresh data
    notes.forEach((n) => cacheSaveNote(n).catch(console.error));

    set((s) => ({
      notesByBoard: { ...s.notesByBoard, [boardId]: notes },
      loadedBoards: { ...s.loadedBoards, [boardId]: true },
    }));
  },

  _applyRemoteNote: (note: Note) => {
    set((s) => {
      const notes = s.notesByBoard[note.boardId] ?? [];
      const idx = notes.findIndex((n) => n.id === note.id);
      if (idx >= 0) {
        if (note.updatedAt <= notes[idx].updatedAt) return s;
        const updated = [...notes];
        updated[idx] = note;
        return { notesByBoard: { ...s.notesByBoard, [note.boardId]: updated } };
      }
      return {
        notesByBoard: { ...s.notesByBoard, [note.boardId]: [...notes, note] },
      };
    });
    cacheSaveNote(note).catch(console.error);
  },

  _removeRemoteNote: (id: string, boardId: string) => {
    set((s) => ({
      notesByBoard: {
        ...s.notesByBoard,
        [boardId]: (s.notesByBoard[boardId] ?? []).filter((n) => n.id !== id),
      },
    }));
    cacheDeleteNote(id).catch(console.error);
  },
}));
