interface Props {
  value: number;
}

function fmt(v: number): string {
  const abs = Math.abs(v);
  const sign = v > 0 ? "+" : "";
  if (abs >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(v / 1_000).toFixed(0)}K`;
  return `${sign}${v.toFixed(0)}`;
}

export function FlowCell({ value }: Props) {
  if (value === 0) return <span className="text-gray-300 font-mono text-xs">—</span>;
  const color = value > 0 ? "text-emerald-600" : "text-red-500";
  return <span className={`font-mono text-xs font-medium tabular-nums ${color}`}>{fmt(value)}</span>;
}
