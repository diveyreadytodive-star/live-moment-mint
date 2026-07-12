/**
 * Opens (and voids) minting windows — Phase 4 keeper integration.
 * For MVP: records in DB + will call Anchor program once deployed.
 */
import type { PrismaClient } from '@prisma/client';
import type { GoalEvent, ResultEvent, Fixture } from '@momento/shared';
import { renderGoalPng, renderResultPng } from '@momento/image';
import fs from 'fs';
import path from 'path';

const GOAL_WINDOW_SECS = 5 * 60;   // 5 min
const RESULT_WINDOW_SECS = 10 * 60; // 10 min

// Track processed seqs to prevent duplicates (3.4 idempotency)
const processedSeqs = new Set<string>();

export async function openGoalWindow(
  db: PrismaClient,
  event: GoalEvent,
  fixture: Fixture,
  playerName: string,
  playerNumber: string,
  publicBaseUrl: string,
): Promise<number | null> {
  const key = `${event.fixtureId}:${event.seq}`;
  if (processedSeqs.has(key)) {
    console.log(`[mintWindow] Duplicate seq skipped: ${key}`);
    return null;
  }
  processedSeqs.add(key);

  const nowSec = Math.floor(Date.now() / 1000);
  const openTs = nowSec;
  const closeTs = nowSec + GOAL_WINDOW_SECS;

  // Determine scoring team color
  const scoringParticipant = event.participantScoredId === '1' ? '1' : '2';
  const scorerColor = scoringParticipant === '1' ? fixture.p1Color : fixture.p2Color;

  // Generate image
  const pngBuffer = renderGoalPng({
    p1Name: fixture.p1Name,
    p2Name: fixture.p2Name,
    p1Color: fixture.p1Color,
    p2Color: fixture.p2Color,
    scorerName: playerName,
    scorerNumber: playerNumber,
    minute: event.minute,
    scoreP1: event.scoreP1,
    scoreP2: event.scoreP2,
    isPenalty: event.isPenalty,
    isOwnGoal: event.isOwnGoal,
  });

  // Save image locally (in prod: upload to IPFS or serve via Next.js API)
  const imgDir = path.resolve(process.cwd(), '../../apps/web/public/moments');
  fs.mkdirSync(imgDir, { recursive: true });
  const imgFilename = `${event.fixtureId}-${event.seq}-goal.png`;
  fs.writeFileSync(path.join(imgDir, imgFilename), pngBuffer);
  const imageUrl = `${publicBaseUrl}/moments/${imgFilename}`;

  // Build metadata JSON
  const metadata = {
    name: `${playerName} Goal — ${event.minute}'`,
    description: `${fixture.p1Name} ${event.scoreP1}–${event.scoreP2} ${fixture.p2Name}`,
    image: imageUrl,
    attributes: [
      { trait_type: 'fixture', value: event.fixtureId },
      { trait_type: 'kind', value: 'GOAL' },
      { trait_type: 'scorer', value: playerName },
      { trait_type: 'minute', value: event.minute },
      { trait_type: 'score', value: `${event.scoreP1}-${event.scoreP2}` },
      { trait_type: 'penalty', value: event.isPenalty },
      { trait_type: 'own_goal', value: event.isOwnGoal },
    ],
  };
  const metaFilename = `${event.fixtureId}-${event.seq}-goal.json`;
  const metaDir = path.resolve(process.cwd(), '../../apps/web/public/metadata');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, metaFilename), JSON.stringify(metadata, null, 2));
  const metadataUrl = `${publicBaseUrl}/metadata/${metaFilename}`;

  // Persist to DB
  const moment = await (db as any).moment.create({
    data: {
      fixtureId: event.fixtureId,
      kind: 'GOAL',
      seq: event.seq,
      tsEvent: event.ts,
      teamScorerId: event.participantScoredId,
      playerId: event.playerId,
      playerName,
      minute: event.minute,
      scoreP1: event.scoreP1,
      scoreP2: event.scoreP2,
      imageUrl,
      metadataUrl,
      status: 'OPEN',
      openTs,
      closeTs,
    },
  });

  console.log(`[mintWindow] GOAL window opened: id=${moment.id} closes=${new Date(closeTs * 1000).toISOString()}`);

  // TODO (Phase 3): call Anchor program open_moment_window here
  // await onChainOpenWindow(moment.id, openTs, closeTs, 'GOAL', metadataUrl);

  return moment.id;
}

export async function openResultWindow(
  db: PrismaClient,
  event: ResultEvent,
  fixture: Fixture,
  publicBaseUrl: string,
): Promise<number | null> {
  const key = `${event.fixtureId}:${event.seq}:result`;
  if (processedSeqs.has(key)) return null;
  processedSeqs.add(key);

  const nowSec = Math.floor(Date.now() / 1000);
  const openTs = nowSec;
  const closeTs = nowSec + RESULT_WINDOW_SECS;

  const isDraw = event.winnerParticipantId === undefined;
  const winnerName = event.winnerParticipantId === '1' ? fixture.p1Name
    : event.winnerParticipantId === '2' ? fixture.p2Name
    : undefined;
  const winnerColor = event.winnerParticipantId === '1' ? fixture.p1Color
    : event.winnerParticipantId === '2' ? fixture.p2Color
    : undefined;

  const pngBuffer = renderResultPng({
    p1Name: fixture.p1Name,
    p2Name: fixture.p2Name,
    p1Color: fixture.p1Color,
    p2Color: fixture.p2Color,
    scoreP1: event.scoreP1,
    scoreP2: event.scoreP2,
    isDraw,
    winnerName,
    winnerColor,
    seed: event.seq,
  });

  const imgDir = path.resolve(process.cwd(), '../../apps/web/public/moments');
  fs.mkdirSync(imgDir, { recursive: true });
  const imgFilename = `${event.fixtureId}-${event.seq}-result.png`;
  fs.writeFileSync(path.join(imgDir, imgFilename), pngBuffer);
  const imageUrl = `${publicBaseUrl}/moments/${imgFilename}`;

  const metadata = {
    name: isDraw ? `DRAW — ${fixture.p1Name} vs ${fixture.p2Name}` : `${winnerName} WIN`,
    description: `Final: ${fixture.p1Name} ${event.scoreP1}–${event.scoreP2} ${fixture.p2Name}`,
    image: imageUrl,
    attributes: [
      { trait_type: 'fixture', value: event.fixtureId },
      { trait_type: 'kind', value: 'RESULT' },
      { trait_type: 'score', value: `${event.scoreP1}-${event.scoreP2}` },
      { trait_type: 'draw', value: isDraw },
      { trait_type: 'winner', value: winnerName ?? 'DRAW' },
    ],
  };
  const metaFilename = `${event.fixtureId}-${event.seq}-result.json`;
  const metaDir = path.resolve(process.cwd(), '../../apps/web/public/metadata');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, metaFilename), JSON.stringify(metadata, null, 2));
  const metadataUrl = `${publicBaseUrl}/metadata/${metaFilename}`;

  const moment = await (db as any).moment.create({
    data: {
      fixtureId: event.fixtureId,
      kind: 'RESULT',
      seq: event.seq,
      tsEvent: event.ts,
      scoreP1: event.scoreP1,
      scoreP2: event.scoreP2,
      imageUrl,
      metadataUrl,
      status: 'OPEN',
      openTs,
      closeTs,
    },
  });

  console.log(`[mintWindow] RESULT window opened: id=${moment.id}`);
  return moment.id;
}

export async function voidMoment(db: PrismaClient, fixtureId: string, seq: number) {
  await (db as any).moment.updateMany({
    where: { fixtureId, seq },
    data: { status: 'VOID' },
  });
  console.log(`[mintWindow] Voided moment fixtureId=${fixtureId} seq=${seq}`);
  // TODO: call on-chain void_moment
}
