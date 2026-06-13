const router = require("express").Router();
const {
  getProfile, updateProfile, uploadAvatar, getUserBlogs,
  followUser, getFollowers, getFollowing,
  requestIdentity, respondToIdentityRequest, getMyIdentityRequests,
  getBookmarks, saveReadingProgress, getContinueReading, removeReadingProgress,
} = require("../controllers/user.controller");
const { authenticate, optionalAuth } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { updateProfileValidator } = require("../validators");
const { uploadAvatar: avatarUpload } = require("../config/cloudinary");

// ── Specific /me routes first (must be before /:id to avoid param clash) ──
router.get("/me/identity-requests",           authenticate, getMyIdentityRequests);
router.get("/me/bookmarks",                   authenticate, (req, res, next) => { req.params.id = req.user.id; next(); }, getBookmarks);
router.get("/me/continue-reading",            authenticate, getContinueReading);
router.patch("/me",                           authenticate, updateProfileValidator, validate, updateProfile);
router.post("/me/avatar",                     authenticate, avatarUpload.single("avatar"), uploadAvatar);
router.post("/me/reading-progress",           authenticate, saveReadingProgress);
router.delete("/me/continue-reading/:blogId", authenticate, removeReadingProgress);
router.patch("/identity-requests/:requestId", authenticate, respondToIdentityRequest);

// ── Public / optional-auth routes ──
router.get("/:id",              optionalAuth, getProfile);
router.get("/:id/blogs",        optionalAuth, getUserBlogs);
router.get("/:id/followers",    getFollowers);
router.get("/:id/following",    getFollowing);
router.get("/:id/bookmarks",    authenticate, getBookmarks);
router.post("/:id/follow",      authenticate, followUser);
router.post("/:id/request-identity", authenticate, requestIdentity);

module.exports = router;
