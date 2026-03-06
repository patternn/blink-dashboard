import type { CSSProperties } from "react";

interface Props {
  connected: boolean;
}

export function LivePulse({ connected }: Props) {
  const dotColor = connected ? "var(--accent-green)" : "var(--accent-red)";

  const dotStyle: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: dotColor,
    animation: connected ? "pulse 2s ease-in-out infinite" : "none",
  };

  const ringStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: dotColor,
    animation: connected ? "pulseRing 2s ease-in-out infinite" : "none",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 8, height: 8 }}>
        <div style={dotStyle} />
        {connected && <div style={ringStyle} />}
      </div>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          fontWeight: 600,
          fontFamily: "var(--font-mono)",
        }}
      >
        {connected ? "Live" : "Polling"}
      </span>
    </div>
  );
}
