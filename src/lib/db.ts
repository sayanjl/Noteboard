import type { Note, NoteType, NoteContent, Board, Folder } from "./types";

// ── Row shapes (snake_case, as returned by Supabase) ─────────────────────────

export interface NoteRow {
  id: string;
  board_id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  content: Record<string, unknown>;
  color: string | null;
  font_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface BoardRow {
  id: string;
  name: string;
  parent_folder_id: string | null;
  owner_id: string;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderRow {
  id: string;
  name: string;
  parent_folder_id: string | null;
  owner_id: string;
  created_at: string;
}

// ── Converters ────────────────────────────────────────────────────────────────

export function noteToRow(n: Note): NoteRow {
  return {
    id: n.id,
    board_id: n.boardId,
    type: n.type,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    z_index: n.zIndex,
    content: n.content as Record<string, unknown>,
    color: n.color ?? null,
    font_size: n.fontSize ?? null,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}

export function rowToNote(r: NoteRow): Note {
  return {
    id: r.id,
    boardId: r.board_id,
    type: r.type as NoteType,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    zIndex: r.z_index,
    content: r.content as NoteContent,
    color: r.color ?? undefined,
    fontSize: r.font_size ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function boardToRow(b: Board): BoardRow {
  return {
    id: b.id,
    name: b.name,
    parent_folder_id: b.parentFolderId,
    owner_id: b.ownerId,
    share_token: b.shareToken,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}

export function rowToBoard(r: BoardRow): Board {
  return {
    id: r.id,
    name: r.name,
    parentFolderId: r.parent_folder_id,
    ownerId: r.owner_id,
    shareToken: r.share_token,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function folderToRow(f: Folder): FolderRow {
  return {
    id: f.id,
    name: f.name,
    parent_folder_id: f.parentFolderId,
    owner_id: f.ownerId,
    created_at: f.createdAt,
  };
}

export function rowToFolder(r: FolderRow): Folder {
  return {
    id: r.id,
    name: r.name,
    parentFolderId: r.parent_folder_id,
    ownerId: r.owner_id,
    createdAt: r.created_at,
  };
}
