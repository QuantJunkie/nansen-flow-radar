# Institutional Convergence & Divergence Radar

> Detects when institutional funds and smart traders simultaneously accumulate or distribute the same tokens across both Ethereum and Solana.

**Live dashboard → [nansen-flow-radar.vercel.app](https://nansen-flow-radar.vercel.app)**

---

## What it does

Monitors Nansen smart money flows in real time and surfaces tokens where **funds and smart traders agree** — both buying or both selling — across ETH and Solana simultaneously.

Each token gets a **conviction score (0–12)**:

| Points | Signal |
|---|---|
| ×4 | 24h fund + trader flows on ETH & SOL |
| ×4 | 7-day sustained flows on ETH & SOL |
| ×2 | 30-day macro flows on ETH & SOL |
| ×2 | Current holdings on ETH & SOL |

**Cross-chain flag** — triggered when the same token is accumulating (or distributing) on both chains simultaneously. Strongest signal of coordinated institutional activity.

---

## Stack

- **Next.js 16** + **React 19** + **Tailwind CSS 4** — web dashboard
- **Python** (`rich`, `requests`) — CLI version (`radar.py`)
- **Nansen API** — smart money data (Fund + Smart Trader labels, ETH & SOL)

---

## How it works

16 parallel Nansen API calls per refresh cycle:

| Category | Calls |
|---|---|
| 24h net flows (Fund + Trader, ETH + SOL) | 4 |
| 7-day net flows | 4 |
| 30-day net flows | 4 |
| Current holdings | 2 |
| Live DEX trades | 2 |

Tokens are scored, filtered, and sorted by conviction. Top 15 convergence and divergence signals are returned.

---

## Setup

### Web dashboard

```bash
cd web
cp .env.local.example .env.local   # add your NANSEN_API_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### CLI

```bash
pip install requests rich python-dotenv
echo "NANSEN_API_KEY=your_key" > .env
python radar.py
python radar.py --refresh 60   # auto-refresh every 60s
```

### Environment variable

```
NANSEN_API_KEY=your_nansen_api_key
```

Get a key at [nansen.ai](https://nansen.ai) or use pay-per-call via [x402](https://docs.nansen.ai/getting-started/x402-payments) ($0.05/call for Smart Money endpoints, no subscription needed).

---

## Deploy to Vercel

```bash
cd web
vercel --prod
vercel env add NANSEN_API_KEY production
vercel --prod   # redeploy to pick up the env var
```

---

Built with [Nansen API](https://nansen.ai) · `#NansenCLI`
