const mongoose = require("mongoose");

const RewardSchema = new mongoose.Schema({
  walletAddress: { type: String, lowercase: true, required: true, index: true },
  rewardType:    { type: String, required: true },   // "vehicle"
  rewardId:      { type: String, required: true },   // "muscle", "f1", etc.
  status:        { type: String, default: "pending", enum: ["pending", "claimed"] },
  claimedAt:     { type: Date, default: null },
  note:          { type: String },
}, { timestamps: true });

RewardSchema.index({ walletAddress: 1, status: 1 });

module.exports = mongoose.model("Reward", RewardSchema);
