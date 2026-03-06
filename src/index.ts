import express from "express";
import cors from "cors";
import http from "node:http";
import { Server as SocketIO } from "socket.io";
import cron from "node-cron";

import { config, validateConfig } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { router as apiRouter } from "./routes/api.js";
import { connectRedis, disconnectRedis } from "./services/cache.js";
import { connectMongo, disconnectMongo } from "./services/galoy/mongodb.js";
import { aggregateMetrics } from "./jobs/aggregate.js";
import type { WsEvent, Metrics } from "./types/index.js";

// ─── Bootstrap ───────────────────────────────────────────────────

async function main() {
  // Validate config
  const warnings = validateConfig();
  warnings.forEach((w) => logger.warn(w));

  // Express app
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use("/api", apiRouter);

  // HTTP + WebSocket server
  const server = http.createServer(app);
  const io = new SocketIO(server, {
    cors: { origin: config.corsOrigin },
    transports: ["websocket", "polling"],
  });

  // ─── Connect data stores ────────────────────────────────────

  try {
    await connectRedis();
    logger.info("Redis connected");
  } catch (err) {
    logger.warn("Redis unavailable — metrics will not be cached", { error: err });
  }

  try {
    await connectMongo();
    logger.info("MongoDB connected");
  } catch (err) {
    logger.warn("MongoDB unavailable — using Admin API fallback", { error: err });
  }

  // ─── WebSocket connections ──────────────────────────────────

  io.on("connection", (socket) => {
    logger.debug("Client connected", { id: socket.id });

    socket.on("disconnect", () => {
      logger.debug("Client disconnected", { id: socket.id });
    });

    // Allow clients to request a fresh refresh
    socket.on("metrics:refresh", async () => {
      try {
        const metrics = await aggregateMetrics();
        const event: WsEvent<Metrics> = {
          type: "metrics:update",
          data: metrics,
          timestamp: new Date().toISOString(),
        };
        socket.emit("metrics:update", event);
      } catch (err) {
        socket.emit("error", { message: "Aggregation failed" });
      }
    });
  });

  // ─── Scheduled aggregation ─────────────────────────────────

  // Convert seconds to a cron-compatible interval
  const intervalSec = config.aggregationIntervalSeconds;

  // Run aggregation on a fixed interval using setInterval for
  // sub-minute precision (node-cron minimum is 1 minute)
  const aggregateAndBroadcast = async () => {
    try {
      const metrics = await aggregateMetrics();
      const event: WsEvent<Metrics> = {
        type: "metrics:update",
        data: metrics,
        timestamp: new Date().toISOString(),
      };
      io.emit("metrics:update", event);
    } catch (err) {
      logger.error("Scheduled aggregation failed", { error: err });
    }
  };

  // Initial run
  await aggregateAndBroadcast();

  // Recurring
  const intervalId = setInterval(aggregateAndBroadcast, intervalSec * 1000);
  logger.info(`Aggregation scheduled every ${intervalSec}s`);

  // Also schedule a daily full "countries" recalc at 03:00 UTC
  // (this is the expensive operation)
  cron.schedule("0 3 * * *", async () => {
    logger.info("Running daily countries recalculation...");
    await aggregateAndBroadcast();
  });

  // ─── Start server ──────────────────────────────────────────

  server.listen(config.port, () => {
    logger.info(`🚀 Blink Dashboard API running on port ${config.port}`);
    logger.info(`   REST:      http://localhost:${config.port}/api/metrics`);
    logger.info(`   WebSocket: ws://localhost:${config.port}`);
    logger.info(`   Health:    http://localhost:${config.port}/api/health`);
  });

  // ─── Graceful shutdown ─────────────────────────────────────

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down...`);
    clearInterval(intervalId);
    io.close();
    server.close();
    await disconnectRedis();
    await disconnectMongo();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Fatal error during startup", { error: err });
  process.exit(1);
});
