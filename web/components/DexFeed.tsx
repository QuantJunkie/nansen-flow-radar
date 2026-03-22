import { DexTrade } from "@/lib/nansen";

interface Props {
  trades: DexTrade[];
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function DexFeed({ trades }: Props) {
  if (trades.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No recent DEX activity.</p>;
  }

  return (
    <div className="divide-y divide-gray-50">
      {trades.map((t, i) => (
        <div key={i} className="flex items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-mono w-16 shrink-0">
              {t.chain === "ethereum" ? "ETH" : "SOL"}
            </span>
            <span className="font-mono font-semibold text-gray-900 text-sm">{t.token}</span>
            {t.label && (
              <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 hidden sm:inline">
                {t.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                t.side === "buy"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {t.side.toUpperCase()}
            </span>
            <span className="font-mono text-xs text-gray-600 tabular-nums">{fmtUsd(t.valueUsd)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
