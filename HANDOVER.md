# E-valuate — Claude Code Handover
You are picking up a Next.js + Supabase web app called **E-valuate**. Everything below is decided. Do not re-ask about stack, schema, or product scope. Read this fully before writing any code.

---

## What the app does

E-valuate turns any hotel training recording into a verified knowledge check with an audit-ready PDF report, in under 2 minutes, without the trainer writing a single question.

**One user:** Hotel Training Coordinator at a UAE hotel.
**One job:** Upload a training recording → AI generates 10 quiz questions → trainer reviews and publishes → staff scan QR and answer on their phones → trainer downloads a PDF showing who passed.

---

## Tech stack (decided, do not change)

| Layer | Choice |
|---|---|
| Framework | Next.js 14, App Router, TypeScript |
| Styling | Tailwind CSS |
| Database + Auth + Storage | Supabase (Postgres) |
| AI: transcription | OpenAI Whisper API |
| AI: question generation | OpenAI GPT-4o |
| AI processing (background) | Supabase Edge Function (Deno) |
| PDF export | jsPDF (client-side) |
| QR code | qrcode.react |
| Hosting | Vercel |

**Why Edge Function for AI:** Vercel's free tier kills functions at 10 seconds. A 45-minute recording through Whisper takes longer. The Edge Function handles all AI work server-side with a 400-second timeout.

**No Flutter, no native app.** The participant quiz opens via QR link in a phone browser. A responsive Next.js page is sufficient.

**No auth in v1.** A placeholder org_id and trainer_id are used. Auth is added in v2.

---

## Environment variables

```
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=sk-your-openai-key-here
```

The Edge Function also needs `OPENAI_API_KEY` set in Supabase Dashboard → Settings → Edge Functions → Secrets.

---

## Project structure

```
e-valuate/
├── src/
│   ├── app/
│   │   ├── layout.tsx                        ✅ done
│   │   ├── globals.css                       (Next.js default, unchanged)
│   │   ├── page.tsx                          ✅ done — Screen 1: Upload
│   │   ├── session/
│   │   │   └── [id]/
│   │   │       ├── review/
│   │   │       │   └── page.tsx              🔲 placeholder only — build next
│   │   │       ├── share/
│   │   │       │   └── page.tsx              🔲 not started
│   │   │       └── results/
│   │   │           └── page.tsx              🔲 not started
│   │   └── quiz/
│   │       └── [id]/
│   │           ├── page.tsx                  🔲 placeholder only — build next
│   │           └── done/
│   │               └── page.tsx              🔲 not started
│   ├── lib/
│   │   └── supabase.ts                       ✅ done
│   └── types/
│       └── index.ts                          ✅ done
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql                    ✅ done — run in Supabase SQL Editor
│   │   └── 002_rls.sql                       ✅ done — run after 001
│   └── functions/
│       └── process-session/
│           └── index.ts                      🔲 not started — build first
├── .env.local.example                        ✅ done
└── SETUP.md                                  ✅ done
```

---

## What is already built

### `src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

### `src/types/index.ts`
```typescript
export type SessionStatus = 'processing' | 'ready' | 'published' | 'closed'

export interface Org {
  id: string
  name: string
  created_at: string
}

export interface Session {
  id: string
  org_id: string
  trainer_id: string
  title: string
  department: string | null
  session_date: string
  recording_url: string | null
  transcript: string | null
  pass_threshold: number
  status: SessionStatus
  pdf_url: string | null
  created_at: string
}

export interface QuestionOption {
  key: string
  text: string
}

export interface Question {
  id: string
  org_id: string
  session_id: string
  position: number
  question_text: string
  options: QuestionOption[]
  correct_key: string
  is_deleted: boolean
  created_at: string
}

export interface QuizAttempt {
  id: string
  org_id: string
  session_id: string
  participant_name: string
  score: number
  passed: boolean
  submitted_at: string
}

export interface Answer {
  id: string
  org_id: string
  attempt_id: string
  question_id: string
  selected_key: string
  is_correct: boolean
}

export type Database = any
```

### `src/app/layout.tsx`
Clean header with "E-valuate" branding, `max-w-2xl mx-auto` content area, gray-50 background.

### `src/app/page.tsx` — Screen 1: Upload (fully functional)
- Fields: session title (required), department (optional), session date (required, defaults to today), file drop zone (audio/video, required)
- On submit: creates a `sessions` row → uploads file to Supabase Storage (`recordings` bucket) → updates `recording_url` → calls the `process-session` Edge Function → redirects to `/session/[id]/review`
- Placeholder org_id and trainer_id: `'00000000-0000-0000-0000-000000000001'` (v1 only)
- Error state displayed inline

---

## Database schema

Six tables. Run `001_schema.sql` then `002_rls.sql` in the Supabase SQL Editor.

### Table: `orgs`
One row per hotel property.
```sql
id uuid PK, name text, created_at timestamptz
```
Seed row already inserted: `id = '00000000-0000-0000-0000-000000000001', name = 'Demo Hotel'`

### Table: `sessions`
One row per uploaded training session.
```sql
id uuid PK
org_id uuid FK→orgs
trainer_id uuid              -- FK→auth.users when auth added
title text NOT NULL
department text
session_date date NOT NULL
recording_url text           -- Supabase Storage path, e.g. "{session_id}/recording.mp3"
transcript text              -- filled by Edge Function after Whisper
pass_threshold int DEFAULT 70
status session_status        -- 'processing'|'ready'|'published'|'closed'
pdf_url text                 -- filled after PDF generation
created_at timestamptz
```

### Table: `questions`
Up to 10 rows per session, written by the Edge Function.
```sql
id uuid PK
org_id uuid FK→orgs
session_id uuid FK→sessions CASCADE
position int                 -- 1 to 10
question_text text NOT NULL
options jsonb                -- [{"key":"A","text":"..."},{"key":"B","text":"..."},...]
correct_key text             -- "A"|"B"|"C"|"D"
is_deleted boolean DEFAULT false
created_at timestamptz
UNIQUE (session_id, position)
```

### Table: `quiz_attempts`
One row per participant submission.
```sql
id uuid PK
org_id uuid FK→orgs
session_id uuid FK→sessions CASCADE
participant_name text NOT NULL
score int NOT NULL           -- number correct (0–10)
passed boolean NOT NULL      -- score/total >= pass_threshold
submitted_at timestamptz
```

### Table: `answers`
One row per question per participant.
```sql
id uuid PK
org_id uuid FK→orgs
attempt_id uuid FK→quiz_attempts CASCADE
question_id uuid FK→questions
selected_key text            -- "A"|"B"|"C"|"D"
is_correct boolean NOT NULL
UNIQUE (attempt_id, question_id)
```

### Table: `profiles` (added in 002_rls.sql)
Links auth.users to an org. Used when auth is added in v2.
```sql
id uuid PK references auth.users
org_id uuid FK→orgs
full_name text
created_at timestamptz
```

---

## RLS policies summary

| Table | Who can read | Who can write |
|---|---|---|
| profiles | Own row only | Own row only (cannot change org_id) |
| sessions | trainer_id = auth.uid() | trainer_id = auth.uid() |
| questions | trainer via session ownership; anon if session is 'published' | trainer via session ownership |
| quiz_attempts | trainer via session ownership | anon INSERT if session is 'published' |
| answers | trainer via session + attempt chain | anon INSERT if session is 'published' |

**Important:** The Edge Function uses the Supabase **service role key**, which bypasses RLS. This is correct — it is trusted server code. Never send the service role key to the browser.

---

## Storage bucket

Name: `recordings`
Access: Private (not public)
Max file size: 500 MB
Path convention: `{session_id}/recording.{ext}`

In v1, storage policies are permissive (allow all insert and select). Tighten when auth is added.

---

## The 8 screens

### Trainer flow
| Screen | Route | Status |
|---|---|---|
| 1. Upload | `/` | ✅ done |
| 2. Processing | `/session/[id]/review` | 🔲 placeholder — shows spinner while status = 'processing' |
| 3. Review questions | `/session/[id]/review` | 🔲 same page as above, shown when status = 'ready' |
| 4. Share / QR | `/session/[id]/share` | 🔲 not started |
| 5. Results + PDF | `/session/[id]/results` | 🔲 not started |

### Participant flow
| Screen | Route | Status |
|---|---|---|
| 6. Name entry | `/quiz/[id]` | 🔲 placeholder |
| 7. Quiz | `/quiz/[id]` | 🔲 same page as above, shown after name submitted |
| 8. Done | `/quiz/[id]/done` | 🔲 not started |

---

## What to build next (in this order)

### 1. Supabase Edge Function: `process-session`
**File:** `supabase/functions/process-session/index.ts`
**Runtime:** Deno (Supabase Edge Functions use Deno, not Node)
**Triggered by:** `page.tsx` calling `supabase.functions.invoke('process-session', { body: { session_id } })`
**What it does:**
1. Receive `session_id` in request body
2. Fetch session row to get `recording_url` and `org_id`
3. Download the recording file from Supabase Storage using the service role key
4. Send file to OpenAI Whisper (`whisper-1` model) → get transcript text
5. Update `sessions.transcript` with the transcript
6. Send transcript to GPT-4o with this prompt:
```
You are a hotel training expert. Generate exactly 10 multiple choice questions to test whether hotel staff understood the following training session transcript. Each question must have exactly 4 options labelled A, B, C, D. Return JSON only, no explanation. Format:
[{"position":1,"question_text":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correct_key":"A"},...]
```
7. Parse the JSON response
8. Insert 10 rows into `questions` table using service role client
9. Update `sessions.status` to `'ready'`
10. Return `{ success: true }`

**Error handling:** If anything fails, update `sessions.status` to `'error'` (add this value to the enum or use a separate `error_message` column).

**Service role client in Deno:**
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
```

---

### 2. Review screen — `/session/[id]/review`
**File:** `src/app/session/[id]/review/page.tsx`
**Two states on the same page:**

**State A — Processing** (session.status = 'processing'):
- Show a spinner and "Generating your questions…"
- Poll the session row every 3 seconds: `supabase.from('sessions').select('status').eq('id', id).single()`
- When status flips to 'ready', re-render to State B without a page reload

**State B — Review** (session.status = 'ready'):
- Fetch questions where `session_id = id AND is_deleted = false` ordered by position
- Render each question as an editable card:
  - Question text (editable input)
  - 4 option inputs (A, B, C, D) with radio to mark correct answer
  - Delete button (sets `is_deleted = true`, removes from view)
- Show count: "10 questions" decrements as questions are deleted
- Disable publish if fewer than 5 questions remain
- "Publish quiz" button:
  - Updates `sessions.status` to `'published'`
  - Redirects to `/session/[id]/share`

---

### 3. Share screen — `/session/[id]/share`
**File:** `src/app/session/[id]/share/page.tsx`
- Fetch session to confirm status = 'published'
- Show large QR code: `<QRCode value={quizUrl} size={240} />` where `quizUrl = \`${window.location.origin}/quiz/${id}\``
- Show the link as copyable text with a copy button
- Show session title, department, date as confirmation
- "View results" button → `/session/[id]/results`
- "Close quiz" button → updates status to 'closed'

---

### 4. Results screen — `/session/[id]/results`
**File:** `src/app/session/[id]/results/page.tsx`
- Fetch `quiz_attempts` for the session, ordered by `submitted_at`
- Show: participant name, score (e.g. "8 / 10"), passed (green tick) or failed (red cross)
- Show overall pass rate: "14 of 18 passed (78%)"
- Show weakest question: the question_id that appears most in `answers` where `is_correct = false`
- "Export PDF" button — generate client-side using jsPDF:
  - Header: hotel name, session title, department, date, pass threshold
  - Table: name, score, pass/fail for every participant
  - Footer: generated date, overall pass rate
- Poll every 10 seconds if session is still 'published' (new submissions arrive in real time)

---

### 5. Participant name entry + quiz — `/quiz/[id]`
**File:** `src/app/quiz/[id]/page.tsx`
**Two states on the same page:**

**State A — Name entry:**
- Show session title (fetched from Supabase, anon read allowed on published sessions)
- Single text input: "Your name"
- "Start quiz" button
- On submit: store name in component state, move to State B

**State B — Quiz:**
- Fetch questions where `session_id = id AND is_deleted = false`, ordered by position
- Show one question at a time:
  - Question number (e.g. "Question 3 of 10")
  - Question text
  - 4 large tap-target buttons for A, B, C, D
  - Tapping an option auto-advances to next question (no separate "next" button)
  - Progress bar across top
- On final question submission:
  1. Calculate score locally (compare selected_key to correct_key for each question)
  2. Insert one row into `quiz_attempts`
  3. Insert 10 rows into `answers`
  4. Redirect to `/quiz/[id]/done?score=8&passed=true`

---

### 6. Done screen — `/quiz/[id]/done`
**File:** `src/app/quiz/[id]/done/page.tsx`
- Read `score` and `passed` from URL search params
- Show score: "8 out of 10"
- Show large green tick (passed) or amber X (failed)
- One line: "Your trainer has your results."
- No share button, no retry, no leaderboard

---

## Decisions already made — do not re-ask

- No auth in v1. Placeholder IDs used throughout.
- Multiple choice only. No other question types.
- 10 questions per session. No configurable count.
- Pass threshold: 70%. Stored per session but not exposed as a UI setting in v1.
- No live recording. Upload only.
- No gamification, leaderboards, or points.
- No real-time updates (polling only).
- No multi-property management.
- No training history dashboard.
- No custom PDF branding.
- No LMS integrations.
- No admin panel.
- jsPDF for PDF generation (client-side, no server needed).
- qrcode.react for QR code display.
- Participants are anonymous: they enter a name, no login.
- The Edge Function is invoked with `supabase.functions.invoke()` from the upload page immediately after the file is saved to Storage.

---

## Package.json dependencies to install

```bash
npm install @supabase/supabase-js openai qrcode.react jspdf
npm install --save-dev @types/qrcode.react
```

---

## How to run locally

```bash
npm run dev
# App runs at http://localhost:3000
```

The upload screen (Screen 1) is functional. Submitting the form requires Supabase credentials in `.env.local` and the `recordings` bucket to exist in Supabase Storage.

---

## Deployment

1. Push to GitHub
2. Connect repo to Vercel (vercel.com → Import project)
3. Add the three environment variables in Vercel → Settings → Environment Variables
4. Deploy the Edge Function: `npx supabase functions deploy process-session`
5. Set `OPENAI_API_KEY` in Supabase Dashboard → Settings → Edge Functions → Secrets

---

## The success test

A hotel training coordinator uploads a real 10-minute briefing recording, reviews the 10 AI-generated questions in under 2 minutes, shares the QR code with three colleagues, and downloads a PDF that shows each person's name, score, and pass or fail. If that happens once with a real user, the core product works.
