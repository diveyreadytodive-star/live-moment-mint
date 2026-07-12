/**
 * Opens / voids minting windows.
 * Phase 4 keeper integration — DB + image gen.
 * Phase 3 TODO: call Anchor program on-chain.
 */
import type { PrismaClient } from '@prisma/client';
import type { GoalEvent, ResultEvent, Fixture } from '@momento/shared';
import { renderGoalPng, renderResultPng } from '@momento/image';
import fs from 'fs';
import path from 'path';

const GOAL_WINDOW_SECS   = 5 * 60;  // 5 min
const RESULT_WINDOW_SECS = 10 * 60; // 10 min

// Idempotency guard (in-process)
const processedKeys = new Set<string>();

const WEB_PUBLIC = path.resolve(__dirname, '../../../../apps/web/public');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export async function openGoalWindow(
  db: PrismaClient,
  event: GoalEvent,
  fixture: Fixture,
  publicBaseUrl: string,
): Promise<number | null> {
  const key = `goal:${event.fixtureId}:${event.seq}`;
  if (processedKeys.has(key)) {
    console.log(`[mintWindow] Skipped duplicate: ${key}`);
    return null;
  }
  processedKeys.add(key);

  const nowSec = Math.floor(Date.now() / 1000);
  const openTs  = nowSec;
  const closeTs = nowSec + GOAL_WINDOW_SECS;

  // Determine scoring team info
  const scorerTeamName  = event.scoringTeam === '1' ? fixture.p1Name : fixture.p2Name;
  const scorerColor     = event.scoringTeam === '1' ? fixture.p1Color : fixture.p2Color;

  // Generate image
  const pngBuffer = renderGoalPng({
    p1Name:      fixture.p1Name,
    p2Name:      fixture.p2Name,
    p1Color:     fixture.p1Color,
    p2Color:     fixture.p2Color,
    scorerName:  scorerTeamName,
    scorerNumber: event.scoringTeam,   // show "1" or "2" as shirt placeholder
    minute:      event.minute,
    scoreP1:     event.scoreP1,
    scoreP2:     event.scoreP2,
    isPenalty:   event.isPenalty,
    isOwnGoal:   event.isOwnGoal,
  });

  const imgDir = path.join(WEB_PUBLIC, 'moments');
  ensureDir(imgDir);
  const imgFilename  = `${event.fixtureId}-${event.seq}-goal.png`;
  fs.writeFileSync(path.join(imgDir, imgFilename), pngBuffer);
  const imageUrl = `${publicBaseUrl}/moments/${imgFilename}`;

  // Metadata JSON
  const metadata = {
    name: `${scorerTeamName} Goal — ${event.minute}'`,
    description: `${fixture.p1Name} ${event.scoreP1}–${event.scoreP2} ${fixture.p2Name}`,
    image: imageUrl,
    attributes: [
      { trait_type: 'fixture',   value: event.fixtureId },
      { trait_type: 'kind',      value: 'GOAL' },
      { trait_type: 'team',      value: scorerTeamName },
      { trait_type: 'minute',    value: event.minute },
      { trait_type: 'score',     value: `${event.scoreP1}-${event.scoreP2}` },
      { trait_type: 'goal_type', value: event.goalType || 'unknown' },
    ],
  };

  const metaDir = path.join(WEB_PUBLIC, 'metadata');
  ensureDir(metaDir);
  const metaFilename = `${event.fixtureId}-${event.seq}-goal.json`;
  fs.writeFileSync(path.join(metaDir, metaFilename), JSON.stringify(metadata, null, 2));
  const metadataUrl = `${publicBaseUrl}/metadata/${metaFilename}`;

  const moment = await (db as any).moment.create({
    data: {
      fixtureId:    event.fixtureId,
      kind:         'GOAL',
      seq:          event.seq,
      tsEvent:      Math.floor(event.ts / 1000),
      teamScorerId: event.scoringTeam,
      goalType:     event.goalType,
      minute:       event.minute,
      scoreP1:      event.scoreP1,
      scoreP2:      event.scoreP2,
      imageUrl,
      metadataUrl,
      status:       'OPEN',
      openTs,
      closeTs,
    },
  });

  console.log(`[mintWindow] GOAL opened id=${moment.id} ${fixture.p1Name} ${event.scoreP1}-${event.scoreP2} ${fixture.p2Name} ${event.minute}' closes=${new Date(closeTs * 1000).toISOString()}`);

  // TODO Phase 3: await onChainOpenWindow(moment.id, openTs, closeTs, 'GOAL', metadataUrl)

  return moment.id as number;
}

export async function openResultWindow(
  db: PrismaClient,
  event: ResultEvent,
  fixture: Fixture,
  publicBaseUrl: string,
): Promise<number | null> {
  const key = `result:${event.fixtureId}:${event.seq}`;
  if (processedKeys.has(key)) return null;
  processedKeys.add(key);

  const nowSec  = Math.floor(Date.now() / 1000);
  const openTs  = nowSec;
  const closeTs = nowSec + RESULT_WINDOW_SECS;

  const isDraw = event.winnerTeam === undefined;
  const winnerName  = event.winnerTeam === '1' ? fixture.p1Name
    : event.winnerTeam === '2' ? fixture.p2Name : undefined;
  const winnerColor = event.winnerTeam === '1' ? fixture.p1Color
    : event.winnerTeam === '2' ? fixture.p2Color : undefined;

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

  const imgDir = path.join(WEB_PUBLIC, 'moments');
  ensureDir(imgDir);
  const imgFilename  = `${event.fixtureId}-${event.seq}-result.png`;
  fs.writeFileSync(path.join(imgDir, imgFilename), pngBuffer);
  const imageUrl = `${publicBaseUrl}/moments/${imgFilename}`;

  const metadata = {
    name: isDraw ? `DRAW — ${fixture.p1Name} vs ${fixture.p2Name}` : `${winnerName} WIN`,
    description: `FT: ${fixture.p1Name} ${event.scoreP1}–${event.scoreP2} ${fixture.p2Name}`,
    image: imageUrl,
    attributes: [
      { trait_type: 'fixture', value: event.fixtureId },
      { trait_type: 'kind',    value: 'RESULT' },
      { trait_type: 'score',   value: `${event.scoreP1}-${event.scoreP2}` },
      { trait_type: 'draw',    value: isDraw },
      { trait_type: 'winner',  value: winnerName ?? 'DRAW' },
    ],
  };

  const metaDir = path.join(WEB_PUBLIC, 'metadata');
  ensureDir(metaDir);
  const metaFilename = `${event.fixtureId}-${event.seq}-result.json`;
  fs.writeFileSync(path.join(metaDir, metaFilename), JSON.stringify(metadata, null, 2));
  const metadataUrl = `${publicBaseUrl}/metadata/${metaFilename}`;

  const moment = await (db as any).moment.create({
    data: {
      fixtureId: event.fixtureId,
      kind:      'RESULT',
      seq:       event.seq,
      tsEvent:   Math.floor(event.ts / 1000),
      scoreP1:   event.scoreP1,
      scoreP2:   event.scoreP2,
      imageUrl,
      metadataUrl,
      status:    'OPEN',
      openTs,
      closeTs,
    },
  });

  console.log(`[mintWindow] RESULT opened id=${moment.id} FT: ${fixture.p1Name} ${event.scoreP1}-${event.scoreP2} ${fixture.p2Name}`);
  return moment.id as number;
}

export async function voidMoment(db: PrismaClient, fixtureId: string, seq: number) {
  await (db as any).moment.updateMany({
    where: { fixtureId, seq },
    data:  { status: 'VOID' },
  });
  console.log(`[mintWindow] VOID fixtureId=${fixtureId} seq=${seq}`);
  // TODO Phase 3: call on-chain void_moment
}
