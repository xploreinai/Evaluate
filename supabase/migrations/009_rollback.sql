-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Undo 009_multi_property.sql
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Use this if 009 leaves trainers unable to see their own sessions, or if
-- anything else about it goes wrong. It puts the access rules back exactly as
-- 008 left them and restores the old employee-ID behaviour.
--
-- It deliberately does NOT drop org_id, the roles, orgs or usage_events. Those
-- columns are harmless when unused, and dropping them would throw away the
-- backfill — so if you re-run 009 later, it picks up where it left off rather
-- than starting again.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1 — stop new sign-ups being given a profile ──────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;


-- ── 2 — remove the three-argument join function ──────────────────────────────
-- The two-argument form 008 created is restored below.

drop function if exists upsert_participant(uuid, text, text);

create or replace function upsert_participant(p_eid text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id            uuid;
  v_existing_name text;
begin
  if p_eid is null or trim(p_eid) = '' then
    raise exception 'Employee ID is required';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'Name is required';
  end if;
  if participant_first_name(p_name) = '' then
    raise exception 'Please enter your name using letters or numbers.';
  end if;

  select id, name into v_id, v_existing_name
    from participants
   where lower(trim(eid)) = lower(trim(p_eid));

  if v_id is null then
    insert into participants (eid, name)
    values (trim(p_eid), trim(p_name))
    returning id into v_id;

  elsif participant_first_name(v_existing_name) <> participant_first_name(p_name) then
    raise exception
      'This employee ID is already registered to someone else. Please check the ID, or enter your name the way you registered it.'
      using errcode = 'P0001';

  else
    update participants set name = trim(p_name), updated_at = now() where id = v_id;
  end if;

  return v_id;
end $$;

revoke all on function upsert_participant(text, text) from public;
grant execute on function upsert_participant(text, text) to anon, authenticated;


-- ── 3 — employee IDs go back to being unique across everything ───────────────
-- If two properties have already registered the same ID, this cannot be undone
-- automatically: the unique index will refuse to build and tell you which ID
-- clashes. Sort that person out by hand, then run this again.

drop index if exists participants_org_eid_key;
create unique index if not exists participants_eid_key
  on participants (lower(trim(eid)));


-- ── 4 — put the 008-era access rules back ────────────────────────────────────

do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('orgs','profiles','sessions','questions','quiz_attempts','answers','participants','usage_events')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Sessions
create policy "Trainers read own sessions" on sessions
  for select to authenticated using (trainer_id = auth.uid());
create policy "Trainers create own sessions" on sessions
  for insert to authenticated with check (trainer_id = auth.uid());
create policy "Trainers update own sessions" on sessions
  for update to authenticated using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy "Trainers delete own sessions" on sessions
  for delete to authenticated using (trainer_id = auth.uid());
create policy "Participants read published sessions" on sessions
  for select to anon using (status = 'published');

-- Questions
create policy "Trainers manage own questions" on questions
  for all to authenticated
  using (exists (select 1 from sessions s where s.id = questions.session_id and s.trainer_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = questions.session_id and s.trainer_id = auth.uid()));
create policy "Participants read published questions" on questions
  for select to anon
  using (exists (select 1 from sessions s where s.id = questions.session_id and s.status = 'published'));

-- Attempts and answers
create policy "Participants submit attempts" on quiz_attempts
  for insert to anon, authenticated
  with check (exists (select 1 from sessions s where s.id = quiz_attempts.session_id and s.status = 'published'));
create policy "Trainers read own attempts" on quiz_attempts
  for select to authenticated
  using (exists (select 1 from sessions s where s.id = quiz_attempts.session_id and s.trainer_id = auth.uid()));

create policy "Participants insert answers" on answers
  for insert to anon, authenticated with check (true);
create policy "Trainers read own answers" on answers
  for select to authenticated
  using (exists (
    select 1 from quiz_attempts a
      join sessions s on s.id = a.session_id
     where a.id = answers.attempt_id and s.trainer_id = auth.uid()
  ));

-- Participants
create policy "Trainers read participants" on participants
  for select to authenticated using (true);

-- Profiles
create policy "Users manage own profile" on profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());


-- ── 5 — check ────────────────────────────────────────────────────────────────

do $$
declare
  v_three_arg int;
  v_new_index int;
begin
  select count(*) into v_three_arg from pg_proc
   where proname = 'upsert_participant' and pronargs = 3;
  select count(*) into v_new_index from pg_indexes
   where schemaname = 'public' and indexname = 'participants_org_eid_key';

  raise notice 'three-argument join function present: %', v_three_arg;
  raise notice 'per-property eid index still present: %', v_new_index;

  if v_three_arg > 0 or v_new_index > 0 then
    raise exception 'Rollback incomplete — see the notices above.';
  end if;
end $$;
