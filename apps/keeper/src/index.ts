/**
 * Momento Keeper — SSE → parse → resolve → image → DB
 */
import 'dotenv/config';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { TxLineClient, createScoresStream, getGuestJwt } from '@momento/txline';
import type { TxLineSseEvent } from '@momento/shared';
import { parseEvent, isVarCancel } from './parser';
import { resolveFixture, seedFixture } from './resolve';
import { openGoalWindow, openResultWindow, voidMoment, updateFixtureScore } from './mintWindow';
import { replay, DEMO_EVENTS } from './replay';

const {
  TXLINE_API_ORIGIN  = 'https://txline-dev.txodds.com',
  TXLINE_API_TOKEN   = '',
  KEEPER_WALLET_PATH = './devnet-keeper.json',
  PUBLIC_BASE_URL    = 'http://localhost:3000',
  REPLAY_MODE        = '',
} = process.env;

const WORLD_CUP_COMPETITION_ID = 72;

const DEFAULT_COLORS: Record<string, string> = {
  '1489': '#75aadb', // Argentina
  '3099': '#d52b1e', // Switzerland
  '1999': '#002395', // France
  '3021': '#c60b1e', // Spain
  '1888': '#012169', // England
};

const db = new PrismaClient();

// Demo fixture definition (used in replay mode)
const DEMO_FIXTURE = {
  id:       'demo-001',
  p1Id:     '1489',
  p2Id:     '3099',
  p1Name:   'Argentina',
  p2Name:   'Switzerland',
  p1IsHome: true,
  p1Color:  '#75aadb',
  p2Color:  '#d52b1e',
  kickoffTs: Math.floor(Date.now() / 1000),
};

async function main() {
  console.log('=== Momento Keeper starting ===');

  const raw = fs.readFileSync(path.resolve(KEEPER_WALLET_PATH));
  const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw.toString())));
  console.log(`Keeper wallet: ${keypair.publicKey.toBase58()}`);

  const jwt = await getGuestJwt(TXLINE_API_ORIGIN);
  const client = new TxLineClient(TXLINE_API_ORIGIN, jwt, TXLINE_API_TOKEN);

  const handleEvent = async (raw: TxLineSseEvent) => {
    try {
      // Always upsert live score for every event that carries score data
      if (raw.Score && raw.StatusId !== undefined) {
        const sp1 = raw.Score.Participant1?.Total?.Goals ?? 0;
        const sp2 = raw.Score.Participant2?.Total?.Goals ?? 0;
        const minute = raw.Clock?.Seconds != null ? Math.floor(raw.Clock.Seconds / 60) : null;
        await updateFixtureScore(db, raw.FixtureId, sp1, sp2, minute, raw.StatusId);
      }

      if (isVarCancel(raw)) {
        await voidMoment(db, raw.FixtureId, raw.Seq);
        return;
      }

      const event = parseEvent(raw);
      if (!event) return;

      const fixture = await resolveFixture(client, event.fixtureId);

      if (event.type === 'GOAL') {
        await openGoalWindow(db, event, fixture, PUBLIC_BASE_URL);
      } else if (event.type === 'RESULT') {
        await openResultWindow(db, event, fixture, PUBLIC_BASE_URL);
      }
    } catch (err) {
      console.error('[keeper] Error:', err);
    }
  };

  // Seed World Cup fixtures into DB
  const allFixtures = await client.getFixturesSnapshot();
  const wcFixtures = allFixtures.filter((f: any) => f.CompetitionId === WORLD_CUP_COMPETITION_ID);
  console.log(`[keeper] Found ${wcFixtures.length} World Cup fixtures`);
  for (const f of wcFixtures) {
    const p1Id = String(f.Participant1Id);
    const p2Id = String(f.Participant2Id);
    const fixture = {
      id:        String(f.FixtureId),
      p1Id,
      p2Id,
      p1Name:    f.Participant1 ?? 'Team 1',
      p2Name:    f.Participant2 ?? 'Team 2',
      p1IsHome:  f.Participant1IsHome ?? true,
      p1Color:   DEFAULT_COLORS[p1Id] ?? '#1a56db',
      p2Color:   DEFAULT_COLORS[p2Id] ?? '#e02424',
      kickoffTs: Math.floor((f.StartTime ?? 0) / 1000),
    };
    await (db as any).fixture.upsert({ where: { id: fixture.id }, update: fixture, create: fixture });
    seedFixture(fixture);
    console.log(`[keeper] Seeded fixture ${fixture.id}: ${fixture.p1Name} vs ${fixture.p2Name}`);
  }

  if (REPLAY_MODE === '1') {
    console.log('REPLAY mode: demo events (Argentina 2-1 Switzerland)');
    // Seed fixture into cache + DB so resolveFixture works without API call
    seedFixture(DEMO_FIXTURE);
    await (db as any).fixture.upsert({
      where:  { id: DEMO_FIXTURE.id },
      update: {},
      create: DEMO_FIXTURE,
    });
    await replay(DEMO_EVENTS, handleEvent, { speedMultiplier: 5 });
    console.log('✅ Replay complete.');
  } else {
    console.log('Live mode: connecting to TxLINE SSE...');
    const stop = createScoresStream(client, handleEvent, (err) => {
      console.error('[keeper] Stream error:', err);
    });
    process.on('SIGINT',  () => { stop(); db.$disconnect(); process.exit(0); });
    process.on('SIGTERM', () => { stop(); db.$disconnect(); process.exit(0); });
    console.log('Listening. Ctrl+C to stop.');
    await new Promise(() => {});
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
