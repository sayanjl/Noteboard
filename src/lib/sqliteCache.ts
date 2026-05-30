/**
 * SQLite cache for offline-first loading.
 * Uses @tauri-apps/plugin-sql — only active when running inside Tauri.
 * All functions return empty/void silently when running in a browser.
 */

import type { Note, Board, Folder, Connection } from "./types";
import type { NoteType, NoteContent } from "./types";

// Tauri environment detection
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Lazy-initialized DB handle
let _db: import("@tauri-apps/plugin-sql").default | null = null;

async function getDb() {
  if (!isTauri) return null;
  if (!_db) {
    const Database = (await import("@tauri-apps/plugin-sql")).default;
    _db = await Database.load("sqlite:noteboard.db");
    await initSchema(_db);
  }
  return _db;
}

async function initSchema(db: import("@tauri-apps/plugin-sql").default) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS boards (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      parent_folder_id TEXT,
      owner_id         TEXT NOT NULL,
      share_token      TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS folders (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      parent_folder_id TEXT,
      owner_id         TEXT NOT NULL,
      created_at       TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      board_id   TEXT NOT NULL,
      type       TEXT NOT NULL,
      x          REAL NOT NULL,
      y          REAL NOT NULL,
      width      REAL NOT NULL,
      height     REAL NOT NULL,
      z_index    INTEGER NOT NULL DEFAULT 0,
      content    TEXT NOT NULL DEFAULT '{}',
      color      TEXT,
      font_size  INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS connections (
      id           TEXT PRIMARY KEY,
      board_id     TEXT NOT NULL,
      from_note_id TEXT NOT NULL,
      to_note_id   TEXT NOT NULL
    )
  `);
}

// ── Row shapes ─────────────────────────────────────────────────────────────────

interface BoardRow {
  id: string; name: string; parent_folder_id: string | null;
  owner_id: string; share_token: string | null;
  created_at: string; updated_at: string;
}
interface FolderRow {
  id: string; name: string; parent_folder_id: string | null;
  owner_id: string; created_at: string;
}
interface NoteRow {
  id: string; board_id: string; type: string;
  x: number; y: number; width: number; height: number;
  z_index: number; content: string;
  color: string | null; font_size: number | null;
  created_at: string; updated_at: string;
}
interface ConnectionRow {
  id: string; board_id: string; from_note_id: string; to_note_id: string;
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export async function cacheLoadBoards(): Promise<Board[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select<BoardRow[]>("SELECT * FROM boards ORDER BY created_at");
    return rows.map((r) => ({
      id: r.id, name: r.name,
      parentFolderId: r.parent_folder_id,
      ownerId: r.owner_id, shareToken: r.share_token,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  } catch { return []; }
}

export async function cacheLoadFolders(): Promise<Folder[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select<FolderRow[]>("SELECT * FROM folders ORDER BY created_at");
    return rows.map((r) => ({
      id: r.id, name: r.name,
      parentFolderId: r.parent_folder_id,
      ownerId: r.owner_id, createdAt: r.created_at,
    }));
  } catch { return []; }
}

export async function cacheLoadNotes(boardId: string): Promise<Note[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select<NoteRow[]>(
      "SELECT * FROM notes WHERE board_id = ? ORDER BY z_index",
      [boardId]
    );
    return rows.map((r) => ({
      id: r.id, boardId: r.board_id, type: r.type as NoteType,
      x: r.x, y: r.y, width: r.width, height: r.height,
      zIndex: r.z_index,
      content: JSON.parse(r.content) as NoteContent,
      color: r.color ?? undefined,
      fontSize: r.font_size ?? undefined,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  } catch { return []; }
}

// ── Writes ─────────────────────────────────────────────────────────────────────

export async function cacheSaveBoard(b: Board): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      `INSERT OR REPLACE INTO boards (id,name,parent_folder_id,owner_id,share_token,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [b.id, b.name, b.parentFolderId ?? null, b.ownerId, b.shareToken ?? null, b.createdAt, b.updatedAt]
    );
  } catch (e) { console.error("[sqlite] save board:", e); }
}

export async function cacheSaveFolder(f: Folder): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      `INSERT OR REPLACE INTO folders (id,name,parent_folder_id,owner_id,created_at)
       VALUES (?,?,?,?,?)`,
      [f.id, f.name, f.parentFolderId ?? null, f.ownerId, f.createdAt]
    );
  } catch (e) { console.error("[sqlite] save folder:", e); }
}

export async function cacheSaveNote(n: Note): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      `INSERT OR REPLACE INTO notes
       (id,board_id,type,x,y,width,height,z_index,content,color,font_size,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [n.id, n.boardId, n.type, n.x, n.y, n.width, n.height, n.zIndex,
       JSON.stringify(n.content), n.color ?? null, n.fontSize ?? null,
       n.createdAt, n.updatedAt]
    );
  } catch (e) { console.error("[sqlite] save note:", e); }
}

export async function cacheDeleteNote(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try { await db.execute("DELETE FROM notes WHERE id = ?", [id]); }
  catch (e) { console.error("[sqlite] delete note:", e); }
}

export async function cacheDeleteBoard(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try { await db.execute("DELETE FROM boards WHERE id = ?", [id]); }
  catch (e) { console.error("[sqlite] delete board:", e); }
}

export async function cacheDeleteFolder(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try { await db.execute("DELETE FROM folders WHERE id = ?", [id]); }
  catch (e) { console.error("[sqlite] delete folder:", e); }
}

export async function cacheLoadConnections(boardId: string): Promise<Connection[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select<ConnectionRow[]>(
      "SELECT * FROM connections WHERE board_id = ?", [boardId]
    );
    return rows.map((r) => ({
      id: r.id, boardId: r.board_id,
      fromNoteId: r.from_note_id, toNoteId: r.to_note_id,
    }));
  } catch { return []; }
}

export async function cacheSaveConnection(c: Connection): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      `INSERT OR REPLACE INTO connections (id, board_id, from_note_id, to_note_id) VALUES (?,?,?,?)`,
      [c.id, c.boardId, c.fromNoteId, c.toNoteId]
    );
  } catch (e) { console.error("[sqlite] save connection:", e); }
}

export async function cacheDeleteConnection(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try { await db.execute("DELETE FROM connections WHERE id = ?", [id]); }
  catch (e) { console.error("[sqlite] delete connection:", e); }
}
