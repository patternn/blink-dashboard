import express from "express";
import cors from "cors";
import http from "node:http";
import { Server as SocketIO } from "socket.io";

import { config, validateConfig } from "./config/index";
import { logger } from "./utils/logger";
import { router as apiRouter } from "./routes/api";
import { connectRedis, disconnectRedis } from "./services/cache";
import { aggregateMetrics } from "./jobs/aggregate";
import type { WsEvent, DashboardMetrics } from "./types/index";

async function main() {
  const warnings = validateConfig();
  warnings.forEach((w) => logger.warn(w));

  // Express
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use("/api", apiRouter);

  // HTTP + WebSocket
  const server = http.createServer(app);
  const io = new SocketIO(server, {
    cors: { origin: config.corsOrigin },
    transports: ["websocket", "polling"],
  });

  // Redis
  try {
    await connectRedis();
  } catch (err) {
    logger.warn("Redis unavailable — metrics will not be cached", { error: err });
  }

  // WebSocket
  io.on("connection", (socket) => {
    logger.debug("Client connected", { id: socket.id });
    socket.on("disconnect", () => logger.debug("Client disconnected", { id: socket.id }));

    socket.on("metrics:refresh", async () => {
      try {
        const metrics = await aggregateMetrics();
        socket.emit("metrics:update", {
          type: "metrics:update",
          data: metrics,
          timestamp: new Date().toISOString(),
        } satisfies WsEvent<DashboardMetrics>);
      } catch {
        socket.emit("error", { message: "Aggregation failed" });
      }
    });
  });

  // Scheduled aggregation
  const intervalSec = config.aggregationIntervalSeconds;

  const aggregateAndBroadcast = async () => {
    try {
      const metrics = await aggregateMetrics();
      io.emit("metrics:update", {
        type: "metrics:update",
        data: metrics,
        timestamp: new Date().toISOString(),
      } satisfies WsEvent<DashboardMetrics>);
    } catch (err) {
      logger.error("Scheduled aggregation failed", { error: err });
    }
  };

  // Initial run
  await aggregateAndBroadcast();

  // Recurring
  const intervalId = setInterval(aggregateAndBroadcast, intervalSec * 1000);
  logger.info(`BigQuery aggregation scheduled every ${intervalSec}s`);

  // Start
  server.listen(config.port, () => {
    logger.info(`Blink Dashboard API running on port ${config.port}`);
    logger.info(`  REST:      http://localhost:${config.port}/api/metrics`);
    logger.info(`  WebSocket: ws://localhost:${config.port}`);
    logger.info(`  Health:    http://localhost:${config.port}/api/health`);
  });

  // Shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} — shutting down...`);
    clearInterval(intervalId);
    io.close();
    server.close();
    await disconnectRedis();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Fatal startup error", { error: err });
  process.exit(1);
});
