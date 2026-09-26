import type { RowView } from "./rowView"

/**
 * The indices of rows that differ between two ticks over the same Token set.
 * Only these get `UPDATE_ITEM`: a whole-list `UPDATE_DATA` every second
 * scrolls back to the top (ADR-0005), so it is kept for Syncs.
 */
export function changedRows(prev: RowView[], next: RowView[]) {
  return next.flatMap((row, index) =>
    isSameRow(prev[index], row) ? [] : [index]
  )
}

function isSameRow(a: RowView | undefined, b: RowView) {
  return (
    a !== undefined &&
    a.name === b.name &&
    a.code === b.code &&
    ("arc" in a ? a.arc : a.countdown) === ("arc" in b ? b.arc : b.countdown)
  )
}
