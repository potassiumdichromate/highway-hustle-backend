const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const crypto = require("crypto");
require("dotenv").config();
const { getJwtSecret } = require("./middleware/auth");
const { observeHttpRequest, metricsHandler } = require("./lib/metrics");
const { responseContractMiddleware } = require("./middleware/responseContract");
const playerRoutes = require("./routes/playerRoutes");

const app = express();

// ========== SECURITY & PERFORMANCE MIDDLEWARE ==========
app.use(helmet());
app.use(compression());

const parseAllowedOrigins = () =>
  String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

const isProd = process.env.NODE_ENV === "production";
const devAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const configuredOrigins = parseAllowedOrigins();
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : (isProd ? [] : devAllowedOrigins);
if (isProd && allowedOrigins.length === 0) {
  throw new Error("ALLOWED_ORIGINS is required in production");
}
if (isProd) {
  getJwtSecret();
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) {
      return callback(new Error("CORS origin rejected"), false);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS origin rejected"), false);
  },
  credentials: true
}));

// ========== BODY PARSING ==========
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== RESPONSE CONTRACT ENFORCEMENT ==========
app.use(responseContractMiddleware);

const metrics = {
  requests: 0,
  errors5xx: 0,
  byStatus: {}
};

// ========== REQUEST LOGGING + BASIC METRICS ==========
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = Number(res.statusCode);
    metrics.requests += 1;
    metrics.byStatus[status] = (metrics.byStatus[status] || 0) + 1;
    if (status >= 500) metrics.errors5xx += 1;
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: status >= 500 ? "error" : "info",
      msg: "http_request",
      requestId,
      method: req.method,
      path: req.path,
      status,
      durationMs: duration
    }));
  });
  next();
});
app.use((req, res, next) => {
  observeHttpRequest(req, res);
  next();
});

// ========== ROUTES ==========
app.use("/api", playerRoutes);

// ========== HEALTH CHECK ==========
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    metrics
  });
});
app.get("/metrics", metricsHandler);

// ========== 404 HANDLER ==========
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: "Endpoint not found",
    code: "NOT_FOUND"
  });
});

// ========== GLOBAL ERROR HANDLER ==========
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: "error",
    msg: "unhandled_error",
    requestId: req.requestId || null,
    path: req.path,
    method: req.method,
    error: err?.message || "unknown_error"
  }));
  res.status(500).json({ 
    success: false, 
    error: "Internal server error",
    code: "INTERNAL_ERROR"
  });
});

const isTest = process.env.NODE_ENV === "test";

// ========== 0G DA GATEWAY HEALTH CHECK ON STARTUP ==========
const zerogDAService = require("./services/zerogDAService");
const daSnapshotService = require("./services/daSnapshotService");
const runStartupTasks = () => {
  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.log("⚠️  Backend running without MongoDB. Blockchain features still work!");
  });

  zerogDAService.healthCheck().then((s) => {
  const dbg = zerogDAService.getDebugSummary?.() || {};
  console.log('[0g-da] startup health check', {
    ...dbg,
    healthOnline: s.online,
    healthGateway: s.gateway,
    targetMode: s.targetMode,
    completed: s.completed,
    healthError: s.error || null,
  });
  if (s.online) {
    console.log(
      `✅ 0G DA Gateway: online | ${s.gateway} | mode: ${s.targetMode} | completed blobs: ${s.completed}`
    );
  } else {
    console.log(
      `⚠️  0G DA Gateway: unreachable (${s.gateway}) — DA submits may fail; POST target is ${dbg.eventsUrl || 'see [0g-da] startup config'}`
    );
  }
  }).catch(() => console.log(`⚠️  0G DA Gateway: health check failed`));

  daSnapshotService.startBackgroundSync();
};

// ========== INITIALIZE ALL BLOCKCHAIN SERVICES ON STARTUP ==========
const blockchainService = require("./services/blockchainService");
const vehicleBlockchainService = require("./services/vehicleBlockchainService");
const missionBlockchainService = require("./services/missionBlockchainService");
const scoreBlockchainService = require("./services/scoreBlockchainService");
const economyBlockchainService = require("./services/economyBlockchainService");

async function initializeBlockchain() {
  console.log("\n🔗 Starting Blockchain Services...\n");
  
  const services = [
    { name: "Session Tracker", service: blockchainService },
    { name: "Vehicle Manager", service: vehicleBlockchainService },
    { name: "Mission Manager", service: missionBlockchainService },
    { name: "Score Manager", service: scoreBlockchainService },
    { name: "Economy Manager", service: economyBlockchainService }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const { name, service } of services) {
    try {
      const result = await service.initialize();
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        console.error(`❌ ${name} failed:`, result.error);
      }
    } catch (error) {
      failCount++;
      console.error(`❌ ${name} error:`, error.message);
    }
  }
  
  console.log(`\n📊 Blockchain Initialization Summary:`);
  console.log(`   ✅ Successful: ${successCount}/${services.length}`);
  console.log(`   ❌ Failed: ${failCount}/${services.length}`);
  
  if (successCount > 0) {
    console.log(`\n✅ Backend ready with ${successCount} blockchain service(s)!\n`);
  } else {
    console.log(`\n⚠️  Backend running without blockchain services. API still works!\n`);
  }
}

// Initialize blockchain after a short delay to ensure server is ready
const scheduleBlockchainInit = () => {
  setTimeout(initializeBlockchain, 2000);
};

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// ========== START SERVER ==========
const startServer = () => {
  const PORT = process.env.PORT || 5001;
  return app.listen(PORT, () => {
    console.log(`🚀 Highway Hustle Backend running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Blockchain Integration: Enabled (5 contracts)`);
  });
};

if (!isTest) {
  runStartupTasks();
  scheduleBlockchainInit();
  startServer();
}

module.exports = app;
