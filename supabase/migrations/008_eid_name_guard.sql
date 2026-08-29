-- ─────────────────────────────────────────────────────────────────────────────
-- E-valuate — An employee ID belongs to one person
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER 007_participants_multi_timer.sql
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Two rules, and until now only the first one was enforced:
--
--   1. An employee ID is unique. Already true — participants_eid_key is a
--      unique index on lower(trim(eid)), so "ab123", "AB123" and " AB123 "
--      are one person. Nothing to change.
--
--   2. The name has to match the ID. This was NOT enforced. upsert_participant
--      took whatever name it was given and overwrote the stored one, so if
--      Ram registered RNATA387 and Prabhu later typed the same ID, Prabhu was
--      silently handed Ram's record — and Ram's name was replaced with
--      Prabhu's. Two people, one training history, and no warning to either.
--
-- From here, an ID that is already registered only opens for a matching first
-- name. Anyone else is turned away and told the ID is taken.
--
-- Why the FIRST name and not the whole name: people type their own name
-- inconsistently ("Ram", "Ram Prabhu", "Ram P.") and a strict full-name match
-- would lock real staff out of their own record. The first name is stable
-- enough to tell Ram from Prabhu, which is the case that matters.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── PART 1 — how a name is compared ──────────────────────────────────────────
-- The first word only, lowercased, with spaces and punctuation removed, so
-- "Ram", " ram ", "RAM" and "Ram." all compare equal. [[:alnum:]] is used
-- rather than [a-z0-9] so accented and non-Latin letters survive instead of
-- being stripped down to something that no longer matches itself.

create or replace function participant_first_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(
    regexp_replace(
      coalesce((regexp_split_to_array(trim(coalesce(p_name, '')), '\s+'))[1], ''),
      '[^[:alnum:]]', '', 'g'
    )
  )
$$;


-- ── PART 2 — the guard itself ────────────────────────────────────────────────
-- Same signature and same return value as before, so nothing that calls it
-- needs to change: it still returns the participant's id.

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
    -- First time this ID has been seen: it now belongs to this name.
    insert into participants (eid, name)
    values (trim(p_eid), trim(p_name))
    returning id into v_id;

  elsif participant_first_name(v_existing_name) <> participant_first_name(p_name) then
    -- Someone else's ID. The stored name is deliberately NOT quoted back —
    -- that would let anyone read a colleague's name by guessing IDs.
    raise exception
      'This employee ID is already registered to someone else. Please check the ID, or enter your name the way you registered it.'
      using errcode = 'P0001';

  else
    -- Same person. Keep the latest spelling of their name, never the eID.
    update participants
       set name = trim(p_name), updated_at = now()
     where id = v_id;
  end if;

  return v_id;
end $$;

revoke all on function upsert_participant(text, text) from public;
grant execute on function upsert_participant(text, text) to anon, authenticated;

revoke all on function participant_first_name(text) from public;
grant execute on function participant_first_name(text) to anon, authenticated;


-- ── PART 3 — existing data ───────────────────────────────────────────────────
-- Note this cannot find past collisions automatically. Because eIDs are unique
-- there is only ever ONE row per ID, so an ID that two people shared before
-- this migration looks exactly like an ID one person used twice — the history
-- is genuinely merged and only a human knows whose attempts are whose.
--
-- So this simply lists everyone who has taken a quiz, for you to glance over.
-- Anyone whose attempts you do not recognise as one person needs sorting out
-- by hand. An empty result means nobody has taken a quiz yet.

select p.eid,
       p.name,
       count(a.id) as attempts
  from participants p
  left join quiz_attempts a on a.participant_id = p.id
 group by p.eid, p.name
having count(a.id) > 0
 order by p.eid;


-- ── PART 4 — check ───────────────────────────────────────────────────────────
-- Expect: same_person_ok = true, imposter_blocked = true.

do $$
declare
  v_first  uuid;
  v_second uuid;
  v_same   boolean := false;
  v_block  boolean := false;
begin
  -- A throwaway ID that cannot collide with a real employee.
  delete from participants where lower(trim(eid)) = '__migration_check__';

  v_first := upsert_participant('__migration_check__', 'Ram');

  -- The same person, spelled differently, must get the same record back.
  begin
    v_second := upsert_participant('  __MIGRATION_CHECK__  ', 'ram prabhu');
    v_same := (v_second = v_first);
  exception when others then
    v_same := false;
  end;

  -- A different first name on the same ID must be refused.
  begin
    perform upsert_participant('__migration_check__', 'Prabhu');
    v_block := false;
  exception when others then
    v_block := true;
  end;

  delete from participants where lower(trim(eid)) = '__migration_check__';

  raise notice 'same_person_ok = %, imposter_blocked = %', v_same, v_block;

  if not (v_same and v_block) then
    raise exception 'Check failed: same_person_ok = %, imposter_blocked = %', v_same, v_block;
  end if;
end $$;
