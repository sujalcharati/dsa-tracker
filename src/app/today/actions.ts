"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { scheduleNextRevision } from "@/lib/revisions";
import { isRecallRating, type RecallRating } from "@/lib/spaced-rep";

/**
 * Marks a revision complete with a self-rating and schedules the next one
 * (or marks the underlying problem mastered when easy beats the 60-day step).
 *
 * Defense in depth: validates revisionId is a string, rating is on the
 * enum, verifies the revision actually belongs to the current user, and
 * refuses to re-complete an already-completed row.
 */
export async function completeRevision(
  revisionId: string,
  rating: RecallRating,
) {
  if (typeof revisionId !== "string" || revisionId.length === 0) {
    throw new Error("completeRevision: invalid revisionId");
  }
  if (!isRecallRating(rating)) {
    throw new Error(`completeRevision: invalid rating ${String(rating)}`);
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Two queries (revision, then progress) instead of a join — avoids the
  // nested-select typing dance and the perf cost is meaningless at our scale
  // (one user, one rating click).
  const { data: rev, error: revErr } = await supabase
    .from("revisions")
    .select("id, progress_id, completed_at")
    .eq("id", revisionId)
    .maybeSingle();
  if (revErr) {
    throw new Error(`completeRevision (read rev): ${revErr.message}`);
  }
  if (!rev) {
    throw new Error("completeRevision: revision not found");
  }
  if (rev.completed_at) {
    // Idempotency: a duplicate submit (back button, double-click) shouldn't
    // schedule another revision on top.
    return;
  }

  const { data: progress, error: pErr } = await supabase
    .from("progress")
    .select("id, user_id, current_interval_days")
    .eq("id", rev.progress_id)
    .single();
  if (pErr || !progress) {
    throw new Error(
      `completeRevision (read progress): ${pErr?.message ?? "no row"}`,
    );
  }
  if (progress.user_id !== user.id) {
    // Don't 403 with details — just refuse.
    throw new Error("completeRevision: forbidden");
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("revisions")
    .update({ completed_at: nowIso, recall_rating: rating })
    .eq("id", revisionId);
  if (updErr) {
    throw new Error(`completeRevision (update rev): ${updErr.message}`);
  }

  await scheduleNextRevision({
    supabase,
    progressId: progress.id,
    currentIntervalDays: progress.current_interval_days,
    rating,
  });

  revalidatePath("/today");
  revalidatePath("/checklist");
  revalidatePath("/");
}
