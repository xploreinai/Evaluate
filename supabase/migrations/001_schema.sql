-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Initial schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────


-- 1. orgs — one row per hotel property
create table orgs (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

-- Insert the placeholder org used while auth is skipped in v1
insert into orgs (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Demo Hotel');


-- 2. sessions — one row per uploaded training session
create type session_status as enum (
  'processing',  -- file uploaded, Whisper + GPT running
  'ready',       -- questions generated, trainer reviewing
  'published',   -- QR code active, accepting responses
  'closed'       -- quiz closed, PDF available
);

create table sessions (
  id              uuid           primary key default gen_random_uuid(),
  org_id          uuid           not null references orgs(id),
  trainer_id      uuid           not null,      -- references auth.users when auth is added
  title           text           not null,
  department      text,
  session_date    date           not null,
  recording_url   text,                         -- Supabase Storage path
  transcript      text,                         -- filled after Whisper
  pass_threshold  int            not null default 70,
  status          session_status not null default 'processing',
  pdf_url         text,                         -- filled after PDF generation
  created_at      timestamptz    not null default now()
);


-- 3. questions — up to 10 per session
create table questions (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references orgs(id),
  session_id    uuid        not null references sessions(id) on delete cascade,
  position      int         not null,           -- display order: 1 to 10
  question_text text        not null,
  options       jsonb       not null,
  -- options format: [{"key":"A","text":"..."},{"key":"B","text":"..."},...]
  correct_key   text        not null,           -- "A" | "B" | "C" | "D"
  is_deleted    boolean     not null default false,
  created_at    timestamptz not null default now(),

  unique (session_id, position)
);


-- 4. quiz_attempts — one row per participant submission
create table quiz_attempts (
  id                uuid        primary key default gen_random_uuid(),
  org_id            uuid        not null references orgs(id),
  session_id        uuid        not null references sessions(id) on delete cascade,
  participant_name  text        not null,
  score             int         not null,        -- number correct (0–10)
  passed            boolean     not null,        -- score / total >= pass_threshold
  submitted_at      timestamptz not null default now()
);


-- 5. answers — one row per question per attempt
create table answers (
  id            uuid    primary key default gen_random_uuid(),
  org_id        uuid    not null references orgs(id),
  attempt_id    uuid    not null references quiz_attempts(id) on delete cascade,
  question_id   uuid    not null references questions(id),
  selected_key  text    not null,                -- "A" | "B" | "C" | "D"
  is_correct    boolean not null,

  unique (attempt_id, question_id)
);


-- ─── Indexes ────────────────────────────────────────────────────────────────
create index on sessions      (org_id);
create index on sessions      (trainer_id);
create index on questions     (session_id);
create index on quiz_attempts (session_id);
create index on quiz_attempts (org_id);
create index on answers       (attempt_id);


-- ─── Row Level Security ──────────────────────────────────────────────────────
-- v1 uses a single placeholder org so RLS is permissive for now.
-- Tighten these policies when real auth is added.

alter table orgs           enable row level security;
alter table sessions       enable row level security;
alter table questions      enable row level security;
alter table quiz_attempts  enable row level security;
alter table answers        enable row level security;

-- Allow all operations for now (v1 — no real auth yet)
create policy "v1 open" on orgs           for all using (true) with check (true);
create policy "v1 open" on sessions       for all using (true) with check (true);
create policy "v1 open" on questions      for all using (true) with check (true);
create policy "v1 open" on quiz_attempts  for all using (true) with check (true);
create policy "v1 open" on answers        for all using (true) with check (true);


-- ─── Storage bucket ──────────────────────────────────────────────────────────
-- Run this separately in: Supabase Dashboard → Storage → New bucket
-- Name: recordings
-- Public: OFF
-- Max file size: 500 MB
--
-- Then add this storage policy in Dashboard → Storage → recordings → Policies:
-- Allow all for now (v1):
--   insert: true
--   select: true
