import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const db = new PrismaClient();

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } },
) {
  const moment = await (db as any).moment.findUnique({
    where: { id: Number(params.id) },
    select: { imageData: true },
  });
  if (!moment?.imageData) {
    return new NextResponse('Not found', { status: 404 });
  }
  return new NextResponse(moment.imageData, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
