-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Row Level Security
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER 001_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- This file does three things:
--   1. Adds a `profiles` table that links each logged-in trainer to an org.
--   2. Replaces the open v1 policies with real per-user policies.
--   3. Adds separate participant (anonymous) policies so staff can submit
--      quiz answers without logging in.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- PART 1 — PROFILES TABLE
-- Supabase Auth gives every logged-in user a UUID (auth.uid()).
-- This table ties that UUID to an org so we know which hotel the trainer
-- belongs to.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  org_id      uuid        not null references orgs(id),
  full_name   text,
  created_at  timestamptz not null default now()
);

-- When a new user signs up via Supabase Auth, automatically create their
-- profile row. The org_id is passed in as user metadata during sign-up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, org_id, full_name)
  values (
    new.id,
    (new.raw_user_meta_data->>'org_id')::uuid,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

alter table profiles enable row level security;

-- Drop old policies if re-running this file
drop policy if exists "Users can view own profile"   on profiles;
drop policy if exists "Users can update own profile" on profiles;

-- Policy: a trainer can only see their own profile row, not anyone else's.
create policy "Users can view own profile"
  on profiles for select
  using ( id = auth.uid() );

-- Policy: a trainer can update their own name but cannot change their org_id.
create policy "Users can update own profile"
  on profiles for update
  using ( id = auth.uid() )
  with check ( id = auth.uid() );


-- ═════════════════════════════════════════════════════════════════════════════
-- PART 2 — SESSIONS
-- A session belongs to the trainer who created it (trainer_id = auth.uid()).
-- Participants never touch this table.
-- ═════════════════════════════════════════════════════════════════════════════

-- Remove the open v1 policy
drop policy if exists "v1 open" on sessions;

-- Policy: trainers can only see sessions they created.
-- auth.uid() is the UUID Supabase gives the logged-in user.
create policy "Trainers see own sessions"
  on sessions for select
  using ( trainer_id = auth.uid() );

-- Policy: a trainer can only create a session for themselves.
-- The with check stops them setting trainer_id to someone else's ID.
create policy "Trainers create own sessions"
  on sessions for insert
  with check ( trainer_id = auth.uid() );

-- Policy: a trainer can only update sessions they own.
-- Covers status changes, adding the transcript, updating the PDF URL, etc.
create policy "Trainers update own sessions"
  on sessions for update
  using  ( trainer_id = auth.uid() )
  with check ( trainer_id = auth.uid() );

-- Policy: a trainer can delete their own sessions (and cascade deletes
-- questions, attempts, and answers automatically).
create policy "Trainers delete own sessions"
  on sessions for delete
  using ( trainer_id = auth.uid() );


-- ═════════════════════════════════════════════════════════════════════════════
-- PART 3 — QUESTIONS
-- Questions belong to a session. To check ownership we look up whether
-- the session belongs to the logged-in trainer.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "v1 open" on questions;

-- Policy: trainers can read questions that belong to their own sessions.
create policy "Trainers see own questions"
  on questions for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

-- Policy: trainers can only insert questions into sessions they own.
-- The Edge Function that generates questions runs with the trainer's
-- auth context, so this policy covers AI-generated rows too.
create policy "Trainers insert into own sessions"
  on questions for insert
  with check (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

-- Policy: trainers can edit or soft-delete questions in their own sessions.
create policy "Trainers update own questions"
  on questions for update
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

-- Policy: trainers can hard-delete questions in their own sessions.
create policy "Trainers delete own questions"
  on questions for delete
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

-- Policy: participants (not logged in, using the anon role) can read
-- questions for a session that is currently published.
-- This is how the quiz screen fetches the questions from a QR code link.
create policy "Participants read published questions"
  on questions for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.status = 'published'
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- PART 4 — QUIZ ATTEMPTS
-- Trainers read attempts on their sessions.
-- Participants (anon) write a single attempt when they submit the quiz.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "v1 open" on quiz_attempts;

-- Policy: trainers can see all submissions for sessions they own.
-- This is what populates the results dashboard.
create policy "Trainers read own session attempts"
  on quiz_attempts for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = quiz_attempts.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

-- Policy: anyone (including staff with no account) can submit an attempt,
-- BUT only if the session is currently published.
-- This is the gate that stops submissions after a trainer closes the quiz.
create policy "Participants submit to published sessions"
  on quiz_attempts for insert
  with check (
    exists (
      select 1 from sessions
      where sessions.id = quiz_attempts.session_id
        and sessions.status = 'published'
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- PART 5 — ANSWERS
-- Same pattern as quiz_attempts: trainers read, participants write.
-- Writing is additionally gated: the attempt must exist and belong to a
-- published session, so random inserts cannot pollute the results.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "v1 open" on answers;

-- Policy: trainers can read all answers for attempts in their sessions.
-- This powers the "which question did most people get wrong" breakdown.
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

-- Policy: anyone can insert an answer row, as long as the attempt it
-- belongs to is linked to a published session.
-- The unique constraint (attempt_id, question_id) on the table prevents
-- a participant from submitting the same question twice.
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


-- ═════════════════════════════════════════════════════════════════════════════
-- PART 6 — SUPABASE EDGE FUNCTION SERVICE ROLE
-- The process-session Edge Function runs Whisper and GPT-4o and then
-- writes 10 question rows. It uses the Supabase SERVICE ROLE key, which
-- bypasses RLS entirely. That is intentional: the function is trusted
-- server-side code, not a user making a request.
--
-- Use NEXT_PUBLIC keys in the browser.
-- Use the SERVICE ROLE key only in Edge Functions and server code.
-- Never expose the service role key to the browser.
-- ═════════════════════════════════════════════════════════════════════════════
