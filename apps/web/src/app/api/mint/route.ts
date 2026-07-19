import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
  AuthorityType,
} from '@solana/spl-token';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';

const PROGRAM_ID = 'CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja';
const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

function loadKeeperKp(): Keypair | null {
  const raw = process.env.KEEPER_PRIVATE_KEY;
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw.replace(/\s/g, ''))));
  } catch {
    return null;
  }
}

/**
 * Verifies that:
 *  1. The transaction succeeded and called the Momento program.
 *  2. minter is a signer in the transaction.
 *  3. momentPda (when provided) appears in the transaction's account list.
 */
async function verifyTx(
  txSig: string,
  minter: string,
  momentPda: string | null,
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

    // 3. momentPda must appear in the account list (proves this tx targeted this moment)
    if (momentPda) {
      const hasPda = accounts.some((k) => k.pubkey.toBase58() === momentPda);
      if (!hasPda) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Mints a real 1/1 SPL token NFT to the minter's wallet.
 * Uses only @solana/spl-token (no Metaplex/mpl-core dependency).
 * Returns the mint address (= the NFT's unique on-chain ID).
 */
async function mintSplNft(minterAddress: string): Promise<string> {
  const keeperKp = loadKeeperKp();
  if (!keeperKp) throw new Error('KEEPER_PRIVATE_KEY not set');

  const conn = new Connection(RPC, 'confirmed');
  const minterPubkey = new PublicKey(minterAddress);

  // 1. Create a new mint with 0 decimals, keeper is mint authority
  const mint = await createMint(conn, keeperKp, keeperKp.publicKey, null, 0);

  // 2. Create associated token account for the minter
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    conn, keeperKp, mint, minterPubkey,
  );

  // 3. Mint exactly 1 token to the minter
  await mintTo(conn, keeperKp, mint, tokenAccount.address, keeperKp, 1);

  // 4. Remove mint authority — fixed supply of 1, truly non-fungible
  await setAuthority(conn, keeperKp, mint, keeperKp, AuthorityType.MintTokens, null);

  return mint.toBase58();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { momentId, minter, txSig, messageSignature, messageTs } = body;

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

  if (needsOnchainVerify) {
    if (!txSig || txSig.startsWith('offline-') || txSig.startsWith('pending-')) {
      return NextResponse.json(
        { error: 'On-chain txSig required for this moment' },
        { status: 400 },
      );
    }
    const txOk = await verifyTx(txSig, minter, moment.momentPda);
    if (!txOk) {
      return NextResponse.json(
        { error: 'Transaction verification failed: invalid signer, PDA, or program' },
        { status: 400 },
      );
    }
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

  // ── 서버사이드 NFT 발행 (mpl-core 실패 시 DB-only로 fallback) ──────────
  let assetId: string;
  const nftName = moment.isPredictionReward
    ? `Momento Oracle #${moment.id}`
    : moment.kind === 'GOAL'
    ? `Momento Goal #${moment.id}`
    : `Momento Result #${moment.id}`;
  const base = (
    process.env.PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  ).replace(/\/$/, '');
  const metadataUri = `${base}/api/moments/${moment.id}/metadata`;
  try {
    assetId = await mintSplNft(minter);
  } catch (err: any) {
    console.error('[mint] On-chain mint failed, falling back to DB-only:', err.message);
    assetId = `db-${moment.id}-${minter.slice(0, 8)}-${Date.now()}`;
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
