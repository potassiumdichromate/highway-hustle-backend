const assert = require('node:assert');
const { describe, it, afterEach } = require('node:test');
const blockchainActions = require('../services/blockchainActionsService');
const missionBlockchainService = require('../services/missionBlockchainService');
const scoreBlockchainService = require('../services/scoreBlockchainService');
const economyBlockchainService = require('../services/economyBlockchainService');
const vehicleBlockchainService = require('../services/vehicleBlockchainService');

describe('blockchainActionsService', () => {
  const originalGetPlayerStats = scoreBlockchainService.getPlayerStats;
  const originalGetPlayerEconomy = economyBlockchainService.getPlayerEconomy;
  const originalGetPlayerVehicles = vehicleBlockchainService.getPlayerVehicles;
  const originalHasAchievement = missionBlockchainService.hasAchievement;

  afterEach(() => {
    scoreBlockchainService.getPlayerStats = originalGetPlayerStats;
    economyBlockchainService.getPlayerEconomy = originalGetPlayerEconomy;
    vehicleBlockchainService.getPlayerVehicles = originalGetPlayerVehicles;
    missionBlockchainService.hasAchievement = originalHasAchievement;
  });

  it('reconciles local state with on-chain state and reports mismatches', async () => {
    scoreBlockchainService.getPlayerStats = async () => ({
      success: true,
      stats: {
        bestScoreOneWay: 55,
        bestScoreTwoWay: 0,
        bestScoreTimeAttack: 0,
        bestScoreBomb: 0,
      },
    });

    economyBlockchainService.getPlayerEconomy = async () => ({
      success: true,
      economy: { currentBalance: 100 },
    });

    vehicleBlockchainService.getPlayerVehicles = async () => ({
      success: true,
      vehicles: { 0: false, 1: true },
    });

    missionBlockchainService.hasAchievement = async () => ({
      success: true,
      hasAchievement: false,
    });

    const player = {
      privyData: { walletAddress: '0xabc123' },
      userGameData: { currency: 100 },
      playerGameModeData: { bestScoreOneWay: 50, bestScoreTwoWay: 0, bestScoreTimeAttack: 0, bestScoreBomb: 0 },
      playerVehicleData: { selectedPlayerCarIndex: 1 },
      campaignData: { Achieved1000M: true },
    };

    const result = await blockchainActions.reconcilePlayerState(player);
    assert.ok(result);
    assert.ok(Array.isArray(result.mismatches));
    assert.ok(result.mismatches.length > 0);
  });
});
