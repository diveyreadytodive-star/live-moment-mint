import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';



export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet param required' }, { status: 400 });

  const mints = await (db as any).mint.findMany({
    where: { minterPubkey: wallet },
    include: {
      moment: {
        select: {
          kind: true, scoreP1: true, scoreP2: true,
          minute: true, fixtureId: true, imageUrl: true, status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(mints);
}
