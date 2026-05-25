import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RECALL_RATINGS, type RecallRating } from "@/lib/spaced-rep";
import { completeRevision } from "./actions";

type Difficulty = "Easy" | "Medium" | "Hard";

type DueRevision = {
  id: string;
  due_at: string;
  progress: {
    id: string;
    user_id: string;
    current_interval_days: number;
    last_solved_at: string | null;
    problems: {
      id: number;
      title: string;
      topic: string;
      difficulty: Difficulty;
    };
  };
};

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Hard: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const RATING_STYLES: Record<RecallRating, string> = {
  forgot:
    "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40",
  hard:
    "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40",
  medium:
    "border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/40",
  easy:
    "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
};

const RATING_LABEL: Record<RecallRating, string> = {
  forgot: "Forgot",
  hard: "Hard",
  medium: "Medium",
  easy: "Easy",
};

function daysAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("revisions")
    .select(
      `
      id,
      due_at,
      progress:progress_id!inner (
        id,
        user_id,
        current_interval_days,
        last_solved_at,
        problems:problem_id!inner ( id, title, topic, difficulty )
      )
    `,
    )
    .is("completed_at", null)
    .lte("due_at", new Date().toISOString())
    .eq("progress.user_id", user.id)
    .order("due_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load today's queue: ${error.message}`);
  }

  // Supabase's embed returns objects for `belongs-to` joins, but its TS types
  // sometimes widen to arrays. Cast once at the boundary.
  const dueRows = (data ?? []) as unknown as DueRevision[];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-widest text-zinc-500">
              Today
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {user.avatar_emoji} {dueRows.length} due
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Self-rate after solving from memory. Honest ratings make the
              ladder work.
            </p>
          </div>
          <a
            href="/"
            className="shrink-0 text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Home
          </a>
        </header>

        {dueRows.length === 0 ? (
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Nothing due. Come back when a revision matures, or{" "}
            <a href="/checklist" className="underline">
              solve something new
            </a>
            .
          </section>
        ) : (
          <ul className="space-y-3">
            {dueRows.map((rev) => {
              const p = rev.progress.problems;
              return (
                <li
                  key={rev.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.title}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {p.topic} • last solved {daysAgo(rev.progress.last_solved_at)} • interval {rev.progress.current_interval_days}d
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded ${DIFFICULTY_STYLES[p.difficulty]}`}
                    >
                      {p.difficulty}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {RECALL_RATINGS.map((rating) => (
                      <form
                        key={rating}
                        action={completeRevision.bind(null, rev.id, rating)}
                      >
                        <button
                          type="submit"
                          className={`w-full text-xs px-3 py-1.5 rounded border transition ${RATING_STYLES[rating]}`}
                        >
                          {RATING_LABEL[rating]}
                        </button>
                      </form>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
