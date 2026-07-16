'use client';

import { useEffect, useState, useCallback } from 'react';

const FLAG: Record<string, string> = {
  Argentina: '🇦🇷', Switzerland: '🇨🇭', France: '🇫🇷', Spain: '🇪🇸',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Brazil: '🇧🇷', Germany: '🇩🇪', Portugal: '🇵🇹',
  Netherlands: '🇳🇱', Italy: '🇮🇹', USA: '🇺🇸', Mexico: '🇲🇽',
  Canada: '🇨🇦', Japan: '🇯🇵', 'South Korea': '🇰🇷', Morocco: '🇲🇦',
  Croatia: '🇭🇷', Belgium: '🇧🇪', Denmark: '🇩🇰', Serbia: '🇷🇸',
  Poland: '🇵🇱', Australia: '🇦🇺', Ghana: '🇬🇭', Senegal: '🇸🇳',
  Uruguay: '🇺🇾', Colombia: '🇨🇴', Ecuador: '🇪🇨', Chile: '🇨🇱',
  'Saudi Arabia': '🇸🇦', Iran: '🇮🇷', Wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Turkey: '🇹🇷', Ukraine: '🇺🇦', Austria: '🇦🇹', Hungary: '🇭🇺',
  Qatar: '🇶🇦', Nigeria: '🇳🇬', Cameroon: '🇨🇲', Tunisia: '🇹🇳',
  Egypt: '🇪🇬', Algeria: '🇩🇿', 'Ivory Coast': '🇨🇮', 'South Africa': '🇿🇦',
  China: '🇨🇳', Indonesia: '🇮🇩', Thailand: '🇹🇭', Vietnam: '🇻🇳',
  'New Zealand': '🇳🇿', 'Costa Rica': '🇨🇷', Panama: '🇵🇦',
};
const flag = (name: string) => FLAG[name] ?? '🏳';

interface MomentSummary {
  id: number;
  kind: string;
  status: string;
  closeTs: number;
  scoreP1: number;
  scoreP2: number;
  minute?: number;
  _count?: { mints: number };
}

interface FixtureAPI {
  id: string;
  p1Name: string;
  p2Name: string;
  kickoffTs: number;
  isLive: boolean;
  liveScoreP1: number | null;
  liveScoreP2: number | null;
  liveMinute: number | null;
  statusId: number | null;
  moments: MomentSummary[];
}

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
  });
}
function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Seoul',
  });
}
function fmtCountdown(secs: number) {
  if (secs <= 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isEnded(f: FixtureAPI) {
  return (f.statusId ?? 0) >= 100 || f.moments.some(m => m.kind === 'RESULT');
}

interface OpenMoment extends MomentSummary {
  fixtureId: string;
  p1Name: string;
  p2Name: string;
}

interface DropCardProps {
  moment: OpenMoment;
  now: number;
}

function DropCard({ moment, now }: DropCardProps) {
  const secs = Math.max(0, moment.closeTs - now);
  const urgent = secs < 60;
  const isGoal = moment.kind === 'GOAL';
  return (
    <a href={`/moment/${moment.id}`} className="drop-card">
      <div className={`drop-art${isGoal ? '' : ' result'}`}>
        <div className="drop-ball">{isGoal ? '⚽' : '🏆'}</div>
      </div>
      <div className="drop-body">
        <div className="drop-mark">
          {isGoal ? `GOAL${moment.minute ? ` · ${moment.minute}'` : ''}` : 'FULL TIME'}
        </div>
        <div className="drop-score">{moment.scoreP1} – {moment.scoreP2}</div>
        <div className={`drop-timer${urgent ? ' urgent' : ''}`}>{fmtCountdown(secs)}</div>
        {(moment._count?.mints ?? 0) > 0 && (
          <div className="drop-collected">{moment._count!.mints} collected</div>
        )}
      </div>
    </a>
  );
}

interface MatchRowProps {
  fixture: FixtureAPI;
  now: number;
}

function MatchRow({ fixture, now }: MatchRowProps) {
  const ended = isEnded(fixture);
  const openCount = fixture.moments.filter(m => m.status === 'OPEN' && m.closeTs > now).length;

  const scoreP1 = fixture.isLive
    ? (fixture.liveScoreP1 ?? 0)
    : fixture.moments.length
      ? Math.max(...fixture.moments.map(m => m.scoreP1))
      : null;
  const scoreP2 = fixture.isLive
    ? (fixture.liveScoreP2 ?? 0)
    : fixture.moments.length
      ? Math.max(...fixture.moments.map(m => m.scoreP2))
      : null;

  const p1Wins = scoreP1 !== null && scoreP2 !== null && scoreP1 > scoreP2;
  const p2Wins = scoreP1 !== null && scoreP2 !== null && scoreP2 > scoreP1;

  return (
    <a href={`/match/${fixture.id}`} className="match-row" style={{ display: 'grid' }}>
      <div className="match-row-teams">
        <div className={`match-row-team ${ended && p1Wins ? 'winner' : ended && p2Wins ? 'loser' : ''}`}>
          <span className="flag">{flag(fixture.p1Name)}</span>
          <span className="name">{fixture.p1Name}</span>
        </div>
        <div className={`match-row-team ${ended && p2Wins ? 'winner' : ended && p1Wins ? 'loser' : ''}`}>
          <span className="flag">{flag(fixture.p2Name)}</span>
          <span className="name">{fixture.p2Name}</span>
        </div>
      </div>

      <div className="match-row-scores">
        {scoreP1 !== null ? (
          <>
            <span className={`score-n ${ended && p1Wins ? 'winner' : ended && p2Wins ? 'loser' : ''}`}>{scoreP1}</span>
            <span className={`score-n ${ended && p2Wins ? 'winner' : ended && p1Wins ? 'loser' : ''}`}>{scoreP2}</span>
          </>
        ) : (
          <>
            <span className="score-n dash">–</span>
            <span className="score-n dash">–</span>
          </>
        )}
      </div>

      <div className="match-row-right">
        {fixture.isLive ? (
          <>
            <span className="status-live">● LIVE</span>
            {fixture.liveMinute !== null && (
              <span className="status-minute">{fixture.liveMinute}'</span>
            )}
          </>
        ) : ended ? (
          <span className="status-ended">FT</span>
        ) : fixture.kickoffTs > now ? (
          <>
            <span className="status-kickoff">{fmtTime(fixture.kickoffTs)}</span>
            <span style={{ fontSize: 9, color: 'var(--text3)' }}>{fmtDate(fixture.kickoffTs)}</span>
          </>
        ) : (
          <span className="status-kickoff">{fmtTime(fixture.kickoffTs)}</span>
        )}
        {openCount > 0 && (
          <span className="open-pill">{openCount} OPEN</span>
        )}
      </div>
    </a>
  );
}

export default function FeedPage() {
  const [fixtures, setFixtures] = useState<FixtureAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/fixtures');
      if (res.ok) setFixtures(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, 5000);
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    const es = new EventSource('/api/feed');
    es.onmessage = (raw) => {
      try { if (JSON.parse(raw.data).type === 'MOMENT_OPENED') fetchAll(); } catch {}
    };
    return () => { clearInterval(poll); clearInterval(tick); es.close(); };
  }, [fetchAll]);

  if (loading) return <div className="empty-state">Loading...</div>;

  const live     = fixtures.filter(f => f.isLive);
  const ended    = fixtures.filter(f => !f.isLive && isEnded(f));
  const upcoming = fixtures.filter(f => !f.isLive && !isEnded(f));

  const openMoments: OpenMoment[] = fixtures.flatMap(f =>
    f.moments
      .filter(m => m.status === 'OPEN' && m.closeTs > now)
      .map(m => ({ ...m, fixtureId: f.id, p1Name: f.p1Name, p2Name: f.p2Name }))
  );

  const hasAny = fixtures.length > 0;

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: 'var(--text3)', marginBottom: 28, textTransform: 'uppercase' }}>
        World Cup 2026
      </p>

      {/* MINTING NOW */}
      {openMoments.length > 0 && (
        <div className="match-section">
          <div className="section-head gold">
            <span className="live-dot" style={{ background: 'var(--gold)', animationDuration: '1s' }} />
            Minting now
          </div>
          <div className="drops">
            {openMoments.map(m => <DropCard key={m.id} moment={m} now={now} />)}
          </div>
        </div>
      )}

      {/* LIVE */}
      {live.length > 0 && (
        <div className="match-section">
          <div className="section-head live">
            <span className="live-dot" />
            Live
          </div>
          {live.map(f => <MatchRow key={f.id} fixture={f} now={now} />)}
        </div>
      )}

      {/* UPCOMING */}
      {upcoming.length > 0 && (
        <div className="match-section">
          <div className="section-head">Upcoming</div>
          {upcoming.map(f => <MatchRow key={f.id} fixture={f} now={now} />)}
        </div>
      )}

      {/* ENDED */}
      {ended.length > 0 && (
        <div className="match-section">
          <div className="section-head">Ended</div>
          {ended.map(f => <MatchRow key={f.id} fixture={f} now={now} />)}
        </div>
      )}

      {!hasAny && (
        <div className="empty-state">No fixtures yet. Run the keeper in replay mode to demo.</div>
      )}
    </div>
  );
}
