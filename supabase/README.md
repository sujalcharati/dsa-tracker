# Supabase setup

## One-time

1. Go to https://supabase.com/dashboard → **New project**. Pick a region close to you, set a strong DB password, free tier is fine.
2. Wait ~1 min for it to provision.
3. **Settings → API** → copy:
   - `Project URL` → paste into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (under "Project API keys, secret") → paste as `SUPABASE_SERVICE_ROLE_KEY` (used only by seed scripts, never client-side)
4. **SQL Editor → New query** → paste the contents of `migrations/0001_init.sql` → **Run**.
5. Confirm: **Table Editor** should now show `users` (2 rows), `problems` (empty), `progress`, `revisions`.

## Per migration after this

Each new file in `migrations/` is a SQL script you paste & run in the SQL Editor in numeric order. Current files:

- `0001_init.sql` — base schema + 2 hardcoded users.
- `0002_realtime.sql` — adds `progress` and `revisions` to the `supabase_realtime` publication so the dashboard updates live when the other user solves something. Run this once after 0001.

## Seed the problems table

After running `0001_init.sql`, populate `problems` from [`data/striver-a2z.json`](../data/striver-a2z.json):

```bash
npm run seed:problems
```

This loads `.env.local` (needs `SUPABASE_SERVICE_ROLE_KEY`), validates every row, and upserts on `id` — safe to re-run after editing the JSON.
