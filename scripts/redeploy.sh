#!/usr/bin/env bash
#
# redeploy.sh — one-shot: build → deploy → verify the mpl-core CPI program.
#
# Run from the repo root:
#   KEEPER=./devnet-keeper.json ./scripts/redeploy.sh
#
# Env:
#   KEEPER   path to a devnet keypair with SOL (default ./devnet-keeper.json)
#            used for BOTH the deploy fee/authority AND the open+mint verification.
#   RPC      Solana RPC (default https://api.devnet.solana.com)
#
# What it does:
#   0. Preflight: checks solana/anchor/cargo, wallet balance, program keypair.
#   1. Builds the program (.so) — tries `anchor build`, falls back to cargo build-sbf.
#   2. Deploys:
#        - if the program keypair exists AND matches the on-chain upgradeable
#          program, upgrades in place (same program id).
#        - otherwise deploys a NEW program id and prints every place to update it.
#   3. Runs open-and-mint verification and reports whether a real mpl-core NFT
#      asset was created.
#
# This script never handles secret keys beyond passing --keypair paths to the
# solana CLI, exactly as a human would. Nothing is uploaded anywhere.

set -euo pipefail

RPC="${RPC:-https://api.devnet.solana.com}"
KEEPER="${KEEPER:-./devnet-keeper.json}"
PROGRAM_DIR="programs/moment-mint"
CURRENT_PROGRAM_ID="CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja"

c()  { printf "\033[1;36m%s\033[0m\n" "$*"; }
ok() { printf "\033[1;32m%s\033[0m\n" "$*"; }
err(){ printf "\033[1;31m%s\033[0m\n" "$*" >&2; }

# ── 0. Preflight ─────────────────────────────────────────────────────────────
c "== [0/3] Preflight =="
for bin in solana cargo; do
  command -v "$bin" >/dev/null 2>&1 || { err "❌ '$bin' not found. Install Solana CLI + Rust first."; exit 1; }
done
HAS_ANCHOR=0; command -v anchor >/dev/null 2>&1 && HAS_ANCHOR=1

[ -f "$KEEPER" ] || { err "❌ keypair not found at $KEEPER (set KEEPER=/path/to/devnet-wallet.json)"; exit 1; }

solana config set --url "$RPC" >/dev/null
WALLET_ADDR="$(solana address -k "$KEEPER")"
BAL="$(solana balance -k "$KEEPER" | awk '{print $1}')"
c "Wallet : $WALLET_ADDR"
c "Balance: $BAL SOL"
# program deploy needs a few SOL; warn if low
awk "BEGIN{exit !($BAL < 2)}" && err "⚠️  Balance < 2 SOL — a fresh program deploy may fail. Airdrop more:  solana airdrop 2 $WALLET_ADDR --url devnet"

# ── 1. Build ─────────────────────────────────────────────────────────────────
c "== [1/3] Build =="
pushd "$PROGRAM_DIR" >/dev/null
if [ "$HAS_ANCHOR" = "1" ]; then
  # IDL generation can fail on some rustc/platform-tools combos; --no-idl still builds the .so.
  anchor build --no-idl || { err "anchor build --no-idl failed; trying cargo build-sbf"; cargo build-sbf; }
else
  cargo build-sbf
fi

# Locate the built .so (path varies by toolchain version)
SO=""
for p in \
  "target/deploy/moment_mint.so" \
  "target/sbpf-solana-solana/release/moment_mint.so" \
  "target/sbf-solana-solana/release/moment_mint.so"; do
  [ -f "$p" ] && SO="$p" && break
done
[ -n "$SO" ] || { err "❌ built .so not found under target/. Check build output above."; exit 1; }
ok "Built: $SO"

# Program keypair (defines the program id on deploy)
PROG_KP="target/deploy/moment_mint-keypair.json"
popd >/dev/null

# ── 2. Deploy ────────────────────────────────────────────────────────────────
c "== [2/3] Deploy =="
NEW_ID=""
if [ -f "$PROGRAM_DIR/$PROG_KP" ]; then
  PROG_KP_ADDR="$(solana address -k "$PROGRAM_DIR/$PROG_KP")"
  c "Program keypair address: $PROG_KP_ADDR"
  solana program deploy "$PROGRAM_DIR/$SO" \
    --program-id "$PROGRAM_DIR/$PROG_KP" \
    --keypair "$KEEPER" \
    --url "$RPC"
  DEPLOYED_ID="$PROG_KP_ADDR"
  [ "$DEPLOYED_ID" != "$CURRENT_PROGRAM_ID" ] && NEW_ID="$DEPLOYED_ID"
else
  err "⚠️  No program keypair at $PROGRAM_DIR/$PROG_KP."
  err "    Cannot upgrade $CURRENT_PROGRAM_ID without its keypair — deploying a NEW program id."
  solana program deploy "$PROGRAM_DIR/$SO" --keypair "$KEEPER" --url "$RPC" | tee /tmp/momento-deploy.out
  DEPLOYED_ID="$(grep -o 'Program Id: .*' /tmp/momento-deploy.out | awk '{print $3}')"
  NEW_ID="$DEPLOYED_ID"
fi
ok "Deployed program id: $DEPLOYED_ID"

if [ -n "$NEW_ID" ]; then
  err "── NEW PROGRAM ID: $NEW_ID ──"
  err "Update these before the demo (search & replace $CURRENT_PROGRAM_ID → $NEW_ID):"
  err "  programs/moment-mint/programs/moment-mint/src/lib.rs   (declare_id!)"
  err "  apps/web/src/app/moment/[id]/page.tsx                  (or set NEXT_PUBLIC_MOMENTO_PROGRAM_ID)"
  err "  apps/web/src/app/api/mint/route.ts                     (PROGRAM_ID)"
  err "  apps/keeper/src/scripts/open-and-mint.ts               (PROGRAM_ID)"
  err "  apps/keeper/src/onchain.ts env: MOMENTO_PROGRAM_ID"
  err "  Vercel env: MOMENTO_PROGRAM_ID + NEXT_PUBLIC_MOMENTO_PROGRAM_ID"
  err "NOTE: a new program id means existing moment PDAs are orphaned — reopen windows via keeper/open-and-mint."
fi

# ── 3. Verify (open + mint, expect mpl-core CPI) ────────────────────────────
c "== [3/3] Verify on-chain mint (expect mpl-core asset) =="
pushd apps/keeper >/dev/null
set +e
KEYPAIR_PATH="$KEEPER" SOLANA_RPC_URL="$RPC" \
  MOMENTO_PROGRAM_ID="$DEPLOYED_ID" MPL_CORE_MINT=1 \
  npx ts-node src/scripts/open-and-mint.ts
VERIFY_RC=$?
set -e
popd >/dev/null

echo
if [ $VERIFY_RC -eq 0 ]; then
  ok "🎉 DONE. Program redeployed and a real Metaplex Core NFT was minted on devnet."
  ok "Next: set NEXT_PUBLIC_MPL_CORE_MINT=1 in Vercel (and NEXT_PUBLIC_MOMENTO_PROGRAM_ID if the id changed), redeploy web."
else
  err "Verification did not confirm an mpl-core asset (rc=$VERIFY_RC)."
  err "If logs show no 'Program CoREENx... invoke', the .so still lacks the CPI — re-check the build."
  err "You can still demo the on-chain window+mint path (2-account) without NEXT_PUBLIC_MPL_CORE_MINT."
fi
