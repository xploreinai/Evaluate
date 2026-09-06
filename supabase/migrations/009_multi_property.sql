-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Properties, roles, and a usage trail
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER 008_eid_name_guard.sql
-- Safe to run more than once.
--
--   ⚠  RUN THIS ON THE SPARE PROJECT FIRST (mgvjuuhgzayqqodmpvyn), NOT ON
--      htipbzdkwrgvcerlrswp. It rewrites every access rule in the database.
--      If it is wrong, trainers lose sight of their own sessions. 009_rollback.sql
--      puts everything back the way 008 left it.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- WHY: today every access rule matches on `trainer_id = auth.uid()`. There is
-- no notion of a property, so a second hotel cannot be kept apart from the
-- first — most sharply in employee IDs, which are unique across the WHOLE
-- database. Two hotels each with an "AD12345" become one person with one
-- merged history. This migration gives every row an owner property.
--
-- WHAT IT DOES NOT DO: it deliberately leaves upsert_participant's old
-- two-argument form working, so the currently deployed site keeps running
-- after this is applied. The app is updated to call the new form afterwards,
-- and 010 removes the old one. Nothing breaks in between.
--
-- ASSUMPTIONS MADE (all easy to change — say the word):
--   · A trainer belongs to exactly one property.
--   · New properties are created by a super admin, not by self-signup.
--   · Existing data all belongs to one property, named below.
-- ─────────────────────────────────────────────────────────────────────────────

-- The name of the first property. Change the text here before running if you
-- want it called something else; it is only used once, and renaming it later
-- is a one-line update.


-- ── PART 1 — roles ───────────────────────────────────────────────────────────

alter table profiles add column if not exists role text not null default 'trainer';

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'org_admin', 'trainer'));

-- orgs and profiles already exist from 001_schema_v2; they have simply never
-- been used. Give orgs the couple of columns an administrator will want.
alter table orgs add column if not exists created_at timestamptz not null default now();
alter table orgs add column if not exists active     boolean     not null default true;


-- ── PART 2 — every row knows its property ────────────────────────────────────

alter table sessions     add column if not exists org_id uuid references orgs(id);
alter table participants add column if not exists org_id uuid references orgs(id);

create index if not exists sessions_org_idx     on sessions (org_id);
create index if not exists participants_org_idx on participants (org_id);


-- ── PART 3 — the usage trail ─────────────────────────────────────────────────
-- Without this an admin screen has nothing to show. Quiz attempts are the only
-- thing recorded today; nothing says who logged in, who recorded, or how much
-- AI quota an account burned through.

create table if not exists usage_events (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        references orgs(id) on delete cascade,
  actor_id    uuid,                      -- auth.users id, or null for a participant
  kind        text        not null,
  meta        jsonb       not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table usage_events drop constraint if exists usage_events_kind_check;
alter table usage_events
  add constraint usage_events_kind_check
  check (kind in (
    'session_recorded', 'transcribed', 'questions_generated',
    'quiz_published',   'attempt_submitted', 'trainer_signed_in'
  ));

create index if not exists usage_events_org_time_idx on usage_events (org_id, occurred_at desc);


-- ── PART 4 — move the existing data into a first property ────────────────────

do $$
declare
  v_org uuid;
begin
  select id into v_org from orgs where name = 'Edition Abu Dhabi';
  if v_org is null then
    insert into orgs (name) values ('Edition Abu Dhabi') returning id into v_org;
  end if;

  update sessions     set org_id = v_org where org_id is null;
  update participants set org_id = v_org where org_id is null;
  update usage_events set org_id = v_org where org_id is null;

  -- Every existing trainer gets a profile in that property. Without a profile
  -- the new rules below would fail closed and lock them out of their own work.
  insert into profiles (id, org_id, role)
  select u.id, v_org, 'trainer'
    from auth.users u
   where not exists (select 1 from profiles p where p.id = u.id);

  update profiles set org_id = v_org where org_id is null;
end $$;

-- Ram is the first super admin. Everyone else stays a trainer until promoted.
update profiles
   set role = 'super_admin'
 where id = '20671aaf-1240-456a-9793-5b9dbffb599e';


-- ── PART 5 — a new trainer always gets a profile ─────────────────────────────
-- Sign-up creates an auth user but nothing else. From here a profile is created
-- with it, otherwise the rules below would treat a brand new trainer as
-- belonging to no property and show them nothing.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  -- A property may be named in the sign-up metadata; otherwise the oldest one
  -- is used, which is correct while there is only one.
  v_org := nullif(new.raw_user_meta_data ->> 'org_id', '')::uuid;
  if v_org is null then
    select id into v_org from orgs where active order by created_at limit 1;
  end if;

  insert into profiles (id, org_id, full_name, role)
  values (new.id, v_org, new.raw_user_meta_data ->> 'full_name', 'trainer')
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ── PART 6 — who am I? ───────────────────────────────────────────────────────
-- These are security definer on purpose. A policy on `profiles` that itself
-- reads `profiles` recurses forever; going through a definer function reads the
-- row without re-entering the policy.

create or replace function current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false)
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('super_admin', 'org_admin') from profiles where id = auth.uid()), false)
$$;

grant execute on function current_org_id(), current_role_name(), is_super_admin(), is_admin()
  to anon, authenticated;


-- ── PART 7 — per-property employee IDs ───────────────────────────────────────
-- The whole point. "AD12345" at one hotel and "AD12345" at another are now two
-- different people.

drop index if exists participants_eid_key;
create unique index if not exists participants_org_eid_key
  on participants (org_id, lower(trim(eid)));


-- ── PART 8 — joining a quiz, now that a participant belongs somewhere ────────
-- The property comes from the session being taken, which is the only thing an
-- anonymous participant knows. The old two-argument form is kept alive so the
-- currently deployed site does not break the moment this runs.

create or replace function upsert_participant(p_session_id uuid, p_eid text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org           uuid;
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

  select org_id into v_org
    from sessions
   where id = p_session_id and status = 'published';

  if v_org is null then
    raise exception 'This quiz is not open.';
  end if;

  select id, name into v_id, v_existing_name
    from participants
   where org_id = v_org and lower(trim(eid)) = lower(trim(p_eid));

  if v_id is null then
    insert into participants (eid, name, org_id)
    values (trim(p_eid), trim(p_name), v_org)
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

-- Kept only so the live site keeps working between this migration and the next
-- deploy. 010 removes it.
create or replace function upsert_participant(p_eid text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select id into v_org from orgs where active order by created_at limit 1;
  if (select count(*) from orgs where active) > 1 then
    raise exception 'This version of the app is out of date. Please reload the page.';
  end if;

  return upsert_participant(
    (select id from sessions where org_id = v_org and status = 'published' order by created_at desc limit 1),
    p_eid, p_name
  );
end $$;

revoke all on function upsert_participant(uuid, text, text) from public;
revoke all on function upsert_participant(text, text)       from public;
grant execute on function upsert_participant(uuid, text, text) to anon, authenticated;
grant execute on function upsert_participant(text, text)       to anon, authenticated;


-- ── PART 9 — the access rules, rewritten around property and role ────────────

alter table orgs         enable row level security;
alter table profiles     enable row level security;
alter table usage_events enable row level security;

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

-- Properties
create policy "Super admin manages properties" on orgs
  for all to authenticated using (is_super_admin()) with check (is_super_admin());
create policy "Members read own property" on orgs
  for select to authenticated using (id = current_org_id());

-- Profiles
create policy "Read own profile" on profiles
  for select to authenticated using (id = auth.uid());
create policy "Update own profile" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins read profiles in scope" on profiles
  for select to authenticated
  using (is_super_admin() or (is_admin() and org_id = current_org_id()));
create policy "Admins manage profiles in scope" on profiles
  for update to authenticated
  using (is_super_admin() or (is_admin() and org_id = current_org_id()))
  with check (is_super_admin() or (is_admin() and org_id = current_org_id()));

-- Sessions: a trainer sees their own, an admin sees the whole property.
create policy "Read sessions in scope" on sessions
  for select to authenticated
  using (
    is_super_admin()
    or (org_id = current_org_id() and (is_admin() or trainer_id = auth.uid()))
  );
create policy "Trainers create own sessions" on sessions
  for insert to authenticated
  with check (org_id = current_org_id() and trainer_id = auth.uid());
create policy "Modify sessions in scope" on sessions
  for update to authenticated
  using (is_super_admin() or (org_id = current_org_id() and (is_admin() or trainer_id = auth.uid())))
  with check (is_super_admin() or (org_id = current_org_id() and (is_admin() or trainer_id = auth.uid())));
create policy "Delete sessions in scope" on sessions
  for delete to authenticated
  using (is_super_admin() or (org_id = current_org_id() and (is_admin() or trainer_id = auth.uid())));
create policy "Participants read published sessions" on sessions
  for select to anon using (status = 'published');

-- Questions follow their session.
create policy "Questions follow session" on questions
  for all to authenticated
  using (exists (select 1 from sessions s where s.id = questions.session_id))
  with check (exists (select 1 from sessions s where s.id = questions.session_id));
create policy "Participants read published questions" on questions
  for select to anon
  using (exists (select 1 from sessions s where s.id = questions.session_id and s.status = 'published'));

-- Attempts and answers: anonymous people write, staff read.
create policy "Participants submit attempts" on quiz_attempts
  for insert to anon, authenticated
  with check (exists (select 1 from sessions s where s.id = quiz_attempts.session_id and s.status = 'published'));
create policy "Read attempts in scope" on quiz_attempts
  for select to authenticated
  using (exists (select 1 from sessions s where s.id = quiz_attempts.session_id));

create policy "Participants insert answers" on answers
  for insert to anon, authenticated with check (true);
create policy "Read answers in scope" on answers
  for select to authenticated
  using (exists (select 1 from quiz_attempts a where a.id = answers.attempt_id));

-- Participants: staff of the same property only. Still nothing for anon, which
-- is why upsert_participant is security definer.
create policy "Read participants in property" on participants
  for select to authenticated
  using (is_super_admin() or org_id = current_org_id());

-- Usage trail
create policy "Write usage events" on usage_events
  for insert to anon, authenticated with check (true);
create policy "Admins read usage" on usage_events
  for select to authenticated
  using (is_super_admin() or (is_admin() and org_id = current_org_id()));


-- ── PART 10 — check ──────────────────────────────────────────────────────────
-- Anything wrong here stops the migration loudly rather than leaving the
-- database half-rewritten.

do $$
declare
  v_orgless_sessions int;
  v_orgless_people   int;
  v_profileless      int;
  v_super            int;
  v_old_index        int;
begin
  select count(*) into v_orgless_sessions from sessions     where org_id is null;
  select count(*) into v_orgless_people   from participants where org_id is null;
  select count(*) into v_profileless
    from auth.users u where not exists (select 1 from profiles p where p.id = u.id);
  select count(*) into v_super from profiles where role = 'super_admin';
  select count(*) into v_old_index from pg_indexes
   where schemaname = 'public' and indexname = 'participants_eid_key';

  raise notice 'sessions without a property: %', v_orgless_sessions;
  raise notice 'participants without a property: %', v_orgless_people;
  raise notice 'trainers without a profile: %', v_profileless;
  raise notice 'super admins: %', v_super;
  raise notice 'old global eid index still present: %', v_old_index;

  if v_orgless_sessions > 0 or v_orgless_people > 0 or v_profileless > 0
     or v_super = 0 or v_old_index > 0 then
    raise exception 'Migration check failed — see the notices above. Nothing has been committed.';
  end if;
end $$;
