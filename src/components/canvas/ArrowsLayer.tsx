import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Note, Connection } from "@/lib/types";

type Side = "top" | "right" | "bottom" | "left";

function getAnchor(note: Note, side: Side) {
  switch (side) {
    case "top":    return { x: note.x + note.width / 2,  y: note.y };
    case "right":  return { x: note.x + note.width,       y: note.y + note.height / 2 };
    case "bottom": return { x: note.x + note.width / 2,  y: note.y + note.height };
    case "left":   return { x: note.x,                   y: note.y + note.height / 2 };
  }
}

function bestSides(from: Note, to: Note): { fromSide: Side; toSide: Side } {
  const dx = (to.x + to.width / 2) - (from.x + from.width / 2);
  const dy = (to.y + to.height / 2) - (from.y + from.height / 2);
  const a = Math.atan2(dy, dx) * (180 / Math.PI);
  if (a > -45 && a <= 45)   return { fromSide: "right",  toSide: "left" };
  if (a > 45  && a <= 135)  return { fromSide: "bottom", toSide: "top" };
  if (a > 135 || a <= -135) return { fromSide: "left",   toSide: "right" };
  return                           { fromSide: "top",    toSide: "bottom" };
}

function cp(anchor: { x: number; y: number }, side: Side, d = 90) {
  switch (side) {
    case "top":    return { cx: anchor.x,     cy: anchor.y - d };
    case "right":  return { cx: anchor.x + d, cy: anchor.y };
    case "bottom": return { cx: anchor.x,     cy: anchor.y + d };
    case "left":   return { cx: anchor.x - d, cy: anchor.y };
  }
}

function bezierPath(
  p0: { x: number; y: number },
  p1: { cx: number; cy: number },
  p2: { cx: number; cy: number },
  p3: { x: number; y: number }
) {
  return `M ${p0.x} ${p0.y} C ${p1.cx} ${p1.cy}, ${p2.cx} ${p2.cy}, ${p3.x} ${p3.y}`;
}

function midpoint(
  p0: { x: number; y: number },
  p1: { cx: number; cy: number },
  p2: { cx: number; cy: number },
  p3: { x: number; y: number }
) {
  return {
    x: (p0.x + 3 * p1.cx + 3 * p2.cx + p3.x) / 8,
    y: (p0.y + 3 * p1.cy + 3 * p2.cy + p3.y) / 8,
  };
}

interface Arrow {
  conn: Connection;
  d: string;
  mid: { x: number; y: number };
}

function buildArrow(conn: Connection, noteMap: Map<string, Note>): Arrow | null {
  const from = noteMap.get(conn.fromNoteId);
  const to   = noteMap.get(conn.toNoteId);
  if (!from || !to) return null;

  const { fromSide, toSide } = bestSides(from, to);
  const a0 = getAnchor(from, fromSide);
  const a1 = getAnchor(to,   toSide);
  const c0 = cp(a0, fromSide);
  const c1 = cp(a1, toSide);

  return {
    conn,
    d: bezierPath(a0, c0, c1, a1),
    mid: midpoint(a0, c0, c1, a1),
  };
}

interface Props {
  boardId: string;
  notes: Note[];
  connectingFrom: { noteId: string; anchorX: number; anchorY: number } | null;
  mouseCanvas: { x: number; y: number };
}

export function ArrowsLayer({ boardId, notes, connectingFrom, mouseCanvas }: Props) {
  const connections       = useStore((s) => s.connectionsByBoard[boardId] ?? []);
  const deleteConnection  = useStore((s) => s.deleteConnection);
  const liveDragPositions = useStore((s) => s.liveDragPositions);

  // Track which arrow the user is hovering so we only show the × on hover
  const [hoveredArrow, setHoveredArrow] = useState<string | null>(null);

  // Merge live drag positions into the note map so arrows follow notes during drag
  const noteMap = new Map(
    notes.map((n) => {
      const live = liveDragPositions[n.id];
      return live ? [n.id, { ...n, x: live.x, y: live.y }] : [n.id, n];
    })
  );

  const arrows = connections.map((c) => buildArrow(c, noteMap)).filter(Boolean) as Arrow[];

  return (
    <svg
      className="absolute pointer-events-none"
      style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible" }}
    >
      <defs>
        <marker id="nb-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--color-primary)" opacity="0.8" />
        </marker>
        <marker id="nb-arrow-preview" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
        </marker>
      </defs>

      {/* Existing connection arrows */}
      {arrows.map(({ conn, d, mid }) => {
        const hovered = hoveredArrow === conn.id;
        return (
          <g key={conn.id}>
            {/* Wide transparent hit area — drives hover detection */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ pointerEvents: "stroke" }}
              onMouseEnter={() => setHoveredArrow(conn.id)}
              onMouseLeave={() => setHoveredArrow(null)}
            />
            {/* Visible bezier — thicker + brighter on hover */}
            <path
              d={d}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={hovered ? 2.5 : 2}
              opacity={hovered ? 1 : 0.7}
              markerEnd="url(#nb-arrow)"
              style={{ pointerEvents: "none" }}
            />
            {/* Delete button — visible only while hovered */}
            {hovered && (
              <g
                style={{ pointerEvents: "all" }}
                onMouseEnter={() => setHoveredArrow(conn.id)}
                onMouseLeave={() => setHoveredArrow(null)}
              >
                <circle
                  cx={mid.x} cy={mid.y} r={9}
                  fill="white"
                  stroke="#f87171"
                  strokeWidth={1.5}
                  className="cursor-pointer"
                  onClick={() => deleteConnection(conn.id, boardId)}
                />
                <text
                  x={mid.x} y={mid.y + 4.5}
                  textAnchor="middle"
                  fontSize={13}
                  fill="#f87171"
                  fontWeight="bold"
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  ×
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Live preview line while dragging a connection */}
      {connectingFrom && (
        <line
          x1={connectingFrom.anchorX}
          y1={connectingFrom.anchorY}
          x2={mouseCanvas.x}
          y2={mouseCanvas.y}
          stroke="#94a3b8"
          strokeWidth={2}
          strokeDasharray="6 3"
          markerEnd="url(#nb-arrow-preview)"
        />
      )}
    </svg>
  );
}
