const DEFAULT_ZEROG_BASE_URL = "https://compute-network-1.integratenetwork.work/v1/proxy";
const DEFAULT_ZEROG_MODEL = "zai-org/GLM-5-FP8";

const toPlainObject = (value) => {
  if (!value) return {};
  return value.toObject ? value.toObject() : value;
};

const publicPlayerSnapshot = (player) => {
  const plain = toPlainObject(player);
  return {
    id: plain._id ? String(plain._id) : undefined,
    playerName: plain.userGameData?.playerName || "Unnamed",
    currency: Number(plain.userGameData?.currency || 0),
    totalPlayedTime: Number(plain.userGameData?.totalPlayedTime || 0),
    scores: {
      oneWay: Number(plain.playerGameModeData?.bestScoreOneWay || 0),
      twoWay: Number(plain.playerGameModeData?.bestScoreTwoWay || 0),
      timeAttack: Number(plain.playerGameModeData?.bestScoreTimeAttack || 0),
      bomb: Number(plain.playerGameModeData?.bestScoreBomb || 0),
    },
    selectedCarIndex: Number(plain.playerVehicleData?.selectedPlayerCarIndex || 0),
    identifier:
      plain.privyData?.walletAddress ||
      plain.privyData?.discord ||
      plain.privyData?.telegram ||
      plain.privyData?.email ||
      undefined,
  };
};

const compactLeaderboardPlayer = (player) => {
  const plain = toPlainObject(player);
  return {
    id: plain._id ? String(plain._id) : undefined,
    playerName: plain.userGameData?.playerName || plain.playerName || "Unnamed",
    currency: Number(plain.userGameData?.currency || plain.currency || 0),
    identifier:
      plain.privyData?.walletAddress ||
      plain.privyData?.discord ||
      plain.privyData?.telegram ||
      plain.privyData?.email ||
      plain.identifier ||
      undefined,
  };
};

const getZerogConfig = () => ({
  apiKey:
    process.env.ZEROG_API_KEY ||
    process.env.ZERO_G_API_KEY ||
    process.env.ZEROG_COMPUTE_API_KEY,
  baseUrl: (process.env.ZEROG_BASE_URL || DEFAULT_ZEROG_BASE_URL).replace(/\/+$/, ""),
  model: process.env.ZEROG_MODEL || DEFAULT_ZEROG_MODEL,
  timeoutMs: Number(process.env.ZEROG_TIMEOUT_MS || 8000),
});

module.exports = {
  getZerogConfig,
  publicPlayerSnapshot,
  compactLeaderboardPlayer,
};
