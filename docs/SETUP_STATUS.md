# Momento — Setup & Smoke Test Status

## Smoke Test Results

Run `pnpm smoke` (or `bash scripts/smoke.sh`) to validate the deployment.
Latest smoke log: `docs/smoke-run.log`

All 12 checks must pass before submission.

---

## Manual Verification Checklist (post security hardening)

### 1. Missing messageSignature → 400

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://live-moment-mint.vercel.app/api/mint \
  -H "Content-Type: application/json" \
  -d '{"momentId": <RESULT_MOMENT_ID>, "minter": "11111111111111111111111111111111"}'
# Expected: 400  (body: {"error":"Wallet signature required"})
```

**Result:** 400 ✅

### 2. Invalid / foreign messageSignature → 401

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://live-moment-mint.vercel.app/api/mint \
  -H "Content-Type: application/json" \
  -d '{"momentId": <RESULT_MOMENT_ID>, "minter": "11111111111111111111111111111111", "messageSignature": "aaaa", "messageTs": <NOW_TS>}'
# Expected: 401  (body: {"error":"Invalid wallet signature"})
```

**Result:** 401 ✅

### 3. Bad KEEPER_PRIVATE_KEY → 502, no Mint row created

Set `KEEPER_PRIVATE_KEY=bad` in the server environment, attempt a valid mint (on-chain path or DB-only path with a valid signature).

**Expected:** HTTP 502, body `{"error":"NFT minting failed on-chain", "detail":"..."}`.
**Expected:** No new row in the `Mint` table (verify with `SELECT * FROM "Mint" ORDER BY id DESC LIMIT 5`).

**Result:** 502 ✅ — Mint row not created ✅

---

## Known Limitations

- **Partial-failure gap**: If a user's on-chain `mint_moment` instruction succeeds but the server-side `mintCoreAsset` call subsequently fails (network timeout, bad KEEPER key, etc.), the server now returns 502 and does NOT create a Mint row. This means the user can retry — the dedup check will not block them. However, the on-chain PDA state is already incremented. A retry will receive a duplicate-account error from the program on the second on-chain ix; the server will treat this as a failed txSig verification and reject it. **Mitigation**: the user should contact support with their txSig so the Mint row can be inserted manually. Full retry-with-idempotency (storing the txSig before minting) is out of scope for this release.
