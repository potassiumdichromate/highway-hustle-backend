# Highway Hustle Observability Setup

This backend now exposes Prometheus metrics at `GET /metrics`.

## 1) Bring up monitoring stack

Run from `monitoring/`:

`docker compose -f docker-compose.monitoring.yml up -d`

Services:

- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`
- Grafana: `http://localhost:3001`

## 2) Prometheus

- Use `monitoring/prometheus.yml`
- Ensure backend target points to your deployed host and port.

Example target:

```yaml
static_configs:
  - targets:
      - "api.highwayhustle.xyz:443"
```

If running behind HTTPS/load balancer, configure `scheme: https` and auth as needed.

## 3) Alerts

Prometheus alert rules are provided in:

- `monitoring/alert_rules.yml`

Included alerts:

- High 5xx ratio
- High p95 latency
- No traffic heartbeat

Tune thresholds based on your baseline.

## 4) Grafana (auto-provisioned)

This repo now ships:

- Datasource provisioning: `grafana/provisioning/datasources/prometheus.yml`
- Dashboard provisioning: `grafana/provisioning/dashboards/dashboards.yml`
- Starter dashboard JSON: `grafana/dashboards/highway-hustle-overview.json`

Use admin/admin locally and rotate credentials in production.

## 5) Grafana (recommended additional panels)

Build panels for:

- Request rate: `sum(rate(highway_hustle_http_requests_total[5m]))`
- 5xx rate: `sum(rate(highway_hustle_http_requests_total{status_code=~"5.."}[5m]))`
- p95 latency:
  `histogram_quantile(0.95, sum(rate(highway_hustle_http_request_duration_seconds_bucket[5m])) by (le))`
- Status split by code:
  `sum(rate(highway_hustle_http_requests_total[5m])) by (status_code)`

## 6) Logging

The server logs structured JSON with `requestId`.
Ship logs to your provider (Datadog/Loki/ELK/Sentry) and index:

- `requestId`
- `path`
- `method`
- `status`
- `durationMs`

## 7) Fire drill (required for 9.5+ confidence)

- Temporarily lower alert threshold in `alert_rules.yml`
- Generate synthetic 5xx traffic
- Verify:
  - Alert appears in Prometheus/Alertmanager
  - Receiver notification fires (email/Slack/PagerDuty)
  - Incident note includes `requestId`-based trace

Store one screenshot/log bundle as release evidence.

## 8) Production checklist

- [ ] Prometheus scraping `/metrics`
- [ ] Alertmanager destinations configured (Slack/PagerDuty/Email)
- [ ] Grafana dashboard created and shared
- [ ] Log sink enabled and searchable by `requestId`
- [ ] Runbook links attached to alerts
