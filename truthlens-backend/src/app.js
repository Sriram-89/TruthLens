const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { errorHandler, notFound } = require("./middleware/errorHandler");
const { logger } = require("./utils/logger");

// Routes
const authRoutes        = require("./routes/auth.routes");
const userRoutes        = require("./routes/user.routes");
const blogRoutes        = require("./routes/blog.routes");
const { nestedRouter: commentNestedRoutes, standaloneRouter: commentRoutes } = require("./routes/comment.routes");
const categoryRoutes    = require("./routes/category.routes");
const searchRoutes      = require("./routes/search.routes");
const uploadRoutes      = require("./routes/upload.routes");
const notificationRoutes= require("./routes/notification.routes");
const adminRoutes       = require("./routes/admin.routes");
const discussionRoutes  = require("./routes/discussion.routes");
const newsRoutes        = require("./routes/news.routes");

const app = express();

// ─── CORS: support multiple allowed origins ───────────────────────────────────
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Always allow localhost variants in development
if (process.env.NODE_ENV !== "production") {
  ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000",
   "http://127.0.0.1:5173", "http://localhost:4173"].forEach(o => {
    if (!ALLOWED_ORIGINS.includes(o)) ALLOWED_ORIGINS.push(o);
  });
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== "production") {
      return cb(null, true);
    }
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  message: { success: false, message: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many auth attempts. Please try again in 15 minutes." },
});

app.use(globalLimiter);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
  stream: { write: (msg) => logger.http(msg.trim()) }
}));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "TruthLens API is healthy",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = "/api/v1";
app.use(`${API}/auth`,           authLimiter, authRoutes);
app.use(`${API}/users`,          userRoutes);
app.use(`${API}/blogs`,          blogRoutes);
app.use(`${API}/blogs/:blogId/comments`, commentNestedRoutes);
app.use(`${API}/comments`,       commentRoutes);
app.use(`${API}/categories`,     categoryRoutes);
app.use(`${API}/search`,         searchRoutes);
app.use(`${API}/upload`,         uploadRoutes);
app.use(`${API}/notifications`,  notificationRoutes);
app.use(`${API}/admin`,          adminRoutes);
app.use(`${API}/discussions`,    discussionRoutes);
app.use(`${API}/news`,           newsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
