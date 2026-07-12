/**
 * Parses raw TxLINE SSE events into normalized MomentoEvents.
 * Implements detection rules from Section 3.1 (goal) and 3.2 (result).
 */
import type { TxLineSseEvent } from '@momento/shared';
import type { GoalEvent, ResultEvent, MomentoEvent } from '@momento/shared';

const SOCCER_SPORT_ID = 'soccer'; // verify against live data

export function parseEvent(raw: TxLineSseEvent): MomentoEvent | null {
  // ── Goal detection (3.1) ────────────────────────────────────────────
  if (
    (raw.sportId === SOCCER_SPORT_ID || !raw.sportId) &&
    raw.dataSoccer?.Goal === true &&
    raw.confirmed === true &&
    raw.dataSoccer.Participant !== undefined
  ) {
    const s = raw.dataSoccer;
    const scoreSoccer = raw.scoreSoccer;
    const scoreP1 = scoreSoccer?.Participant1?.Total?.Goals ?? 0;
    const scoreP2 = scoreSoccer?.Participant2?.Total?.Goals ?? 0;

    return {
      type: 'GOAL',
      fixtureId: raw.fixtureId,
      seq: raw.seq,
      ts: raw.ts,
      participantScoredId: String(s.Participant),
      playerId: s.PlayerId ?? '',
      playerName: '', // resolved later by resolve.ts
      minute: s.Minutes ?? 0,
      scoreP1,
      scoreP2,
      isPenalty: s.Penalty ?? false,
      isOwnGoal: s.OwnGoal ?? false,
    } satisfies GoalEvent;
  }

  // ── Result detection (3.2) ──────────────────────────────────────────
  if (
    raw.action === 'game_finalised' ||
    (raw.statusId === 100 && raw.period === 100)
  ) {
    const scoreP1 = raw.scoreSoccer?.Participant1?.Total?.Goals ?? 0;
    const scoreP2 = raw.scoreSoccer?.Participant2?.Total?.Goals ?? 0;

    let winnerParticipantId: string | undefined;
    if (scoreP1 > scoreP2) winnerParticipantId = '1';
    else if (scoreP2 > scoreP1) winnerParticipantId = '2';
    // undefined = draw

    return {
      type: 'RESULT',
      fixtureId: raw.fixtureId,
      seq: raw.seq,
      ts: raw.ts,
      scoreP1,
      scoreP2,
      winnerParticipantId,
    } satisfies ResultEvent;
  }

  return null;
}

/** Detect VAR cancellation (goal count decreased or VAR=true after a goal) */
export function isVarCancel(raw: TxLineSseEvent): boolean {
  return raw.dataSoccer?.VAR === true;
}
