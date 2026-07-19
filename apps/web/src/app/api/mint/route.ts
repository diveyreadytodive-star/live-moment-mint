import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Connection } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';

const PROGRAM_ID = 'CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja';
const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

/**
 * Verifies the on-chain mint_moment transaction. All conditions must hold:
 *  1. The transaction succeeded (no error) and called the Momento program.
 *  2. `minter` is an actual signer of the transaction.
 *  3. `momentPda` appears in the account list (proves this tx targeted this moment).
 *  4. When `assetAddress` is supplied, it must appear as a signer in the tx
 *     (proves the new Metaplex Core asset was created in this same transaction).
 *
 * Returns { ok, asset } — `asset` is the confirmed on-chain NFT address, or null.
 */
async function verifyTx(
  txSig: string,
  minter: string,
  momentPda: string | null,
  assetAddress: string | null,
): Promise<{ ok: boolean; asset: string | null }> {
  try {
    const conn = new Connection(RPC, 'confirmed');
    const tx = await conn.getParsedTransaction(txSig, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx || tx.meta?.err) return { ok: false, asset: null };

    const accounts = tx.transaction.message.accountKeys;

    // 1. Program must be in the account list
    const hasProgram = accounts.some((k) => k.pubkey.toBase58() === PROGRAM_ID);
    if (!hasProgram) return { ok: false, asset: null };

    // 2. minter must be an actual signer of this transaction
    const minterIsSigner = accounts.some(
      (k) => k.pubkey.toBase58() === minter && k.signer,
    );
    if (!minterIsSigner) return { ok: false, asset: null };

    // 3. momentPda must appear in the account list
    if (momentPda) {
      const hasPda = accounts.some((k) => k.pubkey.toBase58() === momentPda);
      if (!hasPda) return { ok: false, asset: null };
    }

    // 4. asset (the freshly created Core NFT) must be a signer in this tx
    if (assetAddress) {
      const assetIsSigner = accounts.some(
        (k) => k.pubkey.toBase58() === assetAddress && k.signer,
      );
      if (!assetIsSigner) return { ok: false, asset: null };
    }

    return { ok: true, asset: assetAddress };
  } catch {
    return { ok: false, asset: null };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { momentId, minter, txSig, assetAddress, messageSignature, messageTs } = body;

  if (!momentId || !minter) {
    return NextResponse.json({ error: 'Missing momentId or minter' }, { status: 400 });
  }

  const moment = await (db as any).moment.findUnique({ where: { id: momentId } });
  if (!moment) return NextResponse.json({ error: 'Moment not found' }, { status: 404 });

  const nowSec = Math.floor(Date.now() / 1000);
  if (moment.status !== 'OPEN' || nowSec > moment.closeTs) {
    return NextResponse.json({ error: 'Minting window is closed' }, { status: 409 });
  }

  // ── 예측 보상 NFT 게이팅 ──────────────────────────────────────────────
  if (moment.isPredictionReward) {
    const prediction = await (db as any).prediction.findUnique({
      where: { fixtureId_wallet: { fixtureId: moment.fixtureId, wallet: minter } },
    });
    if (!prediction) {
      return NextResponse.json(
        { error: 'This NFT is only for users who predicted this match' },
        { status: 403 },
      );
    }
    if (prediction.outcome !== moment.predictionOutcome) {
      return NextResponse.json(
        { error: `Incorrect prediction — you predicted ${prediction.outcome}` },
        { status: 403 },
      );
    }
  }

  // ── 중복 방지 — mintCoreAsset 이전에 확인 ─────────────────────────────
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

  // ── 인증 정책 ───────────────────────────────────────────────────────────
  // momentPda가 있고 onchainStatus가 FAILED가 아니면 온체인 txSig 검증 필요.
  // 그 외에는 오프체인 메시지 서명으로 지갑 소유를 증명해야 함.
  const needsOnchainVerify =
    Boolean(moment.momentPda) && moment.onchainStatus !== 'FAILED';

  // Holds the on-chain NFT asset address once verified (on-chain path only).
  let onchainAsset: string | null = null;

  if (needsOnchainVerify) {
    if (!txSig || txSig.startsWith('offline-') || txSig.startsWith('pending-')) {
      return NextResponse.json(
        { error: 'On-chain txSig required for this moment' },
        { status: 400 },
      );
    }
    if (!assetAddress) {
      return NextResponse.json(
        { error: 'assetAddress required for on-chain mint' },
        { status: 400 },
      );
    }
    const { ok, asset } = await verifyTx(txSig, minter, moment.momentPda, assetAddress);
    if (!ok) {
      return NextResponse.json(
        { error: 'Transaction verification failed: invalid signer, asset, PDA, or program' },
        { status: 400 },
      );
    }
    onchainAsset = asset;
  } else {
    // DB-only path: require an off-chain wallet message signature
    if (!messageSignature || !messageTs) {
      return NextResponse.json({ error: 'Wallet signature required' }, { status: 400 });
    }
    if (Math.abs(nowSec - Number(messageTs)) > 120) {
      return NextResponse.json({ error: 'Signature expired, retry' }, { status: 400 });
    }
    const message = `Momento mint authorization\nmoment:${momentId}\nwallet:${minter}\nts:${messageTs}`;
    const messageBytes = new TextEncoder().encode(message);
    let sigValid = false;
    try {
      const minterPubkeyBytes = bs58.decode(minter);
      const sigBytes = bs58.decode(messageSignature);
      sigValid = nacl.sign.detached.verify(messageBytes, sigBytes, minterPubkeyBytes);
    } catch {
      sigValid = false;
    }
    if (!sigValid) {
      return NextResponse.json({ error: 'Invalid wallet signature' }, { status: 401 });
    }
  }

  // ── NFT asset id 결정 ────────────────────────────────────────────────
  // 온체인 경로: mint_moment ix가 이미 지갑 트랜잭션 안에서 Metaplex Core
  //   asset을 생성함. 서버는 그 asset 주소를 검증 후 그대로 기록한다.
  //   (서버가 별도로 토큰을 발행하지 않음 — 진짜 온체인 민팅.)
  // DB-only 경로: momentPda가 없거나 온체인 open이 실패한 moment. 메시지
  //   서명으로 지갑 소유만 증명하고 오프체인 컬렉션 레코드로 남긴다.
  const assetId = onchainAsset
    ? onchainAsset
    : `db-${moment.id}-${minter.slice(0, 8)}-${Date.now()}`;

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
