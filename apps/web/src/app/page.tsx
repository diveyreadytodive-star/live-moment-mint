'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Moment } from '@momento/shared';
import { MomentCard } from '@/components/MomentCard';

interface Fixture {
  id: string;
  p1Name: string;
  p2Name: string;
  kickoffTs: number;
  moments: Moment[];
}

function Countdown({ kickoffTs }: { kickoffTs: number }) {
  const [diff, setDiff] = useState(kickoffTs - Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setDiff(kickoffTs - Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, [kickoffTs]);

  if (diff <= 0) return <span className="badge badge-live">LIVE</span>;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const label = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  return <span className="badge badge-upcoming">{label}</span>;
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul', hour12: false,
  }) + ' KST';
}

export default function FeedPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/fixtures');
      setFixtures(await res.json());
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

  if (loading) return <p style={{ color: '#333', padding: 24 }}>—</p>;

  return (
    <div>
      {fixtures.map(fixture => (
        <div key={fixture.id} className="fixture-section">
          <div className="fixture-header">
            <span className="fixture-teams">
              {fixture.p1Name} <span style={{ color: '#444' }}>vs</span> {fixture.p2Name}
            </span>
            <div className="fixture-meta">
              <Countdown kickoffTs={fixture.kickoffTs} />
              <span>{formatDate(fixture.kickoffTs)}</span>
            </div>
          </div>

          {fixture.moments.length > 0 ? (
            <div className="grid">
              {fixture.moments.map(m => (
                <MomentCard key={m.id} moment={m} onMinted={fetchAll} />
              ))}
            </div>
          ) : (
            <div className="fixture-empty">waiting for events</div>
          )}
        </div>
      ))}

      {!loading && fixtures.length === 0 && (
        <p style={{ color: '#333' }}>no fixtures</p>
      )}
    </div>
  );
}
