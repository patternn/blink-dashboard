import { MongoClient, type Db } from "mongodb";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

// ─── Connection ──────────────────────────────────────────────────

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;

  try {
    client = new MongoClient(config.mongodb.uri, {
      // Read-only intent — we never write
      readPreference: "secondaryPreferred",
    });
    await client.connect();
    db = client.db(config.mongodb.dbName);
    logger.info("Connected to MongoDB", { db: config.mongodb.dbName });
    return db;
  } catch (err) {
    logger.error("MongoDB connection failed", { error: err });
    throw err;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

// ─── Aggregate queries ──────────────────────────────────────────

/**
 * Total number of accounts (all-time registered users).
 * Collection name may vary — common Galoy names: "accounts", "users"
 */
export async function getTotalAccounts(): Promise<number> {
  const database = await connectMongo();
  // Try both common collection names
  for (const col of ["accounts", "users"]) {
    try {
      const count = await database.collection(col).countDocuments({});
      if (count > 0) {
        logger.debug(`Total accounts from ${col}: ${count}`);
        return count;
      }
    } catch {
      continue;
    }
  }
  return 0;
}

/**
 * Users created in the last N days — "New Users" metric.
 */
export async function getNewUsers(days: number = 30): Promise<number> {
  const database = await connectMongo();
  const since = new Date();
  since.setDate(since.getDate() - days);

  for (const col of ["accounts", "users"]) {
    try {
      const count = await database.collection(col).countDocuments({
        createdAt: { $gte: since },
      });
      return count;
    } catch {
      continue;
    }
  }
  return 0;
}

/**
 * Active users: accounts that have at least one transaction in the last N days.
 * Depends on the transaction/ledger collection structure in Galoy's MongoDB.
 *
 * Common collection names: "medici_transactions", "transactions"
 */
export async function getActiveUsers(days: number = 30): Promise<number> {
  const database = await connectMongo();
  const since = new Date();
  since.setDate(since.getDate() - days);

  for (const col of ["medici_transactions", "transactions"]) {
    try {
      const result = await database
        .collection(col)
        .aggregate([
          { $match: { datetime: { $gte: since } } },
          { $group: { _id: "$account_path" } },
          { $count: "activeUsers" },
        ])
        .toArray();

      if (result.length > 0) {
        return result[0].activeUsers;
      }
    } catch {
      continue;
    }
  }
  return 0;
}

/**
 * Total transaction count in the last N days.
 */
export async function getTransactionCount(days: number = 30): Promise<number> {
  const database = await connectMongo();
  const since = new Date();
  since.setDate(since.getDate() - days);

  for (const col of ["medici_transactions", "transactions"]) {
    try {
      const count = await database.collection(col).countDocuments({
        datetime: { $gte: since },
      });
      if (count > 0) return count;
    } catch {
      continue;
    }
  }
  return 0;
}

/**
 * Sum of all BTC wallet balances across the platform (in satoshis).
 */
export async function getTotalBtcBalance(): Promise<number> {
  const database = await connectMongo();

  try {
    // Galoy typically stores wallets inside the accounts collection
    // or in a separate "wallets" collection
    const result = await database
      .collection("wallets")
      .aggregate([
        { $match: { currency: "BTC" } },
        { $group: { _id: null, totalSats: { $sum: "$balance" } } },
      ])
      .toArray();

    if (result.length > 0) {
      return result[0].totalSats;
    }
  } catch {
    // Fallback: try accounts collection with embedded wallets
    try {
      const result = await database
        .collection("accounts")
        .aggregate([
          { $unwind: "$wallets" },
          { $match: { "wallets.currency": "BTC" } },
          { $group: { _id: null, totalSats: { $sum: "$wallets.balance" } } },
        ])
        .toArray();

      if (result.length > 0) {
        return result[0].totalSats;
      }
    } catch {
      // both failed
    }
  }
  return 0;
}

/**
 * Count distinct countries from user phone numbers.
 * Phone numbers in Galoy typically include the country code.
 */
export async function getActiveCountries(): Promise<number> {
  const database = await connectMongo();

  for (const col of ["users", "accounts"]) {
    try {
      const result = await database
        .collection(col)
        .aggregate([
          { $match: { phone: { $exists: true, $ne: null } } },
          {
            $addFields: {
              // Extract country code (first 1-3 digits after '+')
              countryCode: {
                $arrayElemAt: [
                  {
                    $regexFindAll: {
                      input: "$phone",
                      regex: /^\+(\d{1,3})/,
                    },
                  },
                  0,
                ],
              },
            },
          },
          { $match: { countryCode: { $ne: null } } },
          {
            $group: { _id: "$countryCode.captures" },
          },
          { $count: "countries" },
        ])
        .toArray();

      if (result.length > 0) {
        return result[0].countries;
      }
    } catch {
      continue;
    }
  }
  return 0;
}
