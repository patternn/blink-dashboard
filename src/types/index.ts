import { z } from "zod";

// ─── Period comparison: current vs previous ─────────────────

export const PeriodComparisonSchema = z.object({
  current: z.number(),
  previous: z.number(),
  deltaPct: z.number(),
});

export type PeriodComparison = z.infer<typeof PeriodComparisonSchema>;

// ─── Single metric with both rolling windows ────────────────

export const MetricWithPeriodsSchema = z.object({
  current: z.number(),
  d30: PeriodComparisonSchema,
  d7: PeriodComparisonSchema,
});

export type MetricWithPeriods = z.infer<typeof MetricWithPeriodsSchema>;

// ─── Full dashboard metrics ─────────────────────────────────

export const DashboardMetricsSchema = z.object({
  activeUsers: MetricWithPeriodsSchema,
  transactions: MetricWithPeriodsSchema,
  newUsers: MetricWithPeriodsSchema,
  btcCustody: MetricWithPeriodsSchema,
  countriesActive: MetricWithPeriodsSchema,
  updatedAt: z.string().datetime(),
});

export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;

// ─── WebSocket events ───────────────────────────────────────

export type WsEventType = "metrics:update" | "error";

export interface WsEvent<T = unknown> {
  type: WsEventType;
  data: T;
  timestamp: string;
}

// ─── BigQuery schema mapping ────────────────────────────────

export interface BigQuerySchema {
  tables: {
    accounts: string;
    transactions: string;
    wallets: string;
  };
  fields: {
    account: {
      id: string;
      createdAt: string;
      phone: string;
      status: string;
    };
    transaction: {
      id: string;
      accountId: string;
      createdAt: string;
      status: string;
    };
    wallet: {
      id: string;
      currency: string;
      balance: string;
    };
  };
}

// ─── Config ─────────────────────────────────────────────────

export interface AppConfig {
  port: number;
  nodeEnv: string;
  bigquery: {
    projectId: string;
    dataset: string;
    credentialsJson?: string;
    schema: BigQuerySchema;
  };
  redis: {
    url: string;
  };
  aggregationIntervalSeconds: number;
  corsOrigin: string;
}
