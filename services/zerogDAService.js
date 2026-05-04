/**
 * 0G DA Service — Highway Hustle
 *
 * Sends player game events to the deployed 0G DA Event Gateway:
 *   https://da.warzonewarriors.xyz
 *
 * The gateway accepts HTTP events, batches them, and forwards them to the
 * 0G DA disperser node via gRPC (DisperseBlob → GetBlobStatus → CONFIRMED).
 * Each event is assigned an eventId that can be used to poll status and
 * retrieve the original blob from the DA network.
 *
 * Auth:    Authorization: Bearer <ZEROG_DA_API_KEY>
 * Ref:     https://github.com/RonitSDE/zero_g_da_event_gateway
 */

const { randomUUID } = require('crypto');

const GATEWAY_URL     = process.env.ZEROG_DA_GATEWAY_URL || 'https://da.warzonewarriors.xyz';
const SUBMIT_TIMEOUT  = 10_000;  // 10s — gateway just enqueues, very fast
const STATUS_TIMEOUT  = 8_000;
const RETRIEVE_TIMEOUT= 12_000;

// ─── Config ──────────────────────────────────────────────────────────────────

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const key = process.env.ZEROG_DA_API_KEY;
  if (key) headers['Authorization'] = `Bearer ${key}`;
  return headers;
};

const summarizeIdentifier = (id) => {
  const s = String(id || '');
  if (s.length <= 14) return s || '(empty)';
  return `${s.slice(0, 10)}…${s.slice(-4)}`;
};

const logStartup = () => {
  console.log('[0g-da] startup config', {
    gatewayUrl: GATEWAY_URL,
    eventsUrl: `${GATEWAY_URL.replace(/\/+$/, '')}/v1/events`,
    statusUrlPattern: `${GATEWAY_URL.replace(/\/+$/, '')}/v1/da/status/:eventId`,
    hasZerogDaApiKey: Boolean(process.env.ZEROG_DA_API_KEY),
    zerogDaGatewayEnv: process.env.ZEROG_DA_GATEWAY_URL || '(using default above)',
    zerogDaEnabledEnv: process.env.ZEROG_DA_ENABLED || '(unset)',
    submitTimeoutMs: SUBMIT_TIMEOUT,
    note:
      'Events POST here. If your custom gateway sees nothing, set ZEROG_DA_GATEWAY_URL to that server URL and restart.',
  });
};
logStartup();

// ─── Payload builder ─────────────────────────────────────────────────────────

const buildEventData = (identifier, playerData) => ({
  identifier,
  playerName:      playerData?.userGameData?.playerName      || 'Unnamed',
  currency:        playerData?.userGameData?.currency         || 0,
  totalPlayedTime: playerData?.userGameData?.totalPlayedTime  || 0,
  scores: {
    bestScoreOneWay:     playerData?.playerGameModeData?.bestScoreOneWay     || 0,
    bestScoreTwoWay:     playerData?.playerGameModeData?.bestScoreTwoWay     || 0,
    bestScoreTimeAttack: playerData?.playerGameModeData?.bestScoreTimeAttack || 0,
    bestScoreBomb:       playerData?.playerGameModeData?.bestScoreBomb       || 0,
  },
  vehicles:     playerData?.playerVehicleData || {},
  achievements: playerData?.campaignData      || {},
  recordedAt:   new Date().toISOString(),
});

// ─── Submit event to 0G DA gateway ───────────────────────────────────────────
//
// We generate our own eventId so we can track it in MongoDB later.
// The gateway stores it and lets us poll /v1/da/status/:eventId.
//
// Returns { eventId } or null on failure. NEVER throws.

const submitPlayerEvent = async (eventName, identifier, playerData) => {
  const eventId = randomUUID();   // we own this ID
  const postUrl = `${GATEWAY_URL.replace(/\/+$/, '')}/v1/events`;

  try {
    const body = {
      eventId,                    // gateway stores this — lets us look it up later
      game:  'highwayHustle',
      event: eventName,           // e.g. 'score.best' | 'achievement.unlock'
      data:  buildEventData(identifier, playerData),
    };
    const payloadJson = JSON.stringify(body);
    const payloadBytes = Buffer.byteLength(payloadJson, 'utf8');

    console.log('[0g-da] submit → HTTP POST', {
      url: postUrl,
      eventId,
      event: eventName,
      identifier: summarizeIdentifier(identifier),
      payloadBytes,
      hasBearer: Boolean(process.env.ZEROG_DA_API_KEY),
    });

    const res = await fetch(postUrl, {
      method:  'POST',
      headers: getHeaders(),
      body:    payloadJson,
      signal:  AbortSignal.timeout(SUBMIT_TIMEOUT),
    });

    const rawText = await res.text().catch(() => '');

    if (!res.ok) {
      console.warn('[0g-da] submit ✗ HTTP error', {
        status: res.status,
        statusText: res.statusText,
        url: postUrl,
        eventId,
        event: eventName,
        bodySnippet: rawText.slice(0, 800),
      });
      throw new Error(`Gateway ${res.status}: ${rawText.slice(0, 200)}`);
    }

    let json = {};
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch (parseErr) {
      console.warn('[0g-da] submit response not JSON', {
        eventId,
        rawSnippet: rawText.slice(0, 400),
        parseErr: parseErr.message,
      });
      throw parseErr;
    }

    console.log('[0g-da] submit ✓ gateway accepted', {
      eventId,
      event: eventName,
      identifier: summarizeIdentifier(identifier),
      gatewaySuccess: json.success,
      accepted: json.accepted,
      queued: json.queued,
    });

    return { eventId };
  } catch (err) {
    console.warn('[0g-da] submit failed (returns null to caller)', {
      event: eventName,
      identifier: summarizeIdentifier(identifier),
      eventId,
      message: err.message,
    });
    return null;
  }
};

// ─── Poll DA status for an eventId ───────────────────────────────────────────
//
// Returns the full status doc from the gateway, or null on failure.
// status field: 'submitted' | 'processing' | 'confirmed' | 'finalized' | 'failed'
// daBlobInfo: { storageRoot, epoch, quorumId } — available once confirmed

const getEventStatus = async (eventId) => {
  if (!eventId) return null;

  try {
    const res = await fetch(`${GATEWAY_URL}/v1/da/status/${eventId}`, {
      headers: getHeaders(),
      signal:  AbortSignal.timeout(STATUS_TIMEOUT),
    });

    if (!res.ok) {
      if (res.status === 404) return { found: false };
      throw new Error(`Status check ${res.status}`);
    }

    const doc = await res.json();
    return {
      found:       true,
      eventId:     doc.eventId,
      status:      doc.status,
      daReference: doc.daReference,
      daStatus:    doc.daStatus,
      daBlobInfo:  doc.daBlobInfo,   // { storageRoot, epoch, quorumId }
      error:       doc.error,
      createdAt:   doc.createdAt,
      updatedAt:   doc.updatedAt,
    };
  } catch (err) {
    console.warn('[0g-da] status check failed', { eventId: summarizeIdentifier(eventId), message: err.message });
    return null;
  }
};

// ─── Retrieve blob data from 0G DA network ───────────────────────────────────
//
// Gateway calls RetrieveBlob gRPC with { storageRoot, epoch, quorumId }.
// Returns the original event payload as dataBase64.

const retrievePlayerEvent = async (eventId) => {
  if (!eventId) return { retrieved: false, reason: 'no_event_id' };

  try {
    const res = await fetch(`${GATEWAY_URL}/v1/da/retrieve/${eventId}`, {
      method:  'POST',
      headers: getHeaders(),
      signal:  AbortSignal.timeout(RETRIEVE_TIMEOUT),
    });

    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      return { retrieved: false, reason: 'not_finalized_yet', daStatus: body.daStatus };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { retrieved: false, reason: body.message || `gateway_${res.status}` };
    }

    const doc = await res.json();
    // doc.retrieved = { dataBase64, size }
    // decode the base64 payload back to JSON
    let data = null;
    if (doc.retrieved?.dataBase64) {
      try {
        data = JSON.parse(Buffer.from(doc.retrieved.dataBase64, 'base64').toString('utf-8'));
      } catch (_) {
        data = doc.retrieved.dataBase64;  // return raw if parse fails
      }
    }

    return {
      retrieved:  true,
      eventId:    doc.eventId,
      daBlobInfo: doc.daBlobInfo,
      data,
    };
  } catch (err) {
    return { retrieved: false, reason: err.message };
  }
};

// ─── Health check ─────────────────────────────────────────────────────────────

const healthCheck = async () => {
  try {
    const res = await fetch(`${GATEWAY_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await res.json();
    return {
      gateway: GATEWAY_URL,
      online:  !!body.ready,
      ...body,
    };
  } catch (err) {
    return { gateway: GATEWAY_URL, online: false, error: err.message };
  }
};

const getGatewayBaseUrl = () => GATEWAY_URL.replace(/\/+$/, '');

/** For support / debugging — same fields as startup log */
const getDebugSummary = () => ({
  gatewayUrl: GATEWAY_URL,
  eventsUrl: `${GATEWAY_URL.replace(/\/+$/, '')}/v1/events`,
  hasApiKey: Boolean(process.env.ZEROG_DA_API_KEY),
});

module.exports = {
  submitPlayerEvent,
  getEventStatus,
  retrievePlayerEvent,
  healthCheck,
  getGatewayBaseUrl,
  getDebugSummary,
};
