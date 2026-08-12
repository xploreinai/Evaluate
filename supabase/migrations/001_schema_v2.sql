-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate v2 — Simplified Schema (Device-First Architecture)
-- No cloud storage needed — recordings stored on user device
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Organizations (for multi-tenant support)
create table if not exists orgs (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  created_at  timestamptz not null default now()
);

-- Trainer profiles (linked to auth.users)
create table if not exists profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  org_id      uuid        not null references orgs(id),
  full_name   text,
  created_at  timestamptz not null default now()
);

-- Training sessions (metadata only — no recording_url)
create table if not exists sessions (
  id          uuid        primary key default gen_random_uuid(),
  trainer_id  uuid        not null references auth.users(id),
  topic       text        not null,
  session_date date        not null,
  start_time  time,
  end_time    time,
  status      text        default 'draft', -- draft, published, closed
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Quiz questions (generated from transcription, not recording)
create table if not exists questions (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references sessions(id) on delete cascade,
  question    text        not null,
  option_a    text        not null,
  option_b    text        not null,
  option_c    text        not null,
  option_d    text        not null,
  correct     text        not null, -- 'a', 'b', 'c', or 'd'
  deleted_at  timestamptz, -- soft delete
  created_at  timestamptz not null default now()
);

-- Quiz attempts (participant submissions)
create table if not exists quiz_attempts (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references sessions(id),
  participant_name text    not null,
  score       integer,
  total_questions integer,
  passed      boolean,
  created_at  timestamptz not null default now()
);

-- Individual answers (which option each participant chose)
create table if not exists answers (
  id          uuid        primary key default gen_random_uuid(),
  attempt_id  uuid        not null references quiz_attempts(id) on delete cascade,
  question_id uuid        not null references questions(id),
  selected    text        not null, -- 'a', 'b', 'c', or 'd'
  is_correct  boolean,
  created_at  timestamptz not null default now(),
  unique(attempt_id, question_id)
);

-- Indexes for performance
create index if not exists idx_sessions_trainer on sessions(trainer_id);
create index if not exists idx_questions_session on questions(session_id);
create index if not exists idx_quiz_attempts_session on quiz_attempts(session_id);
create index if not exists idx_answers_attempt on answers(attempt_id);

-- Enable RLS
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table questions enable row level security;
alter table quiz_attempts enable row level security;
alter table answers enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Profiles: Users can only see their own profile
create policy "Users can view own profile"
  on profiles for select
  using ( id = auth.uid() );

create policy "Users can update own profile"
  on profiles for update
  using ( id = auth.uid() )
  with check ( id = auth.uid() );

-- Sessions: Trainers can only see their own sessions
create policy "Trainers see own sessions"
  on sessions for select
  using ( trainer_id = auth.uid() );

create policy "Trainers create own sessions"
  on sessions for insert
  with check ( trainer_id = auth.uid() );

create policy "Trainers update own sessions"
  on sessions for update
  using ( trainer_id = auth.uid() )
  with check ( trainer_id = auth.uid() );

create policy "Trainers delete own sessions"
  on sessions for delete
  using ( trainer_id = auth.uid() );

-- Questions: Trainers can see questions from their sessions
create policy "Trainers see own questions"
  on questions for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

create policy "Trainers insert questions"
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

-- Participants can read published questions
create policy "Participants read published questions"
  on questions for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = questions.session_id
        and sessions.status = 'published'
    )
  );

-- Quiz Attempts: Trainers can see attempts for their sessions
create policy "Trainers read own session attempts"
  on quiz_attempts for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = quiz_attempts.session_id
        and sessions.trainer_id = auth.uid()
    )
  );

-- Participants can submit attempts to published sessions
create policy "Participants submit attempts"
  on quiz_attempts for insert
  with check (
    exists (
      select 1 from sessions
      where sessions.id = quiz_attempts.session_id
        and sessions.status = 'published'
    )
  );

-- Answers: Trainers can read answers for their sessions
create policy "Trainers read own answers"
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

-- Participants can insert answers
create policy "Participants insert answers"
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
