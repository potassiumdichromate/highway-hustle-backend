const assert = require('node:assert');
const { describe, it, beforeEach, afterEach } = require('node:test');
const daService = require('../services/zerogDAService');

describe('zerogDAService', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.ZEROG_DA_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ZEROG_DA_API_KEY;
  });

  it('returns an eventId when gateway accepts the submission', async () => {
    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ success: true, accepted: true, queued: true }),
    });

    const result = await daService.submitPlayerEvent('score.best', 'player-abc', {
      userGameData: { playerName: 'Test' },
    });

    assert.ok(result && typeof result.eventId === 'string');
  });

  it('returns null when gateway responds with an HTTP error', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom',
    });

    const result = await daService.submitPlayerEvent('score.best', 'player-abc', {});
    assert.strictEqual(result, null);
  });
});
