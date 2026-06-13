const router = require("express").Router();
const { signup, login, refreshToken, logout, logoutAll, changePassword, getMe } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { signupValidator, loginValidator, refreshTokenValidator, changePasswordValidator } = require("../validators");

// Public
router.post("/signup",         signupValidator,       validate, signup);
router.post("/login",          loginValidator,        validate, login);
router.post("/refresh",        refreshTokenValidator, validate, refreshToken);
router.post("/logout",         logout);

// Protected
router.get("/me",              authenticate, getMe);
router.post("/logout-all",     authenticate, logoutAll);
router.patch("/change-password", authenticate, changePasswordValidator, validate, changePassword);

module.exports = router;
