const mongoose = require("mongoose");

const PlayerStateSchema = new mongoose.Schema({
  // ========== PRIVY DATA ==========
  privyData: {
    walletAddress: { type: String, lowercase: true, sparse: true, index: true },
    discord: { type: String, sparse: true, index: true },
    telegram: { type: String, sparse: true, index: true },
    email: { type: String, lowercase: true, sparse: true, index: true },
    discordId: { type: String, sparse: true, index: true },
    type: { type: String, default: 'unknown' },
    providerName: { type: String },
    chainId: { type: String },
    privyUserId: { type: String },
    recordedAt: { type: Date }
  },

  // ========== USER GAME DATA ==========
  userGameData: {
    playerName: { type: String, default: "Unnamed" },
    currency: { type: Number, default: 20000 },
    lastWeekCurrency: { type: Number, default: 0 },
    totalPlayedTime: { type: Number, default: 0.0 }
  },

  // ========== PLAYER GAME MODE DATA ==========
  playerGameModeData: {
    bestScoreOneWay: { type: Number, default: 0 },
    bestScoreTwoWay: { type: Number, default: 0 },
    bestScoreTimeAttack: { type: Number, default: 0 },
    bestScoreBomb: { type: Number, default: 0 }
  },

  // ========== PLAYER VEHICLE DATA ==========
  playerVehicleData: {
    selectedPlayerCarIndex: { type: Number, default: 0 },
    JeepOwned: { type: Number, default: 1 },
    VanOwned: { type: Number, default: 0 },
    SierraOwned: { type: Number, default: 0 },
    SedanOwned: { type: Number, default: 0 },
    LamborghiniOwned: { type: Number, default: 0 }
  },

  // ========== CAMPAIGN DATA ==========
  campaignData: {
    Achieved1000M: { type: Boolean, default: false }
  },

  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// ✅ Compound index for efficient user lookup across all privy fields
PlayerStateSchema.index({
  'privyData.walletAddress': 1,
  'privyData.discord': 1,
  'privyData.discordId': 1,
  'privyData.telegram': 1,
  'privyData.email': 1,
  'privyData.type': 1
});

module.exports = mongoose.model("HighwayHustlePlayer", PlayerStateSchema);
