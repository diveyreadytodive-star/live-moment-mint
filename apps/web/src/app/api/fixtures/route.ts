import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';



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
