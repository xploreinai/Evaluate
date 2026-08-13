-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Deleting sessions, and the pass mark
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER 004_trainer_auth.sql
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── PART 1 — let a session be deleted ────────────────────────────────────────
-- quiz_attempts points at sessions without a cascade, so deleting a session
-- that anyone had taken failed with a foreign key error. Deleting a session
-- should take its attempts (and, through them, its answers) with it.

alter table quiz_attempts drop constraint if exists quiz_attempts_session_id_fkey;
alter table quiz_attempts
  add constraint quiz_attempts_session_id_fkey
  foreign key (session_id) references sessions(id) on delete cascade;

-- answers already cascades from quiz_attempts; questions already cascades from
-- sessions. This makes the whole chain removable in one delete.


-- ── PART 2 — pass mark ───────────────────────────────────────────────────────
-- Added in 003; repeated here so a database built from 004 onwards still gets
-- it, and constrained to a sensible range.

alter table sessions add column if not exists pass_threshold integer default 70;

update sessions set pass_threshold = 70 where pass_threshold is null;

alter table sessions drop constraint if exists sessions_pass_threshold_check;
alter table sessions
  add constraint sessions_pass_threshold_check
  check (pass_threshold between 0 and 100);


-- ── PART 3 — check ───────────────────────────────────────────────────────────

select
  (select count(*) from information_schema.columns
    where table_name = 'sessions' and column_name = 'pass_threshold') as has_pass_threshold,
  (select confdeltype from pg_constraint
    where conname = 'quiz_attempts_session_id_fkey') as attempts_on_delete;
-- Expect: has_pass_threshold = 1, attempts_on_delete = 'c'  ('c' means cascade)
