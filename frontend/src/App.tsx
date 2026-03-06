import { useMemo } from "react";
import { useMetrics } from "./hooks/useMetrics";
import {
  StatCard,
  LivePulse,
  GlobeIndicator,
  SkeletonCard,
} from "./components";
import type { MetricsSnapshot } from "./types";

// ─── Helpers ──────────────────────────────────────────────────

function extractSparkData(
  history: MetricsSnapshot[],
  key: keyof MetricsSnapshot,
): { t: number; v: number }[] {
  return history.map((snap, i) => ({
    t: i,
    v: Number(snap[key]) || 0,
  }));
}

function computeDelta(
  history: MetricsSnapshot[],
  key: keyof MetricsSnapshot,
): number | undefined {
  if (history.length < 2) return undefined;
  const recent = Number(history[history.length - 1][key]) || 0;
  const older = Number(history[0][key]) || 0;
  if (older === 0) return undefined;
  return ((recent - older) / older) * 100;
}

// ─── Dashboard ────────────────────────────────────────────────

export default function App() {
  const { metrics, history, connected, lastUpdate, error } = useMetrics();

  const sparklines = useMemo(
    () => ({
      activeUsers: extractSparkData(history, "activeUsers"),
      transactions: extractSparkData(history, "transactions"),
      newUsers: extractSparkData(history, "newUsers"),
      btcCustody: extractSparkData(history, "btcCustody"),
    }),
    [history],
  );

  const deltas = useMemo(
    () => ({
      activeUsers: computeDelta(history, "activeUsers"),
      transactions: computeDelta(history, "transactions"),
      newUsers: computeDelta(history, "newUsers"),
      btcCustody: computeDelta(history, "btcCustody"),
    }),
    [history],
  );

  const isLoading = !metrics;

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px 24px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      {/* ─── Header ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 40,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 4,
                height: 36,
                background:
                  "linear-gradient(180deg, var(--accent-amber), var(--accent-red))",
                borderRadius: 2,
              }}
            />
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Blink{" "}
              <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
                Numbers
              </span>
            </h1>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginLeft: 16,
            }}
          >
            Real-time Key Metrics
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <LivePulse connected={connected} />
          {lastUpdate && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* ─── Error banner ────────────────────────────────── */}
      {error && (
        <div
          style={{
            padding: "10px 16px",
            marginBottom: 16,
            borderRadius: "var(--radius-sm)",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.15)",
            fontSize: 12,
            color: "var(--accent-red)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {error}
        </div>
      )}

      {/* ─── Primary KPIs ────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Active Users"
              value={metrics.activeUsers}
              color="var(--accent-amber)"
              sparkData={sparklines.activeUsers}
              delta={deltas.activeUsers}
              delay={100}
            />
            <StatCard
              label="Transactions"
              value={metrics.transactions}
              color="var(--accent-amber)"
              sparkData={sparklines.transactions}
              delta={deltas.transactions}
              delay={200}
            />
            <StatCard
              label="New Users"
              value={metrics.newUsers}
              color="var(--accent-amber)"
              sparkData={sparklines.newUsers}
              delta={deltas.newUsers}
              delay={300}
            />
            <StatCard
              label="BTC in Custody"
              value={metrics.btcCustody}
              decimals={2}
              prefix="₿ "
              color="var(--accent-red)"
              sparkData={sparklines.btcCustody}
              delta={deltas.btcCustody}
              delay={400}
            />
          </>
        )}
      </div>

      {/* ─── Secondary KPIs ──────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Circular Economy Wallet"
              rank="#1"
              color="var(--accent-green)"
              delay={500}
            />
            <StatCard
              label="Custodial Lightning Wallet"
              rank="#2"
              color="var(--accent-amber)"
              delay={600}
            />
            <GlobeIndicator count={metrics.countriesActive} />
          </>
        )}
      </div>

      {/* ─── Footer ──────────────────────────────────────── */}
      <div
        style={{
          marginTop: 24,
          padding: "16px 0",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>
          {connected
            ? `Live via WebSocket · refreshing every ${
                import.meta.env.VITE_REFRESH_INTERVAL || "30"
              }s`
            : "Polling via REST · WebSocket reconnecting..."}
        </span>
        <span style={{ fontFamily: "var(--font-mono)" }}>
          Blink Technologies LLC
        </span>
      </div>
    </div>
  );
}
