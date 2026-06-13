const router = require("express").Router();
const { searchBlogs, searchBloggers, discoverByUrl, getSearchSuggestions } = require("../controllers/search.controller");

router.get("/",            searchBlogs);
router.get("/bloggers",    searchBloggers);
router.get("/url",         discoverByUrl);
router.get("/suggestions", getSearchSuggestions);

module.exports = router;
