const { Indexer, MemData } = require('@0gfoundation/0g-storage-ts-sdk');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mainnet endpoints — override with env vars if needed
const MAINNET_EVM_RPC     = 'https://evmrpc.0g.ai';
const MAINNET_INDEXER_RPC = 'https://indexer-storage-turbo.0g.ai';

const UPLOAD_TIMEOUT_MS  = 30_000;
const VERIFY_TIMEOUT_MS  = 15_000;

const getConfig = () => ({
  privateKey:  process.env.ZEROG_DA_PRIVATE_KEY,
  evmRpc:      process.env.ZEROG_DA_EVM_RPC      || MAINNET_EVM_RPC,
  indexerRpc:  process.env.ZEROG_DA_INDEXER_RPC  || MAINNET_INDEXER_RPC,
  enabled:     !!process.env.ZEROG_DA_PRIVATE_KEY,
});

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[0g-da] ${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

// Compact player state snapshot — only game-relevant fields
const buildSnapshot = (identifier, playerData) => ({
  game:       'highway-hustle',
  version:    1,
  identifier,
  timestamp:  new Date().toISOString(),
  snapshot: {
    playerName:      playerData?.userGameData?.playerName     || 'Unnamed',
    currency:        playerData?.userGameData?.currency        || 0,
    totalPlayedTime: playerData?.userGameData?.totalPlayedTime || 0,
    scores: {
      bestScoreOneWay:    playerData?.playerGameModeData?.bestScoreOneWay    || 0,
      bestScoreTwoWay:    playerData?.playerGameModeData?.bestScoreTwoWay    || 0,
      bestScoreTimeAttack:playerData?.playerGameModeData?.bestScoreTimeAttack|| 0,
      bestScoreBomb:      playerData?.playerGameModeData?.bestScoreBomb      || 0,
    },
    vehicles:     playerData?.playerVehicleData || {},
    achievements: playerData?.campaignData      || {},
  },
});

// Upload player state to 0G DA (mainnet).
// Returns { rootHash, txHash, txSeq } or null — NEVER throws.
const uploadPlayerSnapshot = async (identifier, playerData) => {
  const config = getConfig();

  if (!config.enabled) {
    console.warn('[0g-da] Skipped: ZEROG_DA_PRIVATE_KEY not set');
    return null;
  }

  try {
    const buffer  = Buffer.from(JSON.stringify(buildSnapshot(identifier, playerData)));
    const memData = new MemData(buffer);

    const provider = new ethers.JsonRpcProvider(config.evmRpc);
    const signer   = new ethers.Wallet(config.privateKey, provider);
    const indexer  = new Indexer(config.indexerRpc);

    const [result, err] = await withTimeout(
      indexer.upload(memData, config.evmRpc, signer),
      UPLOAD_TIMEOUT_MS,
      'upload'
    );

    if (err) throw new Error(String(err));

    const { txHash, rootHash, txSeq } = result;
    console.log(`[0g-da] ✅ Snapshot | player: ${identifier} | rootHash: ${rootHash} | tx: ${txHash}`);

    return { rootHash, txHash, txSeq };
  } catch (err) {
    console.warn(`[0g-da] ⚠️ Upload failed (${identifier}): ${err.message}`);
    return null;
  }
};

// Download + verify a snapshot from 0G DA by rootHash.
// Returns { verified, data? } — NEVER throws.
const verifyPlayerSnapshot = async (rootHash) => {
  const config = getConfig();

  if (!config.enabled) return { verified: false, reason: 'not_configured' };
  if (!rootHash)        return { verified: false, reason: 'no_root_hash' };

  const tmpOut = path.join(os.tmpdir(), `hh-da-verify-${Date.now()}.json`);

  try {
    const indexer = new Indexer(config.indexerRpc);

    const err = await withTimeout(
      indexer.download(rootHash, tmpOut, true),
      VERIFY_TIMEOUT_MS,
      'verify'
    );

    if (err) return { verified: false, reason: String(err) };

    if (!fs.existsSync(tmpOut)) return { verified: false, reason: 'file_not_written' };

    const data = JSON.parse(fs.readFileSync(tmpOut, 'utf-8'));
    return { verified: true, data };
  } catch (err) {
    return { verified: false, reason: err.message };
  } finally {
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
  }
};

const healthCheck = () => {
  const config = getConfig();
  return {
    enabled:    config.enabled,
    network:    'mainnet',
    indexerRpc: config.indexerRpc,
    evmRpc:     config.evmRpc,
  };
};

module.exports = { uploadPlayerSnapshot, verifyPlayerSnapshot, healthCheck };
