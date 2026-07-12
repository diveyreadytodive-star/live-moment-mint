/**
 * Replay harness: feeds saved SSE events through the pipeline
 * at original timing (or accelerated). Enables demo without live games.
 */
import type { TxLineSseEvent } from '@momento/shared';

type EventCallback = (event: TxLineSseEvent) => void;

interface ReplayOptions {
  speedMultiplier?: number;  // 1 = real-time, 10 = 10x faster
  loop?: boolean;
}

export async function replay(
  events: TxLineSseEvent[],
  onEvent: EventCallback,
  options: ReplayOptions = {},
): Promise<void> {
  const { speedMultiplier = 1, loop = false } = options;

  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  if (sorted.length === 0) return;

  const run = async () => {
    const startWall = Date.now();
    const startTs = sorted[0].ts * 1000;

    for (const event of sorted) {
      const eventMs = event.ts * 1000 - startTs;
      const wallMs = Math.max(0, eventMs / speedMultiplier - (Date.now() - startWall));
      if (wallMs > 0) await delay(wallMs);
      onEvent(event);
    }
  };

  if (loop) {
    while (true) {
      await run();
      await delay(3000);
    }
  } else {
    await run();
  }
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// Sample replay events for offline demo (Brazil vs Argentina, fictional)
export const DEMO_EVENTS: TxLineSseEvent[] = [
  {
    fixtureId: 'demo-001',
    seq: 1,
    ts: Math.floor(Date.now() / 1000),
    sportId: 'soccer',
    confirmed: true,
    participant1Id: 'BRA',
    participant2Id: 'ARG',
    participant1IsHome: true,
    dataSoccer: {
      Goal: true,
      Participant: 1,
      PlayerId: 'player-9',
      Minutes: 23,
      Penalty: false,
      OwnGoal: false,
    },
    scoreSoccer: {
      Participant1: { Total: { Goals: 1 } },
      Participant2: { Total: { Goals: 0 } },
    },
  },
  {
    fixtureId: 'demo-001',
    seq: 2,
    ts: Math.floor(Date.now() / 1000) + 60,
    sportId: 'soccer',
    confirmed: true,
    participant1Id: 'BRA',
    participant2Id: 'ARG',
    participant1IsHome: true,
    dataSoccer: {
      Goal: true,
      Participant: 2,
      PlayerId: 'player-10',
      Minutes: 67,
      Penalty: true,
      OwnGoal: false,
    },
    scoreSoccer: {
      Participant1: { Total: { Goals: 1 } },
      Participant2: { Total: { Goals: 1 } },
    },
  },
  {
    fixtureId: 'demo-001',
    seq: 3,
    ts: Math.floor(Date.now() / 1000) + 120,
    action: 'game_finalised',
    statusId: 100,
    period: 100,
    participant1Id: 'BRA',
    participant2Id: 'ARG',
    scoreSoccer: {
      Participant1: { Total: { Goals: 1 } },
      Participant2: { Total: { Goals: 1 } },
    },
  },
];
