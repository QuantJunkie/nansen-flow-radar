const NANSEN_BASE = "https://api.nansen.ai";
const STABLES = new Set(["USDT", "USDC", "DAI", "BUSD", "TUSD", "FRAX", "USDP", "GUSD"]);

export interface TokenRow {
  token: string;
  score: number;
  crossChain: boolean;
  totalFlow: number;
  ethFund: number;
  solFund: number;
  ethTrd: number;
  solTrd: number;
  eth7d: number;
  sol7d: number;
  eth30d: number;
  sol30d: number;
}

export interface DexTrade {
  chain: string;
  token: string;
  side: "buy" | "sell";
  valueUsd: number;
  label: string;
}

export interface SignalsResponse {
  convergence: TokenRow[];
  divergence: TokenRow[];
  dexTrades: DexTrade[];
  callCount: number;
  timestamp: string;
}

async function nansenPost(path: string, body: object): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${NANSEN_BASE}${path}`, {
    method: "POST",
    headers: { "apiKey": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });

  if (res.status === 200) return res.json();
  console.warn(`Nansen ${res.status} for ${path}`);
  return null;
}

function netflow(chains: string[], labels: string[], sortField: string) {
  return nansenPost("/api/v1/smart-money/netflow", {
    chains,
    filters: { include_smart_money_labels: labels, include_stablecoins: false, include_native_tokens: true },
    pagination: { page: 1, per_page: 25 },
    order_by: [{ field: sortField, direction: "DESC" }],
  });
}

function holdings(chains: string[], labels: string[]) {
  return nansenPost("/api/v1/smart-money/holdings", {
    chains,
    filters: { include_smart_money_labels: labels, include_stablecoins: false },
    pagination: { page: 1, per_page: 20 },
    order_by: [{ field: "value_usd", direction: "DESC" }],
  });
}

function dexTrades(chains: string[], labels: string[]) {
  return nansenPost("/api/v1/smart-money/dex-trades", {
    chains,
    filters: { include_smart_money_labels: labels },
    pagination: { page: 1, per_page: 12 },
  });
}

function extractFlows(data: Record<string, unknown> | null, field = "net_flow_24h_usd"): Map<string, number> {
  const m = new Map<string, number>();
  if (!data || !Array.isArray(data.data)) return m;
  for (const row of data.data as Record<string, unknown>[]) {
    const sym = String(row.token_symbol ?? row.symbol ?? "").toUpperCase().trim();
    if (!sym || STABLES.has(sym)) continue;
    const v = Number(row[field] ?? row.net_flow_24h_usd ?? row.value_usd ?? 0);
    m.set(sym, (m.get(sym) ?? 0) + v);
  }
  return m;
}

function extractDexTrades(data: Record<string, unknown> | null, chain: string): DexTrade[] {
  if (!data || !Array.isArray(data.data)) return [];
  return (data.data as Record<string, unknown>[]).slice(0, 7).map((r) => {
    const boughtSym = String(r.token_bought_symbol ?? "").toUpperCase();
    const soldSym = String(r.token_sold_symbol ?? "").toUpperCase();
    const token = STABLES.has(boughtSym) ? soldSym : boughtSym || soldSym || "?";
    const side: "buy" | "sell" = STABLES.has(soldSym) || (!STABLES.has(boughtSym) && boughtSym) ? "buy" : "sell";
    return {
      chain,
      token,
      side,
      valueUsd: Number(r.trade_value_usd ?? r.value_usd ?? 0),
      label: String(r.trader_address_label ?? r.smart_money_label ?? r.label ?? ""),
    };
  });
}

export async function fetchSignals(): Promise<SignalsResponse> {
  let callCount = 0;
  const call = async (fn: () => Promise<Record<string, unknown> | null>) => {
    callCount++;
    return fn();
  };

  const [
    ethFund24h, solFund24h, ethTrd24h, solTrd24h,
    ethFund7d, solFund7d, ethTrd7d, solTrd7d,
    ethFund30d, solFund30d, ethTrd30d, solTrd30d,
    ethHold, solHold, ethDex, solDex,
  ] = await Promise.all([
    call(() => netflow(["ethereum"], ["Fund"],         "net_flow_24h_usd")),
    call(() => netflow(["solana"],   ["Fund"],         "net_flow_24h_usd")),
    call(() => netflow(["ethereum"], ["Smart Trader"], "net_flow_24h_usd")),
    call(() => netflow(["solana"],   ["Smart Trader"], "net_flow_24h_usd")),
    call(() => netflow(["ethereum"], ["Fund"],         "net_flow_7d_usd")),
    call(() => netflow(["solana"],   ["Fund"],         "net_flow_7d_usd")),
    call(() => netflow(["ethereum"], ["Smart Trader"], "net_flow_7d_usd")),
    call(() => netflow(["solana"],   ["Smart Trader"], "net_flow_7d_usd")),
    call(() => netflow(["ethereum"], ["Fund"],         "net_flow_30d_usd")),
    call(() => netflow(["solana"],   ["Fund"],         "net_flow_30d_usd")),
    call(() => netflow(["ethereum"], ["Smart Trader"], "net_flow_30d_usd")),
    call(() => netflow(["solana"],   ["Smart Trader"], "net_flow_30d_usd")),
    call(() => holdings(["ethereum"], ["Fund"])),
    call(() => holdings(["solana"],   ["Fund"])),
    call(() => dexTrades(["ethereum"], ["Fund", "Smart Trader"])),
    call(() => dexTrades(["solana"],   ["Fund", "Smart Trader"])),
  ]);

  const f = {
    ethFund24h:  extractFlows(ethFund24h),
    solFund24h:  extractFlows(solFund24h),
    ethTrd24h:   extractFlows(ethTrd24h),
    solTrd24h:   extractFlows(solTrd24h),
    ethFund7d:   extractFlows(ethFund7d,  "net_flow_7d_usd"),
    solFund7d:   extractFlows(solFund7d,  "net_flow_7d_usd"),
    ethTrd7d:    extractFlows(ethTrd7d,   "net_flow_7d_usd"),
    solTrd7d:    extractFlows(solTrd7d,   "net_flow_7d_usd"),
    ethFund30d:  extractFlows(ethFund30d, "net_flow_30d_usd"),
    solFund30d:  extractFlows(solFund30d, "net_flow_30d_usd"),
    ethTrd30d:   extractFlows(ethTrd30d,  "net_flow_30d_usd"),
    solTrd30d:   extractFlows(solTrd30d,  "net_flow_30d_usd"),
    ethHold:     extractFlows(ethHold,    "value_usd"),
    solHold:     extractFlows(solHold,    "value_usd"),
  };

  const allTokens = new Set<string>();
  Object.values(f).forEach((m) => m.forEach((_, k) => allTokens.add(k)));

  const convergence: TokenRow[] = [];
  const divergence: TokenRow[] = [];

  for (const tok of allTokens) {
    const g = (m: Map<string, number>) => m.get(tok) ?? 0;
    const v = {
      ef24: g(f.ethFund24h), sf24: g(f.solFund24h),
      et24: g(f.ethTrd24h),  st24: g(f.solTrd24h),
      ef7:  g(f.ethFund7d),  sf7:  g(f.solFund7d),
      et7:  g(f.ethTrd7d),   st7:  g(f.solTrd7d),
      ef30: g(f.ethFund30d), sf30: g(f.solFund30d),
      et30: g(f.ethTrd30d),  st30: g(f.solTrd30d),
      eh:   g(f.ethHold),    sh:   g(f.solHold),
    };

    const cScore = [v.ef24>0, v.sf24>0, v.et24>0, v.st24>0,
                    v.ef7>0,  v.sf7>0,  v.et7>0,  v.st7>0,
                    v.ef30>0, v.sf30>0,
                    v.eh>0,   v.sh>0].filter(Boolean).length;

    const dScore = [v.ef24<0, v.sf24<0, v.et24<0, v.st24<0,
                    v.ef7<0,  v.sf7<0,  v.et7<0,  v.st7<0,
                    v.ef30<0, v.sf30<0,
                    v.eh>0,   v.sh>0].filter(Boolean).length;

    const base: Omit<TokenRow, "score" | "crossChain" | "totalFlow"> = {
      token: tok,
      ethFund: v.ef24, solFund: v.sf24,
      ethTrd: v.et24,  solTrd: v.st24,
      eth7d: v.ef7,    sol7d: v.sf7,
      eth30d: v.ef30,  sol30d: v.sf30,
    };

    if (cScore > 0) {
      const totalFlow = [v.ef24, v.sf24, v.et24, v.st24].filter(x => x > 0).reduce((a, b) => a + b, 0);
      convergence.push({ ...base, score: cScore, crossChain: v.ef24 > 0 && v.sf24 > 0, totalFlow });
    }
    if (dScore > 0) {
      const totalFlow = [v.ef24, v.sf24, v.et24, v.st24].filter(x => x < 0).reduce((a, b) => a + b, 0);
      divergence.push({ ...base, score: dScore, crossChain: v.ef24 < 0 && v.sf24 < 0, totalFlow });
    }
  }

  convergence.sort((a, b) => b.score - a.score || b.totalFlow - a.totalFlow);
  divergence.sort((a, b) => b.score - a.score || a.totalFlow - b.totalFlow);

  const dexTradesArr: DexTrade[] = [
    ...extractDexTrades(ethDex, "ethereum"),
    ...extractDexTrades(solDex, "solana"),
  ];

  return {
    convergence: convergence.slice(0, 15),
    divergence: divergence.slice(0, 15),
    dexTrades: dexTradesArr,
    callCount,
    timestamp: new Date().toISOString(),
  };
}
