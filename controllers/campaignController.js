const legacy = require("./playerController");
const assetsData = require("../data/assets");

const getStoreAssets = (req, res) => {
  try {
    const baseUrl = String(process.env.ZG_STORAGE_INDEXER_URL || "https://indexer-storage-turbo.0g.ai").replace(/\/$/, "");
    const explorerBase = String(process.env.ONCHAIN_EXPLORER_URL || "https://chainscan.0g.ai").replace(/\/$/, "");
    const assets = Array.isArray(assetsData)
      ? assetsData.map((item) => ({
          ...item,
          imageUrl: `${baseUrl}/file?root=${item.rootHash}`,
          explorerTxUrl: item.txHash ? `${explorerBase}/tx/${item.txHash}` : null,
        }))
      : [];
    return res.json({ success: true, assets });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to load store assets",
      code: "STORE_ASSETS_LOAD_FAILED",
    });
  }
};

module.exports = {
  checkUserAchievement: legacy.checkUserAchievement,
  checkGateUserAchievement: legacy.checkGateUserAchievement,
  createLeaderboardCommentPing: legacy.createLeaderboardCommentPing,
  getLeaderboardAiComment: legacy.getLeaderboardAiComment,
  getLeaderboard: legacy.getLeaderboard,
  getGateWalletLeaderboard: legacy.getGateWalletLeaderboard,
  getAllUsers: legacy.getAllUsers,
  getStoreAssets,
};
