/**
 * AI Comment Service
 *
 * Leaderboard commentary: primary path is 0G Compute (GLM-5-FP8, meaningful max_tokens).
 * Cloudflare Workers AI only if 0G errors, times out, or returns unusable output.
 */

const {
  publicPlayerSnapshot,
  compactLeaderboardPlayer,
  getZerogConfig,
} = require("./zerogComputeService");

// ── Leaderboard 0G path (explicit product requirements) ───────────

const LEADERBOARD_MODEL =
  process.env.ZEROG_LEADERBOARD_MODEL || "zai-org/GLM-5-FP8";
const LEADERBOARD_MAX_TOKENS = Math.min(
  Math.max(Number(process.env.ZEROG_LEADERBOARD_MAX_TOKENS || 150), 16),
  512,
);
const LEADERBOARD_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.ZEROG_LEADERBOARD_TIMEOUT_MS || 8000), 1000),
  120_000,
);

// ── Config helpers ───────────────────────────────────────────────

const getCfConfig = () => ({
  accountId: process.env.CF_ACCOUNT_ID,
  apiToken: process.env.CF_API_TOKEN,
  model: process.env.CF_LLM_MODEL || "@cf/meta/llama-3.1-8b-instruct-fast",
  timeoutMs: Number(process.env.CF_TIMEOUT_MS || 6000),
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

const normalizeUsage = (usage) =>
  usage && typeof usage === "object"
    ? {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      }
    : null;

/** Reject obvious garbage so we fallback to CF instead of showing broken 0g output */
const isValidLeaderboardComment = (text) => {
  if (typeof text !== "string") return false;
  const t = text.trim();
  if (t.length < 8 || t.length > 2000) return false;
  const lower = t.slice(0, 32).toLowerCase();
  if (lower.startsWith("{") || lower.startsWith("[")) return false;
  return true;
};

// ── 0G Compute (primary) ─────────────────────────────────────────

const generateCommentZerog = async ({
  currentPlayer,
  topPlayer,
  leaderboardType,
}) => {
  const zgBase = getZerogConfig();
  const apiKey = zgBase.apiKey;

  if (!apiKey) {
    return { ok: false, phase: "no_api_key" };
  }

  const currentSnapshot = publicPlayerSnapshot(currentPlayer);
  const topSnapshot = compactLeaderboardPlayer(topPlayer);

  const messages = buildMessages({
    currentPlayer: currentSnapshot,
    topPlayer: topSnapshot,
    leaderboardType,
  });

  const started = Date.now();
  try {
    const response = await fetch(`${zgBase.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: LEADERBOARD_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: LEADERBOARD_MAX_TOKENS,
        stream: false,
      }),
      signal: AbortSignal.timeout(LEADERBOARD_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - started;

    if (!response.ok) {
      console.warn("[ai-comment] 0g request failed", {
        status: response.status,
        leaderboardType,
        latencyMs,
        model: LEADERBOARD_MODEL,
      });
      return { ok: false, phase: "http_error", latencyMs };
    }

    const payload = await response.json().catch(() => null);
    const raw =
      typeof payload?.choices?.[0]?.message?.content === "string"
        ? payload.choices[0].message.content
        : null;
    const comment = raw?.trim() || null;
    const usage = normalizeUsage(payload?.usage);

    if (!comment || !isValidLeaderboardComment(comment)) {
      console.warn("[0g-compute] leaderboard_comment.invalid_or_empty_output", {
        leaderboardType,
        latencyMs,
        model: LEADERBOARD_MODEL,
        preview: comment ? `${comment.slice(0, 80)}…` : null,
      });
      return { ok: false, phase: "invalid_output", latencyMs };
    }

    console.log("[0g-compute] leaderboard_comment.inference_success", {
      leaderboardType,
      model: LEADERBOARD_MODEL,
      latencyMs,
      max_tokens_requested: LEADERBOARD_MAX_TOKENS,
      timeout_ms: LEADERBOARD_TIMEOUT_MS,
      token_usage: usage,
    });

    return {
      ok: true,
      comment,
      latencyMs,
      usage,
      model: LEADERBOARD_MODEL,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    console.warn("[ai-comment] 0g error", {
      leaderboardType,
      error: error.message,
      latencyMs,
      model: LEADERBOARD_MODEL,
    });
    return { ok: false, phase: "exception", latencyMs };
  }
};

// ── Cloudflare Workers AI (fallback) ─────────────────────────────

const generateCommentCloudflare = async ({
  currentPlayer,
  topPlayer,
  leaderboardType,
}) => {
  const cf = getCfConfig();

  if (!cf.accountId || !cf.apiToken) {
    console.warn(
      "[ai-comment] cloudflare_fallback skipped — missing CF_ACCOUNT_ID or CF_API_TOKEN",
    );
    return null;
  }

  const currentSnapshot = publicPlayerSnapshot(currentPlayer);
  const topSnapshot = compactLeaderboardPlayer(topPlayer);

  const messages = buildMessages({
    currentPlayer: currentSnapshot,
    topPlayer: topSnapshot,
    leaderboardType,
  });

  const started = Date.now();
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
        max_tokens: 80,
        stream: false,
      }),
      signal: AbortSignal.timeout(cf.timeoutMs),
    });

    const latencyMs = Date.now() - started;

    if (!response.ok) {
      console.warn("[ai-comment] cloudflare_fallback http_error", {
        status: response.status,
        leaderboardType,
        latencyMs,
      });
      return null;
    }

    const payload = await response.json().catch(() => null);
    const raw =
      typeof payload?.choices?.[0]?.message?.content === "string"
        ? payload.choices[0].message.content
        : null;
    const comment = raw?.trim() || null;

    const usage = normalizeUsage(payload?.usage);
    console.log("[ai-comment] cloudflare_fallback.success", {
      leaderboardType,
      model: cf.model,
      latencyMs,
      token_usage: usage,
    });

    return comment || null;
  } catch (error) {
    console.warn("[ai-comment] cloudflare_fallback error", {
      leaderboardType,
      error: error.message,
    });
    return null;
  }
};

// ── Public API ───────────────────────────────────────────────────

/**
 * Run 0G Compute first with production-grade token budget; fallback to CF if needed.
 * @returns {{ comment: string|null, inferenceSource: '0g_compute'|'cloudflare_fallback'|null }}
 */
const generateLeaderboardComment = async ({
  currentPlayer,
  topPlayer,
  leaderboardType,
}) => {
  const zgResult = await generateCommentZerog({
    currentPlayer,
    topPlayer,
    leaderboardType,
  });

  if (zgResult.ok && zgResult.comment) {
    return {
      comment: zgResult.comment,
      inferenceSource: "0g_compute",
    };
  }

  console.log("[ai-comment] using cloudflare fallback", {
    leaderboardType,
    reason: zgResult.phase || "0g_failed",
  });

  const cfComment = await generateCommentCloudflare({
    currentPlayer,
    topPlayer,
    leaderboardType,
  });

  if (cfComment && isValidLeaderboardComment(cfComment)) {
    return {
      comment: cfComment.trim(),
      inferenceSource: "cloudflare_fallback",
    };
  }

  console.warn("[ai-comment] primary and fallback failed or unusable output", {
    leaderboardType,
  });

  return { comment: null, inferenceSource: null };
};

module.exports = { generateLeaderboardComment };
