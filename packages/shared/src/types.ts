// ── Moment kinds ────────────────────────────────────────────────────────
export type MomentKind = 'GOAL' | 'RESULT';

// ── Moment statuses ─────────────────────────────────────────────────────
export type MomentStatus = 'OPEN' | 'CLOSED' | 'VOID';

// ── DB Moment record ────────────────────────────────────────────────────
export interface Moment {
  id: number;
  fixtureId: string;
  kind: MomentKind;
  seq: number;           // monotonic sequence from TxLINE SSE
  tsEvent: number;       // unix timestamp of the real-world event
  teamScorerId?: string; // participant id of scoring team
  playerId?: string;
  playerName?: string;
  minute?: number;
  scoreP1: number;
  scoreP2: number;
  imageUrl?: string;
  metadataUrl?: string;
  momentPda?: string;    // on-chain PDA address
  status: MomentStatus;
  openTs: number;
  closeTs: number;
  proofRef?: string;
}

// ── DB Mint record ──────────────────────────────────────────────────────
export interface Mint {
  id: number;
  momentId: number;
  minterPubkey: string;
  assetId: string;       // mpl-core asset address
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
  p1Color: string;       // hex e.g. "#1a56db"
  p2Color: string;
  kickoffTs: number;
}

// ── Normalized goal event (keeper internal) ──────────────────────────────
export interface GoalEvent {
  type: 'GOAL';
  fixtureId: string;
  seq: number;
  ts: number;
  participantScoredId: string;  // "1" | "2"
  playerId: string;
  playerName: string;
  minute: number;
  scoreP1: number;
  scoreP2: number;
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
  winnerParticipantId?: string; // undefined = draw
}

export type MomentoEvent = GoalEvent | ResultEvent;

// ── Real-time feed message (web SSE) ────────────────────────────────────
export interface MomentOpenedMessage {
  type: 'MOMENT_OPENED';
  moment: Moment;
}

export interface MomentClosedMessage {
  type: 'MOMENT_CLOSED';
  momentId: number;
}

export type FeedMessage = MomentOpenedMessage | MomentClosedMessage;
