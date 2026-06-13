const router = require("express").Router();
const {
  getDashboard, getFlaggedBlogs, moderateBlog,
  getReports, getUsers, toggleUserActive, changeUserRole,
} = require("../controllers/admin.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

router.use(authenticate, requireAdmin); // All admin routes protected + admin role required

router.get("/dashboard",               getDashboard);
router.get("/blogs/flagged",           getFlaggedBlogs);
router.patch("/blogs/:id/moderate",    moderateBlog);
router.get("/reports",                 getReports);
router.get("/users",                   getUsers);
router.patch("/users/:id/toggle-active", toggleUserActive);
router.patch("/users/:id/role",        changeUserRole);

module.exports = router;
