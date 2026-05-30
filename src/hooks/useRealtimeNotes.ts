import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { rowToNote, type NoteRow } from "@/lib/db";

export function useRealtimeNotes(boardId: string | null) {
  const userId = useStore((s) => s.userId);
  const applyRemoteNote = useStore((s) => s._applyRemoteNote);
  const removeRemoteNote = useStore((s) => s._removeRemoteNote);

  useEffect(() => {
    if (!boardId || !userId || !supabase) return;

    const channel = supabase
      .channel(`notes-board-${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            applyRemoteNote(rowToNote(payload.new as NoteRow));
          } else if (payload.eventType === "DELETE") {
            removeRemoteNote((payload.old as { id: string }).id, boardId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [boardId, userId]);
}
