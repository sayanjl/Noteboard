export type NoteType =
  | "text"
  | "image"
  | "youtube"
  | "twitter"
  | "instagram"
  | "file"
  | "link"
  | "group"
  | "table"
  | "columns";

// ── Table types ───────────────────────────────────────────────────────────────

export type ColumnType = "text" | "number" | "date" | "checkbox" | "select";

export interface TableColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[]; // select type only
}

export interface TableRow {
  id: string;
  cells: Record<string, string>; // columnId → value (always string; parsed per type)
}

// ── Column-layout types ───────────────────────────────────────────────────────

export interface ColumnPanel {
  id: string;
  text: string;
}

export interface NoteContent {
  text?: string;
  url?: string;
  storagePath?: string;
  fileName?: string;
  fileExtension?: string;
  mimeType?: string;
  fileSize?: number;
  linkTitle?: string;
  linkDescription?: string;
  linkImage?: string;
  linkFavicon?: string;
  // ── Group fields ──────────────────────────────────────────────────────────
  groupId?: string;        // member notes: ID of the parent group note
  groupName?: string;      // group notes: display label
  collapsed?: boolean;     // group notes: whether the group is collapsed
  expandedHeight?: number; // group notes: height when expanded (saved before collapse)
  // ── Table fields ──────────────────────────────────────────────────────────
  tableColumns?: TableColumn[];
  tableRows?: TableRow[];
  // ── Column-layout fields ──────────────────────────────────────────────────
  columnPanels?: ColumnPanel[];
}

export interface Note {
  id: string;
  boardId: string;
  type: NoteType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  content: NoteContent;
  color?: string;
  fontSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  name: string;
  parentFolderId: string | null;
  ownerId: string;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentFolderId: string | null;
  ownerId: string;
  createdAt: string;
}

export interface Connection {
  id: string;
  boardId: string;
  fromNoteId: string;
  toNoteId: string;
}

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}
