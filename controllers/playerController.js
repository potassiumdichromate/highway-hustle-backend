const PlayerState = require("../models/PlayerState");

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
    privyData: {},
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

// ========== GET: ALL PLAYER DATA ==========
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
      data: player 
    });
  } catch (err) {
    console.error("❌ Error getting all player data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: PRIVY DATA ==========
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

// ========== GET: USER GAME DATA ==========
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
      data: player.userGameData 
    });
  } catch (err) {
    console.error("❌ Error getting user game data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ========== GET: PLAYER GAME MODE DATA ==========
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

// ========== GET: PLAYER VEHICLE DATA ==========
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

// ========== POST: UPDATE ALL PLAYER DATA ==========
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

    // Merge updates
    if (updateData.privyData) Object.assign(player.privyData, updateData.privyData);
    if (updateData.userGameData) Object.assign(player.userGameData, updateData.userGameData);
    if (updateData.playerGameModeData) Object.assign(player.playerGameModeData, updateData.playerGameModeData);
    if (updateData.playerVehicleData) Object.assign(player.playerVehicleData, updateData.playerVehicleData);
    if (updateData.campaignData) Object.assign(player.campaignData, updateData.campaignData);

    player.lastUpdated = new Date();
    await player.save();

    res.json({ 
      success: true, 
      data: player 
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

// ========== POST: UPDATE USER GAME DATA ==========
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

// ========== POST: UPDATE PLAYER GAME MODE DATA ==========
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

    Object.assign(player.playerGameModeData, updateData);
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

// ========== POST: UPDATE PLAYER VEHICLE DATA ==========
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