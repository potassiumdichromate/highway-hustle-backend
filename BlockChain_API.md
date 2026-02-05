# Highway Hustle Backend API Documentation

## 🌐 Base URL
```
https://highway-hustle-backend.onrender.com
```

All endpoints are prefixed with `/api`

---

## 🔗 Blockchain Contracts

Highway Hustle uses 5 smart contracts deployed on the 0G Mainnet for on-chain game data tracking.

### Network Information
- **Network:** 0G Mainnet
- **Chain ID:** 16661
- **RPC URL:** https://evmrpc.0g.ai
- **Block Explorer:** https://chainscan.0g.ai

### Deployed Contracts

#### 1. PlayerSessionTracker
**Contract Address:** `0x47B9D5B62C8302a89C435be307b9eAA8847FB295`  
**Explorer:** https://chainscan.0g.ai/address/0x47B9D5B62C8302a89C435be307b9eAA8847FB295  
**Purpose:** Tracks all player API interactions and gameplay sessions on-chain

#### 2. VehicleManager
**Contract Address:** `0xB9305b4898418c31dB5995b6dbBB0D29Ce63dd05`  
**Explorer:** https://chainscan.0g.ai/address/0xB9305b4898418c31dB5995b6dbBB0D29Ce63dd05  
**Purpose:** Manages vehicle ownership, purchases, and switching on-chain

#### 3. MissionManager
**Contract Address:** `0x4C2593C98bA57d24AFBBfd4ad62AeD2611416320`  
**Explorer:** https://chainscan.0g.ai/address/0x4C2593C98bA57d24AFBBfd4ad62AeD2611416320  
**Purpose:** Tracks mission progress, completions, and achievement unlocks

#### 4. ScoreManager
**Contract Address:** `0xc82c80C0d243df6eE8d08D82EAF776b7D1E3e464`  
**Explorer:** https://chainscan.0g.ai/address/0xc82c80C0d243df6eE8d08D82EAF776b7D1E3e464  
**Purpose:** Records game scores, maintains leaderboards, and creates immutable snapshots

#### 5. EconomyManager
**Contract Address:** `0x1821E2654B5700d6C7C76277991EC6076696E829`  
**Explorer:** https://chainscan.0g.ai/address/0x1821E2654B5700d6C7C76277991EC6076696E829  
**Purpose:** Tracks all currency transactions, rewards, and economic activities

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
| POST | `https://highway-hustle-backend.onrender.com/api/player/all?user={id}` | Update all player data 🔗 |
| POST | `https://highway-hustle-backend.onrender.com/api/player/privy?user={id}` | Update privy data |
| POST | `https://highway-hustle-backend.onrender.com/api/player/game?user={id}` | Update game data 🔗 |
| POST | `https://highway-hustle-backend.onrender.com/api/player/gamemode?user={id}` | Update gamemode scores 🔗 |
| POST | `https://highway-hustle-backend.onrender.com/api/player/vehicle?user={id}` | Update vehicle data 🔗 |

**⛓️ = Records session on blockchain (GET requests)**  
**🔗 = Records action on blockchain if data changes (POST requests)**

### 🔗 Blockchain Query Endpoints

#### Session Tracker Endpoints

| Method | Full URL | Description |
|--------|----------|-------------|
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/health` | Check session tracker health |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/stats` | Get session contract statistics |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/sessions?user={id}` | Get player's blockchain sessions |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/session-count?user={id}` | Get player's session count |

#### Vehicle Manager Endpoints

| Method | Full URL | Description |
|--------|----------|-------------|
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/vehicles?user={id}` | Get player's vehicles on blockchain |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/vehicle-history?user={id}` | Get player's vehicle switch history |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/vehicle-stats` | Get vehicle contract statistics |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/vehicle-health` | Check vehicle manager health |

#### Mission Manager Endpoints

| Method | Full URL | Description |
|--------|----------|-------------|
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/achievements?user={id}` | Get player's achievements on blockchain |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/achievement-check?user={id}&achievementId={id}` | Check if player has specific achievement |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/mission-stats` | Get mission contract statistics |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/mission-health` | Check mission manager health |

#### Score Manager Endpoints

| Method | Full URL | Description |
|--------|----------|-------------|
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/scores?user={id}` | Get player's scores on blockchain |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/leaderboard?gameMode={0-3}&topN={number}` | Get blockchain leaderboard |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/score-stats` | Get score contract statistics |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/score-health` | Check score manager health |

**Game Modes:** 0=OneWay, 1=TwoWay, 2=TimeAttack, 3=Bomb

#### Economy Manager Endpoints

| Method | Full URL | Description |
|--------|----------|-------------|
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/economy?user={id}` | Get player's economy data on blockchain |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/streak?user={id}` | Get player's daily streak on blockchain |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/economy-stats` | Get economy contract statistics |
| GET | `https://highway-hustle-backend.onrender.com/api/blockchain/economy-health` | Check economy manager health |

### Campaign & Utilities

| Method | Full URL | Description |
|--------|----------|-------------|
| GET | `https://highway-hustle-backend.onrender.com/api/check-user-achievement?user={id}` | Check Galxe achievement |
| GET | `https://highway-hustle-backend.onrender.com/api/leaderboard` | Top 10 players by currency |
| GET | `https://highway-hustle-backend.onrender.com/api/users` | All users sorted by currency |
| GET | `https://highway-hustle-backend.onrender.com/health` | Health check |

**Note:** `{id}` can be wallet address (0x...), Discord ID, Telegram ID, or email

---

## 🔥 Quick Test Commands

### Test All Blockchain Services
```bash
# 1. Health check
curl "https://highway-hustle-backend.onrender.com/health"

# 2. Session Tracker Health
curl "https://highway-hustle-backend.onrender.com/api/blockchain/health"

# 3. Vehicle Manager Health
curl "https://highway-hustle-backend.onrender.com/api/blockchain/vehicle-health"

# 4. Mission Manager Health
curl "https://highway-hustle-backend.onrender.com/api/blockchain/mission-health"

# 5. Score Manager Health
curl "https://highway-hustle-backend.onrender.com/api/blockchain/score-health"

# 6. Economy Manager Health
curl "https://highway-hustle-backend.onrender.com/api/blockchain/economy-health"

# 7. Get all contract stats
curl "https://highway-hustle-backend.onrender.com/api/blockchain/stats"
curl "https://highway-hustle-backend.onrender.com/api/blockchain/vehicle-stats"
curl "https://highway-hustle-backend.onrender.com/api/blockchain/mission-stats"
curl "https://highway-hustle-backend.onrender.com/api/blockchain/score-stats"
curl "https://highway-hustle-backend.onrender.com/api/blockchain/economy-stats"
```

### Test Player Data with Blockchain Recording
```bash
# Get player data (records session on blockchain)
curl "https://highway-hustle-backend.onrender.com/api/player/all?user=0xYOUR_WALLET"

# Update vehicle (records switch on blockchain)
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/vehicle?user=0xYOUR_WALLET" \
  -H "Content-Type: application/json" \
  -d '{"selectedPlayerCarIndex": 1}'

# Update score (records on blockchain)
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/gamemode?user=0xYOUR_WALLET" \
  -H "Content-Type: application/json" \
  -d '{"bestScoreOneWay": 5000}'

# Update currency (records transaction on blockchain)
curl -X POST "https://highway-hustle-backend.onrender.com/api/player/game?user=0xYOUR_WALLET" \
  -H "Content-Type: application/json" \
  -d '{"currency": 30000}'
```

### Query Blockchain Data
```bash
# Get player's blockchain sessions
curl "https://highway-hustle-backend.onrender.com/api/blockchain/sessions?user=0xYOUR_WALLET"

# Get player's vehicles on blockchain
curl "https://highway-hustle-backend.onrender.com/api/blockchain/vehicles?user=0xYOUR_WALLET"

# Get player's achievements on blockchain
curl "https://highway-hustle-backend.onrender.com/api/blockchain/achievements?user=0xYOUR_WALLET"

# Get player's scores on blockchain
curl "https://highway-hustle-backend.onrender.com/api/blockchain/scores?user=0xYOUR_WALLET"

# Get player's economy data on blockchain
curl "https://highway-hustle-backend.onrender.com/api/blockchain/economy?user=0xYOUR_WALLET"

# Get leaderboard from blockchain (OneWay mode, top 10)
curl "https://highway-hustle-backend.onrender.com/api/blockchain/leaderboard?gameMode=0&topN=10"
```

---

## 🔗 What Gets Recorded On-Chain

### Automatic Recording (GET Requests)
- Every GET request to player endpoints records a session on blockchain
- Session includes: identifier, wallet, session type, currency, best score, timestamp

### Action-Based Recording (POST Requests)
- **Vehicle Switch:** When `selectedPlayerCarIndex` changes
- **Score Update:** When any best score increases
- **Currency Change:** When currency amount changes (earning or spending)
- **Achievement Unlock:** When `Achieved1000M` becomes true

### Data Recorded Per Contract

**PlayerSessionTracker:**
- Player identifier
- Wallet address
- Session type (all/privy/game/gamemode/vehicle)
- Currency amount
- Best score
- Timestamp

**VehicleManager:**
- Vehicle switches (from → to)
- Vehicle purchases (type, price)
- Current selected vehicle
- Ownership status

**MissionManager:**
- Achievement unlocks
- Mission completions
- Mission progress updates

**ScoreManager:**
- Score submissions per game mode
- Best scores per player
- Leaderboard rankings
- Score verification status

**EconomyManager:**
- Currency transactions (earning/spending)
- Transaction types
- Balance history
- Daily login streaks
- Reward claims

---

## 📊 Response Examples

### Blockchain Health Check
```bash
curl "https://highway-hustle-backend.onrender.com/api/blockchain/health"
```

**Response:**
```json
{
  "healthy": true,
  "wallet": "0x63F63DC442299cCFe470657a769fdC6591d65eCa",
  "balance": "6.52",
  "contractAddress": "0x47B9D5B62C8302a89C435be307b9eAA8847FB295",
  "totalSessions": "142",
  "totalPlayers": "87",
  "chainId": 16661
}
```

### Get Player Sessions
```bash
curl "https://highway-hustle-backend.onrender.com/api/blockchain/sessions?user=0x1234...7890"
```

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "0",
      "playerAddress": "0x1234567890123456789012345678901234567890",
      "identifier": "0x1234567890123456789012345678901234567890",
      "timestamp": "2026-02-05T10:30:00.000Z",
      "sessionType": "all",
      "currency": "25000",
      "bestScore": "1500"
    }
  ]
}
```

### Get Blockchain Leaderboard
```bash
curl "https://highway-hustle-backend.onrender.com/api/blockchain/leaderboard?gameMode=0&topN=5"
```

**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "identifier": "0xplayer1...",
      "score": "10000",
      "rank": "1"
    },
    {
      "identifier": "0xplayer2...",
      "score": "9500",
      "rank": "2"
    }
  ]
}
```

---

**Built for Highway Hustle by Kult Games**  
**Blockchain Integration: 5 Contracts on 0G Mainnet**  
**Version:** 2.0