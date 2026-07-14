'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { Moment } from '@momento/shared';
import { MomentCard } from '@/components/MomentCard';

const FLAG: Record<string, string> = {
  Argentina: '🇦🇷', Switzerland: '🇨🇭', France: '🇫🇷', Spain: '🇪🇸',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Brazil: '🇧🇷', Germany: '🇩🇪', Portugal: '🇵🇹',
  Netherlands: '🇳🇱', Italy: '🇮🇹', USA: '🇺🇸', Mexico: '🇲🇽',
  Japan: '🇯🇵', 'South Korea': '🇰🇷', Morocco: '🇲🇦', Croatia: '🇭🇷',
  Denmark: '🇩🇰', Uruguay: '🇺🇾', Colombia: '🇨🇴', Nigeria: '🇳🇬',
  Qatar: '🇶🇦', Canada: '🇨🇦', 'Saudi Arabia': '🇸🇦',
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

  // Score to display
  const scoreP1 = fixture.isLive
    ? (fixture.liveScoreP1 ?? 0)
    : fixture.moments.length ? Math.max(...fixture.moments.map(m => m.scoreP1)) : 0;
  const scoreP2 = fixture.isLive
    ? (fixture.liveScoreP2 ?? 0)
    : fixture.moments.length ? Math.max(...fixture.moments.map(m => m.scoreP2)) : 0;

  const p1Wins = scoreP1 > scoreP2;
  const p2Wins = scoreP2 > scoreP1;

  const open   = fixture.moments.filter(m => m.status === 'OPEN' && m.closeTs > now);
  const closed = fixture.moments.filter(m => !open.includes(m));

  return (
    <div>
      <a href="/" className="back-link">← Back</a>

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
              {fixture.moments.length > 0 || fixture.isLive
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

      {/* Open moments */}
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
  );
}
