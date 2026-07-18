'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { Moment } from '@momento/shared';
import { MomentCard } from '@/components/MomentCard';
import { PredictionPanel } from '@/components/PredictionPanel';

const FLAG: Record<string, string> = {
  Argentina: '🇦🇷', Switzerland: '🇨🇭', France: '🇫🇷', Spain: '🇪🇸',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Brazil: '🇧🇷', Germany: '🇩🇪', Portugal: '🇵🇹',
  Netherlands: '🇳🇱', Italy: '🇮🇹', USA: '🇺🇸', Mexico: '🇲🇽',
  Japan: '🇯🇵', 'South Korea': '🇰🇷', Morocco: '🇲🇦', Croatia: '🇭🇷',
  Denmark: '🇩🇰', Uruguay: '🇺🇾', Colombia: '🇨🇴', Nigeria: '🇳🇬',
  Qatar: '🇶🇦', Canada: '🇨🇦', 'Saudi Arabia': '🇸🇦', 'Cabo Verde': '🇨🇻',
};
const flag = (name: string) => FLAG[name] ?? '🏳';

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
  moments: (Moment & { _count?: { mints: number } })[];
}

export default function MatchPage() {
  const { id } = useParams();
  const [fixture, setFixture] = useState<FixtureAPI | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  const fetchFixture = useCallback(async () => {
    const res = await fetch('/api/fixtures');
    const all: FixtureAPI[] = await res.json();
    setFixture(all.find(f => f.id === id) ?? null);
  }, [id]);

  useEffect(() => {
    fetchFixture();
    const poll = setInterval(fetchFixture, 5000);
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    const es = new EventSource('/api/feed');
    es.onmessage = (raw) => {
      try {
        const msg = JSON.parse(raw.data);
        if (msg.type === 'MOMENT_OPENED' && msg.moment.fixtureId === id) fetchFixture();
      } catch {}
    };
    return () => { clearInterval(poll); clearInterval(tick); es.close(); };
  }, [fetchFixture, id]);

  if (!fixture) return <div className="empty-state">Loading...</div>;

  const isEnded = (fixture.statusId ?? 0) >= 100 || fixture.moments.some(m => m.kind === 'RESULT');

  const scoreP1 = fixture.isLive
    ? (fixture.liveScoreP1 ?? 0)
    : isEnded && fixture.moments.length ? Math.max(...fixture.moments.map(m => m.scoreP1)) : null;
  const scoreP2 = fixture.isLive
    ? (fixture.liveScoreP2 ?? 0)
    : isEnded && fixture.moments.length ? Math.max(...fixture.moments.map(m => m.scoreP2)) : null;

  const p1Wins = scoreP1 !== null && scoreP2 !== null && scoreP1 > scoreP2;
  const p2Wins = scoreP1 !== null && scoreP2 !== null && scoreP2 > scoreP1;

  const open   = fixture.moments.filter(m => m.status === 'OPEN' && m.closeTs > now && !(m as any).isPredictionReward);
  const closed = fixture.moments.filter(m => !open.includes(m) && !(m as any).isPredictionReward);

  const featured = open[0] ?? null;

  // prediction reward moment (hidden from main grid, shown via PredictionPanel)
  const rewardMoment = fixture.moments.find((m: any) => m.isPredictionReward) ?? null;
  const featuredSecsLeft = featured ? Math.max(0, featured.closeTs - now) : 0;
  const featuredUrgent   = featuredSecsLeft < 60;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const topMints = fixture.moments
    .filter(m => (m._count?.mints ?? 0) > 0)
    .sort((a, b) => (b._count?.mints ?? 0) - (a._count?.mints ?? 0))
    .slice(0, 4);

  return (
    <div className="match-layout">
      {/* Main column */}
      <div>
        <a href="/feed" className="back-link">← Back</a>

        {/* Match hero header */}
        <div className="match-hero">
          <div className="match-hero-competition">World Cup 2026</div>
          <div className="match-hero-teams">
            <div className={`match-hero-team${isEnded && p1Wins ? ' winner' : ''}`}>
              <span className="flag">{flag(fixture.p1Name)}</span>
              <span className="name">{fixture.p1Name}</span>
            </div>

            <div className="match-hero-score-block">
              <div className="match-hero-score">
                {scoreP1 !== null && scoreP2 !== null
                  ? `${scoreP1} – ${scoreP2}`
                  : 'vs'
                }
              </div>
              <div className="match-hero-status">
                {fixture.isLive ? (
                  <>
                    <span className="live-dot" />
                    <span style={{ color: 'var(--live)' }}>
                      LIVE{fixture.liveMinute !== null ? ` · ${fixture.liveMinute}'` : ''}
                    </span>
                  </>
                ) : isEnded ? (
                  <span style={{ color: 'var(--text3)', letterSpacing: 2 }}>FT</span>
                ) : (
                  <span style={{ color: 'var(--text2)' }}>
                    {new Date(fixture.kickoffTs * 1000).toLocaleTimeString('en-GB', {
                      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
                    })} KST
                  </span>
                )}
              </div>
            </div>

            <div className={`match-hero-team${isEnded && p2Wins ? ' winner' : ''}`}>
              <span className="flag">{flag(fixture.p2Name)}</span>
              <span className="name">{fixture.p2Name}</span>
            </div>
          </div>
        </div>

        {/* Prediction Panel */}
        <PredictionPanel
          fixtureId={fixture.id}
          p1Name={fixture.p1Name}
          p2Name={fixture.p2Name}
          kickoffTs={fixture.kickoffTs}
          statusId={fixture.statusId}
          liveScoreP1={fixture.liveScoreP1}
          liveScoreP2={fixture.liveScoreP2}
          rewardMomentId={(rewardMoment as any)?.id ?? null}
        />

        {/* Featured open moment — Mint Hero Banner */}
        {featured && (
          <div className={`mint-hero-banner${featuredUrgent ? ' urgent' : ''}`} style={{ display: 'flex', gap: 0, overflow: 'hidden' }}>
            {featured.imageUrl && (
              <img
                src={featured.imageUrl}
                alt={featured.kind === 'GOAL' ? `Goal ${featured.scoreP1}–${featured.scoreP2}` : `Full Time ${featured.scoreP1}–${featured.scoreP2}`}
                style={{ width: 200, flexShrink: 0, objectFit: 'cover', display: 'block' }}
              />
            )}
            <div style={{ flex: 1, position: 'relative' }}>
              <div className="mint-hero-banner-bg" />
              <div className="mint-hero-banner-open-badge">Minting Window Open</div>
              <div className="mint-hero-banner-body">
                <span className="mint-hero-banner-kind">
                  {featured.kind === 'GOAL'
                    ? `GOAL${featured.minute ? ` · ${featured.minute}'` : ''}`
                    : 'FULL TIME'}
                </span>
                <div className="mint-hero-banner-score">{featured.scoreP1}–{featured.scoreP2}</div>
                {(featured._count?.mints ?? 0) > 0 && (
                  <div className="mint-hero-banner-collected">{featured._count!.mints} collected so far</div>
                )}
                <div className="mint-hero-banner-actions">
                  <div className={`mint-hero-banner-countdown${featuredUrgent ? ' urgent' : ''}`}>
                    {fmt(featuredSecsLeft)}
                  </div>
                  <a href={`/moment/${featured.id}`} className="mint-hero-banner-btn">
                    Mint Now
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Open moments grid */}
        {open.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div className="sub-head active">Mint now — {open.length} open</div>
            <div className="moment-grid">
              {open.map(m => <MomentCard key={m.id} moment={m} onMinted={fetchFixture} />)}
            </div>
          </section>
        )}

        {/* Closed moments */}
        {closed.length > 0 && (
          <section>
            <div className="sub-head">Past moments</div>
            <div className="moment-grid">
              {closed.map(m => <MomentCard key={m.id} moment={m} onMinted={fetchFixture} />)}
            </div>
          </section>
        )}

        {fixture.moments.length === 0 && (
          <div className="empty-state">No moments yet for this match.</div>
        )}
      </div>

      {/* Right Rail */}
      <aside className="right-rail">
        <div className="promo-card">
          <div className="promo-card-title">Match Mints</div>
          <div className="promo-card-subtitle">Most collected</div>
          {topMints.length > 0 ? topMints.map((m, i) => (
            <div key={i} className="promo-card-row">
              <span className="promo-card-label">
                {m.kind === 'GOAL' ? `Goal${m.minute ? ` ${m.minute}'` : ''}` : 'Full Time'}
              </span>
              <span className="promo-card-value">{m._count?.mints}</span>
            </div>
          )) : (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>No mints yet</div>
          )}
        </div>
        <div className="promo-card">
          <div className="promo-card-title">Match Info</div>
          <div className="promo-card-subtitle">World Cup 2026</div>
          <div className="promo-card-row">
            <span className="promo-card-label">{fixture.p1Name}</span>
            <span className="promo-card-value">{flag(fixture.p1Name)}</span>
          </div>
          <div className="promo-card-row">
            <span className="promo-card-label">{fixture.p2Name}</span>
            <span className="promo-card-value">{flag(fixture.p2Name)}</span>
          </div>
          {open.length > 0 && (
            <div className="promo-card-row">
              <span className="promo-card-label">Open mints</span>
              <span className="promo-card-value">{open.length}</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
