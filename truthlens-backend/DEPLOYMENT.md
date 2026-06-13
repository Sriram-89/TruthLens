# TruthLens v3 — Complete Deployment Guide

## Files Changed in This Version

### Backend (truthlens-backend-v3.zip)

**Fixed files:**
- `src/routes/user.routes.js` — CRITICAL: moved `module.exports` after all route registrations
- `src/app.js` — CORS multi-origin, raised rate limit, Vite port allowed
- `src/controllers/user.controller.js` — clean reading progress functions
- `src/controllers/search.controller.js` — `q` optional for bloggers
- `src/controllers/news.controller.js` — admin sync endpoint added
- `src/server.js` — starts/stops news scheduler
- `prisma/schema.prisma` — User→ReadingProgress relation added

**New files:**
- `src/services/news.service.js` — multi-provider news aggregation + scheduler

### Frontend (truthlens-v3.jsx)

**Replace your existing App.jsx with this file.**

Key changes:
- Mobile-first responsive design (CSS classes: grid-auto, grid-2, grid-3, container)
- Hamburger menu for mobile with slide-out panel
- `useBreakpoint()` hook for JS-driven responsiveness
- `LazyImg` component with IntersectionObserver
- `CoverImg` — always shows real image (user upload → category fallback → picsum)
- `DEMO_BLOGS`, `DEMO_NEWS`, `DEMO_DISCS`, `DEMO_BLOGGERS` — home never empty
- SEO: `useSEO()` hook sets document title + Open Graph meta
- Reading progress bar (fixed top of blog page)
- In-memory API cache (5-min TTL for categories, trending, bloggers)

---

## Step-by-Step Setup

### Backend

```bash
# 1. Unzip
unzip truthlens-backend-v3.zip && cd truthlens-backend

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env: fill DATABASE_URL, JWT secrets, Cloudinary keys
# NEWS_PROVIDER=mock works without any API key

# 4. Database
npx prisma generate
npx prisma db push        # dev: creates tables
# OR: npx prisma migrate deploy  # production

# 5. Seed demo data
node prisma/seed.js

# 6. Start
npm run dev   # development
npm start     # production
```

### Frontend (Vite + React)

```bash
# In your React project:
cp truthlens-v3.jsx src/App.jsx

# Ensure these deps are in package.json (all are standard):
# react, react-dom — no other deps needed (uses fetch, not axios)

# The API_BASE at top of App.jsx:
const API_BASE = "http://localhost:5000/api/v1";
# Change to your production URL before deploying.

npm run dev
```

---

## Environment Variables Reference

```bash
# Required
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=32+_char_secret
JWT_REFRESH_SECRET=different_32+_char_secret

# Optional (defaults shown)
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000,http://localhost:5173
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=500
RATE_LIMIT_WINDOW_MS=900000

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# News Aggregation
NEWS_PROVIDER=mock          # mock | gnews | newsapi
NEWS_FETCH_INTERVAL_MINUTES=30
GNEWS_API_KEY=              # from gnews.io (free: 100/day)
NEWSAPI_KEY=                # from newsapi.org (free developer)
```

---

## Database Commands

```bash
npx prisma studio          # Visual DB browser
npx prisma db push         # Sync schema (dev)
npx prisma migrate dev     # Create migration (dev)
npx prisma migrate deploy  # Run migrations (production)
npx prisma generate        # Regenerate client after schema change
node prisma/seed.js        # Load demo data
```

---

## Testing All Endpoints

```bash
BASE="http://localhost:5000/api/v1"

# Health
curl $BASE/../health

# Auth
curl -X POST $BASE/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"Test@1234"}'

# Blogs (public)
curl "$BASE/blogs?limit=5"
curl "$BASE/blogs/trending?limit=4"

# Categories
curl "$BASE/categories"

# Search bloggers (no q required — v3 fix)
curl "$BASE/search/bloggers?sort=popular"

# News
curl "$BASE/news?limit=5"

# Discussions
curl "$BASE/discussions?limit=5"
```

---

## Remaining Optional Improvements

| Feature | Status | Notes |
|---------|--------|-------|
| Google OAuth | Not implemented | Add `passport-google-oauth20` |
| Email verification | Not implemented | Add nodemailer |
| Real-time notifications | Not implemented | Add Socket.io |
| Full-text search (PG) | Uses ILIKE | Add `pg_trgm` for better perf |
| Image CDN optimization | Direct Cloudinary URL | Add `next/image` or imgix |
| Admin dashboard UI | Backend only | Build separate admin React app |
| Push notifications | Not implemented | Add web-push |
| Elasticsearch | Not implemented | Replace ILIKE with ES for scale |

