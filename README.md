# x402 Autonomous Agent (Solana caller)

An autonomous trading intelligence agent that traverses x402 Inc.'s API stack daily,
detecting smart money signals and executing trades via x402 micropayments — settling on Solana mainnet.
Runs daily at 06:00 JST via node-cron on Railway.

自律型トレーディングインテリジェンスエージェント。毎朝6時JSTにx402 Inc.のAPIスタックを横断し、スマートマネーシグナルを検出してx402マイクロペイメント（Solana 決済）でトレードを実行します。Base mainnet 版は別リポジトリで稼働中。

![Node.js](https://img.shields.io/badge/Node.js-20-green) ![Railway](https://img.shields.io/badge/Railway-deployed-blueviolet) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## How It Works / 動作フロー

6ステップのパイプラインが毎朝自動実行されます。シグナルがなければ早期終了（低コスト）。

| Step | API | Cost |
|------|-----|------|
| 1. Smart Money Screener | STRONG BUY シグナルをスキャン | $0.05 |
| 2. Whale Intent Decoder | ウォレット意図を検証（ACCUMULATION / POSITION_BUILDING） | $0.30 |
| 3. Divergence Analyzer | オンチェーン／予測市場の乖離を確認 | $0.15 |
| 4. Alpha Memo Protocol | 毎日のAPACレポートを取得 | $1.00 |
| 5. Japan Market Bot | マクロ環境チェック | auto |
| 6. Copy Terminal | 全条件を満たした場合のみ執行 | $0.10 |

> All payments are handled automatically via the x402 protocol. If no signals are found, the agent exits after Step 1 (~$0.05 total).

---

## x402 Payment Flow (Solana caller)

```
Agent → GET /api/signals
      ← 402 Payment Required  (PAYMENT-REQUIRED header)
Agent → signs USDC transfer with SOLANA_PRIVATE_KEY (Solana mainnet wallet)
      → GET /api/signals  (PAYMENT header attached, scheme=exact, network=solana:5eykt4Us...)
      ← 200 OK + data + PAYMENT-RESPONSE
```

This deployment registers `ExactSvmScheme` on `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` (v2) and `solana` (v1). The Base-mainnet variant lives in a separate repository.

`@x402/fetch` handles the 402 → sign → retry loop automatically — no manual payment logic needed.

---

## Tech Stack

- **Node.js 20 + TypeScript**
- **@x402/fetch + @x402/svm** — automatic HTTP 402 micropayment handling (Solana caller)
- **@solana/kit** — TransactionSigner from base58 secret key
- **node-cron** — `0 21 * * *` (06:00 JST)
- **Railway** — always-on Node.js process

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SOLANA_PRIVATE_KEY` | ✅ | Solana wallet secret key (base58, 64 bytes) — must hold USDC + SOL on Solana mainnet |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key (analyst-daily-note job) |
| `INTERNAL_API_KEY` | optional | Onchain Stock Data internal key (analyst-daily-note job) |
| `PORTFOLIO_ANALYZE_TARGET` | optional | Wallet address fed to Portfolio Intelligence |
| `DISCORD_WEBHOOK_URL` / `SLACK_WEBHOOK_URL` | optional | Run summary webhook |

Copy `.env.example` to `.env` and fill in each value.

---

## Deployment (Railway)

1. Fork this repo
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repo, select the working branch
4. Add environment variables in the **Variables** tab
5. Deploy — `railway.json` handles build and start automatically

The service runs as an always-on process. node-cron fires at 21:00 UTC (06:00 JST) daily. No HTTP port is exposed.

---

## Local Development

```bash
npm install
cp .env.example .env
# Fill in .env values

npm run build       # Compile TypeScript
npm run run-now     # Manual one-shot test run
npm start           # Start cron scheduler
```

---

## APIs Used

| API | URL |
|-----|-----|
| Smart Money Copy Terminal | https://x402smct.vercel.app |
| Whale Intent Decoder | https://x402wid.vercel.app |
| Divergence Analyzer | https://x402nansenpolymarket.vercel.app |
| Alpha Memo Protocol | https://x402amp.vercel.app |

Each endpoint advertises both Base and Solana legs in its 402 challenge.
The Solana caller only registers the `solana` scheme, so the client will always
pick the Solana leg.

---

## Cost Per Run

| Condition | Estimated Cost |
|---|---|
| No signals found (early exit) | ~$0.05 |
| Signals found, intent check only | ~$0.50 |
| Full run with execution | ~$1.60–$2.10 |

This is a verification harness, not a production payment rail. The Solana wallet
needs USDC (for transfers) and a small amount of SOL (for tx fees).

---

## License

MIT
