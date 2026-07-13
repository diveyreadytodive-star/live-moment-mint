import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';



export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } },
) {
  const moment = await (db as any).moment.findUnique({
    where: { id: Number(params.id) },
    include: { mints: true },
  });
  if (!moment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(moment);
}
