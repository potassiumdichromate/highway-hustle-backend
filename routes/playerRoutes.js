const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const blockchainRoutes = require("./blockchainRoutes");
const daRoutes = require("./daRoutes");
const { verifyJwt, enforceAuthIdentity, requireAdmin } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { recordPrivyLogin, recordAutoLogin } = require("../controllers/authController");
const {
  getAllPlayerData,
  getPrivyData,
  getUserGameData,
  getPlayerGameModeData,
  getPlayerVehicleData,
  updateAllPlayerData,
  updatePrivyData,
  updateUserGameData,
  updatePlayerGameModeData,
  updatePlayerVehicleData,
} = require("../controllers/playerDataController");
const {
  getGateWalletLeaderboard,
  checkGateUserAchievement,
  createLeaderboardCommentPing,
  getLeaderboardAiComment,
  checkUserAchievement,
  getLeaderboard,
  getAllUsers,
  getStoreAssets,
} = require("../controllers/campaignController");
const {
  loginBody,
  autoLoginBody,
  userQuery,
  updateAllBody,
  updateObjectBody,
  aiCommentPingBody,
} = require("../schemas/playerSchemas");
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false
});

const stateWriteLimiter = rateLimit({
  windowMs: Number(process.env.STATE_WRITE_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000),
  max: Number(process.env.STATE_WRITE_RATE_LIMIT_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false
});

const aiLimiter = rateLimit({
  windowMs: Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000),
  max: Number(process.env.AI_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false
});

const leaderboardLimiter = rateLimit({
  windowMs: Number(process.env.LEADERBOARD_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.LEADERBOARD_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false
});

// ========== POST ENDPOINTS ==========
router.post("/player/login", authLimiter, validate({ body: loginBody }), recordPrivyLogin);
router.post("/player/login/auto", authLimiter, validate({ body: autoLoginBody }), recordAutoLogin);

// ========== AUTH MIDDLEWARE ==========
// Every API below requires JWT.
router.use(verifyJwt);
router.use(enforceAuthIdentity);

router.post("/player/all", stateWriteLimiter, validate({ query: userQuery, body: updateAllBody }), updateAllPlayerData);

// ========== GET ENDPOINTS ==========
router.get("/player/all", getAllPlayerData);
router.get("/player/privy", getPrivyData);
router.get("/player/game", getUserGameData);
router.get("/player/gamemode", getPlayerGameModeData);
router.get("/player/vehicle", getPlayerVehicleData);

// ========== POST ENDPOINTS ==========
router.post("/player/privy", stateWriteLimiter, validate({ query: userQuery, body: updateObjectBody }), updatePrivyData);
router.post("/player/game", stateWriteLimiter, validate({ query: userQuery, body: updateObjectBody }), updateUserGameData);
router.post("/player/gamemode", stateWriteLimiter, validate({ query: userQuery, body: updateObjectBody }), updatePlayerGameModeData);
router.post("/player/vehicle", stateWriteLimiter, validate({ query: userQuery, body: updateObjectBody }), updatePlayerVehicleData);

// ========== CAMPAIGN & GALXE ==========
router.get("/check-user-achievement", checkUserAchievement);
router.get("/check-gate-user-achievement/:address?", checkGateUserAchievement);
router.get("/check-gate-user-achievement", checkGateUserAchievement);

// ========== UTILITIES ==========
router.get("/leaderboard", leaderboardLimiter, getLeaderboard);
router.get("/leaderboard/gate-wallet", leaderboardLimiter, getGateWalletLeaderboard);
router.get("/store/assets", getStoreAssets);
router.post("/leaderboard/comment-ping", aiLimiter, validate({ body: aiCommentPingBody }), createLeaderboardCommentPing);
router.get("/leaderboard/ai-comment", aiLimiter, getLeaderboardAiComment);
router.get("/users", requireAdmin, getAllUsers);

router.use(blockchainRoutes);
router.use(daRoutes);

module.exports = router;
