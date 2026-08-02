# Quick Start - Using Your Supabase Project

Your Supabase project is already created! Let's connect it to the app.

## ✅ What You Have

- **Supabase Project URL:** `https://mgvjuuhgzayqqodmpvyn.supabase.co`
- **Supabase Dashboard:** https://app.supabase.com (login to access)

## 🚀 Immediate Next Steps (10 minutes)

### Step 1: Get Your Anon Key (2 min)

⚠️ **IMPORTANT:** The API key you provided is a "publishable" key. We need the "anon" key.

1. Go to https://app.supabase.com and log in
2. Select your project
3. Click **Settings** (bottom left) → **API**
4. Under **Project API Keys**, find and copy the key that starts with `eyJ...` (labeled as the default anon key)
5. Copy it and save temporarily

### Step 2: Update .env.local (1 min)

The `.env.local` file has been created in your project root. Update it:

```
NEXT_PUBLIC_SUPABASE_URL=https://mgvjuuhgzayqqodmpvyn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<PASTE YOUR ANON KEY HERE>
OPENAI_API_KEY=sk-<your-openai-key>
```

Replace:
- `<PASTE YOUR ANON KEY HERE>` — With the anon key from Supabase
- `sk-<your-openai-key>` — With your OpenAI API key (from platform.openai.com)

### Step 3: Run Database Migrations (3 min)

1. Go to your Supabase dashboard
2. Click **SQL Editor** → **New query**
3. Open file: `supabase/migrations/001_schema.sql` (in the project folder)
4. Copy ALL the SQL code
5. Paste into the SQL Editor in Supabase
6. Click **Run** (should say "Success")
7. **Repeat** with `supabase/migrations/002_rls.sql`

### Step 4: Create Storage Bucket (2 min)

1. In Supabase, go to **Storage** → **New bucket**
2. **Name:** `recordings` (exactly!)
3. **Public bucket:** Toggle OFF
4. **Max file size:** 500 MB
5. Click **Create bucket**

### Step 5: Test Locally (2 min)

```bash
# In your terminal, navigate to the project folder
cd "/Users/ramprabhu/Documents/E Valuate"

# Start the dev server
npm run dev
```

Visit **http://localhost:3000** — you should see the E-valuate landing page!

### Step 6: Ready to Deploy? (5 min)

Once testing works:

1. **Initialize Git:**
   ```bash
   git init
   git add .
   git commit -m "E-valuate ready for deployment"
   ```

2. **Push to GitHub:**
   - Create new repo at github.com/new
   - Copy the push commands and run them

3. **Deploy on Vercel:**
   - Go to vercel.com
   - Import your GitHub repo
   - Add the same 3 environment variables
   - Click Deploy
   - **Your app is LIVE!** 🚀

---

## 🆘 Troubleshooting

### "Can't find anon key"
You may have created your Supabase project but haven't accessed it yet. Go to https://app.supabase.com, you should see your project in the list.

### "Module not found: @supabase/supabase-js"
Run: `npm install`

### "NEXT_PUBLIC_SUPABASE_URL is missing"
Make sure `.env.local` is saved in the project root folder (same level as `package.json`)

### "Error: Cannot access Supabase"
Double-check your URL and anon key are correct and not swapped.

---

## ✨ You're Almost There!

Just need:
1. Your anon key from Supabase
2. Your OpenAI key
3. Run the 3 steps above
4. Your app works! 

**Estimated time: 10 minutes** ⏱️
