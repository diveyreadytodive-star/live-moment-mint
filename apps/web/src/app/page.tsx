'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Moment } from '@momento/shared';
import { MomentCard } from '@/components/MomentCard';

export default function FeedPage() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMoments = useCallback(async () => {
    try {
      const res = await fetch('/api/moments?status=OPEN');
      const data = await res.json();
      setMoments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMoments();

    // Subscribe to live feed via SSE
    const es = new EventSource('/api/feed');
    es.onmessage = (raw) => {
      try {
        const msg = JSON.parse(raw.data);
        if (msg.type === 'MOMENT_OPENED') {
          setMoments((prev) => [msg.moment, ...prev]);
        } else if (msg.type === 'MOMENT_CLOSED') {
          setMoments((prev) =>
            prev.map((m) => m.id === msg.momentId ? { ...m, status: 'CLOSED' as const } : m)
          );
        }
      } catch {}
    };

    return () => es.close();
  }, [fetchMoments]);

  if (loading) return <p style={{ color: '#9ca3af' }}>Loading moments...</p>;

  if (moments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
        <p style={{ fontSize: 24, marginBottom: 16 }}>⚽</p>
        <p>No active minting windows.</p>
        <p style={{ marginTop: 8, fontSize: 10 }}>Waiting for the next goal...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 16, color: '#10b981' }}>LIVE MOMENTS</h1>
      <div className="grid">
        {moments.map((m) => (
          <MomentCard key={m.id} moment={m} onMinted={fetchMoments} />
        ))}
      </div>
    </div>
  );
}
