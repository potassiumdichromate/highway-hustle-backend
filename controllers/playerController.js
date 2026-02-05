const PlayerState = require("../models/PlayerState");
const blockchainService = require("../services/blockchainService");
const vehicleBlockchainService = require("../services/vehicleBlockchainService");
const missionBlockchainService = require("../services/missionBlockchainService");
const scoreBlockchainService = require("../services/scoreBlockchainService");
const economyBlockchainService = require("../services/economyBlockchainService");

// ========== HELPER: Find User by Any Privy Field ==========
const findUserByIdentifier = async (identifier) => {
  if (!identifier) return null;
  
  const cleanIdentifier = identifier.toLowerCase().trim();
  
  return await PlayerState.findOne({
    $or: [
      { 'privyData.walletAddress': cleanIdentifier },
      { 'privyData.discord': cleanIdentifier },
      { 'privyData.telegram': cleanIdentifier },
      { 'privyData.email': cleanIdentifier }
    ]
  });
};

// ========== HELPER: Create Default Player ==========
const createDefaultPlayer = async (identifier) => {
  const newPlayer = {
    privyData: {
      type: 'unknown',
      recordedAt: new Date()
    },
    userGameData: {
      playerName: "Unnamed",
      currency: 20000,
      lastWeekCurrency: 0,
      totalPlayedTime: 0.0
    },
    playerGameModeData: {
      bestScoreOneWay: 0,
      bestScoreTwoWay: 0,
      bestScoreTimeAttack: 0,
      bestScoreBomb: 0
    },
    playerVehicleData: {
      selectedPlayerCarIndex: 0,
      JeepOwned: 1,
      VanOwned: 0,
      SierraOwned: 0,
      SedanOwned: 0,
      LamborghiniOwned: 0
    },
    campaignData: {
      Achieved1000M: false
    },
    lastUpdated: new Date()
  };

  // Determine identifier type and assign
  const cleanId = identifier.toLowerCase().trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(cleanId)) {
    newPlayer.privyData.walletAddress = cleanId;
  } else if (cleanId.includes('@')) {
    newPlayer.privyData.email = cleanId;
  } else if (cleanId.startsWith('@')) {
    newPlayer.privyData.telegram = cleanId;
  } else {
    newPlayer.privyData.discord = cleanId;
  }

  return await PlayerState.create(newPlayer);
};

const normalizeIdentifier = (value) => {
  if (!value || typeof value !== "string") return null;
  return value.toLowerCase().trim();
};

const getIdentifierCandidate = (body) => {
  return (
    normalizeIdentifier(body.identifier) ||
    normalizeIdentifier(body?.privyMetaData?.address) ||
    normalizeIdentifier(body?.privyMetaData?.email) ||
    normalizeIdentifier(body?.privyMetaData?.discord) ||
    normalizeIdentifier(body.homeWalletAddress) ||
    normalizeIdentifier(body.walletAddress)
  );
};

const determinePrivyType = (meta = {}, walletCandidate) => {
  if (meta.type) return meta.type;
  if (meta.discordId) return 'discordId';
  if (meta.discord) return 'discord';
  if (meta.telegram) return 'telegram';
  if (walletCandidate) return 'walletAddress';
  if (meta.email) return 'email';
  return 'unknown';
};

const applyPrivyMetaData = (player, meta = {}) => {
  const now = new Date();
  if (!player.privyData) {
    player.privyData = {};
  }

  const walletCandidate =
    normalizeIdentifier(meta.address) || normalizeIdentifier(meta.walletAddress);
  if (walletCandidate) {
    player.privyData.walletAddress = walletCandidate;
  }

  const setIfNormalized = (field, value) => {
    if (value !== undefined && value !== null) {
      const normalized = normalizeIdentifier(value);
      if (normalized) {
        player.privyData[field] = normalized;
      }
    }
  };

  if (meta.email) setIfNormalized('email', meta.email);
  if (meta.discordId) player.privyData.discordId = meta.discordId;
  if (meta.discord) player.privyData.discord = meta.discord;
  if (meta.telegram) player.privyData.telegram = meta.telegram;
  if (meta.providerName) player.privyData.providerName = meta.providerName;
  if (meta.chainId) player.privyData.chainId = meta.chainId;
  if (meta.privyUserId) player.privyData.privyUserId = meta.privyUserId;

  player.privyData.type = determinePrivyType(meta, walletCandidate);
  player.privyData.recordedAt = now;
  player.lastUpdated = now;
};

const sanitizePlayerForClient = (player) => {
  if (!player) return null;
  const sanitized = player.toObject ? player.toObject() : { ...player };
  return sanitized;
};

// ========== BLOCKCHAIN HELPERS ==========

// Session recording helper
const recordBlockchainSession = async (playerData, sessionType) => {
  try {
    blockchainService.recordSession(playerData, sessionType)
      .then(result => {
        if (result.success) {
          console.log(`✅ Blockchain session recorded: ${result.txHash}`);
        } else {
          console.log(`⚠️  Blockchain recording failed: ${result.error}`);
        }
      })
      .catch(err => {
        console.error(`❌ Blockchain error: ${err.message}`);
      });
  } catch (error) {
    console.error(`❌ Blockchain session error: ${error.message}`);
  }
};

// Vehicle switch helper
const recordVehicleSwitch = async (playerData, newVehicleIndex) => {
  try {
    vehicleBlockchainService.switchVehicle(playerData, newVehicleIndex)
      .then(result => {
        if (result.success) {
          console.log(`✅ Vehicle switch recorded: ${result.txHash}`);
        } else {
          console.log(`⚠️  Vehicle switch failed: ${result.error}`);
        }
      })
      .catch(err => {
        console.error(`❌ Vehicle blockchain error: ${err.message}`);
      });
  } catch (error) {
    console.error(`❌ Vehicle switch error: ${error.message}`);
  }
};

// Achievement unlock helper
const recordAchievementUnlock = async (playerData, achievementId) => {
  try {
    missionBlockchainService.unlockAchievement(playerData, achievementId)
      .then(result => {
        if (result.success) {
          console.log(`✅ Achievement recorded: ${result.txHash}`);
        } else {
          console.log(`⚠️  Achievement unlock failed: ${result.error}`);
        }
      })
      .catch(err => {
        console.error(`❌ Achievement blockchain error: ${err.message}`);
      });
  } catch (error) {
    console.error(`❌ Achievement unlock error: ${error.message}`);
  }
};

// Score submission helper
const recordScoreSubmission = async (playerData, gameModeData) => {
  try {
    scoreBlockchainService.submitScore(playerData, gameModeData)
      .then(result => {
        if (result.success) {
          console.log(`✅ Score recorded: ${result.txHash}`);
        } else {
          console.log(`⚠️  Score submission failed: ${result.error}`);
        }
      })
      .catch(err => {
        console.error(`❌ Score blockchain error: ${err.message}`);
      });
  } catch (error) {
    console.error(`❌ Score submission error: ${error.message}`);
  }
};

// Currency transaction helper
const recordCurrencyTransaction = async (playerData, oldCurrency, newCurrency) => {
  try {
    const difference = newCurrency - oldCurrency;
    if (difference === 0) return;

    const transactionType = difference > 0 ? "GameEarning" : "VehiclePurchase";
    const description = difference > 0 
      ? `Earned ${difference} currency` 
      : `Spent ${Math.abs(difference)} currency`;

    economyBlockchainService.recordTransaction(playerData, transactionType, difference, description)
      .then(result => {
        if (result.success) {
          console.log(`✅ Transaction recorded: ${result.txHash}`);
        } else {
          console.log(`⚠️  Transaction failed: ${result.error}`);
        }
      })
      .catch(err => {
        console.error(`❌ Economy blockchain error: ${err.message}`);
      });
  } catch (error) {
    console.error(`❌ Currency transaction error: ${error.message}`);
  }
};

// ========== POST: RECORD PRIVY LOGIN ==========
exports.recordPrivyLogin = async (req, res) => {
  try {
    const { privyMetaData = {} } = req.body;
    const identifier = getIdentifierCandidate(req.body);

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: "Missing identifier information (wallet/email/discord)",
      });
    }

    let player = await findUserByIdentifier(identifier);

    if (!player) {
      player = await createDefaultPlayer(identifier);
      console.log(`🆕 New player created during login for: ${identifier}`);
    }

    applyPrivyMetaData(player, privyMetaData);
    await player.save();

    res.json({
      success: true,
    });
  } catch (err) {
    console.error("❌ Error recording privy login:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: ALL PLAYER DATA (WITH BLOCKCHAIN) ==========
exports.getAllPlayerData = async (req, res) => {
  try {
    const { user } = req.query;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    let player = await findUserByIdentifier(user);
    
    if (!player) {
      player = await createDefaultPlayer(user);
      console.log(`🆕 New player created for: ${user}`);
    }

    // Record session on blockchain (async)
    recordBlockchainSession(player, "all");

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({ 
      success: true, 
      data: sanitizePlayerForClient(player) 
    });
  } catch (err) {
    console.error("❌ Error getting all player data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: PRIVY DATA (WITH BLOCKCHAIN) ==========
exports.getPrivyData = async (req, res) => {
  try {
    const { user } = req.query;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: "Player not found" 
      });
    }

    // Record session on blockchain
    recordBlockchainSession(player, "privy");

    res.json({ 
      success: true, 
      data: player.privyData 
    });
  } catch (err) {
    console.error("❌ Error getting privy data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: USER GAME DATA (WITH BLOCKCHAIN) ==========
exports.getUserGameData = async (req, res) => {
  try {
    const { user } = req.query;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: "Player not found" 
      });
    }

    // Record session on blockchain
    recordBlockchainSession(player, "game");

    res.json({ 
      success: true, 
      data: player.userGameData 
    });
  } catch (err) {
    console.error("❌ Error getting user game data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: PLAYER GAME MODE DATA (WITH BLOCKCHAIN) ==========
exports.getPlayerGameModeData = async (req, res) => {
  try {
    const { user } = req.query;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: "Player not found" 
      });
    }

    // Record session on blockchain
    recordBlockchainSession(player, "gamemode");

    res.json({ 
      success: true, 
      data: player.playerGameModeData 
    });
  } catch (err) {
    console.error("❌ Error getting player game mode data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: PLAYER VEHICLE DATA (WITH BLOCKCHAIN) ==========
exports.getPlayerVehicleData = async (req, res) => {
  try {
    const { user } = req.query;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: "Player not found" 
      });
    }

    // Record session on blockchain
    recordBlockchainSession(player, "vehicle");

    res.json({ 
      success: true, 
      data: player.playerVehicleData 
    });
  } catch (err) {
    console.error("❌ Error getting player vehicle data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== POST: UPDATE ALL PLAYER DATA (WITH BLOCKCHAIN) ==========
exports.updateAllPlayerData = async (req, res) => {
  try {
    const { user } = req.query;
    const updateData = req.body;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    // Remove system fields
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: "Player not found. Use GET to create player first." 
      });
    }

    // Track changes for blockchain
    const oldCurrency = player.userGameData.currency;
    const oldVehicleIndex = player.playerVehicleData.selectedPlayerCarIndex;
    const oldAchievement = player.campaignData?.Achieved1000M;

    // Merge updates
    if (updateData.privyData) Object.assign(player.privyData, updateData.privyData);
    if (updateData.userGameData) Object.assign(player.userGameData, updateData.userGameData);
    if (updateData.playerGameModeData) Object.assign(player.playerGameModeData, updateData.playerGameModeData);
    if (updateData.playerVehicleData) Object.assign(player.playerVehicleData, updateData.playerVehicleData);
    if (updateData.campaignData) Object.assign(player.campaignData, updateData.campaignData);

    player.lastUpdated = new Date();
    await player.save();

    // Record blockchain changes asynchronously
    
    // Currency change
    const newCurrency = player.userGameData.currency;
    if (newCurrency !== oldCurrency) {
      recordCurrencyTransaction(player, oldCurrency, newCurrency);
    }

    // Vehicle switch
    const newVehicleIndex = player.playerVehicleData.selectedPlayerCarIndex;
    if (newVehicleIndex !== oldVehicleIndex) {
      recordVehicleSwitch(player, newVehicleIndex);
    }

    // Achievement unlock
    const newAchievement = player.campaignData?.Achieved1000M;
    if (newAchievement && !oldAchievement) {
      recordAchievementUnlock(player, "ACHIEVED_1000M");
    }

    // Score submission (if any score changed)
    if (updateData.playerGameModeData) {
      recordScoreSubmission(player, player.playerGameModeData);
    }

    res.json({ 
      success: true, 
      data: sanitizePlayerForClient(player) 
    });
  } catch (err) {
    console.error("❌ Error updating all player data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== POST: UPDATE PRIVY DATA ==========
exports.updatePrivyData = async (req, res) => {
  try {
    const { user } = req.query;
    const updateData = req.body;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: "Player not found" 
      });
    }

    Object.assign(player.privyData, updateData);
    player.lastUpdated = new Date();
    await player.save();

    res.json({ 
      success: true, 
      data: player.privyData 
    });
  } catch (err) {
    console.error("❌ Error updating privy data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== POST: UPDATE USER GAME DATA (WITH BLOCKCHAIN) ==========
exports.updateUserGameData = async (req, res) => {
  try {
    const { user } = req.query;
    const updateData = req.body;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: "Player not found" 
      });
    }

    // Ensure float for totalPlayedTime
    if (updateData.totalPlayedTime !== undefined) {
      updateData.totalPlayedTime = parseFloat(updateData.totalPlayedTime);
    }

    // Check currency change
    const oldCurrency = player.userGameData.currency;
    const newCurrency = updateData.currency !== undefined ? updateData.currency : oldCurrency;

    if (newCurrency !== oldCurrency) {
      // Record currency transaction on blockchain
      recordCurrencyTransaction(player, oldCurrency, newCurrency);
    }

    Object.assign(player.userGameData, updateData);
    player.lastUpdated = new Date();
    await player.save();

    res.json({ 
      success: true, 
      data: player.userGameData 
    });
  } catch (err) {
    console.error("❌ Error updating user game data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== POST: UPDATE PLAYER GAME MODE DATA (WITH BLOCKCHAIN) ==========
exports.updatePlayerGameModeData = async (req, res) => {
  try {
    const { user } = req.query;
    const updateData = req.body;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: "Player not found" 
      });
    }

    // Check if any score improved
    const oldScores = { ...player.playerGameModeData };
    Object.assign(player.playerGameModeData, updateData);

    const scoresChanged = 
      (updateData.bestScoreOneWay && updateData.bestScoreOneWay > oldScores.bestScoreOneWay) ||
      (updateData.bestScoreTwoWay && updateData.bestScoreTwoWay > oldScores.bestScoreTwoWay) ||
      (updateData.bestScoreTimeAttack && updateData.bestScoreTimeAttack > oldScores.bestScoreTimeAttack) ||
      (updateData.bestScoreBomb && updateData.bestScoreBomb > oldScores.bestScoreBomb);

    if (scoresChanged) {
      // Record score on blockchain
      recordScoreSubmission(player, player.playerGameModeData);
    }

    player.lastUpdated = new Date();
    await player.save();

    res.json({ 
      success: true, 
      data: player.playerGameModeData 
    });
  } catch (err) {
    console.error("❌ Error updating player game mode data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== POST: UPDATE PLAYER VEHICLE DATA (WITH BLOCKCHAIN) ==========
exports.updatePlayerVehicleData = async (req, res) => {
  try {
    const { user } = req.query;
    const updateData = req.body;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: "Player not found" 
      });
    }

    // Check if vehicle is being switched
    const oldVehicleIndex = player.playerVehicleData.selectedPlayerCarIndex;
    const newVehicleIndex = updateData.selectedPlayerCarIndex;

    if (newVehicleIndex !== undefined && newVehicleIndex !== oldVehicleIndex) {
      // Record vehicle switch on blockchain
      recordVehicleSwitch(player, newVehicleIndex);
    }

    Object.assign(player.playerVehicleData, updateData);
    player.lastUpdated = new Date();
    await player.save();

    res.json({ 
      success: true, 
      data: player.playerVehicleData 
    });
  } catch (err) {
    console.error("❌ Error updating player vehicle data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== CAMPAIGN: Check Achievement (Galxe Integration) ==========
exports.checkUserAchievement = async (req, res) => {
  try {
    const { user } = req.query;
    
    if (!user) {
      return res.status(200).json({
        message: "failed, missing user parameter",
        code: 200,
        data: {
          Achieved1000M: false
        }
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.status(200).json({
        message: "failed, user doesn't qualified",
        code: 200,
        data: {
          Achieved1000M: false
        }
      });
    }

    const achieved = player.campaignData?.Achieved1000M || false;

    if (achieved) {
      return res.status(200).json({
        message: "successful",
        code: 200,
        data: {
          Achieved1000M: true
        }
      });
    } else {
      return res.status(200).json({
        message: "failed, user doesn't qualified",
        code: 200,
        data: {
          Achieved1000M: false
        }
      });
    }
  } catch (err) {
    console.error("❌ Error checking user achievement:", err);
    res.status(200).json({
      message: "failed, server error",
      code: 200,
      data: {
        Achieved1000M: false
      }
    });
  }
};

// ========== CAMPAIGN: Check Achievement (Gate Integration) ==========
exports.checkGateUserAchievement = async (req, res) => {
  try {
    const addressParam = req.params.address || req.params.user;
    const queryParam = req.query.user || req.query.address;
    const user = normalizeIdentifier(addressParam || queryParam);

    if (!user) {
      return res.status(400).json({
        message: "failed, missing user parameter",
        code: 400,
        data: {
          Achieved1000M: false,
          result: false
        }
      });
    }

    const player = await findUserByIdentifier(user);

    if (!player) {
      return res.status(404).json({
        message: "failed, user doesn't qualified",
        code: 404,
        data: {
          Achieved1000M: false,
          result: false
        }
      });
    }

    const achieved = player.campaignData?.Achieved1000M || false;

    if (achieved) {
      return res.status(200).json({
        message: "successful",
        code: 200,
        data: {
          Achieved1000M: true,
          result: true
        }
      });
    }

    return res.status(404).json({
      message: "failed, user doesn't qualified",
      code: 404,
      data: {
        Achieved1000M: false,
        result: false
      }
    });
  } catch (err) {
    console.error("❌ Error checking gate user achievement:", err);
    return res.status(500).json({
      message: "failed, server error",
      code: 500,
      data: {
        Achieved1000M: false,
        result: false
      }
    });
  }
};

// ========== LEADERBOARD & UTILITIES ==========
exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await PlayerState.find()
      .sort({ 'userGameData.currency': -1 })
      .limit(10)
      .select('privyData.walletAddress userGameData.playerName userGameData.currency');
    
    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error("❌ Error getting leaderboard:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await PlayerState.find()
      .sort({ 'userGameData.currency': -1 })
      .select('privyData.walletAddress userGameData.playerName userGameData.currency');
    
    res.json({ success: true, users });
  } catch (err) {
    console.error("❌ Error getting all users:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getGateWalletLeaderboard = async (req, res) => {
  try {
    const leaderboard = await PlayerState.find({ 'privyData.type': 'gate_wallet' })
      .sort({ 'userGameData.currency': -1 })
      .limit(10)
      .select(
        'privyData.walletAddress privyData.discord privyData.discordId privyData.telegram privyData.email userGameData.playerName userGameData.currency'
      );

    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error("❌ Error getting gate wallet leaderboard:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== SESSION BLOCKCHAIN ENDPOINTS ==========
exports.getBlockchainSessions = async (req, res) => {
  try {
    const { user } = req.query;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const result = await blockchainService.getPlayerSessions(user);
    
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting blockchain sessions:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBlockchainSessionCount = async (req, res) => {
  try {
    const { user } = req.query;
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing 'user' parameter" 
      });
    }

    const result = await blockchainService.getPlayerSessionCount(user);
    
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting blockchain session count:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBlockchainStats = async (req, res) => {
  try {
    const result = await blockchainService.getContractStats();
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting blockchain stats:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBlockchainHealth = async (req, res) => {
  try {
    const result = await blockchainService.healthCheck();
    res.json(result);
  } catch (err) {
    console.error("❌ Error checking blockchain health:", err);
    res.status(500).json({ healthy: false, error: err.message });
  }
};

// ========== VEHICLE BLOCKCHAIN ENDPOINTS ==========
exports.getBlockchainVehicles = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) {
      return res.status(400).json({ success: false, error: "Missing 'user' parameter" });
    }

    const result = await vehicleBlockchainService.getPlayerVehicles(user);
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting blockchain vehicles:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVehicleSwitchHistory = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) {
      return res.status(400).json({ success: false, error: "Missing 'user' parameter" });
    }

    const result = await vehicleBlockchainService.getPlayerSwitchHistory(user);
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting switch history:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVehicleStats = async (req, res) => {
  try {
    const result = await vehicleBlockchainService.getStats();
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting vehicle stats:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVehicleHealth = async (req, res) => {
  try {
    const result = await vehicleBlockchainService.healthCheck();
    res.json(result);
  } catch (err) {
    console.error("❌ Error checking vehicle health:", err);
    res.status(500).json({ healthy: false, error: err.message });
  }
};

// ========== MISSION BLOCKCHAIN ENDPOINTS ==========
exports.getBlockchainAchievements = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) {
      return res.status(400).json({ success: false, error: "Missing 'user' parameter" });
    }

    const result = await missionBlockchainService.getPlayerAchievements(user);
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting blockchain achievements:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.checkBlockchainAchievement = async (req, res) => {
  try {
    const { user, achievementId } = req.query;
    if (!user || !achievementId) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    const result = await missionBlockchainService.hasAchievement(user, achievementId);
    res.json(result);
  } catch (err) {
    console.error("❌ Error checking blockchain achievement:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getMissionStats = async (req, res) => {
  try {
    const result = await missionBlockchainService.getStats();
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting mission stats:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getMissionHealth = async (req, res) => {
  try {
    const result = await missionBlockchainService.healthCheck();
    res.json(result);
  } catch (err) {
    console.error("❌ Error checking mission health:", err);
    res.status(500).json({ healthy: false, error: err.message });
  }
};

// ========== SCORE BLOCKCHAIN ENDPOINTS ==========
exports.getBlockchainScores = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) {
      return res.status(400).json({ success: false, error: "Missing 'user' parameter" });
    }

    const result = await scoreBlockchainService.getPlayerStats(user);
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting blockchain scores:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBlockchainLeaderboard = async (req, res) => {
  try {
    const { gameMode = 0, topN = 10 } = req.query;
    const result = await scoreBlockchainService.getLeaderboard(parseInt(gameMode), parseInt(topN));
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting blockchain leaderboard:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getScoreStats = async (req, res) => {
  try {
    const result = await scoreBlockchainService.getStats();
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting score stats:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getScoreHealth = async (req, res) => {
  try {
    const result = await scoreBlockchainService.healthCheck();
    res.json(result);
  } catch (err) {
    console.error("❌ Error checking score health:", err);
    res.status(500).json({ healthy: false, error: err.message });
  }
};

// ========== ECONOMY BLOCKCHAIN ENDPOINTS ==========
exports.getBlockchainEconomy = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) {
      return res.status(400).json({ success: false, error: "Missing 'user' parameter" });
    }

    const result = await economyBlockchainService.getPlayerEconomy(user);
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting blockchain economy:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBlockchainStreak = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) {
      return res.status(400).json({ success: false, error: "Missing 'user' parameter" });
    }

    const result = await economyBlockchainService.getDailyStreak(user);
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting blockchain streak:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getEconomyStats = async (req, res) => {
  try {
    const result = await economyBlockchainService.getStats();
    res.json(result);
  } catch (err) {
    console.error("❌ Error getting economy stats:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getEconomyHealth = async (req, res) => {
  try {
    const result = await economyBlockchainService.healthCheck();
    res.json(result);
  } catch (err) {
    console.error("❌ Error checking economy health:", err);
    res.status(500).json({ healthy: false, error: err.message });
  }
};