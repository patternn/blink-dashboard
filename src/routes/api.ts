import { Router, type Request, type Response } from "express";
import * as cache from "../services/cache.js";
import { aggregateMetrics } from "../jobs/aggregate.js";
import { logger } from "../utils/logger.js";

export const router = Router();

/**
 * GET /api/metrics
 * Returns the current cached metrics. If cache is empty, triggers
 * a fresh aggregation.
 */
router.get("/metrics", async (_req: Request, res: Response) => {
  try {
    let metrics = await cache.getCurrentMetrics();

    if (!metrics) {
      logger.info("Cache miss — running fresh aggregation");
      metrics = await aggregateMetrics();
    }

    res.json({ ok: true, data: metrics });
  } catch (err) {
    logger.error("GET /api/metrics failed", { error: err });
    res.status(500).json({ ok: false, error: "Failed to fetch metrics" });
  }
});

/**
 * GET /api/metrics/history?count=60
 * Returns recent metric snapshots for sparkline rendering.
 */
router.get("/metrics/history", async (req: Request, res: Response) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 60, 1440);
    const snapshots = await cache.getRecentSnapshots(count);

    res.json({ ok: true, data: snapshots });
  } catch (err) {
    logger.error("GET /api/metrics/history failed", { error: err });
    res.status(500).json({ ok: false, error: "Failed to fetch history" });
  }
});

/**
 * POST /api/metrics/refresh
 * Force a fresh aggregation (rate-limited in production).
 */
router.post("/metrics/refresh", async (_req: Request, res: Response) => {
  try {
    const metrics = await aggregateMetrics();
    res.json({ ok: true, data: metrics });
  } catch (err) {
    logger.error("POST /api/metrics/refresh failed", { error: err });
    res.status(500).json({ ok: false, error: "Aggregation failed" });
  }
});

/**
 * GET /api/health
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, uptime: process.uptime() });
});
