import Redis from "ioredis";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import type { Metrics, MetricsSnapshot } from "../../types/index.js";

// ─── Keys ────────────────────────────────────────────────────────

const KEYS = {
  CURRENT_METRICS: "blink:metrics:current",
  SNAPSHOTS: "blink:metrics:snapshots", // sorted set by timestamp
} as const;

const MAX_SNAPSHOTS = 1440; // ~24h at 1 per minute

// ─── Connection ──────────────────────────────────────────────────

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on("error", (err) => logger.error("Redis error", { error: err }));
    redis.on("connect", () => logger.info("Connected to Redis"));
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const r = getRedis();
  if (r.status === "ready") return;
  await r.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// ─── Metrics storage ─────────────────────────────────────────────

export async function setCurrentMetrics(metrics: Metrics): Promise<void> {
  const r = getRedis();
  await r.set(KEYS.CURRENT_METRICS, JSON.stringify(metrics));
}

export async function getCurrentMetrics(): Promise<Metrics | null> {
  const r = getRedis();
  const raw = await r.get(KEYS.CURRENT_METRICS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Metrics;
  } catch {
    return null;
  }
}

/**
 * Store a metrics snapshot (for sparkline history).
 */
export async function pushSnapshot(metrics: Metrics): Promise<void> {
  const r = getRedis();
  const timestamp = Date.now();
  const snapshot: MetricsSnapshot = {
    ...metrics,
    snapshotId: `snap_${timestamp}`,
  };

  await r.zadd(KEYS.SNAPSHOTS, timestamp, JSON.stringify(snapshot));

  // Trim old snapshots
  const count = await r.zcard(KEYS.SNAPSHOTS);
  if (count > MAX_SNAPSHOTS) {
    await r.zremrangebyrank(KEYS.SNAPSHOTS, 0, count - MAX_SNAPSHOTS - 1);
  }
}

/**
 * Get recent snapshots for sparkline data.
 */
export async function getRecentSnapshots(
  count: number = 60,
): Promise<MetricsSnapshot[]> {
  const r = getRedis();
  const raw = await r.zrevrange(KEYS.SNAPSHOTS, 0, count - 1);
  return raw
    .map((s) => {
      try {
        return JSON.parse(s) as MetricsSnapshot;
      } catch {
        return null;
      }
    })
    .filter((s): s is MetricsSnapshot => s !== null)
    .reverse(); // chronological order
}
