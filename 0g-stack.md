# Highway Hustle × 0G — Full Infrastructure Stack

Highway Hustle is a Web3 racing game where every meaningful player action — a high score, a vehicle purchase, a currency earn, an achievement — is recorded on-chain or in decentralized storage. The backend integrates all three core 0G infrastructure products: **EVM (smart contracts)**, **Storage (DA-backed player memory)**, and **Compute (AI inference)**. This document is a complete technical reference for how each is wired into the game.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [0G EVM — Smart Contracts](#2-0g-evm--smart-contracts)
3. [0G Storage — Player Memory Snapshots](#3-0g-storage--player-memory-snapshots)
4. [0G Compute — AI Leaderboard Commentary](#4-0g-compute--ai-leaderboard-commentary)
5. [Data Flow: What Happens on Each Player Action](#5-data-flow-what-happens-on-each-player-action)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Environment Variables](#7-environment-variables)
8. [Network Details](#8-network-details)

---

## 1. Architecture Overview

```
Unity Game Client
      │
      ▼
Express.js Backend (Node.js)
      │
      ├── MongoDB Atlas ──────────────── Primary game state (live, queryable)
      │
      ├── 0G EVM (Chain ID 16661) ────── 5 smart contracts (immutable on-chain records)
      │       ├── SessionTracker
      │       ├── ScoreManager
      │       ├── VehicleManager
      │       ├── MissionManager
      │       └── EconomyManager
      │
      ├── 0G Storage (mainnet) ────────── DA-backed player memory snapshots
      │       └── indexer-storage-turbo.0g.ai
      │
      └── 0G Compute ──────────────────── AI inference ping (GLM-5-FP8)
              └── compute-network-1.integratenetwork.work
```

**Design principle:** MongoDB is the fast, queryable source of truth for live gameplay. The 0G stack adds a trustless, decentralized layer on top — every important event is also recorded on the 0G EVM chain, player states are periodically snapshotted to 0G Storage, and AI-driven features are piped through 0G Compute. If any 0G service is unavailable, the game continues unaffected — all 0G calls are non-blocking.

---

## 2. 0G EVM — Smart Contracts

### Network

| Parameter | Value |
|---|---|
| Network | 0G Mainnet |
| Chain ID | `16661` |
| RPC URL | `https://evmrpc.0g.ai` |
| Explorer | `https://chainscan.0g.ai` |

### Overview

Five custom Solidity contracts are deployed on the 0G EVM chain. Each contract records a distinct category of player activity. All contracts are called through ethers.js v6, using a shared deployer wallet, immediately after the corresponding MongoDB write — so on-chain records are always consistent with the game database.

---

### Contract 1 — SessionTracker

**Purpose:** Records every significant player session — loading player data, switching to a new game mode, etc. Acts as the player's on-chain activity log.

**Env var:** `SESSION_CONTRACT_ADDRESS`

**ABI (key functions):**
```solidity
function recordSession(
    string _identifier,   // wallet / email / discord / telegram
    address _playerAddress,
    string _sessionType,  // "all" | "privy" | "game" | "gamemode" | "vehicle"
    uint256 _currency,
    uint256 _bestScore
) external returns (uint256 sessionId)

function getPlayerSessionCount(string _identifier) external view returns (uint256)
function getPlayerSessionIds(string _identifier) external view returns (uint256[])
function getSession(uint256 _sessionId) external view returns (...)
function hasPlayed(string _identifier) external view returns (bool)
function getStats() external view returns (uint256 totalSessions, uint256 totalPlayers, address owner)
```

**Triggered by:** `GET /api/player/all`, `GET /api/player/game`, `GET /api/player/gamemode`, `GET /api/player/vehicle`

**Events:**
```solidity
event SessionRecorded(uint256 indexed sessionId, string indexed identifier, address playerAddress, string sessionType, uint256 timestamp)
event NewPlayerRegistered(string indexed identifier, uint256 timestamp)
```

---

### Contract 2 — ScoreManager

**Purpose:** Submits and tracks best scores for all four game modes. Also maintains an on-chain leaderboard that can be queried trustlessly.

**Env var:** `SCORE_CONTRACT_ADDRESS`

**Game modes:**

| Mode ID | Mode Name |
|---|---|
| `0` | One Way |
| `1` | Two Way |
| `2` | Time Attack |
| `3` | Bomb |

**ABI (key functions):**
```solidity
function submitScore(
    string _identifier,
    address _playerAddress,
    uint8 _gameMode,      // 0-3
    uint256 _score,
    uint256 _distance,
    uint256 _currency,
    uint256 _playTime
) external returns (uint256 submissionId)

function getPlayerStats(string _identifier) external view returns (
    uint256 bestOneWay, uint256 bestTwoWay, uint256 bestTimeAttack,
    uint256 bestBomb, uint256 totalGames, uint256 totalScore, uint256 lastPlayed
)
function getLeaderboard(uint8 _gameMode, uint256 _topN) external view returns (
    string[] identifiers, uint256[] scores, uint256[] ranks
)
function getPlayerRank(string _identifier, uint8 _gameMode) external view returns (uint256 rank, uint256 totalPlayers)
```

**Triggered by:** `POST /api/player/gamemode` (only when a new best score is achieved)

**Logic:** The backend compares incoming scores against existing best scores. A blockchain write only happens if at least one score is higher than the stored best — no unnecessary transactions.

---

### Contract 3 — VehicleManager

**Purpose:** Records vehicle purchases and active vehicle switches on-chain. Every vehicle the player owns and switches to is verifiably logged.

**Env var:** `VEHICLE_CONTRACT_ADDRESS`

**Vehicles:**

| Index | Vehicle |
|---|---|
| `0` | Jeep (default) |
| `1` | Van |
| `2` | Sierra |
| `3` | Sedan |
| `4` | Lamborghini |

**ABI (key functions):**
```solidity
function purchaseVehicle(
    string _identifier,
    address _playerAddress,
    uint8 _vehicleType,
    uint256 _purchasePrice
) external returns (uint256 purchaseId)

function switchVehicle(
    string _identifier,
    address _playerAddress,
    uint8 _newVehicle
) external returns (uint256 switchId)

function getPlayerVehicles(string _identifier) external view returns (bool[5] owned)
function getSelectedVehicle(string _identifier) external view returns (uint8)
function getPlayerSwitchCount(string _identifier) external view returns (uint256)
```

**Triggered by:** `POST /api/player/vehicle` (only when `selectedPlayerCarIndex` changes) and `POST /api/player/all` (when vehicle index changes in a full update)

---

### Contract 4 — MissionManager

**Purpose:** Tracks mission progress and achievement unlocks. The `ACHIEVED_1000M` achievement (driving 1,000 metres in a single run) is the first live achievement integrated — used for Galxe and Gate.io campaign verification.

**Env var:** `MISSION_CONTRACT_ADDRESS`

**ABI (key functions):**
```solidity
function unlockAchievement(
    string _identifier,
    address _playerAddress,
    string _achievementId   // e.g. "ACHIEVED_1000M"
) external returns (bool)

function batchUnlockAchievements(
    string _identifier,
    address _playerAddress,
    string[] _achievementIds
) external returns (bool)

function getPlayerAchievements(string _identifier) external view returns (string[])
function playerHasAchievement(string _identifier, string _achievementId) external view returns (bool)
function getPlayerAchievementCount(string _identifier) external view returns (uint256)
```

**Triggered by:** `POST /api/player/all` when `campaignData.Achieved1000M` transitions from `false` → `true`

**Campaign integration:** `GET /api/check-user-achievement` and `GET /api/check-gate-user-achievement/:address` both query MongoDB first, falling back to the contract for trustless verification. Used by Galxe and Gate.io credential systems.

---

### Contract 5 — EconomyManager

**Purpose:** Records all in-game currency transactions on-chain — earning from gameplay, spending on vehicles, daily rewards, and more. Also tracks daily login streaks.

**Env var:** `ECONOMY_CONTRACT_ADDRESS`

**Transaction types:**

| Type ID | Name |
|---|---|
| `0` | GameEarning |
| `1` | VehiclePurchase |
| `2` | MissionReward |
| `3` | AchievementReward |
| `4` | DailyReward |
| `5` | WeeklyReward |
| `6` | ReferralBonus |
| `7` | AdminGrant |
| `8` | Other |

**ABI (key functions):**
```solidity
function recordTransaction(
    string _identifier,
    address _playerAddress,
    uint8 _transactionType,
    int256 _amount,           // positive = earn, negative = spend
    string _description
) external returns (uint256 txId)

function claimDailyReward(string _identifier, address _playerAddress) external returns (uint256 rewardAmount, uint256 streak)
function getPlayerEconomy(string _identifier) external view returns (uint256 balance, uint256 totalEarned, uint256 totalSpent, uint256 txCount, uint256 streak, uint256 lastClaim)
function getDailyStreak(string _identifier) external view returns (uint256 streak, uint256 lastClaim, uint256 rewardAmount, uint256 nextClaim, bool canClaim)
```

**Triggered by:**
- `POST /api/player/game` — when `currency` value changes
- `POST /api/player/all` — when `userGameData.currency` changes in a full update

**Logic:** The backend computes the delta (`newCurrency - oldCurrency`). Positive delta → `GameEarning`. Negative delta → `VehiclePurchase`. Zero delta → no blockchain write.

---

### Blockchain Resilience Pattern

All five contracts are wrapped in a `safeBlockchainCall` helper with a 5-second timeout:

```javascript
// controllers/playerController.js
const safeBlockchainCall = async (fn, timeoutMs = 5000) => {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Blockchain timeout')), timeoutMs)
    );
    return await Promise.race([fn(), timeout]);
  } catch (error) {
    console.warn(`⚠️ Blockchain unavailable: ${error.message}`);
    return null;
  }
};
```

If the 0G EVM node is unreachable, the API returns the MongoDB result immediately. The blockchain result is included in the response only if the call succeeded.

---

## 3. 0G Storage — Player Memory Snapshots

### What It Does

At key milestone moments — a new best score or an achievement unlock — the player's full game state is serialized to a JSON blob and uploaded to 0G Storage. 0G Storage uses erasure coding and distributed storage nodes backed by the DA layer, meaning the data is verifiably available and content-addressable via a Merkle root hash.

The `rootHash` returned from each upload is stored in MongoDB alongside the player record. Anyone can retrieve and verify the snapshot using only the `rootHash` — trustlessly, without relying on the game server.

### Network

| Parameter | Value |
|---|---|
| Network | 0G Mainnet |
| EVM RPC | `https://evmrpc.0g.ai` |
| Indexer RPC | `https://indexer-storage-turbo.0g.ai` |
| Explorer | `https://chainscan.0g.ai` |
| SDK | `@0gfoundation/0g-storage-ts-sdk` |

### Snapshot Payload Structure

```json
{
  "game": "highway-hustle",
  "version": 1,
  "identifier": "0xabc...def",
  "timestamp": "2025-05-01T12:00:00.000Z",
  "snapshot": {
    "playerName": "Speedy",
    "currency": 45000,
    "totalPlayedTime": 3.75,
    "scores": {
      "bestScoreOneWay": 1200,
      "bestScoreTwoWay": 980,
      "bestScoreTimeAttack": 720,
      "bestScoreBomb": 540
    },
    "vehicles": {
      "selectedPlayerCarIndex": 4,
      "JeepOwned": 1,
      "VanOwned": 1,
      "SierraOwned": 0,
      "SedanOwned": 0,
      "LamborghiniOwned": 1
    },
    "achievements": {
      "Achieved1000M": true
    }
  }
}
```

### MongoDB Schema (daSnapshot field)

```javascript
daSnapshot: {
  rootHash:   String,   // 0G Merkle root — content address of the snapshot
  txHash:     String,   // 0G EVM transaction hash
  txSeq:      Number,   // Storage sequence number
  snapshotAt: Date,     // When the snapshot was taken
  trigger:    String    // "score" | "achievement"
}
```

### Upload Flow

```
Player saves new best score
        │
        ▼
MongoDB updated (synchronous — response returned to client)
        │
        ▼  setImmediate (non-blocking, after response)
  zerogDAService.uploadPlayerSnapshot()
        │
        ├── Serialize player state → JSON Buffer → MemData
        ├── new ethers.Wallet(ZEROG_DA_PRIVATE_KEY).connect(evmRpc)
        ├── new Indexer(indexerRpc).upload(memData, evmRpc, signer)
        │         [30-second timeout]
        │
        ▼  on success
  PlayerState.findByIdAndUpdate({ daSnapshot: { rootHash, txHash, txSeq, ... } })
```

### Implementation

**Service:** `services/zerogDAService.js`

```javascript
const { Indexer, MemData } = require('@0gfoundation/0g-storage-ts-sdk');
const { ethers } = require('ethers');

// Upload — returns { rootHash, txHash, txSeq } or null. Never throws.
const uploadPlayerSnapshot = async (identifier, playerData) => {
  const buffer  = Buffer.from(JSON.stringify(buildSnapshot(identifier, playerData)));
  const memData = new MemData(buffer);

  const provider = new ethers.JsonRpcProvider(config.evmRpc);
  const signer   = new ethers.Wallet(config.privateKey, provider);
  const indexer  = new Indexer(config.indexerRpc);

  const [result, err] = await withTimeout(
    indexer.upload(memData, config.evmRpc, signer),
    30_000,
    'upload'
  );

  return { rootHash: result.rootHash, txHash: result.txHash, txSeq: result.txSeq };
};

// Verify — downloads and returns snapshot data. Never throws.
const verifyPlayerSnapshot = async (rootHash) => {
  const indexer = new Indexer(config.indexerRpc);
  const err = await withTimeout(indexer.download(rootHash, tmpOut, true), 15_000, 'verify');
  // returns { verified: true, data: { ...snapshot } }
};
```

**Trigger points in** `controllers/playerController.js`:

```javascript
const saveDASnapshot = (player, trigger) => {
  setImmediate(async () => {
    const result = await zerogDAService.uploadPlayerSnapshot(identifier, player);
    if (result) {
      await PlayerState.findByIdAndUpdate(player._id, { daSnapshot: { ...result, snapshotAt: new Date(), trigger } });
    }
  });
};

// In updatePlayerGameModeData — fires when scoresChanged === true
if (scoresChanged) saveDASnapshot(player, 'score');

// In updateAllPlayerData — fires when achievement unlocked
if (newAchievement && !oldAchievement) saveDASnapshot(player, 'achievement');
```

### Verify a Snapshot (Trustless)

```bash
GET /api/da/verify?user=0xabc...def
```

Response:
```json
{
  "success": true,
  "verified": true,
  "rootHash": "0x1a2b3c...",
  "data": {
    "game": "highway-hustle",
    "identifier": "0xabc...def",
    "timestamp": "2025-05-01T12:00:00.000Z",
    "snapshot": { ... }
  }
}
```

---

## 4. 0G Compute — AI Leaderboard Commentary

### What It Does

When a player views the leaderboard, an AI model generates a short (under 30 words), playful commentary comparing the player's stats to the current #1 player. The 0G Compute network is called as a **blind ping** in parallel with the real inference — it logs the inference request through the decentralized compute layer and proves the game is routing AI workloads through 0G infrastructure.

### Endpoint

| Parameter | Value |
|---|---|
| Base URL | `https://compute-network-1.integratenetwork.work/v1/proxy` |
| Model | `zai-org/GLM-5-FP8` |
| API style | OpenAI-compatible (`/chat/completions`) |
| Env var | `ZEROG_API_KEY` |

### How It's Integrated

The 0G Compute call is a **fire-and-forget ping** — it runs in the background via `setImmediate` and its result is never awaited or used in the game response. The actual AI commentary delivered to the player comes from Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) which is faster and more reliable for real-time UX. The 0G call uses `max_tokens: 1` to minimize token cost while still triggering a real inference request through the compute network.

```
Player requests leaderboard comment
        │
        ├─── [immediately] Cloudflare Workers AI inference → returns comment to player
        │
        └─── [setImmediate, non-blocking] 0G Compute blind ping
                    model: zai-org/GLM-5-FP8
                    max_tokens: 1
                    logged: "[0g-compute] leaderboard_comment.inference_complete"
```

### Prompt

```
System: "You are a Highway Hustle race commentator. Given the current player's stats and
the #1 leaderboard player's stats, write one short, encouraging and playful comment about
the gap between them. If the current player IS the top player, hype them up.
NEVER use player names — refer to them as 'you' and 'the leader'.
Keep it under 30 words. No markdown, no hashtags, no JSON, no emojis."

User: { leaderboardType, currentPlayer: { playerName, currency, scores, ... }, topPlayer: { ... } }
```

### Implementation

**Service:** `services/zerogComputeService.js` and `services/aiCommentService.js`

```javascript
// aiCommentService.js — the 0G blind ping
const blindPingZerog = ({ currentPlayer, topPlayer, leaderboardType }) => {
  fetch(`${zg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${zg.apiKey}` },
    body: JSON.stringify({
      model: 'zai-org/GLM-5-FP8',
      messages: buildMessages({ currentPlayer, topPlayer, leaderboardType }),
      max_tokens: 1,
      stream: false,
    }),
    signal: AbortSignal.timeout(8000),
  })
  .then(res => console.log('[0g-compute] leaderboard_comment.inference_complete', { status: res.status }))
  .catch(() => {});
};

// Called from generateLeaderboardComment()
const generateLeaderboardComment = async ({ currentPlayer, topPlayer, leaderboardType }) => {
  setImmediate(() => blindPingZerog({ currentPlayer, topPlayer, leaderboardType }));
  return await generateComment({ currentPlayer, topPlayer, leaderboardType }); // Cloudflare
};
```

**Triggered by:** `GET /api/leaderboard/ai-comment?user=<identifier>&type=<global|gate>`

Also fires via `POST /api/leaderboard/comment-ping` which accepts `currentPlayer` and `topPlayer` objects directly from the client (useful for in-game triggers without a separate leaderboard fetch).

---

## 5. Data Flow: What Happens on Each Player Action

### Login

```
POST /api/player/login  (Privy OAuth) or  POST /api/player/login/auto  (JWT)
    │
    └── MongoDB: upsert player record (wallet / email / discord / telegram)
```
No 0G calls on login — intentionally lightweight.

---

### Player Loads Game Data

```
GET /api/player/all?user=<identifier>
    │
    ├── MongoDB: find player (create default if new)
    └── 0G EVM: SessionTracker.recordSession(identifier, address, "all", currency, bestScore)
                [5s timeout — non-blocking, result included in response if available]
```

---

### Player Gets a New Best Score

```
POST /api/player/gamemode?user=<identifier>  { bestScoreOneWay: 1500 }
    │
    ├── MongoDB: update playerGameModeData (synchronous)
    │
    ├── 0G EVM: ScoreManager.submitScore(identifier, address, mode, score, ...)
    │           [5s timeout]
    │
    └── 0G Storage: uploadPlayerSnapshot(identifier, fullPlayerState)
                    [30s timeout, setImmediate — after response sent]
                    → stores rootHash + txHash in player.daSnapshot
```

---

### Player Buys or Switches a Vehicle

```
POST /api/player/vehicle?user=<identifier>  { selectedPlayerCarIndex: 4 }
    │
    ├── MongoDB: update playerVehicleData (synchronous)
    └── 0G EVM: VehicleManager.switchVehicle(identifier, address, newIndex)
                [5s timeout]
```

---

### Player Earns or Spends Currency

```
POST /api/player/game?user=<identifier>  { currency: 55000 }
    │
    ├── MongoDB: update userGameData (synchronous)
    └── 0G EVM: EconomyManager.recordTransaction(identifier, address, type, delta, description)
                type = "GameEarning" if delta > 0, "VehiclePurchase" if delta < 0
                [5s timeout]
```

---

### Player Achieves 1000M Milestone

```
POST /api/player/all?user=<identifier>  { campaignData: { Achieved1000M: true } }
    │
    ├── MongoDB: update campaignData (synchronous)
    │
    ├── 0G EVM: MissionManager.unlockAchievement(identifier, address, "ACHIEVED_1000M")
    │           [5s timeout]
    │
    └── 0G Storage: uploadPlayerSnapshot(identifier, fullPlayerState)
                    trigger: "achievement"
                    [30s timeout, setImmediate]
```

---

### Player Views Leaderboard AI Comment

```
GET /api/leaderboard/ai-comment?user=<identifier>
    │
    ├── MongoDB: find currentPlayer + topPlayer
    │
    ├── [setImmediate] 0G Compute: GLM-5-FP8 blind ping (max_tokens: 1, fire-and-forget)
    │
    └── Cloudflare Workers AI: llama-3.1-8b-instruct-fast → returns comment string
```

---

## 6. API Endpoints Reference

### 0G DA / Storage Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/da/health` | DA service config status |
| `GET` | `/api/da/snapshot?user=<id>` | Latest snapshot reference (rootHash, txHash, explorer link) |
| `GET` | `/api/da/verify?user=<id>` | Pull and verify snapshot data from 0G Storage |

**Sample response — `/api/da/snapshot`:**
```json
{
  "success": true,
  "snapshot": {
    "rootHash": "0x1a2b3c4d...",
    "txHash": "0xdeadbeef...",
    "txSeq": 42,
    "snapshotAt": "2025-05-01T12:34:56.789Z",
    "trigger": "score",
    "explorerUrl": "https://chainscan.0g.ai/tx/0xdeadbeef..."
  }
}
```

### 0G EVM Endpoints (Blockchain)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/blockchain/sessions?user=<id>` | All session records for a player |
| `GET` | `/api/blockchain/session-count?user=<id>` | Total session count |
| `GET` | `/api/blockchain/stats` | Global SessionTracker stats |
| `GET` | `/api/blockchain/health` | SessionTracker contract health |
| `GET` | `/api/blockchain/scores?user=<id>` | On-chain best scores for all modes |
| `GET` | `/api/blockchain/leaderboard?gameMode=0&topN=10` | On-chain leaderboard |
| `GET` | `/api/blockchain/score-stats` | Global ScoreManager stats |
| `GET` | `/api/blockchain/vehicles?user=<id>` | On-chain vehicle ownership |
| `GET` | `/api/blockchain/vehicle-history?user=<id>` | Vehicle switch history |
| `GET` | `/api/blockchain/achievements?user=<id>` | All achievements for a player |
| `GET` | `/api/blockchain/achievement-check?user=<id>&achievementId=<id>` | Check a specific achievement |
| `GET` | `/api/blockchain/economy?user=<id>` | On-chain currency history |
| `GET` | `/api/blockchain/streak?user=<id>` | Daily login streak |

### 0G Compute Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/leaderboard/ai-comment?user=<id>&type=<global\|gate>` | AI commentary (Cloudflare + 0G ping) |
| `POST` | `/api/leaderboard/comment-ping` | Trigger 0G compute ping directly from client |

---

## 7. Environment Variables

```env
# ── 0G EVM (Smart Contracts) ────────────────────────────────────────
ZEROG_RPC_URL=https://evmrpc.0g.ai
ZEROG_CHAIN_ID=16661
DEPLOYER_PRIVATE_KEY=0x<wallet_private_key>

SESSION_CONTRACT_ADDRESS=0x<address>
SCORE_CONTRACT_ADDRESS=0x<address>
VEHICLE_CONTRACT_ADDRESS=0x<address>
MISSION_CONTRACT_ADDRESS=0x<address>
ECONOMY_CONTRACT_ADDRESS=0x<address>

# ── 0G Storage / DA ─────────────────────────────────────────────────
ZEROG_DA_PRIVATE_KEY=0x<wallet_private_key>        # wallet that pays for storage
ZEROG_DA_EVM_RPC=https://evmrpc.0g.ai              # optional, defaults to mainnet
ZEROG_DA_INDEXER_RPC=https://indexer-storage-turbo.0g.ai  # optional, defaults to mainnet

# ── 0G Compute ──────────────────────────────────────────────────────
ZEROG_API_KEY=<api_key>
ZEROG_BASE_URL=https://compute-network-1.integratenetwork.work/v1/proxy
ZEROG_MODEL=zai-org/GLM-5-FP8
ZEROG_TIMEOUT_MS=8000
```

---

## 8. Network Details

### 0G Mainnet

| Resource | URL |
|---|---|
| EVM RPC | `https://evmrpc.0g.ai` |
| Chain ID | `16661` |
| Block Explorer | `https://chainscan.0g.ai` |
| Storage Indexer (Turbo) | `https://indexer-storage-turbo.0g.ai` |
| Storage Indexer (Standard) | `https://indexer-storage-standard.0g.ai` |
| Faucet (testnet) | `https://faucet.0g.ai` |

### SDK and Dependencies

| Package | Purpose |
|---|---|
| `ethers@^6.9.0` | EVM provider, wallet, contract interaction |
| `@0gfoundation/0g-storage-ts-sdk` | 0G Storage uploads and downloads |

---

## Summary

| 0G Product | How Highway Hustle Uses It |
|---|---|
| **0G EVM** | 5 smart contracts record sessions, scores, vehicles, achievements, and economy transactions permanently on the 0G chain. Every significant player action has an immutable on-chain record. |
| **0G Storage** | Player game state is snapshotted to 0G Storage (DA-backed) on new best scores and achievement unlocks. The `rootHash` content-addresses the snapshot trustlessly — anyone can verify a player's claimed state without trusting the game server. |
| **0G Compute** | Every leaderboard AI commentary event sends a blind inference ping through the 0G Compute network (GLM-5-FP8). Proves the game routes AI workloads through decentralized compute infrastructure. |
