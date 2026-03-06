import Redis from "ioredis";
import { config } from "../config/index";
import { logger } from "../utils/logger";
import type { DashboardMetrics } from "../types/index";

const KEYS = {
  CURRENT: "blink:metrics:current",
  HISTORY: "blink:metrics:history",
} as const;

const MAX_HISTORY = 1440; // ~24h at 1 per minute

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

export async function setCurrentMetrics(metrics: DashboardMetrics): Promise<void> {
  await getRedis().set(KEYS.CURRENT, JSON.stringify(metrics));
}

export async function getCurrentMetrics(): Promise<DashboardMetrics | null> {
  const raw = await getRedis().get(KEYS.CURRENT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DashboardMetrics;
  } catch {
    return null;
  }
}

export async function pushHistory(metrics: DashboardMetrics): Promise<void> {
  const r = getRedis();
  const ts = Date.now();
  await r.zadd(KEYS.HISTORY, ts, JSON.stringify(metrics));
  const count = await r.zcard(KEYS.HISTORY);
  if (count > MAX_HISTORY) {
    await r.zremrangebyrank(KEYS.HISTORY, 0, count - MAX_HISTORY - 1);
  }
}

export async function getHistory(count: number = 60): Promise<DashboardMetrics[]> {
  const raw = await getRedis().zrevrange(KEYS.HISTORY, 0, count - 1);
  return raw
    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter((s): s is DashboardMetrics => s !== null)
    .reverse();
}
