const prisma    = require("../config/prisma");
const { successResponse, errorResponse, paginatedResponse, getPagination, buildMeta } = require("../utils/helpers");
const { syncNews } = require("../services/news.service");

// ─── GET /news ────────────────────────────────────────────────────────────────
const getNews = async (req, res, next) => {
  try {
    const { category, country } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    const where = {
      isActive: true,
      ...(category ? { category: category.toUpperCase() } : {}),
      ...(country  ? { country:  country.toUpperCase() }  : {}),
    };

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where, skip, take: limit,
        orderBy: { publishedAt: "desc" },
      }),
      prisma.news.count({ where }),
    ]);

    // If no news at all, trigger an immediate background sync and return empty
    if (total === 0) {
      syncNews().catch(() => {});
    }

    return paginatedResponse(res, news, buildMeta(total, page, limit));
  } catch (err) { next(err); }
};

// ─── POST /news/sync (admin only — manual trigger) ────────────────────────────
const triggerSync = async (req, res, next) => {
  try {
    const result = await syncNews();
    return successResponse(res, result, "News sync complete");
  } catch (err) { next(err); }
};

// ─── POST /news (admin only — manual create single article) ──────────────────
const createNews = async (req, res, next) => {
  try {
    const { headline, summary, content, imageUrl, sourceUrl, sourceName, category, country, publishedAt } = req.body;

    if (!headline || !summary || !sourceUrl || !sourceName || !category) {
      return errorResponse(res, "headline, summary, sourceUrl, sourceName, and category are required", 400);
    }

    const news = await prisma.news.create({
      data: {
        headline, summary, content, imageUrl,
        sourceUrl, sourceName,
        category:   category.toUpperCase(),
        country:    country ? country.toUpperCase() : "INDIA",
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      },
    });

    return successResponse(res, { news }, "News article created", 201);
  } catch (err) { next(err); }
};

module.exports = { getNews, createNews, triggerSync };
