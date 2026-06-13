const prisma = require("../config/prisma");
const { successResponse, errorResponse, paginatedResponse, getPagination, buildMeta } = require("../utils/helpers");

// ─── GET /search ──────────────────────────────────────────────────────────────
const searchBlogs = async (req, res, next) => {
  try {
    const { q, category, country, author, sort = "latest" } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    if (!q && !category && !country && !author) {
      return errorResponse(res, "Provide at least one search parameter: q, category, country, or author", 400);
    }

    const where = {
      status: "PUBLISHED",
      AND: [
        ...(q ? [{ OR: [
          { title: { contains: q, mode: "insensitive" } },
          { excerpt: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
          { tags: { has: q.toLowerCase() } },
          { subcategory: { contains: q, mode: "insensitive" } },
        ]}] : []),
        ...(category ? [{ category: category.toUpperCase() }] : []),
        ...(country  ? [{ country: country.toUpperCase() }]   : []),
        ...(author   ? [{ author: { OR: [
          { name: { contains: author, mode: "insensitive" } },
          { anonymousName: { contains: author, mode: "insensitive" } },
        ]}}] : []),
      ],
    };

    const orderBy =
      sort === "popular"  ? { viewCount: "desc" }
      : sort === "liked"  ? { likes: { _count: "desc" } }
      : sort === "oldest" ? { publishedAt: "asc" }
      : { publishedAt: "desc" };

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where, skip, take: limit, orderBy,
        include: {
          author: { select: { id: true, name: true, avatarUrl: true, isAnonymous: true, anonymousName: true, isVerified: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.blog.count({ where }),
    ]);

    return paginatedResponse(res, blogs, buildMeta(total, page, limit), `Found ${total} result(s)`);
  } catch (err) { next(err); }
};

// ─── GET /search/bloggers — BUG FIX: q is now optional ───────────────────────
const searchBloggers = async (req, res, next) => {
  try {
    const { q, sort = "popular" } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    // Build where — if no q, return all active bloggers
    const where = {
      isActive: true,
      role: { in: ["BLOGGER", "ADMIN"] },
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { bio: { contains: q, mode: "insensitive" } },
          { anonymousName: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    };

    const orderBy =
      sort === "active"  ? { updatedAt: "desc" }
      : sort === "newest" ? { createdAt: "desc" }
      : { followers: { _count: "desc" } }; // default: popular

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        select: {
          id: true, name: true, bio: true, avatarUrl: true,
          isAnonymous: true, anonymousName: true, isVerified: true,
          createdAt: true,
          _count: { select: { blogs: true, followers: true } },
        },
        orderBy,
      }),
      prisma.user.count({ where }),
    ]);

    return paginatedResponse(res, users, buildMeta(total, page, limit));
  } catch (err) { next(err); }
};

// ─── GET /search/url ──────────────────────────────────────────────────────────
const discoverByUrl = async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return errorResponse(res, "URL is required", 400);

    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.replace(/[-_/]/g, " ").trim().split(/\s+/).filter(Boolean);
    const paramValues = [...urlObj.searchParams.values()].join(" ").split(/\s+/).filter(Boolean);
    const keywords = [...new Set([...pathParts, ...paramValues])].filter(k => k.length > 2).slice(0, 5);

    if (!keywords.length) {
      return successResponse(res, { blogs: [], keywords: [], found: false, message: "No keywords could be extracted from URL" });
    }

    const blogs = await prisma.blog.findMany({
      where: {
        status: "PUBLISHED",
        OR: keywords.map(k => ({ OR: [
          { title: { contains: k, mode: "insensitive" } },
          { tags: { has: k.toLowerCase() } },
          { excerpt: { contains: k, mode: "insensitive" } },
        ]})),
      },
      take: 6,
      orderBy: { trendingScore: "desc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, isAnonymous: true, anonymousName: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    return successResponse(res, {
      keywords, blogs, found: blogs.length > 0,
      message: blogs.length > 0 ? `Found ${blogs.length} related blog(s)` : "No related blogs found. Be the first to write about this topic.",
    });
  } catch (err) {
    if (err.message?.includes("Invalid URL")) return errorResponse(res, "Invalid URL provided", 400);
    next(err);
  }
};

// ─── GET /search/suggestions ──────────────────────────────────────────────────
const getSearchSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return successResponse(res, { suggestions: [] });

    const [titleMatches, tagMatches] = await Promise.all([
      prisma.blog.findMany({
        where: { status: "PUBLISHED", title: { contains: q, mode: "insensitive" } },
        select: { title: true }, take: 5, orderBy: { trendingScore: "desc" },
      }),
      prisma.blog.findMany({
        where: { status: "PUBLISHED", tags: { has: q.toLowerCase() } },
        select: { tags: true }, take: 5,
      }),
    ]);

    const suggestions = [
      ...titleMatches.map(b => ({ type: "blog", text: b.title })),
      ...tagMatches.flatMap(b => b.tags.filter(t => t.toLowerCase().includes(q.toLowerCase())).map(t => ({ type: "tag", text: t }))),
    ].slice(0, 8);

    return successResponse(res, { suggestions });
  } catch (err) { next(err); }
};

module.exports = { searchBlogs, searchBloggers, discoverByUrl, getSearchSuggestions };
