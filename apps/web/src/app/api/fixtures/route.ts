import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const db = new PrismaClient();

export async function GET() {
  const fixtures = await (db as any).fixture.findMany({
    orderBy: { kickoffTs: 'asc' },
    include: {
      moments: {
        orderBy: { tsEvent: 'desc' },
        take: 20,
      },
    },
  });
  return NextResponse.json(fixtures);
}
