/**
 * Resolves fixture metadata from TxLINE fixture snapshot.
 * Note: TxLINE soccer goal events do NOT include scorer IDs.
 * We use team name/color from fixture data instead.
 */
import type { TxLineClient } from '@momento/txline';
import type { Fixture } from '@momento/shared';

// Default team colors by participant index (overridden by future DB seeding)
const DEFAULT_COLORS: Record<string, string> = {
  '1489': '#75aadb', // Argentina — light blue
  '3099': '#d52b1e', // Switzerland — red
  '1999': '#002395', // France — blue
  '3021': '#c60b1e', // Spain — red
  '1888': '#012169', // England — navy
};

const fixtureCache = new Map<string, Fixture>();

export async function resolveFixture(
  client: TxLineClient,
  fixtureId: string,
): Promise<Fixture> {
  if (fixtureCache.has(fixtureId)) return fixtureCache.get(fixtureId)!;

  // Fetch all fixtures and find the matching one
  const fixtures = await client.getFixturesSnapshot();
  const raw = fixtures.find((f: any) => String(f.FixtureId) === fixtureId);

  if (!raw) {
    throw new Error(`Fixture ${fixtureId} not found in snapshot`);
  }

  const p1Id = String(raw.Participant1Id);
  const p2Id = String(raw.Participant2Id);

  const fixture: Fixture = {
    id: fixtureId,
    p1Id,
    p2Id,
    p1Name: raw.Participant1 ?? 'Team 1',
    p2Name: raw.Participant2 ?? 'Team 2',
    p1IsHome: raw.Participant1IsHome ?? true,
    p1Color: DEFAULT_COLORS[p1Id] ?? '#1a56db',
    p2Color: DEFAULT_COLORS[p2Id] ?? '#e02424',
    kickoffTs: Math.floor((raw.StartTime ?? 0) / 1000),
  };

  fixtureCache.set(fixtureId, fixture);
  return fixture;
}

/** Clear cache (used in tests or after fixture updates) */
export function clearCache() {
  fixtureCache.clear();
}

/** Manually seed the cache for demo/replay fixtures (bypasses API call) */
export function seedFixture(fixture: Fixture) {
  fixtureCache.set(fixture.id, fixture);
}
