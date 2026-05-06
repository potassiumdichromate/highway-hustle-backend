const legacy = require("./playerController");

module.exports = {
  getDASnapshot: legacy.getDASnapshot,
  getDAStatus: legacy.getDAStatus,
  retrieveDAEvent: legacy.retrieveDAEvent,
  getDAHealth: legacy.getDAHealth,
  retryFailedDASubmissions: legacy.retryFailedDASubmissions,
};
