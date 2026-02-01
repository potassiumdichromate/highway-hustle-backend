# Highway Hustle Backend API Documentation

## 🌐 Base URL
```
https://highway-hustle-backend.onrender.com
```

All endpoints are prefixed with `/api`

---

## 📡 Complete Endpoint List

### Player Data Endpoints

| Method | Full URL | Description |
|--------|----------|-------------|
| GET | `https://highway-hustle-backend.onrender.com/api/player/all?user={id}` | Get all player data ⛓️ |
| GET | `https://highway-hustle-backend.onrender.com/api/player/privy?user={id}` | Get privy data only ⛓️ |
| GET | `https://highway-hustle-backend.onrender.com/api/player/game?user={id}` | Get game data only ⛓️ |
| GET | `https://highway-hustle-backend.onrender.com/api/player/gamemode?user={id}` | Get gamemode scores ⛓️ |
| GET | `https://highway-hustle-backend.onrender.com/api/player/vehicle?user={id}` | Get vehicle data ⛓️ |
| POST | `https://highway-hustle-backend.onrender.com/api/player/all?user={id}` | Update all player data |
| POST | `https://highway-hustle-backend.onrender.com/api/player/privy?user={id}` | Update privy data |
| POST | `https://highway-hustle-backend.onrender.com/api/player/game?user={id}` | Update game data |
| POST | `https://highway-hustle-backend.onrender.com/api/player/gamemode?user={id}` | Update gamemode scores |
| POST | `https://highway-hustle-backend.onrender.com/api/player/vehicle?user={id}` | Update vehicle data |

**⛓️ = Automatically records session on 0G blockchain**

### 🔗 Blockchain Endpoints (NEW!)

| Method | Full URL | Description |
|--------|----------|-------------|
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/health` | Check blockchain service health |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/stats` | Get contract statistics |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/sessions?user={id}` | Get player's blockchain sessions |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/session-count?user={id}` | Get player's session count |

### Campaign & Utilities

| Method | Full URL | Description |
|--------|----------|-------------|
| GET | `https://highway-hustle-backend.onrender.com/api/check-user-achievement?user={id}` | Check Galxe achievement |
| GET | `https://highway-hustle-backend.onrender.com/api/leaderboard` | Top 10 players by currency |
| GET | `https://highway-hustle-backend.onrender.com/api/users` | All users sorted by currency |
| GET | `https://highway-hustle-backend.onrender.com/health` | Health check |

**Note:** `{id}` can be wallet address (0x...), Discord ID, Telegram ID, or email

---

## 🎯 Quick Reference URLs

### Essential URLs (Copy-Paste Ready)

```bash
# Health Check
https://highway-hustle-backend.onrender.com/health

# Get All Player Data (Records on blockchain ⛓️)
https://highway-hustle-backend.onrender.com/api/player/all?user=0xYOUR_WALLET

# Get Game Data Only (Records on blockchain ⛓️)
https://highway-hustle-backend.onrender.com/api/player/game?user=0xYOUR_WALLET

# Check Achievement (Galxe)
https://highway-hustle-backend.onrender.com/api/check-user-achievement?user=0xYOUR_WALLET

# Leaderboard
https://highway-hustle-backend.onrender.com/api/leaderboard

# All Users
https://highway-hustle-backend.onrender.com/api/users

# 🔗 Blockchain Health
https://highway-hustle-backend.onrender.com/api/blockchain/health

# 🔗 Blockchain Stats
https://highway-hustle-backend.onrender.com/api/blockchain/stats

# 🔗 Player Sessions on Blockchain
https://highway-hustle-backend.onrender.com/api/blockchain/sessions?user=0xYOUR_WALLET
```

---

## 📊 Player Data Structure

```json
{
  "privyData": {
    "walletAddress": "0x...",
    "discord": "username#1234",
    "telegram": "@username",
    "email": "user@example.com"
  },
  "userGameData": {
    "playerName": "Unnamed",
    "currency": 20000,
    "lastWeekCurrency": 0,
    "totalPlayedTime": 0.0
  },
  "playerGameModeData": {
    "bestScoreOneWay": 0,
    "bestScoreTwoWay": 0,
    "bestScoreTimeAttack": 0,
    "bestScoreBomb": 0
  },
  "playerVehicleData": {
    "selectedPlayerCarIndex": 0,
    "JeepOwned": 1,
    "VanOwned": 0,
    "SierraOwned": 0,
    "SedanOwned": 0,
    "LamborghiniOwned": 0
  },
  "campaignData": {
    "Achieved1000M": false
  }
}
```

---

## 🔥 GET Endpoints (Detailed)

### 1. Get All Player Data ⛓️
**URL:** `https://highway-hustle-backend.onrender.com/api/player/all?user={identifier}`

**Parameters:**
- `user` (required): Can be wallet address, discord ID, telegram ID, or email

**Blockchain Recording:** ✅ **YES** - Automatically records session on 0G blockchain

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/player/all?user=0x1234567890123456789012345678901234567890"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "privyData": { "walletAddress": "0x..." },
    "userGameData": { "playerName": "Player1", "currency": 20000 },
    "playerGameModeData": { "bestScoreOneWay": 0 },
    "playerVehicleData": { "JeepOwned": 1 },
    "campaignData": { "Achieved1000M": false },
    "lastUpdated": "2024-01-22T10:30:00.000Z",
    "createdAt": "2024-01-22T10:30:00.000Z",
    "updatedAt": "2024-01-22T10:30:00.000Z"
  }
}
```

**Blockchain Transaction:**
After the API returns data, a blockchain transaction is recorded asynchronously:
- Session type: "all"
- Player identifier
- Currency amount
- Best score
- Timestamp

**Notes:**
- Auto-creates player if not found
- Returns complete player object with all categories
- Blockchain recording happens in background (non-blocking)

---

### 2. Get Privy Data Only ⛓️
**URL:** `https://highway-hustle-backend.onrender.com/api/player/privy?user={identifier}`

**Blockchain Recording:** ✅ **YES** - Records "privy" session type

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/player/privy?user=0x1234567890123456789012345678901234567890"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "discord": "Player#1234",
    "telegram": "@player",
    "email": "player@example.com"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Player not found"
}
```

---

### 3. Get User Game Data ⛓️
**URL:** `https://highway-hustle-backend.onrender.com/api/player/game?user={identifier}`

**Blockchain Recording:** ✅ **YES** - Records "game" session type

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/player/game?user=player@example.com"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "playerName": "SpeedKing",
    "currency": 25000,
    "lastWeekCurrency": 20000,
    "totalPlayedTime": 120.5
  }
}
```

---

### 4. Get Player Game Mode Data ⛓️
**URL:** `https://highway-hustle-backend.onrender.com/api/player/gamemode?user={identifier}`

**Blockchain Recording:** ✅ **YES** - Records "gamemode" session type

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/player/gamemode?user=@speedking"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "bestScoreOneWay": 1500,
    "bestScoreTwoWay": 2000,
    "bestScoreTimeAttack": 1800,
    "bestScoreBomb": 1200
  }
}
```

---

### 5. Get Player Vehicle Data ⛓️
**URL:** `https://highway-hustle-backend.onrender.com/api/player/vehicle?user={identifier}`

**Blockchain Recording:** ✅ **YES** - Records "vehicle" session type

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/player/vehicle?user=SpeedKing#1234"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "selectedPlayerCarIndex": 2,
    "JeepOwned": 1,
    "VanOwned": 1,
    "SierraOwned": 1,
    "SedanOwned": 0,
    "LamborghiniOwned": 0
  }
}
```

---

## 🚀 POST Endpoints (Detailed)

### 1. Update All Player Data
**URL:** `https://highway-hustle-backend.onrender.com/api/player/all?user={identifier}`

**Method:** POST

**Blockchain Recording:** ❌ **NO** - POST requests do not record sessions

**Headers:**
```
Content-Type: application/json
```

**Body Example:**
```json
{
  "privyData": {
    "discord": "NewName#5678"
  },
  "userGameData": {
    "currency": 30000,
    "playerName": "RacingKing"
  },
  "campaignData": {
    "Achieved1000M": true
  }
}
```

**cURL Example:**
```bash
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/all?user=0x1234567890123456789012345678901234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "userGameData": {
      "currency": 30000,
      "playerName": "RacingKing"
    }
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    // Updated complete player object
  }
}
```

---

### 2. Update Privy Data
**URL:** `https://highway-hustle-backend.onrender.com/api/player/privy?user={identifier}`

**Blockchain Recording:** ❌ **NO**

**Body Example:**
```json
{
  "discord": "Player#9999",
  "telegram": "@newusername",
  "email": "newemail@example.com"
}
```

**cURL Example:**
```bash
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/privy?user=0x1234567890123456789012345678901234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "discord": "Player#9999",
    "telegram": "@newusername"
  }'
```

---

### 3. Update User Game Data
**URL:** `https://highway-hustle-backend.onrender.com/api/player/game?user={identifier}`

**Blockchain Recording:** ❌ **NO**

**Body Example:**
```json
{
  "currency": 50000,
  "playerName": "SpeedDemon",
  "totalPlayedTime": 250.75
}
```

**cURL Example:**
```bash
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/game?user=0x1234567890123456789012345678901234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": 50000,
    "playerName": "SpeedDemon"
  }'
```

---

### 4. Update Player Game Mode Data
**URL:** `https://highway-hustle-backend.onrender.com/api/player/gamemode?user={identifier}`

**Blockchain Recording:** ❌ **NO**

**Body Example:**
```json
{
  "bestScoreOneWay": 2000,
  "bestScoreTwoWay": 2500
}
```

**cURL Example:**
```bash
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/gamemode?user=0x1234567890123456789012345678901234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "bestScoreOneWay": 2000,
    "bestScoreTwoWay": 2500
  }'
```

---

### 5. Update Player Vehicle Data
**URL:** `https://highway-hustle-backend.onrender.com/api/player/vehicle?user={identifier}`

**Blockchain Recording:** ❌ **NO**

**Body Example:**
```json
{
  "selectedPlayerCarIndex": 4,
  "LamborghiniOwned": 1
}
```

**cURL Example:**
```bash
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/vehicle?user=0x1234567890123456789012345678901234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "selectedPlayerCarIndex": 4,
    "LamborghiniOwned": 1
  }'
```

---

## 🔗 Blockchain Endpoints (NEW!)

### 1. Blockchain Health Check
**URL:** `https://highway-hustle-backend.onrender.com/api/blockchain/health`

**Method:** GET

**Description:** Check if blockchain service is healthy and view deployer wallet balance

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/blockchain/health"
```

**Success Response (200):**
```json
{
  "healthy": true,
  "wallet": "0x63F63DC442299cCFe470657a769fdC6591d65eCa",
  "balance": "6.52",
  "contractAddress": "0x47B9D5B62C8302a89C435be307b9eAA8847FB295",
  "totalSessions": "142",
  "totalPlayers": "87",
  "chainId": 16600
}
```

**Error Response:**
```json
{
  "healthy": false,
  "error": "Not initialized"
}
```

**Use Cases:**
- Monitor deployer wallet balance
- Verify blockchain service is running
- Check total sessions recorded
- Get contract statistics

---

### 2. Get Contract Statistics
**URL:** `https://highway-hustle-backend.onrender.com/api/blockchain/stats`

**Method:** GET

**Description:** Get overall contract statistics

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/blockchain/stats"
```

**Success Response (200):**
```json
{
  "success": true,
  "totalSessions": "142",
  "totalUniquePlayers": "87",
  "owner": "0x63F63DC442299cCFe470657a769fdC6591d65eCa"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Could not retrieve stats"
}
```

---

### 3. Get Player Sessions
**URL:** `https://highway-hustle-backend.onrender.com/api/blockchain/sessions?user={identifier}`

**Method:** GET

**Description:** Get all blockchain sessions for a specific player

**Parameters:**
- `user` (required): Player identifier (wallet/email/discord/telegram)

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/blockchain/sessions?user=0x1234567890123456789012345678901234567890"
```

**Success Response (200):**
```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "0",
      "playerAddress": "0x1234567890123456789012345678901234567890",
      "identifier": "0x1234567890123456789012345678901234567890",
      "timestamp": "2026-02-01T10:30:00.000Z",
      "sessionType": "all",
      "currency": "25000",
      "bestScore": "1500"
    },
    {
      "sessionId": "1",
      "playerAddress": "0x1234567890123456789012345678901234567890",
      "identifier": "0x1234567890123456789012345678901234567890",
      "timestamp": "2026-02-01T11:45:00.000Z",
      "sessionType": "game",
      "currency": "30000",
      "bestScore": "2000"
    }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Could not retrieve sessions"
}
```

**Session Types:**
- `"all"` - Full player data fetch
- `"privy"` - Privy data fetch
- `"game"` - Game data fetch
- `"gamemode"` - Game mode data fetch
- `"vehicle"` - Vehicle data fetch

---

### 4. Get Player Session Count
**URL:** `https://highway-hustle-backend.onrender.com/api/blockchain/session-count?user={identifier}`

**Method:** GET

**Description:** Get total number of sessions for a player

**Parameters:**
- `user` (required): Player identifier

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/blockchain/session-count?user=0x1234567890123456789012345678901234567890"
```

**Success Response (200):**
```json
{
  "success": true,
  "count": "42"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Could not retrieve session count"
}
```

---

## 🎮 Campaign Endpoint (Galxe Integration)

### Check User Achievement
**URL:** `https://highway-hustle-backend.onrender.com/api/check-user-achievement?user={identifier}`

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/check-user-achievement?user=0x1234567890123456789012345678901234567890"
```

**Success Response (HTTP 200):**
```json
{
  "message": "successful",
  "code": 200,
  "data": {
    "Achieved1000M": true
  }
}
```

**Failure Response - User Not Qualified (HTTP 200):**
```json
{
  "message": "failed, user doesn't qualified",
  "code": 200,
  "data": {
    "Achieved1000M": false
  }
}
```

**Failure Response - Missing User (HTTP 200):**
```json
{
  "message": "failed, missing user parameter",
  "code": 200,
  "data": {
    "Achieved1000M": false
  }
}
```

**Galxe Integration Handler:**
```javascript
function handle(resp) {
  if(resp.data.Achieved1000M === true){
    return 1;  // User qualified for quest
  } else {
    return 0;  // User not qualified
  }
}
```

**Setting Achievement from Game:**
```bash
# First, set the achievement to true
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/all?user=0x1234567890123456789012345678901234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignData": {
      "Achieved1000M": true
    }
  }'

# Then Galxe can verify it
curl "https://highway-hustle-backend.onrender.com/api/check-user-achievement?user=0x1234567890123456789012345678901234567890"
```

---

## 🏆 Utility Endpoints

### Get Leaderboard (Top 10)
**URL:** `https://highway-hustle-backend.onrender.com/api/leaderboard`

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/leaderboard"
```

**Success Response (200):**
```json
{
  "success": true,
  "leaderboard": [
    {
      "_id": "...",
      "privyData": {
        "walletAddress": "0x..."
      },
      "userGameData": {
        "playerName": "Player1",
        "currency": 100000
      }
    },
    {
      "_id": "...",
      "privyData": {
        "walletAddress": "0x..."
      },
      "userGameData": {
        "playerName": "Player2",
        "currency": 95000
      }
    }
    // ... up to 10 players
  ]
}
```

---

### Get All Users
**URL:** `https://highway-hustle-backend.onrender.com/api/users`

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/api/users"
```

**Success Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "_id": "...",
      "privyData": {
        "walletAddress": "0x..."
      },
      "userGameData": {
        "playerName": "TopPlayer",
        "currency": 100000
      }
    }
    // ... all users sorted by currency descending
  ]
}
```

---

### Health Check
**URL:** `https://highway-hustle-backend.onrender.com/health`

**Example Request:**
```bash
curl "https://highway-hustle-backend.onrender.com/health"
```

**Success Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-01T10:30:00.000Z",
  "uptime": 3600.5
}
```

---

## 💻 Code Examples

### JavaScript/React

```javascript
const API_BASE = "https://highway-hustle-backend.onrender.com/api";

// 1. Load player state (Records on blockchain ⛓️)
async function loadPlayer(walletAddress) {
  const response = await fetch(`${API_BASE}/player/all?user=${walletAddress}`);
  const data = await response.json();
  return data;
}

// 2. Update player currency (No blockchain recording)
async function updateCurrency(walletAddress, newCurrency) {
  const response = await fetch(`${API_BASE}/player/game?user=${walletAddress}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currency: newCurrency })
  });
  return await response.json();
}

// 3. Unlock vehicle
async function unlockVehicle(walletAddress, vehicleName) {
  const response = await fetch(`${API_BASE}/player/vehicle?user=${walletAddress}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [`${vehicleName}Owned`]: 1 })
  });
  return await response.json();
}

// 4. Update best score
async function updateBestScore(walletAddress, mode, score) {
  const response = await fetch(`${API_BASE}/player/gamemode?user=${walletAddress}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [mode]: score })
  });
  return await response.json();
}

// 5. Set achievement for Galxe
async function setAchievement(walletAddress) {
  const response = await fetch(`${API_BASE}/player/all?user=${walletAddress}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignData: { Achieved1000M: true }
    })
  });
  return await response.json();
}

// 6. Check achievement (Galxe)
async function checkAchievement(walletAddress) {
  const response = await fetch(`${API_BASE}/check-user-achievement?user=${walletAddress}`);
  return await response.json();
}

// 7. Get leaderboard
async function getLeaderboard() {
  const response = await fetch(`${API_BASE}/leaderboard`);
  return await response.json();
}

// 🔗 NEW: Blockchain Functions

// 8. Check blockchain health
async function checkBlockchainHealth() {
  const response = await fetch(`${API_BASE}/blockchain/health`);
  return await response.json();
}

// 9. Get contract stats
async function getBlockchainStats() {
  const response = await fetch(`${API_BASE}/blockchain/stats`);
  return await response.json();
}

// 10. Get player's blockchain sessions
async function getPlayerSessions(walletAddress) {
  const response = await fetch(`${API_BASE}/blockchain/sessions?user=${walletAddress}`);
  return await response.json();
}

// 11. Get player's session count
async function getSessionCount(walletAddress) {
  const response = await fetch(`${API_BASE}/blockchain/session-count?user=${walletAddress}`);
  return await response.json();
}

// Usage Example
const wallet = "0x1234567890123456789012345678901234567890";

// Load player (automatically records on blockchain)
const player = await loadPlayer(wallet);
console.log(player.data.userGameData.currency);

// Update data (does not record on blockchain)
await updateCurrency(wallet, 50000);
await unlockVehicle(wallet, "Lamborghini");
await setAchievement(wallet);

// Check blockchain data
const health = await checkBlockchainHealth();
console.log(`Balance: ${health.balance} 0G`);

const sessions = await getPlayerSessions(wallet);
console.log(`Total sessions: ${sessions.sessions.length}`);

const count = await getSessionCount(wallet);
console.log(`Session count: ${count.count}`);
```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing 'user' parameter"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Player not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## 🔍 Testing Your API

### Quick Test Commands

```bash
# 1. Health check
curl "https://highway-hustle-backend.onrender.com/health"

# 2. Create/Load player (Records on blockchain ⛓️)
curl "https://highway-hustle-backend.onrender.com/api/player/all?user=0xTEST123"

# 3. Update currency (No blockchain)
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/game?user=0xTEST123" \
  -H "Content-Type: application/json" \
  -d '{"currency": 99999}'

# 4. Check leaderboard
curl "https://highway-hustle-backend.onrender.com/api/leaderboard"

# 5. Set achievement
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/all?user=0xTEST123" \
  -H "Content-Type: application/json" \
  -d '{"campaignData": {"Achieved1000M": true}}'

# 6. Verify achievement (Galxe)
curl "https://highway-hustle-backend.onrender.com/api/check-user-achievement?user=0xTEST123"

# 🔗 7. Check blockchain health
curl "https://highway-hustle-backend.onrender.com/api/blockchain/health"

# 🔗 8. Get blockchain stats
curl "https://highway-hustle-backend.onrender.com/api/blockchain/stats"

# 🔗 9. Get player sessions
curl "https://highway-hustle-backend.onrender.com/api/blockchain/sessions?user=0xTEST123"

# 🔗 10. Get session count
curl "https://highway-hustle-backend.onrender.com/api/blockchain/session-count?user=0xTEST123"
```

---

## 📝 Notes

- **No Authentication Required**: All endpoints are public (as specified)
- **Case Insensitive**: All identifiers (wallet, email, etc.) are case-insensitive
- **Auto-Creation**: First GET request creates player with defaults
- **Partial Updates**: POST requests only update provided fields
- **CORS Enabled**: API accepts requests from any origin
- **Rate Limiting**: Currently no rate limiting (add if needed)
- **⛓️ Blockchain Integration**: GET endpoints automatically record sessions on 0G blockchain (non-blocking)
- **Blockchain Network**: 0G Mainnet (Chain ID: 16600)
- **Smart Contract**: `0x47B9D5B62C8302a89C435be307b9eAA8847FB295`
- **Block Explorer**: https://scan.0g.ai

---

## 🔗 Blockchain Session Recording

### How It Works

Every GET request to player endpoints automatically records a session on the 0G blockchain:

**1. API Response** → Instant (MongoDB data)
**2. Blockchain Recording** → Asynchronous (background)

**Session Data Stored On-Chain:**
- Player identifier (wallet/email/discord/telegram)
- Wallet address (if available)
- Session type ("all", "privy", "game", "gamemode", "vehicle")
- Player currency
- Best score across all modes
- Block timestamp

**Cost:**
- Per session: ~0.0001 0G (~$0.00001 USD)
- Paid by deployer wallet (not player)
- Non-blocking design (API responds immediately)

**View Sessions:**
- Block Explorer: https://scan.0g.ai/address/0x47B9D5B62C8302a89C435be307b9eAA8847FB295
- API Endpoint: `/api/blockchain/sessions?user=...`

---

## 🚀 Integration Checklist

- [ ] Test health endpoint: `https://highway-hustle-backend.onrender.com/health`
- [ ] Load/create test player
- [ ] Update player currency
- [ ] Update best scores
- [ ] Unlock vehicles
- [ ] Set campaign achievement
- [ ] Verify Galxe endpoint works
- [ ] Test leaderboard display
- [ ] **🔗 Test blockchain health endpoint**
- [ ] **🔗 Verify sessions are being recorded on blockchain**
- [ ] **🔗 Check contract stats**
- [ ] **🔗 View sessions on block explorer**
- [ ] Integrate with Unity WebGL
- [ ] Test with Privy wallet integration

---

## 🎯 What's New in v2.0

### ⛓️ Blockchain Integration
- **Session Tracking**: Every GET request records on 0G blockchain
- **4 New Endpoints**: Health, stats, sessions, session count
- **Smart Contract**: Deployed on 0G Mainnet
- **Non-Blocking**: API performance not affected
- **Analytics**: On-chain player activity tracking

### 📊 Benefits
- **Immutable Records**: All sessions stored on blockchain
- **Transparency**: Public session history
- **Analytics**: Track player engagement on-chain
- **Fraud Prevention**: Verifiable activity records
- **Decentralized**: Session data on 0G blockchain

---

**Built for Highway Hustle by Sidhanth (Potassium)**  
**v2.0 - Now with 0G Blockchain Integration**