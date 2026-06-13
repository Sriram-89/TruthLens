const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { generateTokenPair, verifyRefreshToken, revokeRefreshToken, revokeAllUserTokens } = require("../utils/jwt");
const { successResponse, errorResponse } = require("../utils/helpers");
const { AppError } = require("../middleware/errorHandler");

// ─── POST /auth/signup ────────────────────────────────────────────────────────
const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return errorResponse(res, "An account with this email already exists", 409);

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: "BLOGGER" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const tokens = await generateTokenPair(user);

    return successResponse(res, { user, ...tokens }, "Account created successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── POST /auth/login ─────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return errorResponse(res, "Invalid email or password", 401);
    }
    if (!user.isActive) return errorResponse(res, "Your account has been deactivated", 403);

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return errorResponse(res, "Invalid email or password", 401);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl };
    const tokens = await generateTokenPair(safeUser);

    return successResponse(res, { user: safeUser, ...tokens }, "Logged in successfully");
  } catch (err) {
    next(err);
  }
};

// ─── POST /auth/refresh ───────────────────────────────────────────────────────
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    // Check it exists in DB (not revoked)
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      await prisma.refreshToken.deleteMany({ where: { token } });
      return errorResponse(res, "Invalid or expired refresh token", 401);
    }

    const decoded = verifyRefreshToken(token);
    await revokeRefreshToken(token); // Rotate: delete old, issue new

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, name: true, isActive: true },
    });
    if (!user || !user.isActive) return errorResponse(res, "User not found", 401);

    const tokens = await generateTokenPair(user);
    return successResponse(res, tokens, "Token refreshed");
  } catch (err) {
    next(err);
  }
};

// ─── POST /auth/logout ────────────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) await revokeRefreshToken(token);
    return successResponse(res, null, "Logged out successfully");
  } catch (err) {
    next(err);
  }
};

// ─── POST /auth/logout-all ────────────────────────────────────────────────────
const logoutAll = async (req, res, next) => {
  try {
    await revokeAllUserTokens(req.user.id);
    return successResponse(res, null, "Logged out from all devices");
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /auth/change-password ──────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return errorResponse(res, "Current password is incorrect", 400);

    const passwordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    await revokeAllUserTokens(req.user.id);

    return successResponse(res, null, "Password changed. Please log in again.");
  } catch (err) {
    next(err);
  }
};

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true, bio: true,
        avatarUrl: true, website: true, twitterHandle: true,
        isAnonymous: true, anonymousName: true, isVerified: true, createdAt: true,
        _count: { select: { blogs: true, followers: true, following: true } },
      },
    });
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

module.exports = { signup, login, refreshToken, logout, logoutAll, changePassword, getMe };
