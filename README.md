# E-valuate 🎓

AI-powered training quiz generator for hotels. Upload a training recording, get 10 AI-generated quiz questions instantly.

## Features

✅ **Landing Page** — Set training details and duration  
✅ **Recording Timer** — 15/20/30 minute countdown timer  
✅ **AI Quiz Generation** — Whisper transcription + GPT-4o questions  
✅ **Review & Edit** — Trainer reviews and edits questions  
✅ **QR Code Share** — Participants scan to take quiz  
✅ **Results Dashboard** — Score tracking and PDF export  

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL), Edge Functions (Deno)
- **AI:** OpenAI Whisper + GPT-4o
- **PDF Export:** jsPDF
- **QR Code:** qrcode.react
- **Hosting:** Vercel

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free at supabase.com)
- OpenAI API key (from platform.openai.com)
- Vercel account (free at vercel.com)

### Local Development

1. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd e-valuate
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.local.example .env.local
   ```
   Then edit `.env.local` and add your credentials:
   - `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Settings → API
   - `OPENAI_API_KEY` — from OpenAI Platform

3. **Create Supabase database:**
   - Go to Supabase → SQL Editor → New query
   - Copy contents of `supabase/migrations/001_schema.sql` and run
   - Repeat with `supabase/migrations/002_rls.sql`
   - Create `recordings` storage bucket (Private, 500MB max)

4. **Start dev server:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

### Deployment to Vercel

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/e-valuate.git
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to vercel.com → Import Project
   - Select your GitHub repo
   - Add environment variables (same 3 from .env.local)
   - Click Deploy

3. **Your app is live!** 🚀

## Architecture

### Trainer Flow
1. **Landing** (`/`) — Trainer enters: topic, date, start/end times, duration
2. **Recording** (`/recording`) — Visual countdown timer (15/20/30 min)
3. **Upload** (`/upload`) — Select and upload recording file
4. **Review** (`/session/[id]/review`) — Edit AI-generated questions
5. **Share** (`/session/[id]/share`) — Display QR code + participant link
6. **Results** (`/session/[id]/results`) — View scores, export PDF

### Participant Flow
1. **Quiz Entry** (`/quiz/[id]`) — Enter name, start quiz
2. **Quiz** (`/quiz/[id]`) — Answer 10 questions with progress bar
3. **Done** (`/quiz/[id]/done`) — View score and pass/fail

## Database Schema

**sessions** — Training sessions (title, date, status)  
**questions** — AI-generated questions (text, 4 options, correct answer)  
**quiz_attempts** — Participant submissions (name, score, passed)  
**answers** — Individual answer responses (selected key, is_correct)  

## What's Next

- [ ] Supabase Edge Function for AI processing (Whisper + GPT-4o)
- [ ] User authentication (Sign in with email)
- [ ] Multi-hotel management
- [ ] Question analytics dashboard
- [ ] Participant leaderboards
- [ ] Custom branding for PDFs

## Support

For issues or questions, contact support@e-valuate.app

---

Built with ❤️ for hotel training teams
