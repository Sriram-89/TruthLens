const prisma = require("../config/prisma");
const { successResponse, errorResponse, paginatedResponse, getPagination, buildMeta, sanitizeUser } = require("../utils/helpers");
const { deleteFromCloudinary } = require("../config/cloudinary");
const { notifyNewFollower, notifyIdentityRequest, notifyIdentityAccepted, notifyIdentityRejected } = require("../services/notification.service");

// ─── GET /users/:id ───────────────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id, isActive: true },
      select: {
        id: true, name: true, bio: true, avatarUrl: true, isAnonymous: true,
        anonymousName: true, role: true, website: true, twitterHandle: true,
        isVerified: true, createdAt: true,
        _count: { select: { followers: true, following: true, blogs: true } },
      },
    });
    if (!user) return errorResponse(res, "User not found", 404);

    const isOwner = req.user?.id === user.id;
    const isFollowing = req.user
      ? !!(await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: req.user.id, followingId: user.id } } }))
      : false;

    return successResponse(res, { user: sanitizeUser(user, isOwner), isFollowing });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /users/me ──────────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { name, bio, website, twitterHandle, isAnonymous, anonymousName } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, bio, website, twitterHandle, isAnonymous, anonymousName },
      select: {
        id: true, name: true, email: true, bio: true, avatarUrl: true,
        website: true, twitterHandle: true, isAnonymous: true, anonymousName: true,
      },
    });
    return successResponse(res, { user: updated }, "Profile updated");
  } catch (err) {
    next(err);
  }
};

// ─── POST /users/me/avatar ────────────────────────────────────────────────────
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { cloudinaryId: true } });

    // Delete old avatar
    if (user.cloudinaryId) await deleteFromCloudinary(user.cloudinaryId);

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: req.file.path, cloudinaryId: req.file.filename },
      select: { id: true, avatarUrl: true },
    });
    return successResponse(res, { user: updated }, "Avatar uploaded");
  } catch (err) {
    next(err);
  }
};

// ─── GET /users/:id/blogs ─────────────────────────────────────────────────────
const getUserBlogs = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const isOwner = req.user?.id === req.params.id;

    const where = {
      authorId: req.params.id,
      ...(isOwner ? {} : { status: "PUBLISHED" }),
    };

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where, skip, take: limit,
        orderBy: { publishedAt: "desc" },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true, isAnonymous: true, anonymousName: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.blog.count({ where }),
    ]);

    return paginatedResponse(res, blogs, buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── POST /users/:id/follow ───────────────────────────────────────────────────
const followUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) return errorResponse(res, "You cannot follow yourself", 400);

    const target = await prisma.user.findUnique({ where: { id: targetId, isActive: true } });
    if (!target) return errorResponse(res, "User not found", 404);

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user.id, followingId: targetId } },
    });

    if (existing) {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId: req.user.id, followingId: targetId } },
      });
      return successResponse(res, { following: false }, "Unfollowed successfully");
    }

    await prisma.follow.create({ data: { followerId: req.user.id, followingId: targetId } });
    await notifyNewFollower(targetId, req.user.name);

    return successResponse(res, { following: true }, "Followed successfully");
  } catch (err) {
    next(err);
  }
};

// ─── GET /users/:id/followers ─────────────────────────────────────────────────
const getFollowers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [followers, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: req.params.id },
        skip, take: limit,
        include: {
          follower: { select: { id: true, name: true, avatarUrl: true, bio: true, isAnonymous: true, anonymousName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.follow.count({ where: { followingId: req.params.id } }),
    ]);
    return paginatedResponse(res, followers.map(f => f.follower), buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── GET /users/:id/following ─────────────────────────────────────────────────
const getFollowing = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [following, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: req.params.id },
        skip, take: limit,
        include: {
          following: { select: { id: true, name: true, avatarUrl: true, bio: true, isAnonymous: true, anonymousName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.follow.count({ where: { followerId: req.params.id } }),
    ]);
    return paginatedResponse(res, following.map(f => f.following), buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── POST /users/:id/request-identity ────────────────────────────────────────
const requestIdentity = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const { blogId, message } = req.body;

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return errorResponse(res, "User not found", 404);
    if (!target.isAnonymous) return errorResponse(res, "This user is not anonymous", 400);
    if (targetId === req.user.id) return errorResponse(res, "Cannot request your own identity", 400);

    const existing = await prisma.identityRequest.findUnique({
      where: { requesterId_targetId_blogId: { requesterId: req.user.id, targetId, blogId: blogId || null } },
    });
    if (existing) return errorResponse(res, "You have already sent a request to this user", 409);

    const request = await prisma.identityRequest.create({
      data: { requesterId: req.user.id, targetId, blogId, message },
    });

    await notifyIdentityRequest(targetId, req.user.name, blogId);
    return successResponse(res, { request }, "Identity request sent", 201);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /users/identity-requests/:requestId ────────────────────────────────
const respondToIdentityRequest = async (req, res, next) => {
  try {
    const { action } = req.body; // "accept" | "reject"
    if (!["accept", "reject"].includes(action)) return errorResponse(res, "Action must be accept or reject", 400);

    const request = await prisma.identityRequest.findUnique({
      where: { id: req.params.requestId },
      include: { target: { select: { id: true, name: true } } },
    });

    if (!request) return errorResponse(res, "Request not found", 404);
    if (request.targetId !== req.user.id) return errorResponse(res, "Not authorized", 403);
    if (request.status !== "PENDING") return errorResponse(res, "Request already responded to", 400);

    const status = action === "accept" ? "ACCEPTED" : "REJECTED";
    await prisma.identityRequest.update({ where: { id: request.id }, data: { status } });

    if (action === "accept") {
      await notifyIdentityAccepted(request.requesterId, req.user.name);
    } else {
      await notifyIdentityRejected(request.requesterId);
    }

    return successResponse(res, null, `Request ${status.toLowerCase()}`);
  } catch (err) {
    next(err);
  }
};

// ─── GET /users/me/identity-requests ─────────────────────────────────────────
const getMyIdentityRequests = async (req, res, next) => {
  try {
    const requests = await prisma.identityRequest.findMany({
      where: { targetId: req.user.id, status: "PENDING" },
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true } },
        target: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return successResponse(res, { requests });
  } catch (err) {
    next(err);
  }
};

// ─── GET /users/:id/bookmarks ─────────────────────────────────────────────────
const getBookmarks = async (req, res, next) => {
  try {
    if (req.params.id !== req.user.id) return errorResponse(res, "Unauthorized", 403);
    const { page, limit, skip } = getPagination(req.query);

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where: { userId: req.user.id },
        skip, take: limit,
        include: {
          blog: {
            include: {
              author: { select: { id: true, name: true, avatarUrl: true, isAnonymous: true } },
              _count: { select: { likes: true, comments: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.bookmark.count({ where: { userId: req.user.id } }),
    ]);
    return paginatedResponse(res, bookmarks.map(b => b.blog), buildMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── POST /users/me/reading-progress ──────────────────────────────────────────
const saveReadingProgress = async (req, res, next) => {
  try {
    const { blogId, scrollPercent, isCompleted } = req.body;
    if (!blogId) return errorResponse(res, "blogId is required", 400);

    const progress = await prisma.readingProgress.upsert({
      where: { userId_blogId: { userId: req.user.id, blogId } },
      update: {
        scrollPercent: parseInt(scrollPercent) || 0,
        isCompleted: Boolean(isCompleted),
        lastReadAt: new Date(),
      },
      create: {
        userId: req.user.id,
        blogId,
        scrollPercent: parseInt(scrollPercent) || 0,
        isCompleted: Boolean(isCompleted),
      },
    });

    return successResponse(res, { progress });
  } catch (err) { next(err); }
};

// ─── GET /users/me/continue-reading ───────────────────────────────────────────
const getContinueReading = async (req, res, next) => {
  try {
    const items = await prisma.readingProgress.findMany({
      where: { userId: req.user.id, isCompleted: false },
      orderBy: { lastReadAt: "desc" },
      take: 6,
      include: {
        blog: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true, isAnonymous: true, anonymousName: true } },
            _count: { select: { likes: true, comments: true } },
          },
        },
      },
    });

    // Filter out items where blog no longer exists or is unpublished
    const valid = items.filter(i => i.blog && i.blog.status === "PUBLISHED");
    return successResponse(res, { items: valid });
  } catch (err) { next(err); }
};

// ─── DELETE /users/me/continue-reading/:blogId ────────────────────────────────
const removeReadingProgress = async (req, res, next) => {
  try {
    await prisma.readingProgress.deleteMany({
      where: { userId: req.user.id, blogId: req.params.blogId },
    });
    return successResponse(res, null, "Removed from continue reading");
  } catch (err) { next(err); }
};

module.exports = {
  getProfile, updateProfile, uploadAvatar, getUserBlogs,
  followUser, getFollowers, getFollowing,
  requestIdentity, respondToIdentityRequest, getMyIdentityRequests,
  getBookmarks,
  saveReadingProgress, getContinueReading, removeReadingProgress,
};
