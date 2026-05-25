-- ─────────────────────────────────────────────────────────────
-- DSA Tracker — enable Supabase Realtime for the dashboard
-- ─────────────────────────────────────────────────────────────
-- Supabase Realtime won't deliver postgres_changes events unless the
-- table is in the `supabase_realtime` publication. The dashboard
-- (src/app/page.tsx + src/app/RealtimeRefresh.tsx) subscribes to both
-- progress and revisions so each user sees the other's solves live.
--
-- Safe to re-run: alter publication is idempotent on duplicate table.

alter publication supabase_realtime add table progress;
alter publication supabase_realtime add table revisions;
