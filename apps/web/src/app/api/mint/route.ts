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
 *
 * Returns true when the on-chain mint transaction is valid.
 *
 * NOTE: the deployed program records the mint on-chain (mint_count + MintEvent)
 * but does not yet create a separate Metaplex Core asset account. When the
 * mpl-core CPI version is redeployed (see docs/REDEPLOY_GUIDE.md), extend this
 * to also verify a fresh asset signer and return its address.
 */
async function verifyTx(
  txSig: string,
  minter: string,
  momentPda: string | null,
  assetAddress: string | null,
): Promise<boolean> {
  try {
    const conn = new Connection(RPC, 'confirmed');
    const tx = await conn.getParsedTransaction(txSig, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx || tx.meta?.err) return false;

    const accounts = tx.transaction.message.accountKeys;

    // 1. Program must be in the account list
    const hasProgram = accounts.some((k) => k.pubkey.toBase58() === PROGRAM_ID);
    if (!hasProgram) return false;

    // 2. minter must be an actual signer of this transaction
    const minterIsSigner = accounts.some(
      (k) => k.pubkey.toBase58() === minter && k.signer,
    );
    if (!minterIsSigner) return false;

    // 3. momentPda must appear in the account list
    if (momentPda) {
      const hasPda = accounts.some((k) => k.pubkey.toBase58() === momentPda);
      if (!hasPda) return false;
    }

    // 4. (post-redeploy) when the client created a Metaplex Core asset, it must
    //    appear as a signer in this tx. For the current 2-account program the
    //    client sends no assetAddress and this check is skipped.
    if (assetAddress) {
      const assetIsSigner = accounts.some(
        (k) => k.pubkey.toBase58() === assetAddress && k.signer,
      );
      if (!assetIsSigner) return false;
    }

    return true;
  } catch {
    return false;
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

  // Verified on-chain mint proof: the created asset address (post-redeploy) or
  // the verified txSig (current 2-account program).
  let onchainTxSig: string | null = null;
  let onchainAsset: string | null = null;

  if (needsOnchainVerify) {
    if (!txSig || txSig.startsWith('offline-') || txSig.startsWith('pending-')) {
      return NextResponse.json(
        { error: 'On-chain txSig required for this moment' },
        { status: 400 },
      );
    }
    const ok = await verifyTx(txSig, minter, moment.momentPda, assetAddress ?? null);
    if (!ok) {
      return NextResponse.json(
        { error: 'Transaction verification failed: invalid signer, asset, PDA, or program' },
        { status: 400 },
      );
    }
    onchainTxSig = txSig;
    onchainAsset = assetAddress ?? null;
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

  // ── mint 기록 id 결정 ────────────────────────────────────────────────
  // 온체인 경로: mint_moment 트랜잭션이 검증됨. 배포된 프로그램은 mint_count를
  //   올리고 MintEvent를 emit함(별도 NFT asset 계정은 mpl-core 재배포 후 생성).
  //   여기서는 검증된 온체인 txSig를 민팅 증빙으로 기록한다 (서버 SPL 발행 없음).
  // DB-only 경로: momentPda가 없거나 온체인 open이 실패한 moment. 메시지
  //   서명으로 지갑 소유만 증명하고 오프체인 컬렉션 레코드로 남긴다.
  const assetId = onchainAsset
    ? onchainAsset
    : onchainTxSig
    ? `onchain-${moment.id}-${onchainTxSig.slice(0, 16)}`
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
