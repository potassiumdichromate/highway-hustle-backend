const client = require("prom-client");

client.collectDefaultMetrics({
  prefix: "highway_hustle_backend_",
});

const httpRequestsTotal = new client.Counter({
  name: "highway_hustle_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "highway_hustle_http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const sanitizeRoute = (req) => {
  return req.route?.path || req.baseUrl || req.path || "unknown";
};

const observeHttpRequest = (req, res) => {
  const startNs = process.hrtime.bigint();
  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1_000_000_000;
    const labels = {
      method: req.method,
      route: sanitizeRoute(req),
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels, 1);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });
};

const metricsHandler = async (req, res) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).json({ success: false, error: "Metrics unavailable", code: "METRICS_UNAVAILABLE" });
  }
};

module.exports = { observeHttpRequest, metricsHandler };
