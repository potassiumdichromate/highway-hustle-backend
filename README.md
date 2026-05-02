# Highway Hustle Backend v2.0

Production-ready backend for Highway Hustle Web3 racing game with categorized player data management and Galxe campaign integration.

## 🚀 Features

- **Categorized Player Data**: Privy, Game, GameMode, Vehicle, and Campaign data
- **Flexible User Identification**: Query by wallet address, Discord, Telegram, or email
- **Auto-Player Creation**: First GET request auto-creates player with defaults
- **Galxe Integration**: Campaign achievement endpoint for Web3 quests
- **0G EVM Integration**: Session, score, vehicle, mission, and economy contract recording
- **0G DA Integration**: Player memory snapshots through DA Event Gateway
- **0G Compute Integration**: Leaderboard commentary generated via 0G first, Cloudflare fallback
- **Production Ready**: Security headers, compression, error handling, graceful shutdown
- **No Auth Middleware**: Direct access to all endpoints

## 0G Integration (Grant/Milestone)

This backend integrates all three relevant 0G layers for game infrastructure:

1. **0G EVM** for on-chain gameplay events and stats.
2. **0G DA** for durable player-state snapshots via DA Event Gateway.
3. **0G Compute** for AI leaderboard commentary generation.

### 1) 0G EVM Usage

Services:
- `services/blockchainService.js` (session tracker)
- `services/scoreBlockchainService.js`
- `services/vehicleBlockchainService.js`
- `services/missionBlockchainService.js`
- `services/economyBlockchainService.js`

Network defaults are aligned across services:
- `ZEROG_RPC_URL=https://evmrpc.0g.ai`
- `ZEROG_CHAIN_ID=16661`

Main contract interactions:
- Record session activity
- Submit best score updates
- Record vehicle purchases/switches
- Unlock achievements (campaign verification)
- Record economy transactions and streaks

### 2) 0G DA Usage

Service:
- `services/zerogDAService.js`

Flow:
- Backend builds event payloads (player snapshot)
- Sends to DA gateway (`/v1/events`) with generated `eventId`
- Stores `eventId` in Mongo (`daSnapshot`) for tracking
- Supports:
  - `GET /api/da/snapshot`
  - `GET /api/da/status`
  - `GET /api/da/retrieve`
  - `GET /api/da/health`

### 3) 0G Compute Usage (Primary Path)

Service:
- `services/aiCommentService.js`

Current production behavior:
- **Primary inference**: 0G Compute
- **Model**: `zai-org/GLM-5-FP8`
- **max_tokens**: `150`
- **timeout**: `8000ms`
- **Fallback**: Cloudflare only if 0G fails/times out/invalid output

API:
- `GET /api/leaderboard/ai-comment?user=<identifier>&type=<global|gate>`

Response metadata includes source:
- `_meta.source: "0g_compute"` on normal path
- `_meta.source: "cloudflare_fallback"` on fallback

### Evidence Snippets (for reviewers)

0G success log:
```text
[0g-compute] leaderboard_comment.inference_success {
  leaderboardType: "global",
  model: "zai-org/GLM-5-FP8",
  latencyMs: 1234,
  max_tokens_requested: 150,
  timeout_ms: 8000,
  token_usage: { prompt_tokens: 92, completion_tokens: 41, total_tokens: 133 }
}
```

Fallback path log:
```text
[ai-comment] 0g request failed { status: 502, leaderboardType: "global", latencyMs: 8010, model: "zai-org/GLM-5-FP8" }
[ai-comment] using cloudflare fallback { leaderboardType: "global", reason: "http_error" }
[ai-comment] cloudflare_fallback.success { leaderboardType: "global", model: "@cf/meta/llama-3.1-8b-instruct-fast", latencyMs: 940 }
```

API output example (normal):
```json
{
  "success": true,
  "comment": "You are closing the gap fast—one more clean run and the leader will feel the pressure.",
  "_meta": {
    "source": "0g_compute"
  }
}
```

## 0G Environment Variables

```env
# 0G EVM
ZEROG_RPC_URL=https://evmrpc.0g.ai
ZEROG_CHAIN_ID=16661
DEPLOYER_PRIVATE_KEY=<private-key>
SESSION_CONTRACT_ADDRESS=<address>
SCORE_CONTRACT_ADDRESS=<address>
VEHICLE_CONTRACT_ADDRESS=<address>
MISSION_CONTRACT_ADDRESS=<address>
ECONOMY_CONTRACT_ADDRESS=<address>

# 0G DA
ZEROG_DA_GATEWAY_URL=https://da.warzonewarriors.xyz
ZEROG_DA_API_KEY=<optional-bearer>
ZEROG_DA_ENABLED=true

# 0G Compute
ZEROG_API_KEY=<api-key>
ZEROG_BASE_URL=https://compute-network-1.integratenetwork.work/v1/proxy
ZEROG_MODEL=zai-org/GLM-5-FP8
ZEROG_TIMEOUT_MS=8000
ZEROG_LEADERBOARD_MODEL=zai-org/GLM-5-FP8
ZEROG_LEADERBOARD_MAX_TOKENS=150
ZEROG_LEADERBOARD_TIMEOUT_MS=8000
```

## 📁 Project Structure

```
highway-hustle-backend/
├── models/
│   └── PlayerState.js          # Mongoose schema with categorized data
├── controllers/
│   └── playerController.js     # All business logic
├── routes/
│   └── playerRoutes.js         # API route definitions
├── server.js                   # Express app setup
├── package.json
├── .env.example
├── API_DOCUMENTATION.md        # Complete API docs
└── README.md
```

## 🛠️ Installation

### Prerequisites
- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- npm >= 9.0.0

### Setup Steps

1. **Clone/Download the backend files**

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env`:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/highway-hustle?retryWrites=true&w=majority
PORT=5000
NODE_ENV=production
ALLOWED_ORIGINS=https://highwayhustle.xyz,https://www.highwayhustle.xyz
```

4. **Start the server**

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## 📡 API Endpoints

### Player Data Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/player/all?user={id}` | Get all player data |
| GET | `/api/player/privy?user={id}` | Get privy data only |
| GET | `/api/player/game?user={id}` | Get game data only |
| GET | `/api/player/gamemode?user={id}` | Get gamemode scores |
| GET | `/api/player/vehicle?user={id}` | Get vehicle data |
| POST | `/api/player/all?user={id}` | Update all player data |
| POST | `/api/player/privy?user={id}` | Update privy data |
| POST | `/api/player/game?user={id}` | Update game data |
| POST | `/api/player/gamemode?user={id}` | Update gamemode scores |
| POST | `/api/player/vehicle?user={id}` | Update vehicle data |

### Campaign & Utilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/check-user-achievement?user={id}` | Check Galxe achievement |
| GET | `/api/leaderboard` | Top 10 players by currency |
| GET | `/api/users` | All users sorted by currency |
| GET | `/health` | Health check |

**Note:** `{id}` can be wallet address, Discord ID, Telegram ID, or email

## 🎮 Usage Examples

### Unity WebGL Integration

```csharp
// Load player state
IEnumerator LoadPlayerState(string walletAddress)
{
    string url = $"https://api.highwayhustle.xyz/api/player/all?user={walletAddress}";
    UnityWebRequest request = UnityWebRequest.Get(url);
    
    yield return request.SendWebRequest();
    
    if (request.result == UnityWebRequest.Result.Success)
    {
        PlayerData data = JsonUtility.FromJson<PlayerData>(request.downloadHandler.text);
        // Apply to game state
    }
}

// Update player currency
IEnumerator UpdateCurrency(string walletAddress, int newCurrency)
{
    string url = $"https://api.highwayhustle.xyz/api/player/game?user={walletAddress}";
    string json = $"{{\"currency\": {newCurrency}}}";
    
    UnityWebRequest request = new UnityWebRequest(url, "POST");
    byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
    request.uploadHandler = new UploadHandlerRaw(bodyRaw);
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Content-Type", "application/json");
    
    yield return request.SendWebRequest();
}
```

### React Frontend Integration

```javascript
// Player state manager
const PlayerAPI = {
  baseURL: 'https://api.highwayhustle.xyz/api',
  
  async loadPlayer(identifier) {
    const res = await fetch(`${this.baseURL}/player/all?user=${identifier}`);
    return res.json();
  },
  
  async updateGameData(identifier, data) {
    const res = await fetch(`${this.baseURL}/player/game?user=${identifier}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  
  async checkAchievement(identifier) {
    const res = await fetch(`${this.baseURL}/check-user-achievement?user=${identifier}`);
    return res.json();
  }
};

// Usage
const player = await PlayerAPI.loadPlayer(walletAddress);
await PlayerAPI.updateGameData(walletAddress, { 
  currency: player.data.userGameData.currency + 1000 
});
```

## 🎯 Galxe Campaign Integration

The achievement endpoint is specifically designed for Galxe quest verification:

```javascript
// Galxe handler function
function handle(resp) {
  if(resp.data.Achieved1000M === true){
    return 1;  // User qualified
  } else {
    return 0;  // User not qualified
  }
}
```

**Setting achievement from game:**
```javascript
await fetch(`${API_URL}/player/all?user=${wallet}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    campaignData: { Achieved1000M: true }
  })
});
```

## 🔒 Security Features

- **Helmet.js**: Security headers
- **CORS**: Configurable origin whitelist
- **Compression**: Gzip response compression
- **Input Validation**: Query parameter sanitization
- **Error Handling**: Graceful error responses
- **Graceful Shutdown**: Proper cleanup on SIGINT/SIGTERM

## 📊 Database Schema

```javascript
{
  privyData: {
    walletAddress: String (indexed),
    discord: String (indexed),
    telegram: String (indexed),
    email: String (indexed)
  },
  userGameData: {
    playerName: String,
    currency: Number,
    lastWeekCurrency: Number,
    totalPlayedTime: Number (float)
  },
  playerGameModeData: {
    bestScoreOneWay: Number,
    bestScoreTwoWay: Number,
    bestScoreTimeAttack: Number,
    bestScoreBomb: Number
  },
  playerVehicleData: {
    selectedPlayerCarIndex: Number,
    JeepOwned: Number (0/1),
    VanOwned: Number (0/1),
    SierraOwned: Number (0/1),
    SedanOwned: Number (0/1),
    LamborghiniOwned: Number (0/1)
  },
  campaignData: {
    Achieved1000M: Boolean
  },
  lastUpdated: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 🚢 Deployment

### Recommended Platforms
- **Railway**: Easy deployment with MongoDB add-on
- **Render**: Free tier available
- **Vercel**: Serverless functions
- **DigitalOcean**: App Platform
- **AWS**: Elastic Beanstalk or Lambda

### Environment Variables for Production
```env
MONGO_URI=<your-mongodb-connection-string>
PORT=5000
NODE_ENV=production
ALLOWED_ORIGINS=https://highwayhustle.xyz,https://www.highwayhustle.xyz
```

### Build Command
```bash
npm install
```

### Start Command
```bash
npm start
```

## 🧪 Testing

### Test Health Endpoint
```bash
curl http://localhost:5000/health
```

### Test Player Creation
```bash
curl "http://localhost:5000/api/player/all?user=0x1234567890123456789012345678901234567890"
```

### Test Player Update
```bash
curl -X POST "http://localhost:5000/api/player/game?user=0x1234567890123456789012345678901234567890" \
  -H "Content-Type: application/json" \
  -d '{"currency": 50000, "playerName": "TestPlayer"}'
```

## 📝 Logging

Production logging format:
```
[2024-01-22T10:30:00.000Z] GET /api/player/all - 200 (45ms)
[2024-01-22T10:30:01.000Z] POST /api/player/game - 200 (23ms)
```

## 🔧 Maintenance

### Database Backups
Set up automated MongoDB backups via Atlas or your hosting provider.

### Monitoring
- Monitor `/health` endpoint
- Track response times
- Monitor MongoDB connection status

### Scaling
- Enable MongoDB connection pooling (already configured)
- Add Redis caching for frequently accessed players
- Implement rate limiting if needed

## 📄 License

MIT

## 👤 Author

**Sidhanth (Potassium)**
- CTO @ Kult Games
- Twitter: [@6amguy](https://twitter.com/6amguy)
- Telegram: [@Sidmahtoo](https://t.me/Sidmahtoo)

---

Built with ❤️ for the Highway Hustle Web3 racing community