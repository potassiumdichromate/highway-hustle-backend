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
| GET | `https://highway-hustle-backend.onrender.com/api/player/all?user={id}` | Get all player data |
| GET | `https://highway-hustle-backend.onrender.com/api/player/privy?user={id}` | Get privy data only |
| GET | `https://highway-hustle-backend.onrender.com/api/player/game?user={id}` | Get game data only |
| GET | `https://highway-hustle-backend.onrender.com/api/player/gamemode?user={id}` | Get gamemode scores |
| GET | `https://highway-hustle-backend.onrender.com/api/player/vehicle?user={id}` | Get vehicle data |
| POST | `https://highway-hustle-backend.onrender.com/api/player/all?user={id}` | Update all player data |
| POST | `https://highway-hustle-backend.onrender.com/api/player/privy?user={id}` | Update privy data |
| POST | `https://highway-hustle-backend.onrender.com/api/player/game?user={id}` | Update game data |
| POST | `https://highway-hustle-backend.onrender.com/api/player/gamemode?user={id}` | Update gamemode scores |
| POST | `https://highway-hustle-backend.onrender.com/api/player/vehicle?user={id}` | Update vehicle data |

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

# Get All Player Data
https://highway-hustle-backend.onrender.com/api/player/all?user=0xYOUR_WALLET

# Get Game Data Only
https://highway-hustle-backend.onrender.com/api/player/game?user=0xYOUR_WALLET

# Check Achievement (Galxe)
https://highway-hustle-backend.onrender.com/api/check-user-achievement?user=0xYOUR_WALLET

# Leaderboard
https://highway-hustle-backend.onrender.com/api/leaderboard

# All Users
https://highway-hustle-backend.onrender.com/api/users
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

### 1. Get All Player Data
**URL:** `https://highway-hustle-backend.onrender.com/api/player/all?user={identifier}`

**Parameters:**
- `user` (required): Can be wallet address, discord ID, telegram ID, or email

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

**Notes:**
- Auto-creates player if not found
- Returns complete player object with all categories

---

### 2. Get Privy Data Only
**URL:** `https://highway-hustle-backend.onrender.com/api/player/privy?user={identifier}`

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

### 3. Get User Game Data
**URL:** `https://highway-hustle-backend.onrender.com/api/player/game?user={identifier}`

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

### 4. Get Player Game Mode Data
**URL:** `https://highway-hustle-backend.onrender.com/api/player/gamemode?user={identifier}`

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

### 5. Get Player Vehicle Data
**URL:** `https://highway-hustle-backend.onrender.com/api/player/vehicle?user={identifier}`

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

**Failure Response - User Not Qualified (HTTP 404):**
```json
{
  "message": "failed, user doesn't qualified",
  "code": 404,
  "data": {
    "Achieved1000M": false
  }
}
```

**Failure Response - Missing User (HTTP 400):**
```json
{
  "message": "failed, missing user parameter",
  "code": 400,
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
  "timestamp": "2024-01-22T10:30:00.000Z",
  "uptime": 3600.5
}
```

---

## 💻 Code Examples

### JavaScript/React

```javascript
const API_BASE = "https://highway-hustle-backend.onrender.com/api";

// 1. Load player state
async function loadPlayer(walletAddress) {
  const response = await fetch(`${API_BASE}/player/all?user=${walletAddress}`);
  const data = await response.json();
  return data;
}

// 2. Update player currency
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

// Usage Example
const wallet = "0x1234567890123456789012345678901234567890";
const player = await loadPlayer(wallet);
console.log(player.data.userGameData.currency);

await updateCurrency(wallet, 50000);
await unlockVehicle(wallet, "Lamborghini");
await setAchievement(wallet);
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

# 2. Create/Load player
curl "https://highway-hustle-backend.onrender.com/api/player/all?user=0xTEST123"

# 3. Update currency
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
```

---

## 📝 Notes

- **No Authentication Required**: All endpoints are public (as specified)
- **Case Insensitive**: All identifiers (wallet, email, etc.) are case-insensitive
- **Auto-Creation**: First GET request creates player with defaults
- **Partial Updates**: POST requests only update provided fields
- **CORS Enabled**: API accepts requests from any origin
- **Rate Limiting**: Currently no rate limiting (add if needed)

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
- [ ] Integrate with Unity WebGL
- [ ] Test with Privy wallet integration

---

**Built for Highway Hustle by Sidhanth (Potassium)**  