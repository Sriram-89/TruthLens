const prisma = require("../config/prisma");
const { successResponse, errorResponse } = require("../utils/helpers");
const { deleteFromCloudinary } = require("../config/cloudinary");

// ─── POST /upload/blog-image/:blogId ─────────────────────────────────────────
const uploadBlogImage = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, "No image uploaded", 400);

    const blog = await prisma.blog.findUnique({ where: { id: req.params.blogId } });
    if (!blog) return errorResponse(res, "Blog not found", 404);
    if (blog.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "Not authorized", 403);
    }

    const mediaCount = await prisma.blogMedia.count({ where: { blogId: blog.id } });

    const media = await prisma.blogMedia.create({
      data: {
        blogId: blog.id,
        url: req.file.path,
        cloudinaryId: req.file.filename,
        type: "image",
        caption: req.body.caption || null,
        order: mediaCount,
      },
    });

    return successResponse(res, { media }, "Image uploaded", 201);
  } catch (err) {
    next(err);
  }
};

// ─── POST /upload/blog-video/:blogId ─────────────────────────────────────────
const uploadBlogVideo = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, "No video uploaded", 400);

    const blog = await prisma.blog.findUnique({ where: { id: req.params.blogId } });
    if (!blog) return errorResponse(res, "Blog not found", 404);
    if (blog.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "Not authorized", 403);
    }

    const mediaCount = await prisma.blogMedia.count({ where: { blogId: blog.id } });

    const media = await prisma.blogMedia.create({
      data: {
        blogId: blog.id,
        url: req.file.path,
        cloudinaryId: req.file.filename,
        type: "video",
        caption: req.body.caption || null,
        order: mediaCount,
      },
    });

    return successResponse(res, { media }, "Video uploaded", 201);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /upload/media/:mediaId ────────────────────────────────────────────
const deleteMedia = async (req, res, next) => {
  try {
    const media = await prisma.blogMedia.findUnique({
      where: { id: req.params.mediaId },
      include: { blog: { select: { authorId: true } } },
    });
    if (!media) return errorResponse(res, "Media not found", 404);
    if (media.blog.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return errorResponse(res, "Not authorized", 403);
    }

    await deleteFromCloudinary(media.cloudinaryId, media.type);
    await prisma.blogMedia.delete({ where: { id: media.id } });

    return successResponse(res, null, "Media deleted");
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadBlogImage, uploadBlogVideo, deleteMedia };
