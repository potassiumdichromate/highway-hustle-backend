const PlayerState = require("../models/PlayerState");
const zerogDAService = require("./zerogDAService");

const DEFAULT_RETRY_DELAY_MS = Number(process.env.ZEROG_DA_RETRY_DELAY_MS || 30_000);
const DEFAULT_SYNC_INTERVAL_MS = Number(process.env.ZEROG_DA_SYNC_INTERVAL_MS || 60_000);
const MAX_RETRY_COUNT = Number(process.env.ZEROG_DA_MAX_RETRIES || 5);

const extractIdentifier = (player) => {
  return (
    player?.privyData?.walletAddress ||
    player?.privyData?.discord ||
    player?.privyData?.telegram ||
    player?.privyData?.email ||
    String(player._id)
  );
};

const determineEventName = (trigger) => {
  if (trigger === "achievement") return "achievement.unlock";
  if (trigger === "score") return "score.best";
  if (trigger === "full") return "player.snapshot";
  return "player.snapshot";
};

const buildEventData = (player) => ({
  playerName: player.userGameData?.playerName || "Unnamed",
  currency: player.userGameData?.currency || 0,
  totalPlayedTime: player.userGameData?.totalPlayedTime || 0,
  scores: {
    bestScoreOneWay: player.playerGameModeData?.bestScoreOneWay || 0,
    bestScoreTwoWay: player.playerGameModeData?.bestScoreTwoWay || 0,
    bestScoreTimeAttack: player.playerGameModeData?.bestScoreTimeAttack || 0,
    bestScoreBomb: player.playerGameModeData?.bestScoreBomb || 0,
  },
  vehicles: player.playerVehicleData || {},
  achievements: player.campaignData || {},
  recordedAt: new Date().toISOString(),
});

const buildSnapshotPayload = (player, trigger) => {
  const identifier = extractIdentifier(player);
  const eventName = determineEventName(trigger);
  return {
    eventName,
    identifier,
    data: buildEventData(player),
  };
};

const updateSnapshotRecord = async (playerId, update) => {
  return PlayerState.findByIdAndUpdate(
    playerId,
    { $set: { 'daSnapshot': update } },
    { new: true }
  );
};

const persistFailedPayload = (playerId, snapshot, payload) => {
  return PlayerState.findByIdAndUpdate(playerId, {
    $set: {
      'daSnapshot.pendingPayload': payload,
      'daSnapshot.retryCount': snapshot.retryCount ? snapshot.retryCount + 1 : 1,
      'daSnapshot.lastRetryAt': new Date(),
      'daSnapshot.daStatus': 'failed',
    },
  });
};

const submitSnapshot = async (player, trigger) => {
  const payload = buildSnapshotPayload(player, trigger);
  const eventId = player.daSnapshot?.eventId;

  if (eventId && player.daSnapshot?.daStatus === 'finalized') {
    return { success: true, note: 'already finalized' };
  }

  const submission = await zerogDAService.submitPlayerEvent(
    payload.eventName,
    payload.identifier,
    payload.data
  );

  if (submission?.eventId) {
    await PlayerState.findByIdAndUpdate(player._id, {
      'daSnapshot': {
        eventId: submission.eventId,
        daStatus: 'submitted',
        daReference: null,
        daBlobInfo: null,
        snapshotAt: new Date(),
        trigger,
        pendingPayload: null,
        retryCount: 0,
        lastRetryAt: null,
      },
    });
    return { success: true, eventId: submission.eventId };
  }

  await persistFailedPayload(player._id, player.daSnapshot || {}, payload);
  scheduleRetry(player._id);
  return { success: false, error: 'DA submission failed; payload saved for retry' };
};

const scheduleRetry = async (playerId) => {
  setTimeout(async () => {
    try {
      await retryFailedSnapshots();
    } catch (error) {
      console.warn('[0g-da] scheduled retry failed', error.message);
    }
  }, DEFAULT_RETRY_DELAY_MS);
};

const submitSnapshotAsync = (player, trigger) => {
  setImmediate(async () => {
    try {
      await submitSnapshot(player, trigger);
    } catch (err) {
      console.warn('[0g-da] async snapshot submit failed', err.message);
    }
  });
};

const retryFailedSnapshots = async () => {
  const failed = await PlayerState.find({
    'daSnapshot.daStatus': 'failed',
    'daSnapshot.pendingPayload': { $exists: true, $ne: null },
  }).limit(25).lean();

  for (const record of failed) {
    if (record.daSnapshot.retryCount >= MAX_RETRY_COUNT) {
      continue;
    }

    const payload = record.daSnapshot.pendingPayload;
    try {
      const submission = await zerogDAService.submitPlayerEvent(
        payload.eventName,
        payload.identifier,
        payload.data
      );

      if (submission?.eventId) {
        await PlayerState.findByIdAndUpdate(record._id, {
          'daSnapshot.eventId': submission.eventId,
          'daSnapshot.daStatus': 'submitted',
          'daSnapshot.daReference': null,
          'daSnapshot.daBlobInfo': null,
          'daSnapshot.snapshotAt': new Date(),
          'daSnapshot.pendingPayload': null,
          'daSnapshot.lastRetryAt': new Date(),
        });
        continue;
      }

      await PlayerState.findByIdAndUpdate(record._id, {
        'daSnapshot.retryCount': (record.daSnapshot.retryCount || 0) + 1,
        'daSnapshot.lastRetryAt': new Date(),
      });
    } catch (err) {
      console.warn('[0g-da] retry failed for eventId', record.daSnapshot.eventId, err.message);
      await PlayerState.findByIdAndUpdate(record._id, {
        'daSnapshot.retryCount': (record.daSnapshot.retryCount || 0) + 1,
        'daSnapshot.lastRetryAt': new Date(),
      });
    }
  }
};

const refreshPendingDAStatuses = async () => {
  const pending = await PlayerState.find({
    'daSnapshot.eventId': { $exists: true, $ne: null },
    'daSnapshot.daStatus': { $in: ['submitted', 'confirmed'] },
  }).limit(50).lean();

  for (const record of pending) {
    try {
      const status = await zerogDAService.getEventStatus(record.daSnapshot.eventId);
      if (status && status.found) {
        await PlayerState.findByIdAndUpdate(record._id, {
          'daSnapshot.daStatus': status.daStatus,
          'daSnapshot.daReference': status.daReference || record.daSnapshot.daReference,
          'daSnapshot.daBlobInfo': status.daBlobInfo || record.daSnapshot.daBlobInfo,
        });
      }
    } catch (err) {
      console.warn('[0g-da] refresh status failed for eventId', record.daSnapshot.eventId, err.message);
    }
  }
};

const startBackgroundSync = () => {
  setInterval(async () => {
    try {
      await refreshPendingDAStatuses();
      await retryFailedSnapshots();
    } catch (err) {
      console.warn('[0g-da] background sync error', err.message);
    }
  }, DEFAULT_SYNC_INTERVAL_MS);
};

module.exports = {
  submitSnapshot,
  submitSnapshotAsync,
  retryFailedSnapshots,
  refreshPendingDAStatuses,
  startBackgroundSync,
  buildSnapshotPayload,
};
