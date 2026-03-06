import dotenv from "dotenv";
import type { AppConfig } from "../types/index.js";

dotenv.config();

function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

export const config: AppConfig = {
  port: envInt("PORT", 3100),
  nodeEnv: env("NODE_ENV", "development"),

  galoy: {
    adminApiUrl: env("GALOY_ADMIN_API_URL"),
    adminAuthToken: env("GALOY_ADMIN_AUTH_TOKEN"),
    publicApiUrl: env("GALOY_PUBLIC_API_URL", "https://api.blink.sv/graphql"),
    apiKey: env("GALOY_API_KEY"),
  },

  mongodb: {
    uri: env("MONGODB_URI", "mongodb://localhost:27017"),
    dbName: env("MONGODB_DB_NAME", "galoy"),
  },

  redis: {
    url: env("REDIS_URL", "redis://localhost:6379"),
  },

  bria: {
    apiUrl: env("BRIA_API_URL"),
    apiKey: env("BRIA_API_KEY"),
  },

  aggregationIntervalSeconds: envInt("AGGREGATION_INTERVAL_SECONDS", 30),
  corsOrigin: env("CORS_ORIGIN", "http://localhost:5173"),
};

export function validateConfig(): string[] {
  const warnings: string[] = [];

  if (!config.galoy.adminApiUrl) {
    warnings.push("GALOY_ADMIN_API_URL not set — admin queries will fail");
  }
  if (!config.galoy.adminAuthToken) {
    warnings.push("GALOY_ADMIN_AUTH_TOKEN not set — admin queries will fail");
  }
  if (!config.mongodb.uri) {
    warnings.push("MONGODB_URI not set — direct DB aggregation unavailable");
  }

  return warnings;
}
