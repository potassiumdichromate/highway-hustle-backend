const legacy = require("./playerController");

module.exports = {
  getAllPlayerData: legacy.getAllPlayerData,
  getPrivyData: legacy.getPrivyData,
  getUserGameData: legacy.getUserGameData,
  getPlayerGameModeData: legacy.getPlayerGameModeData,
  getPlayerVehicleData: legacy.getPlayerVehicleData,
  updateAllPlayerData: legacy.updateAllPlayerData,
  updatePrivyData: legacy.updatePrivyData,
  updateUserGameData: legacy.updateUserGameData,
  updatePlayerGameModeData: legacy.updatePlayerGameModeData,
  updatePlayerVehicleData: legacy.updatePlayerVehicleData,
};
