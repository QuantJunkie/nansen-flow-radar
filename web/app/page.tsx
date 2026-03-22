"use client";

import { useEffect, useState, useCallback } from "react";
import { SignalTable } from "@/components/SignalTable";
import { DexFeed } from "@/components/DexFeed";
import type { SignalsResponse } from "@/lib/nansen";

const REFRESH_MS = 5 * 60 * 1000;

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [activeTab, setActiveTab] = useState<"accumulation" | "distribution">("accumulation");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signals");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to fetch signals");
      }
      const json: SignalsResponse = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setCountdown(REFRESH_MS / 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { load(); return REFRESH_MS / 1000; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [load]);

  const topBuys = data?.convergence.filter((r) => r.score >= 7 && r.crossChain) ?? [];
  const topSells = data?.divergence.filter((r) => r.score >= 7 && r.crossChain) ?? [];

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-gray-900 text-white px-2 py-1 rounded">RADAR</span>
            <span className="text-sm font-medium text-gray-900">Institutional Flow Radar</span>
          </div>
          <div className="flex items-center gap-4">
            {data && (
              <span className="text-xs text-gray-400 font-mono">{data.callCount} API calls</span>
            )}
            <a
              href="https://agents.nansen.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Powered by Nansen
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-12">
          <div className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-4">
            Smart Money Intelligence · ETH + SOL
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-gray-900 tracking-tight leading-tight mb-4">
            Institutional Convergence<br />
            <span className="text-gray-400">&amp;</span> Divergence Radar
          </h1>
          <p className="text-lg text-gray-500 max-w-xl leading-relaxed">
            Detects when institutional funds and smart traders simultaneously{" "}
            <span className="text-emerald-600 font-medium">accumulate</span> or{" "}
            <span className="text-red-500 font-medium">distribute</span> the same tokens
            across both Ethereum and Solana.
          </p>

          {/* Meta row */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-400">
            {lastUpdated && (
              <span className="font-mono">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {!loading && (
              <span className="font-mono">
                Refreshing in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        </div>

        {/* Score legend */}
        <div className="mb-10 flex flex-wrap gap-3 items-center text-xs text-gray-500">
          <span className="font-medium text-gray-700">Score (0–12):</span>
          <span className="font-mono">24h ×4</span>
          <span className="text-gray-300">+</span>
          <span className="font-mono">7d ×4</span>
          <span className="text-gray-300">+</span>
          <span className="font-mono">30d ×2</span>
          <span className="text-gray-300">+</span>
          <span className="font-mono">Holdings ×2</span>
          <span className="mx-2 text-gray-200">|</span>
          <span className="bg-sky-50 text-sky-600 border border-sky-100 rounded-full px-2 py-0.5 font-medium">✓ BOTH</span>
          <span>= ETH &amp; SOL funds agree</span>
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm">
            <strong>Error:</strong> {error}
            {error.includes("NANSEN_API_KEY") && (
              <p className="mt-1 text-xs text-red-500">
                Set <code className="font-mono">NANSEN_API_KEY</code> in your Vercel environment variables or{" "}
                <a href="https://agents.nansen.ai" className="underline">get a key here</a>.
              </p>
            )}
          </div>
        )}

        {/* Top picks callout */}
        {(topBuys.length > 0 || topSells.length > 0) && !loading && (
          <div className="mb-10 grid sm:grid-cols-2 gap-4">
            {topBuys.length > 0 && (
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
                <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-2">
                  High-conviction longs
                </div>
                <div className="flex flex-wrap gap-2">
                  {topBuys.slice(0, 5).map((r) => (
                    <span
                      key={r.token}
                      className="font-mono text-sm font-semibold text-emerald-800 bg-white border border-emerald-200 rounded-lg px-2.5 py-1"
                    >
                      {r.token}
                      <span className="ml-1.5 font-normal text-emerald-500 text-xs">{r.score}/12</span>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-emerald-600/70">
                  Funds + traders accumulating on both ETH &amp; SOL across all timeframes.
                </p>
              </div>
            )}
            {topSells.length > 0 && (
              <div className="p-4 rounded-xl border border-red-100 bg-red-50/50">
                <div className="text-xs font-medium text-red-700 uppercase tracking-wide mb-2">
                  High-conviction exits
                </div>
                <div className="flex flex-wrap gap-2">
                  {topSells.slice(0, 5).map((r) => (
                    <span
                      key={r.token}
                      className="font-mono text-sm font-semibold text-red-800 bg-white border border-red-200 rounded-lg px-2.5 py-1"
                    >
                      {r.token}
                      <span className="ml-1.5 font-normal text-red-400 text-xs">{r.score}/12</span>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-red-600/70">
                  Funds + traders distributing on both ETH &amp; SOL across all timeframes.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-100 flex gap-1">
            <button
              onClick={() => setActiveTab("accumulation")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "accumulation"
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              ▲ Accumulation
              {data && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                  {data.convergence.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("distribution")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "distribution"
                  ? "border-red-500 text-red-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              ▼ Distribution
              {data && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                  {data.divergence.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tables */}
        {loading ? (
          <Spinner />
        ) : data ? (
          <div className="mb-16">
            {activeTab === "accumulation" ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h2 className="text-sm font-medium text-gray-700">
                    Smart Money Buying — Funds &amp; Traders, ETH &amp; SOL
                  </h2>
                </div>
                <SignalTable rows={data.convergence} side="buy" />
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <h2 className="text-sm font-medium text-gray-700">
                    Smart Money Selling — Funds &amp; Traders, ETH &amp; SOL
                  </h2>
                </div>
                <SignalTable rows={data.divergence} side="sell" />
              </div>
            )}
          </div>
        ) : null}

        {/* DEX feed */}
        {data && data.dexTrades.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-sm font-medium text-gray-700">Live Smart Money DEX Activity</h2>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <DexFeed trades={data.dexTrades} />
            </div>
          </div>
        )}

        {/* Methodology */}
        <div className="border-t border-gray-100 pt-10 mb-16">
          <h3 className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-6">Methodology</h3>
          <div className="grid sm:grid-cols-3 gap-8 text-sm text-gray-500">
            <div>
              <div className="font-medium text-gray-800 mb-2">Multi-timeframe</div>
              <p>
                Flows analyzed across 24h, 7-day, and 30-day windows. Short-term trades must align
                with medium and long-term trends for maximum conviction.
              </p>
            </div>
            <div>
              <div className="font-medium text-gray-800 mb-2">Cross-chain signal</div>
              <p>
                The strongest signals occur when the same token is accumulating or distributing on
                both Ethereum and Solana simultaneously — institutional activity is coordinated.
              </p>
            </div>
            <div>
              <div className="font-medium text-gray-800 mb-2">Label diversity</div>
              <p>
                Nansen's Fund label (institutional) and Smart Trader label (top performers) are
                tracked independently. Agreement between both label types raises conviction.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-gray-900">
              Institutional Convergence &amp; Divergence Radar
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Built with{" "}
              <a
                href="https://agents.nansen.ai"
                className="hover:text-gray-600 transition-colors underline"
              >
                Nansen API
              </a>{" "}
              · <span className="font-mono">#NansenCLI</span>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Data refreshes every 5 minutes. Not financial advice.
          </div>
        </div>
      </footer>
    </main>
  );
}
