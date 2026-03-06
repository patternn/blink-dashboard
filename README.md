# Blink Dashboard

Real-time metrics dashboard for Blink (built on Galoy). Tracks Active Users, Transactions, New Users, BTC in Custody, and Countries Active.

## Architecture

```
┌──────────────────────────────────────────────┐
│              Data Sources                     │
│                                               │
│  MongoDB (Galoy DB)  ←  primary source        │
│  Galoy Admin GraphQL ←  fallback              │
│  Bria API            ←  on-chain balances     │
└─────────────┬────────────────────────────────┘
              │
    ┌─────────▼──────────┐
    │  Aggregation Job    │  runs every 30s
    │  (src/jobs)         │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  Redis Cache        │  current + snapshots
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  Express + Socket.IO│  REST + WebSocket
    │  (src/index.ts)     │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  React Dashboard    │  (separate frontend)
    └─────────────────────┘
```

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/YOUR_ORG/blink-dashboard.git
cd blink-dashboard
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your Galoy Admin API credentials, MongoDB URI, etc.

# 3. Run with Docker (includes Redis)
docker compose up

# Or run locally (requires Redis running)
npm run dev
```

## API Endpoints

| Method | Path                    | Description                          |
|--------|-------------------------|--------------------------------------|
| GET    | `/api/metrics`          | Current aggregated metrics           |
| GET    | `/api/metrics/history`  | Snapshots for sparklines (query: `count`) |
| POST   | `/api/metrics/refresh`  | Force a fresh aggregation            |
| GET    | `/api/health`           | Health check                         |

## WebSocket Events

Connect via Socket.IO to receive real-time updates:

```typescript
import { io } from "socket.io-client";

const socket = io("ws://localhost:3100");
socket.on("metrics:update", (event) => {
  console.log(event.data); // Metrics object
});
```

## Metrics & Data Sources

| Metric           | Primary Source          | Fallback               |
|------------------|------------------------|------------------------|
| Active Users     | MongoDB aggregation    | Admin API `filteredUserCount` |
| Transactions     | MongoDB ledger count   | —                      |
| New Users        | MongoDB `createdAt`    | —                      |
| BTC in Custody   | MongoDB wallet balances| Bria API               |
| Countries Active | MongoDB phone codes    | Admin API per-country  |

## Configuration

All configuration is via environment variables. See `.env.example` for the full list.

Key variables:
- `GALOY_ADMIN_API_URL` — Your Galoy admin GraphQL endpoint
- `GALOY_ADMIN_AUTH_TOKEN` — Bearer token for admin API
- `MONGODB_URI` — Read-only connection to Galoy's MongoDB
- `REDIS_URL` — Cache layer
- `AGGREGATION_INTERVAL_SECONDS` — How often to refresh (default: 30)

## Project Structure

```
src/
├── config/          # Environment & validation
├── jobs/            # Aggregation logic
├── routes/          # Express API routes
├── services/
│   ├── cache.ts     # Redis operations
│   └── galoy/
│       ├── admin.ts # Galoy Admin GraphQL client
│       └── mongodb.ts # Direct DB aggregation
├── types/           # TypeScript interfaces & Zod schemas
├── utils/           # Logger, helpers
└── index.ts         # Server entry point
```

## Development

```bash
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm run typecheck    # Type check without building
npm run jobs:aggregate  # Run aggregation once (debug)
```

## Notes

- MongoDB collection names may vary between Galoy versions. The service tries multiple common names (`accounts`, `users`, `medici_transactions`, etc.).
- The `countries` metric is expensive to compute. It runs with every aggregation cycle but could be isolated to a daily cron if needed.
- BTC custody is reported in BTC (converted from satoshis).

## License

MIT
