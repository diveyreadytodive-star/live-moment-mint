import { z } from 'zod';

// ── TxLINE soccer score event ────────────────────────────────────────────
export const DataSoccerSchema = z.object({
  Goal: z.boolean().optional(),
  Confirmed: z.boolean().optional(),
  VAR: z.boolean().optional(),
  Participant: z.union([z.literal(1), z.literal(2)]).optional(), // scoring team
  PlayerId: z.string().optional(),
  Minutes: z.number().optional(),
  Penalty: z.boolean().optional(),
  OwnGoal: z.boolean().optional(),
  // substitution fields (not used for goals)
  PlayerInId: z.string().optional(),
  PlayerOutId: z.string().optional(),
});

export const ScoreSoccerParticipantSchema = z.object({
  Total: z.object({
    Goals: z.number().default(0),
  }),
});

export const ScoreSoccerSchema = z.object({
  Participant1: ScoreSoccerParticipantSchema.optional(),
  Participant2: ScoreSoccerParticipantSchema.optional(),
});

export const TxLineSseEventSchema = z.object({
  sportId: z.string().optional(),
  fixtureId: z.union([z.string(), z.number()]).transform(String),
  seq: z.number(),
  ts: z.number(),
  action: z.string().optional(),
  statusId: z.number().optional(),
  period: z.number().optional(),
  participant1Id: z.string().optional(),
  participant2Id: z.string().optional(),
  participant1IsHome: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  dataSoccer: DataSoccerSchema.optional(),
  scoreSoccer: ScoreSoccerSchema.optional(),
});

export type TxLineSseEvent = z.infer<typeof TxLineSseEventSchema>;
export type DataSoccer = z.infer<typeof DataSoccerSchema>;
