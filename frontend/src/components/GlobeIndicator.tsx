import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  count: number;
}

export function GlobeIndicator({ count }: Props) {
  return (
    <div
      style={{
        background: `linear-gradient(145deg, var(--bg-card) 0%, var(--bg-card-alt) 100%)`,
        borderRadius: "var(--radius-md)",
        padding: 24,
        border: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 168,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Concentric rings */}
      {[70, 110, 150].map((size, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: "50%",
            border: `1px solid rgba(245, 158, 11, ${0.12 - i * 0.03})`,
            animation: `pulseRing ${3 + i}s ease-in-out infinite`,
          }}
        />
      ))}

      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: "var(--accent-amber)",
          fontFamily: "var(--font-mono)",
          position: "relative",
          zIndex: 1,
          lineHeight: 1,
        }}
      >
        <AnimatedNumber value={count} />
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 600,
          marginTop: 8,
          position: "relative",
          zIndex: 1,
        }}
      >
        Countries Active
      </div>
    </div>
  );
}
