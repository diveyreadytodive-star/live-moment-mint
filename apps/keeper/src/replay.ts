/**
 * Replay harness: feeds saved SSE events at original (or accelerated) timing.
 * Demo without live games — uses real event structure from TxLINE devnet.
 */
import type { TxLineSseEvent } from '@momento/shared';

type EventCallback = (event: TxLineSseEvent) => void;

export async function replay(
  events: TxLineSseEvent[],
  onEvent: EventCallback,
  options: { speedMultiplier?: number; loop?: boolean } = {},
): Promise<void> {
  const { speedMultiplier = 1, loop = false } = options;
  const sorted = [...events].sort((a, b) => a.Ts - b.Ts);
  if (sorted.length === 0) return;

  const run = async () => {
    const startWall = Date.now();
    const startTs   = sorted[0].Ts;

    for (const event of sorted) {
      const eventMs = event.Ts - startTs;
      const wallMs  = Math.max(0, eventMs / speedMultiplier - (Date.now() - startWall));
      if (wallMs > 0) await delay(wallMs);
      onEvent(event);
    }
  };

  if (loop) {
    while (true) { await run(); await delay(3000); }
  } else {
    await run();
  }
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Demo events (real TxLINE schema, fictional timestamps) ────────────────
const NOW = Math.floor(Date.now() / 1000) * 1000; // ms

export const DEMO_EVENTS: TxLineSseEvent[] = [
  // Game starts (kickoff)
  {
    FixtureId: 'demo-001',
    Seq: 1,
    Ts: NOW,
    Action: 'kickoff',
    StatusId: 2,
    Type: 'Soccer',
    Participant1Id: '1489',
    Participant2Id: '3099',
    Participant1IsHome: true,
    Score: { Participant1: { Total: { Goals: 0 } }, Participant2: { Total: { Goals: 0 } } },
  },
  // GOAL — Argentina scores (23')
  {
    FixtureId: 'demo-001',
    Seq: 2,
    Ts: NOW + 30_000,
    Action: 'goal',
    Confirmed: true,
    StatusId: 2,
    Type: 'Soccer',
    Participant: 1,
    Participant1Id: '1489',
    Participant2Id: '3099',
    Participant1IsHome: true,
    Clock: { Running: true, Seconds: 23 * 60 + 15 },
    Score: { Participant1: { Total: { Goals: 1 } }, Participant2: { Total: { Goals: 0 } } },
    Data: { GoalType: 'Head' },
  },
  // GOAL — Switzerland penalty (67')
  {
    FixtureId: 'demo-001',
    Seq: 3,
    Ts: NOW + 90_000,
    Action: 'goal',
    Confirmed: true,
    StatusId: 2,
    Type: 'Soccer',
    Participant: 2,
    Participant1Id: '1489',
    Participant2Id: '3099',
    Participant1IsHome: true,
    Clock: { Running: true, Seconds: 67 * 60 + 44 },
    Score: { Participant1: { Total: { Goals: 1 } }, Participant2: { Total: { Goals: 1 } } },
    Data: { GoalType: 'Penalty' },
  },
  // GOAL — Argentina wins it (88')
  {
    FixtureId: 'demo-001',
    Seq: 4,
    Ts: NOW + 150_000,
    Action: 'goal',
    Confirmed: true,
    StatusId: 2,
    Type: 'Soccer',
    Participant: 1,
    Participant1Id: '1489',
    Participant2Id: '3099',
    Participant1IsHome: true,
    Clock: { Running: true, Seconds: 88 * 60 + 22 },
    Score: { Participant1: { Total: { Goals: 2 } }, Participant2: { Total: { Goals: 1 } } },
    Data: { GoalType: 'Foot' },
  },
  // FULL TIME
  {
    FixtureId: 'demo-001',
    Seq: 5,
    Ts: NOW + 180_000,
    Action: 'game_finalised',
    StatusId: 100,
    Type: 'Soccer',
    Participant1Id: '1489',
    Participant2Id: '3099',
    Participant1IsHome: true,
    Score: { Participant1: { Total: { Goals: 2 } }, Participant2: { Total: { Goals: 1 } } },
  },
];
