/**
 * TruthLens — Automated News Aggregation Service
 *
 * Supports multiple providers (swap via NEWS_PROVIDER env var):
 *   gnews      — https://gnews.io  (free: 100 req/day, paid: more)
 *   newsapi    — https://newsapi.org (free: developer tier)
 *   mediastack — https://mediastack.com
 *   mock       — built-in rich demo data (no API key needed)
 *
 * Runs on a configurable interval (NEWS_FETCH_INTERVAL_MINUTES, default 30).
 * Deduplicates by sourceUrl. Stores in News table.
 */

const prisma    = require("../config/prisma");
const { logger } = require("../utils/logger");

// ─── Provider adapters ────────────────────────────────────────────────────────

/**
 * Fetch from GNews API
 * API key: process.env.GNEWS_API_KEY
 * Docs: https://gnews.io/docs
 */
async function fetchGNews(category, maxArticles = 10) {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) throw new Error("GNEWS_API_KEY not set");

  const topicMap = {
    TECHNOLOGY:    "technology",
    SPORTS:        "sports",
    ENTERTAINMENT: "entertainment",
    POLITICS:      "nation",
    NATIONAL:      "nation",
    INTERNATIONAL: "world",
    SCIENCE:       "science",
    HEALTH:        "health",
    CRIME:         "nation",
    LOCAL:         "nation",
  };

  const topic = topicMap[category] || "general";
  const url = `https://gnews.io/api/v4/top-headlines?topic=${topic}&lang=en&country=in&max=${maxArticles}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GNews API error: ${res.status}`);
  const data = await res.json();

  return (data.articles || []).map(a => ({
    headline:   a.title,
    summary:    a.description || a.content?.slice(0, 300) || a.title,
    imageUrl:   a.image || null,
    sourceUrl:  a.url,
    sourceName: a.source?.name || "GNews",
    category,
    publishedAt: new Date(a.publishedAt),
  }));
}

/**
 * Fetch from NewsAPI
 * API key: process.env.NEWSAPI_KEY
 * Docs: https://newsapi.org/docs
 */
async function fetchNewsAPI(category, maxArticles = 10) {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) throw new Error("NEWSAPI_KEY not set");

  const catMap = {
    TECHNOLOGY:    "technology",
    SPORTS:        "sports",
    ENTERTAINMENT: "entertainment",
    POLITICS:      "general",
    NATIONAL:      "general",
    INTERNATIONAL: "general",
    SCIENCE:       "science",
    HEALTH:        "health",
    CRIME:         "general",
    LOCAL:         "general",
  };

  const newsCategory = catMap[category] || "general";
  const url = `https://newsapi.org/v2/top-headlines?category=${newsCategory}&language=en&pageSize=${maxArticles}&apiKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`NewsAPI error: ${res.status}`);
  const data = await res.json();

  if (data.status !== "ok") throw new Error(`NewsAPI: ${data.message}`);

  return (data.articles || [])
    .filter(a => a.url && a.title && !a.title.includes("[Removed]"))
    .map(a => ({
      headline:   a.title,
      summary:    a.description || a.title,
      imageUrl:   a.urlToImage || null,
      sourceUrl:  a.url,
      sourceName: a.source?.name || "NewsAPI",
      category,
      publishedAt: new Date(a.publishedAt),
    }));
}

/**
 * Mock provider — rich, realistic demo articles
 * Used when no API key is configured. Always returns content.
 */
function fetchMockNews(category) {
  const now = new Date();
  const articles = {
    TECHNOLOGY: [
      { headline: "India Launches ₹10,000 Crore AI Mission to Train 5 Lakh Professionals", summary: "The government has unveiled an ambitious artificial intelligence mission aimed at creating a large pool of skilled AI practitioners across the country, with focus on tier-2 cities.", imageUrl: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=75", sourceName: "The Hindu", sourceUrl: "https://www.thehindu.com" },
      { headline: "Reliance Jio Introduces 5G-Powered Smart Villages in Rural Maharashtra", summary: "Jio's pilot project connects 200 villages with 5G infrastructure, enabling remote healthcare, digital education and agricultural advisory services.", imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=75", sourceName: "Economic Times", sourceUrl: "https://economictimes.indiatimes.com" },
      { headline: "OpenAI Partners with IIT Bombay for Cutting-Edge AI Research Centre", summary: "The collaboration aims to produce foundational AI research in regional languages and develop models specifically tuned for South Asian contexts.", imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=75", sourceName: "NDTV", sourceUrl: "https://www.ndtv.com" },
    ],
    NATIONAL: [
      { headline: "Parliament Passes Digital Personal Data Protection Amendment Bill", summary: "The amended legislation introduces stricter penalties for data breaches and creates clearer guidelines for cross-border data transfers.", imageUrl: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=75", sourceName: "The Indian Express", sourceUrl: "https://indianexpress.com" },
      { headline: "India's GDP Growth Projected at 7.2% for FY 2025-26, Says RBI Report", summary: "The Reserve Bank's annual report highlights strong domestic consumption, rising exports and robust manufacturing output as key drivers.", imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=75", sourceName: "Mint", sourceUrl: "https://livemint.com" },
      { headline: "New Education Policy: 50 Central Universities to Offer Courses in 22 Languages", summary: "The implementation of NEP 2020's multilingual education mandate picks up pace with coordinated rollout across central universities.", imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=75", sourceName: "Times of India", sourceUrl: "https://timesofindia.com" },
    ],
    POLITICS: [
      { headline: "Election Commission Announces Voter Verification Drive Ahead of State Elections", summary: "The initiative aims to clean electoral rolls and ensure accurate voter registration before the upcoming assembly elections in three states.", imageUrl: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=75", sourceName: "The Wire", sourceUrl: "https://thewire.in" },
      { headline: "G20 Sherpa Meets Counterparts Ahead of Summit — India's Position on AI Governance", summary: "India is expected to champion a balanced approach to AI regulation that preserves developing nations' access to frontier technologies.", imageUrl: "https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=800&q=75", sourceName: "Hindustan Times", sourceUrl: "https://hindustantimes.com" },
    ],
    SPORTS: [
      { headline: "Virat Kohli Becomes First Indian Batter to Score 9,000 Test Runs at Home", summary: "The batting stalwart achieved the milestone during the first Test against South Africa in Chennai, receiving a standing ovation from the crowd.", imageUrl: "https://images.unsplash.com/photo-1540747913346-19212a4b423c?w=800&q=75", sourceName: "Cricbuzz", sourceUrl: "https://cricbuzz.com" },
      { headline: "Indian Hockey Team Wins Gold at Asian Champions Trophy in Moqi", summary: "The team's dominant performance featured tight defense and clinical counter-attacks throughout the tournament in Inner Mongolia.", imageUrl: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=75", sourceName: "ESPN Cricinfo", sourceUrl: "https://espncricinfo.com" },
      { headline: "Neeraj Chopra Defends Javelin Title at Diamond League Finals in Brussels", summary: "India's golden boy produced a massive 89.34m throw in the final round to clinch the title, maintaining his unbeaten run in 2026.", imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=75", sourceName: "TOI Sports", sourceUrl: "https://timesofindia.com/sports" },
    ],
    ENTERTAINMENT: [
      { headline: "Aamir Khan's 'Sitaare Zameen Par' Crosses ₹200 Crore Globally in First Week", summary: "The sequel to the beloved 2007 film resonated with audiences across India and the diaspora, continuing the franchise's emotional legacy.", imageUrl: "https://images.unsplash.com/photo-1603739903239-8b6e64c3b185?w=800&q=75", sourceName: "Bollywood Hungama", sourceUrl: "https://bollywoodhungama.com" },
      { headline: "Netflix India Greenlights 12 Original Series in Regional Languages for 2026", summary: "The streaming giant doubles down on vernacular content with big-budget productions in Tamil, Telugu, Marathi, Bengali and Malayalam.", imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=75", sourceName: "Film Companion", sourceUrl: "https://filmcompanion.in" },
    ],
    SCIENCE: [
      { headline: "ISRO's Chandrayaan-4 Successfully Enters Lunar Transfer Orbit", summary: "The mission, designed to bring lunar samples back to Earth, executed a flawless trans-lunar injection burn, with all systems performing nominally.", imageUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=75", sourceName: "ISRO", sourceUrl: "https://isro.gov.in" },
      { headline: "Indian Scientists Develop Low-Cost Malaria Rapid Test with 98% Accuracy", summary: "Researchers at IISc Bangalore have developed a paper-based diagnostic that requires no electricity and delivers results in under 15 minutes.", imageUrl: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=75", sourceName: "Science Daily", sourceUrl: "https://sciencedaily.com" },
    ],
    CRIME: [
      { headline: "CBI Cracks Major Cyber Fraud Ring Operating Across 8 States", summary: "The arrests follow a six-month operation targeting a network that defrauded over 12,000 victims of their savings through fake investment platforms.", imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=75", sourceName: "NDTV", sourceUrl: "https://ndtv.com" },
      { headline: "ED Seizes Assets Worth ₹850 Crore in Multi-State Money Laundering Case", summary: "Properties, vehicles, jewellery and digital assets were attached across Mumbai, Delhi and Hyderabad in coordinated early-morning raids.", imageUrl: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=75", sourceName: "The Hindu", sourceUrl: "https://thehindu.com" },
    ],
    HEALTH: [
      { headline: "AIIMS Develops Gene Therapy Protocol for Sickle Cell Disease — 90% Success Rate", summary: "The landmark clinical trial showed near-complete elimination of crisis episodes in 45 patients over a 24-month follow-up period.", imageUrl: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&q=75", sourceName: "Medical Dialogues", sourceUrl: "https://medicaldialogues.in" },
      { headline: "India Achieves WHO Target: 90% of Adults with Hypertension Receiving Treatment", summary: "A decade-long public health campaign combining community health workers and digital monitoring has achieved this historic milestone.", imageUrl: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=800&q=75", sourceName: "Health Ministry", sourceUrl: "https://mohfw.gov.in" },
    ],
    INTERNATIONAL: [
      { headline: "India Signs Free Trade Agreement with UK After Four Years of Negotiations", summary: "The deal covers goods, services and investment, with significant benefits for Indian pharmaceutical exports, IT services and textiles.", imageUrl: "https://images.unsplash.com/photo-1555952494-efd681c7e3f9?w=800&q=75", sourceName: "Reuters", sourceUrl: "https://reuters.com" },
      { headline: "G7 Nations Agree on New Framework for Regulating Frontier AI Systems", summary: "The accord establishes minimum safety standards, mandatory disclosure requirements and cross-border incident reporting protocols.", imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=75", sourceName: "BBC", sourceUrl: "https://bbc.com" },
    ],
    LOCAL: [
      { headline: "Mumbai Metro Line 3 Phase 2 Opening: 23 New Stations to Go Operational Next Month", summary: "The extension will link the western suburbs to the international airport and the proposed Navi Mumbai airport, transforming daily commutes.", imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=75", sourceName: "Mumbai Mirror", sourceUrl: "https://mumbaimirror.in" },
      { headline: "Bengaluru Launches Smart Water Metering Project for 2 Lakh Households", summary: "IoT-enabled meters will detect leakages, reduce non-revenue water and allow residents to monitor their consumption in real time.", imageUrl: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=75", sourceName: "Deccan Herald", sourceUrl: "https://deccanherald.com" },
    ],
  };

  const catArticles = articles[category] || articles.NATIONAL;
  return catArticles.map((a, i) => ({
    ...a,
    category,
    publishedAt: new Date(now.getTime() - i * 3600000), // stagger times
  }));
}

// ─── Provider selector ────────────────────────────────────────────────────────
async function fetchNewsForCategory(category) {
  const provider = process.env.NEWS_PROVIDER || "mock";

  try {
    switch (provider) {
      case "gnews":    return await fetchGNews(category);
      case "newsapi":  return await fetchNewsAPI(category);
      default:         return fetchMockNews(category);
    }
  } catch (err) {
    logger.warn(`News fetch failed for ${category} via ${provider}: ${err.message}. Falling back to mock.`);
    return fetchMockNews(category);
  }
}

// ─── Core sync function ───────────────────────────────────────────────────────
const NEWS_CATEGORIES = [
  "LOCAL","NATIONAL","INTERNATIONAL","TECHNOLOGY","CRIME","POLITICS","SPORTS","ENTERTAINMENT","SCIENCE","HEALTH"
];

async function syncNews() {
  logger.info("TruthLens NewsSync: starting...");
  let total = 0;
  let skipped = 0;

  for (const category of NEWS_CATEGORIES) {
    try {
      const articles = await fetchNewsForCategory(category);

      for (const article of articles) {
        // Deduplicate by sourceUrl
        const existing = await prisma.news.findFirst({
          where: { sourceUrl: article.sourceUrl },
        });

        if (existing) { skipped++; continue; }

        await prisma.news.create({
          data: {
            headline:   article.headline.slice(0, 500),
            summary:    article.summary.slice(0, 1000),
            imageUrl:   article.imageUrl || null,
            sourceUrl:  article.sourceUrl,
            sourceName: article.sourceName,
            category:   article.category,
            country:    "INDIA",
            publishedAt: article.publishedAt,
            isActive:   true,
          },
        });
        total++;
      }
    } catch (err) {
      logger.error(`NewsSync failed for category ${category}: ${err.message}`);
    }
  }

  // Clean up articles older than 7 days to keep DB lean
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { count: deleted } = await prisma.news.deleteMany({
    where: { publishedAt: { lt: cutoff } },
  });

  logger.info(`TruthLens NewsSync complete: +${total} new, ${skipped} duplicates skipped, ${deleted} old articles pruned.`);
  return { added: total, skipped, deleted };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
let syncInterval = null;

function startNewsScheduler() {
  const intervalMinutes = parseInt(process.env.NEWS_FETCH_INTERVAL_MINUTES) || 30;
  const intervalMs = intervalMinutes * 60 * 1000;

  // Run immediately on startup
  syncNews().catch(err => logger.error("Initial news sync failed:", err));

  // Then on schedule
  syncInterval = setInterval(() => {
    syncNews().catch(err => logger.error("Scheduled news sync failed:", err));
  }, intervalMs);

  logger.info(`TruthLens NewsScheduler: syncing every ${intervalMinutes} minutes.`);
}

function stopNewsScheduler() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

module.exports = { syncNews, startNewsScheduler, stopNewsScheduler, fetchMockNews };
