/**
 * Momento Keeper — Phase 4 pipeline entry point.
 * SSE → parse → resolve → image → DB → (on-chain window)
 */
import 'dotenv/config';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { TxLineClient, createScoresStream, getGuestJwt } from '@momento/txline';
import type { TxLineSseEvent } from '@momento/shared';
import { parseEvent, isVarCancel } from './parser';
import { resolveFixture, resolvePlayer } from './resolve';
import { openGoalWindow, openResultWindow, voidMoment } from './mintWindow';
import { replay, DEMO_EVENTS } from './replay';

const {
  TXLINE_API_ORIGIN = 'https://txline-dev.txodds.com',
  TXLINE_API_TOKEN = '',
  KEEPER_WALLET_PATH = './devnet-keeper.json',
  PUBLIC_BASE_URL = 'http://localhost:3000',
  REPLAY_MODE = '',
} = process.env;

const db = new PrismaClient();

async function main() {
  console.log('=== Momento Keeper starting ===');

  // Load wallet
  const raw = fs.readFileSync(path.resolve(KEEPER_WALLET_PATH));
  const secretKey = Uint8Array.from(JSON.parse(raw.toString()));
  const keypair = anchor.web3.Keypair.fromSecretKey(secretKey);
  console.log(`Keeper wallet: ${keypair.publicKey.toBase58()}`);

  // Auth
  const jwt = await getGuestJwt(TXLINE_API_ORIGIN);
  const client = new TxLineClient(TXLINE_API_ORIGIN, jwt, TXLINE_API_TOKEN);

  const handleEvent = async (raw: TxLineSseEvent) => {
    try {
      // VAR cancel check
      if (isVarCancel(raw)) {
        await voidMoment(db, raw.fixtureId, raw.seq);
        return;
      }

      const event = parseEvent(raw);
      if (!event) return;

      const fixture = await resolveFixture(client, event.fixtureId);

      if (event.type === 'GOAL') {
        const player = await resolvePlayer(client, event.fixtureId, event.playerId);
        event.playerName = player.name;
        await openGoalWindow(db, event, fixture, player.name, player.number ?? '?', PUBLIC_BASE_URL);
      } else if (event.type === 'RESULT') {
        await openResultWindow(db, event, fixture, PUBLIC_BASE_URL);
      }
    } catch (err) {
      console.error('[keeper] Error handling event:', err);
    }
  };

  if (REPLAY_MODE === '1') {
    console.log('Running in REPLAY mode...');
    await replay(DEMO_EVENTS, handleEvent, { speedMultiplier: 1 });
  } else {
    console.log('Connecting to TxLINE SSE...');
    const stop = createScoresStream(client, handleEvent, (err) => {
      console.error('[keeper] Stream error:', err);
    });

    process.on('SIGINT', () => { stop(); db.$disconnect(); process.exit(0); });
    process.on('SIGTERM', () => { stop(); db.$disconnect(); process.exit(0); });

    console.log('Keeper running. Press Ctrl+C to stop.');
    await new Promise(() => {}); // keep alive
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
