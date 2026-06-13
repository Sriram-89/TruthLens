const { body, param, query } = require("express-validator");

// ─── Auth Validators ──────────────────────────────────────────────────────────
const signupValidator = [
  body("name").trim().isLength({ min: 2, max: 60 }).withMessage("Name must be 2–60 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain uppercase, lowercase, and a number"),
];

const loginValidator = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const refreshTokenValidator = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

const changePasswordValidator = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("New password must be 8+ chars with upper, lower, and number"),
];

// ─── Blog Validators ──────────────────────────────────────────────────────────
const VALID_CATEGORIES = ["NATIONAL","HISTORY","POLITICS","TECHNOLOGY","SCIENCE","EDUCATION","SPORTS","HEALTH","TRAVEL","ENTERTAINMENT"];
const VALID_COUNTRIES = ["INDIA","USA","UK","CANADA","AUSTRALIA","OTHER"];

const createBlogValidator = [
  body("title").trim().isLength({ min: 10, max: 200 }).withMessage("Title must be 10–200 characters"),
  body("content").trim().isLength({ min: 100 }).withMessage("Content must be at least 100 characters"),
  body("category").isIn(VALID_CATEGORIES).withMessage("Invalid category"),
  body("country").optional().isIn(VALID_COUNTRIES).withMessage("Invalid country"),
  body("excerpt").optional().trim().isLength({ max: 500 }).withMessage("Excerpt max 500 chars"),
  body("tags").optional().isArray({ max: 10 }).withMessage("Max 10 tags"),
  body("tags.*").optional().trim().isLength({ min: 1, max: 30 }).withMessage("Each tag must be 1–30 chars"),
  body("isAnonymous").optional().isBoolean().withMessage("isAnonymous must be boolean"),
  body("sources").optional().isArray({ max: 20 }).withMessage("Max 20 sources"),
  body("sources.*.title").optional().trim().isLength({ min: 1, max: 300 }).withMessage("Source title required"),
  body("sources.*.url").optional().isURL().withMessage("Source URL must be valid"),
];

const updateBlogValidator = [
  body("title").optional().trim().isLength({ min: 10, max: 200 }),
  body("content").optional().trim().isLength({ min: 100 }),
  body("category").optional().isIn(VALID_CATEGORIES),
  body("country").optional().isIn(VALID_COUNTRIES),
  body("excerpt").optional().trim().isLength({ max: 500 }),
  body("tags").optional().isArray({ max: 10 }),
  body("isAnonymous").optional().isBoolean(),
];

// ─── Comment Validators ───────────────────────────────────────────────────────
const createCommentValidator = [
  body("content").trim().isLength({ min: 1, max: 2000 }).withMessage("Comment must be 1–2000 characters"),
  body("parentId").optional().isString().withMessage("parentId must be a string"),
];

const updateCommentValidator = [
  body("content").trim().isLength({ min: 1, max: 2000 }).withMessage("Comment must be 1–2000 characters"),
];

// ─── User Validators ──────────────────────────────────────────────────────────
const updateProfileValidator = [
  body("name").optional().trim().isLength({ min: 2, max: 60 }),
  body("bio").optional().trim().isLength({ max: 500 }),
  body("website").optional().isURL().withMessage("Website must be a valid URL"),
  body("twitterHandle").optional().trim().isLength({ max: 50 }),
  body("isAnonymous").optional().isBoolean(),
  body("anonymousName").optional().trim().isLength({ min: 2, max: 60 }),
];

// ─── Report Validator ─────────────────────────────────────────────────────────
const VALID_REPORT_REASONS = ["HATE_SPEECH","HARASSMENT","MISINFORMATION","EXPLICIT_CONTENT","SPAM","OTHER"];
const reportValidator = [
  body("reason").isIn(VALID_REPORT_REASONS).withMessage("Invalid report reason"),
  body("description").optional().trim().isLength({ max: 1000 }),
];

// ─── Pagination ───────────────────────────────────────────────────────────────
const paginationValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit must be 1–50"),
];

module.exports = {
  signupValidator, loginValidator, refreshTokenValidator, changePasswordValidator,
  createBlogValidator, updateBlogValidator,
  createCommentValidator, updateCommentValidator,
  updateProfileValidator, reportValidator, paginationValidator,
};
