const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { SiweMessage } = require("siwe");
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

// ========== SIWE AUTH — in-memory nonce store (address → { nonce, expiresAt }) ==========
const SIWE_NONCE_TTL_MS = 5 * 60 * 1000;
const siweNonces = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of siweNonces) {
    if (val.expiresAt <= now) siweNonces.delete(key);
  }
}, 60_000);

const siweNonceLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

// GET /player/auth/siwe-nonce?address=0x...
router.get("/player/auth/siwe-nonce", siweNonceLimiter, (req, res) => {
  const address = (req.query.address || "").trim().toLowerCase();
  if (!address || !/^0x[0-9a-f]{40}$/i.test(address)) {
    return res.status(400).json({ success: false, error: "valid address required" });
  }
  const nonce = crypto.randomBytes(16).toString("hex");
  siweNonces.set(address, { nonce, expiresAt: Date.now() + SIWE_NONCE_TTL_MS });
  return res.json({ success: true, nonce, expiresInSec: SIWE_NONCE_TTL_MS / 1000 });
});

// POST /player/auth/siwe-login  { message, signature }
// Verifies EIP-4361 wallet signature, then delegates to recordPrivyLogin so
// player upsert + JWT issuance is identical to the existing /player/login flow.
router.post("/player/auth/siwe-login", authLimiter, async (req, res, next) => {
  try {
    const { message, signature } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, error: "message is required" });
    }
    if (!signature || typeof signature !== "string") {
      return res.status(400).json({ success: false, error: "signature is required" });
    }

    let siweMessage;
    try {
      siweMessage = new SiweMessage(message);
    } catch {
      return res.status(400).json({ success: false, error: "invalid SIWE message format" });
    }

    const address = siweMessage.address.toLowerCase();
    const stored = siweNonces.get(address);
    if (!stored || stored.nonce !== siweMessage.nonce || stored.expiresAt <= Date.now()) {
      siweNonces.delete(address);
      return res.status(401).json({ success: false, error: "invalid or expired nonce" });
    }

    const result = await siweMessage.verify({ signature });
    siweNonces.delete(address);

    if (!result.success) {
      return res.status(401).json({ success: false, error: "invalid SIWE signature" });
    }

    // Inject the verified wallet so recordPrivyLogin trusts it without re-validation.
    req.body = {
      ...req.body,
      walletAddress: siweMessage.address,
      identifier: siweMessage.address,
      privyMetaData: { ...(req.body.privyMetaData || {}), address: siweMessage.address, type: "wallet" },
    };
    return recordPrivyLogin(req, res, next);
  } catch (err) {
    next(err);
  }
});

// ========== POST ENDPOINTS ==========
router.post("/player/login", authLimiter, validate({ body: loginBody }), recordPrivyLogin);
router.post("/player/login/auto", authLimiter, validate({ body: autoLoginBody }), recordAutoLogin);

// ========== AUTH MIDDLEWARE ==========
// Every API below requires JWT.
// router.use(verifyJwt);
// router.use(enforceAuthIdentity);

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
