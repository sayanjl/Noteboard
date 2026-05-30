import React from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Note } from "@/lib/types";

const NOTE_COLORS = [
  { value: "#fef9c3", label: "Yellow" },
  { value: "#fce7f3", label: "Pink" },
  { value: "#dbeafe", label: "Blue" },
  { value: "#dcfce7", label: "Green" },
  { value: "#f3e8ff", label: "Purple" },
  { value: "#ffedd5", label: "Orange" },
  { value: "#f1f5f9", label: "Slate" },
];

const FONT_SIZES = [
  { label: "S", value: 12 },
  { label: "M", value: 14 },
  { label: "L", value: 18 },
  { label: "XL", value: 24 },
];

interface NoteContextMenuProps {
  note: Note;
  children: React.ReactNode;
}

export function NoteContextMenu({ note, children }: NoteContextMenuProps) {
  const updateNote      = useStore((s) => s.updateNote);
  const bringToFront    = useStore((s) => s.bringToFront);
  const sendToBack      = useStore((s) => s.sendToBack);
  const deleteNotes     = useStore((s) => s.deleteNotes);
  const groupNotes      = useStore((s) => s.groupNotes);
  const ungroupNotes    = useStore((s) => s.ungroupNotes);
  const selectedNoteIds = useStore((s) => s.selectedNoteIds);
  const boardNotes      = useStore((s) => s.notesByBoard[note.boardId] ?? []);

  const selectedIds     = Object.keys(selectedNoteIds);
  // "Group selected" is available when 2+ non-group notes are selected
  const canGroupSelected =
    selectedIds.length >= 2 &&
    selectedIds.includes(note.id) &&
    !selectedIds.some((id) => boardNotes.find((n) => n.id === id)?.type === "group");
  const isGroupMember   = !!note.content.groupId;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className={cn(
            "z-50 min-w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-xl",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          {note.type === "text" && (
            <>
              {/* Color swatches */}
              <div className="px-2 py-1.5">
                <p className="text-[10px] font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider mb-1.5">Color</p>
                <div className="flex gap-1.5 items-center">
                  {/* Reset to default */}
                  <button
                    title="Default"
                    className={cn(
                      "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                      !note.color
                        ? "border-[var(--color-primary)]"
                        : "border-[var(--color-border)] hover:border-black/20"
                    )}
                    style={{
                      background: "linear-gradient(135deg, #fff 50%, #ddd 50%)",
                      outline: "1px solid #ccc",
                    }}
                    onMouseDown={(e) => { e.preventDefault(); updateNote(note.id, { color: undefined }); }}
                  />
                  {NOTE_COLORS.map(({ value, label }) => (
                    <button
                      key={value}
                      title={label}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                        note.color === value
                          ? "border-[var(--color-primary)]"
                          : "border-transparent hover:border-black/20"
                      )}
                      style={{ backgroundColor: value }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        updateNote(note.id, { color: value });
                      }}
                    >
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size */}
              <div className="px-2 py-1.5">
                <p className="text-[10px] font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider mb-1.5">Font size</p>
                <div className="flex gap-1">
                  {FONT_SIZES.map(({ label, value }) => (
                    <button
                      key={value}
                      className={cn(
                        "flex-1 rounded-md py-0.5 text-xs font-medium transition-colors",
                        note.fontSize === value || (!note.fontSize && value === 14)
                          ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                          : "bg-[var(--color-muted)] hover:bg-[var(--color-border)] text-[var(--color-foreground)]"
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        updateNote(note.id, { fontSize: value });
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <ContextMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
            </>
          )}

          {note.type !== "group" && (
            <>
              <ContextMenuItem onSelect={() => bringToFront(note.id)}>Bring to front</ContextMenuItem>
              <ContextMenuItem onSelect={() => sendToBack(note.id)}>Send to back</ContextMenuItem>
            </>
          )}

          {/* Group actions */}
          {canGroupSelected && (
            <>
              <ContextMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
              <ContextMenuItem onSelect={() => groupNotes(selectedIds, note.boardId)}>
                Group selected ({selectedIds.length})
              </ContextMenuItem>
            </>
          )}
          {note.type === "group" && (
            <>
              <ContextMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
              <ContextMenuItem onSelect={() => ungroupNotes(note.id, note.boardId)}>
                Ungroup
              </ContextMenuItem>
            </>
          )}
          {isGroupMember && (
            <>
              <ContextMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
              <ContextMenuItem
                onSelect={() => {
                  const { groupId: _g, ...newContent } = note.content;
                  updateNote(note.id, { content: newContent });
                }}
              >
                Remove from group
              </ContextMenuItem>
            </>
          )}

          <ContextMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
          <ContextMenuItem
            onSelect={() => deleteNotes([note.id])}
            className="text-[var(--color-destructive)]"
          >
            Delete
          </ContextMenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function ContextMenuItem({
  children,
  onSelect,
  className,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  className?: string;
}) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center rounded-md px-3 py-1.5 text-sm outline-none",
        "focus:bg-[var(--color-muted)] transition-colors",
        className
      )}
    >
      {children}
    </ContextMenu.Item>
  );
}
