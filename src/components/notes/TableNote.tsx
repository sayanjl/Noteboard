import { useState, useRef, useEffect, useCallback } from "react";
import {
  Type, Hash, Calendar, CheckSquare2, List,
  Plus, Trash2, GripHorizontal,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { nanoid } from "@/lib/nanoid";
import type { Note, TableColumn, TableRow, ColumnType } from "@/lib/types";

// ── Column-type metadata ──────────────────────────────────────────────────────

const COL_TYPES: { type: ColumnType; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { type: "text",     label: "Text",     Icon: Type         },
  { type: "number",   label: "Number",   Icon: Hash         },
  { type: "date",     label: "Date",     Icon: Calendar     },
  { type: "checkbox", label: "Checkbox", Icon: CheckSquare2 },
  { type: "select",   label: "Select",   Icon: List         },
];

// Consistent badge colours for select options (index % length)
const BADGE = [
  { bg: "rgba(59,130,246,.15)",  fg: "#3b82f6" },
  { bg: "rgba(16,185,129,.15)",  fg: "#10b981" },
  { bg: "rgba(245,158,11,.15)",  fg: "#d97706" },
  { bg: "rgba(239,68,68,.15)",   fg: "#ef4444" },
  { bg: "rgba(139,92,246,.15)",  fg: "#8b5cf6" },
  { bg: "rgba(236,72,153,.15)",  fg: "#db2777" },
];

// ── Default content for a new table ──────────────────────────────────────────

export function makeDefaultTableContent() {
  const cols: TableColumn[] = [
    { id: nanoid(8), name: "Name",   type: "text" },
    { id: nanoid(8), name: "Status", type: "select",
      options: ["Todo", "In Progress", "Done"] },
    { id: nanoid(8), name: "Done",   type: "checkbox" },
  ];
  const rows: TableRow[] = Array.from({ length: 3 }, () => ({
    id: nanoid(8),
    cells: Object.fromEntries(cols.map((c) => [c.id, ""])),
  }));
  return { tableColumns: cols, tableRows: rows };
}

// ── Cell ──────────────────────────────────────────────────────────────────────

interface CellProps {
  value: string;
  col: TableColumn;
  editing: boolean;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onCommit: () => void;
}

function DataCell({ value, col, editing, onStartEdit, onChange, onCommit }: CellProps) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // ── Checkbox ─────────────────────────────────────────────────────────────
  if (col.type === "checkbox") {
    const on = value === "true";
    return (
      <div className="flex items-center justify-center h-full">
        <button
          className="w-[18px] h-[18px] rounded flex items-center justify-center border-2 transition-colors"
          style={{
            backgroundColor: on ? "var(--color-primary)" : "transparent",
            borderColor: on ? "var(--color-primary)" : "var(--color-border)",
          }}
          onMouseDown={stop}
          onClick={(e) => { stop(e); onChange(on ? "false" : "true"); }}
        >
          {on && <span className="text-white text-[10px] leading-none select-none">✓</span>}
        </button>
      </div>
    );
  }

  // ── Select ────────────────────────────────────────────────────────────────
  if (col.type === "select") {
    const opts = col.options ?? [];
    const idx  = opts.indexOf(value);
    const badge = idx >= 0 ? BADGE[idx % BADGE.length] : null;

    if (editing) {
      return (
        <select
          autoFocus
          className="w-full h-full text-xs px-1 bg-[var(--color-card)] text-[var(--color-foreground)] border-none outline-none cursor-pointer"
          value={value}
          onMouseDown={stop}
          onChange={(e) => { onChange(e.target.value); onCommit(); }}
          onBlur={onCommit}
        >
          <option value="">—</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    return (
      <div
        className="w-full h-full flex items-center px-1.5 cursor-pointer select-none"
        onMouseDown={stop}
        onClick={(e) => { stop(e); onStartEdit(); }}
      >
        {badge ? (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full truncate max-w-full"
            style={{ backgroundColor: badge.bg, color: badge.fg }}
          >
            {value}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--color-muted-foreground)]">—</span>
        )}
      </div>
    );
  }

  // ── Text / Number / Date (edit mode) ──────────────────────────────────────
  if (editing) {
    return (
      <input
        autoFocus
        type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
        className="w-full h-full text-xs px-1.5 bg-transparent border-none outline-none text-[var(--color-foreground)]"
        value={value}
        onMouseDown={stop}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          stop(e);
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          if (e.key === "Tab") { e.preventDefault(); onCommit(); }
        }}
      />
    );
  }

  // ── Display mode ─────────────────────────────────────────────────────────
  const display =
    col.type === "date" && value
      ? new Date(value + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })
      : value;

  return (
    <div
      className="w-full h-full flex items-center px-1.5 cursor-text select-none"
      onMouseDown={stop}
      onClick={(e) => { stop(e); onStartEdit(); }}
    >
      <span className="text-xs text-[var(--color-foreground)] truncate">
        {display}
      </span>
    </div>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

interface ColHeaderProps {
  col: TableColumn;
  onRename: (name: string) => void;
  onTypeChange: (type: ColumnType) => void;
  onAddOption: (opt: string) => void;
  onRemoveOption: (opt: string) => void;
  onDelete: () => void;
}

function ColHeader({ col, onRename, onTypeChange, onAddOption, onRemoveOption, onDelete }: ColHeaderProps) {
  const [editName,  setEditName]  = useState(false);
  const [draft,     setDraft]     = useState(col.name);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [newOpt,    setNewOpt]    = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [menuOpen]);

  const commitName = () => {
    setEditName(false);
    const v = draft.trim() || col.name;
    setDraft(v);
    onRename(v);
  };

  const { Icon } = COL_TYPES.find((t) => t.type === col.type)!;

  return (
    <th
      className="relative border-b border-r border-[var(--color-border)] bg-[var(--color-muted)] p-0"
      style={{ minWidth: 110 }}
    >
      <div className="flex items-center gap-1 px-2 h-8 group/hdr">
        {/* Type icon → opens picker */}
        <button
          className="flex-shrink-0 text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] transition-colors"
          title="Change type"
          onMouseDown={stop}
          onClick={(e) => { stop(e); setMenuOpen((v) => !v); }}
        >
          <Icon size={11} />
        </button>

        {/* Editable name */}
        {editName ? (
          <input
            autoFocus
            className="flex-1 min-w-0 text-xs font-semibold bg-transparent border-none outline-none text-[var(--color-foreground)]"
            value={draft}
            onMouseDown={stop}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { stop(e); if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-xs font-semibold text-[var(--color-foreground)] truncate cursor-text"
            onMouseDown={stop}
            onDoubleClick={(e) => { stop(e); setEditName(true); setDraft(col.name); }}
          >
            {col.name}
          </span>
        )}

        {/* Delete button — hover */}
        <button
          className="flex-shrink-0 opacity-0 group-hover/hdr:opacity-100 text-[var(--color-muted-foreground)] hover:text-red-500 transition-all"
          title="Delete column"
          onMouseDown={stop}
          onClick={(e) => { stop(e); onDelete(); }}
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* Type picker dropdown */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute top-full left-0 z-[200] w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl p-1.5"
          onMouseDown={stop}
          onClick={stop}
        >
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] px-2 pt-1 pb-1">
            Column type
          </p>

          {COL_TYPES.map(({ type, label, Icon: I }) => (
            <button
              key={type}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-colors ${
                col.type === type
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                  : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
              }`}
              onClick={() => { onTypeChange(type); if (type !== "select") setMenuOpen(false); }}
            >
              <I size={11} />
              {label}
            </button>
          ))}

          {/* Options editor — only for select */}
          {col.type === "select" && (
            <>
              <div className="h-px bg-[var(--color-border)] my-1.5" />
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] px-2 pb-1">
                Options
              </p>

              <div className="max-h-28 overflow-y-auto space-y-0.5">
                {(col.options ?? []).map((opt, i) => (
                  <div key={opt} className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[var(--color-muted)] group/opt">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: BADGE[i % BADGE.length].fg }}
                    />
                    <span className="flex-1 text-xs text-[var(--color-foreground)] truncate">{opt}</span>
                    <button
                      className="opacity-0 group-hover/opt:opacity-100 text-[var(--color-muted-foreground)] hover:text-red-500 transition-all flex-shrink-0"
                      onClick={() => onRemoveOption(opt)}
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add option input */}
              <div className="flex items-center gap-1 mt-1 px-1">
                <input
                  className="flex-1 min-w-0 text-xs rounded px-1.5 py-0.5 outline-none border border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]"
                  placeholder="New option…"
                  value={newOpt}
                  onMouseDown={stop}
                  onChange={(e) => setNewOpt(e.target.value)}
                  onKeyDown={(e) => {
                    stop(e);
                    if (e.key === "Enter" && newOpt.trim()) {
                      onAddOption(newOpt.trim());
                      setNewOpt("");
                    }
                  }}
                />
                <button
                  className="p-1 rounded text-[var(--color-primary)] hover:bg-[var(--color-muted)] transition-colors"
                  onClick={() => { if (newOpt.trim()) { onAddOption(newOpt.trim()); setNewOpt(""); } }}
                >
                  <Plus size={10} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </th>
  );
}

// ── TableNote ─────────────────────────────────────────────────────────────────

interface TableNoteProps { note: Note }

export function TableNote({ note }: TableNoteProps) {
  const updateNote = useStore((s) => s.updateNote);

  const columns: TableColumn[] = note.content.tableColumns ?? [];
  const rows:    TableRow[]    = note.content.tableRows    ?? [];

  const [editingCell, setEditingCell] = useState<{ rId: string; cId: string } | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const save = useCallback(
    (cols: TableColumn[], rws: TableRow[]) => {
      updateNote(note.id, {
        content: { ...note.content, tableColumns: cols, tableRows: rws },
      });
    },
    [note, updateNote]
  );

  const addColumn = () => {
    const col: TableColumn = { id: nanoid(8), name: `Column ${columns.length + 1}`, type: "text" };
    save(
      [...columns, col],
      rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: "" } }))
    );
  };

  const updateColumn = (id: string, patch: Partial<TableColumn>) =>
    save(columns.map((c) => (c.id === id ? { ...c, ...patch } : c)), rows);

  const deleteColumn = (id: string) =>
    save(
      columns.filter((c) => c.id !== id),
      rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[id];
        return { ...r, cells };
      })
    );

  const addRow = () => {
    const row: TableRow = {
      id: nanoid(8),
      cells: Object.fromEntries(columns.map((c) => [c.id, ""])),
    };
    save(columns, [...rows, row]);
  };

  const deleteRow = (id: string) => save(columns, rows.filter((r) => r.id !== id));

  const updateCell = (rId: string, cId: string, value: string) =>
    save(
      columns,
      rows.map((r) => r.id === rId ? { ...r, cells: { ...r.cells, [cId]: value } } : r)
    );

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    // Outer div has NO onMouseDown stop — the drag handle below bubbles freely to NoteWrapper
    <div className="w-full h-full flex flex-col bg-[var(--color-card)] overflow-hidden">

      {/* ── Drag handle ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 h-5 px-2 flex-shrink-0 bg-[var(--color-muted)] border-b border-[var(--color-border)] cursor-grab select-none">
        <GripHorizontal size={11} className="text-[var(--color-muted-foreground)]" />
        <span className="text-[10px] text-[var(--color-muted-foreground)]">
          {rows.length} row{rows.length !== 1 ? "s" : ""} · {columns.length} col{columns.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table (stopPropagation here so cell clicks don't start a drag) ── */}
      <div className="flex-1 overflow-auto" onMouseDown={stop}>
        <table className="border-collapse w-full" style={{ tableLayout: "auto" }}>

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Row-number gutter */}
              <th className="border-b border-r border-[var(--color-border)] bg-[var(--color-muted)] w-7 min-w-[28px] max-w-[28px]" />

              {columns.map((col) => (
                <ColHeader
                  key={col.id}
                  col={col}
                  onRename={(name) => updateColumn(col.id, { name })}
                  onTypeChange={(type) => updateColumn(col.id, { type })}
                  onAddOption={(opt) => updateColumn(col.id, { options: [...(col.options ?? []), opt] })}
                  onRemoveOption={(opt) => updateColumn(col.id, { options: (col.options ?? []).filter((o) => o !== opt) })}
                  onDelete={() => deleteColumn(col.id)}
                />
              ))}

              {/* Add-column button */}
              <th className="border-b border-[var(--color-border)] bg-[var(--color-muted)] w-8 min-w-[32px]">
                <button
                  className="w-full h-8 flex items-center justify-center text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-border)]/50 transition-colors"
                  title="Add column"
                  onMouseDown={stop}
                  onClick={(e) => { stop(e); addColumn(); }}
                >
                  <Plus size={12} />
                </button>
              </th>
            </tr>
          </thead>

          {/* ── Rows ────────────────────────────────────────────────────────── */}
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.id} className="group/row hover:bg-[var(--color-muted)]/30">

                {/* Row number / delete */}
                <td className="border-b border-r border-[var(--color-border)] text-center w-7 min-w-[28px] max-w-[28px] relative h-8">
                  <span className="text-[10px] text-[var(--color-muted-foreground)] group-hover/row:hidden">
                    {ri + 1}
                  </span>
                  <button
                    className="hidden group-hover/row:flex absolute inset-0 items-center justify-center text-[var(--color-muted-foreground)] hover:text-red-500 transition-colors"
                    title="Delete row"
                    onMouseDown={stop}
                    onClick={(e) => { stop(e); deleteRow(row.id); }}
                  >
                    <Trash2 size={10} />
                  </button>
                </td>

                {/* Data cells */}
                {columns.map((col) => {
                  const isEditing =
                    editingCell?.rId === row.id && editingCell?.cId === col.id;
                  return (
                    <td
                      key={col.id}
                      className={`border-b border-r border-[var(--color-border)] h-8 p-0 ${
                        isEditing ? "ring-2 ring-inset ring-[var(--color-primary)]" : ""
                      }`}
                    >
                      <DataCell
                        value={row.cells[col.id] ?? ""}
                        col={col}
                        editing={isEditing}
                        onStartEdit={() => setEditingCell({ rId: row.id, cId: col.id })}
                        onChange={(v) => updateCell(row.id, col.id, v)}
                        onCommit={() => setEditingCell(null)}
                      />
                    </td>
                  );
                })}

                {/* Filler under add-column button */}
                <td className="border-b border-[var(--color-border)] w-8 min-w-[32px]" />
              </tr>
            ))}
          </tbody>

          {/* ── Add row ─────────────────────────────────────────────────────── */}
          <tfoot>
            <tr>
              <td colSpan={columns.length + 2}>
                <button
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                  onMouseDown={stop}
                  onClick={(e) => { stop(e); addRow(); }}
                >
                  <Plus size={11} />
                  Add row
                </button>
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Empty state */}
        {columns.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-[var(--color-muted-foreground)]">
            <p className="text-xs">No columns yet</p>
            <button
              className="text-xs text-[var(--color-primary)] hover:underline"
              onMouseDown={stop}
              onClick={(e) => { stop(e); addColumn(); }}
            >
              + Add first column
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
