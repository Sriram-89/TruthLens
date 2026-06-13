const router = require("express").Router({ mergeParams: true });
const { getComments, createComment, updateComment, deleteComment } = require("../controllers/comment.controller");
const { authenticate, optionalAuth } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { createCommentValidator, updateCommentValidator } = require("../validators");

// Nested under /blogs/:blogId/comments
router.get("/",    optionalAuth, getComments);
router.post("/",   authenticate, createCommentValidator, validate, createComment);

// Standalone /comments/:id
const standaloneRouter = require("express").Router();
standaloneRouter.patch("/:id",  authenticate, updateCommentValidator, validate, updateComment);
standaloneRouter.delete("/:id", authenticate, deleteComment);

module.exports = { nestedRouter: router, standaloneRouter };
