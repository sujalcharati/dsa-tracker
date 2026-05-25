// GitHub-style activity heatmap. Returns columns-of-7 cells (Sun..Sat),
// oldest week leftmost. Pure — caller renders.
//
// Day boundary = UTC midnight, same as streak.ts. Slice 8+ refinement to
// user-local time can replace toISOString().slice(0, 10) with a tz-aware key.

export type HeatmapCell = {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
};

const DAY_MS = 86_400_000;

function toDayKey(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return d.toISOString().slice(0, 10);
}

/**
 * Build a column-major grid of activity cells for the most recent N weeks
 * ending in the week containing `today`. Result has length `weeks`, each
 * entry is 7 cells [Sun, Mon, ..., Sat]. Future cells (in the current week
 * past today) are included with count=0 — callers can style them differently.
 */
export function buildHeatmap(
  activityTimestamps: ReadonlyArray<string | Date | null | undefined>,
  weeks: number = 26,
  today: Date = new Date(),
): HeatmapCell[][] {
  const counts = new Map<string, number>();
  for (const ts of activityTimestamps) {
    if (!ts) continue;
    const key = toDayKey(ts);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Anchor: noon UTC on today, then back up to this week's Sunday.
  const anchor = new Date(today);
  anchor.setUTCHours(12, 0, 0, 0);
  const sundayThisWeek = new Date(anchor.getTime() - anchor.getUTCDay() * DAY_MS);

  const cols: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    // weeks-1-w = how many weeks back from the current week (0 = current)
    const colStart = new Date(
      sundayThisWeek.getTime() - (weeks - 1 - w) * 7 * DAY_MS,
    );
    const col: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(colStart.getTime() + d * DAY_MS);
      const key = toDayKey(cellDate);
      col.push({ date: key, count: counts.get(key) ?? 0 });
    }
    cols.push(col);
  }
  return cols;
}

/**
 * Discrete 0..4 intensity from a per-day count. Calibrated for hobbyist
 * volumes (1–10 problems/day); a 7+ day is "max".
 */
export function intensity(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}
