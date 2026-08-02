-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Row Level Security (CLEAN - idempotent)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run multiple times
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table questions enable row level security;
alter table quiz_attempts enable row level security;
alter table answers enable row level security;

-- Drop ALL existing policies (safe to run multiple times)
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "v1 open" on sessions;
drop policy if exists "Trainers see own sessions" on sessions;
drop policy if exists "Trainers create own sessions" on sessions;
drop policy if exists "Trainers update own sessions" on sessions;
drop policy if exists "Trainers delete own sessions" on sessions;
drop policy if exists "v1 open" on questions;
drop policy if exists "Trainers see own questions" on questions;
drop policy if exists "Trainers insert into own sessions" on questions;
drop policy if exists "Trainers update own questions" on questions;
drop policy if exists "Trainers delete own questions" on questions;
drop policy if exists "Participants read published questions" on questions;
drop policy if exists "v1 open" on quiz_attempts;
drop policy if exists "Trainers read own session attempts" on quiz_attempts;
drop policy if exists "Participants submit to published sessions" on quiz_attempts;
drop policy if exists "v1 open" on answers;
drop policy if exists "Trainers read own session answers" on answers;
drop policy if exists "Participants insert answers to published sessions" on answers;

-- Recreate profiles table if not exists
create table if not exists profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  org_id      uuid        not null references orgs(id),
  full_name   text,
  created_at  timestamptz not null default now()
);

-- Profiles policies
create policy "Users can view own profile"
  on profiles for select
  using ( id = auth.uid() );

create policy "Users can update own profile"
  on profiles for update
  using ( id = auth.uid() )
  with check ( id = auth.uid() );

-- Sessions policies
create policy "Trainers see own sessions"
  on sessions for select
  using ( trainer_id = auth.uid() );

create policy "Trainers create own sessions"
  on sessions for insert
  with check ( trainer_id = auth.uid() );

create policy "Trainers update own sessions"
  on sessions for update
  using  ( trainer_id = auth.uid() )
  with check ( trainer_id = auth.uid() );

create policy "Trainers delete own sessions"
  on sessions for delete
  using ( trainer_id = auth.uid() );

-- Questions policies
create policy "Trainers see own questions"
  on questions for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

create policy "Trainers insert into own sessions"
  on questions for insert
  with check (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

create policy "Trainers update own questions"
  on questions for update
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

create policy "Trainers delete own questions"
  on questions for delete
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

create policy "Participants read published questions"
  on questions for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.status = 'published'
    )
  );

-- Quiz attempts policies
create policy "Trainers read own session attempts"
  on quiz_attempts for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = quiz_attempts.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

create policy "Participants submit to published sessions"
  on quiz_attempts for insert
  with check (
    exists (
      select 1 from sessions
      where sessions.id = quiz_attempts.session_id
        and sessions.status = 'published'
    )
  );

-- Answers policies
create policy "Trainers read own session answers"
  on answers for select
  using (
    exists (
      select 1
      from quiz_attempts qa
      join sessions s on s.id = qa.session_id
      where qa.id = answers.attempt_id
        and s.trainer_id = auth.uid()
    )
  );

create policy "Participants insert answers to published sessions"
  on answers for insert
  with check (
    exists (
      select 1
      from quiz_attempts qa
      join sessions s on s.id = qa.session_id
      where qa.id = answers.attempt_id
        and s.status = 'published'
    )
  );
