# Alert Fire-Drill Evidence

Date: 2026-05-06

## Objective

Validate that monitoring stack configuration is runnable and includes:

- Prometheus scrape + alert rules
- Alertmanager wiring
- Grafana provisioning

## Commands run

1) Render compose config:

`docker compose -f docker-compose.monitoring.yml config`

Result: success. Rendered services:

- `highway-hustle-prometheus`
- `highway-hustle-alertmanager`
- `highway-hustle-grafana`

2) Start full stack:

`docker compose -f docker-compose.monitoring.yml up -d`

`docker compose -f docker-compose.monitoring.yml up -d && docker compose -f docker-compose.monitoring.yml ps`

Result: success. Services were up:

- `highway-hustle-prometheus` on `:9090`
- `highway-hustle-alertmanager` on `:9093`
- `highway-hustle-grafana` on `:3001`

3) Inject synthetic alert into Alertmanager:

`curl -s -X POST http://localhost:9093/api/v2/alerts ...`

Then verify:

`curl -s http://localhost:9093/api/v2/alerts`

Result: success. Active alert present:

- `alertname: FireDrillSyntheticAlert`
- `severity: warning`
- `receiver: default-email`

## Verification items completed

- Monitoring compose validates cleanly.
- Monitoring stack starts and exposes all ports.
- Synthetic alert was accepted and visible in Alertmanager API.
- Prometheus config includes alertmanager target (`alertmanager:9093`).
- Alert rules file is wired into Prometheus (`alert_rules.yml`).
- Grafana datasource/dashboard provisioning is mounted in compose.

## Remaining production action

Run the same fire-drill against your production deployment and capture:

- Prometheus firing a rule from `alert_rules.yml` (not just synthetic injection)
- alert notification delivery proof (email/Slack/PagerDuty)
- incident note with `requestId` trace linkage
