'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
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

export default function MatchPage() {
  const { id } = useParams();
  const [fixture, setFixture] = useState<Fixture | null>(null);

  const fetchFixture = useCallback(async () => {
    const res = await fetch('/api/fixtures');
    const all: Fixture[] = await res.json();
    setFixture(all.find(f => f.id === id) ?? null);
  }, [id]);

  useEffect(() => {
    fetchFixture();
    const es = new EventSource('/api/feed');
    es.onmessage = (raw) => {
      try {
        const msg = JSON.parse(raw.data);
        if (msg.type === 'MOMENT_OPENED' && msg.moment.fixtureId === id) fetchFixture();
      } catch {}
    };
    return () => es.close();
  }, [fetchFixture, id]);

  if (!fixture) return <p style={{ color: '#333' }}>—</p>;

  const now = Math.floor(Date.now() / 1000);
  const open    = fixture.moments.filter(m => m.status === 'OPEN' && m.closeTs > now);
  const openResult = open.filter(m => m.kind === 'RESULT');
  const openGoal   = open.filter(m => m.kind !== 'RESULT');
  const closed = fixture.moments.filter(m => !open.includes(m));
  const closedResult = closed.filter(m => m.kind === 'RESULT');
  const closedGoal   = closed.filter(m => m.kind !== 'RESULT');

  return (
    <div>
      <a href="/" style={{ color: '#555', fontSize: 10, letterSpacing: 1, display: 'block', marginBottom: 24 }}>
        ← BACK
      </a>

      <div style={{ marginBottom: 32 }}>
        <p style={{ color: '#444', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>
          {new Date(fixture.kickoffTs * 1000).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
          })} KST
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: 2 }}>
          {fixture.p1Name} <span style={{ color: '#444' }}>vs</span> {fixture.p2Name}
        </h1>
      </div>

      {openResult.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, color: '#fff', letterSpacing: 2, marginBottom: 16 }}>
            WINNER — MINT NOW
          </p>
          <div className="grid">
            {openResult.map(m => <MomentCard key={m.id} moment={m} onMinted={fetchFixture} />)}
          </div>
        </section>
      )}

      {openGoal.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, color: '#fff', letterSpacing: 2, marginBottom: 16 }}>
            GOALS — MINT NOW
          </p>
          <div className="grid">
            {openGoal.map(m => <MomentCard key={m.id} moment={m} onMinted={fetchFixture} />)}
          </div>
        </section>
      )}

      {closedResult.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 16 }}>
            PAST WINNER
          </p>
          <div className="grid">
            {closedResult.map(m => <MomentCard key={m.id} moment={m} onMinted={fetchFixture} />)}
          </div>
        </section>
      )}

      {closedGoal.length > 0 && (
        <section>
          <p style={{ fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 16 }}>
            PAST GOALS
          </p>
          <div className="grid">
            {closedGoal.map(m => <MomentCard key={m.id} moment={m} onMinted={fetchFixture} />)}
          </div>
        </section>
      )}

      {fixture.moments.length === 0 && (
        <p style={{ color: '#333', fontSize: 10 }}>waiting for events</p>
      )}
    </div>
  );
}
