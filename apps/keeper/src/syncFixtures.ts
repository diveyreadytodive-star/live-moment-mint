/**
 * Syncs fixtures from football-data.org into the DB.
 * Supports multiple competitions: 4 major leagues + international.
 *
 * Rate limit: 10 req/min on free plan — we batch sequentially with a delay.
 * Response headers: x-requests-available-minute tells us remaining quota.
 */
import axios, { AxiosResponse } from 'axios';
import type { PrismaClient } from '@prisma/client';

const FD_BASE = 'https://api.football-data.org/v4';

// Competitions to sync — code: label
export const COMPETITIONS: Record<string, string> = {
  WC:  'FIFA World Cup',
  PL:  'Premier League',
  PD:  'La Liga',
  BL1: 'Bundesliga',
  SA:  'Serie A',
  FL1: 'Ligue 1',
  CL:  'UEFA Champions League',
  EC:  'European Championship',
};

// Approximate primary kit colors per team name
const TEAM_COLOR: Record<string, string> = {
  // National
  'Argentina': '#75aadb', 'France': '#002395', 'Spain': '#c60b1e',
  'England': '#012169', 'Switzerland': '#d52b1e', 'Morocco': '#006233',
  'Belgium': '#000000', 'Norway': '#ef2b2d', 'Brazil': '#009c3b',
  'Germany': '#000000', 'Portugal': '#006600', 'Netherlands': '#ff6600',
  'USA': '#002868', 'Mexico': '#006847', 'Japan': '#bc002d',
  'South Korea': '#003478', 'Croatia': '#ff0000', 'Denmark': '#c60c30',
  'Uruguay': '#5aaad4', 'Colombia': '#fcd116', 'Nigeria': '#008751',
  'Qatar': '#8d1b3d', 'Canada': '#ff0000', 'Saudi Arabia': '#006c35',
  'Australia': '#00843d', 'Senegal': '#00853f', 'Ecuador': '#ffd100',
  'Ghana': '#006b3f', 'Cameroon': '#007a5e', 'Serbia': '#c6363c',
  'Wales': '#d01012', 'Iran': '#239f40', 'Tunisia': '#e70013',
  'Costa Rica': '#00215a', 'Poland': '#dc143c', 'Italy': '#003399',
  'Scotland': '#003399', 'Turkey': '#e30a17', 'Ukraine': '#005bbb',
  // Premier League
  'Manchester City': '#6cabdd', 'Arsenal': '#ef0107', 'Liverpool': '#c8102e',
  'Chelsea': '#034694', 'Manchester United': '#da291c', 'Tottenham Hotspur': '#132257',
  'Newcastle United': '#241f20', 'Aston Villa': '#95bfe5', 'West Ham United': '#7a263a',
  'Brighton & Hove Albion': '#0057b8', 'Brentford': '#e30613', 'Fulham': '#cc0000',
  'Crystal Palace': '#1b458f', 'Wolves': '#fdb913', 'Nottingham Forest': '#dd0000',
  'Everton': '#003399', 'Leicester City': '#003090', 'Ipswich Town': '#005daa',
  'AFC Bournemouth': '#da291c', 'Southampton': '#d71920',
  // La Liga
  'Real Madrid CF': '#febe10', 'FC Barcelona': '#a50044', 'Atlético de Madrid': '#cc0000',
  'Sevilla FC': '#d8192a', 'Real Betis Balompié': '#007f00', 'Real Sociedad de Fútbol': '#0067b1',
  'Villarreal CF': '#fcef00', 'Athletic Club': '#ee2523',
  // Bundesliga
  'FC Bayern München': '#dc052d', 'Borussia Dortmund': '#fde100',
  'RB Leipzig': '#dd0741', 'Bayer 04 Leverkusen': '#e32221',
  'Eintracht Frankfurt': '#e1000f', 'VfL Wolfsburg': '#65b32e',
  'Borussia Mönchengladbach': '#000000', 'TSG 1899 Hoffenheim': '#1763aa',
  // Serie A
  'Juventus FC': '#000000', 'AC Milan': '#fb090b', 'FC Internazionale Milano': '#010ea8',
  'SSC Napoli': '#12a0d7', 'AS Roma': '#ffc000', 'SS Lazio': '#83bfe6',
  'Atalanta BC': '#1e90ff',
};

export const STAGE_LABEL: Record<string, string> = {
  REGULAR_SEASON: 'Regular Season',
  GROUP_STAGE:    'Group Stage',
  LAST_32:        'Round of 32',
  LAST_16:        'Round of 16',
  QUARTER_FINALS: 'Quarter-final',
  SEMI_FINALS:    'Semi-final',
  THIRD_PLACE:    '3rd Place',
  FINAL:          'Final',
};

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: { winner: string | null; fullTime: { home: number | null; away: number | null } };
  competition?: { code: string };
}

async function fetchWithRateLimit(
  path: string,
  fdToken: string,
): Promise<{ data: any; remaining: number }> {
  const res: AxiosResponse = await axios.get(`${FD_BASE}${path}`, {
    headers: { 'X-Auth-Token': fdToken },
    timeout: 15_000,
  });
  const remaining = Number(res.headers['x-requests-available-minute'] ?? 10);
  return { data: res.data, remaining };
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function upsertMatch(db: PrismaClient, m: FdMatch, competitionCode: string) {
  const id = `fd-${m.id}`;
  const p1Name = m.homeTeam.name;
  const p2Name = m.awayTeam.name;
  const kickoffTs = Math.floor(new Date(m.utcDate).getTime() / 1000);
  const isFinished = m.status === 'FINISHED';
  const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
  const statusId = isFinished ? 100 : isLive ? 2 : null;

  await (db as any).fixture.upsert({
    where: { id },
    update: {
      p1Name, p2Name, kickoffTs,
      statusId, isLive, stage: m.stage,
      liveScoreP1: isFinished || isLive ? (m.score?.fullTime?.home ?? null) : null,
      liveScoreP2: isFinished || isLive ? (m.score?.fullTime?.away ?? null) : null,
    },
    create: {
      id,
      p1Id: String(m.homeTeam.id),
      p2Id: String(m.awayTeam.id),
      p1Name, p2Name,
      p1IsHome: true,
      p1Color: TEAM_COLOR[p1Name] ?? '#1a56db',
      p2Color: TEAM_COLOR[p2Name] ?? '#e02424',
      kickoffTs, statusId, isLive,
      stage: m.stage,
      liveScoreP1: isFinished ? (m.score?.fullTime?.home ?? null) : null,
      liveScoreP2: isFinished ? (m.score?.fullTime?.away ?? null) : null,
    },
  });
}

/**
 * Main sync: iterates all configured competitions and upserts matches.
 * Respects rate limit — pauses when < 2 requests remain in current minute.
 */
export async function syncAllFixtures(db: PrismaClient, fdToken: string): Promise<void> {
  if (!fdToken) {
    console.log('[sync] No FOOTBALL_DATA_TOKEN — skipping');
    return;
  }

  const codes = Object.keys(COMPETITIONS);
  let totalUpserted = 0;

  for (const code of codes) {
    try {
      const { data, remaining } = await fetchWithRateLimit(
        `/competitions/${code}/matches`,
        fdToken,
      );
      const matches: FdMatch[] = data.matches ?? [];
      console.log(`[sync] ${code}: ${matches.length} matches (rate remaining: ${remaining})`);

      for (const m of matches) {
        await upsertMatch(db, m, code);
        totalUpserted++;
      }

      // Pause if running low on rate limit quota (< 2 remaining)
      if (remaining < 2) {
        console.log('[sync] Rate limit low — waiting 61s');
        await sleep(61_000);
      }
    } catch (err: any) {
      console.error(`[sync] Failed to sync ${code}:`, err.message);
    }
  }

  console.log(`[sync] Done — ${totalUpserted} fixtures upserted across ${codes.length} competitions`);
}

// Keep old WC-only export for backward compat with seed scripts
export { syncAllFixtures as syncWCFixtures };

/**
 * For each TxLine fixture, find the matching DB fixture and write txlineId.
 * Returns Map<txlineId, dbFixtureId>.
 */
export async function matchTxlineIds(
  db: PrismaClient,
  txlineFixtures: Array<{ FixtureId: number; Participant1: string; Participant2: string; StartTime: number }>,
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();

  for (const f of txlineFixtures) {
    const txlineId = String(f.FixtureId);
    const p1 = f.Participant1 ?? '';
    const p2 = f.Participant2 ?? '';
    const kickoffTs = Math.floor((f.StartTime ?? 0) / 1000);

    const candidates = await (db as any).fixture.findMany({
      where: {
        p1Name: { contains: p1, mode: 'insensitive' },
        p2Name: { contains: p2, mode: 'insensitive' },
        kickoffTs: { gte: kickoffTs - 7200, lte: kickoffTs + 7200 },
      },
    });

    if (candidates.length > 0) {
      const dbFixture = candidates[0];
      if (dbFixture.txlineId !== txlineId) {
        await (db as any).fixture.update({
          where: { id: dbFixture.id },
          data: { txlineId },
        });
      }
      mapping.set(txlineId, dbFixture.id);
      console.log(`[sync] TxLine ${txlineId} → DB ${dbFixture.id} (${p1} vs ${p2})`);
    } else {
      mapping.set(txlineId, txlineId);
      console.log(`[sync] TxLine ${txlineId} (${p1} vs ${p2}) — no FD match, using TxLine ID`);
    }
  }

  return mapping;
}
