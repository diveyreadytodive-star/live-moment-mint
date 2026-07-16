# Momento — Handoff / Fresh Setup

Instructions for anyone cloning the repo from scratch (judges, teammates).

---

## Requirements

- Node 20+
- pnpm 9+ (`npm i -g pnpm`)
- Docker Desktop (for local Postgres)
- Phantom or Solflare wallet (Solana devnet)

---

## 1. Clone and install

```bash
git clone https://github.com/diveyreadytodive-star/live-moment-mint.git
cd live-moment-mint
pnpm install
```

---

## 2. Start local Postgres

```bash
docker run -d --name momento-pg \
  -e POSTGRES_PASSWORD=momento \
  -e POSTGRES_DB=momento \
  -p 5433:5432 postgres:16
```

On subsequent runs: `docker start momento-pg`

---

## 3. Push DB schema

```bash
DATABASE_URL="postgresql://postgres:momento@localhost:5433/momento" \
  pnpm exec prisma db push

pnpm exec prisma generate
```

---

## 4. Create `.env.local.dev`

```bash
cp .env.example .env.local.dev
```

Fill in the following. All are required for the smoke test:

```
DATABASE_URL=postgresql://postgres:momento@localhost:5433/momento
KEEPER_PRIVATE_KEY=<base58 or JSON array — devnet keypair with SOL>
TXLINE_API_TOKEN=txoracle_api_08b2494a8e484db086d7718872588085
TXLINE_API_ORIGIN=https://api.txodds.com
SOLANA_RPC_URL=https://api.devnet.solana.com
INTERNAL_SECRET=<any random string>
```

> `TXLINE_API_TOKEN` is the public hackathon token provided in the TxODDS docs.

For production (Vercel), a Neon PostgreSQL `DATABASE_URL` is used instead of local Postgres.

---

## 5. Run the smoke test

```bash
pnpm smoke
```

Expected output: `=== ALL CHECKS PASSED ===` with a real devnet NFT asset ID.

---

## 6. Start the UI

```bash
pnpm dev:web
```

Open **http://localhost:3000**

---

## 7. Populate data (replay mode)

In a second terminal:

```bash
REPLAY_MODE=1 pnpm dev:keeper
```

This runs a fake Argentina 2-1 Switzerland match, opening 4 minting windows.
The home page auto-updates via SSE — no refresh needed.

---

## Repo structure

```
live-moment-mint/
├── apps/
│   ├── web/          Next.js 14 (UI + API routes)
│   └── keeper/       TxLINE SSE listener + minting logic
├── packages/
│   ├── shared/       Zod schemas + Prisma client
│   ├── image/        PNG card generation (canvas)
│   └── txline/       TxLINE SSE client + event parser
├── programs/
│   └── moment-mint/  Anchor program (Rust) — deployed to devnet
├── prisma/           Schema (Fixture / Moment / Mint models)
├── scripts/
│   └── smoke.sh      Full E2E test (12 checks)
└── docs/
    ├── demo-script.md     Step-by-step judging walkthrough
    ├── handoff.md         This file
    ├── smoke-run.log      Latest smoke test log
    └── ui-*.png           UI screenshots
```

---

## On-chain program

- **Network**: Solana devnet
- **Program ID**: `CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja`
- **NFT standard**: Metaplex Core (`mpl-core`)

The keeper wallet must have devnet SOL to pay for NFT minting (~0.003 SOL per mint).
Request airdrop: `solana airdrop 2 <PUBKEY> --url devnet`

---

## Secrets summary

| Secret | Where | Sensitive? |
|--------|-------|-----------|
| `KEEPER_PRIVATE_KEY` | `.env.local.dev` only (gitignored) | YES — do not commit |
| `DATABASE_URL` (Neon) | Vercel env vars only | YES |
| `INTERNAL_SECRET` | `.env.local.dev` + Vercel | YES |
| `TXLINE_API_TOKEN` | `.env.local.dev` | No — public hackathon token |
| `SOLANA_RPC_URL` | `.env.local.dev` | No |
