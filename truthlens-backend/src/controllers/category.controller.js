const prisma = require("../config/prisma");
const { successResponse, paginatedResponse, getPagination, buildMeta } = require("../utils/helpers");

const CATEGORIES = [
  { name: "NATIONAL", label: "National", icon: "🏛️",
    subcategories: ["India", "USA", "UK", "Canada", "Australia"] },
  { name: "HISTORY", label: "History", icon: "📜",
    subcategories: ["Ancient History", "Medieval History", "Modern History"] },
  { name: "POLITICS", label: "Politics", icon: "⚖️",
    subcategories: ["National Politics", "International Politics"] },
  { name: "TECHNOLOGY", label: "Technology", icon: "💻",
    subcategories: ["AI", "Programming", "Cybersecurity", "Startups"] },
  { name: "SCIENCE", label: "Science", icon: "🔬",
    subcategories: ["Biology", "Physics", "Space", "Environment"] },
  { name: "EDUCATION", label: "Education", icon: "🎓",
    subcategories: ["Higher Education", "K-12", "Online Learning", "EdTech"] },
  { name: "SPORTS", label: "Sports", icon: "⚽",
    subcategories: ["Cricket", "Football", "Athletics", "Other Sports"] },
  { name: "HEALTH", label: "Health", icon: "🫀",
    subcategories: ["Mental Health", "Nutrition", "Fitness", "Medical"] },
  { name: "TRAVEL", label: "Travel", icon: "✈️",
    subcategories: ["India", "Asia", "Europe", "Adventure", "Budget Travel"] },
  { name: "ENTERTAINMENT", label: "Entertainment", icon: "🎬",
    subcategories: ["Bollywood", "OTT", "Music", "Gaming"] },
];

// ─── GET /categories ──────────────────────────────────────────────────────────
const getCategories = async (req, res, next) => {
  try {
    // Get blog counts per category
    const counts = await prisma.blog.groupBy({
      by: ["category"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
    });

    const countMap = Object.fromEntries(counts.map(c => [c.category, c._count._all]));

    const categories = CATEGORIES.map(cat => ({
      ...cat,
      count: countMap[cat.name] || 0,
    }));

    return successResponse(res, { categories });
  } catch (err) {
    next(err);
  }
};

// ─── GET /categories/:name ────────────────────────────────────────────────────
const getCategoryBlogs = async (req, res, next) => {
  try {
    const { name } = req.params;
    const { subcategory, country, sort = "latest" } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    const categoryName = name.toUpperCase();
    const catMeta = CATEGORIES.find(c => c.name === categoryName);
    if (!catMeta) return res.status(404).json({ success: false, message: "Category not found" });

    const where = {
      status: "PUBLISHED",
      category: categoryName,
      ...(subcategory && { subcategory: { contains: subcategory, mode: "insensitive" } }),
      ...(country && { country: country.toUpperCase() }),
    };

    const orderBy =
      sort === "trending" ? { trendingScore: "desc" }
      : sort === "popular" ? { viewCount: "desc" }
      : { publishedAt: "desc" };

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where, skip, take: limit, orderBy,
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true, isAnonymous: true, anonymousName: true, isVerified: true },
          },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.blog.count({ where }),
    ]);

    return paginatedResponse(res, blogs, buildMeta(total, page, limit), `${catMeta.label} blogs`);
  } catch (err) {
    next(err);
  }
};

module.exports = { getCategories, getCategoryBlogs };
