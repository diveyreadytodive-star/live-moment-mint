# Momento Hackathon — Phase 0 Setup Status

Date: 2026-07-13

## Completed Steps

### Step 1: Devnet SOL — BLOCKED
- Wallet: `CSrPnu3y3vUeRPpJmsVukXyDZbHKLw7sFyweSubj97ve`
- Current balance: **0 SOL**
- All airdrop methods hit rate limit from this IP:
  - `faucet.solana.com` API — 429
  - `solana airdrop` CLI — rate limit error
  - `api.devnet.solana.com` RPC direct — 429
  - `devnet-pow` PoW faucet — rate limit error
- **Manual action required**: Fund the wallet with ~2 SOL devnet.
  Options:
  1. Visit https://faucet.solana.com from a browser and paste the wallet address
  2. Wait for rate limit reset (usually 24h) and re-run: `solana airdrop 2 CSrPnu3y3vUeRPpJmsVukXyDZbHKLw7sFyweSubj97ve --url devnet`
  3. Use a Discord faucet (Solana Discord #devnet-faucet channel)

### Step 2: TxLINE IDL — DONE
- Source: https://github.com/txodds/tx-on-chain/blob/main/examples/devnet/idl/txoracle.json
- Saved to: `packages/txline/idl/txoracle-devnet.json` (41,908 bytes)
- Program ID confirmed: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`

### Step 3: pnpm install — DONE
- All 995 packages installed successfully
- Peer dependency warnings are non-blocking (web wallet adapter deps, react-native, etc.)
- Build scripts approved via `pnpm-workspace.yaml` `onlyBuiltDependencies`

### Step 4: .env setup — DONE
- Copied `.env.example` to `.env`
- `DATABASE_URL` set to `file:/Users/blanco/live-moment-mint/momento.db`
- All other devnet defaults are correct
- `TXLINE_API_TOKEN` is empty (requires Step 7 to complete)

### Step 5: Prisma migration — DONE
- `prisma generate` succeeded (Prisma Client v5.22.0)
- `prisma db push` created `momento.db` with Fixture, Moment, Mint tables
- DB path: `/Users/blanco/live-moment-mint/momento.db`

### Step 6: Guest JWT smoke test — DONE
- `POST https://txline-dev.txodds.com/auth/guest/start` returns valid JWT
- Sample token prefix: `eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9...`
- The TxLINE devnet API is reachable and functional

### Step 7: On-chain subscribe + API token — BLOCKED (needs SOL)
- The subscribe script runs and reaches the blockchain call correctly
- Error: `Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.`
- Confirmed: only SOL is needed — no TxL token payment required for free tier (World Cup)
- **Once SOL is funded**: `KEEPER_WALLET_PATH=./devnet-keeper.json pnpm --filter keeper run subscribe`

## Files Added / Modified
- `packages/txline/idl/txoracle-devnet.json` — TxLINE devnet IDL
- `packages/txline/src/eventsource.d.ts` — Type stub for eventsource v2
- `packages/txline/tsconfig.json` — Added eventsource type handling
- `packages/txline/package.json` — @types/eventsource removed (was a stub)
- `pnpm-workspace.yaml` — Added `onlyBuiltDependencies` to allow Prisma builds
- `.npmrc` — Added `ignore-workspace-root-check=true` for Prisma auto-install
- `.env` — Created from `.env.example` with correct devnet defaults
- `scripts/smoke-test.ts` — Standalone guest JWT smoke test
- `momento.db` — SQLite database (schema applied)

## Next Actions (in order)
1. Fund wallet with devnet SOL (manual step)
2. Run: `KEEPER_WALLET_PATH=./devnet-keeper.json pnpm --filter keeper run subscribe`
3. Copy printed `TXLINE_API_TOKEN` to `.env`
4. Proceed with Phase 1: Keeper stream integration

## API Token
**Not yet obtained** — blocked on devnet SOL funding.
