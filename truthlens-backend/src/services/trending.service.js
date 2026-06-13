const prisma = require("../config/prisma");
const { calculateTrendingScore } = require("../utils/helpers");
const { logger } = require("../utils/logger");

// Called after each view, like, comment, or share
const updateTrendingScore = async (blogId) => {
  try {
    const blog = await prisma.blog.findUnique({
      where: { id: blogId },
      include: {
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!blog) return;

    const score = calculateTrendingScore({
      viewCount: blog.viewCount,
      likeCount: blog._count.likes,
      commentCount: blog._count.comments,
      shareCount: blog.shareCount,
      publishedAt: blog.publishedAt,
    });

    await prisma.blog.update({
      where: { id: blogId },
      data: { trendingScore: score },
    });
  } catch (err) {
    logger.error(`Failed to update trending score for blog ${blogId}:`, err);
  }
};

module.exports = { updateTrendingScore };
