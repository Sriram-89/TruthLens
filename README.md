# TruthLens Backend 

Production-ready backend for TruthLens: India's independent blogging, news, and discussions platform.

## Tech Stack
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL (Neon, Supabase, or local)
- **ORM:** Prisma
- **Auth:** JWT with refresh token rotation
- **Storage:** Cloudinary
- **News:** Multi-provider aggregation (mock / GNews / NewsAPI)

---

## Quick Start

### 1. Install & Configure
```bash
git clone <your-repo>
cd truthlens-backend
npm install

# Copy and fill in environment variables
cp .env.example .env
```

### 2. Required `.env` values
```
DATABASE_URL="postgresql://user:pass@host:5432/truthlens"
JWT_ACCESS_SECRET="min-32-character-random-secret"
JWT_REFRESH_SECRET="different-32-character-random-secret"
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# News: "mock" works with no API key. Switch to "gnews" or "newsapi" later.
NEWS_PROVIDER=mock
NEWS_FETCH_INTERVAL_MINUTES=30
```

### 3. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (dev — creates all tables)
npx prisma db push

# OR use migrations (production)
npx prisma migrate deploy

# Seed with demo admin + blogger accounts
node prisma/seed.js
```

### 4. Run
```bash
npm run dev    # Development (nodemon)
npm start      # Production
```

### 5. Verify
```bash
curl http://localhost:5000/health
# → { "success": true, "message": "TruthLens API is healthy" }
```

---

## Bug Fixes Applied (v3)

| # | Bug | Fix |
|---|-----|-----|
| 1 | `user.routes.js`: `module.exports` was called before reading-progress routes registered — they were **never reachable** | Moved `module.exports` to bottom; all routes registered at top |
| 2 | CORS only allowed `localhost:3000` — Vite dev server runs on `5173` | Dynamic multi-origin CORS with `FRONTEND_URL` env var |
| 3 | `searchBloggers` required `?q=` param — Bloggers page always returned error | Made `q` optional; returns all bloggers when omitted |
| 4 | `ReadingProgress` had no `User` relation — cascade deletes broken | Added `User @relation` to `ReadingProgress` model |
| 5 | News was empty (manual-only) — `GET /news` always returned 0 rows | Added `news.service.js` with auto-aggregation; mocked data works immediately |
| 6 | Rate limiter blocked frontend in dev (100 req/15min) | Raised to 500; skips OPTIONS preflight |

---

## Automatic News System

On startup, `startNewsScheduler()` runs immediately then every `NEWS_FETCH_INTERVAL_MINUTES`.

```
NEWS_PROVIDER=mock     → rich demo articles (default, no key)
NEWS_PROVIDER=gnews    → GNews API (https://gnews.io — free tier: 100 req/day)
NEWS_PROVIDER=newsapi  → NewsAPI (https://newsapi.org — free developer tier)
```

### Manual sync (admin only):
```bash
curl -X POST http://localhost:5000/api/v1/news/sync \
  -H "Authorization: Bearer <admin_token>"
```

---

## API Summary

| Group | Base | Auth |
|-------|------|------|
| Auth | `/api/v1/auth` | — |
| Blogs | `/api/v1/blogs` | Optional / Required |
| Comments | `/api/v1/blogs/:id/comments` | Optional / Required |
| Categories | `/api/v1/categories` | — |
| Search | `/api/v1/search` | — |
| Users | `/api/v1/users` | Optional / Required |
| Discussions | `/api/v1/discussions` | Optional / Required |
| News | `/api/v1/news` | — |
| Notifications | `/api/v1/notifications` | Required |
| Admin | `/api/v1/admin` | Admin only |
| Upload | `/api/v1/upload` | Required |

---

## Seed Credentials (after `node prisma/seed.js`)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@truthlens.in | Admin@1234 |
| Blogger | priya@truthlens.in | Blogger@1234 |

---

## Deployment (Railway / Render / Fly.io)

```bash
# Set all env vars in platform dashboard, then:
npm run db:generate
npx prisma migrate deploy
npm start
```

For Neon or Supabase, use the connection string with `?sslmode=require` appended.


## Author

SriramReddy Chintaparthi

Built as a modern independent news and blogging platform focused on truth, clarity, and depth.

---

## License

MIT License
