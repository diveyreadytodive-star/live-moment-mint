# Momento — Demo Script (TxODDS Hackathon Track 2)

Estimated run time: ~5 minutes.

---

## Prerequisites

```bash
docker start momento-pg   # local Postgres on :5433
pnpm dev:web              # Next.js on http://localhost:3000
```

Or use the automated setup:

```bash
bash scripts/smoke.sh     # resets DB, runs replay, full E2E in one shot
pnpm dev:web              # then start the UI
```

---

## Step 1 — Open the home feed

Navigate to **http://localhost:3000**

You should see:
- **MINTING NOW** section at the top — drop cards with gold borders and live countdown timers
- **Upcoming** — future fixtures with kickoff time
- **Ended** — completed matches with final score (FT badge)

Each drop card shows the moment type (GOAL / FULL TIME), the score at that moment, and a countdown to when the minting window closes.

---

## Step 2 — Run the replay (if not already done)

```bash
REPLAY_MODE=1 pnpm dev:keeper
```

This simulates a live Argentina 2-1 Switzerland match, emitting:
- GOAL 24' (1-0)
- GOAL 68' (1-1)
- GOAL 89' (2-1)
- FULL TIME (2-1)

Each event creates a **5-minute minting window** and a PNG card stored in the DB.

The home page will auto-update via SSE — no refresh needed. The MINTING NOW section appears immediately.

---

## Step 3 — Click a moment card

Click any card in **Minting Now**, or click the match row to go to the match detail, then click a moment card there.

You land on the **moment detail page**:
- NFT card image (PNG generated server-side)
- GOAL / FULL TIME label with minute
- Large score display
- Gold countdown timer (turns red under 60 seconds)
- Collector count ("N people collected this moment")
- **Mint this moment** button (or **Select Wallet** if not connected)

---

## Step 4 — Connect wallet and mint

1. Click **Select Wallet** in the header or on the moment page
2. Select Phantom or Solflare (Solana devnet)
3. Click **Mint this moment**
4. Wallet prompts for signature — approve
5. Button changes to **Minted** with link to Solana Explorer

The mint flow:
- If `momentPda` is set: sends `mint_moment` instruction to the Anchor program on-chain, then POSTs to `/api/mint`
- Always: creates a Metaplex Core NFT on devnet via server-side UMI, stores `assetId` in DB

---

## Step 5 — View collection

Click **My Collection** in the nav.

You will see the minted card with:
- NFT image
- GOAL / FULL TIME label
- Score
- Link to Solana Explorer (View NFT)

---

## Step 6 — VAR / void scenario (optional)

The smoke test demonstrates this automatically. To show manually:

```bash
# Void a moment via DB
docker exec momento-pg psql -U postgres -d momento \
  -c "UPDATE \"Moment\" SET status='VOID' WHERE id=1;"
```

The moment card on the match page immediately dims and shows **VOIDED**. Mint attempts return 409.

---

## Key numbers (from smoke test)

| Check | Result |
|-------|--------|
| Replay events processed | 4 moments created |
| Image route (`/api/moments/:id/image`) | 200 `image/png` |
| Metadata route | 200 JSON (name / image / attributes) |
| Void mint attempt | 409 |
| Closed-window mint attempt | 409 |
| Happy-path E2E mint | Real Metaplex Core asset on devnet |
| Duplicate mint | 409 |
| Collection API | Returns minted record |

---

## On-chain verification

Every minted NFT:
- Exists on Solana **devnet**
- Owner: `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d` (mpl-core collection program)
- Viewable at: `https://explorer.solana.com/address/{assetId}?cluster=devnet`

Example verified asset:
`84HFu6pEN4VT5W7o8gNGCFRBfM8fdj84DmhLPcKDgFuW`
