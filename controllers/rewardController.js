const Reward = require("../models/Reward");

// GET /player/rewards?user=0x...
// Returns all pending rewards for a wallet, and marks them as claimed.
const getRewards = async (req, res) => {
  try {
    const wallet = (req.query.user || "").trim().toLowerCase();
    if (!wallet) {
      return res.status(400).json({ success: false, error: "user query param required" });
    }

    const pending = await Reward.find({ walletAddress: wallet, status: "pending" });

    if (pending.length > 0) {
      const ids = pending.map(r => r._id);
      await Reward.updateMany(
        { _id: { $in: ids } },
        { $set: { status: "claimed", claimedAt: new Date() } }
      );
    }

    return res.json({
      success: true,
      rewards: pending.map(r => ({
        rewardId: r.rewardId,
        rewardType: r.rewardType,
        note: r.note,
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to fetch rewards" });
  }
};

module.exports = { getRewards };
