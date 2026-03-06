import { logger } from "../utils/logger";
import * as bq from "../services/bigquery";
import * as cache from "../services/cache";
import type { DashboardMetrics, MetricWithPeriods } from "../types/index";

// ─── Build a metric with both rolling windows ───────────────

async function buildMetric(
  label: string,
  queryFn: (days: number) => Promise<{ current: number; previous: number; deltaPct: number }>,
  currentOverride?: number,
): Promise<MetricWithPeriods> {
  const [d30, d7] = await Promise.all([
    queryFn(30).catch((err) => {
      logger.warn(`${label} 30d query failed`, { error: err });
      return { current: 0, previous: 0, deltaPct: 0 };
    }),
    queryFn(7).catch((err) => {
      logger.warn(`${label} 7d query failed`, { error: err });
      return { current: 0, previous: 0, deltaPct: 0 };
    }),
  ]);

  return {
    current: currentOverride ?? d30.current,
    d30,
    d7,
  };
}

// ─── Main aggregation ───────────────────────────────────────

export async function aggregateMetrics(): Promise<DashboardMetrics> {
  const start = Date.now();
  logger.info("Starting BigQuery metrics aggregation...");

  // Run all queries in parallel
  const [activeUsers, transactions, newUsers, btcCustody, countriesActive, totalAccounts] =
    await Promise.all([
      buildMetric("activeUsers", bq.getActiveUsers),
      buildMetric("transactions", bq.getTransactions),
      buildMetric("newUsers", bq.getNewUsers),
      buildMetric("btcCustody", bq.getBtcCustody),
      buildMetric("countriesActive", bq.getCountriesActive),
      bq.getTotalAccounts().catch(() => 0),
    ]);

  // Use total accounts as the headline "current" for active users
  // (or keep the 30d active count — depends on how they define it)
  // activeUsers.current = totalAccounts; // uncomment if "active users" = total accounts

  const metrics: DashboardMetrics = {
    activeUsers,
    transactions,
    newUsers,
    btcCustody,
    countriesActive,
    updatedAt: new Date().toISOString(),
  };

  // Cache
  await cache.setCurrentMetrics(metrics);
  await cache.pushHistory(metrics);

  const elapsed = Date.now() - start;
  logger.info("BigQuery aggregation complete", { elapsed: `${elapsed}ms` });

  return metrics;
}

// ─── Run standalone: npm run jobs:aggregate ──────────────────

const isMain = process.argv[1]?.includes("aggregate");

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
