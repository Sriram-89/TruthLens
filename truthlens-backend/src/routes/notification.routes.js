const router = require("express").Router();
const { getNotifications, markAsRead, markAllAsRead, deleteNotification } = require("../controllers/notification.controller");
const { authenticate } = require("../middleware/auth.middleware");

router.use(authenticate); // All notification routes are protected

router.get("/",              getNotifications);
router.patch("/read-all",    markAllAsRead);
router.patch("/:id/read",    markAsRead);
router.delete("/:id",        deleteNotification);

module.exports = router;
