interface Props {
  score: number;
  side: "buy" | "sell";
}

const buyColors: Record<number, string> = {
  4: "bg-emerald-50 text-emerald-800 border-emerald-200",
  3: "bg-green-50 text-green-700 border-green-200",
  2: "bg-yellow-50 text-yellow-700 border-yellow-200",
  1: "bg-gray-50 text-gray-500 border-gray-200",
};

const sellColors: Record<number, string> = {
  4: "bg-red-50 text-red-800 border-red-200",
  3: "bg-orange-50 text-orange-700 border-orange-200",
  2: "bg-yellow-50 text-yellow-700 border-yellow-200",
  1: "bg-gray-50 text-gray-500 border-gray-200",
};

const labels = ["", "WEAK", "MEDIUM", "HIGH", "EXTREME"];

export function ConvictionBadge({ score, side }: Props) {
  const tier = Math.max(1, Math.min(4, Math.round(score / 3)));
  const colors = side === "buy" ? buyColors : sellColors;
  const colorClass = colors[tier] ?? colors[1];
  const label = labels[tier];
  const filled = tier;
  const empty = 4 - tier;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${colorClass}`}>
      <span className="font-mono tracking-tight">
        {"█".repeat(filled)}
        <span className="opacity-30">{"░".repeat(empty)}</span>
      </span>
      <span>{label}</span>
    </span>
  );
}
