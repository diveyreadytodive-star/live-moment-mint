#!/usr/bin/env bash
#
# demo-open-window.sh — open a FRESH minting window (future close_ts) for the demo.
#
# The seeded demo moments (id 1-3) have expired close_ts, so the UI shows
# "MINTING WINDOW CLOSED". This opens a new on-chain window + DB moment you can
# actually mint from during recording.
#
# Two modes:
#   A) REPLAY (recommended for a full UI demo): runs the keeper in replay mode,
#      which opens 4 fresh moments (Argentina 2-1 Switzerland) with future
#      close_ts and pushes them to the web feed via SSE.
#
#         DATABASE_URL=...  PUBLIC_BASE_URL=https://<your-app>.vercel.app \
#         KEEPER_PRIVATE_KEY='[...]'  MOMENTO_PROGRAM_ID=<id> \
#         ./scripts/demo-open-window.sh replay
#
#   B) SINGLE (fastest, keeper-less): opens one on-chain window and mints once.
#
#         KEEPER=./devnet-keeper.json ./scripts/demo-open-window.sh single
#
set -euo pipefail
MODE="${1:-single}"

case "$MODE" in
  replay)
    echo "== REPLAY: opening 4 fresh moments via keeper =="
    : "${DATABASE_URL:?set DATABASE_URL}"
    : "${PUBLIC_BASE_URL:?set PUBLIC_BASE_URL (your web URL)}"
    REPLAY_MODE=1 pnpm --filter keeper dev
    ;;
  single)
    echo "== SINGLE: keeper-less open + mint =="
    KEEPER="${KEEPER:-./devnet-keeper.json}"
    RPC="${RPC:-https://api.devnet.solana.com}"
    cd apps/keeper
    KEYPAIR_PATH="$KEEPER" SOLANA_RPC_URL="$RPC" \
      MPL_CORE_MINT="${MPL_CORE_MINT:-0}" \
      npx ts-node src/scripts/open-and-mint.ts
    ;;
  *)
    echo "usage: $0 [replay|single]" >&2; exit 1;;
esac
