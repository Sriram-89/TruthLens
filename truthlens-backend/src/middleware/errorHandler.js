const { logger } = require("../utils/logger");

class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const notFound = (req, res, next) => {
  const err = new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404);
  next(err);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Prisma errors
  if (err.code === "P2002") {
    statusCode = 409;
    const field = err.meta?.target?.join(", ");
    message = `A record with this ${field} already exists`;
  } else if (err.code === "P2025") {
    statusCode = 404;
    message = "Record not found";
  } else if (err.code === "P2003") {
    statusCode = 400;
    message = "Invalid reference: related record not found";
  }

  // JWT errors
  if (err.name === "TokenExpiredError") { statusCode = 401; message = "Token expired"; }
  if (err.name === "JsonWebTokenError") { statusCode = 401; message = "Invalid token"; }

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") { statusCode = 413; message = "File too large"; }
  if (err.code === "LIMIT_UNEXPECTED_FILE") { statusCode = 400; message = "Unexpected file field"; }

  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${message} - ${req.originalUrl}`, { stack: err.stack });
  } else {
    logger.warn(`${statusCode} - ${message} - ${req.originalUrl}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.errors && { errors: err.errors }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = { AppError, notFound, errorHandler };
