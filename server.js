const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
require("dotenv").config();

const app = express();

// ========== SECURITY & PERFORMANCE MIDDLEWARE ==========
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// ========== BODY PARSING ==========
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== REQUEST LOGGING (Production) ==========
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ========== ROUTES ==========
const playerRoutes = require("./routes/playerRoutes");
app.use("/api", playerRoutes);

// ========== HEALTH CHECK ==========
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: "Endpoint not found" 
  });
});

// ========== GLOBAL ERROR HANDLER ==========
app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err);
  res.status(500).json({ 
    success: false, 
    error: "Internal server error" 
  });
});

// ========== DATABASE CONNECTION ==========
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => {
  console.error("❌ MongoDB Connection Error:", err);
  process.exit(1);
});

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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Highway Hustle Backend running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;