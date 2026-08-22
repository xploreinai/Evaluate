-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Participants, multi-answer questions, and quiz timer
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER 006_delete_cascade_answers.sql
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── PART 1 — participants, identified by employee ID ─────────────────────────
-- One row per person. The eID is the identity: entering the same one again
-- links the new attempt to the same history.

create table if not exists participants (
  id         uuid        primary key default gen_random_uuid(),
  eid        text        not null,
  name       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case- and space-insensitive, so "ab123", "AB123" and " AB123 " are one person.
create unique index if not exists participants_eid_key
  on participants (lower(trim(eid)));

alter table quiz_attempts
  add column if not exists participant_id uuid references participants(id) on delete cascade;

create index if not exists quiz_attempts_participant_idx on quiz_attempts (participant_id);
create index if not exists quiz_attempts_session_idx     on quiz_attempts (session_id);


-- ── PART 2 — questions may have more than one correct answer ─────────────────
-- correct_keys holds every correct option. Existing single-answer questions are
-- migrated to a one-element array; the old `correct` column is kept in step so
-- nothing that still reads it breaks.

alter table questions add column if not exists correct_keys text[];
alter table questions add column if not exists multi boolean not null default false;

update questions
   set correct_keys = array[correct]
 where correct_keys is null and correct is not null;

alter table answers add column if not exists selected_keys text[];

update answers
   set selected_keys = array[selected]
 where selected_keys is null and selected is not null;

-- `selected` held a single letter and was mandatory. Multi-answer responses
-- live in selected_keys instead, so the old column must be allowed to be empty.
alter table answers alter column selected drop not null;

-- Answers were unique per (attempt, question); still true with multi-select
-- because all of a participant's choices live in one array.


-- ── PART 3 — optional per-quiz timer ─────────────────────────────────────────
-- null means no time limit, which stays the default.

alter table sessions add column if not exists time_limit_seconds integer;

alter table sessions drop constraint if exists sessions_time_limit_check;
alter table sessions
  add constraint sessions_time_limit_check
  check (time_limit_seconds is null or time_limit_seconds between 30 and 7200);


-- ── PART 4 — identify a participant without exposing the roster ──────────────
-- Participants are anonymous visitors, so they cannot be allowed to read the
-- participants table (that would list every colleague's name and eID). This
-- function runs with elevated rights and returns only the caller's own id.

create or replace function upsert_participant(p_eid text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_eid is null or trim(p_eid) = '' then
    raise exception 'Employee ID is required';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'Name is required';
  end if;

  select id into v_id
    from participants
   where lower(trim(eid)) = lower(trim(p_eid));

  if v_id is null then
    insert into participants (eid, name)
    values (trim(p_eid), trim(p_name))
    returning id into v_id;
  else
    -- Keep the latest spelling of their name, but never change the eID.
    update participants
       set name = trim(p_name), updated_at = now()
     where id = v_id;
  end if;

  return v_id;
end $$;

revoke all on function upsert_participant(text, text) from public;
grant execute on function upsert_participant(text, text) to anon, authenticated;


-- ── PART 5 — access rules ────────────────────────────────────────────────────

alter table participants enable row level security;

drop policy if exists "Trainers read participants" on participants;
create policy "Trainers read participants" on participants
  for select to authenticated using (true);

-- No anon policy on purpose: participants reach their row only through
-- upsert_participant() above.


-- ── PART 6 — check ───────────────────────────────────────────────────────────

select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'participants')            as participants_table,
  (select count(*) from information_schema.columns
    where table_name = 'questions' and column_name = 'correct_keys')          as questions_correct_keys,
  (select count(*) from information_schema.columns
    where table_name = 'sessions'  and column_name = 'time_limit_seconds')    as sessions_timer,
  (select count(*) from information_schema.columns
    where table_name = 'quiz_attempts' and column_name = 'participant_id')    as attempts_participant,
  (select count(*) from pg_proc where proname = 'upsert_participant')         as upsert_function;
-- Expect 1 in every column.
