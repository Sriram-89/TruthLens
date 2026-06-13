const router = require("express").Router();
const { getNews, createNews, triggerSync } = require("../controllers/news.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

router.get("/",      getNews);
router.post("/",     authenticate, requireAdmin, createNews);
router.post("/sync", authenticate, requireAdmin, triggerSync);

module.exports = router;
