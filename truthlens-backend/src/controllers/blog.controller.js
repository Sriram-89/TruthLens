const prisma = require("../config/prisma");
const {
  successResponse, errorResponse, paginatedResponse,
  getPagination, buildMeta, generateUniqueSlug,
  calculateReadTime, analyzeContent,
} = require("../utils/helpers");
const { deleteFromCloudinary } = require("../config/cloudinary");
const { updateTrendingScore } = require("../services/trending.service");
const { notifyNewLike } = require("../services/notification.service");

const BLOG_INCLUDE = {
  author: {
    select: {
      id: true, name: true, avatarUrl: true,
      isAnonymous: true, anonymousName: true, isVerified: true,
    },
  },
  sources: { orderBy: { order: "asc" } },
  media: { orderBy: { order: "asc" } },
  _count: { select: { likes: true, comments: true } },
};

// ─── GET /blogs ───────────────────────────────────────────────────────────────
const getBlogs = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { category, country, sort = "latest" } = req.query;

    const where = {
      status: "PUBLISHED",
      ...(category && { category: category.toUpperCase() }),
      ...(country && { country: country.toUpperCase() }),
    };

    const orderBy =
      sort === "trending" ? { trendingScore: "desc" }
      : sort === "popular" ? { viewCount: "desc" }
      : { publishedAt: "desc" };

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({ where, skip, take: limit, orderBy, include: BLOG_INCLUDE }),
      prisma.blog.count({ where }),
    ]);

    // If user is logged in, attach liked/bookmarked flags
    let enriched = blogs;
    if (req.user) {
      const blogIds = blogs.map(b => b.id);
      const [likes, bookmarks] = await Promise.all([
        prisma.like.findMany({ where: { userId: req.user.id, blogId: { in: blogIds } }, select: { blogId: true } }),
        prisma.bookmark.findMany({ where: { userId: req.user.id, blogId: { in: blogIds } }, select: { blogId: true } }),
      ]);
      const likedSet = new Set(likes.map(l => l.blogId));
      const bookmarkSet = new Set(bookmarks.map(b => b.blogId));
      enriched = blogs.map(b => ({ ...b, isLiked: likedSet.has(b.id), isBookmarked: bookmarkSet.has(b.id) }));
    }

    return paginatedResponse(res, enriched, buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── GET /blogs/trending ──────────────────────────────────────────────────────
const getTrendingBlogs = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const blogs = await prisma.blog.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { trendingScore: "desc" },
      take: Math.min(parseInt(limit), 50),
      include: BLOG_INCLUDE,
    });
    return successResponse(res, { blogs });
  } catch (err) {
    next(err);
  }
};

// ─── GET /blogs/:slug ─────────────────────────────────────────────────────────
const getBlogBySlug = async (req, res, next) => {
  try {
    const blog = await prisma.blog.findUnique({
      where: { slug: req.params.slug },
      include: {
        ...BLOG_INCLUDE,
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            author: { select: { id: true, name: true, avatarUrl: true, isAnonymous: true, anonymousName: true } },
            replies: {
              include: {
                author: { select: { id: true, name: true, avatarUrl: true, isAnonymous: true, anonymousName: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!blog) return errorResponse(res, "Blog not found", 404);

    const isOwner = req.user?.id === blog.authorId;

    // Non-published blogs only visible to owner or admin
    if (blog.status !== "PUBLISHED" && !isOwner && req.user?.role !== "ADMIN") {
      return errorResponse(res, "Blog not found", 404);
    }

    // Increment view count (fire and forget)
    prisma.blog.update({ where: { id: blog.id }, data: { viewCount: { increment: 1 } } })
      .then(() => updateTrendingScore(blog.id))
      .catch(() => {});

    // Flags for authenticated user
    let isLiked = false, isBookmarked = false;
    if (req.user) {
      [isLiked, isBookmarked] = await Promise.all([
        prisma.like.findUnique({ where: { blogId_userId: { blogId: blog.id, userId: req.user.id } } }).then(Boolean),
        prisma.bookmark.findUnique({ where: { blogId_userId: { blogId: blog.id, userId: req.user.id } } }).then(Boolean),
      ]);
    }

    return successResponse(res, { blog: { ...blog, isLiked, isBookmarked, isOwner } });
  } catch (err) {
    next(err);
  }
};

// ─── POST /blogs ──────────────────────────────────────────────────────────────
const createBlog = async (req, res, next) => {
  try {
    const { title, content, excerpt, category, country, tags, isAnonymous, sources, publish } = req.body;

    const moderation = analyzeContent(`${title} ${content}`);
    const slug = await generateUniqueSlug(title);
    const readTime = calculateReadTime(content);

    const blog = await prisma.blog.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || content.substring(0, 300).trim() + "...",
        category: category.toUpperCase(),
        country: (country || "INDIA").toUpperCase(),
        tags: tags || [],
        isAnonymous: isAnonymous || false,
        readTime,
        authorId: req.user.id,
        status: publish ? "PUBLISHED" : "DRAFT",
        publishedAt: publish ? new Date() : null,
        moderationStatus: moderation.isFlagged ? "FLAGGED" : "CLEAN",
        moderationNote: moderation.isFlagged ? "Auto-flagged: potential policy violation" : null,
        sources: sources?.length
          ? { create: sources.map((s, i) => ({ title: s.title, url: s.url || null, order: i })) }
          : undefined,
      },
      include: BLOG_INCLUDE,
    });

    if (publish) updateTrendingScore(blog.id).catch(() => {});

    return successResponse(res, { blog }, publish ? "Blog published" : "Draft saved", 201);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /blogs/:id ─────────────────────────────────────────────────────────
const updateBlog = async (req, res, next) => {
  try {
    const existing = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!existing) return errorResponse(res, "Blog not found", 404);
    if (existing.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "Not authorized", 403);
    }

    const { title, content, excerpt, category, country, tags, isAnonymous, sources, publish } = req.body;

    const moderation = content ? analyzeContent(`${title || existing.title} ${content}`) : null;
    const newSlug = title && title !== existing.title ? await generateUniqueSlug(title) : existing.slug;
    const readTime = content ? calculateReadTime(content) : existing.readTime;

    // Replace sources if provided
    let sourcesUpdate = undefined;
    if (sources !== undefined) {
      await prisma.source.deleteMany({ where: { blogId: existing.id } });
      if (sources.length > 0) {
        sourcesUpdate = { create: sources.map((s, i) => ({ title: s.title, url: s.url || null, order: i })) };
      }
    }

    const blog = await prisma.blog.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title, slug: newSlug }),
        ...(content && { content, readTime }),
        ...(excerpt !== undefined && { excerpt }),
        ...(category && { category: category.toUpperCase() }),
        ...(country && { country: country.toUpperCase() }),
        ...(tags !== undefined && { tags }),
        ...(isAnonymous !== undefined && { isAnonymous }),
        ...(moderation?.isFlagged && { moderationStatus: "FLAGGED" }),
        ...(publish === true && existing.status === "DRAFT" && { status: "PUBLISHED", publishedAt: new Date() }),
        ...(publish === false && { status: "DRAFT", publishedAt: null }),
        ...(sourcesUpdate && { sources: sourcesUpdate }),
        updatedAt: new Date(),
      },
      include: BLOG_INCLUDE,
    });

    return successResponse(res, { blog }, "Blog updated");
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /blogs/:id ────────────────────────────────────────────────────────
const deleteBlog = async (req, res, next) => {
  try {
    const blog = await prisma.blog.findUnique({
      where: { id: req.params.id },
      include: { media: true },
    });
    if (!blog) return errorResponse(res, "Blog not found", 404);
    if (blog.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "Not authorized", 403);
    }

    // Delete Cloudinary assets
    const deletions = [];
    if (blog.coverCloudId) deletions.push(deleteFromCloudinary(blog.coverCloudId));
    blog.media.forEach(m => deletions.push(deleteFromCloudinary(m.cloudinaryId, m.type)));
    await Promise.allSettled(deletions);

    await prisma.blog.delete({ where: { id: req.params.id } });
    return successResponse(res, null, "Blog deleted");
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /blogs/:id/publish ─────────────────────────────────────────────────
const publishBlog = async (req, res, next) => {
  try {
    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog) return errorResponse(res, "Blog not found", 404);
    if (blog.authorId !== req.user.id) return errorResponse(res, "Not authorized", 403);
    if (blog.status === "PUBLISHED") return errorResponse(res, "Blog already published", 400);

    const updated = await prisma.blog.update({
      where: { id: req.params.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      include: BLOG_INCLUDE,
    });
    updateTrendingScore(blog.id).catch(() => {});
    return successResponse(res, { blog: updated }, "Blog published");
  } catch (err) {
    next(err);
  }
};

// ─── POST /blogs/:id/cover ────────────────────────────────────────────────────
const uploadCoverImage = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog) return errorResponse(res, "Blog not found", 404);
    if (blog.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "Not authorized", 403);
    }

    if (blog.coverCloudId) await deleteFromCloudinary(blog.coverCloudId).catch(() => {});

    const updated = await prisma.blog.update({
      where: { id: req.params.id },
      data: { coverImageUrl: req.file.path, coverCloudId: req.file.filename },
      select: { id: true, coverImageUrl: true },
    });
    return successResponse(res, { blog: updated }, "Cover image uploaded");
  } catch (err) {
    next(err);
  }
};

// ─── POST /blogs/:id/like ─────────────────────────────────────────────────────
const toggleLike = async (req, res, next) => {
  try {
    const blog = await prisma.blog.findUnique({
      where: { id: req.params.id, status: "PUBLISHED" },
      select: { id: true, authorId: true, title: true },
    });
    if (!blog) return errorResponse(res, "Blog not found", 404);

    const existing = await prisma.like.findUnique({
      where: { blogId_userId: { blogId: blog.id, userId: req.user.id } },
    });

    if (existing) {
      await prisma.like.delete({ where: { blogId_userId: { blogId: blog.id, userId: req.user.id } } });
      updateTrendingScore(blog.id).catch(() => {});
      const count = await prisma.like.count({ where: { blogId: blog.id } });
      return successResponse(res, { liked: false, likeCount: count });
    }

    await prisma.like.create({ data: { blogId: blog.id, userId: req.user.id } });
    updateTrendingScore(blog.id).catch(() => {});

    if (blog.authorId !== req.user.id) {
      notifyNewLike(blog.authorId, req.user.name, blog.id, blog.title).catch(() => {});
    }

    const count = await prisma.like.count({ where: { blogId: blog.id } });
    return successResponse(res, { liked: true, likeCount: count });
  } catch (err) {
    next(err);
  }
};

// ─── POST /blogs/:id/bookmark ─────────────────────────────────────────────────
const toggleBookmark = async (req, res, next) => {
  try {
    const blog = await prisma.blog.findUnique({ where: { id: req.params.id, status: "PUBLISHED" } });
    if (!blog) return errorResponse(res, "Blog not found", 404);

    const existing = await prisma.bookmark.findUnique({
      where: { blogId_userId: { blogId: blog.id, userId: req.user.id } },
    });

    if (existing) {
      await prisma.bookmark.delete({ where: { blogId_userId: { blogId: blog.id, userId: req.user.id } } });
      return successResponse(res, { bookmarked: false }, "Removed from bookmarks");
    }

    await prisma.bookmark.create({ data: { blogId: blog.id, userId: req.user.id } });
    return successResponse(res, { bookmarked: true }, "Added to bookmarks");
  } catch (err) {
    next(err);
  }
};

// ─── POST /blogs/:id/share ─────────────────────────────────────────────────────
const recordShare = async (req, res, next) => {
  try {
    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog) return errorResponse(res, "Blog not found", 404);

    await prisma.blog.update({ where: { id: blog.id }, data: { shareCount: { increment: 1 } } });
    updateTrendingScore(blog.id).catch(() => {});
    return successResponse(res, null, "Share recorded");
  } catch (err) {
    next(err);
  }
};

// ─── POST /blogs/:id/report ────────────────────────────────────────────────────
const reportBlog = async (req, res, next) => {
  try {
    const { reason, description } = req.body;
    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog) return errorResponse(res, "Blog not found", 404);

    const existing = await prisma.report.findUnique({
      where: { blogId_reporterId: { blogId: blog.id, reporterId: req.user.id } },
    });
    if (existing) return errorResponse(res, "You have already reported this blog", 409);

    await prisma.report.create({
      data: { blogId: blog.id, reporterId: req.user.id, reason: reason.toUpperCase(), description },
    });

    // Auto-flag if many reports
    const reportCount = await prisma.report.count({ where: { blogId: blog.id } });
    if (reportCount >= 5 && blog.moderationStatus !== "FLAGGED") {
      await prisma.blog.update({ where: { id: blog.id }, data: { moderationStatus: "FLAGGED" } });
    }

    return successResponse(res, null, "Report submitted", 201);
  } catch (err) {
    next(err);
  }
};

// ─── GET /blogs/my-drafts ─────────────────────────────────────────────────────
const getMyDrafts = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [drafts, total] = await Promise.all([
      prisma.blog.findMany({
        where: { authorId: req.user.id, status: "DRAFT" },
        skip, take: limit,
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { likes: true, comments: true } } },
      }),
      prisma.blog.count({ where: { authorId: req.user.id, status: "DRAFT" } }),
    ]);
    return paginatedResponse(res, drafts, buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── GET /blogs/:id/analytics ────────────────────────────────────────────────
const getBlogAnalytics = async (req, res, next) => {
  try {
    const blog = await prisma.blog.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { likes: true, comments: true } } },
    });
    if (!blog) return errorResponse(res, "Blog not found", 404);
    if (blog.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "Not authorized", 403);
    }
    return successResponse(res, {
      views: blog.viewCount,
      likes: blog._count.likes,
      comments: blog._count.comments,
      shares: blog.shareCount,
      trendingScore: blog.trendingScore,
      readTime: blog.readTime,
      publishedAt: blog.publishedAt,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBlogs, getTrendingBlogs, getBlogBySlug, createBlog, updateBlog,
  deleteBlog, publishBlog, uploadCoverImage, toggleLike, toggleBookmark,
  recordShare, reportBlog, getMyDrafts, getBlogAnalytics,
};
