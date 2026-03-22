#!/usr/bin/env python3
"""
Institutional Convergence & Divergence Radar
=============================================
Two complementary signals, one dashboard:

  CONVERGENCE (Buy-side)  — when Funds + Smart Traders accumulate the same
                            tokens across BOTH Ethereum and Solana simultaneously.

  DIVERGENCE  (Sell-side) — when Funds + Smart Traders are DUMPING the same
                            tokens across BOTH chains simultaneously.

The more categories agree, the higher the conviction score (0-8).

Requires: NANSEN_API_KEY env var or .env file
Install:  pip install rich requests python-dotenv
Run:      python3 radar.py [--refresh N]
"""

import os
import sys
import json
import time
import argparse
from datetime import datetime
from typing import Optional, Dict, List, Any

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich import box
    from rich.align import Align
    from rich.rule import Rule
    from rich.columns import Columns
except ImportError:
    print("Missing dependency: pip install rich requests python-dotenv")
    sys.exit(1)

console = Console()
NANSEN_API_BASE = "https://api.nansen.ai"
STABLES = {"USDT", "USDC", "DAI", "BUSD", "TUSD", "FRAX", "USDP", "GUSD", "?", ""}


# ── Nansen Client ─────────────────────────────────────────────────────────────

class NansenClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({"apiKey": api_key, "Content-Type": "application/json"})
        self.call_count = 0

    def post(self, path: str, body: dict) -> Optional[dict]:
        url = f"{NANSEN_API_BASE}{path}"
        try:
            resp = self.session.post(url, json=body, timeout=25)
            self.call_count += 1
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 401:
                console.print("[bold red]Error:[/] Invalid API key. Set NANSEN_API_KEY in .env")
                sys.exit(1)
            elif resp.status_code == 402:
                console.print(f"[yellow]Warning:[/] Insufficient credits for {path}")
                return None
            else:
                console.print(f"[yellow]API {resp.status_code}[/] {path}: {resp.text[:120]}")
                return None
        except requests.exceptions.Timeout:
            console.print(f"[yellow]Timeout[/] on {path}")
            return None
        except Exception as e:
            console.print(f"[red]Request error:[/] {e}")
            return None

    def netflow(self, chains: List[str], labels: List[str],
                sort_field: str = "net_flow_24h_usd", per_page: int = 25) -> Optional[dict]:
        return self.post("/api/v1/smart-money/netflow", {
            "chains": chains,
            "filters": {
                "include_smart_money_labels": labels,
                "include_stablecoins": False,
                "include_native_tokens": True,
            },
            "pagination": {"page": 1, "per_page": per_page},
            "order_by": [{"field": sort_field, "direction": "DESC"}],
        })

    def holdings(self, chains: List[str], labels: List[str], per_page: int = 20) -> Optional[dict]:
        return self.post("/api/v1/smart-money/holdings", {
            "chains": chains,
            "filters": {"include_smart_money_labels": labels, "include_stablecoins": False},
            "pagination": {"page": 1, "per_page": per_page},
            "order_by": [{"field": "value_usd", "direction": "DESC"}],
        })

    def dex_trades(self, chains: List[str], labels: List[str], per_page: int = 15) -> Optional[dict]:
        return self.post("/api/v1/smart-money/dex-trades", {
            "chains": chains,
            "filters": {"include_smart_money_labels": labels, "include_stablecoins": False},
            "pagination": {"page": 1, "per_page": per_page},
        })


# ── Data Fetching ─────────────────────────────────────────────────────────────

def fetch_signals(client: NansenClient) -> Dict[str, Any]:
    """Make 16 targeted API calls covering buy-side AND sell-side signals across 24h / 7d / 30d."""

    calls = [
        # ── 24h flows (buy & sell both decoded from same responses) ───
        ("eth_fund_24h",    lambda: client.netflow(["ethereum"], ["Fund"],         "net_flow_24h_usd")),
        ("sol_fund_24h",    lambda: client.netflow(["solana"],   ["Fund"],         "net_flow_24h_usd")),
        ("eth_trader_24h",  lambda: client.netflow(["ethereum"], ["Smart Trader"], "net_flow_24h_usd")),
        ("sol_trader_24h",  lambda: client.netflow(["solana"],   ["Smart Trader"], "net_flow_24h_usd")),
        # ── 7-day sustained flows ──────────────────────────────────────
        ("eth_fund_7d",     lambda: client.netflow(["ethereum"], ["Fund"],         "net_flow_7d_usd")),
        ("sol_fund_7d",     lambda: client.netflow(["solana"],   ["Fund"],         "net_flow_7d_usd")),
        ("eth_trader_7d",   lambda: client.netflow(["ethereum"], ["Smart Trader"], "net_flow_7d_usd")),
        ("sol_trader_7d",   lambda: client.netflow(["solana"],   ["Smart Trader"], "net_flow_7d_usd")),
        # ── 30-day macro flows ─────────────────────────────────────────
        ("eth_fund_30d",    lambda: client.netflow(["ethereum"], ["Fund"],         "net_flow_30d_usd")),
        ("sol_fund_30d",    lambda: client.netflow(["solana"],   ["Fund"],         "net_flow_30d_usd")),
        ("eth_trader_30d",  lambda: client.netflow(["ethereum"], ["Smart Trader"], "net_flow_30d_usd")),
        ("sol_trader_30d",  lambda: client.netflow(["solana"],   ["Smart Trader"], "net_flow_30d_usd")),
        # ── Holdings (long-term position sizing) ──────────────────────
        ("eth_holdings",    lambda: client.holdings(["ethereum"], ["Fund"])),
        ("sol_holdings",    lambda: client.holdings(["solana"],   ["Fund"])),
        # ── DEX trades (live order flow) ──────────────────────────────
        ("eth_dex",         lambda: client.dex_trades(["ethereum"], ["Fund", "Smart Trader"])),
        ("sol_dex",         lambda: client.dex_trades(["solana"],   ["Fund", "Smart Trader"])),
    ]

    results: Dict[str, Any] = {}
    with Progress(SpinnerColumn(), TextColumn("[cyan]{task.description}"), transient=True, console=console) as prog:
        for name, fn in calls:
            t = prog.add_task(f"Fetching {name.replace('_', ' ')} …")
            results[name] = fn()
            prog.remove_task(t)

    return results


# ── Analysis ──────────────────────────────────────────────────────────────────

def token_flows(data: Optional[dict], field: str = "net_flow_24h_usd") -> Dict[str, float]:
    """Extract {symbol: flow_value} from a netflow or holdings response."""
    if not data or "data" not in data:
        return {}
    out: Dict[str, float] = {}
    for row in data["data"]:
        sym = (row.get("token_symbol") or row.get("symbol") or "").upper().strip()
        if not sym or sym in STABLES:
            continue
        v = float(row.get(field) or row.get("net_flow_24h_usd") or row.get("value_usd") or 0)
        out[sym] = out.get(sym, 0) + v
    return out


def score_tokens(signals: Dict[str, Any]) -> tuple:
    """
    Returns (convergence_list, divergence_list).

    Score 0–12: +1 per signal tier firing per side:
      Tier 1 — 24h: ETH Fund, SOL Fund, ETH Trader, SOL Trader
      Tier 2 —  7d: ETH Fund, SOL Fund, ETH Trader, SOL Trader
      Tier 3 — 30d: ETH Fund, SOL Fund
      Tier 4 — Holdings: ETH, SOL (still in position)

    Convergence = all signals > 0 (accumulating)
    Divergence  = all signals < 0 (distributing) + holdings > 0 (inventory still there)
    """
    f = {
        "eth_fund_24h":  token_flows(signals.get("eth_fund_24h")),
        "sol_fund_24h":  token_flows(signals.get("sol_fund_24h")),
        "eth_trd_24h":   token_flows(signals.get("eth_trader_24h")),
        "sol_trd_24h":   token_flows(signals.get("sol_trader_24h")),
        "eth_fund_7d":   token_flows(signals.get("eth_fund_7d"),   "net_flow_7d_usd"),
        "sol_fund_7d":   token_flows(signals.get("sol_fund_7d"),   "net_flow_7d_usd"),
        "eth_trd_7d":    token_flows(signals.get("eth_trader_7d"), "net_flow_7d_usd"),
        "sol_trd_7d":    token_flows(signals.get("sol_trader_7d"), "net_flow_7d_usd"),
        "eth_fund_30d":  token_flows(signals.get("eth_fund_30d"),   "net_flow_30d_usd"),
        "sol_fund_30d":  token_flows(signals.get("sol_fund_30d"),   "net_flow_30d_usd"),
        "eth_trd_30d":   token_flows(signals.get("eth_trader_30d"), "net_flow_30d_usd"),
        "sol_trd_30d":   token_flows(signals.get("sol_trader_30d"), "net_flow_30d_usd"),
        "eth_hold":      token_flows(signals.get("eth_holdings"), "value_usd"),
        "sol_hold":      token_flows(signals.get("sol_holdings"), "value_usd"),
    }

    all_tokens = set()
    for d in f.values():
        all_tokens.update(d.keys())

    convergence, divergence = [], []

    for tok in all_tokens:
        vals = {k: f[k].get(tok, 0) for k in f}

        # ── Convergence (buy) — max score 12 ──
        c_score = (
            # 24h tier
            int(vals["eth_fund_24h"] > 0) +
            int(vals["sol_fund_24h"] > 0) +
            int(vals["eth_trd_24h"]  > 0) +
            int(vals["sol_trd_24h"]  > 0) +
            # 7d tier
            int(vals["eth_fund_7d"]  > 0) +
            int(vals["sol_fund_7d"]  > 0) +
            int(vals["eth_trd_7d"]   > 0) +
            int(vals["sol_trd_7d"]   > 0) +
            # 30d macro tier
            int(vals["eth_fund_30d"] > 0) +
            int(vals["sol_fund_30d"] > 0) +
            # Holdings tier
            int(vals["eth_hold"]     > 0) +
            int(vals["sol_hold"]     > 0)
        )
        cross_chain_buy = vals["eth_fund_24h"] > 0 and vals["sol_fund_24h"] > 0
        total_buy = sum(v for v in [vals["eth_fund_24h"], vals["sol_fund_24h"],
                                     vals["eth_trd_24h"], vals["sol_trd_24h"]] if v > 0)

        # ── Divergence (sell) — max score 12 ──
        d_score = (
            # 24h tier
            int(vals["eth_fund_24h"] < 0) +
            int(vals["sol_fund_24h"] < 0) +
            int(vals["eth_trd_24h"]  < 0) +
            int(vals["sol_trd_24h"]  < 0) +
            # 7d tier
            int(vals["eth_fund_7d"]  < 0) +
            int(vals["sol_fund_7d"]  < 0) +
            int(vals["eth_trd_7d"]   < 0) +
            int(vals["sol_trd_7d"]   < 0) +
            # 30d macro tier
            int(vals["eth_fund_30d"] < 0) +
            int(vals["sol_fund_30d"] < 0) +
            # Holdings still present = inventory to sell
            int(vals["eth_hold"]     > 0) +
            int(vals["sol_hold"]     > 0)
        )
        cross_chain_sell = vals["eth_fund_24h"] < 0 and vals["sol_fund_24h"] < 0
        total_sell = sum(v for v in [vals["eth_fund_24h"], vals["sol_fund_24h"],
                                      vals["eth_trd_24h"], vals["sol_trd_24h"]] if v < 0)

        if c_score > 0:
            convergence.append({
                "token": tok, "score": c_score,
                "cross_chain": cross_chain_buy,
                "total_flow": total_buy,
                "eth_fund": vals["eth_fund_24h"],
                "sol_fund": vals["sol_fund_24h"],
                "eth_trd":  vals["eth_trd_24h"],
                "sol_trd":  vals["sol_trd_24h"],
                "eth_7d":   vals["eth_fund_7d"],
                "sol_7d":   vals["sol_fund_7d"],
                "eth_30d":  vals["eth_fund_30d"],
                "sol_30d":  vals["sol_fund_30d"],
            })

        if d_score > 0:
            divergence.append({
                "token": tok, "score": d_score,
                "cross_chain": cross_chain_sell,
                "total_flow": total_sell,
                "eth_fund": vals["eth_fund_24h"],
                "sol_fund": vals["sol_fund_24h"],
                "eth_trd":  vals["eth_trd_24h"],
                "sol_trd":  vals["sol_trd_24h"],
                "eth_7d":   vals["eth_fund_7d"],
                "sol_7d":   vals["sol_fund_7d"],
                "eth_30d":  vals["eth_fund_30d"],
                "sol_30d":  vals["sol_fund_30d"],
            })

    convergence.sort(key=lambda x: (x["score"], x["total_flow"]), reverse=True)
    divergence.sort(key=lambda x: (x["score"], -x["total_flow"]))  # biggest outflow first

    return convergence, divergence


# ── Formatting ────────────────────────────────────────────────────────────────

def fmt(v: float, zero_dash: bool = True) -> str:
    if v == 0:
        return "[dim]—[/]" if zero_dash else "0"
    sign = "+" if v > 0 else ""
    color = "green" if v > 0 else "red"
    av = abs(v)
    if av >= 1_000_000:
        return f"[{color}]{sign}{v/1_000_000:.1f}M[/]"
    if av >= 1_000:
        return f"[{color}]{sign}{v/1_000:.0f}K[/]"
    return f"[{color}]{sign}{v:.0f}[/]"


def _style(score: int, high: str, mid: str) -> str:
    if score >= 10: return f"bold {high}"
    if score >= 7:  return f"bold {high}"
    if score >= 5:  return f"bold {mid}"
    if score >= 3:  return "yellow"
    return "dim"

def _bar(score: int) -> str:
    # 4-block bar, max 12
    filled = max(1, round(score / 3))  # 1–4 blocks
    empty  = 4 - filled
    labels = {4: "EXTREME", 3: "HIGH", 2: "MEDIUM", 1: "WEAK"}
    return "█" * filled + "░" * empty + " " + labels.get(filled, "")

def conv_style(score: int) -> str: return _style(score, "magenta", "green")
def div_style(score: int)  -> str: return _style(score, "red", "orange1")


def make_signal_table(rows: List[Dict], title: str, side: str, top_n: int = 12) -> Table:
    """side = 'buy' or 'sell'"""
    style_fn = conv_style if side == "buy" else div_style
    border   = "green"   if side == "buy" else "red"

    t = Table(title=title, box=box.ROUNDED, border_style=border,
              header_style="bold white", pad_edge=True, row_styles=["", "dim"])
    t.add_column("Token",      style="bold white", min_width=7)
    t.add_column("Score",      justify="center",   min_width=5)
    t.add_column("Conviction", min_width=14)
    t.add_column("X-Chain",    justify="center",   min_width=7)
    t.add_column("ETH Fund 24h",   justify="right", min_width=11)
    t.add_column("SOL Fund 24h",   justify="right", min_width=11)
    t.add_column("ETH Trd 24h",    justify="right", min_width=11)
    t.add_column("SOL Trd 24h",    justify="right", min_width=11)
    t.add_column("ETH 7d",         justify="right", min_width=9)
    t.add_column("SOL 7d",         justify="right", min_width=9)
    t.add_column("ETH 30d",        justify="right", min_width=9)
    t.add_column("SOL 30d",        justify="right", min_width=9)

    for r in rows[:top_n]:
        s  = r["score"]
        sc = style_fn(s)
        bl = _bar(s)
        xc = "[bold cyan]✓ BOTH[/]" if r["cross_chain"] else "[dim]single[/]"
        t.add_row(
            f"[{sc}]{r['token']}[/]",
            f"[{sc}]{s}/12[/]",
            f"[{sc}]{bl}[/]",
            xc,
            fmt(r["eth_fund"]),
            fmt(r["sol_fund"]),
            fmt(r["eth_trd"]),
            fmt(r["sol_trd"]),
            fmt(r["eth_7d"]),
            fmt(r["sol_7d"]),
            fmt(r["eth_30d"]),
            fmt(r["sol_30d"]),
        )
    return t


def make_dex_table(signals: Dict[str, Any]) -> Table:
    t = Table(title="[bold yellow]Live Smart Money DEX Trades[/]",
              box=box.ROUNDED, border_style="yellow", header_style="bold white")
    t.add_column("Chain",  style="cyan",        min_width=9)
    t.add_column("Token",  style="bold white",  min_width=8)
    t.add_column("Side",   justify="center",    min_width=6)
    t.add_column("Value",  justify="right",     min_width=10)
    t.add_column("Label",  style="dim",         min_width=12)

    def _add(data: Optional[dict], chain: str):
        if not data or "data" not in data:
            return
        for row in data["data"][:7]:
            side_raw = str(row.get("side") or row.get("trade_type") or "")
            side = "[bold green]BUY [/]" if "buy" in side_raw.lower() else "[bold red]SELL[/]"
            sym  = (row.get("token_symbol") or row.get("symbol") or "?").upper()
            val  = float(row.get("value_usd") or row.get("amount_usd") or 0)
            lbl  = str(row.get("smart_money_label") or row.get("label") or "")
            t.add_row(chain, sym, side, fmt(val, zero_dash=False), lbl)

    _add(signals.get("eth_dex"), "ethereum")
    _add(signals.get("sol_dex"), "solana")
    return t


# ── Dashboard ─────────────────────────────────────────────────────────────────

def render(signals: Dict[str, Any], call_count: int, top_n: int) -> None:
    convergence, divergence = score_tokens(signals)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    console.clear()

    # ─ Header ─
    console.print(Panel(
        Align.center(Text.from_markup(
            f"[bold cyan]Institutional Convergence & Divergence Radar[/]  ·  "
            f"[dim]{ts}[/]  ·  [yellow]{call_count} API calls[/]  ·  "
            f"[dim]ETH + SOL Smart Money Intelligence[/]"
        )),
        box=box.DOUBLE_EDGE, border_style="cyan",
    ))
    console.print()

    # ─ Legend ─
    legend = (
        "[bold cyan]CONVERGENCE[/] [dim](accumulation):[/]  "
        "[bold magenta]████ EXTREME[/]  [bold green]███░ HIGH[/]  [yellow]██░░ MEDIUM[/]  [dim]█░░░ WEAK[/]\n"
        "[bold red]DIVERGENCE [/] [dim](distribution):[/]  "
        "[bold red]████ EXTREME[/]  [bold orange1]███░ HIGH[/]  [yellow]██░░ MEDIUM[/]  [dim]█░░░ WEAK[/]\n"
        "[dim]Score /12: 24h (×4) + 7d (×4) + 30d (×2) + Holdings (×2) · [/]"
        "[bold cyan]✓ BOTH[/] [dim]= ETH + SOL funds agree[/]"
    )
    console.print(Panel(legend, box=box.SIMPLE, padding=(0, 2)))
    console.print()

    # ─ Convergence table ─
    if convergence:
        console.print(make_signal_table(
            convergence,
            "[bold green]▲ ACCUMULATION[/] — Smart Money Buying (Funds + Traders, ETH + SOL)",
            "buy", top_n,
        ))
        top_buy = [r for r in convergence if r["score"] >= 7 and r["cross_chain"]]
        if top_buy:
            names = "  ".join(f"[bold green]{r['token']}[/]" for r in top_buy[:5])
            console.print(Panel(
                f"High-conviction longs: {names}\n"
                "[dim]Funds AND smart traders buying on BOTH chains across 24h/7d/30d — maximum signal overlap.[/]",
                border_style="green", padding=(0, 2),
            ))
    else:
        console.print(Panel("[dim]No accumulation signals found.[/]", border_style="dim"))

    console.print()

    # ─ Divergence table ─
    if divergence:
        console.print(make_signal_table(
            divergence,
            "[bold red]▼ DISTRIBUTION[/] — Smart Money Selling (Funds + Traders, ETH + SOL)",
            "sell", top_n,
        ))
        top_sell = [r for r in divergence if r["score"] >= 7 and r["cross_chain"]]
        if top_sell:
            names = "  ".join(f"[bold red]{r['token']}[/]" for r in top_sell[:5])
            console.print(Panel(
                f"High-conviction exits: {names}\n"
                "[dim]Funds AND smart traders distributing on BOTH chains across 24h/7d/30d — potential downside.[/]",
                border_style="red", padding=(0, 2),
            ))
    else:
        console.print(Panel("[dim]No distribution signals found.[/]", border_style="dim"))

    console.print()

    # ─ DEX activity ─
    dex = make_dex_table(signals)
    if dex.row_count:
        console.print(dex)
        console.print()

    console.print(Rule("[dim]Powered by Nansen API · #NansenCLI[/]"))


# ── Entry Point ───────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Institutional Convergence & Divergence Radar")
    ap.add_argument("--refresh", type=int, default=0,
                    help="Auto-refresh interval in seconds (0 = run once)")
    ap.add_argument("--top", type=int, default=12,
                    help="Max rows per signal table (default: 12)")
    args = ap.parse_args()

    api_key = os.environ.get("NANSEN_API_KEY", "").strip()
    if not api_key:
        console.print(Panel(
            "[bold red]NANSEN_API_KEY not set.[/]\n\n"
            "  [cyan]export NANSEN_API_KEY=your_key_here[/]\n"
            "  — or — add it to a [cyan].env[/] file in this directory.\n\n"
            "Get a free key at [cyan]https://agents.nansen.ai[/]",
            title="Setup", border_style="red",
        ))
        sys.exit(1)

    client = NansenClient(api_key)

    console.print(Panel(
        "[bold cyan]Institutional Convergence & Divergence Radar[/]\n"
        "[dim]Making 14 Nansen API calls across ETH + SOL…[/]",
        border_style="cyan",
    ))

    while True:
        signals = fetch_signals(client)
        render(signals, client.call_count, args.top)

        if args.refresh <= 0:
            break

        console.print(f"\n[dim]Refreshing in {args.refresh}s… Ctrl+C to quit.[/]")
        try:
            time.sleep(args.refresh)
        except KeyboardInterrupt:
            console.print("\n[dim]Bye.[/]")
            break


if __name__ == "__main__":
    main()
