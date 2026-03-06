import { useState, useEffect, type CSSProperties } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { Sparkline } from "./Sparkline";

interface SparkPoint {
  t: number;
  v: number;
}

interface Props {
  label: string;
  value?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  color: string;
  sparkData?: SparkPoint[];
  delta?: number;
  rank?: string;
  delay?: number;
}

export function StatCard({
  label,
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  color,
  sparkData,
  delta,
  rank,
  delay = 0,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const cardStyle: CSSProperties = {
    background: `linear-gradient(145deg, var(--bg-card) 0%, var(--bg-card-alt) 100%)`,
    borderRadius: "var(--radius-md)",
    padding: "24px 24px 8px",
    position: "relative",
    overflow: "hidden",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
    border: "1px solid var(--border-subtle)",
    minHeight: 168,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  return (
    <div style={cardStyle}>
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 24,
          right: 24,
          height: 2,
          background: `linear-gradient(90deg, ${color}, transparent)`,
          borderRadius: "0 0 2px 2px",
        }}
      />

      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 10,
          }}
        >
          {label}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div
            style={{
              fontSize: rank ? 36 : 42,
              fontWeight: 700,
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {rank ? (
              <span style={{ color }}>{rank}</span>
            ) : value !== undefined ? (
              <AnimatedNumber
                value={value}
                decimals={decimals}
                prefix={prefix}
                suffix={suffix}
              />
            ) : (
              <span style={{ color: "var(--text-muted)" }}>—</span>
            )}
          </div>

          {delta !== undefined && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: delta >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                background:
                  delta >= 0
                    ? "rgba(52, 211, 153, 0.1)"
                    : "rgba(248, 113, 113, 0.1)",
                padding: "3px 8px",
                borderRadius: 6,
                fontFamily: "var(--font-mono)",
              }}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {sparkData && sparkData.length > 1 && (
        <div style={{ marginTop: 14, marginLeft: -8, marginRight: -8 }}>
          <Sparkline data={sparkData} color={color} />
        </div>
      )}
    </div>
  );
}
