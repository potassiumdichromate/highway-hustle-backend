# Highway Hustle Backend API Documentation

## Base URL
```
Production: https://api.highwayhustle.xyz
Development: http://localhost:5000
```

All endpoints are prefixed with `/api`

---

## Authentication
No authentication required (as per specification)

---

## Player Data Structure

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

## GET Endpoints

### 1. Get All Player Data
```
GET /api/player/all?user={identifier}
```

**Parameters:**
- `user` (required): Can be wallet address, discord ID, telegram ID, or email

**Response:**
```json
{
  "success": true,
  "data": {
    // Complete player object
  }
}
```

**Notes:**
- Auto-creates player if not found
- Returns all categories

---

### 2. Get Privy Data
```
GET /api/player/privy?user={identifier}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "discord": "username#1234",
    "telegram": "@username",
    "email": "user@example.com"
  }
}
```

---

### 3. Get User Game Data
```
GET /api/player/game?user={identifier}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "playerName": "Unnamed",
    "currency": 20000,
    "lastWeekCurrency": 0,
    "totalPlayedTime": 0.0
  }
}
```

---

### 4. Get Player Game Mode Data
```
GET /api/player/gamemode?user={identifier}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bestScoreOneWay": 0,
    "bestScoreTwoWay": 0,
    "bestScoreTimeAttack": 0,
    "bestScoreBomb": 0
  }
}
```

---

### 5. Get Player Vehicle Data
```
GET /api/player/vehicle?user={identifier}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "selectedPlayerCarIndex": 0,
    "JeepOwned": 1,
    "VanOwned": 0,
    "SierraOwned": 0,
    "SedanOwned": 0,
    "LamborghiniOwned": 0
  }
}
```

---

## POST Endpoints

### 1. Update All Player Data
```
POST /api/player/all?user={identifier}
Content-Type: application/json
```

**Body:**
```json
{
  "privyData": { /* optional */ },
  "userGameData": { /* optional */ },
  "playerGameModeData": { /* optional */ },
  "playerVehicleData": { /* optional */ },
  "campaignData": { /* optional */ }
}
```

**Response:**
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
```
POST /api/player/privy?user={identifier}
Content-Type: application/json
```

**Body:**
```json
{
  "walletAddress": "0x...",
  "discord": "username#1234"
}
```

---

### 3. Update User Game Data
```
POST /api/player/game?user={identifier}
Content-Type: application/json
```

**Body:**
```json
{
  "currency": 25000,
  "playerName": "SpeedDemon",
  "totalPlayedTime": 120.5
}
```

---

### 4. Update Player Game Mode Data
```
POST /api/player/gamemode?user={identifier}
Content-Type: application/json
```

**Body:**
```json
{
  "bestScoreOneWay": 1500,
  "bestScoreTwoWay": 2000
}
```

---

### 5. Update Player Vehicle Data
```
POST /api/player/vehicle?user={identifier}
Content-Type: application/json
```

**Body:**
```json
{
  "selectedPlayerCarIndex": 2,
  "SierraOwned": 1
}
```

---

## Campaign Endpoint (Galxe Integration)

### Check User Achievement
```
GET /api/check-user-achievement?user={identifier}
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

**Failure Response (HTTP 404):**
```json
{
  "message": "failed, user doesn't qualified",
  "code": 404,
  "data": {
    "Achieved1000M": false
  }
}
```

**Galxe Handler Example:**
```javascript
function handle(resp) {
  if(resp.data.Achieved1000M === true){
    return 1; // Success
  } else {
    return 0; // Failure
  }
}
```

---

## Utility Endpoints

### Get Leaderboard (Top 10)
```
GET /api/leaderboard
```

**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "privyData": {
        "walletAddress": "0x..."
      },
      "userGameData": {
        "playerName": "Player1",
        "currency": 50000
      }
    }
  ]
}
```

---

### Get All Users
```
GET /api/users
```

**Response:**
```json
{
  "success": true,
  "users": [
    // All players sorted by currency
  ]
}
```

---

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-22T10:30:00.000Z",
  "uptime": 3600.5
}
```

---

## Error Responses

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

## Usage Examples

### cURL Examples

#### Get Player Data
```bash
curl "https://api.highwayhustle.xyz/api/player/all?user=0x1234567890123456789012345678901234567890"
```

#### Update Game Data
```bash
curl -X POST "https://api.highwayhustle.xyz/api/player/game?user=user@example.com" \
  -H "Content-Type: application/json" \
  -d '{"currency": 30000, "playerName": "RacingKing"}'
```

#### Check Achievement
```bash
curl "https://api.highwayhustle.xyz/api/check-user-achievement?user=0x1234567890123456789012345678901234567890"
```

---

### JavaScript Fetch Examples

#### Load Player State
```javascript
const loadPlayer = async (identifier) => {
  const response = await fetch(
    `https://api.highwayhustle.xyz/api/player/all?user=${identifier}`
  );
  const data = await response.json();
  return data;
};
```

#### Update Player Currency
```javascript
const updateCurrency = async (identifier, newCurrency) => {
  const response = await fetch(
    `https://api.highwayhustle.xyz/api/player/game?user=${identifier}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: newCurrency })
    }
  );
  return await response.json();
};
```

---

## Rate Limiting
Currently no rate limiting implemented. Consider adding if needed for production.

## CORS
Configured to allow requests from specified origins in `.env` file.

## Notes
- All timestamps use ISO 8601 format
- Player auto-creation happens on first GET request
- Updates are partial - only send fields you want to change
- All identifiers (wallet, email, etc.) are case-insensitive