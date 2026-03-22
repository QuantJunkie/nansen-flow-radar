import { TokenRow } from "@/lib/nansen";
import { ConvictionBadge } from "./ConvictionBadge";
import { FlowCell } from "./FlowCell";

interface Props {
  rows: TokenRow[];
  side: "buy" | "sell";
}

const headers = [
  "Token", "Score", "Conviction", "Cross-chain",
  "ETH Fund 24h", "SOL Fund 24h", "ETH Trd 24h", "SOL Trd 24h",
  "ETH 7d", "SOL 7d", "ETH 30d", "SOL 30d",
];

export function SignalTable({ rows, side }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center">No signals detected.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            {headers.map((h) => (
              <th
                key={h}
                className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide pb-3 pr-4 whitespace-nowrap first:pl-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.token}
              className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${
                i === 0 ? "border-b border-gray-100" : ""
              }`}
            >
              <td className="py-3 pr-4 first:pl-0">
                <span className="font-mono font-semibold text-gray-900 text-sm">{row.token}</span>
              </td>
              <td className="py-3 pr-4">
                <span className="font-mono text-xs text-gray-500 tabular-nums">{row.score}/12</span>
              </td>
              <td className="py-3 pr-4">
                <ConvictionBadge score={row.score} side={side} />
              </td>
              <td className="py-3 pr-4 text-center">
                {row.crossChain ? (
                  <span className="text-xs font-medium text-sky-600 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5">
                    ✓ BOTH
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </td>
              <td className="py-3 pr-4"><FlowCell value={row.ethFund} /></td>
              <td className="py-3 pr-4"><FlowCell value={row.solFund} /></td>
              <td className="py-3 pr-4"><FlowCell value={row.ethTrd} /></td>
              <td className="py-3 pr-4"><FlowCell value={row.solTrd} /></td>
              <td className="py-3 pr-4"><FlowCell value={row.eth7d} /></td>
              <td className="py-3 pr-4"><FlowCell value={row.sol7d} /></td>
              <td className="py-3 pr-4"><FlowCell value={row.eth30d} /></td>
              <td className="py-3 pr-4"><FlowCell value={row.sol30d} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
