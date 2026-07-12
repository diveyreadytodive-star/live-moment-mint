// ── Moment kinds ────────────────────────────────────────────────────────
export type MomentKind = 'GOAL' | 'RESULT';

// ── Moment statuses ─────────────────────────────────────────────────────
export type MomentStatus = 'OPEN' | 'CLOSED' | 'VOID';

// ── DB Moment record ────────────────────────────────────────────────────
export interface Moment {
  id: number;
  fixtureId: string;
  kind: MomentKind;
  seq: number;
  tsEvent: number;
  teamScorerId?: string;   // "1" or "2"
  goalType?: string;       // "Head" | "Foot" | "Penalty" | "OwnGoal" | etc.
  minute?: number;
  scoreP1: number;
  scoreP2: number;
  imageUrl?: string;
  metadataUrl?: string;
  momentPda?: string;
  status: MomentStatus;
  openTs: number;
  closeTs: number;
}

// ── DB Mint record ──────────────────────────────────────────────────────
export interface Mint {
  id: number;
  momentId: number;
  minterPubkey: string;
  assetId: string;
  txSig: string;
  createdAt: number;
}

// ── DB Fixture record ────────────────────────────────────────────────────
export interface Fixture {
  id: string;
  p1Id: string;
  p2Id: string;
  p1Name: string;
  p2Name: string;
  p1IsHome: boolean;
  p1Color: string;
  p2Color: string;
  kickoffTs: number;
}

// ── Normalized goal event (keeper internal) ──────────────────────────────
export interface GoalEvent {
  type: 'GOAL';
  fixtureId: string;
  seq: number;
  ts: number;
  scoringTeam: '1' | '2';
  minute: number;
  scoreP1: number;
  scoreP2: number;
  goalType: string;        // e.g. "Head", "Foot", "Penalty", "OwnGoal"
  isPenalty: boolean;
  isOwnGoal: boolean;
}

// ── Normalized result event ──────────────────────────────────────────────
export interface ResultEvent {
  type: 'RESULT';
  fixtureId: string;
  seq: number;
  ts: number;
  scoreP1: number;
  scoreP2: number;
  winnerTeam?: '1' | '2';  // undefined = draw
}

export type MomentoEvent = GoalEvent | ResultEvent;

// ── Real-time feed messages (web SSE) ────────────────────────────────────
export interface MomentOpenedMessage {
  type: 'MOMENT_OPENED';
  moment: Moment;
}

export interface MomentClosedMessage {
  type: 'MOMENT_CLOSED';
  momentId: number;
}

export type FeedMessage = MomentOpenedMessage | MomentClosedMessage;
