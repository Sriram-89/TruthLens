const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Cover Image Storage ─────────────────────────────────────────────────────
const coverStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "vaani/covers",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 630, crop: "fill", quality: "auto" }],
  },
});

// ─── Blog Image Storage ───────────────────────────────────────────────────────
const blogImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "vaani/blog-images",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
    transformation: [{ width: 1200, quality: "auto" }],
  },
});

// ─── Video Storage ────────────────────────────────────────────────────────────
const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "vaani/videos",
    resource_type: "video",
    allowed_formats: ["mp4", "mov", "avi", "webm"],
  },
});

// ─── Avatar Storage ───────────────────────────────────────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "vaani/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  },
});

const fileSizeLimits = {
  image: 10 * 1024 * 1024,  // 10MB
  video: 100 * 1024 * 1024, // 100MB
};

const uploadCover = multer({ storage: coverStorage, limits: { fileSize: fileSizeLimits.image } });
const uploadBlogImage = multer({ storage: blogImageStorage, limits: { fileSize: fileSizeLimits.image } });
const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: fileSizeLimits.video } });
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: fileSizeLimits.image } });

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = {
  cloudinary,
  uploadCover,
  uploadBlogImage,
  uploadVideo,
  uploadAvatar,
  deleteFromCloudinary,
};
