const express = require("express");
const router = express.Router();
const {
  // GET endpoints
  getAllPlayerData,
  getPrivyData,
  getUserGameData,
  getPlayerGameModeData,
  getPlayerVehicleData,
  
  // POST endpoints
  updateAllPlayerData,
  updatePrivyData,
  updateUserGameData,
  updatePlayerGameModeData,
  updatePlayerVehicleData,

  // Campaign & Utilities
  checkUserAchievement,
  getLeaderboard,
  getAllUsers
} = require("../controllers/playerController");

// ========== GET ENDPOINTS ==========
// Get complete player data
router.get("/player/all", getAllPlayerData);

// Get specific data categories
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

// ========== UTILITIES ==========
router.get("/leaderboard", getLeaderboard);
router.get("/users", getAllUsers);

module.exports = router;