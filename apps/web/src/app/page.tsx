'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Moment } from '@momento/shared';

interface Fixture {
  id: string;
  p1Name: string;
  p2Name: string;
  kickoffTs: number;
  moments: Moment[];
}

const FLAG: Record<string, string> = {
  'France': '🇫🇷', 'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Argentina': '🇦🇷',
  'Brazil': '🇧🇷', 'Germany': '🇩🇪', 'Portugal': '🇵🇹', 'Netherlands': '🇳🇱',
  'Italy': '🇮🇹', 'USA': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Morocco': '🇲🇦', 'Switzerland': '🇨🇭',
  'Croatia': '🇭🇷', 'Belgium': '🇧🇪', 'Denmark': '🇩🇰', 'Serbia': '🇷🇸',
  'Poland': '🇵🇱', 'Australia': '🇦🇺', 'Ghana': '🇬🇭', 'Senegal': '🇸🇳',
  'Uruguay': '🇺🇾', 'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 'Chile': '🇨🇱',
  'Saudi Arabia': '🇸🇦', 'Iran': '🇮🇷', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Turkey': '🇹🇷', 'Ukraine': '🇺🇦', 'Austria': '🇦🇹', 'Hungary': '🇭🇺',
  'New Zealand': '🇳🇿', 'Costa Rica': '🇨🇷', 'Panama': '🇵🇦', 'Honduras': '🇭🇳',
  'Paraguay': '🇵🇾', 'Bolivia': '🇧🇴', 'Peru': '🇵🇪', 'Venezuela': '🇻🇪',
  'Nigeria': '🇳🇬', 'Cameroon': '🇨🇲', 'Tunisia': '🇹🇳', 'Egypt': '🇪🇬',
  'Algeria': '🇩🇿', 'Mali': '🇲🇱', 'Ivory Coast': '🇨🇮', 'Congo': '🇨🇩',
  'South Africa': '🇿🇦', 'Kenya': '🇰🇪', 'Qatar': '🇶🇦', 'UAE': '🇦🇪',
  'China': '🇨🇳', 'Indonesia': '🇮🇩', 'Thailand': '🇹🇭', 'Vietnam': '🇻🇳',
};

function flag(name: string) {
  return FLAG[name] ?? '🏳';
}

function MatchStatus({ kickoffTs, moments }: { kickoffTs: number; moments: Moment[] }) {
  const [diff, setDiff] = useState(kickoffTs - Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setDiff(kickoffTs - Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, [kickoffTs]);

  const hasResult = moments.some(m => m.kind === 'RESULT');

  if (hasResult) return <span style={{ color: '#444', fontSize: 9, letterSpacing: 1 }}>ENDED</span>;
  if (diff <= 0) return <span style={{ color: '#fff', fontSize: 9, letterSpacing: 1 }}>● LIVE</span>;

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const days = Math.floor(h / 24);
  const label = days >= 1 ? `${days}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return <span style={{ color: '#555', fontSize: 9, letterSpacing: 1 }}>{label}</span>;
}

function Score({ moments }: { moments: Moment[] }) {
  const last = [...moments].sort((a, b) => b.seq - a.seq)[0];
  if (!last) return null;
  return (
    <span style={{ fontSize: 13, color: '#fff', letterSpacing: 2 }}>
      {last.scoreP1} – {last.scoreP2}
    </span>
  );
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
        if (msg.type === 'MOMENT_OPENED') fetchAll();
      } catch {}
    };
    return () => es.close();
  }, [fetchAll]);

  if (loading) return <p style={{ color: '#333' }}>—</p>;

  const sorted = [...fixtures].sort((a, b) => a.kickoffTs - b.kickoffTs);

  return (
    <div>
      <p style={{ color: '#444', fontSize: 10, marginBottom: 24, letterSpacing: 1 }}>
        WORLD CUP 2026
      </p>
      <div className="match-scroll">
        {sorted.map(fixture => {
          const openMoments = fixture.moments.filter(m => m.status === 'OPEN' && m.closeTs > Math.floor(Date.now() / 1000));
          return (
            <a key={fixture.id} href={`/match/${fixture.id}`} className="match-card">
              <div className="match-card-status">
                <MatchStatus kickoffTs={fixture.kickoffTs} moments={fixture.moments} />
                {openMoments.length > 0 && (
                  <span style={{ color: '#fff', fontSize: 9, marginLeft: 8 }}>
                    {openMoments.length} OPEN
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flexWrap: 'wrap' }}>
                <span>{flag(fixture.p1Name)} {fixture.p1Name}</span>
                <span style={{ color: '#333' }}>vs</span>
                <span>{flag(fixture.p2Name)} {fixture.p2Name}</span>
              </div>
              <Score moments={fixture.moments} />
              <div className="match-card-footer">
                {fixture.moments.length} moments
              </div>
            </a>
          );
        })}
        {sorted.length === 0 && (
          <p style={{ color: '#333' }}>no fixtures</p>
        )}
      </div>
    </div>
  );
}
