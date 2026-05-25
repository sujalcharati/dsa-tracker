import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData, type ActivityEvent } from "@/lib/dashboard";
import { intensity, type HeatmapCell } from "@/lib/heatmap";
import { logout } from "@/app/login/actions";
import { RealtimeRefresh } from "./RealtimeRefresh";

// Hardcoded so Tailwind's static scanner picks the classes up.
const HEATMAP_COLOR: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-zinc-200 dark:bg-zinc-800",
  1: "bg-emerald-200 dark:bg-emerald-950",
  2: "bg-emerald-400 dark:bg-emerald-800",
  3: "bg-emerald-600 dark:bg-emerald-600",
  4: "bg-emerald-800 dark:bg-emerald-400",
};

async function getDueCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("revisions")
    .select("id, progress:progress_id!inner(user_id)", {
      count: "exact",
      head: true,
    })
    .is("completed_at", null)
    .lte("due_at", new Date().toISOString())
    .eq("progress.user_id", userId);
  if (error) return 0;
  return count ?? 0;
}

function pct(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 100);
}

function timeAgo(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function eventVerb(e: ActivityEvent): string {
  return e.kind === "solved" ? "solved" : "revised";
}

export default async function Home() {
  const user = await getCurrentUser();
  const [dashboard, dueCount] = await Promise.all([
    getDashboardData(),
    user ? getDueCount(user.id) : Promise.resolve(0),
  ]);

  const combinedPct = pct(dashboard.combinedSolved, dashboard.totalProblems);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6 py-12">
      <RealtimeRefresh />
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-widest text-zinc-500">
              DSA Tracker
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Stay accountable. Solve consistently.
            </h1>
          </div>
          {user && (
            <form action={logout}>
              <button
                type="submit"
                className="shrink-0 text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                Log out
              </button>
            </form>
          )}
        </header>

        {user && (
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 flex flex-wrap items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {user.avatar_emoji}
            </span>
            <div className="space-y-0.5 flex-1 min-w-0">
              <p className="text-sm text-zinc-500">Signed in as</p>
              <p className="font-medium truncate">{user.display_name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/today"
                className={`text-sm px-4 py-2 rounded border transition ${
                  dueCount > 0
                    ? "border-emerald-400 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                }`}
              >
                {dueCount > 0 ? `${dueCount} due today →` : "Today's queue →"}
              </a>
              <a
                href="/checklist"
                className="text-sm px-4 py-2 rounded border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition"
              >
                Checklist →
              </a>
              <a
                href="/board"
                className="text-sm px-4 py-2 rounded border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition"
              >
                Board →
              </a>
            </div>
          </section>
        )}

        {/* Combined progress */}
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Between us</h2>
            <p className="text-sm text-zinc-500">
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                {dashboard.combinedSolved}
              </span>{" "}
              / {dashboard.totalProblems} ({combinedPct}%)
            </p>
          </div>
          <ProgressBar percent={combinedPct} variant="combined" />
          <p className="text-xs text-zinc-500">
            Unique problems solved by at least one of us.
          </p>
        </section>

        {/* Per-user */}
        <section className="space-y-3">
          <h2 className="font-medium px-1">Per user</h2>
          {dashboard.users.map((u) => {
            const userPct = pct(u.solvedCount, dashboard.totalProblems);
            const isMe = user?.id === u.id;
            return (
              <div
                key={u.id}
                className={`rounded-lg border p-4 space-y-2 ${
                  isMe
                    ? "border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-900"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {u.avatar_emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {u.display_name}{" "}
                      {isMe && (
                        <span className="text-xs text-zinc-500 font-normal">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {u.solvedCount} / {dashboard.totalProblems} • streak{" "}
                      {u.streak}d
                    </p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{userPct}%</p>
                </div>
                <ProgressBar percent={userPct} variant="user" />
              </div>
            );
          })}
        </section>

        {/* Activity heatmaps */}
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Activity</h2>
            <p className="text-xs text-zinc-500">Last 26 weeks</p>
          </div>
          {dashboard.users.map((u) => (
            <div key={u.id} className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span aria-hidden>{u.avatar_emoji}</span>
                <span className="font-medium">{u.display_name}</span>
                <span className="text-xs text-zinc-500">
                  streak {u.streak}d
                </span>
              </div>
              <Heatmap cells={u.heatmap} />
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-zinc-500 pt-1">
            <span>Less</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span
                key={lvl}
                className={`h-2.5 w-2.5 rounded-sm ${HEATMAP_COLOR[lvl]}`}
                aria-hidden
              />
            ))}
            <span>More</span>
          </div>
        </section>

        {/* Recent activity */}
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h2 className="font-medium">Recent activity</h2>
          {dashboard.recentActivity.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nothing yet. Solve a problem to kick this off.
            </p>
          ) : (
            <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1.5">
              {dashboard.recentActivity.map((e, i) => (
                <li
                  key={`${e.at}-${e.userId}-${i}`}
                  className="flex items-center gap-2"
                >
                  <span aria-hidden>{e.userEmoji}</span>
                  <span className="font-medium">{e.userDisplayName}</span>
                  <span className="text-zinc-500">{eventVerb(e)}</span>
                  <span className="truncate">{e.problemTitle}</span>
                  <span className="ml-auto text-xs text-zinc-500 shrink-0">
                    {timeAgo(e.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Heatmap({ cells }: { cells: HeatmapCell[][] }) {
  const today = new Date().toISOString().slice(0, 10);
  const flat = cells.flat();
  return (
    <div
      className="grid grid-flow-col grid-rows-7 gap-0.5 w-fit"
      role="img"
      aria-label="Activity heatmap, last 26 weeks"
    >
      {flat.map((cell) => {
        const isFuture = cell.date > today;
        const lvl = intensity(cell.count);
        // Future cells (in the current week past today) stay at the empty
        // shade; we still render them so the column has 7 rows.
        const cls = isFuture
          ? "bg-transparent border border-dashed border-zinc-200 dark:border-zinc-800"
          : HEATMAP_COLOR[lvl];
        return (
          <div
            key={cell.date}
            className={`h-2.5 w-2.5 rounded-sm ${cls}`}
            title={
              isFuture
                ? cell.date
                : `${cell.count} ${cell.count === 1 ? "activity" : "activities"} on ${cell.date}`
            }
          />
        );
      })}
    </div>
  );
}

function ProgressBar({
  percent,
  variant,
}: {
  percent: number;
  variant: "combined" | "user";
}) {
  const fill =
    variant === "combined"
      ? "bg-gradient-to-r from-emerald-500 to-sky-500"
      : "bg-zinc-700 dark:bg-zinc-300";
  return (
    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full ${fill} transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}
