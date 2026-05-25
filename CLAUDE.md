@AGENTS.md

# DSA Tracker — project context

A shared DSA progress tracker for **Sujal & friend**. Accountability is the moto: see each other's progress live, get re-prompted on solved problems via spaced repetition, never let consistency slip.

## Stack
- **Next.js 16.2.6** (App Router, Turbopack, TypeScript)
- **Tailwind v4**
- **Supabase** — Postgres + Auth + Realtime
- **Vercel** — deploy target
- Node 20 (nvm)

## Scope decisions (locked in)
- **2 hardcoded users only** — Sujal + Friend. No real signup; closed but public URL.
- **No per-problem notes field.** Dropped.
- **No "compare mode"** (side-by-side solutions). Dropped.
- **Progress bars on shared dashboard:** per-user (e.g. `120/328 solved`) AND combined unique (`200/328 between us`).
- **Spaced repetition: fixed intervals** — +3d, +7d, +21d, +60d after solving. Self-rated recall on revisit (easy/medium/hard/forgot) can advance or reset.
- **Problem source:** Pre-load **TUF+ DSA Checklist** (328 problems, curated takeUforward subset) from [`data/striver-a2z.json`](data/striver-a2z.json) + freeform adds later. PDF links not in source — `link` field is null and can be backfilled.

## Framework quirks — Next 16
- `middleware.ts` is renamed to **`proxy.ts`** (function: `export function proxy(request)`). Same functionality. Don't write `middleware.ts`.
- **`proxy.ts` must sit at the same level as `app/`** — so with a `src/` directory it goes at `src/proxy.ts`, not the repo root.
- Proxy files are NOT hot-reloaded reliably; if you add or move `proxy.ts`, wipe `.next/` and restart `npm run dev`.
- `cookies()` from `next/headers` is **async** — always `await cookies()`. `searchParams` on pages is also a Promise — `await searchParams`.
- **Files marked `"use server"` can only export async functions.** Constants and types co-located there get turned into server-function references at runtime — they're not iterable on the client. Move shared constants to a sibling file (see [`src/app/board/constants.ts`](src/app/board/constants.ts)).
- Before writing Next-specific code, check `node_modules/next/dist/docs/01-app/` (per [AGENTS.md](AGENTS.md)).

## Working style with Sujal
- **Plan → scaffold → explain → user writes core logic → defend every line.**
- Sujal is TS-comfortable but wants to understand each design call, not just accept code.
- Scaffold UI, wiring, and boilerplate. **Sujal writes** the meaningful handlers: `markSolved`, `scheduleNextRevision`, streak calculation, etc.
- Discuss schema/architectural choices *before* writing them. Ask, don't assume.

## Where things live
```
src/
  app/                  — routes (App Router)
    page.tsx            — dashboard (combined + per-user progress, streaks, activity feed)
    RealtimeRefresh.tsx — client subscriber, calls router.refresh() on progress/revisions changes
    login/
      page.tsx          — two-button login (Sujal / Pratyush)
      actions.ts        — loginAs() + logout() server actions
    checklist/
      page.tsx          — full problem list grouped by topic, per-row status + button
      actions.ts        — markSolved() server action (kicks off the spaced-rep ladder on first solve)
    today/
      page.tsx          — due-today queue (revisions where due_at <= now, not completed)
      actions.ts        — completeRevision(revisionId, rating) server action
    board/
      page.tsx          — kanban server fetch (progress rows joined to problems)
      KanbanBoard.tsx   — client component, dnd-kit DnD + useOptimistic
      actions.ts        — moveProblem(progressId, newStatus) server action
      constants.ts      — BOARD_STATUSES + BoardStatus (kept out of actions.ts; see file)
  lib/
    auth.ts             — USER_COOKIE, VALID_SLUGS, getCurrentUser()
    spaced-rep.ts       — pure interval math: nextInterval(rating, currentDays)
    revisions.ts        — scheduleNextRevision DB helper (updates progress + inserts revision row)
    streak.ts           — pure: computeStreak(activityTimestamps) → consecutive-day count
    heatmap.ts          — pure: buildHeatmap(timestamps, weeks=26) → column-major grid + intensity()
    dashboard.ts        — getDashboardData() server fetcher (combined + per-user + activity + heatmap)
    supabase/
      client.ts         — browser Supabase client
      server.ts         — server Supabase client (uses next/headers cookies)
  proxy.ts              — gates all routes except /login (cookie-based)
supabase/
  migrations/
    0001_init.sql       — initial schema (users, problems, progress, revisions)
    0002_realtime.sql   — adds progress + revisions to supabase_realtime publication
  README.md             — Supabase setup walkthrough
data/
  striver-a2z.json      — TUF+ Checklist seed data (328 problems)
scripts/
  seed-problems.ts      — upserts data/striver-a2z.json via service_role key
.env.local              — Supabase URL + keys (NOT committed)
.env.example            — placeholders (committed)
```

## Schema cheat sheet
- `users` — 2 hardcoded rows seeded by 0001_init.sql.
- `problems` — TUF+ Checklist catalog (int PK, has `sheet_order`).
- `progress` — one row per (user, problem). Current state only. `status`: todo/attempting/solved/mastered. Tracks `current_interval_days` for spaced rep.
- `revisions` — append-only log of every scheduled revision. `due_at`, `completed_at`, `recall_rating`.

**Key design call:** `progress` = current state, `revisions` = history. Don't mash them — losing the history kills the "audit your spaced-rep" feature.

## Build plan — current status

- [x] **Slice 0** — Next.js + Tailwind + Supabase clients scaffolded
- [x] **Slice 1** — Schema migration written (`supabase/migrations/0001_init.sql`)
- [x] **Slice 1.5 (user action)** — Supabase project created, `.env.local` filled, migration run
- [x] **Slice 2** — Seed script + JSON ready (`scripts/seed-problems.ts`, `data/striver-a2z.json`). Run with `npm run seed:problems`.
- [x] **Slice 3** — Hardcoded login shim. `user_slug` cookie + [`src/proxy.ts`](src/proxy.ts) gates everything except `/login`. [`src/lib/auth.ts`](src/lib/auth.ts) validates the slug against an allowlist before any DB call (defense in depth).
- [x] **Slice 4** — Checklist at [`/checklist`](src/app/checklist/page.tsx) (problems grouped by topic, per-row "Mark solved" button). [`markSolved`](src/app/checklist/actions.ts) reads existing progress, preserves `first_solved_at`, increments `attempts`, upserts, then revalidates.
- [x] **Slice 5** — `/today` queue + spaced-rep ladder. Pure math in [`src/lib/spaced-rep.ts`](src/lib/spaced-rep.ts) (intervals `[3, 7, 21, 60]` days; forgot→reset, hard→repeat, medium→advance, easy→advance or master). DB bridge in [`src/lib/revisions.ts`](src/lib/revisions.ts). markSolved triggers the first revision on first-time solves; `completeRevision` in [`src/app/today/actions.ts`](src/app/today/actions.ts) verifies ownership, marks the row complete, and schedules the next step.
- [x] **Slice 6** — Kanban at [`/board`](src/app/board/page.tsx) with 4 columns (todo/attempting/solved/mastered). `@dnd-kit/core` for DnD, `useOptimistic` + `useTransition` for instant feedback before [`moveProblem`](src/app/board/actions.ts) persists. Only shows progress rows — cards enter the board via /checklist. Manual moves don't touch the spaced-rep ladder (that's /checklist + /today's job).
- [x] **Slice 7** — Dashboard at [`/`](src/app/page.tsx) — combined progress bar, per-user bars + streaks, recent activity feed (last 5 events). Server fetch lives in [`src/lib/dashboard.ts`](src/lib/dashboard.ts); streak math in [`src/lib/streak.ts`](src/lib/streak.ts) (pure, unit-tested). [`RealtimeRefresh`](src/app/RealtimeRefresh.tsx) subscribes to progress + revisions postgres_changes and calls `router.refresh()` on any event — requires [`0002_realtime.sql`](supabase/migrations/0002_realtime.sql) applied for live updates.
- [x] **Slice 8** — GitHub-style activity heatmap (26 weeks × 7 days per user) added to the dashboard "Activity" section. Math in [`src/lib/heatmap.ts`](src/lib/heatmap.ts) (pure, 13 unit tests); 5-bucket intensity coloring with emerald scale; future-day cells rendered with a dashed outline so the column always has 7 rows. **Weekly digest deferred** — needs an email provider (Resend/Postmark) + cron infra (Vercel cron or pg_cron). Hold for after the app gets real use.

## Commands
```bash
npm run dev              # dev server on :3000
npm run build            # production build
npm run lint             # eslint
npm run seed:problems    # upsert data/striver-a2z.json into Supabase (uses service_role)
```
