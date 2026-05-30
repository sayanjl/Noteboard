import type { AABB } from "./types";

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Minimum translation vector to push `b` out of `a`. Returns null when no overlap. */
export function getMTV(a: AABB, b: AABB): { dx: number; dy: number } | null {
  if (!aabbIntersects(a, b)) return null;

  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

  // Push along the axis of minimum penetration
  if (overlapX < overlapY) {
    const dx = b.x + b.width / 2 > a.x + a.width / 2 ? overlapX : -overlapX;
    return { dx, dy: 0 };
  } else {
    const dy = b.y + b.height / 2 > a.y + a.height / 2 ? overlapY : -overlapY;
    return { dx: 0, dy };
  }
}

export interface Rect extends AABB {
  id: string;
}

/**
 * Resolve all overlaps caused by `dragged` rect intruding on `others`.
 * Returns a map of id → new {x, y} for displaced notes.
 * Iterates up to `maxIter` times to handle cascades.
 */
export function resolveCollisions(
  dragged: AABB,
  others: Rect[],
  maxIter = 8
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>(
    others.map((r) => [r.id, { x: r.x, y: r.y }])
  );

  for (let iter = 0; iter < maxIter; iter++) {
    let anyMoved = false;

    // Build current rect list including dragged
    const current: Rect[] = others.map((r) => ({
      ...r,
      x: positions.get(r.id)!.x,
      y: positions.get(r.id)!.y,
    }));

    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const aabb: AABB = { x: a.x, y: a.y, width: a.width, height: a.height };

      // Check against dragged note
      const mtvFromDragged = getMTV(dragged, aabb);
      if (mtvFromDragged) {
        const pos = positions.get(a.id)!;
        pos.x += mtvFromDragged.dx;
        pos.y += mtvFromDragged.dy;
        current[i] = { ...a, x: pos.x, y: pos.y };
        anyMoved = true;
      }

      // Check against other displaced notes (cascade)
      for (let j = 0; j < current.length; j++) {
        if (i === j) continue;
        const b = current[j];
        const aabb_b: AABB = { x: b.x, y: b.y, width: b.width, height: b.height };
        const mtv = getMTV({ x: current[i].x, y: current[i].y, width: a.width, height: a.height }, aabb_b);
        if (mtv) {
          const posB = positions.get(b.id)!;
          posB.x += mtv.dx;
          posB.y += mtv.dy;
          current[j] = { ...b, x: posB.x, y: posB.y };
          anyMoved = true;
        }
      }
    }

    if (!anyMoved) break;
  }

  return positions;
}
