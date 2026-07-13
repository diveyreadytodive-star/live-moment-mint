'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Moment } from '@momento/shared';
import { MomentCard } from '@/components/MomentCard';

interface Fixture {
  id: string;
  p1Name: string;
  p2Name: string;
  p1Color: string;
  p2Color: string;
  kickoffTs: number;
  moments: Moment[];
}

function formatKickoff(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleString('ko-KR', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
}

function FixtureStatus({ kickoffTs }: { kickoffTs: number }) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = kickoffTs - now;
  if (diff > 0) {
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 48) return <span className="badge badge-upcoming">UPCOMING</span>;
    return (
      <span className="badge badge-upcoming">
        킥오프까지 {h > 0 ? `${h}h ` : ''}{m}m {s}s
      </span>
    );
  }
  return <span className="badge badge-live">● LIVE</span>;
}

export default function FeedPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/fixtures');
      const data = await res.json();
      setFixtures(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();

    const es = new EventSource('/api/feed');
    es.onmessage = (raw) => {
      try {
        const msg = JSON.parse(raw.data);
        if (msg.type === 'MOMENT_OPENED') {
          setFixtures(prev => prev.map(f =>
            f.id === msg.moment.fixtureId
              ? { ...f, moments: [msg.moment, ...f.moments] }
              : f
          ));
        }
      } catch {}
    };
    return () => es.close();
  }, [fetchAll]);

  if (loading) return <p style={{ color: '#9ca3af', padding: 24 }}>Loading...</p>;

  if (fixtures.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
        <p style={{ fontSize: 32, marginBottom: 16 }}>⚽</p>
        <p>경기 데이터가 없습니다.</p>
        <p style={{ fontSize: 11, marginTop: 8 }}>Keeper가 실행되면 자동으로 업데이트됩니다.</p>
      </div>
    );
  }

  return (
    <div>
      {fixtures.map(fixture => (
        <div key={fixture.id} className="fixture-section">
          {/* Fixture Header */}
          <div className="fixture-header">
            <div className="fixture-teams">
              <span style={{ color: fixture.p1Color, fontWeight: 'bold' }}>{fixture.p1Name}</span>
              <span style={{ color: '#4b5563', margin: '0 12px', fontSize: 14 }}>vs</span>
              <span style={{ color: fixture.p2Color, fontWeight: 'bold' }}>{fixture.p2Name}</span>
            </div>
            <div className="fixture-meta">
              <FixtureStatus kickoffTs={fixture.kickoffTs} />
              <span style={{ color: '#6b7280', fontSize: 10, marginLeft: 8 }}>
                {formatKickoff(fixture.kickoffTs)} KST
              </span>
            </div>
          </div>

          {/* Moments Grid */}
          {fixture.moments.length > 0 ? (
            <div className="grid">
              {fixture.moments.map(m => (
                <MomentCard key={m.id} moment={m} onMinted={fetchAll} />
              ))}
            </div>
          ) : (
            <div className="fixture-empty">
              <span>⏳</span> 골/결과 이벤트 대기 중...
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
