import EventSource from 'eventsource';
import { TxLineSseEventSchema, type TxLineSseEvent } from '@momento/shared';
import type { TxLineClient } from './client';

type EventHandler = (event: TxLineSseEvent) => void;
type ErrorHandler = (err: Error) => void;

export function createScoresStream(
  client: TxLineClient,
  onEvent: EventHandler,
  onError?: ErrorHandler,
): () => void {
  const url = `${client.origin}/api/scores/stream`;

  let es: EventSource | null = null;
  let closed = false;

  function connect() {
    if (closed) return;

    es = new EventSource(url, {
      headers: {
        ...client.getHeaders(),
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    } as any);

    es.onmessage = (raw) => {
      try {
        const json = JSON.parse(raw.data);
        const parsed = TxLineSseEventSchema.safeParse(json);
        if (parsed.success) {
          onEvent(parsed.data);
        }
      } catch {
        // non-JSON heartbeat
      }
    };

    es.onerror = (err) => {
      console.error('[stream] SSE error, reconnecting in 5s', err);
      onError?.(new Error('SSE connection error'));
      es?.close();
      if (!closed) setTimeout(connect, 5000);
    };
  }

  connect();

  return () => {
    closed = true;
    es?.close();
  };
}
