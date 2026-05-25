// Consecutive-day streak from a set of activity timestamps.
//
// Day boundary = UTC midnight. Both users are in Asia/Kolkata (UTC+5:30), so
// a solve at 1am IST falls on the previous UTC day — close enough for now;
// timezone-correctness is a Slice 8+ refinement.

function toDayKey(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dayBefore(key: string): string {
  // 12:00 UTC to avoid DST-style ambiguity (though UTC has no DST).
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return toDayKey(d);
}

/**
 * Returns the count of consecutive days, ending at today or yesterday, on
 * which the user had at least one activity timestamp.
 *
 * Why "today OR yesterday" as the anchor: it's 11pm and you haven't solved
 * yet — a streak of 5 days that you maintained through yesterday shouldn't
 * collapse to 0 just because the calendar flipped. Only a day with no
 * activity *and* it's already the next day breaks the streak.
 *
 * Rule:
 *   - active today        → streak = days going back from today
 *   - active yesterday    → streak = days going back from yesterday
 *   - active neither      → streak = 0
 */
export function computeStreak(
  activityTimestamps: ReadonlyArray<string | Date | null | undefined>,
  today: Date = new Date(),
): number {
  const days = new Set<string>();
  for (const ts of activityTimestamps) {
    if (!ts) continue;
    days.add(toDayKey(ts));
  }
  if (days.size === 0) return 0;

  const todayKey = toDayKey(today);
  let cursor: string;
  if (days.has(todayKey)) {
    cursor = todayKey;
  } else {
    const y = dayBefore(todayKey);
    if (!days.has(y)) return 0;
    cursor = y;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = dayBefore(cursor);
  }
  return streak;
}
