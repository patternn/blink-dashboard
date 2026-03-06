import { z } from "zod";

// ─── Dashboard Metrics ───────────────────────────────────────────

export const MetricsSchema = z.object({
  activeUsers: z.number().int().nonnegative(),
  transactions: z.number().int().nonnegative(),
  newUsers: z.number().int().nonnegative(),
  btcCustody: z.number().nonnegative(),
  countriesActive: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export type Metrics = z.infer<typeof MetricsSchema>;

// ─── Historical snapshot for sparklines ──────────────────────────

export const MetricsSnapshotSchema = MetricsSchema.extend({
  snapshotId: z.string(),
});

export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;

// ─── Galoy Admin API types ───────────────────────────────────────

export interface GaloyAccount {
  id: string;
  createdAt: number; // unix timestamp
  level: string;
  status: "ACTIVE" | "LOCKED" | "CLOSED";
  username: string | null;
  owner: {
    id: string;
    phone: string | null;
    createdAt: number;
  };
  wallets: GaloyWallet[];
}

export interface GaloyWallet {
  id: string;
  walletCurrency: "BTC" | "USD";
  balance: number; // satoshis for BTC, cents for USD
}

export interface GaloyTransaction {
  id: string;
  createdAt: number;
  direction: "SEND" | "RECEIVE";
  settlementAmount: number;
  settlementCurrency: string;
  status: "SUCCESS" | "FAILURE" | "PENDING";
}

// ─── WebSocket events ────────────────────────────────────────────

export type WsEventType = "metrics:update" | "metrics:snapshot" | "error";

export interface WsEvent<T = unknown> {
  type: WsEventType;
  data: T;
  timestamp: string;
}

// ─── Config ──────────────────────────────────────────────────────

export interface AppConfig {
  port: number;
  nodeEnv: string;
  galoy: {
    adminApiUrl: string;
    adminAuthToken: string;
    publicApiUrl: string;
    apiKey: string;
  };
  mongodb: {
    uri: string;
    dbName: string;
  };
  redis: {
    url: string;
  };
  bria: {
    apiUrl: string;
    apiKey: string;
  };
  aggregationIntervalSeconds: number;
  corsOrigin: string;
}
