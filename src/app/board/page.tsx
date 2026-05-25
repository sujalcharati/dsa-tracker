import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard, type BoardCard } from "./KanbanBoard";
import type { BoardStatus } from "./constants";

type Difficulty = "Easy" | "Medium" | "Hard";

type ProgressJoined = {
  id: string;
  status: BoardStatus;
  problems: {
    id: number;
    title: string;
    topic: string;
    difficulty: Difficulty;
    sheet_order: number;
  };
};

export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("progress")
    .select(
      `
      id,
      status,
      problems:problem_id!inner ( id, title, topic, difficulty, sheet_order )
    `,
    )
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Failed to load board: ${error.message}`);
  }

  // Cast at the boundary — see /today/page.tsx for the same pattern.
  const rows = (data ?? []) as unknown as ProgressJoined[];

  const cards: BoardCard[] = rows
    .map((r) => ({
      progressId: r.id,
      problemId: r.problems.id,
      title: r.problems.title,
      topic: r.problems.topic,
      difficulty: r.problems.difficulty,
      status: r.status,
      _order: r.problems.sheet_order,
    }))
    .sort((a, b) => a._order - b._order)
    .map(({ _order, ...rest }) => {
      void _order;
      return rest;
    });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-widest text-zinc-500">
              Board
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {user.avatar_emoji} {cards.length} cards in flight
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Drag between columns to reorganize. New cards enter the board
              when you{" "}
              <a href="/checklist" className="underline">
                mark something solved
              </a>
              . Manual moves don&apos;t touch the spaced-rep ladder.
            </p>
          </div>
          <a
            href="/"
            className="shrink-0 text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Home
          </a>
        </header>

        {cards.length === 0 ? (
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
            No cards yet. Head to the{" "}
            <a href="/checklist" className="underline">
              checklist
            </a>{" "}
            and mark a problem solved — it&apos;ll land in the Solved column.
          </section>
        ) : (
          <KanbanBoard cards={cards} />
        )}
      </div>
    </main>
  );
}
