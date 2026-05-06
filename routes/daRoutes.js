const express = require("express");
const router = express.Router();
const {
  getDASnapshot,
  getDAStatus,
  retrieveDAEvent,
  getDAHealth,
  retryFailedDASubmissions,
} = require("../controllers/daController");

router.get("/da/snapshot", getDASnapshot);
router.get("/da/status", getDAStatus);
router.get("/da/retrieve", retrieveDAEvent);
router.get("/da/health", getDAHealth);
router.post("/da/retry", retryFailedDASubmissions);

module.exports = router;
