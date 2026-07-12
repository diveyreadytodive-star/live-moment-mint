/**
 * Server-Sent Events feed for the web client.
 * Keeper pushes MOMENT_OPENED / MOMENT_CLOSED via HTTP to /api/feed/push,
 * and this endpoint streams them to browsers.
 */
import { NextRequest } from 'next/server';

// In-process subscriber set (works for single-instance; use Supabase Realtime for multi-pod)
const clients = new Set<(msg: string) => void>();

export function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const send = (msg: string) => {
        controller.enqueue(`data: ${msg}\n\n`);
      };
      clients.add(send);

      // Heartbeat every 20s
      const heartbeat = setInterval(() => {
        try { controller.enqueue(': heartbeat\n\n'); } catch {}
      }, 20_000);

      return () => {
        clearInterval(heartbeat);
        clients.delete(send);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/** Internal: keeper calls this to broadcast to all SSE clients */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.INTERNAL_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = await req.text();
  clients.forEach((send) => send(body));
  return new Response('ok');
}
