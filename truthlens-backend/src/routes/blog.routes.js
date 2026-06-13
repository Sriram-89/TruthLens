const router = require("express").Router();
const {
  getBlogs, getTrendingBlogs, getBlogBySlug, createBlog, updateBlog,
  deleteBlog, publishBlog, uploadCoverImage, toggleLike, toggleBookmark,
  recordShare, reportBlog, getMyDrafts, getBlogAnalytics,
} = require("../controllers/blog.controller");
const { authenticate, optionalAuth, requireBlogger } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { createBlogValidator, updateBlogValidator, reportValidator } = require("../validators");
const { uploadCover } = require("../config/cloudinary");

// Public (optional auth for like/bookmark flags)
router.get("/",                  optionalAuth, getBlogs);
router.get("/trending",          getTrendingBlogs);
router.get("/my-drafts",         authenticate, getMyDrafts);
router.get("/:slug",             optionalAuth, getBlogBySlug);

// Blogger protected
router.post("/",                 authenticate, requireBlogger, createBlogValidator, validate, createBlog);
router.patch("/:id",             authenticate, requireBlogger, updateBlogValidator, validate, updateBlog);
router.delete("/:id",            authenticate, requireBlogger, deleteBlog);
router.patch("/:id/publish",     authenticate, requireBlogger, publishBlog);
router.post("/:id/cover",        authenticate, requireBlogger, uploadCover.single("cover"), uploadCoverImage);
router.get("/:id/analytics",     authenticate, getBlogAnalytics);

// Authenticated user interactions
router.post("/:id/like",         authenticate, toggleLike);
router.post("/:id/bookmark",     authenticate, toggleBookmark);
router.post("/:id/share",        recordShare);
router.post("/:id/report",       authenticate, reportValidator, validate, reportBlog);

module.exports = router;
