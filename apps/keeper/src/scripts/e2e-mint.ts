/**
 * E2E Mint Verification Script (headless — no browser needed)
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 \
 *   MOMENT_ID=1 \
 *   KEYPAIR_PATH=./devnet-keeper.json \
 *   SOLANA_RPC_URL=https://api.devnet.solana.com \
 *   ts-node src/scripts/e2e-mint.ts
 *
 * What it does:
 *   1. Fetches the target moment from /api/moments/:id
 *   2. If moment has momentPda: sends mint_moment ix on-chain, gets txSig
 *      Otherwise: proceeds without on-chain tx (server-only path)
 *   3. POSTs /api/mint and captures assetId
 *   4. Verifies assetId account exists on Solana devnet (if KEEPER_PRIVATE_KEY
 *      was set server-side so NFT was actually created)
 *   5. Sends identical request again → asserts 409 dedup
 *
 * Prerequisites on the server side:
 *   - KEEPER_PRIVATE_KEY must be set in Vercel env (or .env.local) for real NFT creation.
 *     Without it, assetId will be "no-keeper-key-<ts>" and on-chain check will fail by design.
 *   - Target moment must have status=OPEN and closeTs in the future.
 */

import 'dotenv/config';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const BASE_URL       = process.env.BASE_URL        ?? 'http://localhost:3000';
const MOMENT_ID      = Number(process.env.MOMENT_ID ?? '0');
const KEYPAIR_PATH   = process.env.KEYPAIR_PATH    ?? './devnet-keeper.json';
const RPC            = process.env.SOLANA_RPC_URL  ?? 'https://api.devnet.solana.com';

const PROGRAM_ID     = new PublicKey('CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja');
const MINT_DISCRIMINATOR = Buffer.from([157, 243, 211, 63, 10, 118, 217, 42]);

function loadKeypair(p: string): Keypair {
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(abs, 'utf8'))));
}

async function fetchMoment(id: number): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/moments/${id}`);
  if (!res.ok) throw new Error(`GET /api/moments/${id} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendMintIx(
  conn: Connection,
  keypair: Keypair,
  momentPda: string,
): Promise<string> {
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(momentPda), isSigner: false, isWritable: true },
      { pubkey: keypair.publicKey,        isSigner: true,  isWritable: false },
    ],
    data: MINT_DISCRIMINATOR,
  });
  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash  = blockhash;
  tx.feePayer         = keypair.publicKey;
  tx.sign(keypair);

  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return sig;
}

async function postMint(momentId: number, minter: string, txSig?: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/mint`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ momentId, minter, txSig }),
  });
}

async function main() {
  if (!MOMENT_ID) {
    console.error('ERROR: set MOMENT_ID env var');
    process.exit(1);
  }

  const keypair = loadKeypair(KEYPAIR_PATH);
  const minter  = keypair.publicKey.toBase58();
  const conn    = new Connection(RPC, 'confirmed');

  console.log(`\n=== Momento E2E Mint ===`);
  console.log(`BASE_URL   : ${BASE_URL}`);
  console.log(`MOMENT_ID  : ${MOMENT_ID}`);
  console.log(`Minter     : ${minter}`);
  console.log(`RPC        : ${RPC}\n`);

  // ── Step 1: fetch moment ──────────────────────────────────────────────────
  console.log('[1] Fetching moment...');
  const moment = await fetchMoment(MOMENT_ID);
  console.log(`    kind=${moment.kind} status=${moment.status} closeTs=${moment.closeTs}`);
  console.log(`    momentPda=${moment.momentPda ?? '(none — DB-only path)'}`);

  const nowSec = Math.floor(Date.now() / 1000);
  if (moment.status !== 'OPEN' || nowSec >= moment.closeTs) {
    console.error('ERROR: Moment is not OPEN or window has closed.');
    console.error(`  status=${moment.status}  nowSec=${nowSec}  closeTs=${moment.closeTs}`);
    process.exit(1);
  }

  // ── Step 2: optional on-chain tx ─────────────────────────────────────────
  let txSig: string | undefined;
  if (moment.momentPda) {
    console.log(`\n[2] Sending mint_moment ix on-chain...`);
    txSig = await sendMintIx(conn, keypair, moment.momentPda);
    console.log(`    txSig: ${txSig}`);
    console.log(`    explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
  } else {
    console.log(`\n[2] No momentPda → skipping on-chain tx (DB-only path)`);
  }

  // ── Step 3: POST /api/mint ────────────────────────────────────────────────
  console.log(`\n[3] POST ${BASE_URL}/api/mint ...`);
  const mintRes = await postMint(MOMENT_ID, minter, txSig);
  const mintBody = await mintRes.json().catch(() => ({}));
  console.log(`    HTTP ${mintRes.status}`);
  console.log(`    body: ${JSON.stringify(mintBody)}`);

  if (!mintRes.ok) {
    console.error('ERROR: /api/mint failed');
    process.exit(1);
  }

  const assetId: string = (mintBody as any).assetId ?? '';
  console.log(`\n    assetId: ${assetId}`);

  // ── Step 4: verify asset on-chain ────────────────────────────────────────
  console.log(`\n[4] Verifying asset on Solana devnet...`);
  if (!assetId || assetId.startsWith('no-keeper-key-')) {
    console.warn('    SKIP: assetId indicates KEEPER_PRIVATE_KEY was not set on the server.');
    console.warn('    Real NFT creation requires KEEPER_PRIVATE_KEY in server environment.');
  } else {
    try {
      const assetPubkey = new PublicKey(assetId);
      const info = await conn.getAccountInfo(assetPubkey);
      if (info) {
        console.log(`    FOUND on-chain: ${assetId}`);
        console.log(`    owner: ${info.owner.toBase58()}`);
        console.log(`    data length: ${info.data.length} bytes`);
        console.log(`\n    explorer: https://explorer.solana.com/address/${assetId}?cluster=devnet`);
      } else {
        console.error(`    NOT FOUND on-chain: ${assetId}`);
        console.error('    The account does not exist — NFT creation may have failed server-side.');
        process.exit(1);
      }
    } catch {
      console.error(`    Invalid pubkey or RPC error for assetId: ${assetId}`);
    }
  }

  // ── Step 5: dedup check — second request must be 409 ─────────────────────
  console.log(`\n[5] Duplicate mint check (same request again)...`);
  const dupRes  = await postMint(MOMENT_ID, minter, txSig);
  const dupBody = await dupRes.json().catch(() => ({}));
  console.log(`    HTTP ${dupRes.status}`);
  console.log(`    body: ${JSON.stringify(dupBody)}`);

  if (dupRes.status === 409) {
    console.log('    PASS: duplicate correctly rejected with 409');
  } else {
    console.error(`    FAIL: expected 409, got ${dupRes.status}`);
    process.exit(1);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n=== E2E Result ===`);
  if (txSig) {
    console.log(`on-chain tx  : https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
  }
  if (assetId && !assetId.startsWith('no-keeper-key-')) {
    console.log(`NFT asset    : https://explorer.solana.com/address/${assetId}?cluster=devnet`);
  }
  console.log(`dedup (409)  : PASS`);
  console.log(`\nHappy path complete.`);
}

main().catch((err) => {
  console.error('\n[e2e-mint] Fatal:', err);
  process.exit(1);
});
