// Pure spaced-repetition math. No DB, no Next imports — testable in isolation.
//
// Ladder is locked-in per CLAUDE.md: 3d → 7d → 21d → 60d. After surviving 60d
// with an "easy" rating, the problem is mastered and falls out of the queue.

export const INTERVALS_DAYS = [3, 7, 21, 60] as const;
export type IntervalDays = (typeof INTERVALS_DAYS)[number];

export const RECALL_RATINGS = ["easy", "medium", "hard", "forgot"] as const;
export type RecallRating = (typeof RECALL_RATINGS)[number];

export function isRecallRating(v: unknown): v is RecallRating {
  return typeof v === "string" && (RECALL_RATINGS as readonly string[]).includes(v);
}

export type NextStep =
  | { kind: "schedule"; days: IntervalDays }
  | { kind: "mastered" };

/**
 * Compute the next spaced-rep step.
 *
 * @param rating  null = first scheduling after a fresh solve (use 3d).
 *                Otherwise the self-rating from the revisit.
 * @param currentDays  what's stored in progress.current_interval_days.
 *                     If off-ladder (e.g. 0 from a brand-new row), we treat
 *                     it as "before the ladder" and step to index 0.
 */
export function nextInterval(
  rating: RecallRating | null,
  currentDays: number,
): NextStep {
  // First scheduling after the initial solve.
  if (rating === null) {
    return { kind: "schedule", days: INTERVALS_DAYS[0] };
  }

  // "forgot" always resets to the bottom of the ladder.
  if (rating === "forgot") {
    return { kind: "schedule", days: INTERVALS_DAYS[0] };
  }

  // Find where the user currently sits on the ladder. -1 means off-ladder
  // (e.g. current_interval_days is 0 because no revision was ever scheduled);
  // we treat that as "below index 0" so the first step lands at index 0.
  const idx = INTERVALS_DAYS.findIndex((d) => d === currentDays);
  const safeIdx = idx === -1 ? 0 : idx;

  if (rating === "hard") {
    return { kind: "schedule", days: INTERVALS_DAYS[safeIdx] };
  }

  // medium and easy both advance one step. The difference shows up only at
  // the top of the ladder: easy from 60d → mastered, medium from 60d → stay.
  const nextIdx = safeIdx + 1;
  if (nextIdx >= INTERVALS_DAYS.length) {
    if (rating === "easy") return { kind: "mastered" };
    return { kind: "schedule", days: INTERVALS_DAYS[INTERVALS_DAYS.length - 1] };
  }
  return { kind: "schedule", days: INTERVALS_DAYS[nextIdx] };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
