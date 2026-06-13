require("dotenv").config();
const app = require("./app");
const { logger } = require("./utils/logger");
const { startNewsScheduler, stopNewsScheduler } = require("./services/news.service");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`TruthLens API running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  // Start automated news aggregation
  startNewsScheduler();
});

const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  stopNewsScheduler();
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
  shutdown("UNHANDLED_REJECTION");
});
