const prisma = require("../config/prisma");
const { successResponse, errorResponse, paginatedResponse, getPagination, buildMeta } = require("../utils/helpers");
const { updateTrendingScore } = require("../services/trending.service");
const { notifyNewComment } = require("../services/notification.service");

const COMMENT_AUTHOR_SELECT = {
  select: { id: true, name: true, avatarUrl: true, isAnonymous: true, anonymousName: true },
};

// ─── GET /blogs/:blogId/comments ──────────────────────────────────────────────
const getComments = async (req, res, next) => {
  try {
    const { blogId } = req.params;
    const { page, limit, skip } = getPagination(req.query);

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { blogId, parentId: null },
        skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          author: COMMENT_AUTHOR_SELECT,
          replies: {
            orderBy: { createdAt: "asc" },
            include: { author: COMMENT_AUTHOR_SELECT },
          },
        },
      }),
      prisma.comment.count({ where: { blogId, parentId: null } }),
    ]);

    return paginatedResponse(res, comments, buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── POST /blogs/:blogId/comments ─────────────────────────────────────────────
const createComment = async (req, res, next) => {
  try {
    const { blogId } = req.params;
    const { content, parentId } = req.body;

    const blog = await prisma.blog.findUnique({
      where: { id: blogId, status: "PUBLISHED" },
      select: { id: true, authorId: true, title: true },
    });
    if (!blog) return errorResponse(res, "Blog not found", 404);

    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.blogId !== blogId) {
        return errorResponse(res, "Parent comment not found", 404);
      }
    }

    const comment = await prisma.comment.create({
      data: { content, blogId, authorId: req.user.id, parentId: parentId || null },
      include: {
        author: COMMENT_AUTHOR_SELECT,
        replies: { include: { author: COMMENT_AUTHOR_SELECT } },
      },
    });

    // Notify blog author (unless commenter is author)
    if (blog.authorId !== req.user.id) {
      notifyNewComment(blog.authorId, req.user.name, blogId, blog.title).catch(() => {});
    }
    updateTrendingScore(blogId).catch(() => {});

    return successResponse(res, { comment }, "Comment posted", 201);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /comments/:id ──────────────────────────────────────────────────────
const updateComment = async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) return errorResponse(res, "Comment not found", 404);
    if (comment.authorId !== req.user.id) return errorResponse(res, "Not authorized", 403);

    const updated = await prisma.comment.update({
      where: { id: req.params.id },
      data: { content: req.body.content, isEdited: true },
      include: { author: COMMENT_AUTHOR_SELECT },
    });
    return successResponse(res, { comment: updated }, "Comment updated");
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /comments/:id ─────────────────────────────────────────────────────
const deleteComment = async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: { blog: { select: { authorId: true } } },
    });
    if (!comment) return errorResponse(res, "Comment not found", 404);

    const isOwner = comment.authorId === req.user.id;
    const isBlogOwner = comment.blog.authorId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isOwner && !isBlogOwner && !isAdmin) {
      return errorResponse(res, "Not authorized", 403);
    }

    await prisma.comment.delete({ where: { id: req.params.id } });
    return successResponse(res, null, "Comment deleted");
  } catch (err) {
    next(err);
  }
};

module.exports = { getComments, createComment, updateComment, deleteComment };
