const router = require("express").Router();
const { uploadBlogImage, uploadBlogVideo, deleteMedia } = require("../controllers/upload.controller");
const { authenticate, requireBlogger } = require("../middleware/auth.middleware");
const { uploadBlogImage: imgStorage, uploadVideo: vidStorage } = require("../config/cloudinary");

router.post("/image/:blogId",  authenticate, requireBlogger, imgStorage.single("image"), uploadBlogImage);
router.post("/video/:blogId",  authenticate, requireBlogger, vidStorage.single("video"), uploadBlogVideo);
router.delete("/media/:mediaId", authenticate, deleteMedia);

module.exports = router;
