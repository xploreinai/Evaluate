-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Trainer authentication
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER 003_open_access.sql
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Replaces the open pilot policies with real ownership:
--   • Trainers sign in and see only their own sessions and questions.
--   • Participants stay anonymous — they take quizzes with no account at all,
--     reading published questions and writing their own attempts and answers.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── PART 1 — reconnect sessions to real users ────────────────────────────────
-- Any leftover placeholder owner is cleared rather than deleted, so no data is
-- lost and the foreign key below can be trusted.

update sessions
   set trainer_id = null
 where trainer_id is not null
   and trainer_id not in (select id from auth.users);

alter table sessions drop constraint if exists sessions_trainer_id_fkey;
alter table sessions
  add constraint sessions_trainer_id_fkey
  foreign key (trainer_id) references auth.users(id) on delete cascade;


-- ── PART 2 — clear the open pilot policies ───────────────────────────────────

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('profiles', 'sessions', 'questions', 'quiz_attempts', 'answers')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;


-- ── PART 3 — trainers own their sessions ─────────────────────────────────────

create policy "Trainers read own sessions" on sessions
  for select to authenticated using (trainer_id = auth.uid());

create policy "Trainers create own sessions" on sessions
  for insert to authenticated with check (trainer_id = auth.uid());

create policy "Trainers update own sessions" on sessions
  for update to authenticated using (trainer_id = auth.uid());

create policy "Trainers delete own sessions" on sessions
  for delete to authenticated using (trainer_id = auth.uid());

-- Participants need to read the session behind a quiz link, but only once it
-- is published — and never the trainer's drafts.
create policy "Participants read published sessions" on sessions
  for select to anon using (status = 'published');


-- ── PART 4 — questions follow their session ──────────────────────────────────

create policy "Trainers manage own questions" on questions
  for all to authenticated
  using (
    exists (select 1 from sessions s where s.id = questions.session_id and s.trainer_id = auth.uid())
  )
  with check (
    exists (select 1 from sessions s where s.id = questions.session_id and s.trainer_id = auth.uid())
  );

create policy "Participants read published questions" on questions
  for select to anon
  using (
    deleted_at is null
    and exists (select 1 from sessions s where s.id = questions.session_id and s.status = 'published')
  );


-- ── PART 5 — quiz attempts and answers ───────────────────────────────────────
-- Participants submit without an account; trainers read results for their own
-- sessions only.

create policy "Participants submit attempts" on quiz_attempts
  for insert to anon, authenticated
  with check (
    exists (select 1 from sessions s where s.id = quiz_attempts.session_id and s.status = 'published')
  );

create policy "Trainers read own attempts" on quiz_attempts
  for select to authenticated
  using (
    exists (select 1 from sessions s where s.id = quiz_attempts.session_id and s.trainer_id = auth.uid())
  );

create policy "Participants insert answers" on answers
  for insert to anon, authenticated with check (true);

create policy "Trainers read own answers" on answers
  for select to authenticated
  using (
    exists (
      select 1
        from quiz_attempts a
        join sessions s on s.id = a.session_id
       where a.id = answers.attempt_id
         and s.trainer_id = auth.uid()
    )
  );


-- ── PART 6 — profiles ────────────────────────────────────────────────────────

create policy "Users manage own profile" on profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());


-- ── PART 7 — check ───────────────────────────────────────────────────────────

select tablename, count(*) as policy_count
  from pg_policies
 where schemaname = 'public'
 group by tablename
 order by tablename;
