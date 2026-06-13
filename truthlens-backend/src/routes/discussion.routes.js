const router = require("express").Router();
const { getDiscussions, getDiscussion, createDiscussion, addReply, deleteDiscussion, deleteReply } = require("../controllers/discussion.controller");
const { authenticate, optionalAuth } = require("../middleware/auth.middleware");

router.get("/",               optionalAuth, getDiscussions);
router.get("/:id",            optionalAuth, getDiscussion);
router.post("/",              authenticate, createDiscussion);
router.post("/:id/replies",   authenticate, addReply);
router.delete("/:id",         authenticate, deleteDiscussion);
router.delete("/replies/:replyId", authenticate, deleteReply);

module.exports = router;
