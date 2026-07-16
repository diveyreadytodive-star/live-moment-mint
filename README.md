# Momento — Live Moment NFT Minting

**TxODDS World Cup Hackathon — Track 2**

Momento turns live football events into time-limited NFT minting windows.
When a goal is confirmed on TxLINE, a 5-minute minting window opens.
Fans mint a Metaplex Core NFT that proves they were watching at that exact moment.

Live app: **https://live-moment-mint.vercel.app**

---

## Architecture

```
TxLINE SSE stream
      ↓
  Keeper (apps/keeper)
      ├── parser.ts      — parses GOAL / RESULT / action_discarded events
      ├── mintWindow.ts  — creates DB record, generates PNG card, opens on-chain PDA
      └── onchain.ts     — Anchor CPI: open_moment_window / void_moment
           ↓
  Neon PostgreSQL         — Moment + Mint records, image BYTEA, metadata JSON
           ↓
  Next.js web (apps/web / Vercel)
      ├── /api/moments           — list OPEN moments
      ├── /api/moments/[id]      — single moment + mint count
      ├── /api/moments/[id]/image    — PNG card (served from DB)
      ├── /api/moments/[id]/metadata — Metaplex-compatible JSON
      ├── /api/mint              — verify tx → create Metaplex Core asset via UMI
      ├── /api/mints?wallet=     — collection for a wallet
      └── /api/feed              — SSE push (keeper → web clients)
           ↓
  Browser (MomentCard.tsx)
      ├── sends mint_moment ix on-chain (if momentPda is set)
      └── POSTs /api/mint with txSig
```

### On-chain Program
- **Program ID**: `CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja` (Solana devnet)
- **Instructions**: `open_moment_window`, `mint_moment`, `void_moment`
- **NFT standard**: Metaplex Core (`mpl-core`) — server-side UMI minting
- **NFT owner**: minter wallet; keeper wallet pays rent (~0.003 SOL/mint)

---

## TxLINE API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/auth/guest/start` | Obtain short-lived JWT |
| `GET` | `/api/fixtures/snapshot` | List live/upcoming fixtures |
| `GET` | `/api/scores/stream` | SSE — live event feed |
| `GET` | `/api/scores/updates/{fixtureId}` | Historical event replay (demo use) |

All fields are **PascalCase** in the API response (e.g. `Action`, `FixtureId`, `Score`).

---

## Local Development

### Prerequisites
- Node 20+, pnpm 9+
- Docker (for local Postgres)
- `devnet-keeper.json` keypair with SOL (gitignored)
- `.env.local.dev` (gitignored) — see `.env.example`

### Quick Start

```bash
# 1. Start Postgres
docker run -d --name momento-pg \
  -e POSTGRES_PASSWORD=momento -e POSTGRES_DB=momento \
  -p 5433:5432 postgres:16
# On restart: docker start momento-pg

# 2. Push schema + generate Prisma client
DATABASE_URL="postgresql://postgres:momento@localhost:5433/momento" \
  pnpm exec prisma db push
pnpm exec prisma generate

# 3. Create .env.local.dev (gitignored)
cp .env.example .env.local.dev
# Fill in: DATABASE_URL, KEEPER_PRIVATE_KEY, TXLINE_API_TOKEN,
#          TXLINE_API_ORIGIN, SOLANA_RPC_URL, INTERNAL_SECRET

# 4. Run smoke test (full E2E)
pnpm smoke
```

### Individual Services

```bash
# Terminal 1 — web server
pnpm dev:web

# Terminal 2 — keeper (requires live TxLINE stream)
KEEPER_WALLET_PATH=./devnet-keeper.json pnpm dev:keeper

# Keeper replay (no live games needed)
REPLAY_MODE=1 pnpm dev:keeper
```

---

## Demo Scenario (no live games needed)

`REPLAY_MODE=1` replays a hardcoded Argentina 2-1 Switzerland match,
creating 4 moments (2 GOALs + 2 RESULTs).

```bash
# Terminal 1 — web
pnpm dev:web

# Terminal 2 — keeper replay → opens 4 moment windows
REPLAY_MODE=1 KEEPER_WALLET_PATH=./devnet-keeper.json \
  DATABASE_URL="postgresql://postgres:momento@localhost:5433/momento" \
  pnpm --filter keeper exec ts-node src/index.ts

# Terminal 3 — mint the first OPEN moment (id from /api/moments)
BASE_URL=http://localhost:3000 MOMENT_ID=1 \
  KEYPAIR_PATH=./devnet-keeper.json \
  pnpm --filter keeper exec ts-node src/scripts/e2e-mint.ts
```

Flow: GOAL event → OPEN moment created → 5-min window → mint → devnet NFT → collection.

Or run the full automated version:

```bash
pnpm smoke   # Postgres reset → replay → image/metadata checks → E2E mint → dedup → collection
```

---

## Smoke Test (`pnpm smoke`)

Requires: Docker Postgres running + `.env.local.dev` with all secrets.

Verifies:
1. Postgres reachable
2. DB reset
3. Web server starts
4. Keeper REPLAY_MODE=1 creates 4 moments
5. `/api/moments` returns list
6. `/api/moments/:id/image` → 200 `image/png`
7. `/api/moments/:id/metadata` → 200 JSON with `name/image/attributes`
8. VOID moment → mint attempt → 409
9. Closed-window moment → mint attempt → 409
10. E2E happy-path mint → real Metaplex Core asset on devnet
11. Duplicate mint → 409
12. `/api/mints?wallet=` → collection reflected

Full log: `docs/smoke-run.log`

---

## UI

| Page | Desktop | Mobile |
|------|---------|--------|
| Home feed | `docs/ui-home.png` | `docs/ui-home-mobile.png` |
| Match detail | `docs/ui-match.png` | — |
| Moment detail | `docs/ui-moment.png` | — |
| Collection | `docs/ui-collection.png` | — |

The home feed shows **Minting Now** (live drop cards with countdown) → Upcoming → Ended.
Font: Archivo (Google Fonts). Theme: Top Shot dark (#070710 bg, #c9952a gold).

---

## Verified Mints

| Date | Asset | Environment | Explorer |
|------|-------|-------------|----------|
| 2026-07-14 | `HEu9xccG9m6dUcWMpj7iz7Gk4GjXiFjCw78taa6fNkLG` | Local | [devnet](https://explorer.solana.com/address/HEu9xccG9m6dUcWMpj7iz7Gk4GjXiFjCw78taa6fNkLG?cluster=devnet) |
| 2026-07-14 | `2F9T54fj8FxVCbahVL2W794GrXr4vn5kNEkhELp9ymdH` | Production (Vercel) | [devnet](https://explorer.solana.com/address/2F9T54fj8FxVCbahVL2W794GrXr4vn5kNEkhELp9ymdH?cluster=devnet) |
| 2026-07-16 | `84HFu6pEN4VT5W7o8gNGCFRBfM8fdj84DmhLPcKDgFuW` | Local (post-UI update) | [devnet](https://explorer.solana.com/address/84HFu6pEN4VT5W7o8gNGCFRBfM8fdj84DmhLPcKDgFuW?cluster=devnet) |

All assets: owner = `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d` (mpl-core program)

---

## TxLINE API Feedback

From direct integration experience during the hackathon:

**What worked well**
- `/api/scores/updates/{fixtureId}` was essential for offline/demo development — replaying past events without needing a live match made development far faster.
- The `action_discarded` event (VAR cancellation) is clean and unambiguous. Easy to map to a `VOID` moment state.
- `StatusId=100` reliably signals full-time (`game_finalised`). No false positives observed.

**Friction points**
- `/api/scores/stream` SSE is completely silent when no live matches are running. There is no heartbeat or keepalive. Clients have no way to distinguish "connected but quiet" from "connection dropped." A periodic ping frame would prevent reconnect loops.
- The guest JWT (`POST /auth/guest/start`) is short-lived with no documented expiry time. Long-running keepers need a refresh mechanism but no refresh endpoint is documented.
- All fields are PascalCase (`Action`, `FixtureId`, `Score`) which is unusual for a JSON API — a minor developer experience issue.
- `eventsource` npm package has no bundled TypeScript types (`.d.ts` missing). Required a manual stub.
- Inner score sub-objects (`H1`, `H2`) include `Corners`, `YellowCards`, `RedCards` but these are not in the snapshot schema — passthrough zod parsing required to avoid stripping them.

---

## Project Structure

```
live-moment-mint/
├── apps/
│   ├── web/          Next.js 14 app (Vercel)
│   └── keeper/       Node.js event listener + minting logic
├── packages/
│   ├── shared/       Zod schemas for TxLINE events
│   ├── image/        PNG card generation (canvas)
│   └── txline/       TxLINE SSE client
├── programs/
│   └── moment-mint/  Anchor program (Rust, deployed devnet)
├── prisma/           Schema + migrations
├── scripts/
│   └── smoke.sh      Full E2E smoke test
└── docs/
    ├── smoke-run.log      Latest smoke test output
    ├── demo-script.md     Step-by-step judging demo
    ├── handoff.md         Fresh-repo setup for judges
    └── ui-*.png           UI screenshots
```
