import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';

// ── GET /api/predictions?fixtureId=X&wallet=Y ─────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fixtureId = searchParams.get('fixtureId');
  const wallet    = searchParams.get('wallet');
  if (!fixtureId || !wallet) {
    return NextResponse.json({ error: 'fixtureId and wallet required' }, { status: 400 });
  }

  const prediction = await (db as any).prediction.findUnique({
    where: { fixtureId_wallet: { fixtureId, wallet } },
  });

  // Also return the fixture's determined outcome so the client can tell if the prediction was correct
  const fixture = await (db as any).fixture.findUnique({
    where: { id: fixtureId },
    select: { liveScoreP1: true, liveScoreP2: true, statusId: true },
  });

  let fixtureOutcome: string | null = null;
  if (fixture && (fixture.statusId ?? 0) >= 100) {
    const s1 = fixture.liveScoreP1 ?? 0;
    const s2 = fixture.liveScoreP2 ?? 0;
    if (s1 > s2)      fixtureOutcome = 'HOME';
    else if (s2 > s1) fixtureOutcome = 'AWAY';
    else              fixtureOutcome = 'DRAW';
  }

  return NextResponse.json({ prediction, fixtureOutcome });
}

// ── POST /api/predictions ───���─────────────────��───────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fixtureId, outcome, wallet, messageSignature, messageTs } = body;

  if (!fixtureId || !outcome || !wallet || !messageSignature || !messageTs) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!['HOME', 'DRAW', 'AWAY'].includes(outcome)) {
    return NextResponse.json({ error: 'outcome must be HOME, DRAW, or AWAY' }, { status: 400 });
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Signature freshness check (2 min window)
  if (Math.abs(nowSec - Number(messageTs)) > 120) {
    return NextResponse.json({ error: 'Signature expired, retry' }, { status: 400 });
  }

  // Verify wallet ownership via off-chain message signature
  const message = `Momento prediction\nfixture:${fixtureId}\noutcome:${outcome}\nwallet:${wallet}\nts:${messageTs}`;
  let sigValid = false;
  try {
    const pubkeyBytes = bs58.decode(wallet);
    const sigBytes    = bs58.decode(messageSignature);
    sigValid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      sigBytes,
      pubkeyBytes,
    );
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return NextResponse.json({ error: 'Invalid wallet signature' }, { status: 401 });
  }

  // Check fixture exists and prediction window is open (before kickoff + 15 min grace)
  const fixture = await (db as any).fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) {
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
  }
  // Allow predictions until kickoff + 15 minutes
  const predictionDeadline = fixture.kickoffTs + 15 * 60;
  if (nowSec > predictionDeadline) {
    return NextResponse.json({ error: 'Prediction window is closed' }, { status: 409 });
  }

  const prediction = await (db as any).prediction.upsert({
    where: { fixtureId_wallet: { fixtureId, wallet } },
    update: { outcome, createdAt: nowSec },
    create: { fixtureId, wallet, outcome, createdAt: nowSec },
  });

  return NextResponse.json({ prediction });
}
