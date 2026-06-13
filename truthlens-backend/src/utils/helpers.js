const slugLib = require("slug");
const prisma = require("../config/prisma");

// ─── Response Helpers ─────────────────────────────────────────────────────────
const successResponse = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const errorResponse = (res, message = "An error occurred", statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

const paginatedResponse = (res, data, meta, message = "Success") => {
  return res.status(200).json({ success: true, message, data, meta });
};

// ─── Pagination ───────────────────────────────────────────────────────────────
const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

// ─── Slug Generator ───────────────────────────────────────────────────────────
const generateUniqueSlug = async (title) => {
  const base = slugLib(title, { lower: true });
  let candidate = base;
  let counter = 1;
  while (await prisma.blog.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${counter++}`;
  }
  return candidate;
};

// ─── Read Time ────────────────────────────────────────────────────────────────
const calculateReadTime = (content) => {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
};

// ─── Trending Score ───────────────────────────────────────────────────────────
// Weighted score: recency + engagement
const calculateTrendingScore = (blog) => {
  const now = Date.now();
  const publishedAt = blog.publishedAt ? new Date(blog.publishedAt).getTime() : now;
  const ageHours = (now - publishedAt) / (1000 * 60 * 60);
  const decayFactor = Math.exp(-ageHours / 72); // 72-hour half-life

  const engagementScore =
    (blog.viewCount || 0) * 1 +
    (blog.likeCount || 0) * 5 +
    (blog.commentCount || 0) * 8 +
    (blog.shareCount || 0) * 10;

  return engagementScore * decayFactor;
};

// ─── Content Moderation ───────────────────────────────────────────────────────
const EXPLICIT_PATTERNS = [
  /\bf+u+c+k+\b/gi, /\bs+h+i+t+\b/gi, /\bb+i+t+c+h+\b/gi,
  /\ba+s+s+h+o+l+e+\b/gi, /\bd+a+m+n+\b/gi,
  /\bkill yourself\b/gi, /\bgo die\b/gi,
  /\bhate (you|them|all)\b/gi,
];

const HATE_SPEECH_PATTERNS = [
  /\b(all|those|these) (muslims?|hindus?|christians?|jews?|sikhs?) (are|should)\b/gi,
  /\b(n+[i1]+g+[g3]+[a3e4]+r*s?)\b/gi,
];

const analyzeContent = (text) => {
  const result = {
    isFlagged: false,
    flags: [],
    blurredContent: text,
  };

  const combined = [...EXPLICIT_PATTERNS, ...HATE_SPEECH_PATTERNS];
  combined.forEach((pattern) => {
    if (pattern.test(text)) {
      result.isFlagged = true;
      result.flags.push(pattern.source);
      result.blurredContent = result.blurredContent.replace(pattern, (match) =>
        match[0] + "*".repeat(match.length - 2) + match[match.length - 1]
      );
    }
  });

  return result;
};

// ─── Sanitize User Output ─────────────────────────────────────────────────────
const sanitizeUser = (user, isOwner = false) => {
  if (!user) return null;
  const base = {
    id: user.id,
    name: user.isAnonymous && !isOwner ? (user.anonymousName || "Anonymous") : user.name,
    bio: user.isAnonymous && !isOwner ? null : user.bio,
    avatarUrl: user.isAnonymous && !isOwner ? null : user.avatarUrl,
    isAnonymous: user.isAnonymous,
    role: user.role,
    createdAt: user.createdAt,
    _count: user._count,
  };
  if (isOwner) {
    base.email = user.email;
    base.website = user.website;
    base.twitterHandle = user.twitterHandle;
    base.isVerified = user.isVerified;
  }
  return base;
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPagination,
  buildMeta,
  generateUniqueSlug,
  calculateReadTime,
  calculateTrendingScore,
  analyzeContent,
  sanitizeUser,
};
