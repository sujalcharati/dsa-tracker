-- ─────────────────────────────────────────────────────────────
-- DSA Tracker — initial schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ─── users ───────────────────────────────────────────────────
-- 2 hardcoded users. `slug` is the URL-safe identifier used in
-- cookies and routes (e.g. /u/sujal). We seed both rows below.
create table users (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  display_name  text not null,
  avatar_emoji  text not null default '🙂',
  created_at    timestamptz not null default now()
);

-- ─── problems ────────────────────────────────────────────────
-- Striver A2Z catalog. Read-mostly: seeded once, rarely changed.
-- `sheet_order` preserves the original ordering of the sheet.
create table problems (
  id            int primary key,
  sheet_order   int not null,
  title         text not null,
  topic         text not null,
  subtopic      text,
  difficulty    text not null check (difficulty in ('Easy','Medium','Hard')),
  link          text,
  tags          text[] not null default '{}'
);

create index problems_topic_idx       on problems (topic);
create index problems_difficulty_idx  on problems (difficulty);

-- ─── progress ────────────────────────────────────────────────
-- One row per (user, problem). Tracks *current* state only.
-- History of revisions lives in the `revisions` table.
create table progress (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  problem_id            int  not null references problems(id) on delete cascade,
  status                text not null default 'todo'
                        check (status in ('todo','attempting','solved','mastered')),
  first_solved_at       timestamptz,
  last_solved_at        timestamptz,
  attempts              int  not null default 0,
  time_taken_min        int,
  current_interval_days int  not null default 0,
  updated_at            timestamptz not null default now(),
  unique (user_id, problem_id)
);

create index progress_user_idx        on progress (user_id);
create index progress_user_status_idx on progress (user_id, status);

-- ─── revisions ───────────────────────────────────────────────
-- Append-only log of every scheduled revision. `completed_at`
-- null = still due. `recall_rating` set when user reviews.
create table revisions (
  id            uuid primary key default gen_random_uuid(),
  progress_id   uuid not null references progress(id) on delete cascade,
  due_at        timestamptz not null,
  completed_at  timestamptz,
  recall_rating text check (recall_rating in ('easy','medium','hard','forgot')),
  created_at    timestamptz not null default now()
);

create index revisions_progress_idx     on revisions (progress_id);
create index revisions_due_pending_idx  on revisions (due_at) where completed_at is null;

-- ─── seed: 2 hardcoded users ─────────────────────────────────
-- Update display_name / avatar_emoji to your taste after running.
insert into users (slug, display_name, avatar_emoji) values
  ('sujal',    'Sujal',    '🦁'),
  ('pratyush', 'Pratyush', '🐯')
on conflict (slug) do nothing;
