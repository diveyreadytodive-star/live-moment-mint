/**
 * TxLINE SSE event schema — based on actual devnet API response (PascalCase fields).
 * Verified against historical updates for FixtureId 18222446 (Argentina vs Switzerland).
 */
import { z } from 'zod';

export const ClockSchema = z.object({
  Running: z.boolean().optional(),
  Seconds: z.number().optional(),
});

export const ScoreParticipantSchema = z.object({
  H1:      z.object({ Goals: z.number().default(0) }).optional(),
  HT:      z.object({ Goals: z.number().default(0) }).optional(),
  H2:      z.object({ Goals: z.number().default(0) }).optional(),
  ET1:     z.object({ Goals: z.number().default(0) }).optional(),
  ET2:     z.object({ Goals: z.number().default(0) }).optional(),
  ETTotal: z.object({ Goals: z.number().default(0) }).optional(),
  Total:   z.object({ Goals: z.number().default(0) }).optional(),
});

export const ScoreSchema = z.object({
  Participant1: ScoreParticipantSchema.optional(),
  Participant2: ScoreParticipantSchema.optional(),
});

/** Data field on goal events — GoalType can be "Head", "Foot", "Penalty", "OwnGoal", etc. */
export const GoalDataSchema = z.object({
  GoalType: z.string().optional(),
}).passthrough();

/**
 * Unified TxLINE SSE event schema.
 * Actions of interest:
 *   "goal"             — goal scored (Confirmed=true for definitive)
 *   "action_discarded" — VAR cancellation
 *   "game_finalised"   — full-time / StatusId=100
 */
export const TxLineSseEventSchema = z.object({
  FixtureId:       z.union([z.string(), z.number()]).transform(String),
  Seq:             z.number(),
  Ts:              z.number(),
  Action:          z.string().optional(),
  StatusId:        z.number().optional(),
  Type:            z.string().optional(),          // "Soccer"
  Confirmed:       z.boolean().optional(),
  Participant:     z.union([z.literal(1), z.literal(2)]).optional(),  // scoring team
  Participant1Id:  z.union([z.string(), z.number()]).transform(String).optional(),
  Participant2Id:  z.union([z.string(), z.number()]).transform(String).optional(),
  Participant1IsHome: z.boolean().optional(),
  Clock:           ClockSchema.optional(),
  Score:           ScoreSchema.optional(),
  Data:            GoalDataSchema.optional(),
}).passthrough();

export type TxLineSseEvent = z.infer<typeof TxLineSseEventSchema>;

/** Fixture record from /api/fixtures/snapshot (PascalCase) */
export const TxLineFixtureSchema = z.object({
  FixtureId:       z.union([z.string(), z.number()]).transform(String),
  Participant1:    z.string(),       // team name
  Participant2:    z.string(),
  Participant1Id:  z.union([z.string(), z.number()]).transform(String),
  Participant2Id:  z.union([z.string(), z.number()]).transform(String),
  Participant1IsHome: z.boolean().optional(),
  Competition:     z.string().optional(),
  CompetitionId:   z.number().optional(),
  StartTime:       z.number(),       // ms epoch
  GameState:       z.union([z.string(), z.number()]).optional(),
}).passthrough();

export type TxLineFixture = z.infer<typeof TxLineFixtureSchema>;
