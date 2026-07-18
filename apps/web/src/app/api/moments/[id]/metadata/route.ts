import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const moment = await (db as any).moment.findUnique({
    where: { id: Number(params.id) },
    select: { metadataJson: true, imageUrl: true },
  });
  if (!moment?.metadataJson) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Resolve the correct base URL: PUBLIC_BASE_URL > VERCEL_URL (auto-set) > request origin
  const envBase = (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  const vercelBase = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const reqBase = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const base = envBase || vercelBase || reqBase;

  // Replace any hardcoded localhost / old base URL in the stored JSON
  const fixed = moment.metadataJson.replace(
    /https?:\/\/localhost:\d+/g,
    base,
  );

  // If imageUrl is a relative path (e.g. /moments/foo.png), patch the image field too
  let json: Record<string, any>;
  try {
    json = JSON.parse(fixed);
  } catch {
    return new NextResponse(fixed, { headers: { 'Content-Type': 'application/json' } });
  }

  if (moment.imageUrl && moment.imageUrl.startsWith('/')) {
    const absoluteImage = `${base}${moment.imageUrl}`;
    json.image = absoluteImage;
    if (json.properties?.files?.[0]) {
      json.properties.files[0].uri = absoluteImage;
    }
  }

  return NextResponse.json(json, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
