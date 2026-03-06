export function SkeletonCard() {
  return (
    <div
      style={{
        background: `linear-gradient(145deg, var(--bg-card) 0%, var(--bg-card-alt) 100%)`,
        borderRadius: "var(--radius-md)",
        padding: "24px 24px 20px",
        border: "1px solid var(--border-subtle)",
        minHeight: 168,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Label skeleton */}
      <div
        style={{
          width: 90,
          height: 10,
          borderRadius: 4,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      {/* Value skeleton */}
      <div
        style={{
          width: 140,
          height: 36,
          borderRadius: 6,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          animationDelay: "0.2s",
        }}
      />
      {/* Sparkline skeleton */}
      <div
        style={{
          width: "100%",
          height: 44,
          borderRadius: 4,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          animationDelay: "0.4s",
          marginTop: "auto",
        }}
      />
    </div>
  );
}
