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

  // Session Blockchain Endpoints
  getBlockchainSessions,
  getBlockchainSessionCount,
  getBlockchainStats,
  getBlockchainHealth,

  // Vehicle Blockchain Endpoints
  getBlockchainVehicles,
  getVehicleSwitchHistory,
  getVehicleStats,
  getVehicleHealth,

  // Mission Blockchain Endpoints
  getBlockchainAchievements,
  checkBlockchainAchievement,
  getMissionStats,
  getMissionHealth,

  // Score Blockchain Endpoints
  getBlockchainScores,
  getBlockchainLeaderboard,
  getScoreStats,
  getScoreHealth,

  // Economy Blockchain Endpoints
  getBlockchainEconomy,
  getBlockchainStreak,
  getEconomyStats,
  getEconomyHealth

} = require("../controllers/playerController");

// ========== GET ENDPOINTS ==========
router.get("/player/all", getAllPlayerData);
router.get("/player/privy", getPrivyData);
router.get("/player/game", getUserGameData);
router.get("/player/gamemode", getPlayerGameModeData);
router.get("/player/vehicle", getPlayerVehicleData);

// ========== POST ENDPOINTS ==========
router.post("/player/all", updateAllPlayerData);
router.post("/player/privy", updatePrivyData);
router.post("/player/game", updateUserGameData);
router.post("/player/gamemode", updatePlayerGameModeData);
router.post("/player/vehicle", updatePlayerVehicleData);
router.post("/player/login", recordPrivyLogin);

// ========== CAMPAIGN & GALXE ==========
router.get("/check-user-achievement", checkUserAchievement);
router.get("/check-gate-user-achievement/:address?", checkGateUserAchievement);
router.get("/check-gate-user-achievement", checkGateUserAchievement);

// ========== UTILITIES ==========
router.get("/leaderboard", getLeaderboard);
router.get("/leaderboard/gate-wallet", getGateWalletLeaderboard);
router.get("/users", getAllUsers);

// ========== SESSION BLOCKCHAIN ==========
router.get("/blockchain/sessions", getBlockchainSessions);
router.get("/blockchain/session-count", getBlockchainSessionCount);
router.get("/blockchain/stats", getBlockchainStats);
router.get("/blockchain/health", getBlockchainHealth);

// ========== VEHICLE BLOCKCHAIN ==========
router.get("/blockchain/vehicles", getBlockchainVehicles);
router.get("/blockchain/vehicle-history", getVehicleSwitchHistory);
router.get("/blockchain/vehicle-stats", getVehicleStats);
router.get("/blockchain/vehicle-health", getVehicleHealth);

// ========== MISSION BLOCKCHAIN ==========
router.get("/blockchain/achievements", getBlockchainAchievements);
router.get("/blockchain/achievement-check", checkBlockchainAchievement);
router.get("/blockchain/mission-stats", getMissionStats);
router.get("/blockchain/mission-health", getMissionHealth);

// ========== SCORE BLOCKCHAIN ==========
router.get("/blockchain/scores", getBlockchainScores);
router.get("/blockchain/leaderboard", getBlockchainLeaderboard);
router.get("/blockchain/score-stats", getScoreStats);
router.get("/blockchain/score-health", getScoreHealth);

// ========== ECONOMY BLOCKCHAIN ==========
router.get("/blockchain/economy", getBlockchainEconomy);
router.get("/blockchain/streak", getBlockchainStreak);
router.get("/blockchain/economy-stats", getEconomyStats);
router.get("/blockchain/economy-health", getEconomyHealth);

module.exports = router;