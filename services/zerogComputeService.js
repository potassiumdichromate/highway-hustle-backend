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

const buildCommentMessages = ({ currentPlayer, topPlayer, leaderboardType }) => [
  {
    role: "system",
    content:
      "You are a Highway Hustle race commentator. Generate one short, playful comment for the current player by comparing their stats with the top leaderboard player. Keep it under 30 words. No markdown, no hashtags, no JSON.",
  },
  {
    role: "user",
    content: JSON.stringify({
      leaderboardType,
      currentPlayer: publicPlayerSnapshot(currentPlayer),
      topPlayer: compactLeaderboardPlayer(topPlayer),
    }),
  },
];

const sendLeaderboardCommentPing = async ({ currentPlayer, topPlayer, leaderboardType }) => {
  const config = getZerogConfig();
  const currentSnapshot = publicPlayerSnapshot(currentPlayer);
  const topSnapshot = compactLeaderboardPlayer(topPlayer);

  if (!config.apiKey) {
    console.warn("[0g-compute] leaderboard_comment_ping.skipped", {
      reason: "missing_api_key",
    });
    return;
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildCommentMessages({ currentPlayer, topPlayer, leaderboardType }),
        temperature: 0.7,
        max_tokens: 60,
        stream: false,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      console.warn("[0g-compute] leaderboard_comment_ping.failed", {
        status: response.status,
        leaderboardType,
        currentPlayer: currentSnapshot.playerName,
        topPlayer: topSnapshot.playerName,
      });
      return;
    }

    const payload = await response.json().catch(() => null);
    const comment = payload?.choices?.[0]?.message?.content?.trim();

    console.log("[0g-compute] leaderboard_comment.generated", {
      leaderboardType,
      currentPlayer: currentSnapshot.playerName,
      currentCurrency: currentSnapshot.currency,
      topPlayer: topSnapshot.playerName,
      topCurrency: topSnapshot.currency,
      comment: comment || "[empty response]",
    });
  } catch (error) {
    console.warn("[0g-compute] leaderboard_comment_ping.failed", {
      error: error.message,
      leaderboardType,
      currentPlayer: currentSnapshot.playerName,
      topPlayer: topSnapshot.playerName,
    });
  }
};

module.exports = {
  sendLeaderboardCommentPing,
};
