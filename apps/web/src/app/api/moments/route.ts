import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

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
