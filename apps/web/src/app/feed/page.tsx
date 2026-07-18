'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

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

function isEnded(f: FixtureAPI) {
  return (f.statusId ?? 0) >= 100 || f.moments.some(m => m.kind === 'RESULT');
}

interface MatchRowProps {
  fixture: FixtureAPI;
  now: number;
}

interface DropItem extends MomentSummary { fixtureId: string; }

function DropCard({ drop, now, animIndex, isNew }: { drop: DropItem; now: number; animIndex: number; isNew: boolean }) {
  const [hover, setHover] = useState(false);
  const secsLeft = Math.max(0, drop.closeTs - now);
  const m = Math.floor(secsLeft / 60);
  const s = String(secsLeft % 60).padStart(2, '0');
  const urgent = secsLeft < 60;
  // new drops animate at index 0 (front); initial mount staggers all cards
  const delay = isNew ? `${animIndex * 80}ms` : '0ms';
  return (
    <a
      href={`/moment/${drop.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--accent-blue)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'block',
        transition: 'transform .15s, box-shadow .15s',
        transform: hover ? 'translateY(-3px)' : 'none',
        boxShadow: hover ? '0 0 0 1px var(--accent-blue), 0 12px 32px rgba(59,108,246,0.25)' : '0 0 0 1px var(--accent-blue)',
        textDecoration: 'none',
        animation: 'drop-in 300ms ease-out both',
        animationDelay: delay,
      }}
    >
      <div style={{ width: '100%', aspectRatio: '4/3', background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--surface2) 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>MOMENT IMAGE</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
          {drop.kind === 'GOAL' ? `Goal${drop.minute ? ` · ${drop.minute}'` : ''}` : 'Full Time'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#fff', letterSpacing: 2, marginBottom: 8 }}>
          {drop.scoreP1}–{drop.scoreP2}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text2)', marginBottom: 12 }}>
          <span>{drop._count?.mints ?? 0} minted</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: urgent ? 'var(--danger)' : 'var(--gold)', fontWeight: 800, fontSize: 13 }}>{m}:{s}</span>
        </div>
        <div style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-blue)', color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center', fontFamily: 'var(--font-display)' }}>
          Mint Now
        </div>
      </div>
    </a>
  );
}

function MatchRow({ fixture, now }: MatchRowProps) {
  const ended = isEnded(fixture);
  const openCount = fixture.moments.filter(m => m.status === 'OPEN' && m.closeTs > now).length;

  const scoreP1 = fixture.isLive
    ? (fixture.liveScoreP1 ?? 0)
    : ended && fixture.moments.length
      ? Math.max(...fixture.moments.map(m => m.scoreP1))
      : null;
  const scoreP2 = fixture.isLive
    ? (fixture.liveScoreP2 ?? 0)
    : ended && fixture.moments.length
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
  // tracks IDs seen on previous render to detect new real-time drops
  const seenDropIds = useRef<Set<number>>(new Set());

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

  const live     = fixtures.filter(f => f.isLive);
  const ended    = fixtures.filter(f => !f.isLive && isEnded(f));
  const upcoming = fixtures.filter(f => !f.isLive && !isEnded(f));
  const hasAny   = fixtures.length > 0;

  // Live drops: open moments from all fixtures, newest first
  const liveDrops = fixtures
    .flatMap(f =>
      f.moments
        .filter(m => m.status === 'OPEN' && m.closeTs > now)
        .map(m => ({ ...m, fixtureId: f.id }))
    )
    .sort((a, b) => b.id - a.id);

  // Right-rail data
  const topMints = fixtures
    .flatMap(f => f.moments.filter(m => (m._count?.mints ?? 0) > 0).map(m => ({
      label: `${f.p1Name} · ${m.kind === 'GOAL' ? `Goal${m.minute ? ` ${m.minute}'` : ''}` : 'Full Time'}`,
      value: String(m._count?.mints ?? 0),
    })))
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 4);

  const GROUPS = [
    { id: 'all', label: 'All Fixtures', icon: '🌍' },
    { id: 'g-a', label: 'Group A', icon: '⚽' },
    { id: 'g-b', label: 'Group B', icon: '⚽' },
    { id: 'g-c', label: 'Group C', icon: '⚽' },
    { id: 'knockout', label: 'Knockout Stage', icon: '🏆' },
  ];

  const liveFixture = live[0] ?? null;
  const liveLabel = liveFixture
    ? `${liveFixture.p1Name} vs ${liveFixture.p2Name}${liveFixture.liveMinute != null ? ` · ${liveFixture.liveMinute}'` : ''}`
    : null;

  const Feed = (
    <div>
      {/* WorldCupHero — 21/9 full-bleed, spec from design_handoff README */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '21/9', overflow: 'hidden', background: 'var(--surface)', marginBottom: 28 }}>
        <img src="/hero-world-cup-collage.png" alt="Momento — World Cup 2026" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: '50% 60%',
          filter: 'saturate(0.55) brightness(0.35) contrast(1.05) blur(3px)',
          transform: 'scale(1.25)',
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, rgba(7,7,16,0.98) 0%, rgba(7,7,16,0.88) 30%, rgba(7,7,16,0.55) 58%, rgba(7,7,16,0.7) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, var(--bg) 0%, transparent 32%, transparent 100%)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 40px 32px', maxWidth: 620 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800, letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--gold-light)', marginBottom: 14 }}>2026 FIFA World Cup</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 900, lineHeight: 1.03, color: '#fff', margin: '0 0 14px', letterSpacing: '-0.5px' }}>Collect Every Moment.</h2>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: 'rgba(234,234,245,0.72)', margin: '0 0 26px', maxWidth: 480 }}>Officially minted goals, saves &amp; moments from the tournament — yours to own, forever.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href={liveFixture ? `/match/${liveFixture.id}` : '/feed'} style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, letterSpacing: 0.4, color: '#1a1206', background: 'linear-gradient(180deg, var(--gold-light) 0%, var(--gold) 100%)', border: 'none', borderRadius: 6, padding: '13px 24px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              {liveFixture ? 'Mint Now' : 'Explore Drops'}
            </a>
            {liveLabel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--live)', boxShadow: '0 0 0 3px var(--live-dim)', flexShrink: 0 }} />
                {liveLabel}
              </div>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: 'var(--text3)', marginBottom: 28, textTransform: 'uppercase' }}>
        World Cup 2026
      </p>

      {/* LIVE DROPS */}
      {liveDrops.length > 0 && (() => {
        // compute isNew before updating ref so new cards animate
        const rendered = liveDrops.map((m, i) => ({
          drop: m,
          animIndex: i,
          isNew: !seenDropIds.current.has(m.id),
        }));
        // update seen set for next render
        const newSet = new Set(liveDrops.map(m => m.id));
        seenDropIds.current = newSet;
        return (
          <section style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Live Drops</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {rendered.map(({ drop, animIndex, isNew }) => (
                <DropCard key={drop.id} drop={drop} now={now} animIndex={animIndex} isNew={isNew} />
              ))}
            </div>
          </section>
        );
      })()}

      {loading && <div className="empty-state">Loading...</div>}

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

      {!loading && !hasAny && (
        <div className="empty-state">No fixtures yet. Run the keeper in replay mode to demo.</div>
      )}
    </div>
  );

  return (
    <div className="home-layout">
      {/* Sidebar */}
      <aside className="sidebar-panel">
        <div className="sidebar-panel-title">Groups</div>
        {GROUPS.map(g => (
          <a key={g.id} href="/feed" className={`sidebar-item${g.id === 'all' ? ' active' : ''}`}>
            <span className="icon">{g.icon}</span>
            {g.label}
          </a>
        ))}
      </aside>

      {/* Feed */}
      {Feed}

      {/* Right Rail */}
      <aside className="right-rail">
        <div className="promo-card">
          <div className="promo-card-title">Top Mints</div>
          <div className="promo-card-subtitle">Most collected</div>
          {topMints.length > 0 ? topMints.map((item, i) => (
            <div key={i} className="promo-card-row">
              <span className="promo-card-label">{item.label}</span>
              <span className="promo-card-value">{item.value}</span>
            </div>
          )) : (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>No mints yet</div>
          )}
        </div>
        <div className="promo-card">
          <div className="promo-card-title">Live Now</div>
          <div className="promo-card-subtitle">
            {live.length > 0 ? `${live.length} fixture${live.length > 1 ? 's' : ''} in progress` : 'No live games'}
          </div>
          {live.map(f => (
            <div key={f.id} className="promo-card-row">
              <span className="promo-card-label">{f.p1Name} — {f.p2Name}</span>
              {f.liveMinute != null && <span className="promo-card-value">{f.liveMinute}&apos;</span>}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
