# Momento Hackathon — Setup Status

Date: 2026-07-13

## Phase 3: Anchor On-Chain Program — COMPLETE

### Program Details
- **Program ID**: `CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja`
- **Network**: Solana devnet
- **Deployed at slot**: 475792804
- **Program data**: `4AHqY22XKWwvRNr4qtMxBBmBpZ1go79tgu865re9ChAQ`
- **Upgrade authority**: `CSrPnu3y3vUeRPpJmsVukXyDZbHKLw7sFyweSubj97ve`

### Instructions
- `open_moment_window(fixture_id, seq, open_ts, close_ts, kind, metadata_uri)` — keeper calls this to create Moment PDA
- `mint_moment()` — anyone calls during open window (increments mint_count, emits MintEvent)
- `void_moment()` — keeper calls to void a moment (VAR cancel etc.)

### Source
- Program: `programs/moment-mint/programs/moment-mint/src/lib.rs`
- IDL: `programs/moment-mint/target/idl/moment_mint.json`
- Keypair: `programs/moment-mint/target/deploy/moment_mint-keypair.json`
- Anchor.toml: cluster=devnet, wallet=../../devnet-keeper.json

### Keeper Integration
- `apps/keeper/src/onchain.ts` — `onChainOpenWindow()` and `onChainVoidMoment()` helpers
- `apps/keeper/src/mintWindow.ts` — calls on-chain after DB create when `MOMENTO_PROGRAM_ID` is set

## Phase 5: Web SSE Push — COMPLETE

### Changes
- `apps/keeper/src/mintWindow.ts` — `broadcastMomentOpened()` posts to `/api/feed` after each moment opens
- `apps/web/src/app/api/moments/[id]/route.ts` — new per-moment GET API with `mints` included
- `apps/web/src/app/moment/[id]/page.tsx` — moment detail page with on-chain explorer link
- `apps/web/src/components/MomentCard.tsx` — added "view details →" link to detail page
- `apps/web/.env.local` — `INTERNAL_SECRET=dev-secret-momento-2026`

### SSE Flow
1. TxLINE emits GOAL/RESULT event → keeper parses
2. Keeper creates DB record + generates PNG + metadata JSON
3. Keeper calls `onChainOpenWindow()` → Solana tx creates Moment PDA
4. Keeper updates DB with `momentPda`
5. Keeper broadcasts `{ type: 'MOMENT_OPENED', moment }` to `/api/feed` with `x-internal-secret`
6. Web SSE clients receive push and render new MomentCard instantly

## Env Vars Set
- `MOMENTO_PROGRAM_ID=CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja`
- `NEXT_PUBLIC_MOMENTO_PROGRAM_ID=CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja`
- `INTERNAL_SECRET=dev-secret-momento-2026`

## How to Run Demo

### Prerequisites
- Wallet `CSrPnu3y3vUeRPpJmsVukXyDZbHKLw7sFyweSubj97ve` needs SOL (currently ~0.07 after deploy)
- Fund via `devnet-pow mine` or faucet.solana.com before calling keeper

### Start web:
```bash
pnpm --filter web dev
```

### Start keeper (requires TxLINE stream):
```bash
KEEPER_WALLET_PATH=./devnet-keeper.json pnpm --filter keeper dev
```

### Run Anchor test (requires local validator):
```bash
cd programs/moment-mint
solana-test-validator &
anchor test --skip-local-validator
```

## Build Notes
- `anchor build` IDL generation fails due to `proc_macro2::Span::source_file()` incompatibility with Solana platform-tools v1.53 rustc. The `.so` binary compiles cleanly.
- IDL was hand-crafted at `programs/moment-mint/target/idl/moment_mint.json` with correct Anchor 0.30.x discriminators.
- Deploy used `solana program deploy` directly (bypasses anchor's IDL upload step).

## Next Steps (Phase 3.4)
- mpl-core CPI in `mint_moment` to actually create an NFT asset on-chain
- Requires ~0.01 SOL per mint for NFT account rent
- Add `mpl-core` crate to Cargo.toml and implement `CreateV1` CPI

## Phases Completed
- [x] Phase 0: devnet wallet, TxLINE subscribe, Prisma DB
- [x] Phase 1: Keeper TxLINE stream parser
- [x] Phase 2: Image generation (PNG cards)
- [x] Phase 3: Anchor program deployed + keeper wired
- [x] Phase 4: DB integration + metadata JSON
- [x] Phase 5: Web SSE push + moment detail page

---

## P0 — Real NFT Minting (2026-07-13)

### Decision: Server-side Metaplex Core minting

**Why not full on-chain CPI?**
Rust program updated with `mpl-core` CPI (`src/lib.rs`). `cargo build-sbf` succeeds (only warnings).
Devnet upgrade failed: new binary is ~325KB vs existing 206KB slot → needs ~2.26 SOL buffer but
keeper wallet had 0.96 SOL and devnet faucet was rate-limited.

**Current flow:**
1. Client calls existing `mint_moment` on-chain (time guard active)
2. `/api/mint` verifies tx called our program + succeeded
3. Server creates real Metaplex Core asset via UMI (`@metaplex-foundation/mpl-core`)
   - `KEEPER_PRIVATE_KEY` env var pays rent; minter is set as owner
4. Real `assetId` stored in `Mint` row

**Pending full on-chain CPI (after SOL top-up):**
```bash
solana airdrop 2 CSrPnu3y3vUeRPpJmsVukXyDZbHKLw7sFyweSubj97ve --url devnet
cd programs/moment-mint && anchor build
solana program deploy target/sbpf-solana-solana/release/moment_mint.so \
  --program-id target/deploy/moment_mint-keypair.json \
  --keypair ../../devnet-keeper.json --url devnet
# Then update MomentCard.tsx accounts and idl/moment_mint.json
```

**Required env var:** `KEEPER_PRIVATE_KEY` = JSON byte array from `devnet-keeper.json`
```bash
vercel env add KEEPER_PRIVATE_KEY  # paste contents of devnet-keeper.json
```

## P1 — Live Event Schema

Schema verified against real devnet data (FixtureId 18222446, July 2026). PascalCase confirmed correct.
Capture script added: `pnpm --filter keeper capture` → `captured-events.jsonl`

## P2 — Metadata/Image Reachability

Images + metadata now stored in Neon DB (`imageData` BYTEA, `metadataJson` TEXT).
Served via `/api/moments/[id]/image` and `/api/moments/[id]/metadata`.
`metadataUrl` = `${PUBLIC_BASE_URL}/api/moments/${id}/metadata` → public, stable, cross-deployment.

**DB migration:**
```bash
DATABASE_URL=<neon_url> npx prisma db push
# or run: prisma/migrations/0002_add_moment_fields/migration.sql
```

## Ancillary

- `onchainStatus` field added to Moment (`null` | `'OK'` | `'FAILED'`) — keeper logs FAILED clearly
- RESULT `|| StatusId===100` guard left as-is (devnet-verified, no observed false positives)
