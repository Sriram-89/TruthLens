const prisma = require("../config/prisma");
const { successResponse, paginatedResponse, getPagination, buildMeta } = require("../utils/helpers");

// ─── GET /notifications ───────────────────────────────────────────────────────
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const onlyUnread = req.query.unread === "true";

    const where = {
      userId: req.user.id,
      ...(onlyUnread && { isRead: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    return paginatedResponse(
      res,
      notifications,
      { ...buildMeta(total, page, limit), unreadCount },
    );
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /notifications/:id/read ───────────────────────────────────────────
const markAsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true },
    });
    return successResponse(res, null, "Marked as read");
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /notifications/read-all ───────────────────────────────────────────
const markAllAsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    return successResponse(res, null, "All notifications marked as read");
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /notifications/:id ────────────────────────────────────────────────
const deleteNotification = async (req, res, next) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    return successResponse(res, null, "Notification deleted");
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };
