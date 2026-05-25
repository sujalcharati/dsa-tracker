import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markSolved } from "./actions";

type Difficulty = "Easy" | "Medium" | "Hard";
type Status = "todo" | "attempting" | "solved" | "mastered";

type Problem = {
  id: number;
  sheet_order: number;
  title: string;
  topic: string;
  subtopic: string | null;
  difficulty: Difficulty;
  link: string | null;
};

type ProgressRow = {
  problem_id: number;
  status: Status;
  last_solved_at: string | null;
};

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Hard: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const STATUS_DOT: Record<Status, string> = {
  todo: "bg-zinc-300 dark:bg-zinc-700",
  attempting: "bg-amber-400",
  solved: "bg-emerald-500",
  mastered: "bg-sky-500",
};

function buttonLabel(status: Status): string {
  if (status === "solved") return "Solved ✓";
  if (status === "mastered") return "Mastered ✓";
  return "Mark solved";
}

export default async function ChecklistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [problemsRes, progressRes] = await Promise.all([
    supabase
      .from("problems")
      .select("id, sheet_order, title, topic, subtopic, difficulty, link")
      .order("sheet_order"),
    supabase
      .from("progress")
      .select("problem_id, status, last_solved_at")
      .eq("user_id", user.id),
  ]);

  if (problemsRes.error || progressRes.error) {
    const msg = problemsRes.error?.message ?? progressRes.error?.message;
    throw new Error(`Failed to load checklist: ${msg}`);
  }

  const problems = (problemsRes.data ?? []) as Problem[];
  const progressMap = new Map<number, ProgressRow>(
    ((progressRes.data ?? []) as ProgressRow[]).map((p) => [p.problem_id, p]),
  );

  // Group by topic, preserving the order in which each topic first appears
  // (which is sheet_order since we sorted upstream).
  const byTopic = new Map<string, Problem[]>();
  for (const p of problems) {
    if (!byTopic.has(p.topic)) byTopic.set(p.topic, []);
    byTopic.get(p.topic)!.push(p);
  }

  const totalSolved = [...progressMap.values()].filter(
    (p) => p.status === "solved" || p.status === "mastered",
  ).length;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-widest text-zinc-500">
              Checklist
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {user.avatar_emoji} {user.display_name}&apos;s progress
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {totalSolved} / {problems.length} solved across {byTopic.size}{" "}
              topics.
            </p>
          </div>
          <a
            href="/"
            className="shrink-0 text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Home
          </a>
        </header>

        <div className="space-y-3">
          {[...byTopic.entries()].map(([topic, items]) => {
            const solvedInTopic = items.filter((p) => {
              const s = progressMap.get(p.id)?.status;
              return s === "solved" || s === "mastered";
            }).length;

            return (
              <details
                key={topic}
                open
                className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <summary className="flex items-center justify-between cursor-pointer px-5 py-3 list-none">
                  <span className="font-medium">{topic}</span>
                  <span className="text-xs text-zinc-500">
                    {solvedInTopic} / {items.length}
                  </span>
                </summary>
                <ul className="border-t border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
                  {items.map((p) => {
                    const status = progressMap.get(p.id)?.status ?? "todo";
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 px-5 py-2.5"
                      >
                        <span
                          aria-hidden
                          className={`inline-block h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[status]}`}
                          title={status}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{p.title}</p>
                          {p.subtopic && (
                            <p className="text-xs text-zinc-500 truncate">
                              {p.subtopic}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded ${DIFFICULTY_STYLES[p.difficulty]}`}
                        >
                          {p.difficulty}
                        </span>
                        <form action={markSolved.bind(null, p.id)}>
                          <button
                            type="submit"
                            className="shrink-0 text-xs px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition"
                          >
                            {buttonLabel(status)}
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      </div>
    </main>
  );
}
