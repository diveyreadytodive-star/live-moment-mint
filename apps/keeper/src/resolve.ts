/**
 * Resolves player IDs → names and participant IDs → team info
 * using TxLINE fixture/lineup data.
 */
import type { TxLineClient } from '@momento/txline';
import type { Fixture } from '@momento/shared';

interface PlayerInfo {
  name: string;
  number?: string;
  teamId?: string;
}

// Simple in-memory cache (fixture → players map)
const playerCache = new Map<string, Map<string, PlayerInfo>>();
const fixtureCache = new Map<string, Fixture>();

export async function resolveFixture(
  client: TxLineClient,
  fixtureId: string,
): Promise<Fixture> {
  if (fixtureCache.has(fixtureId)) return fixtureCache.get(fixtureId)!;

  const data = await client.getFixture(fixtureId);
  const fixture: Fixture = {
    id: String(data.id ?? fixtureId),
    p1Id: String(data.participant1Id ?? data.p1Id ?? ''),
    p2Id: String(data.participant2Id ?? data.p2Id ?? ''),
    p1Name: data.participant1Name ?? data.participant1?.name ?? 'Team 1',
    p2Name: data.participant2Name ?? data.participant2?.name ?? 'Team 2',
    p1IsHome: data.participant1IsHome ?? true,
    p1Color: data.participant1Color ?? '#1a56db',
    p2Color: data.participant2Color ?? '#e02424',
    kickoffTs: data.startTime ?? data.kickoffTs ?? 0,
  };
  fixtureCache.set(fixtureId, fixture);
  return fixture;
}

export async function resolvePlayer(
  client: TxLineClient,
  fixtureId: string,
  playerId: string,
): Promise<PlayerInfo> {
  // Populate cache if needed
  if (!playerCache.has(fixtureId)) {
    await populatePlayerCache(client, fixtureId);
  }
  return playerCache.get(fixtureId)?.get(playerId) ?? { name: 'Unknown' };
}

async function populatePlayerCache(client: TxLineClient, fixtureId: string) {
  try {
    const lineup = await client.getLineup(fixtureId);
    const map = new Map<string, PlayerInfo>();

    for (const team of lineup?.lineups ?? []) {
      for (const entry of team?.lineups ?? []) {
        const player = entry?.player;
        if (!player?.id) continue;
        map.set(String(player.id), {
          name: player.preferredName ?? player.name ?? 'Unknown',
          number: String(player.shirtNumber ?? entry.shirtNumber ?? '?'),
          teamId: String(team.participantId ?? ''),
        });
      }
    }
    playerCache.set(fixtureId, map);
  } catch (err) {
    console.error('[resolve] Failed to load lineup for', fixtureId, err);
    playerCache.set(fixtureId, new Map());
  }
}
