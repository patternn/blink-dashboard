import { Router, type Request, type Response } from "express";
import * as cache from "../services/cache";
import { aggregateMetrics } from "../jobs/aggregate";
import { logger } from "../utils/logger";

export const router = Router();

/**
 * GET /api/metrics
 * Returns current metrics with 30d and 7d period comparisons.
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
 * Returns recent snapshots for sparklines.
 */
router.get("/metrics/history", async (req: Request, res: Response) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 60, 1440);
    const history = await cache.getHistory(count);
    res.json({ ok: true, data: history });
  } catch (err) {
    logger.error("GET /api/metrics/history failed", { error: err });
    res.status(500).json({ ok: false, error: "Failed to fetch history" });
  }
});

/**
 * POST /api/metrics/refresh
 * Force fresh aggregation.
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
