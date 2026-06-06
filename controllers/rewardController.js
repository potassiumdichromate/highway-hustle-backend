const Reward = require("../models/Reward");

// GET /player/rewards?user=0x...
// Returns all active rewards for a wallet. Rewards are permanent —
// only an admin changing status to "disabled" in the DB removes them.
const getRewards = async (req, res) => {
  try {
    const wallet = (req.query.user || "").trim().toLowerCase();
    if (!wallet) {
      return res.status(400).json({ success: false, error: "user query param required" });
    }

    const rewards = await Reward.find({ walletAddress: wallet, status: "active" });

    return res.json({
      success: true,
      rewards: rewards.map(r => ({
        rewardId:   r.rewardId,
        rewardType: r.rewardType,
        note:       r.note,
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to fetch rewards" });
  }
};

module.exports = { getRewards };
