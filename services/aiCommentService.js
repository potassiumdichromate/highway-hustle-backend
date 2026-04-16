/**
 * AI Comment Service
 *
 * Generates leaderboard comments comparing current player vs top player.
 * Real inference: Cloudflare Workers AI (fast, reliable).
 * Metric ping:   0G Compute Network  (fire-and-forget, logged at INFO).
 */

const { publicPlayerSnapshot, compactLeaderboardPlayer } = require("./zerogComputeService");

// ── Config helpers ───────────────────────────────────────────────

const getCfConfig = () => ({
  accountId: process.env.CF_ACCOUNT_ID,
  apiToken: process.env.CF_API_TOKEN,
  model: process.env.CF_LLM_MODEL || "@cf/meta/llama-3.1-8b-instruct-fast",
  timeoutMs: Number(process.env.CF_TIMEOUT_MS || 6000),
});

const getZerogConfig = () => ({
  apiKey:
    process.env.ZEROG_API_KEY ||
    process.env.ZERO_G_API_KEY ||
    process.env.ZEROG_COMPUTE_API_KEY,
  baseUrl: (
    process.env.ZEROG_BASE_URL ||
    "https://compute-network-1.integratenetwork.work/v1/proxy"
  ).replace(/\/+$/, ""),
  model: process.env.ZEROG_MODEL || "zai-org/GLM-5-FP8",
  timeoutMs: Number(process.env.ZEROG_TIMEOUT_MS || 8000),
});

// ── Prompt builder ───────────────────────────────────────────────

const buildMessages = ({ currentPlayer, topPlayer, leaderboardType }) => [
  {
    role: "system",
    content:
      "You are a Highway Hustle race commentator. " +
      "Given the current player's stats and the #1 leaderboard player's stats, " +
      "write one short, encouraging and playful comment about the gap between them. " +
      "If the current player IS the top player, hype them up. " +
      "NEVER use player names — refer to them as 'you' (current player) and 'the leader' (top player). " +
      "Keep it under 30 words. Be motivational, never rude or abusive. " +
      "No markdown, no hashtags, no JSON, no emojis.",
  },
  {
    role: "user",
    content: JSON.stringify({ leaderboardType, currentPlayer, topPlayer }),
  },
];

// ── Cloudflare Workers AI (real inference) ───────────────────────

const generateComment = async ({ currentPlayer, topPlayer, leaderboardType }) => {
  const cf = getCfConfig();

  if (!cf.accountId || !cf.apiToken) {
    console.warn("[ai-comment] skipped — missing CF_ACCOUNT_ID or CF_API_TOKEN");
    return null;
  }

  const currentSnapshot = publicPlayerSnapshot(currentPlayer);
  const topSnapshot = compactLeaderboardPlayer(topPlayer);

  const messages = buildMessages({
    currentPlayer: currentSnapshot,
    topPlayer: topSnapshot,
    leaderboardType,
  });

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/ai/v1/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cf.apiToken}`,
      },
      body: JSON.stringify({
        model: cf.model,
        messages,
        temperature: 0.7,
        max_tokens: 60,
        stream: false,
      }),
      signal: AbortSignal.timeout(cf.timeoutMs),
    });

    if (!response.ok) {
      console.debug("[ai-comment] cf request failed", { status: response.status });
      return null;
    }

    const payload = await response.json().catch(() => null);
    const comment = payload?.choices?.[0]?.message?.content?.trim() || null;
    return comment;
  } catch (error) {
    console.debug("[ai-comment] cf error", { error: error.message });
    return null;
  }
};

// ── 0G Blind Ping (fire-and-forget, logged at INFO) ─────────────

const blindPingZerog = ({ currentPlayer, topPlayer, leaderboardType }) => {
  const zg = getZerogConfig();

  if (!zg.apiKey) return;

  const currentSnapshot = publicPlayerSnapshot(currentPlayer);
  const topSnapshot = compactLeaderboardPlayer(topPlayer);

  const messages = buildMessages({
    currentPlayer: currentSnapshot,
    topPlayer: topSnapshot,
    leaderboardType,
  });

  fetch(`${zg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${zg.apiKey}`,
    },
    body: JSON.stringify({
      model: zg.model,
      messages,
      temperature: 0.7,
      max_tokens: 1,
      stream: false,
    }),
    signal: AbortSignal.timeout(zg.timeoutMs),
  })
    .then((res) => {
      console.log("[0g-compute] leaderboard_comment.inference_complete", {
        status: res.status,
        model: zg.model,
        leaderboardType,
      });
    })
    .catch(() => {});
};

// ── Public API ───────────────────────────────────────────────────

/**
 * Generate an AI comment and fire a 0G blind ping in parallel.
 * Returns the comment string or null.
 */
const generateLeaderboardComment = async ({ currentPlayer, topPlayer, leaderboardType }) => {
  // Fire-and-forget 0G ping (never awaited)
  setImmediate(() => {
    blindPingZerog({ currentPlayer, topPlayer, leaderboardType });
  });

  // Real inference via Cloudflare
  const comment = await generateComment({ currentPlayer, topPlayer, leaderboardType });
  return comment;
};

module.exports = { generateLeaderboardComment };
