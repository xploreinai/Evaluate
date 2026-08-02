# E-valuate — Setup Guide

Follow these steps in order. Each one should take under 5 minutes.

---

## Step 1 — Create the Next.js project

Run this in your terminal. Say yes to all prompts.

```bash
npx create-next-app@latest e-valuate --typescript --tailwind --eslint --app --src-dir
cd e-valuate
```

---

## Step 2 — Install dependencies

```bash
npm install @supabase/supabase-js openai qrcode.react jspdf
npm install --save-dev @types/qrcode.react
```

---

## Step 3 — Copy the scaffold files

Copy all files from this folder into your new `e-valuate/` project folder.
When asked to overwrite, say yes (the scaffold replaces the default Next.js pages).

Your project should look like this:

```
e-valuate/
├── src/
│   ├── app/
│   │   ├── layout.tsx                   ← replaced
│   │   ├── page.tsx                     ← replaced (Upload screen)
│   │   ├── session/[id]/review/page.tsx ← new
│   │   └── quiz/[id]/page.tsx           ← new
│   ├── lib/
│   │   └── supabase.ts                  ← new
│   └── types/
│       └── index.ts                     ← new
├── supabase/
│   └── migrations/
│       └── 001_schema.sql               ← new
├── .env.local.example                   ← new
└── ...
```

---

## Step 4 — Create your Supabase project

1. Go to https://supabase.com and sign in (free account).
2. Click **New project**. Name it `e-valuate`. Pick the region closest to UAE (Europe West or similar).
3. Wait about 2 minutes for it to provision.
4. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abc123.supabase.co`)
   - **anon / public** key

---

## Step 5 — Create your environment file

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the three values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=sk-your-openai-key-here
```

---

## Step 6 — Run the database schema

1. In Supabase Dashboard, go to **SQL Editor → New query**.
2. Paste the entire contents of `supabase/migrations/001_schema.sql`.
3. Click **Run**.
4. You should see "Success. No rows returned."

---

## Step 7 — Create the Storage bucket

1. In Supabase Dashboard, go to **Storage → New bucket**.
2. Name it exactly: `recordings`
3. Toggle **Public bucket** to OFF.
4. Set Max file size to **500 MB**.
5. Click **Save**.
6. Go to **Storage → recordings → Policies → New policy → For full customization**.
7. Create two policies (one for INSERT, one for SELECT), both with `true` as the condition. This allows all operations in v1.

---

## Step 8 — Run the app

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

You should see the E-valuate upload screen with the title, department, date fields, and the file drop zone.

---

## What works at this point

- The upload form renders and validates inputs.
- Selecting a file shows the filename and size.
- Clicking **Upload and generate quiz** will attempt to create a session row in Supabase and upload the file to Storage.
- After upload it navigates to `/session/[id]/review` which shows a placeholder.

## What is built next

1. The Supabase Edge Function that calls Whisper + GPT-4o and saves the 10 questions.
2. The review screen (Screen 3) that polls for processing status and shows the questions.
3. The share screen (Screen 4) with the QR code.
4. The results screen (Screen 5) with PDF export.
5. The participant quiz screens (Screens 6, 7, 8).
