/**
 * MVP mint endpoint: records the mint in DB.
 * Phase 3: will verify on-chain time window and create mpl-core asset.
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

export async function POST(req: NextRequest) {
  const { momentId, minter } = await req.json();

  if (!momentId || !minter) {
    return NextResponse.json({ error: 'Missing momentId or minter' }, { status: 400 });
  }

  const moment = await (db as any).moment.findUnique({ where: { id: momentId } });
  if (!moment) return NextResponse.json({ error: 'Moment not found' }, { status: 404 });

  const nowSec = Math.floor(Date.now() / 1000);
  if (moment.status !== 'OPEN' || nowSec > moment.closeTs) {
    return NextResponse.json({ error: 'Minting window is closed' }, { status: 409 });
  }

  // TODO Phase 3: build and send mint_moment anchor tx, get assetId from tx
  const assetId = `pending-${Date.now()}`;
  const txSig = `simulated-${Date.now()}`;

  const mint = await (db as any).mint.create({
    data: {
      momentId,
      minterPubkey: minter,
      assetId,
      txSig,
      createdAt: nowSec,
    },
  });

  return NextResponse.json({ mint });
}
