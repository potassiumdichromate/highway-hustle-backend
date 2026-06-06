const mongoose = require("mongoose");

const RewardSchema = new mongoose.Schema({
  walletAddress: { type: String, lowercase: true, required: true, index: true },
  rewardType:    { type: String, required: true },   // "vehicle"
  rewardId:      { type: String, required: true },   // "muscle", "f1", etc.
  // "active" = always visible in garage. Set to "disabled" from DB to remove it.
  status:        { type: String, default: "active", enum: ["active", "disabled"] },
  note:          { type: String },
}, { timestamps: true });

RewardSchema.index({ walletAddress: 1, status: 1 });

module.exports = mongoose.model("Reward", RewardSchema);
