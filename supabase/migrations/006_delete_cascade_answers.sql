-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Finish the delete chain
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER 005_delete_and_pass_mark.sql
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 005 made quiz_attempts cascade from sessions, but missed answers.question_id,
-- which still pointed at questions with no cascade. Deleting a session then
-- failed with:
--   update or delete on table "questions" violates foreign key constraint
--   "answers_question_id_fkey" on table "answers"
--
-- Deleting a session should remove everything belonging to it:
--   sessions → questions → answers
--   sessions → quiz_attempts → answers
-- ─────────────────────────────────────────────────────────────────────────────


alter table answers drop constraint if exists answers_question_id_fkey;
alter table answers
  add constraint answers_question_id_fkey
  foreign key (question_id) references questions(id) on delete cascade;


-- ── Check every foreign key at once ──────────────────────────────────────────
-- on_delete should read 'cascade' for all five rows below. Anything showing
-- 'no action' will block a delete somewhere.

select
  tc.table_name        as child_table,
  kcu.column_name      as child_column,
  ccu.table_name       as parent_table,
  case c.confdeltype
    when 'c' then 'cascade'
    when 'a' then 'no action'
    when 'r' then 'restrict'
    when 'n' then 'set null'
    when 'd' then 'set default'
  end                  as on_delete
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
join pg_constraint c
  on c.conname = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('questions', 'quiz_attempts', 'answers')
order by child_table, child_column;
