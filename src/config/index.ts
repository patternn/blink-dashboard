import dotenv from "dotenv";
import type { AppConfig } from "../types/index";

dotenv.config();

const env = (key: string, fallback = "") => process.env[key] ?? fallback;
const envInt = (key: string, fallback: number) => {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
};

export const config: AppConfig = {
  port: envInt("PORT", 3100),
  nodeEnv: env("NODE_ENV", "development"),

  bigquery: {
    projectId: env("BIGQUERY_PROJECT_ID"),
    dataset: env("BIGQUERY_DATASET", "galoy_production"),
    credentialsJson: env("BIGQUERY_CREDENTIALS_JSON") || undefined,
    schema: {
      tables: {
        accounts: env("BIGQUERY_TABLE_ACCOUNTS", "accounts"),
        transactions: env("BIGQUERY_TABLE_TRANSACTIONS", "transactions"),
        wallets: env("BIGQUERY_TABLE_WALLETS", "wallets"),
      },
      fields: {
        account: {
          id: env("BIGQUERY_FIELD_ACCOUNT_ID", "id"),
          createdAt: env("BIGQUERY_FIELD_ACCOUNT_CREATED_AT", "created_at"),
          phone: env("BIGQUERY_FIELD_ACCOUNT_PHONE", "phone"),
          status: env("BIGQUERY_FIELD_ACCOUNT_STATUS", "status"),
        },
        transaction: {
          id: env("BIGQUERY_FIELD_TX_ID", "id"),
          accountId: env("BIGQUERY_FIELD_TX_ACCOUNT_ID", "account_id"),
          createdAt: env("BIGQUERY_FIELD_TX_CREATED_AT", "created_at"),
          status: env("BIGQUERY_FIELD_TX_STATUS", "status"),
        },
        wallet: {
          id: env("BIGQUERY_FIELD_WALLET_ID", "id"),
          currency: env("BIGQUERY_FIELD_WALLET_CURRENCY", "currency"),
          balance: env("BIGQUERY_FIELD_WALLET_BALANCE", "balance"),
        },
      },
    },
  },

  redis: {
    url: env("REDIS_URL", "redis://localhost:6379"),
  },

  aggregationIntervalSeconds: envInt("AGGREGATION_INTERVAL_SECONDS", 60),
  corsOrigin: env("CORS_ORIGIN", "http://localhost:5173"),
};

export function validateConfig(): string[] {
  const warnings: string[] = [];
  if (!config.bigquery.projectId) {
    warnings.push("BIGQUERY_PROJECT_ID not set — BigQuery queries will fail");
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !config.bigquery.credentialsJson) {
    warnings.push("No BigQuery credentials found — set GOOGLE_APPLICATION_CREDENTIALS or BIGQUERY_CREDENTIALS_JSON");
  }
  return warnings;
}
