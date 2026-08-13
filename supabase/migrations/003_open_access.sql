-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — Open access (no authentication)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER 001_schema_v2.sql
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- WARNING: this deliberately removes access control. Anyone who knows the
-- project URL and anon key can read and write every row. It exists so the app
-- can run without a login during the pilot. Replace it with real auth before
-- letting trainers outside your own team use the system.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── PART 1 — detach from Supabase Auth ───────────────────────────────────────
-- trainer_id pointed at auth.users(id). With no login there is no such user,
-- so the reference has to go and the column has to allow nulls.

alter table sessions  drop constraint if exists sessions_trainer_id_fkey;
alter table sessions  alter column trainer_id drop not null;

alter table profiles  drop constraint if exists profiles_id_fkey;


-- ── PART 2 — column the app expects ──────────────────────────────────────────
-- The quiz scores against a pass mark; the schema never had the column.

alter table sessions add column if not exists pass_threshold integer default 70;


-- ── PART 3 — replace per-user policies with open ones ────────────────────────
-- Drop every policy created by 001_schema_v2.sql, then allow anonymous access.

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

-- One permissive policy per table, for both anonymous and logged-in callers.
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'sessions', 'questions', 'quiz_attempts', 'answers']
  loop
    execute format(
      'create policy "Open access" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;


-- ── PART 4 — check ───────────────────────────────────────────────────────────
-- Expect 5 rows, each with policy_count = 1.

select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;
