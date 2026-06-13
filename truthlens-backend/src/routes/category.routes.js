const router = require("express").Router();
const { getCategories, getCategoryBlogs } = require("../controllers/category.controller");

router.get("/",       getCategories);
router.get("/:name",  getCategoryBlogs);

module.exports = router;
