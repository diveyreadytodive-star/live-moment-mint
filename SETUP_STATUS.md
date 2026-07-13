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

## Local Dev Setup (2026-07-13)

### Quick Start (로컬 전체 스택)
```bash
# 1. Postgres 기동 (최초 1회)
docker run -d --name momento-pg -e POSTGRES_PASSWORD=momento -e POSTGRES_DB=momento -p 5433:5432 postgres:16
# 재기동: docker start momento-pg

# 2. 스키마 반영 + Prisma 클라이언트 생성
DATABASE_URL="postgresql://postgres:momento@localhost:5433/momento" pnpm exec prisma db push
pnpm exec prisma generate

# 3. 스모크 테스트 (전체 E2E)
pnpm smoke
```

### Smoke Test (scripts/smoke.sh)
`pnpm smoke` — 자동으로 다음을 검증:
1. Postgres 연결
2. DB 리셋
3. web 서버 기동
4. keeper REPLAY_MODE=1 → 4개 moment 생성
5. GET /api/moments → OPEN 목록
6. GET /api/moments/:id/image → 200 image/png
7. GET /api/moments/:id/metadata → 200 JSON (name/image/attributes)
8. void moment → mint 시도 409
9. closeTs 지난 moment → mint 시도 409
10. E2E 실민팅 → `/api/mint` 200 + devnet asset 실재 확인
11. 중복 요청 → 409
12. /api/mints?wallet= → 컬렉션 반영

### TxLINE API Endpoints Used
- `POST /auth/guest/start` → JWT 발급
- `GET /api/fixtures/snapshot` → 경기 목록 (PascalCase)
- `GET /api/scores/stream` → SSE 실시간 이벤트
- `GET /api/scores/updates/{fixtureId}` → 과거 이벤트 재생 (데모용)

### Known Frictions with TxLINE
- SSE stream은 경기 없을 때 조용함 (아무것도 안 옴). `scores/updates` endpoint로 대체 가능.
- `eventsource` npm 패키지가 자체 .d.ts 없음 → `packages/txline/src/eventsource.d.ts` 수동 stub.
- Guest JWT는 단기 유효. 장기 운영 시 refresh 로직 필요.

### Demo Scenario (브라우저 없이 재현 가능)
```bash
# Terminal 1 — web
DATABASE_URL="postgresql://postgres:momento@localhost:5433/momento" \
KEEPER_PRIVATE_KEY="$(cat devnet-keeper.json)" \
SOLANA_RPC_URL=https://api.devnet.solana.com \
pnpm --filter web dev

# Terminal 2 — keeper replay (골→창 오픈)
DATABASE_URL="postgresql://postgres:momento@localhost:5433/momento" \
KEEPER_WALLET_PATH="../../devnet-keeper.json" \
REPLAY_MODE=1 TXLINE_API_ORIGIN=https://txline-dev.txodds.com \
TXLINE_API_TOKEN=<your_txline_api_token> \
PUBLIC_BASE_URL=http://localhost:3000 \
pnpm --filter keeper exec ts-node src/index.ts

# Terminal 3 — E2E 민팅 (moment id는 replay 출력에서 확인)
BASE_URL=http://localhost:3000 MOMENT_ID=1 KEYPAIR_PATH=./devnet-keeper.json \
pnpm --filter keeper e2e-mint
```
순서: 골 이벤트 → OPEN moment 생성 → e2e-mint → devnet NFT 확인 → 컬렉션 반영.

---

## P1 — Live Event Schema (2026-07-13)

Schema in `packages/shared/src/schemas.ts` cross-validated against live `/api/scores/updates/18222446`.

### Confirmed correct fields
| Field | Real value | Schema | ✓ |
|-------|-----------|--------|---|
| `Action` | `"goal"` / `"game_finalised"` / `"action_discarded"` | `z.string().optional()` | ✓ |
| `Confirmed` | `false` then `true` | `z.boolean().optional()` | ✓ |
| `Participant` | `1` or `2` | `z.union([z.literal(1), z.literal(2)])` | ✓ |
| `StatusId` | `2` (H1), `3` (HT), `4` (H2), `100` (FT) | `z.number().optional()` | ✓ |
| `Clock.Running` | boolean | ClockSchema | ✓ |
| `Clock.Seconds` | number | ClockSchema | ✓ |
| `Score.ParticipantX.Total.Goals` | number | ScoreParticipantSchema | ✓ |
| `Data.GoalType` | `"Head"` / `"Foot"` / `"Penalty"` / `"OwnGoal"` | GoalDataSchema | ✓ |
| `FixtureId` | number (18222446) | `z.union([z.string(), z.number()]).transform(String)` | ✓ |

### Extra real fields not in strict schema (handled by `.passthrough()`)
`GameState`, `IsTeam`, `FixtureGroupId`, `CountryId`, `SportId`, `CoverageSecondaryData`,
`CoverageType`, `Id`, `ConnectionId`, `Stats`, `PlayerStats`, `Kickoff`, `Possession`,
`PossessionType`, `Parti1State`, `Parti2State`

### Note: inner Score sub-objects strip extra stats fields
Real data has `H1: { Goals: 1, Corners: 2 }` etc. — `Corners`, `YellowCards`, `RedCards` stripped
by non-passthrough inner zod objects. Only `Goals` matters for keeper logic → **no impact**.

### Capture script
```bash
# Requires env vars from root .env:
source .env && export TXLINE_API_ORIGIN TXLINE_API_TOKEN
CAPTURE_MAX=10 CAPTURE_TIMEOUT_MS=60000 pnpm --filter keeper exec ts-node src/scripts/capture.ts
```
SSE stream is quiet when no live matches. Use `/api/scores/updates/<fixtureId>` for historical replay.

## P2 — Metadata/Image Reachability

Images + metadata now stored in Neon DB (`imageData` BYTEA, `metadataJson` TEXT).
Served via `/api/moments/[id]/image` and `/api/moments/[id]/metadata`.
`metadataUrl` = `${PUBLIC_BASE_URL}/api/moments/${id}/metadata` → public, stable, cross-deployment.

**DB migration:**
```bash
DATABASE_URL=<neon_url> npx prisma db push
# or run: prisma/migrations/0002_add_moment_fields/migration.sql
```

## Tasks 1/2/4 — Mint API Hardening (2026-07-13)

### Task 1 — Duplicate mint prevention
- `Mint` model: `@@unique([txSig])` + `@@unique([momentId, minterPubkey])`
- `/api/mint`: `findFirst` check before `mintCoreAsset` to avoid burning SOL/rent on dupes
- Race condition catch: P2002 error → 409 response

### Task 2 — On-chain fallback when window creation failed
- Policy: if `moment.momentPda` is null OR `moment.onchainStatus === 'FAILED'`, skip on-chain step
- `MomentCard.tsx`: only builds + sends on-chain tx when `moment.momentPda` is set
- Server validates time window from DB regardless of on-chain status

### Task 4 — Prisma connection singleton
- `apps/web/src/lib/db.ts`: globalThis singleton to prevent connection exhaustion on Vercel
- All routes import `{ db }` from `@/lib/db`

### Architecture (current)
```
TxLINE SSE
    ↓
Keeper (parser.ts)
    ↓
mintWindow.ts → Neon DB (Moment row, imageData BYTEA, metadataJson TEXT)
              → onchain.ts → Solana (Moment PDA, if SOL available)
              → POST /api/feed (SSE push to web clients)

Client
    ↓ (if momentPda set)
  mint_moment ix → Solana devnet
    ↓ (txSig)
POST /api/mint
    ↓
  verifyTx (if momentPda) → UMI createV1 → Metaplex Core Asset
    ↓
  Mint row (assetId, minterPubkey, txSig)
```

## Ancillary

- `onchainStatus` field added to Moment (`null` | `'OK'` | `'FAILED'`) — keeper logs FAILED clearly
- RESULT `|| StatusId===100` guard left as-is (devnet-verified, no observed false positives)

## DB Migration (Task 6)

Run once against Neon to apply schema changes:
```bash
# Option A — prisma db push (idempotent)
DATABASE_URL=<neon_url> npx prisma db push

# Option B — manual SQL
psql $DATABASE_URL -f prisma/migrations/0002_add_moment_fields/migration.sql
```

Migration adds:
- `Moment.onchainStatus TEXT`
- `Moment.imageData BYTEA`
- `Moment.metadataJson TEXT`
- `Mint` unique constraints on `txSig` and `(momentId, minterPubkey)`
