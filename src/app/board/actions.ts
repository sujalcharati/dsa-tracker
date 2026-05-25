"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isBoardStatus, type BoardStatus } from "./constants";

/**
 * Moves a card between columns. Only updates `progress.status` (and the
 * timestamp) — does not touch the spaced-rep machinery. Rationale:
 *
 *   - /checklist starts the ladder via markSolved.
 *   - /today drives the ladder via completeRevision.
 *   - /board is for reorganizing after the fact (e.g. correcting an
 *     accidental mark, manually promoting solved → mastered).
 *
 * If you drag todo → solved here, no revisions get created — use /checklist
 * for the "real" first solve. This split keeps the data model honest.
 */
export async function moveProblem(progressId: string, newStatus: BoardStatus) {
  if (typeof progressId !== "string" || progressId.length === 0) {
    throw new Error("moveProblem: invalid progressId");
  }
  if (!isBoardStatus(newStatus)) {
    throw new Error(`moveProblem: invalid status ${String(newStatus)}`);
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Ownership enforced via the user_id filter: if the progressId belongs to
  // the other user, this query matches zero rows and `data` comes back null.
  const { data, error } = await supabase
    .from("progress")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", progressId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`moveProblem: ${error.message}`);
  }
  if (!data) {
    throw new Error("moveProblem: progress row not found or forbidden");
  }

  revalidatePath("/board");
  revalidatePath("/checklist");
  revalidatePath("/");
}
