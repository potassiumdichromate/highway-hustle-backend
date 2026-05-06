const blockchainService = require("./blockchainService");
const vehicleBlockchainService = require("./vehicleBlockchainService");
const missionBlockchainService = require("./missionBlockchainService");
const scoreBlockchainService = require("./scoreBlockchainService");
const economyBlockchainService = require("./economyBlockchainService");

const extractIdentifier = (playerData) => {
  return (
    playerData?.privyData?.walletAddress ||
    playerData?.privyData?.email ||
    playerData?.privyData?.discord ||
    playerData?.privyData?.telegram ||
    "unknown"
  );
};

const recordSession = async (playerData, sessionType = "all") => {
  try {
    return await blockchainService.recordSession(playerData, sessionType);
  } catch (error) {
    console.error("❌ Blockchain session action failed:", error.message);
    return { success: false, error: error.message };
  }
};

const recordVehicleSwitch = async (playerData, newVehicleIndex) => {
  try {
    return await vehicleBlockchainService.switchVehicle(playerData, newVehicleIndex);
  } catch (error) {
    console.error("❌ Vehicle blockchain action failed:", error.message);
    return { success: false, error: error.message };
  }
};

const recordAchievementUnlock = async (playerData, achievementId) => {
  try {
    return await missionBlockchainService.unlockAchievement(playerData, achievementId);
  } catch (error) {
    console.error("❌ Achievement blockchain action failed:", error.message);
    return { success: false, error: error.message };
  }
};

const recordScoreSubmission = async (playerData, gameModeData) => {
  try {
    return await scoreBlockchainService.submitScore(playerData, gameModeData);
  } catch (error) {
    console.error("❌ Score blockchain action failed:", error.message);
    return { success: false, error: error.message };
  }
};

const recordCurrencyTransaction = async (playerData, oldCurrency, newCurrency) => {
  try {
    const delta = Number(newCurrency) - Number(oldCurrency);
    if (delta === 0) {
      return { success: false, error: "No currency change detected" };
    }

    const transactionType = delta > 0 ? "GameEarning" : "VehiclePurchase";
    const description = delta > 0
      ? `Earned ${delta} currency`
      : `Spent ${Math.abs(delta)} currency`;

    return await economyBlockchainService.recordTransaction(
      playerData,
      transactionType,
      delta,
      description
    );
  } catch (error) {
    console.error("❌ Economy blockchain action failed:", error.message);
    return { success: false, error: error.message };
  }
};

const reconcilePlayerState = async (player) => {
  const identifier = extractIdentifier(player);
  const result = {
    identifier,
    local: {
      currency: player.userGameData?.currency || 0,
      bestScores: player.playerGameModeData || {},
      selectedVehicle: player.playerVehicleData?.selectedPlayerCarIndex ?? 0,
      achievement1000M: player.campaignData?.Achieved1000M || false,
    },
    onChain: {},
    mismatches: [],
  };

  const [economy, scoreStats, vehicleState, achievementState] = await Promise.all([
    economyBlockchainService.getPlayerEconomy(identifier).catch((err) => ({ success: false, error: err.message })),
    scoreBlockchainService.getPlayerStats(identifier).catch((err) => ({ success: false, error: err.message })),
    vehicleBlockchainService.getPlayerVehicles(identifier).catch((err) => ({ success: false, error: err.message })),
    missionBlockchainService.hasAchievement(identifier, "ACHIEVED_1000M").catch((err) => ({ success: false, error: err.message })),
  ]);

  result.onChain.economy = economy;
  result.onChain.scoreStats = scoreStats;
  result.onChain.vehicles = vehicleState;
  result.onChain.achievement1000M = achievementState;

  if (economy?.success) {
    const currentBalance = Number(economy.economy?.currentBalance || 0);
    if (currentBalance !== result.local.currency) {
      result.mismatches.push(`currency ${result.local.currency} != ${currentBalance}`);
    }
  }

  if (scoreStats?.success) {
    const onChainBest = Math.max(
      Number(scoreStats.stats?.bestScoreOneWay || 0),
      Number(scoreStats.stats?.bestScoreTwoWay || 0),
      Number(scoreStats.stats?.bestScoreTimeAttack || 0),
      Number(scoreStats.stats?.bestScoreBomb || 0),
    );
    const localBest = Math.max(
      Number(result.local.bestScores.bestScoreOneWay || 0),
      Number(result.local.bestScores.bestScoreTwoWay || 0),
      Number(result.local.bestScores.bestScoreTimeAttack || 0),
      Number(result.local.bestScores.bestScoreBomb || 0),
    );
    if (onChainBest !== localBest) {
      result.mismatches.push(`bestScore ${localBest} != ${onChainBest}`);
    }
  }

  if (vehicleState?.success && vehicleState.vehicles) {
    const selectedOnChain = Object.values(vehicleState.vehicles).findIndex(Boolean);
    if (selectedOnChain !== result.local.selectedVehicle) {
      result.mismatches.push(`vehicle ${result.local.selectedVehicle} != ${selectedOnChain}`);
    }
  }

  if (achievementState?.success) {
    if (achievementState.hasAchievement !== result.local.achievement1000M) {
      result.mismatches.push(`achievement1000M ${result.local.achievement1000M} != ${achievementState.hasAchievement}`);
    }
  }

  return result;
};

module.exports = {
  recordSession,
  recordVehicleSwitch,
  recordAchievementUnlock,
  recordScoreSubmission,
  recordCurrencyTransaction,
  reconcilePlayerState,
};
