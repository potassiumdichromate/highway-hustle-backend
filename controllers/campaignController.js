const legacy = require("./playerController");

module.exports = {
  checkUserAchievement: legacy.checkUserAchievement,
  checkGateUserAchievement: legacy.checkGateUserAchievement,
  createLeaderboardCommentPing: legacy.createLeaderboardCommentPing,
  getLeaderboardAiComment: legacy.getLeaderboardAiComment,
  getLeaderboard: legacy.getLeaderboard,
  getGateWalletLeaderboard: legacy.getGateWalletLeaderboard,
  getAllUsers: legacy.getAllUsers,
};
