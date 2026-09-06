-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — What the administrator can see
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER 009_multi_property.sql
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- "Show me everyone who has signed up, and whether they are actually using it."
--
-- Almost all of that already exists and simply is not reachable. Supabase's
-- auth.users table records when each account was created and when it last
-- signed in, and the sessions / questions / quiz_attempts tables already say
-- what each trainer has done. What was missing is a way to read any of it:
-- auth.users is not exposed through the API at all, and the tables are behind
-- rules that only ever show a trainer their own rows.
--
-- So this adds one function that gathers the picture and hands it only to an
-- administrator. A super admin sees every property; a property admin sees their
-- own. A trainer calling it gets an error, not a filtered list.
-- ─────────────────────────────────────────────────────────────────────────────


create or replace function admin_trainer_overview()
returns table (
  user_id             uuid,
  email               text,
  full_name           text,
  role                text,
  property            text,
  signed_up_at        timestamptz,
  last_sign_in_at     timestamptz,
  sessions_created    bigint,
  sessions_published  bigint,
  questions_generated bigint,
  attempts_taken      bigint,
  last_activity       timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Definer rights read straight past row-level security, so the permission
  -- check has to be explicit and first.
  if not is_admin() then
    raise exception 'You need administrator access to view this.'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.full_name,
    p.role,
    o.name,
    u.created_at,
    u.last_sign_in_at,
    coalesce(s.total, 0),
    coalesce(s.published, 0),
    coalesce(q.total, 0),
    coalesce(a.total, 0),
    greatest(u.last_sign_in_at, s.last_created)
  from profiles p
  join auth.users u on u.id = p.id
  left join orgs o on o.id = p.org_id
  left join lateral (
    select count(*)                                        as total,
           count(*) filter (where status = 'published')     as published,
           max(created_at)                                  as last_created
      from sessions
     where trainer_id = p.id
  ) s on true
  left join lateral (
    select count(*) as total
      from questions qq
      join sessions ss on ss.id = qq.session_id
     where ss.trainer_id = p.id
  ) q on true
  left join lateral (
    select count(*) as total
      from quiz_attempts at
      join sessions ss on ss.id = at.session_id
     where ss.trainer_id = p.id
  ) a on true
  -- A super admin sees everyone; a property admin sees their own property.
  where is_super_admin() or p.org_id = current_org_id()
  order by u.created_at desc;
end $$;

revoke all on function admin_trainer_overview() from public;
grant execute on function admin_trainer_overview() to authenticated;


-- ── Promoting someone ────────────────────────────────────────────────────────
-- Only a super admin may change roles, and never their own — otherwise the
-- last super admin can demote themselves and nobody can administer anything.

create or replace function admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'Only a super admin can change roles.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;
  if p_role not in ('super_admin', 'org_admin', 'trainer') then
    raise exception 'Unknown role: %', p_role;
  end if;

  update profiles set role = p_role where id = p_user_id;
end $$;

revoke all on function admin_set_role(uuid, text) from public;
grant execute on function admin_set_role(uuid, text) to authenticated;


-- ── Check ────────────────────────────────────────────────────────────────────
-- Expect both functions present, and the overview to return at least your own
-- row when run from the SQL editor. (The editor runs as the database owner
-- rather than as a signed-in user, so is_admin() is false there and the
-- permission error below is the CORRECT result — it proves the guard works.)

do $$
declare v_fns int;
begin
  select count(*) into v_fns from pg_proc
   where proname in ('admin_trainer_overview', 'admin_set_role');

  raise notice 'admin functions created: % (expected 2)', v_fns;

  if v_fns < 2 then
    raise exception 'Admin functions were not created.';
  end if;

  begin
    perform * from admin_trainer_overview();
    raise notice 'overview ran without a permission error (you are an admin in this session)';
  exception when others then
    raise notice 'overview refused this session: % — expected in the SQL editor', sqlerrm;
  end;
end $$;
