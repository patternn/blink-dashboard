import { useAnimatedNumber } from "../hooks/useAnimatedNumber";

interface Props {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

function format(n: number, decimals: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1200,
}: Props) {
  const display = useAnimatedNumber(value, duration);

  return (
    <span>
      {prefix}
      {format(display, decimals)}
      {suffix}
    </span>
  );
}
