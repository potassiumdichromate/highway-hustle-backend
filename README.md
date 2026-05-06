# Highway Hustle Backend

Backend platform for Highway Hustle game services, built for production reliability and 0G-native integrations.

## What This Service Provides

- Player profile and game-state APIs (Privy, game, gamemode, vehicle, campaign)
- Authenticated access with identity-bound authorization
- 0G EVM writes for gameplay-related on-chain events
- 0G DA snapshots for durable player-state evidence
- 0G Compute-powered leaderboard commentary (with controlled fallback)
- Production observability: metrics, structured logs, request IDs, alerting config

## Architecture Overview

### Runtime
- Node.js + Express
- MongoDB (Mongoose)
- Modular routes and domain controllers

### Domain Controllers
- `controllers/authController.js`
- `controllers/playerDataController.js`
- `controllers/campaignController.js`
- `controllers/blockchainController.js`
- `controllers/daController.js`

### Routes
- `routes/playerRoutes.js` (core player + campaign + auth)
- `routes/blockchainRoutes.js`
- `routes/daRoutes.js`

## Security and API Guarantees

- JWT verification on protected routes
- Identity enforcement: request identity must match JWT subject/wallet
- Admin-only guard for sensitive endpoints
- Joi validation on write/auth entry points
- Rate limiting for login, state writes, leaderboard, and AI/comment paths
- Strict production CORS allowlist (`ALLOWED_ORIGINS` required in production)
- Standardized error contract for all `4xx/5xx` responses:
  - `success: false`
  - `error: string`
  - `code: string`
  - `requestId: string | null`
  - optional `details: string[]`

## 0G Integration

### 0G EVM
Services:
- `services/blockchainService.js`
- `services/scoreBlockchainService.js`
- `services/vehicleBlockchainService.js`
- `services/missionBlockchainService.js`
- `services/economyBlockchainService.js`

Core usage:
- Session tracking
- Score updates
- Vehicle and achievement events
- Economy and streak events

### 0G DA
Service:
- `services/zerogDAService.js`

Flow:
- Build player snapshot event
- Submit to DA gateway (`/v1/events`)
- Persist `eventId` and status reference in MongoDB
- Query via:
  - `GET /api/da/snapshot`
  - `GET /api/da/status`
  - `GET /api/da/retrieve`
  - `GET /api/da/health`

### 0G Compute
Service:
- `services/aiCommentService.js`

Flow:
- Primary inference via 0G Compute
- Controlled fallback path only on explicit failure conditions
- Endpoint:
  - `GET /api/leaderboard/ai-comment?user=<identifier>&type=<global|gate>`

## Observability and Operations

### Built-in
- `GET /health` for service health
- `GET /metrics` for Prometheus
- JSON request logs with `requestId`, method, path, status, and latency

### Monitoring Stack Assets
- `monitoring/prometheus.yml`
- `monitoring/alert_rules.yml`
- `monitoring/alertmanager.yml`
- `monitoring/docker-compose.monitoring.yml`
- Grafana provisioning and dashboard JSON under `monitoring/grafana/`
- Fire-drill evidence: `monitoring/FIRE_DRILL_EVIDENCE.md`

## Quick Start

### Prerequisites
- Node.js >= 18
- npm >= 9
- MongoDB

### Install
```bash
npm install
```

### Configure
```bash
cp .env.example .env
```

Required production baseline:
```env
NODE_ENV=production
PORT=5001
MONGO_URI=<mongodb-uri>
BROWSER_JWT_SECRET=<strong-secret>
ALLOWED_ORIGINS=https://your-frontend.example
```

### Run
```bash
npm start
```

### Test
```bash
npm test
```

## API Surface (Core)

### Authentication
- `POST /api/player/login`
- `POST /api/player/login/auto`

### Player Data
- `GET /api/player/all`
- `GET /api/player/privy`
- `GET /api/player/game`
- `GET /api/player/gamemode`
- `GET /api/player/vehicle`
- `POST /api/player/all`
- `POST /api/player/privy`
- `POST /api/player/game`
- `POST /api/player/gamemode`
- `POST /api/player/vehicle`

### Campaign and Leaderboard
- `GET /api/check-user-achievement`
- `GET /api/check-gate-user-achievement`
- `GET /api/leaderboard`
- `GET /api/leaderboard/gate-wallet`
- `POST /api/leaderboard/comment-ping`
- `GET /api/leaderboard/ai-comment`
- `GET /api/users` (admin-only)

### Blockchain and DA
- `GET /api/blockchain/*`
- `GET /api/da/*`
- `POST /api/da/retry`

For endpoint-level payload details, use `API_DOCUMENTATION.md`.

## Readiness Notes

This backend is designed to be reviewable by engineering and investment stakeholders:

- explicit security controls
- explicit operational observability
- clear 0G usage across EVM, DA, and Compute
- contract-tested API error behavior