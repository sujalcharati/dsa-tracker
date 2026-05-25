import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, nextInterval, type RecallRating } from "./spaced-rep";

export type ScheduleResult =
  | { kind: "scheduled"; days: number; due_at: string }
  | { kind: "mastered" };

/**
 * Bridge between the pure spaced-rep math and the database. Either inserts
 * a new `revisions` row with the next due_at, or — when easy beats 60d — marks
 * the problem mastered and stops scheduling.
 *
 * Two call sites:
 *   - markSolved (rating=null): first revision after the initial solve.
 *   - completeRevision (rating set): subsequent revisions from /today.
 *
 * The caller is responsible for marking the *previous* revision row complete
 * before calling this; we only schedule the *next* step.
 */
export async function scheduleNextRevision(args: {
  supabase: SupabaseClient;
  progressId: string;
  currentIntervalDays: number;
  rating: RecallRating | null;
}): Promise<ScheduleResult> {
  const step = nextInterval(args.rating, args.currentIntervalDays);
  const now = new Date();
  const nowIso = now.toISOString();

  if (step.kind === "mastered") {
    const { error } = await args.supabase
      .from("progress")
      .update({ status: "mastered", updated_at: nowIso })
      .eq("id", args.progressId);
    if (error) {
      throw new Error(`scheduleNextRevision (mastered): ${error.message}`);
    }
    return { kind: "mastered" };
  }

  const dueAt = addDays(now, step.days).toISOString();

  // Two writes — progress first, then the revision row. Not transactional;
  // worst case we update the interval but fail to insert the revision (the
  // user would just not see this problem in /today, easy to re-trigger). A
  // proper RPC + transaction would be the right Slice-7+ move.
  const { error: progressErr } = await args.supabase
    .from("progress")
    .update({ current_interval_days: step.days, updated_at: nowIso })
    .eq("id", args.progressId);
  if (progressErr) {
    throw new Error(
      `scheduleNextRevision (progress update): ${progressErr.message}`,
    );
  }

  const { error: insertErr } = await args.supabase
    .from("revisions")
    .insert({ progress_id: args.progressId, due_at: dueAt });
  if (insertErr) {
    throw new Error(
      `scheduleNextRevision (revision insert): ${insertErr.message}`,
    );
  }

  return { kind: "scheduled", days: step.days, due_at: dueAt };
}
