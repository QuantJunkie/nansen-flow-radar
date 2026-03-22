interface Props {
  value: number;
  href?: string;
}

function fmt(v: number): string {
  const abs = Math.abs(v);
  const sign = v > 0 ? "+" : "";
  if (abs >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(v / 1_000).toFixed(0)}K`;
  return `${sign}${v.toFixed(0)}`;
}

export function FlowCell({ value, href }: Props) {
  if (value === 0) return <span className="text-gray-300 font-mono text-xs">—</span>;
  const color = value > 0 ? "text-emerald-600" : "text-red-500";
  const text = <span className={`font-mono text-xs font-medium tabular-nums ${color}`}>{fmt(value)}</span>;
  if (!href) return text;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`font-mono text-xs font-medium tabular-nums underline decoration-dotted underline-offset-2 ${color} hover:opacity-70 transition-opacity`}>
      {fmt(value)}
    </a>
  );
}
