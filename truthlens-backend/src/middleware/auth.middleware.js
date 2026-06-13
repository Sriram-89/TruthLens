const { verifyAccessToken } = require("../utils/jwt");
const prisma = require("../config/prisma");
const { errorResponse } = require("../utils/helpers");

// ─── Authenticate ─────────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(res, "Authentication required", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, isActive: true },
      select: {
        id: true, email: true, role: true, name: true,
        isAnonymous: true, anonymousName: true, avatarUrl: true,
      },
    });

    if (!user) return errorResponse(res, "User not found or deactivated", 401);

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return errorResponse(res, "Access token expired", 401);
    if (err.name === "JsonWebTokenError") return errorResponse(res, "Invalid token", 401);
    next(err);
  }
};

// ─── Optional Auth (public routes that benefit from knowing the user) ─────────
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, isActive: true },
      select: { id: true, email: true, role: true, name: true, isAnonymous: true },
    });

    req.user = user || null;
    next();
  } catch {
    req.user = null;
    next();
  }
};

// ─── Role Guards ──────────────────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return errorResponse(res, "Authentication required", 401);
  if (!roles.includes(req.user.role)) {
    return errorResponse(res, "You do not have permission to perform this action", 403);
  }
  next();
};

const requireAdmin = requireRole("ADMIN");
const requireBlogger = requireRole("BLOGGER", "ADMIN");

// ─── Resource Ownership ───────────────────────────────────────────────────────
const requireOwnership = (getOwnerId) => async (req, res, next) => {
  try {
    const ownerId = await getOwnerId(req);
    if (!ownerId) return errorResponse(res, "Resource not found", 404);
    if (ownerId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "You can only modify your own resources", 403);
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, optionalAuth, requireRole, requireAdmin, requireBlogger, requireOwnership };
