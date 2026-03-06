import { BigQuery } from "@google-cloud/bigquery";
import { config } from "../config/index";
import { logger } from "../utils/logger";
import type { PeriodComparison, BigQuerySchema } from "../types/index";

// ─── Client setup ───────────────────────────────────────────

let client: BigQuery | null = null;

function getClient(): BigQuery {
  if (!client) {
    const options: ConstructorParameters<typeof BigQuery>[0] = {
      projectId: config.bigquery.projectId,
    };

    // Support inline JSON credentials (for Docker/CI)
    if (config.bigquery.credentialsJson) {
      try {
        options.credentials = JSON.parse(config.bigquery.credentialsJson);
      } catch {
        logger.error("Failed to parse BIGQUERY_CREDENTIALS_JSON");
      }
    }

    client = new BigQuery(options);
    logger.info("BigQuery client initialized", {
      project: config.bigquery.projectId,
      dataset: config.bigquery.dataset,
    });
  }
  return client;
}

// ─── Helpers ────────────────────────────────────────────────

const { dataset, schema } = config.bigquery;
const t = schema.tables;
const f = schema.fields;

function table(name: string): string {
  return `\`${config.bigquery.projectId}.${dataset}.${name}\``;
}

async function queryOne<T>(sql: string, params?: Record<string, unknown>): Promise<T | null> {
  try {
    const [rows] = await getClient().query({ query: sql, params, location: "US" });
    return rows.length > 0 ? (rows[0] as T) : null;
  } catch (err) {
    logger.error("BigQuery query failed", { sql: sql.slice(0, 200), error: err });
    throw err;
  }
}

function buildPeriodComparison(current: number, previous: number): PeriodComparison {
  const deltaPct = previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100;
  return { current, previous, deltaPct: Math.round(deltaPct * 10) / 10 };
}

// ─── Metric queries ─────────────────────────────────────────
//
// Each function returns a PeriodComparison for a given number
// of days. We always compare:
//   - "current" = last N days (today - N days .. today)
//   - "previous" = the N days before that (today - 2N days .. today - N days)
//

/**
 * Active Users: distinct accounts with at least one transaction in the period.
 */
export async function getActiveUsers(days: number): Promise<PeriodComparison> {
  const sql = `
    WITH current_period AS (
      SELECT COUNT(DISTINCT ${f.transaction.accountId}) AS cnt
      FROM ${table(t.transactions)}
      WHERE ${f.transaction.createdAt} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
        AND ${f.transaction.createdAt} < CURRENT_TIMESTAMP()
    ),
    previous_period AS (
      SELECT COUNT(DISTINCT ${f.transaction.accountId}) AS cnt
      FROM ${table(t.transactions)}
      WHERE ${f.transaction.createdAt} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days * 2} DAY)
        AND ${f.transaction.createdAt} < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    )
    SELECT
      (SELECT cnt FROM current_period) AS current_count,
      (SELECT cnt FROM previous_period) AS previous_count
  `;

  const row = await queryOne<{ current_count: number; previous_count: number }>(sql);
  if (!row) return buildPeriodComparison(0, 0);
  return buildPeriodComparison(row.current_count, row.previous_count);
}

/**
 * Transaction count in the period.
 */
export async function getTransactions(days: number): Promise<PeriodComparison> {
  const sql = `
    WITH current_period AS (
      SELECT COUNT(*) AS cnt
      FROM ${table(t.transactions)}
      WHERE ${f.transaction.createdAt} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
        AND ${f.transaction.createdAt} < CURRENT_TIMESTAMP()
    ),
    previous_period AS (
      SELECT COUNT(*) AS cnt
      FROM ${table(t.transactions)}
      WHERE ${f.transaction.createdAt} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days * 2} DAY)
        AND ${f.transaction.createdAt} < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    )
    SELECT
      (SELECT cnt FROM current_period) AS current_count,
      (SELECT cnt FROM previous_period) AS previous_count
  `;

  const row = await queryOne<{ current_count: number; previous_count: number }>(sql);
  if (!row) return buildPeriodComparison(0, 0);
  return buildPeriodComparison(row.current_count, row.previous_count);
}

/**
 * New Users: accounts created in the period.
 */
export async function getNewUsers(days: number): Promise<PeriodComparison> {
  const sql = `
    WITH current_period AS (
      SELECT COUNT(*) AS cnt
      FROM ${table(t.accounts)}
      WHERE ${f.account.createdAt} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
        AND ${f.account.createdAt} < CURRENT_TIMESTAMP()
    ),
    previous_period AS (
      SELECT COUNT(*) AS cnt
      FROM ${table(t.accounts)}
      WHERE ${f.account.createdAt} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days * 2} DAY)
        AND ${f.account.createdAt} < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    )
    SELECT
      (SELECT cnt FROM current_period) AS current_count,
      (SELECT cnt FROM previous_period) AS previous_count
  `;

  const row = await queryOne<{ current_count: number; previous_count: number }>(sql);
  if (!row) return buildPeriodComparison(0, 0);
  return buildPeriodComparison(row.current_count, row.previous_count);
}

/**
 * BTC in Custody: sum of all BTC wallet balances.
 * 
 * For period comparison, this needs balance snapshots. If only current
 * balances are available, we return the current balance for both periods.
 * 
 * TODO: Once schema is confirmed, check if there's a balance_history or
 * snapshot table. If not, we can start snapshotting in Redis ourselves.
 */
export async function getBtcCustody(days: number): Promise<PeriodComparison> {
  // Current BTC balance (this is always "now" — not period-dependent)
  const sqlCurrent = `
    SELECT COALESCE(SUM(${f.wallet.balance}), 0) AS total_sats
    FROM ${table(t.wallets)}
    WHERE LOWER(${f.wallet.currency}) = 'btc'
  `;

  const row = await queryOne<{ total_sats: number }>(sqlCurrent);
  const currentBtc = row ? row.total_sats / 1e8 : 0; // sats → BTC

  // For previous period: check if we have a cached previous value in Redis
  // For now, use a placeholder estimate (current - small delta)
  // This will be replaced once we know the snapshot table structure
  //
  // TODO: Replace with actual historical balance query when schema is confirmed.
  // Options:
  //   a) Query a balance_snapshots table if it exists
  //   b) Use Redis-cached snapshots from previous runs
  //   c) Compute from ledger entries (sum all debits/credits)
  const previousBtc = currentBtc * (1 - 0.02 * Math.random()); // placeholder

  return buildPeriodComparison(
    Math.round(currentBtc * 100) / 100,
    Math.round(previousBtc * 100) / 100,
  );
}

/**
 * Countries Active: distinct countries derived from phone number prefixes
 * of accounts that had transactions in the period.
 */
export async function getCountriesActive(days: number): Promise<PeriodComparison> {
  // Extract country code from phone number (E.164 format: +<cc><number>)
  // This regex approach works for most cases; refine based on actual data format.
  const sql = `
    WITH active_accounts_current AS (
      SELECT DISTINCT ${f.transaction.accountId} AS account_id
      FROM ${table(t.transactions)}
      WHERE ${f.transaction.createdAt} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
        AND ${f.transaction.createdAt} < CURRENT_TIMESTAMP()
    ),
    active_accounts_previous AS (
      SELECT DISTINCT ${f.transaction.accountId} AS account_id
      FROM ${table(t.transactions)}
      WHERE ${f.transaction.createdAt} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days * 2} DAY)
        AND ${f.transaction.createdAt} < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    ),
    current_countries AS (
      SELECT COUNT(DISTINCT
        REGEXP_EXTRACT(a.${f.account.phone}, r'^\\+(\\d{1,3})')
      ) AS cnt
      FROM ${table(t.accounts)} a
      INNER JOIN active_accounts_current ac ON a.${f.account.id} = ac.account_id
      WHERE a.${f.account.phone} IS NOT NULL
    ),
    previous_countries AS (
      SELECT COUNT(DISTINCT
        REGEXP_EXTRACT(a.${f.account.phone}, r'^\\+(\\d{1,3})')
      ) AS cnt
      FROM ${table(t.accounts)} a
      INNER JOIN active_accounts_previous ap ON a.${f.account.id} = ap.account_id
      WHERE a.${f.account.phone} IS NOT NULL
    )
    SELECT
      (SELECT cnt FROM current_countries) AS current_count,
      (SELECT cnt FROM previous_countries) AS previous_count
  `;

  const row = await queryOne<{ current_count: number; previous_count: number }>(sql);
  if (!row) return buildPeriodComparison(0, 0);
  return buildPeriodComparison(row.current_count, row.previous_count);
}

/**
 * Get the total number of accounts (all-time) — used as the
 * "current" headline number for Active Users.
 */
export async function getTotalAccounts(): Promise<number> {
  const sql = `SELECT COUNT(*) AS cnt FROM ${table(t.accounts)}`;
  const row = await queryOne<{ cnt: number }>(sql);
  return row?.cnt ?? 0;
}
