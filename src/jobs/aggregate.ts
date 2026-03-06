import { logger } from "../utils/logger.js";
import type { Metrics } from "../types/index.js";
import * as mongodb from "../services/galoy/mongodb.js";
import * as adminApi from "../services/galoy/admin.js";
import * as cache from "../services/cache.js";

// ─── Aggregation strategies ─────────────────────────────────────
// Each metric can be fetched via multiple strategies (MongoDB first,
// Admin API fallback). This makes the system resilient if one source
// is down.

async function fetchWithFallback<T>(
  label: string,
  primary: () => Promise<T>,
  fallback?: () => Promise<T>,
  defaultValue?: T,
): Promise<T> {
  try {
    return await primary();
  } catch (primaryErr) {
    logger.warn(`Primary source for ${label} failed, trying fallback`, {
      error: primaryErr,
    });
    if (fallback) {
      try {
        return await fallback();
      } catch (fallbackErr) {
        logger.error(`Fallback for ${label} also failed`, {
          error: fallbackErr,
        });
      }
    }
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`All sources for ${label} exhausted`);
  }
}

// ─── Main aggregation function ──────────────────────────────────

export async function aggregateMetrics(): Promise<Metrics> {
  const start = Date.now();
  logger.info("Starting metrics aggregation...");

  const [activeUsers, transactions, newUsers, btcCustodySats, countriesActive] =
    await Promise.allSettled([
      // Active Users: MongoDB → Admin API → cached
      fetchWithFallback(
        "activeUsers",
        () => mongodb.getActiveUsers(30),
        () => adminApi.getTotalUserCount(), // fallback: total users
        0,
      ),

      // Transactions: MongoDB → 0
      fetchWithFallback(
        "transactions",
        () => mongodb.getTransactionCount(30),
        undefined,
        0,
      ),

      // New Users: MongoDB → 0
      fetchWithFallback(
        "newUsers",
        () => mongodb.getNewUsers(30),
        undefined,
        0,
      ),

      // BTC Custody: MongoDB → 0
      fetchWithFallback(
        "btcCustody",
        () => mongodb.getTotalBtcBalance(),
        undefined,
        0,
      ),

      // Countries Active: MongoDB → Admin API
      fetchWithFallback(
        "countriesActive",
        () => mongodb.getActiveCountries(),
        () => adminApi.getActiveCountriesCount(),
        0,
      ),
    ]);

  const extractValue = <T>(
    result: PromiseSettledResult<T>,
    fallback: T,
  ): T => (result.status === "fulfilled" ? result.value : fallback);

  const sats = extractValue(btcCustodySats, 0);

  const metrics: Metrics = {
    activeUsers: extractValue(activeUsers, 0),
    transactions: extractValue(transactions, 0),
    newUsers: extractValue(newUsers, 0),
    btcCustody: sats / 1e8, // convert sats → BTC
    countriesActive: extractValue(countriesActive, 0),
    updatedAt: new Date().toISOString(),
  };

  // Persist to cache
  await cache.setCurrentMetrics(metrics);
  await cache.pushSnapshot(metrics);

  const elapsed = Date.now() - start;
  logger.info("Metrics aggregation complete", { elapsed: `${elapsed}ms`, metrics });

  return metrics;
}

// ─── Run standalone ──────────────────────────────────────────────
// `npm run jobs:aggregate` to run once manually

const isMain = process.argv[1]?.endsWith("aggregate.ts") ||
               process.argv[1]?.endsWith("aggregate.js");

if (isMain) {
  (async () => {
    try {
      await cache.connectRedis();
      const metrics = await aggregateMetrics();
      console.log(JSON.stringify(metrics, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
