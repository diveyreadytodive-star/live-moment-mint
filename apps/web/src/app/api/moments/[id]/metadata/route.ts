import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';



export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } },
) {
  const moment = await (db as any).moment.findUnique({
    where: { id: Number(params.id) },
    select: { metadataJson: true },
  });
  if (!moment?.metadataJson) {
    return new NextResponse('Not found', { status: 404 });
  }
  return new NextResponse(moment.metadataJson, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
