import type { AppointmentItem } from "./calendar-shared-types";
import { getTopOffset, getBlockHeight } from "./time-grid-constants";

export type PositionedAppointment = {
  appointment: AppointmentItem;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
};

function overlaps(
  aTop: number,
  aHeight: number,
  bTop: number,
  bHeight: number
): boolean {
  return aTop < bTop + bHeight && bTop < aTop + aHeight;
}

export function layoutAppointments(
  appointments: AppointmentItem[],
  businessStart: number
): PositionedAppointment[] {
  if (appointments.length === 0) return [];

  const items: PositionedAppointment[] = appointments.map((a) => ({
    appointment: a,
    top: getTopOffset(a.starts_at, businessStart),
    height: getBlockHeight(a.starts_at, a.ends_at),
    column: 0,
    totalColumns: 1,
  }));

  // Sort by start position, then longest first
  items.sort((a, b) => {
    if (a.top !== b.top) return a.top - b.top;
    return b.height - a.height;
  });

  // Greedy column assignment: track end positions per column
  const columnEnds: number[][] = []; // columnEnds[col] = array of {top, bottom} intervals

  for (const item of items) {
    let placed = false;
    for (let col = 0; col < columnEnds.length; col++) {
      const hasConflict = columnEnds[col].some(
        (endBottom) => item.top < endBottom
      );
      if (!hasConflict) {
        item.column = col;
        columnEnds[col].push(item.top + item.height);
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.column = columnEnds.length;
      columnEnds.push([item.top + item.height]);
    }
  }

  // Union-find for connected components
  const parent = items.map((_, i) => i);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (
        overlaps(items[i].top, items[i].height, items[j].top, items[j].height)
      ) {
        union(i, j);
      }
    }
  }

  // Compute totalColumns per connected component
  const componentMaxCol = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    const current = componentMaxCol.get(root) ?? 0;
    componentMaxCol.set(root, Math.max(current, items[i].column + 1));
  }

  for (let i = 0; i < items.length; i++) {
    items[i].totalColumns = componentMaxCol.get(find(i)) ?? 1;
  }

  return items;
}
