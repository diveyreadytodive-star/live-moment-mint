import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';



export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status');
  const where = status ? { status } : {};

  const moments = await (db as any).moment.findMany({
    where,
    orderBy: { tsEvent: 'desc' },
    take: 50,
  });

  return NextResponse.json(moments);
}
