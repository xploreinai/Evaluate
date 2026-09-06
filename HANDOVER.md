# E-valuate — handover and review brief

*Current as of 6 September 2026, repo at commit `d18f46b`.*

Two uses for this file:

1. **Picking the work back up** — paste it into a new coding session and continue.
2. **Getting a second opinion** — paste it into another model and ask what should
   be improved. If that is why you are reading this, read **Constraints** before
   suggesting anything: several obvious-looking improvements are already ruled
   out for reasons that are not obvious. Then see **Where a second opinion would
   actually help** at the end.

---

## What this is

A web app for hotel staff training. A trainer records a training session on
their own phone, the audio is transcribed, an AI writes ten quiz questions, the
trainer reviews and publishes them, and staff take the quiz by scanning a QR
code. No app install, and staff need no account.

- **Project folder:** `/Users/ramprabhu/Documents/E Valuate`
- **Live app:** https://evaluate-u5zj.vercel.app
- **Repo:** github.com/xploreinai/Evaluate (branch `main`)
- **Vercel project:** `evaluate-u5zj` under team `xploreinai1` — **Hobby plan**
- **Supabase project:** `htipbzdkwrgvcerlrswp` — **Free plan**
  - A second, unused Supabase project (`mgvjuuhgzayqqodmpvyn`) is now designated
    the **staging** database for testing migrations before they touch live data.
  - There is also an unrelated app, **Permit Pro** (`xqcgbxhmdpwdihhskjbq`), in
    the same Supabase organisation. E-valuate SQL has been pasted into it by
    accident before. Check the project name every single time.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth) ·
Groq free tier (Whisper transcription, Llama question generation) · Vercel Hobby.

Vercel **auto-deploys on every push to `main`**. No manual deploy step, and no
staging deployment.

## Working preferences

Ram is new to the terminal, git and deployment, and prefers plain language over
jargon. **Mark anything needing him in bold: `RAM ANSWER ME:` for questions,
`RAM DO THIS:` for actions** — he reads quickly and misses unmarked asks.

Verify claims before making them: fetch the deployed bundle and grep it, query
the live API, read the whole build output. Several bugs here were misdiagnosed
by guessing, and the habit of checking has caught real errors — including two
this month that would otherwise have shipped.

---

## Architecture decisions (deliberate, not accidents)

1. **Device-first recording.** Audio lives in the browser's IndexedDB and is
   never uploaded except as short transcription requests. Chosen because
   Supabase's storage cap broke the first version.
   → A recording exists only on the device that made it. It cannot be recovered
   or processed elsewhere. Once questions are generated everything lives in
   Supabase and the device stops mattering.

2. **Segmented recording.** Vercel refuses request bodies over **4.5 MB on every
   plan, including Pro** — paying more or switching hosts does not fix it. Audio
   records at 24 kbps mono (~0.18 MB/min) and rotates to a new file at 3.5 MB.
   Each segment is transcribed separately and the text joined, so there is no
   limit on session length.

3. **Groq, not OpenAI.** Cost was never the real constraint (~$0.12 per 20-minute
   session on OpenAI) but Ram does not want to top up credits, and predictability
   matters more to him than price.
   → **Groq retires models.** `src/lib/groq.ts` asks Groq what it currently
   serves and picks from a preference list, so a retired name cannot break the
   app. Do not hard-code a model name.

4. **Trainer accounts, anonymous participants.** Trainers sign in (Supabase
   Auth, email + password, **open sign-up, email confirmation OFF**).
   Participants take quizzes with no account — they enter an employee ID and
   their name. Participants cannot read the `participants` table at all; they
   reach their own row only through the `upsert_participant()` security-definer
   function, so nobody can list colleagues' names and IDs.

5. **The service worker caches nothing, on purpose.** It exists only to make the
   app installable. Stale bundles cost hours of debugging early on. This is a
   deliberate trade of bandwidth for predictability.

---

## Current state — live and working

- Record → transcribe → generate → review → publish → QR → take quiz → results
- Trainer login, dashboard, session delete (cascades through questions,
  attempts and answers)
- Pass mark per quiz; optional per-quiz timer, off by default
- Multi-answer questions ("select all that apply"), nothing pre-selected.
  Scoring is **all-or-nothing** — a partially correct multi-answer is wrong.
- After submitting, participants see every question with the correct answers
  marked, and their own score only at the bottom
- Employee ID identity — the same eID links attempts into one history
- Participant list, individual history, two leaderboards (most taken / best
  average; the latter needs ≥2 attempts)
- Dark/light toggle — the whole palette flips through CSS variables
- Sign out sits inside an account menu behind an initial-letter button, not
  loose in the header where it was close enough to "home" to be tapped by mistake
- Dashboard sessions are **grouped by the month the training was held**, newest
  month first, with a count per month
- An **Administration page** (`/admin`) is deployed but shows "Not set up yet"
  until migrations 009 and 010 are run
- PWA, installable to a home screen

### Visual identity

Styled after editionhotels.com/abu-dhabi and deliberately kept: Didot / Playfair
Display headings, uppercase, weight 400, tight negative tracking, square corners,
and the `#c8ae83` sand accent.

Warmed up on 6 Sep while keeping that identity: a **verdant green (`20 122 88`)
is now the primary accent**, neutrals are warmer (off-white ground, warm
near-black in dark mode, deep warm slate ink), and **status colours now carry
meaning** — amber for draft, green for live, grey for closed. Previously all
three chips were near-identical sand and had to be read word by word.

Text on the accent uses its own `--c-on-accent` token, because the green is deep
in the light theme and lifted to mint in the dark one.

---

## Database migrations

Run in the Supabase SQL Editor, in order.

| File | Status |
|---|---|
| `001_schema.sql`, `002_rls*.sql` | **v1 leftovers — do not run** |
| `001_schema_v2` → `003` → `004` → `005` → `006` → `007` | **Applied** |
| `008_eid_name_guard.sql` | **Written, NOT run** |
| `009_multi_property.sql` (+ `009_rollback.sql`) | **Written, NOT run** |
| `010_admin_overview.sql` | **Written, NOT run** |

005 (part 2) and 007 are confirmed applied by inspecting the live schema.
Whether 005 part 1 and 006 (the delete cascade) ran could not be confirmed —
`pg_constraint` is not reachable through the REST API. Both are safe to re-run,
so if deleting a session ever fails with a foreign-key error about `answers`,
just run 005 and 006 again.

**008, 009 and 010 have never been executed anywhere.** There is no Postgres,
Docker or Homebrew on the machine, so whoever wrote them could not test them.
Each self-checks and aborts loudly rather than leaving the database half-changed
— but that is not the same as having been run.

### What the unrun migrations do

- **008** — an employee ID is unique (already true), and now the **name must
  match** to reuse it. Previously `upsert_participant` overwrote the stored name
  with whatever was passed, so a second person entering someone else's ID
  silently inherited their whole training history *and* replaced their name.
  Matching is on the **first name only**, lowercased and stripped of
  punctuation: "Ram", "ram" and "Ram Prabhu" are one person, "Prabhu" is
  refused. Full-name matching was rejected deliberately — it would lock real
  staff out of their own records when they type their name differently.
- **009** — properties (multi-tenancy). Adds `org_id` to sessions and
  participants, roles (`super_admin` / `org_admin` / `trainer`), a
  `usage_events` table, a profile-on-signup trigger, and rewrites **every**
  row-level-security policy around property and role. Makes employee IDs unique
  **per property** rather than globally. Keeps the old two-argument
  `upsert_participant` alive so the deployed site does not break between the
  migration and the next deploy.
- **010** — `admin_trainer_overview()`, which powers `/admin`: per trainer,
  their email, sign-up date, last sign-in, sessions created, sessions published,
  questions generated and attempts taken. Super admin sees every property,
  property admin sees their own, a trainer gets a permission error. Also
  `admin_set_role()`, which refuses to let anyone change their own role.

---

## Constraints — read before suggesting changes

Things that look like obvious improvements but are not available:

- **Vercel's 4.5 MB body limit applies on every plan.** Upgrading does not raise
  it. Segmented recording exists because of this.
- **Groq's free tier is the AI budget, and limits are per organisation, not per
  API key** — more keys do not raise the ceiling. For `whisper-large-v3-turbo`:
  20 requests/minute, 2,000/day, 7,200 audio-seconds per hour, and **28,800
  audio-seconds per day — eight hours of audio daily, shared across every
  property using the app.**
- **Supabase free plan:** 500 MB database, 5 GB egress, two projects (both
  already used), **no downloadable backups**, and projects are paused after
  seven days of low activity.
- **Vercel Hobby forbids commercial use** — "non-commercial, personal use only".
  Their definition turns on financial gain by anyone producing the project, and
  every example concerns monetising the site. The app will be given to other
  hotels **free**, which probably falls outside it, but the clause about "a paid
  employee or consultant writing the code" is unresolved. Vercel invite the
  question; it has not been asked yet.
- **No local database.** No Postgres, Docker or Homebrew. Migrations can only be
  tested by running them against the spare Supabase project.
- **The service worker caching nothing is intentional** — see decision 5.

---

## Known problems, roughly by severity

1. **Multi-tenancy does not exist yet.** Every access rule matches on
   `trainer_id = auth.uid()`. Employee IDs are unique across the *whole*
   database, so two hotels each with an "AD12345" become one person with one
   merged history — a data-integrity and a privacy problem at once. 009 fixes
   it but has not been run, and other properties are expected to start using
   the app.
2. **No retry anywhere in the codebase.** No backoff, nothing handling HTTP 429.
   When Groq's rate limit is hit the trainer sees a raw
   `Transcription failed (429)` in the middle of processing a session they have
   just recorded. Cheapest high-value fix available.
3. **Recordings can silently vanish.** They live in IndexedDB and the app never
   calls `navigator.storage.persist()`. WebKit deletes all script-writable
   storage after seven days of Safari use without a visit to the site.
   Recordings are also only deleted when a trainer deletes the session, so
   storage grows without bound on an active trainer's phone.
4. **Sign-up is open to anyone with the link** — no invitation, no email
   confirmation. The link has already been shared with several supervisors.
5. **Participants can forge results.** Scoring happens in the browser, and the
   rule for saving an attempt only checks that the quiz is published, not that
   the score matches the answers. `answers` accepts anything (`with check
   (true)`). Fine for internal training; not fine if a result ever backs a
   certificate or compliance record.
6. **No downloadable backup exists.** With other hotels' staff records in the
   database this matters more than it used to.
7. **`jsPDF` is statically imported** on the results page, so it downloads for
   everyone who opens it: 264 kB first load against ~153 kB elsewhere.
8. **The review screen does not show which options the participant picked** when
   a multi-answer question is wrong — only which were correct. Someone who got
   two of three right cannot see what they missed.
9. **`orgs` and `profiles` tables exist but are unused** (v1 leftovers), and
   `src/types/index.ts` still declares an `Org` type. Do not mistake them for
   working multi-tenancy; 009 is what finally uses them.
10. `.env.local` still holds the placeholder `GROQ_API_KEY=gsk_your-key-here`.
    Only affects running locally; Vercel has the real key.

---

## Verified this month, and how

Worth knowing so it is not re-tested or wrongly assumed broken:

- **A full quiz was completed end to end on the live app** — timer, multi-answer
  selection, all-or-nothing scoring, the review screen, and the rows written to
  the database. Scored 8/10 exactly as predicted, including a deliberately
  partial multi-answer scoring as wrong.
- **Live transcription works with genuine iPhone-format audio.** A real MP4/AAC
  clip posted as a raw binary body to the live `/api/transcribe` came back
  correctly transcribed in 1.7 s, and the Safari fix is confirmed present in the
  deployed bundle.
- **Live question generation works**, returning valid multi-answer questions.
- **Employee ID linking is case- and space-insensitive** — `ab123`, `AB123` and
  ` AB123 ` all return the same participant.
- **The account menu** opens, closes on Escape / outside click / navigation,
  fits at iPhone width, and works in both themes.
- **Both colour themes** were checked visually after the palette change.

### Not verified

- **Recording on a real iPhone.** The server half is proven; Safari's
  `MediaRecorder` and the IndexedDB round trip on real hardware are not. This is
  the oldest open item in the project.
- **The leaderboards and participant list with real data** — both sit behind
  trainer login.
- **Migrations 008, 009 and 010** — never executed.
- **A segment boundary** — has never occurred. Rotation triggers around 20
  minutes. Expect possibly a word lost at the join; if so, overlap the segments
  slightly rather than butting them together.

---

## Outstanding actions

1. **RAM DO THIS: run `009_multi_property.sql` on the spare project
   (`mgvjuuhgzayqqodmpvyn`) first**, then on live, then `010_admin_overview.sql`.
   010's self-check reports a *permission error* in the SQL editor — that is
   correct and proves the guard works.
2. **RAM DO THIS: run `008_eid_name_guard.sql`** on the live project.
3. **RAM DO THIS: test recording on a real iPhone.** Record fresh; do not reuse
   an old stored recording.
4. **RAM DO THIS: delete the test data** left by end-to-end testing:
   `delete from participants where eid in ('__testrun__', '__selftest__');`
   Look at the leaderboard *before* deleting — that row is the only data those
   screens currently have.
5. **RAM ANSWER ME: are any sessions actually missing from the dashboard?** Five
   published sessions exist, all owned by Ram. Drafts cannot be seen from
   outside, so this could not be checked. "Messy" may have been solved by the
   month grouping, or there may be a real bug.
6. **RAM DO THIS: ask Vercel support** whether giving the app free to other
   hotels counts as commercial use.

---

## Where a second opinion would actually help

If you are a model being asked to review this, the useful contributions are
probably these, in order:

1. **Review `009_multi_property.sql` line by line.** It rewrites every
   row-level-security policy in a live database and has never been executed.
   Specific risks: recursive policies on `profiles`, a trainer being locked out
   of their own sessions, the security-definer helpers leaking access wider than
   intended, and the backfill missing rows. This is the highest-stakes untested
   code in the project.
2. **Challenge the multi-tenancy design.** One property per trainer, super admin
   creates properties, employee IDs unique per property. Is that the right shape
   for hotels, where staff and trainers move between properties?
3. **The Groq ceiling.** Eight hours of audio per day shared across every
   property is the hard limit on how many hotels this can serve. Is there
   something smarter than "hit the rate limit, then retry"?
4. **The forged-results problem (#5 above).** Is moving scoring server-side worth
   it here, and what is the least invasive way to do it?
5. **Anything in "Known problems" that is wrong or mis-prioritised.**

Not helpful: suggesting a different host or framework, suggesting paid AI APIs,
or suggesting recordings be uploaded to cloud storage. Each has been considered
and rejected for reasons in Architecture and Constraints above.

---

## Gotchas learned the hard way — please don't rediscover these

- **Masked API keys.** Twice a key was copied from a dashboard while still
  hidden, pasting bullet characters (`•`) instead of the value. Symptom: a
  cryptic `String contains non ISO-8859-1 code point` or `ByteString` error.
  Both key checks now detect this. After pasting any key, reveal it and confirm
  it is one unbroken run of characters.
- **Browser cache.** Repeatedly made fixes look like they had not worked. Verify
  a deploy by fetching the live bundle and grepping for a new string, not by
  asking Ram to refresh. `?fresh=1` forces a clean load.
- **Never run `npm run build` while the dev server is running** — it replaces
  `.next` underneath it and the page renders with no CSS at all. Check for a
  real listener (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); a plain port check gives
  false positives from browser connections.
- **Check the whole build output**, not a grep for `✓`. A type error was pushed
  once because the failure line was filtered out.
- **Audit all foreign keys at once** when fixing a cascade — fixing only the one
  the error names just reveals the next. The same applies to re-runnable SQL: a
  `create trigger` that fails on a second run is usually followed by
  `create policy` and `alter publication` failing too.
- **Supabase errors are plain objects, not `Error` instances.** Testing
  `err instanceof Error` silently discards the reason. Use `errorMessage()` in
  `src/lib/errors.ts`.
- **Postgres has no `create trigger if not exists`**, and none for policies
  either. Drop first, or the migration is not re-runnable.
- **The Supabase SQL editor is not psql** — `\set` and `:'var'` do not work.
- Safari is stricter than Chrome about `MediaRecorder` options and multipart
  bodies. It records **MP4/AAC**, not WebM/Opus.
- **A colour defined only inside one theme's block breaks the other theme.** The
  accent button's hardcoded white label was unreadable in dark mode until the
  foreground got its own flipping token.
