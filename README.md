# 🎬 ToonForge — AI Cartoon Studio

Auto-generates cartoon episodes daily and publishes them to YouTube. Hosted on Railway.

---

## Architecture

```
Railway Service (Next.js)
  ├── Web app  — dashboard, auth, settings
  ├── API routes — all backend logic
  └── Cron jobs — triggers generation on schedule

Railway Postgres  — users, episodes, settings, YouTube auth

Cloudflare R2 / AWS S3  — video files, thumbnails (permanent storage)

External APIs
  ├── Anthropic Claude  → script generation
  ├── Replicate/SDXL    → scene images
  ├── ElevenLabs        → voiceover audio
  └── YouTube Data API  → auto-publish
```

---

## Deploy to Railway in 7 Steps

### 1 — Push to GitHub
```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/you/toonforge.git
git push -u origin main
```

### 2 — Create Railway project
1. Go to [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → select your repo
3. Add a **PostgreSQL** plugin — Railway auto-sets `DATABASE_URL`

### 3 — Set environment variables
Railway → your service → **Variables**. Add everything from `.env.railway`.

| Variable | Where to get it |
|---|---|
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `CRON_SECRET` | Any random string |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `REPLICATE_API_TOKEN` | [replicate.com/account](https://replicate.com/account) |
| `ELEVENLABS_API_KEY` | [elevenlabs.io/app/profile](https://elevenlabs.io/app/profile) |
| `S3_*` variables | Cloudflare R2 setup below |
| `YOUTUBE_*` variables | Google Cloud Console |
| `NEXT_PUBLIC_APP_URL` | Your Railway domain (set after first deploy) |

### 4 — Set up Cloudflare R2 storage (free egress)
1. [cloudflare.com](https://cloudflare.com) → R2 → **Create bucket** → name it `toonforge-media`
2. Bucket → **Settings** → create API token with Object Read & Write
3. Enable **Public access** or set a Custom Domain → copy URL for `S3_PUBLIC_URL`
4. Fill `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`

### 5 — Set up YouTube OAuth
1. [console.cloud.google.com](https://console.cloud.google.com) → new project → enable **YouTube Data API v3**
2. **Credentials → Create OAuth 2.0 Client ID** (Web application)
3. Authorized redirect URI: `https://YOUR-APP.railway.app/api/youtube/callback`
4. Paste Client ID + Secret into Railway variables

### 6 — Add Railway Cron Jobs
Railway → your service → **Cron Jobs**. Add one job per daily slot:

| Cron | Time |
|---|---|
| `0 8 * * *` | 8 AM |
| `0 10 * * *` | 10 AM |
| `0 12 * * *` | Noon |
| `0 14 * * *` | 2 PM |
| *(add more to match episodesPerDay)* | |
| `0 3 * * *` | 3 AM — sync YouTube view counts |

**Command for generation jobs:**
```
curl -s -X POST https://YOUR-APP.railway.app/api/cron/generate -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Command for the nightly stats sync:**
```
curl -s -X POST https://YOUR-APP.railway.app/api/cron/sync-stats -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 7 — Go live
Railway auto-deploys on every git push. Once deployed:
1. Open your Railway domain → create your account
2. **Settings → YouTube** → connect your channel
3. **Settings → Generation** → set genre and art style
4. Episodes start generating automatically at your cron times

---

## How Generation Works

```
Railway Cron (scheduled)
  POST /api/cron/generate
    checks which users have this hour scheduled
    calls generateEpisodeForUser(userId)
      Claude     → script + scene prompts        [API call]
      ElevenLabs → voiceover MP3 per scene       → /tmp
      Replicate  → 1280×720 PNG per scene        → /tmp
      FFmpeg     → assembles final MP4           → /tmp
      S3/R2      → uploads video + thumbnail     → permanent
      YouTube    → publishes video               → live
      Postgres   → updates episode status
      /tmp       → cleaned up
```

---

## Cost Estimate (10 episodes/day)

| Service | Monthly |
|---|---|
| Railway Starter + Postgres | ~$10 |
| Cloudflare R2 | Free tier |
| Anthropic Claude | ~$3 |
| Replicate (SDXL) | ~$7 |
| ElevenLabs Starter | $5 |
| **Total** | **~$25/mo** |

---

## Local Dev
```bash
npm install
cp .env.railway .env.local   # fill in values
npx prisma migrate dev
npm run dev

# Test cron manually:
curl -X POST http://localhost:3000/api/cron/generate \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
