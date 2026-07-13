#!/usr/bin/env bash
# Smoke test: DB reset → replay → assert image/metadata 200 → e2e-mint (200 + asset + 409)
# Usage: pnpm smoke
# Requires: local Postgres on 5433, web server NOT already running on 3000
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="postgresql://postgres:momento@localhost:5433/momento"
export KEEPER_PRIVATE_KEY="$(cat devnet-keeper.json)"
export SOLANA_RPC_URL="https://api.devnet.solana.com"
export MOMENTO_PROGRAM_ID="CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja"
export KEEPER_WALLET_PATH="../../devnet-keeper.json"
export PUBLIC_BASE_URL="http://localhost:3000"
export INTERNAL_SECRET="dev-secret-momento-2026"
export TXLINE_API_ORIGIN="https://txline-dev.txodds.com"
export TXLINE_API_TOKEN="txoracle_api_08b2494a8e484db086d7718872588085"
export NEXT_PUBLIC_MOMENTO_PROGRAM_ID="$MOMENTO_PROGRAM_ID"

WEB_PID=""
fail() { echo "FAIL: $*" >&2; [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null; exit 1; }
pass() { echo "PASS: $*"; }

echo "=== Momento Smoke Test ==="

# ── 1. Postgres reachable ─────────────────────────────────────────────────
echo ""
echo "[1] Postgres check..."
docker exec momento-pg psql -U postgres -d momento -c "SELECT 1;" > /dev/null 2>&1 \
  || fail "Postgres not reachable at localhost:5433 (run: docker start momento-pg)"
pass "Postgres reachable"

# ── 2. DB reset ───────────────────────────────────────────────────────────
echo ""
echo "[2] Resetting DB..."
docker exec momento-pg psql -U postgres -d momento \
  -c 'TRUNCATE "Mint", "Moment", "Fixture" RESTART IDENTITY CASCADE;' > /dev/null 2>&1
pass "DB reset"

# ── 3. Kill anything on port 3000 ────────────────────────────────────────
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 1

# ── 4. Start web server ───────────────────────────────────────────────────
echo ""
echo "[4] Starting web server..."
DATABASE_URL="$DATABASE_URL" \
KEEPER_PRIVATE_KEY="$KEEPER_PRIVATE_KEY" \
SOLANA_RPC_URL="$SOLANA_RPC_URL" \
INTERNAL_SECRET="$INTERNAL_SECRET" \
PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \
MOMENTO_PROGRAM_ID="$MOMENTO_PROGRAM_ID" \
NEXT_PUBLIC_MOMENTO_PROGRAM_ID="$NEXT_PUBLIC_MOMENTO_PROGRAM_ID" \
pnpm --filter web dev > /tmp/smoke-web.log 2>&1 &
WEB_PID=$!

# Wait for web server to be ready
for i in $(seq 1 15); do
  sleep 1
  if curl -sf http://localhost:3000/api/moments > /dev/null 2>&1; then break; fi
  if [ "$i" -eq 15 ]; then fail "Web server did not start (see /tmp/smoke-web.log)"; fi
done
pass "Web server ready (pid=$WEB_PID)"

# ── 5. Run replay ─────────────────────────────────────────────────────────
echo ""
echo "[5] Running keeper replay..."
REPLAY_MODE=1 \
DATABASE_URL="$DATABASE_URL" \
KEEPER_PRIVATE_KEY="$KEEPER_PRIVATE_KEY" \
SOLANA_RPC_URL="$SOLANA_RPC_URL" \
MOMENTO_PROGRAM_ID="$MOMENTO_PROGRAM_ID" \
KEEPER_WALLET_PATH="$KEEPER_WALLET_PATH" \
PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \
INTERNAL_SECRET="$INTERNAL_SECRET" \
TXLINE_API_ORIGIN="$TXLINE_API_ORIGIN" \
TXLINE_API_TOKEN="$TXLINE_API_TOKEN" \
pnpm --filter keeper exec ts-node src/index.ts > /tmp/smoke-keeper.log 2>&1

grep -q "Replay complete" /tmp/smoke-keeper.log || fail "Replay did not complete (see /tmp/smoke-keeper.log)"
pass "Replay complete"

# ── 6. Get first OPEN moment ──────────────────────────────────────────────
echo ""
echo "[6] Checking /api/moments..."
MOMENTS=$(curl -sf http://localhost:3000/api/moments)
MOMENT_COUNT=$(echo "$MOMENTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")
[ "$MOMENT_COUNT" -ge 1 ] || fail "/api/moments returned 0 moments"
MOMENT_ID=$(echo "$MOMENTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])")
pass "/api/moments returned $MOMENT_COUNT moments; using id=$MOMENT_ID"

# ── 7. Image route ────────────────────────────────────────────────────────
echo ""
echo "[7] Image check (GET /api/moments/$MOMENT_ID/image)..."
IMAGE_STATUS=$(curl -so /dev/null -w "%{http_code}" http://localhost:3000/api/moments/$MOMENT_ID/image)
IMAGE_CT=$(curl -sI http://localhost:3000/api/moments/$MOMENT_ID/image | grep -i content-type | tr -d '\r')
[ "$IMAGE_STATUS" = "200" ] || fail "image returned HTTP $IMAGE_STATUS"
echo "$IMAGE_CT" | grep -qi "image/png" || fail "content-type not image/png: $IMAGE_CT"
pass "image HTTP 200, content-type: image/png"

# ── 8. Metadata route ─────────────────────────────────────────────────────
echo ""
echo "[8] Metadata check (GET /api/moments/$MOMENT_ID/metadata)..."
META_STATUS=$(curl -so /dev/null -w "%{http_code}" http://localhost:3000/api/moments/$MOMENT_ID/metadata)
META_BODY=$(curl -s http://localhost:3000/api/moments/$MOMENT_ID/metadata)
[ "$META_STATUS" = "200" ] || fail "metadata returned HTTP $META_STATUS"
echo "$META_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'name' in d and 'image' in d and 'attributes' in d" \
  || fail "metadata missing required fields (name/image/attributes)"
pass "metadata HTTP 200, valid JSON with name/image/attributes"

# ── 9. VAR void test ──────────────────────────────────────────────────────
echo ""
echo "[9] VAR void check..."
docker exec momento-pg psql -U postgres -d momento \
  -c "UPDATE \"Moment\" SET status='VOID' WHERE id=$MOMENT_ID;" > /dev/null
VOID_MINT=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/mint \
  -H "Content-Type: application/json" \
  -d "{\"momentId\":$MOMENT_ID,\"minter\":\"CSrPnu3y3vUeRPpJmsVukXyDZbHKLw7sFyweSubj97ve\"}")
[ "$VOID_MINT" = "409" ] || fail "void moment mint returned $VOID_MINT (expected 409)"
pass "void moment mint blocked with 409"
# Restore OPEN for e2e test
docker exec momento-pg psql -U postgres -d momento \
  -c "UPDATE \"Moment\" SET status='OPEN' WHERE id=$MOMENT_ID;" > /dev/null

# ── 10. Window closed test ────────────────────────────────────────────────
echo ""
echo "[10] Closed window check..."
# Create a test moment with closeTs in the past
PAST_ID=$(docker exec momento-pg psql -U postgres -d momento -t -A -c \
  "INSERT INTO \"Moment\" (\"fixtureId\",kind,seq,\"tsEvent\",\"scoreP1\",\"scoreP2\",status,\"openTs\",\"closeTs\") \
   VALUES ('demo-001','GOAL',999,0,0,0,'OPEN',0,1) RETURNING id;")
PAST_ID=$(echo "$PAST_ID" | grep -E '^[0-9]+$' | head -1)
[ -n "$PAST_ID" ] || fail "could not get PAST_ID from INSERT"
CLOSED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/mint \
  -H "Content-Type: application/json" \
  -d "{\"momentId\":${PAST_ID},\"minter\":\"CSrPnu3y3vUeRPpJmsVukXyDZbHKLw7sFyweSubj97ve\"}")
[ "$CLOSED_STATUS" = "409" ] || fail "closed-window mint returned $CLOSED_STATUS (expected 409)"
pass "closed window mint blocked with 409"

# ── 11. E2E mint (happy path) ─────────────────────────────────────────────
echo ""
echo "[11] E2E mint (happy path) on moment id=$MOMENT_ID..."
set +e
E2E_OUT=$(BASE_URL="http://localhost:3000" \
  MOMENT_ID="$MOMENT_ID" \
  KEYPAIR_PATH="$ROOT/devnet-keeper.json" \
  SOLANA_RPC_URL="$SOLANA_RPC_URL" \
  KEEPER_PRIVATE_KEY="$KEEPER_PRIVATE_KEY" \
  pnpm --filter keeper exec ts-node src/scripts/e2e-mint.ts 2>&1)
E2E_EXIT=$?
set -e
echo "$E2E_OUT"
[ $E2E_EXIT -eq 0 ] || fail "e2e-mint exited with code $E2E_EXIT"
echo "$E2E_OUT" | grep -q "Happy path complete" || fail "e2e-mint did not print 'Happy path complete'"
ASSET_ID=$(echo "$E2E_OUT" | grep "NFT asset" | grep -oE '[A-Za-z0-9]{32,}')
echo ""
pass "E2E mint complete. NFT asset: https://explorer.solana.com/address/$ASSET_ID?cluster=devnet"

# ── 12. Collection check ──────────────────────────────────────────────────
echo ""
echo "[12] Collection check (/api/mints?wallet=...)..."
MINTS=$(curl -sf "http://localhost:3000/api/mints?wallet=CSrPnu3y3vUeRPpJmsVukXyDZbHKLw7sFyweSubj97ve")
MINT_COUNT=$(echo "$MINTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")
[ "$MINT_COUNT" -ge 1 ] || fail "/api/mints returned 0 records"
pass "/api/mints returned $MINT_COUNT mint(s) for wallet"

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "=== ALL CHECKS PASSED ==="
echo "Minted asset: https://explorer.solana.com/address/$ASSET_ID?cluster=devnet"
kill "$WEB_PID" 2>/dev/null
exit 0
