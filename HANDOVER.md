# E-valuate — handover

Paste this whole file into a new Claude Code session to pick up where we left off.

---

## What this is

A web app for hotel training. A trainer records a session on their own device,
the audio is transcribed, AI writes 10 quiz questions, the trainer reviews and
publishes them, and staff take the quiz by scanning a QR code. No app install.

- **Project folder:** `/Users/ramprabhu/Documents/E Valuate`
- **Live app:** https://evaluate-u5zj.vercel.app
- **Repo:** github.com/xploreinai/Evaluate (branch `main`)
- **Vercel project:** `evaluate-u5zj` under team `xploreinai1`
- **Supabase project:** `htipbzdkwrgvcerlrswp` ← *there is a second, unused
  "Evaluate" project (`mgvjuuhgzayqqodmpvyn`). Ignore it. Always check the URL.*

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth) ·
Groq free tier (Whisper transcription + Llama question generation) · Vercel Hobby.

Vercel **auto-deploys on every push to `main`**. No manual deploy step.

## Working preferences

Ram is new to terminal/git/deployment and prefers plain language over jargon.

**Mark anything that needs him in bold: `RAM ANSWER ME:` for questions,
`RAM DO THIS:` for actions.** He reads quickly and misses unmarked asks.

Verify claims before making them — check the deployed bundle, query the API,
run the build. Several bugs in this project were misdiagnosed by guessing.

---

## Architecture decisions (deliberate, not accidents)

1. **Device-first recording.** Audio is stored in the browser's IndexedDB and
   never uploaded except as short transcription requests. Originally chosen
   because Supabase's 50 MB storage cap broke the first version.
   → A recording only exists on the device that made it. It cannot be processed
   elsewhere. Once questions are generated, everything lives in Supabase.

2. **Segmented recording.** Vercel refuses request bodies over **4.5 MB on every
   plan, including Pro** — paying Vercel or switching hosts does not fix this.
   Audio records at 24 kbps mono (~0.18 MB/min) and the recorder rotates to a
   new file at 3.5 MB. Each segment is transcribed separately and the text is
   joined. There is no limit on session length.

3. **Groq, not OpenAI.** Ram does not want to top up credits. Cost was never the
   real constraint (~$0.12 per 20-min session on OpenAI; quiz takers cost
   nothing) but predictability matters more to him.
   → **Groq retires models.** `src/lib/groq.ts` asks Groq which models it
   currently serves and picks from a preference list, so a retired name cannot
   break the app. Do not hard-code a model name.

4. **Trainer auth, anonymous participants.** Trainers sign in (Supabase Auth,
   email + password, open sign-up, email confirmation OFF). Participants take
   quizzes with **no account** — they enter an employee ID and name.
   Participants cannot read the `participants` table at all; they reach their
   own row only through the `upsert_participant()` security-definer function,
   so nobody can list colleagues' names and IDs.

---

## Current state — all working and deployed

- Record → transcribe → generate → review → publish → QR → take quiz → results
- Trainer login, dashboard, session delete (cascades to questions/attempts/answers)
- Pass mark per quiz; optional per-quiz timer (off by default)
- Multi-answer questions ("select all that apply"); nothing pre-selected
- After submitting, participants see **all questions with correct answers
  marked first**, and their score only at the bottom
- Employee ID identity — same eID links attempts into one history
- Participant list, individual history, two leaderboards (most taken / best
  average, the latter needs ≥2 attempts)
- Dark/light toggle (whole palette flips via CSS variables), home button
- PWA — installable to home screen; the service worker deliberately caches
  **nothing**, because stale bundles cost hours of debugging earlier
- Styled after editionhotels.com/abu-dhabi: Didot/Playfair headings (uppercase,
  weight 400), `#111111` ink, `#757575` muted, `#c8ae83` sand accent, square corners

## Database migrations

Run in the Supabase SQL Editor, in order. **001_schema_v2 → 003 → 004 → 005 →
006 → 007.** (`001_schema.sql` and `002_rls*.sql` are v1 leftovers — do not run.)

`007_participants_multi_timer.sql` is confirmed applied.
**Unconfirmed: whether 005 and 006 were run.** If deleting a session fails with
a foreign-key error about `answers`, 006 has not been run.

---

## Open items

1. **RAM DO THIS: test recording on iPhone Safari.** Last attempt failed with
   "No audio provided" — Safari sent an empty body. Fixed by reading the blob
   into an ArrayBuffer before sending, but **not yet verified on a real phone**.
   Record fresh; don't reuse the old stored recording.
2. **Never verified end to end:** taking a quiz as a participant — multi-answer
   scoring, the timer, the review screen, and the leaderboard populating.
   Everything was tested in isolation; nobody has completed a real submission.
3. **A segment boundary has never actually occurred.** Rotation triggers around
   20 minutes. Expect possibly a word lost at the join; if so, overlap the
   segments slightly instead of butting them together.
4. `.env.local` still contains the placeholder `GROQ_API_KEY=gsk_your-key-here`.
   Only affects running locally; Vercel has the real key.
5. A test row `eid = '__selftest__'` exists in `participants`. Invisible in the
   UI (the list is built from people with attempts). Remove with:
   `delete from participants where eid = '__selftest__';`
6. **The database is open to anyone with the URL for participant-facing data.**
   Fine for a pilot. Revisit before wider rollout.

---

## Gotchas learned the hard way — please don't rediscover these

- **Masked API keys.** Twice, a key was copied from a dashboard while still
  hidden, pasting bullet characters (`•`) instead of the value. Symptom: a
  cryptic `String contains non ISO-8859-1 code point` or `ByteString` error.
  Both key checks now detect this. After pasting any key, reveal it and confirm
  it is one unbroken run of characters.
- **Browser cache.** Repeatedly made fixes look like they hadn't worked. Verify
  a deploy by fetching the live bundle and grepping for a new string, not by
  asking Ram to refresh. `?fresh=1` on the URL forces a clean load.
- **Never run `npm run build` while the dev server is running** — it replaces
  `.next` underneath it and the page renders with no CSS at all.
- **Check the whole build output**, not a grep for `✓`. A type error was pushed
  once because the failure line was filtered out.
- **Audit all foreign keys at once** when fixing a cascade. Fixing only the one
  the error names just reveals the next one.
- Safari is stricter than Chrome about `MediaRecorder` options and multipart
  bodies. It records **MP4/AAC**, not WebM/Opus.
- Supabase errors are plain objects, not `Error` instances — `err.message`
  alone silently loses the reason.
