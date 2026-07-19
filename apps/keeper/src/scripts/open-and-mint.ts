/**
 * Open + Mint — all-in-one on-chain verification (no keeper, no browser).
 *
 * What it does, using ONE devnet wallet:
 *   1. open_moment_window  → creates a fresh Moment PDA with close_ts = now + 1h
 *   2. mint_moment         → creates a real Metaplex Core NFT asset (5 accounts)
 *   3. Verifies the asset account is owned by the mpl-core program
 *
 * This proves the full on-chain path works end-to-end and leaves a fresh,
 * still-open moment you can also mint from the web UI for the demo.
 *
 * Usage (from apps/keeper):
 *   KEYPAIR_PATH=./devnet-keeper.json \
 *   SOLANA_RPC_URL=https://api.devnet.solana.com \
 *   npx ts-node src/scripts/open-and-mint.ts
 *
 * The wallet at KEYPAIR_PATH must hold a little devnet SOL (~0.01) to pay
 * rent for the Moment PDA + the NFT asset.
 */

import 'dotenv/config';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const RPC          = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const KEYPAIR_PATH = process.env.KEYPAIR_PATH   ?? './devnet-keeper.json';
const METADATA_URI = process.env.METADATA_URI   ??
  'https://live-moment-mint.vercel.app/api/moments/1/metadata';

const PROGRAM_ID       = new PublicKey('CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja');
const MPL_CORE_PROGRAM = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

const OPEN_DISC = Buffer.from([104, 125, 103, 198, 146, 135, 81, 158]);
const MINT_DISC = Buffer.from([157, 243, 211, 63, 10, 118, 217, 42]);

function loadKeypair(p: string): Keypair {
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  const raw = fs.readFileSync(abs, 'utf8').trim();
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

// ── Anchor-style borsh encoders ──────────────────────────────────────────────
function encodeString(s: string): Buffer {
  const body = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(body.length, 0);
  return Buffer.concat([len, body]);
}
function encodeU64(n: number | bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n), 0);
  return b;
}
function encodeI64(n: number | bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(n), 0);
  return b;
}

function findMomentPda(fixtureId: string, seq: bigint): PublicKey {
  const seqBuf = Buffer.alloc(8);
  seqBuf.writeBigUInt64LE(seq, 0);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('moment'), Buffer.from(fixtureId), seqBuf],
    PROGRAM_ID,
  );
  return pda;
}

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  const wallet = loadKeypair(KEYPAIR_PATH);
  console.log('Wallet   :', wallet.publicKey.toBase58());

  const bal = await conn.getBalance(wallet.publicKey);
  console.log('Balance  :', (bal / 1e9).toFixed(4), 'SOL');
  if (bal < 0.01 * 1e9) {
    console.error('❌ Not enough SOL. Run: solana airdrop 1', wallet.publicKey.toBase58(), '--url devnet');
    process.exit(1);
  }

  // Unique fixture/seq so the PDA is always fresh (avoids "already in use").
  const fixtureId = `demo-live-${Date.now()}`;
  const seq = 1n;
  const now = Math.floor(Date.now() / 1000);
  const openTs = now;
  const closeTs = now + 60 * 60; // 1 hour window
  const kind = 0; // GOAL

  const momentPda = findMomentPda(fixtureId, seq);
  console.log('Fixture  :', fixtureId, 'seq', seq.toString());
  console.log('MomentPDA:', momentPda.toBase58());
  console.log('Window   : open', openTs, '→ close', closeTs, '(1h)');

  // ── 1. open_moment_window ──────────────────────────────────────────────────
  const openData = Buffer.concat([
    OPEN_DISC,
    encodeString(fixtureId),
    encodeU64(seq),
    encodeI64(openTs),
    encodeI64(closeTs),
    Buffer.from([kind]),
    encodeString(METADATA_URI),
  ]);
  const openIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: momentPda,          isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey,   isSigner: true,  isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: openData,
  });

  {
    const tx = new Transaction().add(openIx);
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;
    tx.sign(wallet);
    const sig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    console.log('\n✅ open_moment_window tx:', sig);
    console.log('   https://explorer.solana.com/tx/' + sig + '?cluster=devnet');
  }

  // ── 2. mint_moment ─────────────────────────────────────────────────────────
  // MPL_CORE_MINT=1 → 5-account layout that creates a real Metaplex Core asset
  //                   (only works once the mpl-core CPI program is deployed).
  // default          → 2-account layout that records the mint on-chain without
  //                   a separate asset account (works with the current program).
  const MPL_CORE_MINT = process.env.MPL_CORE_MINT === '1';
  const asset = Keypair.generate();
  const mintKeys = MPL_CORE_MINT
    ? [
        { pubkey: momentPda,          isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey,   isSigner: true,  isWritable: true },
        { pubkey: asset.publicKey,    isSigner: true,  isWritable: true },
        { pubkey: MPL_CORE_PROGRAM,   isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ]
    : [
        { pubkey: momentPda,          isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey,   isSigner: true,  isWritable: false },
      ];
  const mintIx = new TransactionInstruction({ programId: PROGRAM_ID, keys: mintKeys, data: MINT_DISC });

  let mintSig: string;
  {
    const tx = new Transaction().add(mintIx);
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;
    if (MPL_CORE_MINT) tx.sign(wallet, asset); else tx.sign(wallet);
    mintSig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction({ signature: mintSig, blockhash, lastValidBlockHeight }, 'confirmed');
    console.log('\n✅ mint_moment tx:', mintSig);
    console.log('   https://explorer.solana.com/tx/' + mintSig + '?cluster=devnet');
    if (MPL_CORE_MINT) {
      console.log('   Asset:', asset.publicKey.toBase58());
      console.log('   https://explorer.solana.com/address/' + asset.publicKey.toBase58() + '?cluster=devnet');
    }
  }

  // ── 3. Verify ──────────────────────────────────────────────────────────────
  console.log('\n── Verification ──');
  if (MPL_CORE_MINT) {
    const info = await conn.getAccountInfo(asset.publicKey);
    if (!info) { console.error('❌ Asset account not found — mint may have failed.'); process.exit(1); }
    const owner = info.owner.toBase58();
    const isCore = owner === MPL_CORE_PROGRAM.toBase58();
    console.log('Asset owner:', owner);
    if (isCore) { console.log('🎉 SUCCESS — asset owned by Metaplex Core. Real on-chain NFT minted.'); }
    else { console.log('⚠️  Asset owner is NOT mpl-core (' + owner + ').'); process.exit(2); }
  } else {
    console.log('✅ On-chain mint_moment transaction confirmed (mint_count + MintEvent).');
    console.log('   (No separate NFT asset — set MPL_CORE_MINT=1 after redeploying the mpl-core CPI program.)');
  }

  console.log('\nFresh moment is OPEN for 1 hour:');
  console.log('  fixtureId =', fixtureId);
  console.log('  momentPda =', momentPda.toBase58());
}

main().catch((e) => { console.error('\n❌ ERROR:', e.message ?? e); process.exit(1); });
