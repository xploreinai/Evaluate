# E-valuate Deployment Guide

Complete step-by-step instructions to get E-valuate running with Supabase + Vercel.

---

## Phase 1: Supabase Setup (5 minutes)

### 1.1 Create Supabase Project

1. Go to https://supabase.com and sign up (free account)
2. Click **New Project**
3. Fill in:
   - **Name:** `e-valuate`
   - **Password:** Create a strong password (save this!)
   - **Region:** Europe West (Ireland) or closest to UAE
4. Click **Create new project** and wait 2-3 minutes for provisioning

### 1.2 Get Your Credentials

1. In Supabase dashboard, click **Settings** (bottom left)
2. Go to **API**
3. Copy and save:
   - **Project URL** (looks like `https://abc123.supabase.co`)
   - **Anon Key** under "Project API keys → public"

### 1.3 Run Database Migrations

1. In Supabase, go to **SQL Editor** → **New query**
2. Open file: `supabase/migrations/001_schema.sql`
3. Copy ALL the SQL code and paste into the SQL Editor
4. Click **Run** (should say "Success. No rows returned.")
5. **Repeat** with `supabase/migrations/002_rls.sql`

### 1.4 Create Storage Bucket

1. Go to **Storage** → **New bucket**
2. Fill in:
   - **Name:** `recordings` (exact name!)
   - **Public bucket:** Toggle OFF (keep private)
   - **Max file size:** `500` MB
3. Click **Create bucket**

4. Go to **Storage → recordings → Policies → New policy**
5. Select **For full customization**
6. Create first policy:
   - **Name:** `Enable INSERT`
   - **Allowed operation:** SELECT, INSERT
   - **Target roles:** authenticated, anon
   - **Policy expression:** `true`
7. Click **Create policy**

---

## Phase 2: OpenAI Setup (2 minutes)

1. Go to https://platform.openai.com/account/api-keys
2. Click **Create new secret key**
3. Copy the key (starts with `sk-`)
4. Save it securely

> **Note:** This is required for the Edge Function that generates quiz questions. You'll set it up in Supabase later.

---

## Phase 3: Local Development Setup (3 minutes)

### 3.1 Create Environment File

1. In your project root (same folder as `package.json`), create file `.env.local`
2. Paste this content and fill in YOUR values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here-starts-with-ey
OPENAI_API_KEY=sk-your-openai-key-here
```

Replace:
- `your-project-id` → From Supabase URL
- `your-anon-key-here-starts-with-ey` → From Supabase API keys
- `sk-your-openai-key-here` → From OpenAI

### 3.2 Install & Test Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000 in your browser. You should see the E-valuate landing page!

### 3.3 Test the Flow

1. Fill in: topic, date, times, duration
2. Click "Start recording"
3. Click "Start recording" button — timer should count down
4. Click "Stop recording"
5. Click "Upload recording"

(Note: Backend won't work yet until Edge Function is deployed, but UI should work)

---

## Phase 4: GitHub Setup (2 minutes)

### 4.1 Initialize Git Repository

```bash
cd /path/to/e-valuate
git init
```

### 4.2 Commit Your Code

```bash
git add .
git commit -m "Initial E-valuate commit - all screens built"
```

### 4.3 Push to GitHub

1. Go to https://github.com/new and create a new repository
   - **Name:** `e-valuate`
   - **Public or Private:** Your choice
   - Do NOT add README, .gitignore, or license (we have these)

2. In your terminal:

```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/e-valuate.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

---

## Phase 5: Vercel Deployment (3 minutes)

### 5.1 Import Project to Vercel

1. Go to https://vercel.com and sign in (free account)
2. Click **Add New → Project**
3. Under **Import Git Repository**, paste:
   ```
   https://github.com/YOUR-USERNAME/e-valuate
   ```
4. Click **Continue**

### 5.2 Add Environment Variables

On the "Configure Project" page, scroll to **Environment Variables**

Add these 3 variables (copy from your `.env.local`):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key |
| `OPENAI_API_KEY` | Your OpenAI API key |

### 5.3 Deploy

1. Click **Deploy**
2. Wait 2-3 minutes for build to complete
3. You'll see **"Congratulations! Your project has been successfully deployed"**
4. Click **Visit** to see your live app!

Your app is now live at: `https://your-project.vercel.app`

---

## Phase 6: Supabase Edge Function (for AI processing)

> ⚠️ **This is advanced** — Optional if you just want to demo the UI

The Edge Function makes the app end-to-end functional by:
- Receiving uploaded recording
- Calling Whisper API to transcribe
- Calling GPT-4o to generate 10 quiz questions
- Saving questions to database

**To set this up:**

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Create Edge Function:
   ```bash
   supabase functions new process-session
   ```

3. [Copy the Edge Function code from HANDOVER.md]

4. Deploy it:
   ```bash
   supabase link --project-ref your-project-id
   supabase functions deploy process-session
   ```

5. Set the OpenAI key in Supabase:
   - Go to Supabase → Settings → Edge Functions → Secrets
   - Add `OPENAI_API_KEY` with your key

---

## Testing Checklist

✅ Can you see the landing page?  
✅ Can you fill in training details?  
✅ Does the timer count down?  
✅ Can you submit the form?  
✅ Is the app live on Vercel?  

---

## Troubleshooting

### "Cannot find module @supabase/supabase-js"
```bash
npm install
```

### "NEXT_PUBLIC_SUPABASE_URL is missing"
Make sure `.env.local` has all 3 variables and has been saved.

### "Vercel deployment failed"
Check the build logs in Vercel dashboard → Click your project → Deployments → View build log

### "Recording upload says 'Network error'"
The backend Edge Function isn't deployed yet. That's Phase 6 — for now, the UI is fully functional.

---

## What's Working Now

- ✅ Landing page with duration selector
- ✅ Recording timer (15/20/30 minutes)
- ✅ Upload screen
- ✅ Question review interface
- ✅ QR code share page
- ✅ Results dashboard
- ✅ Participant quiz experience
- ✅ Pass/fail screen

## What Needs Backend Integration

- 🔄 Supabase Edge Function (AI question generation)
- 🔄 PDF export (requires Supabase setup)
- 🔄 Real data persistence

---

## Questions?

Refer to:
- Supabase docs: https://supabase.com/docs
- Vercel docs: https://vercel.com/docs
- Next.js docs: https://nextjs.org/docs

Good luck! 🚀
