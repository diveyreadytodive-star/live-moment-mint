/**
 * Momento Keeper — multi-league daemon
 *
 * On startup:
 *  1. Sync all fixtures from football-data.org (PL, La Liga, BL1, SA, FL1, CL, WC, EC)
 *  2. Connect TxLine SSE → match TxLine IDs to DB fixtures
 *  3. Process live events (goal → open minting window)
 *
 * Re-syncs football-data.org every SYNC_INTERVAL_MS (default 6h) for updated results.
 */
import 'dotenv/config';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { TxLineClient, createScoresStream, getGuestJwt } from '@momento/txline';
import type { TxLineSseEvent } from '@momento/shared';
import { parseEvent, isVarCancel } from './parser';
import { resolveFixtureByTxlineId, seedFixture } from './resolve';
import { openGoalWindow, openResultWindow, voidMoment, updateFixtureScore } from './mintWindow';
import { replay, DEMO_EVENTS } from './replay';
import { syncAllFixtures, matchTxlineIds } from './syncFixtures';

const {
  TXLINE_API_ORIGIN    = 'https://txline-dev.txodds.com',
  TXLINE_API_TOKEN     = '',
  KEEPER_WALLET_PATH   = './devnet-keeper.json',
  PUBLIC_BASE_URL      = 'http://localhost:3000',
  REPLAY_MODE          = '',
  FOOTBALL_DATA_TOKEN  = '',
  SYNC_INTERVAL_MS     = String(6 * 60 * 60 * 1000), // 6 hours
} = process.env;

const db = new PrismaClient();

// txlineId → dbFixtureId mapping, rebuilt on every sync
let txlineToDb = new Map<string, string>();

// Demo fixture (replay mode only)
const DEMO_FIXTURE = {
  id: 'demo-001', p1Id: '1489', p2Id: '3099',
  p1Name: 'Argentina', p2Name: 'Switzerland',
  p1IsHome: true, p1Color: '#75aadb', p2Color: '#d52b1e',
  kickoffTs: Math.floor(Date.now() / 1000),
};

async function syncAndMatch(client: TxLineClient) {
  // 1. Sync all competitions from football-data.org
  await syncAllFixtures(db, FOOTBALL_DATA_TOKEN);

  // 2. Get ALL TxLine fixtures (no competition filter — handle whatever TxLine covers)
  const allFixtures = await client.getFixturesSnapshot();
  console.log(`[keeper] TxLine snapshot: ${allFixtures.length} total fixture(s)`);

  // 3. Match TxLine IDs → DB fixture IDs and seed resolve cache
  txlineToDb = await matchTxlineIds(db, allFixtures);

  for (const [, dbId] of txlineToDb) {
    const fixture = await (db as any).fixture.findUnique({ where: { id: dbId } });
    if (fixture) seedFixture(fixture);
  }
}

async function main() {
  console.log('=== Momento Keeper starting ===');

  const raw = fs.readFileSync(path.resolve(KEEPER_WALLET_PATH));
  const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw.toString())));
  console.log(`Keeper wallet: ${keypair.publicKey.toBase58()}`);

  const jwt = await getGuestJwt(TXLINE_API_ORIGIN);
  const client = new TxLineClient(TXLINE_API_ORIGIN, jwt, TXLINE_API_TOKEN);

  // ── SSE event handler ──────────────────────────────────────────────────────
  const handleEvent = async (raw: TxLineSseEvent) => {
    try {
      const txlineId = String(raw.FixtureId);
      const dbFixtureId = txlineToDb.get(txlineId) ?? txlineId;

      if (raw.Score && raw.StatusId !== undefined) {
        const sp1    = raw.Score.Participant1?.Total?.Goals ?? 0;
        const sp2    = raw.Score.Participant2?.Total?.Goals ?? 0;
        const minute = raw.Clock?.Seconds != null ? Math.floor(raw.Clock.Seconds / 60) : null;
        await updateFixtureScore(db, dbFixtureId, sp1, sp2, minute, raw.StatusId);
      }

      if (isVarCancel(raw)) {
        await voidMoment(db, dbFixtureId, raw.Seq);
        return;
      }

      const event = parseEvent(raw);
      if (!event) return;

      event.fixtureId = dbFixtureId;
      const fixture = await resolveFixtureByTxlineId(db, txlineId, dbFixtureId);

      if (event.type === 'GOAL') {
        await openGoalWindow(db, event, fixture, PUBLIC_BASE_URL);
      } else if (event.type === 'RESULT') {
        await openResultWindow(db, event, fixture, PUBLIC_BASE_URL);
      }
    } catch (err) {
      console.error('[keeper] Error:', err);
    }
  };

  if (REPLAY_MODE === '1') {
    console.log('REPLAY mode: demo events (Argentina 2-1 Switzerland)');
    seedFixture(DEMO_FIXTURE);
    await (db as any).fixture.upsert({
      where: { id: DEMO_FIXTURE.id }, update: {}, create: DEMO_FIXTURE,
    });
    txlineToDb.set('demo-001', 'demo-001');
    await replay(DEMO_EVENTS, handleEvent, { speedMultiplier: 5 });
    console.log('Replay complete.');
    return;
  }

  // ── Initial sync ──────────────────────────────────────────────────────────
  await syncAndMatch(client);

  // ── Periodic re-sync (updates results, detects new fixtures) ─────────────
  const intervalMs = Number(SYNC_INTERVAL_MS);
  setInterval(() => {
    console.log('[keeper] Periodic sync...');
    syncAndMatch(client).catch(err => console.error('[keeper] Sync error:', err));
  }, intervalMs);
  console.log(`[keeper] Will re-sync every ${intervalMs / 3600000}h`);

  // ── TxLine live SSE stream ─────────────────────────────────────────────────
  console.log('Live mode: connecting to TxLINE SSE...');
  const stop = createScoresStream(client, handleEvent, (err) => {
    console.error('[keeper] Stream error:', err);
  });

  process.on('SIGINT',  () => { stop(); db.$disconnect(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); db.$disconnect(); process.exit(0); });
  console.log('Listening for live events. Ctrl+C to stop.');
  await new Promise(() => {});
}

main().catch((err) => { console.error(err); process.exit(1); });
