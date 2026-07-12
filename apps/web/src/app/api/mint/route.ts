import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

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

  const mint = await (db as any).mint.create({
    data: {
      momentId,
      minterPubkey: minter,
      assetId: txSig ?? `pending-${Date.now()}`,
      txSig: txSig ?? `pending-${Date.now()}`,
      createdAt: nowSec,
    },
  });

  return NextResponse.json({ mint });
}
