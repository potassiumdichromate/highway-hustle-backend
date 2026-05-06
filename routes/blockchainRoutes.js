const express = require("express");
const router = express.Router();
const {
  getBlockchainSessions,
  getBlockchainSessionCount,
  getBlockchainStats,
  getBlockchainHealth,
  getBlockchainVehicles,
  getVehicleSwitchHistory,
  getVehicleStats,
  getVehicleHealth,
  getBlockchainAchievements,
  checkBlockchainAchievement,
  getMissionStats,
  getMissionHealth,
  getBlockchainScores,
  getBlockchainLeaderboard,
  getScoreStats,
  getScoreHealth,
  getBlockchainEconomy,
  getBlockchainStreak,
  getEconomyStats,
  getEconomyHealth,
  reconcilePlayerState,
} = require("../controllers/blockchainController");

router.get("/blockchain/sessions", getBlockchainSessions);
router.get("/blockchain/session-count", getBlockchainSessionCount);
router.get("/blockchain/stats", getBlockchainStats);
router.get("/blockchain/health", getBlockchainHealth);

router.get("/blockchain/vehicles", getBlockchainVehicles);
router.get("/blockchain/vehicle-history", getVehicleSwitchHistory);
router.get("/blockchain/vehicle-stats", getVehicleStats);
router.get("/blockchain/vehicle-health", getVehicleHealth);

router.get("/blockchain/achievements", getBlockchainAchievements);
router.get("/blockchain/achievement-check", checkBlockchainAchievement);
router.get("/blockchain/mission-stats", getMissionStats);
router.get("/blockchain/mission-health", getMissionHealth);

router.get("/blockchain/scores", getBlockchainScores);
router.get("/blockchain/leaderboard", getBlockchainLeaderboard);
router.get("/blockchain/score-stats", getScoreStats);
router.get("/blockchain/score-health", getScoreHealth);

router.get("/blockchain/economy", getBlockchainEconomy);
router.get("/blockchain/streak", getBlockchainStreak);
router.get("/blockchain/economy-stats", getEconomyStats);
router.get("/blockchain/economy-health", getEconomyHealth);
router.get("/blockchain/reconcile", reconcilePlayerState);

module.exports = router;
