/**
 * P1 — Raw TxLINE SSE capture script.
 * Connects to the scores stream WITHOUT schema parsing and logs raw JSON
 * events to ./captured-events.jsonl for schema verification.
 *
 * Usage:
 *   ts-node src/scripts/capture.ts
 *
 * Stops after MAX_EVENTS events or TIMEOUT_MS, whichever comes first.
 * Output: apps/keeper/captured-events.jsonl (one JSON object per line)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const EventSource = require('eventsource') as any;
import { getGuestJwt } from '@momento/txline';

const TXLINE_API_ORIGIN = process.env.TXLINE_API_ORIGIN ?? 'https://txline-dev.txodds.com';
const TXLINE_API_TOKEN  = process.env.TXLINE_API_TOKEN  ?? '';
const MAX_EVENTS  = Number(process.env.CAPTURE_MAX ?? 20);
const TIMEOUT_MS  = Number(process.env.CAPTURE_TIMEOUT_MS ?? 120_000); // 2 min

const OUT_FILE = path.resolve(__dirname, '../../captured-events.jsonl');

async function main() {
  console.log(`[capture] Connecting to ${TXLINE_API_ORIGIN}/api/scores/stream`);
  console.log(`[capture] Will log up to ${MAX_EVENTS} events → ${OUT_FILE}`);

  const jwt = await getGuestJwt(TXLINE_API_ORIGIN);
  const url = `${TXLINE_API_ORIGIN}/api/scores/stream`;

  const out = fs.createWriteStream(OUT_FILE, { flags: 'w' });
  let count = 0;

  const es = new EventSource(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Api-Token': TXLINE_API_TOKEN,
      Accept: 'text/event-stream',
    },
  } as any);

  const stop = () => {
    es.close();
    out.end();
    console.log(`[capture] Done — ${count} events written to ${OUT_FILE}`);
    process.exit(0);
  };

  es.onmessage = (raw: any) => {
    let json: unknown;
    try { json = JSON.parse(raw.data as string); } catch { return; }

    const line = JSON.stringify(json);
    out.write(line + '\n');
    count++;
    console.log(`[capture] #${count} Action=${(json as any)?.Action ?? '?'} FixtureId=${(json as any)?.FixtureId ?? '?'}`);
    console.log('  raw:', line.slice(0, 200));

    if (count >= MAX_EVENTS) stop();
  };

  es.onerror = (err: Event) => {
    console.error('[capture] SSE error:', err);
  };

  setTimeout(stop, TIMEOUT_MS);
  console.log(`[capture] Listening (timeout ${TIMEOUT_MS / 1000}s)…`);
}

main().catch((err) => { console.error(err); process.exit(1); });
