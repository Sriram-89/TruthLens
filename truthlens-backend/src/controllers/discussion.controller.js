const prisma = require("../config/prisma");
const { successResponse, errorResponse, paginatedResponse, getPagination, buildMeta } = require("../utils/helpers");

const REPLY_AUTHOR = {
  select: { id: true, name: true, avatarUrl: true, isAnonymous: true, anonymousName: true, isVerified: true },
};

// ─── GET /discussions ─────────────────────────────────────────────────────────
const getDiscussions = async (req, res, next) => {
  try {
    const { category, sort = "latest" } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    const where = {
      ...(category ? { category: category.toUpperCase() } : {}),
    };

    const orderBy =
      sort === "active"  ? { updatedAt: "desc" }
      : sort === "popular" ? { viewCount: "desc" }
      : { createdAt: "desc" };

    const [discussions, total] = await Promise.all([
      prisma.discussion.findMany({
        where, skip, take: limit, orderBy,
        include: {
          author: REPLY_AUTHOR,
          _count: { select: { replies: true } },
        },
      }),
      prisma.discussion.count({ where }),
    ]);

    return paginatedResponse(res, discussions, buildMeta(total, page, limit));
  } catch (err) { next(err); }
};

// ─── GET /discussions/:id ─────────────────────────────────────────────────────
const getDiscussion = async (req, res, next) => {
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id: req.params.id },
      include: {
        author: REPLY_AUTHOR,
        replies: {
          where: { parentId: null },
          orderBy: { createdAt: "asc" },
          include: {
            author: REPLY_AUTHOR,
            children: {
              orderBy: { createdAt: "asc" },
              include: { author: REPLY_AUTHOR },
            },
          },
        },
        _count: { select: { replies: true } },
      },
    });

    if (!discussion) return errorResponse(res, "Discussion not found", 404);

    // Increment views (fire-and-forget)
    prisma.discussion.update({ where: { id: discussion.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    return successResponse(res, { discussion });
  } catch (err) { next(err); }
};

// ─── POST /discussions ────────────────────────────────────────────────────────
const createDiscussion = async (req, res, next) => {
  try {
    const { title, body, category = "GENERAL" } = req.body;

    if (!title?.trim() || title.trim().length < 5) {
      return errorResponse(res, "Title must be at least 5 characters", 400);
    }
    if (!body?.trim() || body.trim().length < 10) {
      return errorResponse(res, "Body must be at least 10 characters", 400);
    }

    const discussion = await prisma.discussion.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        category: category.toUpperCase(),
        authorId: req.user.id,
      },
      include: {
        author: REPLY_AUTHOR,
        _count: { select: { replies: true } },
      },
    });

    return successResponse(res, { discussion }, "Discussion created", 201);
  } catch (err) { next(err); }
};

// ─── POST /discussions/:id/replies ────────────────────────────────────────────
const addReply = async (req, res, next) => {
  try {
    const { content, parentId } = req.body;

    if (!content?.trim() || content.trim().length < 1) {
      return errorResponse(res, "Reply content is required", 400);
    }

    const discussion = await prisma.discussion.findUnique({ where: { id: req.params.id } });
    if (!discussion) return errorResponse(res, "Discussion not found", 404);
    if (!discussion.isOpen) return errorResponse(res, "This discussion is closed", 400);

    if (parentId) {
      const parent = await prisma.discussionReply.findUnique({ where: { id: parentId } });
      if (!parent || parent.discussionId !== discussion.id) return errorResponse(res, "Parent reply not found", 404);
    }

    const reply = await prisma.discussionReply.create({
      data: {
        content: content.trim(),
        discussionId: discussion.id,
        authorId: req.user.id,
        parentId: parentId || null,
      },
      include: {
        author: REPLY_AUTHOR,
        children: { include: { author: REPLY_AUTHOR } },
      },
    });

    // Touch updatedAt on parent discussion
    prisma.discussion.update({ where: { id: discussion.id }, data: { updatedAt: new Date() } }).catch(() => {});

    return successResponse(res, { reply }, "Reply posted", 201);
  } catch (err) { next(err); }
};

// ─── DELETE /discussions/:id ──────────────────────────────────────────────────
const deleteDiscussion = async (req, res, next) => {
  try {
    const discussion = await prisma.discussion.findUnique({ where: { id: req.params.id } });
    if (!discussion) return errorResponse(res, "Discussion not found", 404);
    if (discussion.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "Not authorized", 403);
    }
    await prisma.discussion.delete({ where: { id: req.params.id } });
    return successResponse(res, null, "Discussion deleted");
  } catch (err) { next(err); }
};

// ─── DELETE /discussions/replies/:replyId ─────────────────────────────────────
const deleteReply = async (req, res, next) => {
  try {
    const reply = await prisma.discussionReply.findUnique({
      where: { id: req.params.replyId },
      include: { discussion: { select: { authorId: true } } },
    });
    if (!reply) return errorResponse(res, "Reply not found", 404);
    if (reply.authorId !== req.user.id && reply.discussion.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "Not authorized", 403);
    }
    await prisma.discussionReply.delete({ where: { id: reply.id } });
    return successResponse(res, null, "Reply deleted");
  } catch (err) { next(err); }
};

module.exports = { getDiscussions, getDiscussion, createDiscussion, addReply, deleteDiscussion, deleteReply };
