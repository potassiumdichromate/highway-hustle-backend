const express = require("express");
const router = express.Router();
const {
  // GET endpoints
  getAllPlayerData,
  getPrivyData,
  getUserGameData,
  getPlayerGameModeData,
  getPlayerVehicleData,
  getGateWalletLeaderboard,
  checkGateUserAchievement,
  
  // POST endpoints
  updateAllPlayerData,
  updatePrivyData,
  updateUserGameData,
  updatePlayerGameModeData,
  updatePlayerVehicleData,
  recordPrivyLogin,

  // Campaign & Utilities
  checkUserAchievement,
  getLeaderboard,
  getAllUsers,

  // 🔗 NEW: Blockchain Endpoints
  getBlockchainSessions,
  getBlockchainSessionCount,
  getBlockchainStats,
  getBlockchainHealth
} = require("../controllers/playerController");

// ========== GET ENDPOINTS ==========
// Get complete player data (WITH BLOCKCHAIN RECORDING)
router.get("/player/all", getAllPlayerData);

// Get specific data categories (WITH BLOCKCHAIN RECORDING)
router.get("/player/privy", getPrivyData);
router.get("/player/game", getUserGameData);
router.get("/player/gamemode", getPlayerGameModeData);
router.get("/player/vehicle", getPlayerVehicleData);

// ========== POST ENDPOINTS ==========
// Update complete player data
router.post("/player/all", updateAllPlayerData);

// Update specific data categories
router.post("/player/privy", updatePrivyData);
router.post("/player/game", updateUserGameData);
router.post("/player/gamemode", updatePlayerGameModeData);
router.post("/player/vehicle", updatePlayerVehicleData);
router.post("/player/login", recordPrivyLogin);

// ========== CAMPAIGN & GALXE INTEGRATION ==========
router.get("/check-user-achievement", checkUserAchievement);
router.get("/check-gate-user-achievement/:address?", checkGateUserAchievement);
router.get("/check-gate-user-achievement", checkGateUserAchievement);

// ========== UTILITIES ==========
router.get("/leaderboard", getLeaderboard);
router.get("/leaderboard/gate-wallet", getGateWalletLeaderboard);
router.get("/users", getAllUsers);

// ========== 🔗 BLOCKCHAIN ENDPOINTS ==========
// Get player's blockchain sessions
router.get("/blockchain/sessions", getBlockchainSessions);

// Get player's session count on blockchain
router.get("/blockchain/session-count", getBlockchainSessionCount);

// Get contract-level stats
router.get("/blockchain/stats", getBlockchainStats);

// Check blockchain service health
router.get("/blockchain/health", getBlockchainHealth);

module.exports = router;