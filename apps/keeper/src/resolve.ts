/**
 * Resolves fixture metadata.
 * Primary path: look up DB fixture by txlineId (set during startup sync).
 * Fallback: fetch from TxLine API snapshot.
 */
import type { TxLineClient } from '@momento/txline';
import type { Fixture } from '@momento/shared';
import type { PrismaClient } from '@prisma/client';

const DEFAULT_COLORS: Record<string, string> = {
  '1489': '#75aadb', // Argentina
  '3099': '#d52b1e', // Switzerland
  '1999': '#002395', // France
  '3021': '#c60b1e', // Spain
  '1888': '#012169', // England
};

// In-memory cache keyed by DB fixture ID
const fixtureCache = new Map<string, Fixture>();

/**
 * Look up a DB fixture by its txlineId, returning a Fixture with the DB's
 * primary key (fd-XXXXX or TxLine ID as fallback).
 */
export async function resolveFixtureByTxlineId(
  db: PrismaClient,
  txlineId: string,
  dbFixtureId: string,
): Promise<Fixture> {
  if (fixtureCache.has(dbFixtureId)) return fixtureCache.get(dbFixtureId)!;

  const row = await (db as any).fixture.findUnique({ where: { id: dbFixtureId } });
  if (row) {
    const fixture: Fixture = {
      id:       row.id,
      p1Id:     row.p1Id,
      p2Id:     row.p2Id,
      p1Name:   row.p1Name,
      p2Name:   row.p2Name,
      p1IsHome: row.p1IsHome,
      p1Color:  row.p1Color,
      p2Color:  row.p2Color,
      kickoffTs: row.kickoffTs,
    };
    fixtureCache.set(dbFixtureId, fixture);
    return fixture;
  }

  throw new Error(`Fixture not found in DB: txlineId=${txlineId} dbId=${dbFixtureId}`);
}

/**
 * Legacy helper: resolves from TxLine API (used if DB lookup is unavailable).
 * Kept for backward compatibility with replay mode.
 */
export async function resolveFixture(
  client: TxLineClient,
  fixtureId: string,
): Promise<Fixture> {
  if (fixtureCache.has(fixtureId)) return fixtureCache.get(fixtureId)!;

  const fixtures = await client.getFixturesSnapshot();
  const raw = fixtures.find((f: any) => String(f.FixtureId) === fixtureId);
  if (!raw) throw new Error(`Fixture ${fixtureId} not found in TxLine snapshot`);

  const p1Id = String(raw.Participant1Id);
  const p2Id = String(raw.Participant2Id);

  const fixture: Fixture = {
    id:       fixtureId,
    p1Id,     p2Id,
    p1Name:   raw.Participant1 ?? 'Team 1',
    p2Name:   raw.Participant2 ?? 'Team 2',
    p1IsHome: raw.Participant1IsHome ?? true,
    p1Color:  DEFAULT_COLORS[p1Id] ?? '#1a56db',
    p2Color:  DEFAULT_COLORS[p2Id] ?? '#e02424',
    kickoffTs: Math.floor((raw.StartTime ?? 0) / 1000),
  };

  fixtureCache.set(fixtureId, fixture);
  return fixture;
}

export function clearCache() { fixtureCache.clear(); }
export function seedFixture(fixture: Fixture) { fixtureCache.set(fixture.id, fixture); }
