# Vaani API Documentation

**Base URL:** `http://localhost:5000/api/v1`  
**Auth:** Bearer JWT in `Authorization` header  
**Format:** All requests/responses are `application/json`

---

## Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | ❌ | Register new account |
| POST | `/auth/login` | ❌ | Login and get tokens |
| POST | `/auth/refresh` | ❌ | Refresh access token |
| POST | `/auth/logout` | ❌ | Revoke refresh token |
| POST | `/auth/logout-all` | ✅ | Revoke all sessions |
| GET | `/auth/me` | ✅ | Get current user |
| PATCH | `/auth/change-password` | ✅ | Change password |

### POST `/auth/signup`
```json
{ "name": "Priya V", "email": "priya@example.com", "password": "Secure@123" }
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "Priya V", "email": "...", "role": "BLOGGER" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### POST `/auth/login`
```json
{ "email": "priya@example.com", "password": "Secure@123" }
```

### POST `/auth/refresh`
```json
{ "refreshToken": "eyJ..." }
```

---

## Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/:id` | Optional | Get user profile |
| PATCH | `/users/me` | ✅ | Update own profile |
| POST | `/users/me/avatar` | ✅ | Upload avatar (multipart) |
| GET | `/users/:id/blogs` | Optional | Get user's blogs |
| GET | `/users/:id/followers` | ❌ | List followers |
| GET | `/users/:id/following` | ❌ | List following |
| POST | `/users/:id/follow` | ✅ | Follow / unfollow toggle |
| GET | `/users/me/bookmarks` | ✅ | Get bookmarked blogs |
| POST | `/users/:id/request-identity` | ✅ | Request anonymous blogger identity |
| GET | `/users/me/identity-requests` | ✅ | Get incoming identity requests |
| PATCH | `/users/identity-requests/:requestId` | ✅ | Accept or reject identity request |

### PATCH `/users/me`
```json
{
  "name": "Priya Venkatesh",
  "bio": "Tech journalist",
  "website": "https://priya.dev",
  "twitterHandle": "priya_v",
  "isAnonymous": false,
  "anonymousName": "TechWatcher"
}
```

### POST `/users/:id/request-identity`
```json
{ "blogId": "clxxx...", "message": "I'd love to know who wrote this." }
```

### PATCH `/users/identity-requests/:requestId`
```json
{ "action": "accept" }  // or "reject"
```

---

## Blogs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/blogs` | Optional | List published blogs |
| GET | `/blogs/trending` | ❌ | Top trending blogs |
| GET | `/blogs/my-drafts` | ✅ Blogger | List own drafts |
| GET | `/blogs/:slug` | Optional | Get single blog |
| POST | `/blogs` | ✅ Blogger | Create blog |
| PATCH | `/blogs/:id` | ✅ Owner | Update blog |
| DELETE | `/blogs/:id` | ✅ Owner | Delete blog |
| PATCH | `/blogs/:id/publish` | ✅ Owner | Publish draft |
| POST | `/blogs/:id/cover` | ✅ Owner | Upload cover image |
| POST | `/blogs/:id/like` | ✅ | Toggle like |
| POST | `/blogs/:id/bookmark` | ✅ | Toggle bookmark |
| POST | `/blogs/:id/share` | ❌ | Record a share |
| POST | `/blogs/:id/report` | ✅ | Report blog |
| GET | `/blogs/:id/analytics` | ✅ Owner | View blog analytics |

### GET `/blogs` — Query params
| Param | Values | Default |
|-------|--------|---------|
| `page` | integer | 1 |
| `limit` | 1–50 | 10 |
| `category` | NATIONAL, HISTORY, etc. | — |
| `country` | INDIA, USA, UK, etc. | — |
| `sort` | `latest`, `trending`, `popular` | `latest` |

### POST `/blogs`
```json
{
  "title": "My First Blog",
  "content": "This is the full content of my blog post...",
  "excerpt": "Short summary...",
  "category": "TECHNOLOGY",
  "subcategory": "AI",
  "country": "INDIA",
  "tags": ["AI", "India"],
  "isAnonymous": false,
  "publish": true,
  "sources": [
    { "title": "Nature AI Study 2025", "url": "https://nature.com/..." },
    { "title": "Government Report 2025" }
  ]
}
```

### POST `/blogs/:id/report`
```json
{
  "reason": "MISINFORMATION",
  "description": "This blog contains factually incorrect claims about..."
}
```
**Valid reasons:** `HATE_SPEECH`, `HARASSMENT`, `MISINFORMATION`, `EXPLICIT_CONTENT`, `SPAM`, `OTHER`

---

## Comments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/blogs/:blogId/comments` | Optional | List top-level comments + replies |
| POST | `/blogs/:blogId/comments` | ✅ | Post a comment |
| PATCH | `/comments/:id` | ✅ Owner | Edit comment |
| DELETE | `/comments/:id` | ✅ Owner/BlogOwner | Delete comment |

### POST `/blogs/:blogId/comments`
```json
{ "content": "Great article!", "parentId": null }
```
To reply to a comment:
```json
{ "content": "I agree!", "parentId": "clxxx..." }
```

---

## Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/categories` | ❌ | List all categories with counts |
| GET | `/categories/:name` | ❌ | Get blogs in a category |

### GET `/categories/TECHNOLOGY` — Query params
| Param | Values |
|-------|--------|
| `subcategory` | AI, Programming, Cybersecurity, Startups |
| `country` | INDIA, USA, etc. |
| `sort` | `latest`, `trending`, `popular` |
| `page`, `limit` | pagination |

---

## Search

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/search` | ❌ | Full-text blog search |
| GET | `/search/bloggers` | ❌ | Search bloggers |
| GET | `/search/url` | ❌ | URL-based blog discovery |
| GET | `/search/suggestions` | ❌ | Autocomplete suggestions |

### GET `/search` — Query params
| Param | Description |
|-------|-------------|
| `q` | Keyword (searches title, content, excerpt, tags) |
| `category` | Filter by category |
| `country` | Filter by country |
| `author` | Filter by author name |
| `sort` | `latest`, `popular`, `liked`, `oldest` |

**Example:** `GET /search?q=AI+farming&category=TECHNOLOGY&country=INDIA&sort=popular`

### GET `/search/url`
**Example:** `GET /search/url?url=https://twitter.com/i/web/status/12345`

**Response:**
```json
{
  "success": true,
  "data": {
    "keywords": ["AI", "farming", "india"],
    "blogs": [...],
    "found": true,
    "message": "Found 3 related blog(s)"
  }
}
```

---

## Uploads

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload/image/:blogId` | ✅ Blogger | Upload blog image |
| POST | `/upload/video/:blogId` | ✅ Blogger | Upload blog video |
| DELETE | `/upload/media/:mediaId` | ✅ Owner | Delete media |

All upload endpoints use `multipart/form-data`.  
Image field name: `image` | Video field name: `video`

**Optional body field:** `caption` (string)

---

## Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | ✅ | List notifications |
| PATCH | `/notifications/read-all` | ✅ | Mark all as read |
| PATCH | `/notifications/:id/read` | ✅ | Mark one as read |
| DELETE | `/notifications/:id` | ✅ | Delete notification |

### GET `/notifications` — Query params
| Param | Values |
|-------|--------|
| `unread` | `true` — only unread |
| `page`, `limit` | pagination |

---

## Admin

> All admin routes require `role: ADMIN`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/dashboard` | ✅ Admin | Platform stats |
| GET | `/admin/blogs/flagged` | ✅ Admin | Flagged blogs |
| PATCH | `/admin/blogs/:id/moderate` | ✅ Admin | Moderate blog |
| GET | `/admin/reports` | ✅ Admin | View reports |
| GET | `/admin/users` | ✅ Admin | List users |
| PATCH | `/admin/users/:id/toggle-active` | ✅ Admin | Ban/unban user |
| PATCH | `/admin/users/:id/role` | ✅ Admin | Change user role |

### PATCH `/admin/blogs/:id/moderate`
```json
{ "action": "approve", "note": "Reviewed and cleared" }
// action: "approve" | "remove" | "flag"
```

### PATCH `/admin/users/:id/role`
```json
{ "role": "BLOGGER" }
// role: "READER" | "BLOGGER" | "ADMIN"
```

---

## Pagination Response Format

All list endpoints return:
```json
{
  "success": true,
  "message": "...",
  "data": [...],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 10,
    "totalPages": 15,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Valid email required" }
  ]
}
```

### HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 413 | File too large |
| 422 | Unprocessable entity |
| 429 | Rate limited |
| 500 | Server error |
