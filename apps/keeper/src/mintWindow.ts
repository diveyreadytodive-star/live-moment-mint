/**
 * Opens / voids minting windows.
 * Images and metadata are stored in the DB (imageData, metadataJson) and
 * served via /api/moments/[id]/image and /api/moments/[id]/metadata.
 * This makes them reachable from any deployment (Vercel + local keeper).
 */
import type { PrismaClient } from '@prisma/client';
import type { GoalEvent, ResultEvent, Fixture } from '@momento/shared';
import { renderGoalPng, renderResultPng } from '@momento/image';
import axios from 'axios';
import { onChainOpenWindow, onChainVoidMoment } from './onchain';

const GOAL_WINDOW_SECS   = 5 * 60;  // 5 min
const RESULT_WINDOW_SECS = 10 * 60; // 10 min

// Idempotency guard (in-process)
const processedKeys = new Set<string>();

/** Phase 5: push moment to web SSE feed */
async function broadcastMomentOpened(moment: any) {
  const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const secret  = process.env.INTERNAL_SECRET ?? 'dev-secret';
  try {
    await axios.post(
      `${baseUrl}/api/feed`,
      JSON.stringify({ type: 'MOMENT_OPENED', moment }),
      { headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret } },
    );
    console.log(`[mintWindow] SSE broadcast sent for moment id=${moment.id}`);
  } catch {
    // web may not be running locally; ignore
  }
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
    p1Name:       fixture.p1Name,
    p2Name:       fixture.p2Name,
    p1Color:      fixture.p1Color,
    p2Color:      fixture.p2Color,
    scorerName:   scorerTeamName,
    scorerNumber: event.scoringTeam,
    minute:       event.minute,
    scoreP1:      event.scoreP1,
    scoreP2:      event.scoreP2,
    isPenalty:    event.isPenalty,
    isOwnGoal:    event.isOwnGoal,
  });

  // URLs are based on moment ID assigned after DB create — placeholder first
  // Real URLs are set after moment.id is known
  const metadataObj = {
    name: `${scorerTeamName} Goal — ${event.minute}'`,
    description: `${fixture.p1Name} ${event.scoreP1}–${event.scoreP2} ${fixture.p2Name}`,
    image: '', // filled after insert
    attributes: [
      { trait_type: 'fixture',   value: event.fixtureId },
      { trait_type: 'kind',      value: 'GOAL' },
      { trait_type: 'team',      value: scorerTeamName },
      { trait_type: 'minute',    value: event.minute },
      { trait_type: 'score',     value: `${event.scoreP1}-${event.scoreP2}` },
      { trait_type: 'goal_type', value: event.goalType || 'unknown' },
    ],
  };

  // Insert moment first to get the auto-incremented ID
  const moment = await (db as any).moment.create({
    data: {
      fixtureId:    fixture.id,  // use DB fixture ID (fd-XXXXX), not raw TxLine ID
      kind:         'GOAL',
      seq:          event.seq,
      tsEvent:      Math.floor(event.ts / 1000),
      teamScorerId: event.scoringTeam,
      goalType:     event.goalType,
      minute:       event.minute,
      scoreP1:      event.scoreP1,
      scoreP2:      event.scoreP2,
      status:       'OPEN',
      openTs,
      closeTs,
    },
  });

  // Now that we have moment.id, build stable public URLs and store image in DB
  const imageUrl    = `${publicBaseUrl}/api/moments/${moment.id}/image`;
  const metadataUrl = `${publicBaseUrl}/api/moments/${moment.id}/metadata`;
  metadataObj.image = imageUrl;

  await (db as any).moment.update({
    where: { id: moment.id },
    data: {
      imageUrl,
      metadataUrl,
      imageData:    pngBuffer,
      metadataJson: JSON.stringify(metadataObj),
    },
  });

  console.log(`[mintWindow] GOAL opened id=${moment.id} ${fixture.p1Name} ${event.scoreP1}-${event.scoreP2} ${fixture.p2Name} ${event.minute}' closes=${new Date(closeTs * 1000).toISOString()}`);

  // Phase 3: open on-chain window
  if (process.env.MOMENTO_PROGRAM_ID) {
    const keeperPath = process.env.KEEPER_WALLET_PATH ?? './devnet-keeper.json';
    const pda = await onChainOpenWindow(
      keeperPath,
      moment.id,
      event.fixtureId,
      event.seq,
      openTs,
      closeTs,
      'GOAL',
      metadataUrl,
    );
    if (pda) {
      await (db as any).moment.update({
        where: { id: moment.id },
        data: { momentPda: pda, onchainStatus: 'OK' },
      });
    } else {
      await (db as any).moment.update({
        where: { id: moment.id },
        data: { onchainStatus: 'FAILED' },
      });
      console.error(`[mintWindow] GOAL id=${moment.id} on-chain open FAILED — moment stays DB-only`);
    }
  }

  // Phase 5: broadcast to SSE clients
  await broadcastMomentOpened(moment);

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

  const metadataObj = {
    name: isDraw ? `DRAW — ${fixture.p1Name} vs ${fixture.p2Name}` : `${winnerName} WIN`,
    description: `FT: ${fixture.p1Name} ${event.scoreP1}–${event.scoreP2} ${fixture.p2Name}`,
    image: '', // filled after insert
    attributes: [
      { trait_type: 'fixture', value: event.fixtureId },
      { trait_type: 'kind',    value: 'RESULT' },
      { trait_type: 'score',   value: `${event.scoreP1}-${event.scoreP2}` },
      { trait_type: 'draw',    value: isDraw },
      { trait_type: 'winner',  value: winnerName ?? 'DRAW' },
    ],
  };

  const moment = await (db as any).moment.create({
    data: {
      fixtureId: fixture.id,  // use DB fixture ID (fd-XXXXX), not raw TxLine ID
      kind:      'RESULT',
      seq:       event.seq,
      tsEvent:   Math.floor(event.ts / 1000),
      scoreP1:   event.scoreP1,
      scoreP2:   event.scoreP2,
      status:    'OPEN',
      openTs,
      closeTs,
    },
  });

  const imageUrl    = `${publicBaseUrl}/api/moments/${moment.id}/image`;
  const metadataUrl = `${publicBaseUrl}/api/moments/${moment.id}/metadata`;
  metadataObj.image = imageUrl;

  await (db as any).moment.update({
    where: { id: moment.id },
    data: {
      imageUrl,
      metadataUrl,
      imageData:    pngBuffer,
      metadataJson: JSON.stringify(metadataObj),
    },
  });

  console.log(`[mintWindow] RESULT opened id=${moment.id} FT: ${fixture.p1Name} ${event.scoreP1}-${event.scoreP2} ${fixture.p2Name}`);

  // Phase 3: open on-chain window
  if (process.env.MOMENTO_PROGRAM_ID) {
    const keeperPath = process.env.KEEPER_WALLET_PATH ?? './devnet-keeper.json';
    const pda = await onChainOpenWindow(
      keeperPath,
      moment.id,
      event.fixtureId,
      event.seq,
      openTs,
      closeTs,
      'RESULT',
      metadataUrl,
    );
    if (pda) {
      await (db as any).moment.update({
        where: { id: moment.id },
        data: { momentPda: pda, onchainStatus: 'OK' },
      });
    } else {
      await (db as any).moment.update({
        where: { id: moment.id },
        data: { onchainStatus: 'FAILED' },
      });
      console.error(`[mintWindow] RESULT id=${moment.id} on-chain open FAILED — moment stays DB-only`);
    }
  }

  // Phase 5: broadcast to SSE clients
  await broadcastMomentOpened(moment);

  return moment.id as number;
}

/** Update a fixture's live score fields from any SSE event that carries score data. */
export async function updateFixtureScore(
  db: PrismaClient,
  fixtureId: string,
  scoreP1: number,
  scoreP2: number,
  minute: number | null,
  statusId: number,
): Promise<void> {
  const isLive = statusId === 2 || statusId === 4; // H1=2, H2=4; HT=3 and FT=100 are not live
  try {
    await (db as any).fixture.updateMany({
      where: { id: fixtureId },
      data: { liveScoreP1: scoreP1, liveScoreP2: scoreP2, liveMinute: minute, statusId, isLive },
    });
  } catch {
    // fixture may not exist yet; ignore
  }
}

export async function voidMoment(db: PrismaClient, fixtureId: string, seq: number) {
  await (db as any).moment.updateMany({
    where: { fixtureId, seq },
    data:  { status: 'VOID' },
  });
  console.log(`[mintWindow] VOID fixtureId=${fixtureId} seq=${seq}`);

  // Phase 3: void on-chain
  if (process.env.MOMENTO_PROGRAM_ID) {
    const keeperPath = process.env.KEEPER_WALLET_PATH ?? './devnet-keeper.json';
    await onChainVoidMoment(keeperPath, fixtureId, seq);
  }
}
