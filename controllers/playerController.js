const PlayerState = require("../models/PlayerState");
const blockchainService = require("../services/blockchainService");
const vehicleBlockchainService = require("../services/vehicleBlockchainService");
const missionBlockchainService = require("../services/missionBlockchainService");
const scoreBlockchainService = require("../services/scoreBlockchainService");
const economyBlockchainService = require("../services/economyBlockchainService");
const blockchainActions = require("../services/blockchainActionsService");
const daSnapshotService = require("../services/daSnapshotService");
const { generateLeaderboardComment } = require("../services/aiCommentService");
const zerogDAService = require("../services/zerogDAService");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../middleware/auth");
const { classifyCrossGamePerformance } = require("../utils/crossGameDifficulty");
const { queueWarzoneGunReward } = require("../services/warzoneGunRewardClient");

const buildHighwayHustleCrossGame = (points) => (
  classifyCrossGamePerformance('highwayHustle', points)
);

const withHighwayHustleCrossGame = (userGameData) => ({
  ...(userGameData?.toObject ? userGameData.toObject() : userGameData),
  crossGame: buildHighwayHustleCrossGame(userGameData?.currency),
});

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

const issueBrowserJwt = (player, identifier) => {
  const secret = getJwtSecret();
  const expiresIn = process.env.BROWSER_JWT_EXPIRES_IN || "2h";

  const walletAddress = normalizeIdentifier(player?.privyData?.walletAddress);
  const subject = walletAddress || normalizeIdentifier(identifier) || "unknown";

  const token = jwt.sign(
    {
      walletAddress: walletAddress || undefined,
      identifier: subject,
      source: "backend_login",
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn,
      subject,
    },
  );

  return { token, expiresIn };
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
  if (sanitized.userGameData) {
    sanitized.userGameData = withHighwayHustleCrossGame(sanitized.userGameData);
  }
  return sanitized;
};

const sendServerError = (res, context, err) => {
  console.error(`❌ ${context}:`, err);
  return res.status(500).json({
    success: false,
    error: "Internal server error",
    code: "INTERNAL_ERROR"
  });
};

// ========== 0G DA: SUBMIT PLAYER EVENT TO DA GATEWAY ==========
// Fire-and-forget: runs after response is sent, never blocks the API.
// Submits a game event to the configured DA gateway and persists retry metadata.
const saveDASnapshot = (player, trigger) => {
  daSnapshotService.submitSnapshotAsync(player, trigger);
};

// ========== BLOCKCHAIN RESILIENCE WRAPPER ==========
// Wraps any blockchain call with a timeout. Returns null if blockchain is down or times out.
const safeBlockchainCall = async (fn, timeoutMs = 5000) => {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Blockchain timeout')), timeoutMs)
    );
    return await Promise.race([fn(), timeout]);
  } catch (error) {
    console.warn(`⚠️ Blockchain unavailable: ${error.message}`);
    return null;
  }
};

const recordBlockchainSession = async (playerData, sessionType) => blockchainActions.recordSession(playerData, sessionType);

/** Fire-and-forget SESSION_CONTRACT recordSession — does not block the HTTP response. */
const queueSessionOnChain = (player, sessionType) => {
  void safeBlockchainCall(() => recordBlockchainSession(player, sessionType), 300000)
    .then((result) => {
      if (result?.success) {
        console.log(`[onchain] session recorded (${sessionType}) tx=${result.txHash}`);
        return;
      }
      if (result === null) {
        console.warn(`[onchain] session skipped (${sessionType}): timeout or chain unavailable`);
        return;
      }
      console.warn(`[onchain] session failed (${sessionType}):`, result.error || result);
    })
    .catch((err) => {
      console.warn(`[onchain] session error (${sessionType}):`, err.message);
    });
};
const recordVehicleSwitch = async (playerData, newVehicleIndex) => blockchainActions.recordVehicleSwitch(playerData, newVehicleIndex);
const recordAchievementUnlock = async (playerData, achievementId) => blockchainActions.recordAchievementUnlock(playerData, achievementId);
const recordScoreSubmission = async (playerData, gameModeData) => blockchainActions.recordScoreSubmission(playerData, gameModeData);
const recordCurrencyTransaction = async (playerData, oldCurrency, newCurrency) => blockchainActions.recordCurrencyTransaction(playerData, oldCurrency, newCurrency);

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

    // SESSION_CONTRACT_ADDRESS — async; response is not blocked by tx confirmation.
    queueSessionOnChain(player, "login");

    const auth = issueBrowserJwt(player, identifier);

    res.json({
      success: true,
      data: {
        token: auth.token,
        expiresIn: auth.expiresIn,
        walletAddress: normalizeIdentifier(player?.privyData?.walletAddress) || null,
      },
    });
  } catch (err) {
    console.error("❌ Error recording privy login:", err);
    return sendServerError(res, "PlayerController", err);
  }
};

// ========== POST: RECORD AUTO LOGIN (BROWSER JWT) ==========
exports.recordAutoLogin = async (req, res) => {
  try {
    const { jwt: browserToken, source } = req.body;
    
    if (source !== "browser") {
      return res.status(401).json({ success: false, message: "invalid request" });
    }

    if (!browserToken) {
      return res.status(400).json({ success: false, message: "missing jwt token" });
    }

    const secret = getJwtSecret();
    let decodedData;
    try {
      decodedData = jwt.verify(browserToken, secret, { algorithms: ['HS256'] });
    } catch (e) {
      return res.status(401).json({ success: false, message: "invalid token" });
    }

    const walletFromJwt = normalizeIdentifier(decodedData?.walletAddress);
    if (!walletFromJwt) {
      return res.status(400).json({ success: false, message: "invalid walletAddress in token" });
    }

    let player = await findUserByIdentifier(walletFromJwt);

    if (!player) {
      player = await createDefaultPlayer(walletFromJwt);
      console.log(`🆕 New player created during auto login for: ${walletFromJwt}`);
    }

    if (req.body.privyMetaData) {
      applyPrivyMetaData(player, req.body.privyMetaData);
    } else {
      player.lastUpdated = new Date();
    }
    
    await player.save();

    queueSessionOnChain(player, "auto_login");

    res.json({
      success: true,
      data: sanitizePlayerForClient(player),
    });
  } catch (err) {
    console.error("❌ Error recording auto login:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: ALL PLAYER DATA (WITH BLOCKCHAIN) - UPDATED ==========
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

// ========== GET: PRIVY DATA (WITH BLOCKCHAIN) - UPDATED ==========
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

    res.json({
      success: true,
      data: player.privyData
    });
  } catch (err) {
    console.error("❌ Error getting privy data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: USER GAME DATA (WITH BLOCKCHAIN) - UPDATED ==========
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

    res.json({
      success: true,
      data: withHighwayHustleCrossGame(player.userGameData)
    });
  } catch (err) {
    console.error("❌ Error getting user game data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: PLAYER GAME MODE DATA (WITH BLOCKCHAIN) - UPDATED ==========
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

    res.json({
      success: true,
      data: player.playerGameModeData
    });
  } catch (err) {
    console.error("❌ Error getting player game mode data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: PLAYER VEHICLE DATA (WITH BLOCKCHAIN) - UPDATED ==========
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

    res.json({
      success: true,
      data: player.playerVehicleData
    });
  } catch (err) {
    console.error("❌ Error getting player vehicle data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== POST: UPDATE ALL PLAYER DATA (WITH BLOCKCHAIN) - UPDATED ==========
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

    // NEW: Collect all blockchain results
    const blockchainResults = {};

    // Currency change
    const newCurrency = player.userGameData.currency;
    if (newCurrency !== oldCurrency) {
      blockchainResults.currency = await safeBlockchainCall(() => recordCurrencyTransaction(player, oldCurrency, newCurrency));
    }

    // Vehicle switch
    const newVehicleIndex = player.playerVehicleData.selectedPlayerCarIndex;
    if (newVehicleIndex !== oldVehicleIndex) {
      blockchainResults.vehicle = await safeBlockchainCall(() => recordVehicleSwitch(player, newVehicleIndex));
    }

    // Achievement unlock
    const newAchievement = player.campaignData?.Achieved1000M;
    if (newAchievement && !oldAchievement) {
      blockchainResults.achievement = await safeBlockchainCall(() => recordAchievementUnlock(player, "ACHIEVED_1000M"));
      // 0G DA (original): milestone snapshot when Achieved1000M flips on
      saveDASnapshot(player, 'achievement');
    }

    // Score submission
    if (updateData.playerGameModeData) {
      blockchainResults.score = await safeBlockchainCall(() => recordScoreSubmission(player, player.playerGameModeData));
    }

    // 0G DA (added): full state snapshot on every successful POST /player/all (event: player.snapshot).
    // Achievement path above still sends achievement.unlock separately when Achieved1000M flips.
    saveDASnapshot(player, 'full');
    queueWarzoneGunReward({
      walletAddress: player.privyData?.walletAddress || user,
      sourceGame: "highwayHustle",
      crossGame: buildHighwayHustleCrossGame(player.userGameData.currency),
      source: "player.all.save",
    });

    const hasBlockchainResults = Object.keys(blockchainResults).length > 0;
    res.json({
      success: true,
      data: sanitizePlayerForClient(player),
      ...(hasBlockchainResults && { blockchain: blockchainResults })
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

// ========== POST: UPDATE USER GAME DATA (WITH BLOCKCHAIN) - UPDATED ==========
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

    if (updateData.totalPlayedTime !== undefined) {
      updateData.totalPlayedTime = parseFloat(updateData.totalPlayedTime);
    }

    const oldCurrency = player.userGameData.currency;
    const newCurrency = updateData.currency !== undefined ? updateData.currency : oldCurrency;

    let blockchainResult = null;
    if (newCurrency !== oldCurrency) {
      blockchainResult = await safeBlockchainCall(() => recordCurrencyTransaction(player, oldCurrency, newCurrency));
    }

    Object.assign(player.userGameData, updateData);
    player.lastUpdated = new Date();
    await player.save();
    queueWarzoneGunReward({
      walletAddress: player.privyData?.walletAddress || user,
      sourceGame: "highwayHustle",
      crossGame: buildHighwayHustleCrossGame(player.userGameData.currency),
      source: "player.game.save",
    });

    res.json({
      success: true,
      data: withHighwayHustleCrossGame(player.userGameData),
      ...(blockchainResult !== null && { blockchain: blockchainResult })
    });
  } catch (err) {
    console.error("❌ Error updating user game data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== POST: UPDATE PLAYER GAME MODE DATA (WITH BLOCKCHAIN) - UPDATED ==========
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

    const oldScores = { ...player.playerGameModeData };
    Object.assign(player.playerGameModeData, updateData);

    const scoresChanged = 
      (updateData.bestScoreOneWay && updateData.bestScoreOneWay > oldScores.bestScoreOneWay) ||
      (updateData.bestScoreTwoWay && updateData.bestScoreTwoWay > oldScores.bestScoreTwoWay) ||
      (updateData.bestScoreTimeAttack && updateData.bestScoreTimeAttack > oldScores.bestScoreTimeAttack) ||
      (updateData.bestScoreBomb && updateData.bestScoreBomb > oldScores.bestScoreBomb);

    let blockchainResult = null;
    if (scoresChanged) {
      blockchainResult = await safeBlockchainCall(() => recordScoreSubmission(player, player.playerGameModeData));
    }

    player.lastUpdated = new Date();
    await player.save();

    // 0G DA: snapshot whenever a new best score is achieved
    if (scoresChanged) {
      console.log('[0g-da] POST /player/gamemode: best score improved — calling saveDASnapshot', {
        user: req.query.user,
        oldScores,
        mergedScores: player.playerGameModeData,
      });
      saveDASnapshot(player, 'score');
    } else if (updateData.playerGameModeData) {
      console.log('[0g-da] POST /player/gamemode: playerGameModeData present but no new personal best — no DA submit', {
        user: req.query.user,
      });
    }

    res.json({
      success: true,
      data: player.playerGameModeData,
      ...(blockchainResult !== null && { blockchain: blockchainResult })
    });
  } catch (err) {
    console.error("❌ Error updating player game mode data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== POST: UPDATE PLAYER VEHICLE DATA (WITH BLOCKCHAIN) - UPDATED ==========
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

    const oldVehicleIndex = player.playerVehicleData.selectedPlayerCarIndex;
    const newVehicleIndex = updateData.selectedPlayerCarIndex;

    let blockchainResult = null;
    if (newVehicleIndex !== undefined && newVehicleIndex !== oldVehicleIndex) {
      blockchainResult = await safeBlockchainCall(() => recordVehicleSwitch(player, newVehicleIndex));
    }

    Object.assign(player.playerVehicleData, updateData);
    player.lastUpdated = new Date();
    await player.save();

    res.json({
      success: true,
      data: player.playerVehicleData,
      ...(blockchainResult !== null && { blockchain: blockchainResult })
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
      return res.status(400).json({
        success: false,
        error: "Missing 'user' parameter",
        code: "MISSING_USER_PARAMETER",
      });
    }

    const player = await findUserByIdentifier(user);
    
    if (!player) {
      return res.json({
        success: true,
        data: {
          Achieved1000M: false,
          qualified: false,
        },
      });
    }

    const achieved = player.campaignData?.Achieved1000M || false;
    return res.json({
      success: true,
      data: {
        Achieved1000M: achieved,
        qualified: achieved,
      },
    });
  } catch (err) {
    return sendServerError(res, "checkUserAchievement", err);
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
        success: false,
        error: "Missing user parameter",
        code: "MISSING_USER_PARAMETER",
      });
    }

    const player = await findUserByIdentifier(user);

    if (!player) {
      return res.json({
        success: true,
        data: {
          Achieved1000M: false,
          result: false,
          qualified: false,
        },
      });
    }

    const achieved = player.campaignData?.Achieved1000M || false;
    return res.json({
      success: true,
      data: {
        Achieved1000M: achieved,
        result: achieved,
        qualified: achieved,
      },
    });
  } catch (err) {
    return sendServerError(res, "checkGateUserAchievement", err);
  }
};

// ========== LEADERBOARD & UTILITIES ==========
exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await PlayerState.find()
      .sort({ 'userGameData.currency': -1 })
      .select('privyData.walletAddress userGameData.playerName userGameData.currency playerGameModeData.bestScoreOneWay playerVehicleData.selectedPlayerCarIndex');
    
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
      .select('privyData.walletAddress userGameData.playerName userGameData.currency playerGameModeData.bestScoreOneWay playerVehicleData.selectedPlayerCarIndex');

    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error("❌ Error getting gate wallet leaderboard:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createLeaderboardCommentPing = async (req, res) => {
  const currentPlayer = req.body?.currentPlayer;
  const topPlayer = req.body?.topPlayer;
  const leaderboardType = req.body?.leaderboardType || 'global';

  if (!currentPlayer || typeof currentPlayer !== 'object') {
    return res.status(400).json({ success: false, error: "Missing currentPlayer" });
  }

  if (!topPlayer || typeof topPlayer !== 'object') {
    return res.status(400).json({ success: false, error: "Missing topPlayer" });
  }

  console.log("[leaderboard] comment_ping.accepted (no inference here)", {
    leaderboardType,
    currentPlayerId: currentPlayer?._id ? String(currentPlayer._id) : undefined,
    topPlayerId: topPlayer?._id ? String(topPlayer._id) : undefined,
  });

  return res.status(202).json({
    success: true,
    accepted: true,
    hint:
      "Commentary runs on GET /api/leaderboard/ai-comment via 0G Compute (primary) with CF fallback.",
  });
};

// ========== AI LEADERBOARD COMMENT ==========
exports.getLeaderboardAiComment = async (req, res) => {
  try {
    const { user } = req.query;
    const leaderboardType = req.query.type || 'global';

    if (!user) {
      return res.status(400).json({ success: false, error: "Missing 'user' parameter" });
    }

    const currentPlayer = await findUserByIdentifier(user);
    if (!currentPlayer) {
      return res.status(404).json({ success: false, error: "Player not found" });
    }

    // Get top player from appropriate leaderboard
    const query = leaderboardType === 'gate'
      ? { 'privyData.type': 'gate_wallet' }
      : {};
    const [topPlayer] = await PlayerState.find(query)
      .sort({ 'userGameData.currency': -1 })
      .limit(1);

    if (!topPlayer) {
      return res.json({
        success: true,
        comment: null,
        _meta: { source: null },
      });
    }

    const { comment, inferenceSource } = await generateLeaderboardComment({
      currentPlayer,
      topPlayer,
      leaderboardType,
    });

    res.json({
      success: true,
      comment,
      _meta: {
        source: inferenceSource ?? null,
      },
    });
  } catch (err) {
    console.error("❌ Error generating AI comment:", err);
    res.json({
      success: true,
      comment: null,
      _meta: { source: null },
    });
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

// ========== 0G DA ENDPOINTS ==========

// GET /api/da/snapshot?user=<identifier>
// Returns the eventId + DA status stored in the player's MongoDB record
exports.getDASnapshot = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) return res.status(400).json({ success: false, error: "Missing 'user' parameter" });

    const player = await findUserByIdentifier(user);
    if (!player) return res.status(404).json({ success: false, error: "Player not found" });

    const snap = player.daSnapshot;
    if (!snap?.eventId) {
      return res.json({ success: true, snapshot: null, message: "No DA event submitted yet for this player" });
    }

    res.json({
      success: true,
      snapshot: {
        eventId:     snap.eventId,
        daStatus:    snap.daStatus,
        daReference: snap.daReference || null,
        daBlobInfo:  snap.daBlobInfo  || null,
        snapshotAt:  snap.snapshotAt,
        trigger:     snap.trigger,
        gatewayStatusUrl: `${zerogDAService.getGatewayBaseUrl()}/v1/da/status/${snap.eventId}`,
      },
    });
  } catch (err) {
    console.error("❌ Error getting DA snapshot:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/da/status?user=<identifier>
// Live-polls the DA gateway for the latest status of the player's event
exports.getDAStatus = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) return res.status(400).json({ success: false, error: "Missing 'user' parameter" });

    const player = await findUserByIdentifier(user);
    if (!player) return res.status(404).json({ success: false, error: "Player not found" });

    const eventId = player.daSnapshot?.eventId;
    if (!eventId) {
      return res.json({ success: true, found: false, message: "No DA event submitted yet for this player" });
    }

    const status = await zerogDAService.getEventStatus(eventId);

    // If confirmed/finalized, persist the blob info back into MongoDB
    if (status?.daBlobInfo && ['confirmed', 'finalized'].includes(status.daStatus?.toLowerCase())) {
      await PlayerState.findByIdAndUpdate(player._id, {
        'daSnapshot.daStatus':    status.daStatus,
        'daSnapshot.daReference': status.daReference,
        'daSnapshot.daBlobInfo':  status.daBlobInfo,
      });
    }

    res.json({ success: true, eventId, ...status });
  } catch (err) {
    console.error("❌ Error getting DA status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/da/retrieve?user=<identifier>
// Retrieves and decodes the player's blob directly from 0G DA network
exports.retrieveDAEvent = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) return res.status(400).json({ success: false, error: "Missing 'user' parameter" });

    const player = await findUserByIdentifier(user);
    if (!player) return res.status(404).json({ success: false, error: "Player not found" });

    const eventId = player.daSnapshot?.eventId;
    if (!eventId) {
      return res.json({ success: true, retrieved: false, message: "No DA event for this player" });
    }

    const result = await zerogDAService.retrievePlayerEvent(eventId);
    res.json({ success: true, eventId, ...result });
  } catch (err) {
    console.error("❌ Error retrieving DA event:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/da/health
exports.getDAHealth = async (req, res) => {
  try {
    const status = await zerogDAService.healthCheck();
    res.json({ success: true, da: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.retryFailedDASubmissions = async (req, res) => {
  try {
    await daSnapshotService.retryFailedSnapshots();
    res.json({
      success: true,
      message: 'Retry/backfill job queued for failed DA submissions',
    });
  } catch (err) {
    console.error('❌ Error retrying failed DA snapshots:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.reconcilePlayerState = async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) {
      return res.status(400).json({ success: false, error: "Missing 'user' parameter" });
    }

    const player = await findUserByIdentifier(user);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    const reconciliation = await blockchainActions.reconcilePlayerState(player);
    res.json({ success: true, reconciliation });
  } catch (err) {
    console.error('❌ Error reconciling player state:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
