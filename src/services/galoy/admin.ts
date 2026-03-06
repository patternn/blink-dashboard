import { GraphQLClient, gql } from "graphql-request";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

// ─── Client setup ────────────────────────────────────────────────

let client: GraphQLClient | null = null;

function getClient(): GraphQLClient {
  if (!client) {
    if (!config.galoy.adminApiUrl) {
      throw new Error("GALOY_ADMIN_API_URL is not configured");
    }
    client = new GraphQLClient(config.galoy.adminApiUrl, {
      headers: {
        Authorization: `Bearer ${config.galoy.adminAuthToken}`,
        "Content-Type": "application/json",
      },
    });
  }
  return client;
}

// ─── Queries ─────────────────────────────────────────────────────

const FILTERED_USER_COUNT = gql`
  query FilteredUserCount($phoneCountryCodesFilter: [CountryCode!]) {
    filteredUserCount(phoneCountryCodesFilter: $phoneCountryCodesFilter)
  }
`;

const ALL_ACCOUNT_LEVELS = gql`
  query AllLevels {
    allLevels
  }
`;

// ─── Service methods ─────────────────────────────────────────────

/**
 * Get total user count via the admin API filteredUserCount query.
 * Pass empty filters to get ALL users.
 */
export async function getTotalUserCount(): Promise<number> {
  try {
    const data = await getClient().request<{ filteredUserCount: number }>(
      FILTERED_USER_COUNT,
      { phoneCountryCodesFilter: [] },
    );
    return data.filteredUserCount;
  } catch (err) {
    logger.error("Failed to fetch total user count from admin API", { error: err });
    throw err;
  }
}

/**
 * Get user count filtered by specific country phone codes.
 * Useful for the "countries active" metric.
 */
export async function getUserCountByCountry(
  countryCodes: string[],
): Promise<number> {
  try {
    const data = await getClient().request<{ filteredUserCount: number }>(
      FILTERED_USER_COUNT,
      { phoneCountryCodesFilter: countryCodes },
    );
    return data.filteredUserCount;
  } catch (err) {
    logger.error("Failed to fetch filtered user count", {
      countryCodes,
      error: err,
    });
    throw err;
  }
}

/**
 * Determine number of active countries by iterating known country codes
 * and checking which have > 0 users.
 *
 * NOTE: This is expensive if done per-code. Prefer the MongoDB approach
 * in services/mongodb.ts for production. This is a fallback.
 */
export async function getActiveCountriesCount(): Promise<number> {
  // Common phone country codes — extend as needed
  const COUNTRY_CODES = [
    "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39",
    "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52",
    "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64",
    "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94",
    "95", "98", "212", "213", "216", "218", "220", "221", "234", "249",
    "251", "254", "255", "256", "260", "261", "263", "351", "352",
    "353", "354", "355", "358", "370", "371", "372", "373", "374",
    "375", "380", "381", "386", "420", "421", "504", "505", "506",
    "507", "509", "591", "592", "593", "595", "597", "598", "599",
    "852", "853", "855", "856", "880", "886", "960", "961", "962",
    "963", "964", "965", "966", "967", "968", "971", "972", "973",
    "974", "975", "976", "977", "992", "993", "994", "995", "996", "998",
  ];

  let activeCount = 0;

  // Batch: check each code (could be parallelized with rate limiting)
  for (const code of COUNTRY_CODES) {
    try {
      const count = await getUserCountByCountry([code]);
      if (count > 0) activeCount++;
    } catch {
      // Skip failed codes
    }
  }

  return activeCount;
}
