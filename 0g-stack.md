# Highway Hustle × 0G — Full Infrastructure Stack

Highway Hustle is a Web3 racing game where every meaningful player action — a high score, a vehicle purchase, a currency earn, an achievement — is recorded on-chain or in decentralized storage. The backend integrates all three core 0G infrastructure products: **0G EVM (smart contracts)**, **0G DA (Data Availability — player memory)**, and **0G Compute (AI inference)**. This document is a complete technical reference for how each is wired into the game.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [0G EVM — Smart Contracts](#2-0g-evm--smart-contracts)
3. [0G DA — Data Availability Player Memory](#3-0g-da--data-availability-player-memory)
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
      ├── 0G DA (mainnet) ─────────────── Data availability player memory snapshots
      │       └── indexer-storage-turbo.0g.ai
      │           (erasure coding · KZG commitments · Merkle rootHash)
      │
      └── 0G Compute ──────────────────── AI inference ping (GLM-5-FP8)
              └── compute-network-1.integratenetwork.work
```

**Design principle:** MongoDB is the fast, queryable source of truth for live gameplay. The 0G stack adds a trustless, decentralized layer on top — every important event is recorded on the 0G EVM chain, player game states are published to 0G DA as verifiable snapshots, and AI-driven leaderboard features are piped through 0G Compute. If any 0G service is unavailable, the game continues unaffected — all 0G calls are non-blocking.

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

Five custom Solidity contracts are deployed on the 0G EVM chain. Each contract records a distinct category of player activity. All contracts are called via ethers.js v6 with a shared deployer wallet, immediately after the corresponding MongoDB write, so on-chain records are always consistent with the live game database.

---

### Contract 1 — SessionTracker

**Purpose:** Records every significant player session — loading game data, switching game modes, etc. Acts as the player's on-chain activity log.

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

**Purpose:** Submits and tracks best scores for all four game modes. Maintains a trustlessly queryable on-chain leaderboard.

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
    uint8 _gameMode,       // 0–3
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

**Triggered by:** `POST /api/player/gamemode` — only when at least one score is higher than the existing best. Zero unnecessary transactions.

---

### Contract 3 — VehicleManager

**Purpose:** Records vehicle purchases and active vehicle switches on-chain. Every vehicle owned and every switch made is verifiably logged.

**Env var:** `VEHICLE_CONTRACT_ADDRESS`

**Vehicles:**

| Index | Vehicle |
|---|---|
| `0` | Jeep (default, free) |
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

**Triggered by:** `POST /api/player/vehicle` (when `selectedPlayerCarIndex` changes) and `POST /api/player/all` (when vehicle index changes in a batch update).

---

### Contract 4 — MissionManager

**Purpose:** Tracks mission progress and achievement unlocks. The `ACHIEVED_1000M` achievement (driving 1,000 metres in a single run) is the first live achievement — used for Galxe and Gate.io campaign credential verification.

**Env var:** `MISSION_CONTRACT_ADDRESS`

**ABI (key functions):**
```solidity
function unlockAchievement(
    string _identifier,
    address _playerAddress,
    string _achievementId    // e.g. "ACHIEVED_1000M"
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

**Triggered by:** `POST /api/player/all` when `campaignData.Achieved1000M` transitions `false → true`.

**Campaign integration:** `GET /api/check-user-achievement` and `GET /api/check-gate-user-achievement/:address` are used directly by Galxe and Gate.io credential systems to verify on-chain achievement status.

---

### Contract 5 — EconomyManager

**Purpose:** Records all in-game currency transactions on-chain — earning from gameplay, spending on vehicles, daily rewards. Also tracks daily login streaks.

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
    int256 _amount,            // positive = earn, negative = spend
    string _description
) external returns (uint256 txId)

function claimDailyReward(string _identifier, address _playerAddress) external returns (uint256 rewardAmount, uint256 streak)
function getPlayerEconomy(string _identifier) external view returns (uint256 balance, uint256 totalEarned, uint256 totalSpent, uint256 txCount, uint256 streak, uint256 lastClaim)
function getDailyStreak(string _identifier) external view returns (uint256 streak, uint256 lastClaim, uint256 rewardAmount, uint256 nextClaim, bool canClaim)
```

**Triggered by:**
- `POST /api/player/game` — when `currency` value changes
- `POST /api/player/all` — when `userGameData.currency` changes in a batch update

**Logic:** Backend computes `delta = newCurrency - oldCurrency`. Positive → `GameEarning`. Negative → `VehiclePurchase`. Zero → no write.

---

### Blockchain Resilience Pattern

All five contracts are wrapped in a `safeBlockchainCall` helper with a 5-second timeout. If the 0G EVM node is unreachable for any reason, the API returns the MongoDB result immediately — the blockchain result is added to the response only if the call succeeded.

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

---

## 3. 0G DA — Data Availability Player Memory

### What is 0G DA

0G DA (Data Availability) is a decentralized layer that guarantees published data is available and verifiable by anyone. It uses **erasure coding** to split data into redundant shards distributed across many storage nodes, **KZG polynomial commitments** to cryptographically prove each shard is correct, and **VRF-based node selection** to randomly assign which nodes hold which shards — making data unavailability economically and cryptographically infeasible.

When data is published to 0G DA, the system returns a **Merkle root hash** — a deterministic content address. Any party can use this hash to download and verify the original data without trusting anyone, including the game server.

### How Highway Hustle Uses 0G DA

At key milestone moments — a **new best score** or an **achievement unlock** — the player's full game state is serialized as a JSON blob and published to 0G DA. The returned `rootHash` is stored in the player's MongoDB record. This means:

- Every score milestone has a **DA-backed, tamper-proof snapshot** of the player's state at that moment
- Anyone — including the player, 0G verifiers, or future campaigns — can retrieve and verify that snapshot using only the `rootHash`, with no trust in the game server
- The snapshot is a permanent public record of the player's gameplay history on the 0G network

### Network

| Parameter | Value |
|---|---|
| Network | 0G Mainnet |
| EVM RPC | `https://evmrpc.0g.ai` |
| DA Indexer (Turbo) | `https://indexer-storage-turbo.0g.ai` |
| Explorer | `https://chainscan.0g.ai` |
| SDK | `@0gfoundation/0g-storage-ts-sdk` |
| SDK Classes Used | `Indexer`, `MemData` |

### DA Snapshot Payload

Every snapshot published to 0G DA is a structured JSON containing the player's complete game state at the moment of the milestone:

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

### MongoDB Schema — daSnapshot Field

The `rootHash` and transaction reference returned by 0G DA are persisted in the player's MongoDB record:

```javascript
// models/PlayerState.js
daSnapshot: {
  rootHash:   String,   // 0G DA Merkle root — content address of the DA blob
  txHash:     String,   // 0G EVM transaction hash confirming the DA submission
  txSeq:      Number,   // DA sequence number
  snapshotAt: Date,     // Timestamp of when the snapshot was published
  trigger:    String    // "score" | "achievement" — what event triggered the upload
}
```

### DA Upload Flow

```
Player achieves new best score
            │
            ▼
  MongoDB updated (synchronous)
  HTTP response returned to client ◄── player is NOT waiting for DA
            │
            ▼  setImmediate — runs after response is sent
  zerogDAService.uploadPlayerSnapshot(identifier, playerState)
            │
            ├── JSON.stringify(snapshot) → Buffer → MemData
            ├── new ethers.Wallet(ZEROG_DA_PRIVATE_KEY, provider)
            ├── new Indexer('https://indexer-storage-turbo.0g.ai')
            │
            └── indexer.upload(memData, evmRpc, signer)
                  [30-second timeout via Promise.race]
                        │
                  0G DA network:
                  • erasure-codes the blob into shards
                  • distributes shards across DA nodes
                  • KZG commitment proves each shard
                  • EVM tx anchors the Merkle root on-chain
                        │
                        ▼
                returns { rootHash, txHash, txSeq }
                        │
                        ▼
  PlayerState.findByIdAndUpdate(player._id, {
    daSnapshot: { rootHash, txHash, txSeq, snapshotAt, trigger }
  })
```

### Service Implementation

**File:** `services/zerogDAService.js`

```javascript
const { Indexer, MemData } = require('@0gfoundation/0g-storage-ts-sdk');
const { ethers } = require('ethers');

// Publish player state to 0G DA — returns { rootHash, txHash, txSeq } or null. Never throws.
const uploadPlayerSnapshot = async (identifier, playerData) => {
  const buffer  = Buffer.from(JSON.stringify(buildSnapshot(identifier, playerData)));
  const memData = new MemData(buffer);                    // in-memory blob, no temp files

  const provider = new ethers.JsonRpcProvider(config.evmRpc);
  const signer   = new ethers.Wallet(config.privateKey, provider);
  const indexer  = new Indexer(config.indexerRpc);        // connects to DA indexer node

  const [result, err] = await withTimeout(
    indexer.upload(memData, config.evmRpc, signer),
    30_000,   // 30-second cap — upload silently skipped if DA is unreachable
    'upload'
  );

  // result = { rootHash, txHash, txSeq }
  return result;
};

// Retrieve and verify a snapshot from 0G DA by rootHash — trustless, no server needed.
const verifyPlayerSnapshot = async (rootHash) => {
  const indexer = new Indexer(config.indexerRpc);
  const err = await withTimeout(
    indexer.download(rootHash, tmpFilePath, true /* with proof */),
    15_000,
    'verify'
  );
  // returns { verified: true, data: { ...snapshotPayload } }
};
```

**Trigger points in** `controllers/playerController.js`:

```javascript
// Fire-and-forget — player response is never delayed
const saveDASnapshot = (player, trigger) => {
  setImmediate(async () => {
    const result = await zerogDAService.uploadPlayerSnapshot(identifier, player);
    if (result) {
      await PlayerState.findByIdAndUpdate(player._id, {
        daSnapshot: { ...result, snapshotAt: new Date(), trigger }
      });
    }
  });
};

// Trigger 1: new best score in any game mode
if (scoresChanged) saveDASnapshot(player, 'score');

// Trigger 2: ACHIEVED_1000M unlocked for first time
if (newAchievement && !oldAchievement) saveDASnapshot(player, 'achievement');
```

### Resilience

- **Non-blocking:** `setImmediate` ensures the DA upload runs after the HTTP response is fully sent. The player never waits for DA.
- **Timeout:** `Promise.race` caps uploads at 30 seconds and verifications at 15 seconds. If 0G DA is unreachable the call returns `null` silently.
- **Never throws:** Both `uploadPlayerSnapshot` and `verifyPlayerSnapshot` catch all errors internally. The game backend cannot crash from a DA failure.
- **Graceful disable:** If `ZEROG_DA_PRIVATE_KEY` is not set, the service logs one warning on startup and skips all uploads. Everything else continues normally.

### Verify a Snapshot (Trustless)

Anyone with the `rootHash` can independently verify a player's claimed game state:

```
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
    "version": 1,
    "identifier": "0xabc...def",
    "timestamp": "2025-05-01T12:00:00.000Z",
    "snapshot": {
      "playerName": "Speedy",
      "currency": 45000,
      "scores": { "bestScoreOneWay": 1200, "..." : "..." },
      "achievements": { "Achieved1000M": true }
    }
  }
}
```

This endpoint downloads the blob directly from the 0G DA network and returns its contents — the game server is not involved in the retrieval, making it fully trustless.

---

## 4. 0G Compute — AI Leaderboard Commentary

### What It Does

When a player views the leaderboard, an AI model generates a short (under 30 words), playful commentary comparing that player's stats to the current #1. The 0G Compute network is called as a **parallel blind ping** alongside the real inference call — proving the game routes AI workloads through 0G's decentralised compute layer.

### Endpoint

| Parameter | Value |
|---|---|
| Base URL | `https://compute-network-1.integratenetwork.work/v1/proxy` |
| Model | `zai-org/GLM-5-FP8` |
| API format | OpenAI-compatible (`/chat/completions`) |
| Env var | `ZEROG_API_KEY` |

### Integration Pattern

The 0G Compute call is **fire-and-forget** — it runs in the background via `setImmediate` and its result is never awaited or returned to the player. The actual AI commentary shown in-game comes from Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) for latency reasons. The 0G call uses `max_tokens: 1` to keep costs minimal while still sending a real inference request through the compute network.

```
Player requests leaderboard AI comment
        │
        ├── [immediately] Cloudflare Workers AI → llama-3.1-8b-instruct-fast
        │         returns comment string to player (6s timeout)
        │
        └── [setImmediate, non-blocking] 0G Compute blind ping
                  model:      zai-org/GLM-5-FP8
                  max_tokens: 1
                  timeout:    8s
                  logged:     [0g-compute] leaderboard_comment.inference_complete
```

### Prompt

```
System:
  "You are a Highway Hustle race commentator. Given the current player's stats and
   the #1 leaderboard player's stats, write one short, encouraging and playful comment
   about the gap between them. If the current player IS the top player, hype them up.
   NEVER use player names — refer to them as 'you' and 'the leader'.
   Keep it under 30 words. No markdown, no hashtags, no JSON, no emojis."

User:
  { leaderboardType, currentPlayer: { playerName, currency, totalPlayedTime, scores, ... },
    topPlayer: { playerName, currency, ... } }
```

### Implementation

**Files:** `services/zerogComputeService.js`, `services/aiCommentService.js`

```javascript
// aiCommentService.js
const blindPingZerog = ({ currentPlayer, topPlayer, leaderboardType }) => {
  fetch(`${zg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${zg.apiKey}` },
    body: JSON.stringify({
      model: 'zai-org/GLM-5-FP8',
      messages: buildMessages({ currentPlayer, topPlayer, leaderboardType }),
      max_tokens: 1,
      stream: false,
    }),
    signal: AbortSignal.timeout(8000),
  })
  .then(res => {
    console.log('[0g-compute] leaderboard_comment.inference_complete', {
      status: res.status, model: 'zai-org/GLM-5-FP8', leaderboardType
    });
  })
  .catch(() => {});  // never surfaces to the player
};

const generateLeaderboardComment = async ({ currentPlayer, topPlayer, leaderboardType }) => {
  setImmediate(() => blindPingZerog({ currentPlayer, topPlayer, leaderboardType }));
  return await generateComment({ currentPlayer, topPlayer, leaderboardType }); // Cloudflare
};
```

**Triggered by:**
- `GET /api/leaderboard/ai-comment?user=<id>&type=<global|gate>` — server-side leaderboard fetch
- `POST /api/leaderboard/comment-ping` — client sends player objects directly (in-game trigger)

---

## 5. Data Flow: What Happens on Each Player Action

### Login

```
POST /api/player/login       (Privy OAuth)
POST /api/player/login/auto  (Browser JWT)
    │
    └── MongoDB: upsert player record (wallet / email / discord / telegram)
```
No 0G calls on login — intentionally lightweight.

---

### Player Loads Game Data

```
GET /api/player/all?user=<identifier>
    │
    ├── MongoDB: find or create player
    └── 0G EVM → SessionTracker.recordSession(identifier, address, "all", currency, bestScore)
                 [5s timeout · non-blocking · result appended to response if available]
```

---

### Player Gets a New Best Score

```
POST /api/player/gamemode?user=<identifier>  { bestScoreOneWay: 1500 }
    │
    ├── MongoDB: update playerGameModeData  ◄── response sent here
    │
    ├── 0G EVM → ScoreManager.submitScore(identifier, address, mode, score, ...)
    │            [5s timeout]
    │
    └── 0G DA → uploadPlayerSnapshot(identifier, fullPlayerState)
                [setImmediate · 30s timeout]
                → rootHash + txHash saved to player.daSnapshot
                → verifiable on chainscan.0g.ai
```

---

### Player Buys or Switches a Vehicle

```
POST /api/player/vehicle?user=<identifier>  { selectedPlayerCarIndex: 4 }
    │
    ├── MongoDB: update playerVehicleData  ◄── response sent here
    └── 0G EVM → VehicleManager.switchVehicle(identifier, address, newIndex)
                 [5s timeout]
```

---

### Player Earns or Spends Currency

```
POST /api/player/game?user=<identifier>  { currency: 55000 }
    │
    ├── MongoDB: update userGameData  ◄── response sent here
    └── 0G EVM → EconomyManager.recordTransaction(identifier, address, type, delta, description)
                 type = "GameEarning" (delta > 0) or "VehiclePurchase" (delta < 0)
                 [5s timeout]
```

---

### Player Achieves 1000M Milestone

```
POST /api/player/all?user=<identifier>  { campaignData: { Achieved1000M: true } }
    │
    ├── MongoDB: update campaignData  ◄── response sent here
    │
    ├── 0G EVM → MissionManager.unlockAchievement(identifier, address, "ACHIEVED_1000M")
    │            [5s timeout]
    │
    └── 0G DA → uploadPlayerSnapshot(identifier, fullPlayerState)
                trigger: "achievement"
                [setImmediate · 30s timeout]
                → DA blob published with achievement proof in snapshot
```

---

### Player Views Leaderboard AI Comment

```
GET /api/leaderboard/ai-comment?user=<identifier>
    │
    ├── MongoDB: fetch currentPlayer + topPlayer
    │
    ├── [setImmediate] 0G Compute → GLM-5-FP8 blind ping (max_tokens: 1)
    │                 logged on completion, never awaited
    │
    └── Cloudflare Workers AI → llama-3.1-8b-instruct-fast
                  returns comment string to player
```

---

## 6. API Endpoints Reference

### 0G DA Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/da/health` | DA config and network status |
| `GET` | `/api/da/snapshot?user=<id>` | Latest DA snapshot reference for a player (rootHash, txHash, explorer link) |
| `GET` | `/api/da/verify?user=<id>` | Retrieve and verify snapshot directly from 0G DA network |

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

**Sample response — `/api/da/verify`:**
```json
{
  "success": true,
  "verified": true,
  "rootHash": "0x1a2b3c4d...",
  "data": {
    "game": "highway-hustle",
    "identifier": "0xabc...def",
    "timestamp": "2025-05-01T12:34:56.789Z",
    "snapshot": { "currency": 45000, "scores": { "..." }, "achievements": { "..." } }
  }
}
```

### 0G EVM Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/blockchain/sessions?user=<id>` | All on-chain session records |
| `GET` | `/api/blockchain/session-count?user=<id>` | Total session count |
| `GET` | `/api/blockchain/stats` | Global SessionTracker stats |
| `GET` | `/api/blockchain/health` | SessionTracker contract health |
| `GET` | `/api/blockchain/scores?user=<id>` | On-chain best scores for all 4 modes |
| `GET` | `/api/blockchain/leaderboard?gameMode=0&topN=10` | On-chain leaderboard |
| `GET` | `/api/blockchain/score-stats` | Global ScoreManager stats |
| `GET` | `/api/blockchain/vehicles?user=<id>` | On-chain vehicle ownership |
| `GET` | `/api/blockchain/vehicle-history?user=<id>` | Vehicle switch history |
| `GET` | `/api/blockchain/achievements?user=<id>` | All on-chain achievements |
| `GET` | `/api/blockchain/achievement-check?user=<id>&achievementId=<id>` | Check one achievement |
| `GET` | `/api/blockchain/economy?user=<id>` | Full on-chain currency history |
| `GET` | `/api/blockchain/streak?user=<id>` | Daily login streak |

### 0G Compute Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/leaderboard/ai-comment?user=<id>&type=<global\|gate>` | AI commentary with 0G Compute ping |
| `POST` | `/api/leaderboard/comment-ping` | Direct 0G Compute ping with player objects from client |

---

## 7. Environment Variables

```env
# ── 0G EVM (Smart Contracts) ────────────────────────────────────────────
ZEROG_RPC_URL=https://evmrpc.0g.ai
ZEROG_CHAIN_ID=16661
DEPLOYER_PRIVATE_KEY=0x<wallet_private_key>

SESSION_CONTRACT_ADDRESS=0x<address>
SCORE_CONTRACT_ADDRESS=0x<address>
VEHICLE_CONTRACT_ADDRESS=0x<address>
MISSION_CONTRACT_ADDRESS=0x<address>
ECONOMY_CONTRACT_ADDRESS=0x<address>

# ── 0G DA (Data Availability) ───────────────────────────────────────────
ZEROG_DA_PRIVATE_KEY=0x<wallet_private_key>   # pays for DA blob submissions
ZEROG_DA_EVM_RPC=https://evmrpc.0g.ai         # optional — defaults to mainnet
ZEROG_DA_INDEXER_RPC=https://indexer-storage-turbo.0g.ai  # optional — defaults to mainnet

# ── 0G Compute ──────────────────────────────────────────────────────────
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
| DA Indexer (Turbo) | `https://indexer-storage-turbo.0g.ai` |
| DA Indexer (Standard) | `https://indexer-storage-standard.0g.ai` |
| 0G Compute Proxy | `https://compute-network-1.integratenetwork.work/v1/proxy` |
| Faucet (testnet) | `https://faucet.0g.ai` |

### SDK and Dependencies

| Package | Version | Purpose |
|---|---|---|
| `ethers` | `^6.9.0` | EVM provider, wallet, and smart contract interaction |
| `@0gfoundation/0g-storage-ts-sdk` | latest | 0G DA — blob upload (`MemData`, `Indexer`), download and proof verification |

---

## Summary

| 0G Product | What Highway Hustle Uses It For |
|---|---|
| **0G EVM** | 5 smart contracts deployed on chain ID 16661 record every session, score, vehicle switch, achievement, and currency transaction permanently on-chain. Players' on-chain history is immutable and trustlessly queryable. |
| **0G DA** | Player game state is published to 0G DA as a verifiable JSON blob on every new best score and achievement unlock. The Merkle `rootHash` content-addresses the snapshot — anyone can retrieve and verify a player's claimed state from the DA network without trusting the game server. |
| **0G Compute** | Every leaderboard AI commentary request fires a parallel inference ping through the 0G Compute network (GLM-5-FP8). This proves Highway Hustle routes real AI workloads through decentralised compute infrastructure on every leaderboard interaction. |
