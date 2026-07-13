import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Connection, Keypair } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

const PROGRAM_ID = 'CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja';
const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

function loadKeeperKp(): Keypair | null {
  const raw = process.env.KEEPER_PRIVATE_KEY;
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  } catch {
    return null;
  }
}

async function verifyTx(txSig: string): Promise<boolean> {
  try {
    const conn = new Connection(RPC, 'confirmed');
    const tx = await conn.getTransaction(txSig, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx || tx.meta?.err) return false;
    const keys =
      tx.transaction.message.staticAccountKeys ??
      (tx.transaction.message as any).accountKeys ??
      [];
    return keys.some((k: any) => k.toBase58?.() === PROGRAM_ID || k === PROGRAM_ID);
  } catch {
    return false;
  }
}

async function mintCoreAsset(
  minterAddress: string,
  metadataUri: string,
  name: string,
): Promise<string> {
  const { createUmi } = await import('@metaplex-foundation/umi-bundle-defaults');
  const { mplCore, createV1 } = await import('@metaplex-foundation/mpl-core');
  const { keypairIdentity, generateSigner, publicKey: umiPk } =
    await import('@metaplex-foundation/umi');
  const { fromWeb3JsKeypair } = await import('@metaplex-foundation/umi-web3js-adapters');

  const keeperKp = loadKeeperKp();
  if (!keeperKp) throw new Error('KEEPER_PRIVATE_KEY not set — cannot mint on-chain asset');

  const umi = createUmi(RPC)
    .use(mplCore())
    .use(keypairIdentity(fromWeb3JsKeypair(keeperKp)));
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

  if (!momentId || !minter) {
    return NextResponse.json({ error: 'Missing momentId or minter' }, { status: 400 });
  }

  const moment = await (db as any).moment.findUnique({ where: { id: momentId } });
  if (!moment) return NextResponse.json({ error: 'Moment not found' }, { status: 404 });

  const nowSec = Math.floor(Date.now() / 1000);
  if (moment.status !== 'OPEN' || nowSec > moment.closeTs) {
    return NextResponse.json({ error: 'Minting window is closed' }, { status: 409 });
  }

  // ── 중복 방지 (작업 1) — mintCoreAsset 이전에 확인 ───────────────────
  const dupCheck = await (db as any).mint.findFirst({
    where: {
      OR: [
        { momentId, minterPubkey: minter },
        ...(txSig ? [{ txSig }] : []),
      ],
    },
  });
  if (dupCheck) {
    return NextResponse.json({ error: 'Already minted', mint: dupCheck }, { status: 409 });
  }

  // ── On-chain 검증 정책 (작업 2) ──────────────────────────────────────
  // momentPda가 있고 on-chain window가 성공했으면 txSig 검증 필요.
  // momentPda 없거나 onchainStatus='FAILED'면 DB 검증만으로 진행.
  const needsOnchainVerify =
    Boolean(moment.momentPda) && moment.onchainStatus !== 'FAILED';

  if (needsOnchainVerify) {
    if (!txSig || txSig.startsWith('offline-') || txSig.startsWith('pending-')) {
      return NextResponse.json(
        { error: 'On-chain txSig required for this moment' },
        { status: 400 },
      );
    }
    const txOk = await verifyTx(txSig);
    if (!txOk) {
      return NextResponse.json(
        { error: 'Transaction not found or did not call Momento program' },
        { status: 400 },
      );
    }
  }

  // ── 서버사이드 NFT 발행 ───────────────────────────────────────────────
  let assetId = `no-keeper-key-${Date.now()}`;
  try {
    const nftName =
      moment.kind === 'GOAL'
        ? `Momento Goal #${moment.id}`
        : `Momento Result #${moment.id}`;
    assetId = await mintCoreAsset(minter, moment.metadataUrl ?? '', nftName);
  } catch (err: any) {
    console.error('[mint] Server-side NFT creation failed:', err.message);
  }

  // ── DB 기록 — unique 위반(P2002)도 409로 처리(race condition 대비) ────
  try {
    const mint = await (db as any).mint.create({
      data: {
        momentId,
        minterPubkey: minter,
        assetId,
        txSig: txSig ?? `no-tx-${Date.now()}`,
        createdAt: nowSec,
      },
    });
    return NextResponse.json({ mint, assetId });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Already minted (race)' }, { status: 409 });
    }
    throw err;
  }
}
