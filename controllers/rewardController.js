const Reward = require("../models/Reward");
const assets = require("../data/assets");

const REWARD_GRANT_SECRET_HEADER = "x-contest-grant-secret";
const DEFAULT_REWARD_TYPE = "vehicle";

const VEHICLE_IDS = new Set(
  assets
    .map((asset) => String(asset?.id || "").trim().toLowerCase())
    .filter(Boolean)
);

const toRewardPayload = (reward) => ({
  rewardId: reward.rewardId,
  rewardType: reward.rewardType,
  note: reward.note,
  status: reward.status,
});

const normalizeWalletAddress = (value) => {
  if (!value || typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const isValidWalletAddress = (value) => /^0x[a-f0-9]{40}$/i.test(value || "");

const isKnownVehicleReward = (rewardType, rewardId) =>
  rewardType !== DEFAULT_REWARD_TYPE || VEHICLE_IDS.has(rewardId);

// GET /player/rewards?user=0x...
// Returns all active rewards for a wallet. Rewards are permanent —
// only an admin changing status to "disabled" in the DB removes them.
const getRewards = async (req, res) => {
  try {
    const wallet = normalizeWalletAddress(req.query.user || "");
    if (!wallet) {
      return res.status(400).json({ success: false, error: "user query param required" });
    }

    const rewards = await Reward.find({ walletAddress: wallet, status: "active" });

    return res.json({
      success: true,
      rewards: rewards.map(toRewardPayload),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to fetch rewards" });
  }
};

// POST /player/rewards/grant
// Secret-protected internal endpoint used by sister games to grant a reward
// into Highway Hustle's existing garage reward system.
const grantReward = async (req, res) => {
  try {
    const expectedSecret = String(process.env.CONTEST_REWARD_GRANT_SECRET || "").trim();
    if (!expectedSecret) {
      return res.status(503).json({
        success: false,
        error: "Reward grant secret is not configured",
        code: "REWARD_GRANT_UNAVAILABLE",
      });
    }

    const providedSecret = String(req.get(REWARD_GRANT_SECRET_HEADER) || "").trim();
    if (!providedSecret || providedSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized reward grant request",
        code: "REWARD_GRANT_UNAUTHORIZED",
      });
    }

    const walletAddress = normalizeWalletAddress(
      req.body?.walletAddress || req.body?.user || req.body?.address
    );
    const rewardId = String(req.body?.rewardId || "").trim().toLowerCase();
    const rewardType = String(req.body?.rewardType || DEFAULT_REWARD_TYPE)
      .trim()
      .toLowerCase();
    const note = String(req.body?.note || "").trim() || "Unlocked from Guess The AI";

    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "A valid walletAddress is required",
        code: "INVALID_WALLET_ADDRESS",
      });
    }

    if (!rewardId) {
      return res.status(400).json({
        success: false,
        error: "rewardId is required",
        code: "REWARD_ID_REQUIRED",
      });
    }

    if (!isKnownVehicleReward(rewardType, rewardId)) {
      return res.status(400).json({
        success: false,
        error: "Unknown vehicle reward",
        code: "UNKNOWN_REWARD_ID",
      });
    }

    const existingReward = await Reward.findOne({ walletAddress, rewardId, rewardType });
    if (existingReward) {
      if (existingReward.status !== "active") {
        existingReward.status = "active";
      }
      if (!existingReward.note && note) {
        existingReward.note = note;
      }
      await existingReward.save();

      return res.json({
        success: true,
        granted: true,
        created: false,
        reward: toRewardPayload(existingReward),
      });
    }

    const createdReward = await Reward.create({
      walletAddress,
      rewardId,
      rewardType,
      note,
      status: "active",
    });

    return res.status(201).json({
      success: true,
      granted: true,
      created: true,
      reward: toRewardPayload(createdReward),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to grant reward",
      code: "REWARD_GRANT_FAILED",
    });
  }
};

module.exports = { getRewards, grantReward };
