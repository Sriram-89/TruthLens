const prisma = require("../config/prisma");
const { successResponse, errorResponse, paginatedResponse, getPagination, buildMeta } = require("../utils/helpers");

// ─── GET /admin/dashboard ─────────────────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const [totalUsers, totalBlogs, publishedBlogs, flaggedBlogs, pendingReports, totalComments] =
      await Promise.all([
        prisma.user.count({ where: { isActive: true } }),
        prisma.blog.count(),
        prisma.blog.count({ where: { status: "PUBLISHED" } }),
        prisma.blog.count({ where: { moderationStatus: "FLAGGED" } }),
        prisma.report.count({ where: { isReviewed: false } }),
        prisma.comment.count(),
      ]);

    return successResponse(res, {
      totalUsers, totalBlogs, publishedBlogs,
      flaggedBlogs, pendingReports, totalComments,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/blogs/flagged ─────────────────────────────────────────────────
const getFlaggedBlogs = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where: { moderationStatus: "FLAGGED" },
        skip, take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          author: { select: { id: true, name: true, email: true } },
          _count: { select: { reports: true } },
        },
      }),
      prisma.blog.count({ where: { moderationStatus: "FLAGGED" } }),
    ]);

    return paginatedResponse(res, blogs, buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /admin/blogs/:id/moderate ─────────────────────────────────────────
const moderateBlog = async (req, res, next) => {
  try {
    const { action, note } = req.body;
    // action: "approve" | "remove" | "flag"
    const validActions = { approve: "REVIEWED", remove: "REMOVED", flag: "FLAGGED" };
    if (!validActions[action]) return errorResponse(res, "Invalid action. Use: approve, remove, or flag", 400);

    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog) return errorResponse(res, "Blog not found", 404);

    await prisma.blog.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: validActions[action],
        moderationNote: note || null,
        ...(action === "remove" && { status: "ARCHIVED" }),
      },
    });

    // Mark all reports as reviewed
    await prisma.report.updateMany({ where: { blogId: req.params.id }, data: { isReviewed: true } });

    return successResponse(res, null, `Blog ${action}d successfully`);
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/reports ───────────────────────────────────────────────────────
const getReports = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const onlyPending = req.query.pending !== "false";

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: { ...(onlyPending && { isReviewed: false }) },
        skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          blog: { select: { id: true, title: true, slug: true, authorId: true, moderationStatus: true } },
          reporter: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.report.count({ where: { ...(onlyPending && { isReviewed: false }) } }),
    ]);

    return paginatedResponse(res, reports, buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/users ─────────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { role, active } = req.query;

    const where = {
      ...(role && { role: role.toUpperCase() }),
      ...(active !== undefined && { isActive: active === "true" }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, email: true, role: true,
          isActive: true, isAnonymous: true, createdAt: true,
          _count: { select: { blogs: true, followers: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return paginatedResponse(res, users, buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /admin/users/:id/toggle-active ────────────────────────────────────
const toggleUserActive = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return errorResponse(res, "User not found", 404);
    if (user.role === "ADMIN") return errorResponse(res, "Cannot deactivate admin accounts", 403);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true, name: true },
    });

    return successResponse(res, { user: updated }, `User ${updated.isActive ? "activated" : "deactivated"}`);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /admin/users/:id/role ─────────────────────────────────────────────
const changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ["READER", "BLOGGER", "ADMIN"];
    if (!validRoles.includes(role)) return errorResponse(res, "Invalid role", 400);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, role: true },
    });

    return successResponse(res, { user: updated }, "User role updated");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard, getFlaggedBlogs, moderateBlog,
  getReports, getUsers, toggleUserActive, changeUserRole,
};
