/**
 * AI Comment Service
 *
 * Generates leaderboard comments comparing current player vs top player.
 * Primary inference: 0G Compute (chat completions).
 * Fallback: Cloudflare Workers AI when 0G is unavailable, errors, or returns empty.
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

// ── 0G Compute (primary) ─────────────────────────────────────────

const generateCommentZerog = async ({ currentPlayer, topPlayer, leaderboardType }) => {
  const zg = getZerogConfig();

  if (!zg.apiKey) {
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
    const response = await fetch(`${zg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zg.apiKey}`,
      },
      body: JSON.stringify({
        model: zg.model,
        messages,
        temperature: 0.7,
        max_tokens: 60,
        stream: false,
      }),
      signal: AbortSignal.timeout(zg.timeoutMs),
    });

    if (!response.ok) {
      console.warn("[ai-comment] 0g request failed", { status: response.status });
      return null;
    }

    const payload = await response.json().catch(() => null);
    const comment = payload?.choices?.[0]?.message?.content?.trim() || null;
    if (comment) {
      console.log("[0g-compute] leaderboard_comment.primary_success", {
        model: zg.model,
        leaderboardType,
      });
    }
    return comment || null;
  } catch (error) {
    console.warn("[ai-comment] 0g error", { error: error.message });
    return null;
  }
};

// ── Cloudflare Workers AI (fallback) ────────────────────────────

const generateCommentCloudflare = async ({ currentPlayer, topPlayer, leaderboardType }) => {
  const cf = getCfConfig();

  if (!cf.accountId || !cf.apiToken) {
    console.warn("[ai-comment] fallback skipped — missing CF_ACCOUNT_ID or CF_API_TOKEN");
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
      console.warn("[ai-comment] cf fallback failed", { status: response.status });
      return null;
    }

    const payload = await response.json().catch(() => null);
    const comment = payload?.choices?.[0]?.message?.content?.trim() || null;
    if (comment) {
      console.log("[ai-comment] cloudflare_fallback.success", { leaderboardType });
    }
    return comment;
  } catch (error) {
    console.warn("[ai-comment] cf fallback error", { error: error.message });
    return null;
  }
};

// ── Public API ───────────────────────────────────────────────────

/**
 * Try 0G Compute first; on missing key, HTTP/error, or empty body, use Cloudflare.
 * Returns the comment string or null.
 */
const generateLeaderboardComment = async ({ currentPlayer, topPlayer, leaderboardType }) => {
  const primary = await generateCommentZerog({
    currentPlayer,
    topPlayer,
    leaderboardType,
  });

  if (primary && primary.length > 0) {
    return primary;
  }

  console.log("[ai-comment] using cloudflare fallback", { leaderboardType });
  return generateCommentCloudflare({ currentPlayer, topPlayer, leaderboardType });
};

module.exports = { generateLeaderboardComment };
