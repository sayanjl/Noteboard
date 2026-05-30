import { nanoid } from "./nanoid";
import { supabase } from "./supabase";
import { rowToNote, rowToBoard, type NoteRow, type BoardRow } from "./db";
import type { Note, Board } from "./types";

export function generateShareToken(): string {
  return nanoid(20);
}

export function buildShareUrl(token: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/share/${token}`;
}

export async function fetchSharedBoard(token: string): Promise<Board | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_shared_board", { p_token: token });
  if (error || !data?.length) return null;
  return rowToBoard(data[0] as BoardRow);
}

export async function fetchSharedNotes(token: string): Promise<Note[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_shared_notes", { p_token: token });
  if (error || !data) return [];
  return (data as NoteRow[]).map(rowToNote);
}
