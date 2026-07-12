/**
 * Parses raw TxLINE SSE events into normalized MomentoEvents.
 *
 * Verified against real devnet data (FixtureId 18222446, July 2026):
 *   Goal:   Action="goal", Confirmed=true, Participant=1|2
 *   Result: Action="game_finalised", StatusId=100
 *   Cancel: Action="action_discarded" (VAR cancellation)
 */
import type { TxLineSseEvent } from '@momento/shared';
import type { GoalEvent, ResultEvent, MomentoEvent } from '@momento/shared';

function getGoals(event: TxLineSseEvent, team: 'Participant1' | 'Participant2'): number {
  return event.Score?.[team]?.Total?.Goals ?? 0;
}

function clockToMinute(seconds: number): number {
  return Math.ceil(seconds / 60);
}

export function parseEvent(raw: TxLineSseEvent): MomentoEvent | null {
  const action = raw.Action ?? '';

  // ── Goal (3.1) ──────────────────────────────────────────────────────────
  // Only process confirmed goals to avoid duplicates (unconfirmed fires first, then confirmed)
  if (action === 'goal' && raw.Confirmed === true && raw.Participant !== undefined) {
    const scoreP1 = getGoals(raw, 'Participant1');
    const scoreP2 = getGoals(raw, 'Participant2');
    const goalType = raw.Data?.GoalType ?? '';
    const isPenalty = goalType === 'Penalty';
    const isOwnGoal = goalType === 'OwnGoal';
    const seconds = raw.Clock?.Seconds ?? 0;

    return {
      type: 'GOAL',
      fixtureId: raw.FixtureId,
      seq: raw.Seq,
      ts: raw.Ts,
      scoringTeam: String(raw.Participant) as '1' | '2',
      minute: clockToMinute(seconds),
      scoreP1,
      scoreP2,
      goalType,
      isPenalty,
      isOwnGoal,
    } satisfies GoalEvent;
  }

  // ── Result / game_finalised (3.2) ────────────────────────────────────────
  if (action === 'game_finalised' || raw.StatusId === 100) {
    const scoreP1 = getGoals(raw, 'Participant1');
    const scoreP2 = getGoals(raw, 'Participant2');

    let winnerTeam: '1' | '2' | undefined;
    if (scoreP1 > scoreP2) winnerTeam = '1';
    else if (scoreP2 > scoreP1) winnerTeam = '2';

    return {
      type: 'RESULT',
      fixtureId: raw.FixtureId,
      seq: raw.Seq,
      ts: raw.Ts,
      scoreP1,
      scoreP2,
      winnerTeam,
    } satisfies ResultEvent;
  }

  return null;
}

/** VAR cancellation — called before parseEvent to void existing moments */
export function isVarCancel(raw: TxLineSseEvent): boolean {
  return raw.Action === 'action_discarded';
}
