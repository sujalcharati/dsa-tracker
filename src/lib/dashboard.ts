import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "./streak";
import { buildHeatmap, type HeatmapCell } from "./heatmap";

export type DashboardUser = {
  id: string;
  slug: string;
  display_name: string;
  avatar_emoji: string;
  solvedCount: number;
  streak: number;
  heatmap: HeatmapCell[][];
};

export const HEATMAP_WEEKS = 26;

export type ActivityEvent = {
  kind: "solved" | "revision";
  at: string;
  userId: string;
  userDisplayName: string;
  userEmoji: string;
  problemTitle: string;
};

export type DashboardData = {
  totalProblems: number;
  combinedSolved: number;
  users: DashboardUser[];
  recentActivity: ActivityEvent[];
};

type ProgressRow = {
  user_id: string;
  problem_id: number;
  status: "todo" | "attempting" | "solved" | "mastered";
  last_solved_at: string | null;
  problems: { title: string } | null;
};

type RevisionRow = {
  completed_at: string;
  progress: {
    user_id: string;
    problems: { title: string };
  };
};

type UserRow = {
  id: string;
  slug: string;
  display_name: string;
  avatar_emoji: string;
};

const SOLVED_STATUSES = new Set(["solved", "mastered"]);

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [usersRes, problemsRes, progressRes, revisionsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, slug, display_name, avatar_emoji")
      .order("display_name"),
    supabase
      .from("problems")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("progress")
      .select(
        "user_id, problem_id, status, last_solved_at, problems:problem_id ( title )",
      ),
    supabase
      .from("revisions")
      .select(
        "completed_at, progress:progress_id!inner ( user_id, problems:problem_id ( title ) )",
      )
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20),
  ]);

  if (usersRes.error) throw new Error(`dashboard users: ${usersRes.error.message}`);
  if (problemsRes.error) throw new Error(`dashboard problems: ${problemsRes.error.message}`);
  if (progressRes.error) throw new Error(`dashboard progress: ${progressRes.error.message}`);
  if (revisionsRes.error) throw new Error(`dashboard revisions: ${revisionsRes.error.message}`);

  const users = (usersRes.data ?? []) as UserRow[];
  const totalProblems = problemsRes.count ?? 0;
  const progressRows = (progressRes.data ?? []) as unknown as ProgressRow[];
  const revisionRows = (revisionsRes.data ?? []) as unknown as RevisionRow[];

  // Per-user solved counts + streak + heatmap
  const dashboardUsers: DashboardUser[] = users.map((u) => {
    const solvedRows = progressRows.filter(
      (p) => p.user_id === u.id && SOLVED_STATUSES.has(p.status),
    );
    const lastSolvedDates = progressRows
      .filter((p) => p.user_id === u.id)
      .map((p) => p.last_solved_at);
    const revisionDates = revisionRows
      .filter((r) => r.progress?.user_id === u.id)
      .map((r) => r.completed_at);
    const activityTimestamps = [...lastSolvedDates, ...revisionDates];

    return {
      id: u.id,
      slug: u.slug,
      display_name: u.display_name,
      avatar_emoji: u.avatar_emoji,
      solvedCount: solvedRows.length,
      streak: computeStreak(activityTimestamps),
      heatmap: buildHeatmap(activityTimestamps, HEATMAP_WEEKS),
    };
  });

  // Combined: distinct problem_ids any user has solved/mastered
  const combinedSet = new Set<number>();
  for (const p of progressRows) {
    if (SOLVED_STATUSES.has(p.status)) combinedSet.add(p.problem_id);
  }

  // Recent activity: merge solves + revisions, sort desc, take 5.
  // userById gives us display info without re-querying.
  const userById = new Map(users.map((u) => [u.id, u]));

  const events: ActivityEvent[] = [];

  for (const p of progressRows) {
    if (!p.last_solved_at) continue;
    const u = userById.get(p.user_id);
    if (!u) continue;
    events.push({
      kind: "solved",
      at: p.last_solved_at,
      userId: u.id,
      userDisplayName: u.display_name,
      userEmoji: u.avatar_emoji,
      problemTitle: p.problems?.title ?? `Problem ${p.problem_id}`,
    });
  }

  for (const r of revisionRows) {
    const u = userById.get(r.progress?.user_id);
    if (!u || !r.completed_at) continue;
    events.push({
      kind: "revision",
      at: r.completed_at,
      userId: u.id,
      userDisplayName: u.display_name,
      userEmoji: u.avatar_emoji,
      problemTitle: r.progress.problems?.title ?? "(unknown)",
    });
  }

  events.sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));

  return {
    totalProblems,
    combinedSolved: combinedSet.size,
    users: dashboardUsers,
    recentActivity: events.slice(0, 5),
  };
}
