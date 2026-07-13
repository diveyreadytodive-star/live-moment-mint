import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { Connection, Keypair } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

const db = new PrismaClient();
const PROGRAM_ID = 'CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja';
const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

/** Load keeper keypair from KEEPER_PRIVATE_KEY env (JSON byte array). */
function loadKeeperKp(): Keypair | null {
  const raw = process.env.KEEPER_PRIVATE_KEY;
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  } catch {
    return null;
  }
}

/** Verify that txSig is a confirmed tx that called our program. */
async function verifyTx(txSig: string): Promise<boolean> {
  try {
    const conn = new Connection(RPC, 'confirmed');
    const tx = await conn.getTransaction(txSig, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx || tx.meta?.err) return false;
    const keys = tx.transaction.message.staticAccountKeys ?? (tx.transaction.message as any).accountKeys ?? [];
    return keys.some((k: any) => k.toBase58?.() === PROGRAM_ID || k === PROGRAM_ID);
  } catch {
    return false;
  }
}

/** Create a Metaplex Core NFT owned by minter, paid by keeper. Returns assetId. */
async function mintCoreAsset(
  minterAddress: string,
  metadataUri: string,
  name: string,
): Promise<string> {
  // Dynamic import to avoid issues if packages not present
  const { createUmi }           = await import('@metaplex-foundation/umi-bundle-defaults');
  const { mplCore, createV1 }   = await import('@metaplex-foundation/mpl-core');
  const { keypairIdentity, generateSigner, publicKey: umiPk } = await import('@metaplex-foundation/umi');
  const { fromWeb3JsKeypair }   = await import('@metaplex-foundation/umi-web3js-adapters');

  const keeperKp = loadKeeperKp();
  if (!keeperKp) throw new Error('KEEPER_PRIVATE_KEY not set — cannot mint on-chain asset');

  const umi = createUmi(RPC).use(mplCore()).use(keypairIdentity(fromWeb3JsKeypair(keeperKp)));
  const asset = generateSigner(umi);

  await createV1(umi, {
    asset,
    name,
    uri: metadataUri,
    owner: umiPk(minterAddress),
  }).sendAndConfirm(umi);

  return asset.publicKey.toString();
}

export async function POST(req: NextRequest) {
  const { momentId, minter, txSig } = await req.json();

  if (!momentId || !minter || !txSig) {
    return NextResponse.json({ error: 'Missing momentId, minter, or txSig' }, { status: 400 });
  }
  if (txSig.startsWith('offline-') || txSig.startsWith('pending-')) {
    return NextResponse.json({ error: 'Real on-chain txSig required' }, { status: 400 });
  }

  const moment = await (db as any).moment.findUnique({ where: { id: momentId } });
  if (!moment) return NextResponse.json({ error: 'Moment not found' }, { status: 404 });

  const nowSec = Math.floor(Date.now() / 1000);
  if (moment.status !== 'OPEN' || nowSec > moment.closeTs) {
    return NextResponse.json({ error: 'Minting window is closed' }, { status: 409 });
  }

  // Verify the on-chain tx actually called our program
  const txOk = await verifyTx(txSig);
  if (!txOk) {
    return NextResponse.json({ error: 'Transaction not found or did not call Momento program' }, { status: 400 });
  }

  // Mint real Metaplex Core NFT server-side (keeper pays rent, minter receives asset)
  let assetId = `no-keeper-key-${Date.now()}`;
  try {
    const nftName = moment.kind === 'GOAL'
      ? `Momento Goal #${moment.id}`
      : `Momento Result #${moment.id}`;
    assetId = await mintCoreAsset(minter, moment.metadataUrl ?? '', nftName);
  } catch (err: any) {
    console.error('[mint] Server-side NFT creation failed:', err.message);
    // Fall through — record the mint without assetId so the user at least gets DB credit
    // assetId stays as placeholder
  }

  const mint = await (db as any).mint.create({
    data: {
      momentId,
      minterPubkey: minter,
      assetId,
      txSig,
      createdAt: nowSec,
    },
  });

  return NextResponse.json({ mint, assetId });
}
