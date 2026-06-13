const prisma = require("../config/prisma");
const { logger } = require("../utils/logger");

const createNotification = async ({ userId, type, message, resourceId = null }) => {
  try {
    return await prisma.notification.create({
      data: { userId, type, message, resourceId },
    });
  } catch (err) {
    logger.error("Failed to create notification:", err);
  }
};

const notifyNewComment = async (blogAuthorId, commenterName, blogId, blogTitle) => {
  if (!blogAuthorId) return;
  await createNotification({
    userId: blogAuthorId,
    type: "NEW_COMMENT",
    message: `${commenterName} commented on your blog "${blogTitle}"`,
    resourceId: blogId,
  });
};

const notifyNewLike = async (blogAuthorId, likerName, blogId, blogTitle) => {
  if (!blogAuthorId) return;
  await createNotification({
    userId: blogAuthorId,
    type: "NEW_LIKE",
    message: `${likerName} liked your blog "${blogTitle}"`,
    resourceId: blogId,
  });
};

const notifyNewFollower = async (targetUserId, followerName) => {
  await createNotification({
    userId: targetUserId,
    type: "NEW_FOLLOWER",
    message: `${followerName} started following you`,
  });
};

const notifyIdentityRequest = async (targetUserId, requesterName, blogId) => {
  await createNotification({
    userId: targetUserId,
    type: "IDENTITY_REQUEST",
    message: `${requesterName} wants to know who you are`,
    resourceId: blogId,
  });
};

const notifyIdentityAccepted = async (requesterId, bloggerName) => {
  await createNotification({
    userId: requesterId,
    type: "IDENTITY_ACCEPTED",
    message: `${bloggerName} accepted your identity request`,
  });
};

const notifyIdentityRejected = async (requesterId) => {
  await createNotification({
    userId: requesterId,
    type: "IDENTITY_REJECTED",
    message: "Your identity reveal request was declined",
  });
};

module.exports = {
  createNotification,
  notifyNewComment,
  notifyNewLike,
  notifyNewFollower,
  notifyIdentityRequest,
  notifyIdentityAccepted,
  notifyIdentityRejected,
};
