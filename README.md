# Blink Dashboard

Real-time Blink metrics dashboard — reads from BigQuery, zero prod DB load

## Architecture

```
BigQuery (Galoy stream)
        │
        │  SQL queries every 60s
        ▼
  Express + Socket.IO ──► Redis (cache + history)
        │
        │  WebSocket + REST
        ▼
  React Dashboard (frontend/)
```

## Metrics

Each metric includes **rolling 30d vs prev 30d** and **rolling 7d vs prev 7d** comparisons:

| Metric | BigQuery Query |
|---|---|
| Active Users | Distinct accounts with transactions in period |
| Transactions | Count of transactions in period |
| New Users | Accounts created in period |
| BTC in Custody | Sum of BTC wallet balances (sats → BTC) |
| Countries Active | Distinct phone country codes of active accounts |

## Setup

```bash
npm install
cp .env.example .env
# Add your BigQuery credentials and project info to .env
# Place service account JSON in credentials/blink-bigquery-key.json
npm run dev
```

## Configuration

All via `.env`. Key variables:

- `BIGQUERY_PROJECT_ID` — GCP project
- `BIGQUERY_DATASET` — Dataset name (e.g. `galoy_production`)
- `BIGQUERY_TABLE_*` — Table names (update when schema is confirmed)
- `BIGQUERY_FIELD_*` — Field names (update when schema is confirmed)
- `GOOGLE_APPLICATION_CREDENTIALS` — Path to service account JSON

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/metrics` | Current metrics with 30d/7d comparisons |
| GET | `/api/metrics/history?count=60` | Snapshots for sparklines |
| POST | `/api/metrics/refresh` | Force refresh |
| GET | `/api/health` | Health check |

## Adapting to actual schema

Once you have BigQuery access:

1. Run `bq show --schema PROJECT:DATASET.TABLE` to inspect tables
2. Update `BIGQUERY_TABLE_*` and `BIGQUERY_FIELD_*` in `.env`
3. Test with `npm run jobs:aggregate`
