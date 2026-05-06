const assert = require('node:assert');
const { describe, it, beforeEach, afterEach } = require('node:test');
const aiCommentService = require('../services/aiCommentService');

describe('aiCommentService', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.ZEROG_API_KEY = 'test-key';
    process.env.CF_ACCOUNT_ID = 'test-account';
    process.env.CF_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ZEROG_API_KEY;
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_API_TOKEN;
  });

  it('falls back to Cloudflare when 0G Compute fails', async () => {
    let callCount = 0;
    global.fetch = async (url) => {
      callCount += 1;
      if (url.includes('/chat/completions') && callCount === 1) {
        return {
          ok: false,
          status: 500,
          text: async () => 'gateway error',
        };
      }

      if (url.includes('api.cloudflare.com')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Nice work, keep chasing the leader!' } }],
            usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
          }),
        };
      }

      throw new Error(`Unexpected url called: ${url}`);
    };

    const { comment, inferenceSource } = await aiCommentService.generateLeaderboardComment({
      currentPlayer: { userGameData: { playerName: 'Player', currency: 100 } },
      topPlayer: { userGameData: { playerName: 'Leader', currency: 200 } },
      leaderboardType: 'global',
    });

    assert.strictEqual(comment, 'Nice work, keep chasing the leader!');
    assert.strictEqual(inferenceSource, 'cloudflare_fallback');
  });
});
