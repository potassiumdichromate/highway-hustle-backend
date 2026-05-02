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
      │       └── da.warzonewarriors.xyz  (0G DA Event Gateway)
      │           HTTP → BullMQ → gRPC DisperseBlob → { storageRoot, epoch, quorumId }
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

0G DA (Data Availability) is a decentralized layer that guarantees published data blobs are available and verifiable by anyone. It works via a **Disperser service** (gRPC) that accepts raw byte blobs, applies **erasure coding** across distributed DA nodes, and uses **quorum signing** to confirm availability. Each submitted blob goes through:

1. `DisperseBlob` — blob submitted to disperser, returns a `request_id`
2. `GetBlobStatus` — polled until status is `CONFIRMED` or `FINALIZED`, returns `{ storageRoot, epoch, quorumId }`
3. `RetrieveBlob` — anyone can fetch the original blob using `{ storageRoot, epoch, quorumId }` — no trust in the original sender required

### DA Infrastructure — 0G DA Event Gateway

The game uses a dedicated **0G DA Event Gateway** (`zero_g_da_event_gateway`) deployed at:

```
https://da.warzonewarriors.xyz
```

This gateway was built specifically for Highway Hustle (and other games). It:
- Accepts game events over a simple HTTP API
- Batches them using **BullMQ + Redis**
- Forwards batches to the **0G DA disperser via raw gRPC** (`@grpc/grpc-js` + `disperser.proto`)
- Polls `GetBlobStatus` until the blob is `CONFIRMED`
- Stores `{ storageRoot, epoch, quorumId }` in MongoDB for retrieval
- Exposes a retrieve endpoint that calls `RetrieveBlob` gRPC and returns the original data

The gateway is the correct Node.js integration pattern for 0G DA — there is no official JS DA SDK, so it uses raw gRPC with `disperser.proto` directly.

### How Highway Hustle Uses 0G DA

At two key milestone events — a **new best score** or an **achievement unlock** — the player's full game state is sent as an event to the gateway. The gateway disperses it to the 0G DA network. An `eventId` is generated and stored in the player's MongoDB record so the DA status and blob can be retrieved anytime.

This means:
- Every score milestone has a **DA-backed, quorum-signed record** of the player's state
- Anyone can retrieve and verify the original blob using only `{ storageRoot, epoch, quorumId }` — directly from the 0G DA network, with no trust in the game server
- The DA record is the player's permanent on-chain memory

### Gateway Architecture

```
Highway Hustle Backend
        │
        │  POST /v1/events
        │  { game, event, eventId, data: { scores, currency, ... } }
        ▼
https://da.warzonewarriors.xyz  (0G DA Event Gateway)
        │
        ├── BullMQ queue (Redis)
        │
        └── Worker: submitBatchToDa(events)
                │
                │  gRPC  DisperseBlob({ data: Buffer.from(JSON.stringify(events)) })
                ▼
        0G DA Disperser node  (port 51001)
                │
                │  polls GetBlobStatus({ request_id }) until CONFIRMED
                ▼
        { storageRoot, epoch, quorumId }  ← stored in gateway MongoDB
                │
                │  gRPC  RetrieveBlob({ storageRoot, epoch, quorumId })
                ▼
        Original blob data returned to anyone who asks
```

### DA Event Payload

Every event sent to the gateway contains the player's full game state:

```json
{
  "eventId": "uuid-generated-by-backend",
  "game": "highwayHustle",
  "event": "score.best",
  "data": {
    "identifier": "0xabc...def",
    "playerName": "Speedy",
    "currency": 45000,
    "totalPlayedTime": 3.75,
    "scores": {
      "bestScoreOneWay": 1200,
      "bestScoreTwoWay": 980,
      "bestScoreTimeAttack": 720,
      "bestScoreBomb": 540
    },
    "vehicles": { "selectedPlayerCarIndex": 4, "JeepOwned": 1, "LamborghiniOwned": 1 },
    "achievements": { "Achieved1000M": true },
    "recordedAt": "2025-05-01T12:00:00.000Z"
  }
}
```

Event names:
- `score.best` — triggered when any game mode score is beaten
- `achievement.unlock` — triggered when `Achieved1000M` is unlocked

### MongoDB Schema — daSnapshot Field

```javascript
// models/PlayerState.js
daSnapshot: {
  eventId:     String,   // UUID generated by backend — used to poll gateway
  daReference: String,   // DA reference string (set once confirmed)
  daStatus:    String,   // 'submitted' | 'confirmed' | 'finalized' | 'failed'
  daBlobInfo: {
    storageRoot: String, // DA blob storage root (base64) — for RetrieveBlob
    epoch:       Number, // DA epoch number
    quorumId:    Number, // DA quorum ID
  },
  snapshotAt:  Date,
  trigger:     String,   // 'score' | 'achievement'
}
```

### DA Submit Flow

```
Player achieves new best score
          │
          ▼
MongoDB updated + HTTP response sent to player ◄── player is NOT waiting for DA
          │
          ▼  setImmediate (after response)
saveDASnapshot(player, 'score')
          │
          ├── generate eventId = randomUUID()
          │
          └── POST https://da.warzonewarriors.xyz/v1/events
                {
                  eventId, game: 'highwayHustle',
                  event: 'score.best',
                  data: { scores, currency, vehicles, achievements, ... }
                }
                [10s timeout]
                        │
                        ▼  202 Accepted — gateway queues it
                { success: true, accepted: 1, queued: N }
                        │
                        ▼
          PlayerState.findByIdAndUpdate({ daSnapshot: { eventId, daStatus: 'submitted' } })

          [Gateway processes async via BullMQ:]
          gRPC DisperseBlob → polls GetBlobStatus → CONFIRMED
          stores { storageRoot, epoch, quorumId } in gateway MongoDB
```

### Service Implementation

**File:** `services/zerogDAService.js`

```javascript
const { randomUUID } = require('crypto');

// Submit game event to 0G DA gateway — returns { eventId } or null. Never throws.
const submitPlayerEvent = async (eventName, identifier, playerData) => {
  const eventId = randomUUID();  // we own this ID — stored in MongoDB for lookup

  const res = await fetch('https://da.warzonewarriors.xyz/v1/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      eventId,
      game:  'highwayHustle',
      event: eventName,          // 'score.best' | 'achievement.unlock'
      data:  buildEventData(identifier, playerData),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  // gateway responds 202 — { success: true, accepted: 1, queued: N }
  return { eventId };
};

// Poll gateway for latest DA status of an eventId
const getEventStatus = async (eventId) => {
  const res = await fetch(`https://da.warzonewarriors.xyz/v1/da/status/${eventId}`, ...);
  // returns { status, daReference, daStatus, daBlobInfo: { storageRoot, epoch, quorumId } }
};

// Retrieve actual blob from 0G DA network via gateway
const retrievePlayerEvent = async (eventId) => {
  const res = await fetch(`https://da.warzonewarriors.xyz/v1/da/retrieve/${eventId}`, { method: 'POST', ... });
  // gateway calls gRPC RetrieveBlob({ storageRoot, epoch, quorumId })
  // returns decoded JSON of original event data
};
```

**Trigger points in** `controllers/playerController.js`:

```javascript
const saveDASnapshot = (player, trigger) => {
  const eventName = trigger === 'achievement' ? 'achievement.unlock' : 'score.best';
  setImmediate(async () => {
    const result = await zerogDAService.submitPlayerEvent(eventName, identifier, player);
    if (result?.eventId) {
      await PlayerState.findByIdAndUpdate(player._id, {
        daSnapshot: { eventId: result.eventId, daStatus: 'submitted', snapshotAt: new Date(), trigger }
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

- **Non-blocking:** `setImmediate` — DA submit runs after HTTP response is fully sent. Player never waits.
- **10s timeout:** If gateway is unreachable, returns `null` silently.
- **Never throws:** All errors caught internally. Backend cannot crash from a DA failure.
- **No extra env needed:** Gateway URL is hardcoded (`https://da.warzonewarriors.xyz`). Set `ZEROG_DA_API_KEY` if the gateway requires auth.

### Check & Retrieve DA Data

```
GET /api/da/snapshot?user=0xabc...   → eventId + stored daStatus from MongoDB
GET /api/da/status?user=0xabc...     → live poll gateway for latest status + daBlobInfo
GET /api/da/retrieve?user=0xabc...   → gateway calls RetrieveBlob gRPC, returns decoded data
GET /api/da/health                   → gateway health check
```

Live status response (once confirmed):
```json
{
  "success": true,
  "eventId": "uuid...",
  "status": "confirmed",
  "daStatus": "CONFIRMED",
  "daBlobInfo": { "storageRoot": "base64...", "epoch": 12, "quorumId": 0 }
}
```

Retrieve response:
```json
{
  "success": true,
  "retrieved": true,
  "eventId": "uuid...",
  "daBlobInfo": { "storageRoot": "...", "epoch": 12, "quorumId": 0 },
  "data": {
    "game": "highwayHustle",
    "event": "score.best",
    "data": { "identifier": "0x...", "scores": { "bestScoreOneWay": 1200 }, "..." }
  }
}
```

---

## 4. 0G Compute — AI Leaderboard Commentary

### What It Does

When a player views the leaderboard, an AI model generates a short (under 30 words), playful commentary comparing that player's stats to the current #1. The backend now runs **0G Compute as the primary inference path** and only uses Cloudflare as a fallback if 0G fails, times out, or returns invalid output.

### Endpoint

| Parameter | Value |
|---|---|
| Base URL | `https://compute-network-1.integratenetwork.work/v1/proxy` |
| Model | `zai-org/GLM-5-FP8` |
| API format | OpenAI-compatible (`/chat/completions`) |
| Env var | `ZEROG_API_KEY` |

### Integration Pattern

`generateLeaderboardComment()` performs a direct 0G request first (OpenAI-compatible `/chat/completions`) with:
- model: `zai-org/GLM-5-FP8`
- `max_tokens: 150`
- timeout: `8000ms`

If that 0G request fails or returns unusable output, the service falls back to Cloudflare Workers AI.

```
Player requests leaderboard AI comment
        │
        ├── [primary] 0G Compute → zai-org/GLM-5-FP8
        │         max_tokens: 150
        │         timeout:    8s
        │         returns comment to player on success
        │         logs: model + latency + token usage + leaderboardType
        │
        └── [fallback only] Cloudflare Workers AI → llama-3.1-8b-instruct-fast
                  used when 0G fails / times out / invalid output
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
const generateLeaderboardComment = async ({ currentPlayer, topPlayer, leaderboardType }) => {
  // 1) 0G Compute primary
  // 2) Cloudflare fallback only if 0G fails/times out/invalid output
  return { comment, inferenceSource };
};
```

**Triggered by:**
- `GET /api/leaderboard/ai-comment?user=<id>&type=<global|gate>` — server-side leaderboard fetch and response source metadata.
- `POST /api/leaderboard/comment-ping` — acknowledgement endpoint only (no compute inference).

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
    └── 0G DA → POST https://da.warzonewarriors.xyz/v1/events
                [setImmediate · 10s timeout · never blocks response]
                → eventId saved to player.daSnapshot (daStatus: 'submitted')
                → gateway: gRPC DisperseBlob → CONFIRMED
                → daBlobInfo: { storageRoot, epoch, quorumId } stored
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
    └── 0G DA → POST https://da.warzonewarriors.xyz/v1/events
                { event: 'achievement.unlock', data: fullPlayerState }
                [setImmediate · 10s timeout · never blocks response]
                → eventId stored (daStatus: 'submitted')
                → gateway disperses blob via gRPC; CONFIRMED daBlobInfo stored
```

---

### Player Views Leaderboard AI Comment

```
GET /api/leaderboard/ai-comment?user=<identifier>
    │
    ├── MongoDB: fetch currentPlayer + topPlayer
    │
    ├── [primary] 0G Compute → GLM-5-FP8 (max_tokens: 150, timeout: 8s)
    │                 returns comment in normal conditions
    │
    └── [fallback] Cloudflare Workers AI → only if 0G fails/invalid output
                  response metadata marks source: "0g_compute" or "cloudflare_fallback"
```

---

## 6. API Endpoints Reference

### 0G DA Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/da/health` | Gateway health check — online status, mode, completed blobs |
| `GET` | `/api/da/snapshot?user=<id>` | Stored eventId + daStatus from MongoDB (fast, no gateway call) |
| `GET` | `/api/da/status?user=<id>` | Live poll of gateway for latest DA status + daBlobInfo |
| `GET` | `/api/da/retrieve?user=<id>` | Gateway calls gRPC RetrieveBlob → returns decoded original blob |

**Sample response — `/api/da/snapshot`:**
```json
{
  "success": true,
  "eventId": "uuid-generated-by-backend",
  "daStatus": "submitted",
  "daBlobInfo": null,
  "snapshotAt": "2025-05-01T12:34:56.789Z",
  "trigger": "score",
  "gatewayStatusUrl": "https://da.warzonewarriors.xyz/v1/da/status/uuid..."
}
```

**Sample response — `/api/da/status` (once confirmed):**
```json
{
  "success": true,
  "eventId": "uuid...",
  "status": "confirmed",
  "daStatus": "CONFIRMED",
  "daBlobInfo": { "storageRoot": "base64...", "epoch": 12, "quorumId": 0 }
}
```

**Sample response — `/api/da/retrieve`:**
```json
{
  "success": true,
  "retrieved": true,
  "eventId": "uuid...",
  "daBlobInfo": { "storageRoot": "...", "epoch": 12, "quorumId": 0 },
  "data": {
    "game": "highwayHustle",
    "event": "score.best",
    "data": { "identifier": "0xabc...def", "scores": { "bestScoreOneWay": 1200 }, "..." }
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
ZEROG_DA_GATEWAY_URL=https://da.warzonewarriors.xyz  # optional — this URL is hardcoded as fallback
ZEROG_DA_API_KEY=<bearer_token>                  # gateway Bearer auth (omit if gateway is public)

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
| DA Event Gateway | `https://da.warzonewarriors.xyz` |
| 0G Compute Proxy | `https://compute-network-1.integratenetwork.work/v1/proxy` |
| Faucet (testnet) | `https://faucet.0g.ai` |

### SDK and Dependencies

| Package | Version | Purpose |
|---|---|---|
| `ethers` | `^6.9.0` | EVM provider, wallet, and smart contract interaction |
| *(none — native `fetch`)* | — | 0G DA — HTTP calls to `da.warzonewarriors.xyz` gateway; no SDK needed |

---

## Summary

| 0G Product | What Highway Hustle Uses It For |
|---|---|
| **0G EVM** | 5 smart contracts deployed on chain ID 16661 record every session, score, vehicle switch, achievement, and currency transaction permanently on-chain. Players' on-chain history is immutable and trustlessly queryable. |
| **0G DA** | Player game state is published to 0G DA on every new best score and achievement unlock via the `da.warzonewarriors.xyz` gateway. The gateway batches events and forwards them to the 0G DA disperser via gRPC (`DisperseBlob`). Each blob is confirmed with `{ storageRoot, epoch, quorumId }` — anyone can call `RetrieveBlob` to get the original data back without trusting the game server. |
| **0G Compute** | Every leaderboard AI commentary request fires a parallel inference ping through the 0G Compute network (GLM-5-FP8). This proves Highway Hustle routes real AI workloads through decentralised compute infrastructure on every leaderboard interaction. |
