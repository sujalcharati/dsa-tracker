"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { scheduleNextRevision } from "@/lib/revisions";

export async function markSolved(problemId: number) {
  // Server actions cross a network boundary, so the runtime value of
  // `problemId` could be anything. The DB would reject a non-integer anyway,
  // but a sharp error here gives us a better stack trace.
  if (!Number.isInteger(problemId)) {
    throw new Error(`markSolved: invalid problemId ${String(problemId)}`);
  }

  const user = await getCurrentUser();
  // Proxy already gates `/checklist`, but never trust a single gate. If the
  // matcher ever drifts, this keeps mutations from running unauthenticated.
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Read-then-write so we can preserve `first_solved_at` (the original solve
  // date) and increment `attempts`. Blind upserting would overwrite both on
  // every re-solve and we'd lose the audit signal.
  const { data: existing, error: readErr } = await supabase
    .from("progress")
    .select("attempts, first_solved_at")
    .eq("user_id", user.id)
    .eq("problem_id", problemId)
    .maybeSingle();

  if (readErr) {
    throw new Error(`markSolved: failed to read progress: ${readErr.message}`);
  }

  // First-time solve: no existing row, or existing row from todo/attempting
  // that never set first_solved_at. Used below to decide whether to kick off
  // the spaced-rep ladder.
  const wasFirstSolve = !existing?.first_solved_at;

  const now = new Date().toISOString();
  const { data: upserted, error: writeErr } = await supabase
    .from("progress")
    .upsert(
      {
        user_id: user.id,
        problem_id: problemId,
        status: "solved",
        last_solved_at: now,
        attempts: (existing?.attempts ?? 0) + 1,
        first_solved_at: existing?.first_solved_at ?? now,
        updated_at: now,
      },
      { onConflict: "user_id,problem_id" },
    )
    .select("id, current_interval_days")
    .single();

  if (writeErr || !upserted) {
    throw new Error(
      `markSolved: failed to write progress: ${writeErr?.message ?? "no row returned"}`,
    );
  }

  // Kick off the spaced-rep ladder only on the *first* solve. Re-solves after
  // forgetting will already have an active revision in the queue (or will
  // shortly via /today's completeRevision path), so don't double-schedule.
  if (wasFirstSolve) {
    await scheduleNextRevision({
      supabase,
      progressId: upserted.id,
      currentIntervalDays: upserted.current_interval_days,
      rating: null,
    });
  }

  // Both pages depend on this data: checklist for the status dot, today for
  // the queue count.
  revalidatePath("/checklist");
  revalidatePath("/today");
  revalidatePath("/");
}
