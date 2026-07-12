'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function MomentPage() {
  const { id } = useParams();
  const [moment, setMoment] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/moments/${id}`).then(r => r.json()).then(setMoment);
  }, [id]);

  if (!moment) return <div style={{ padding: 24, color: '#9ca3af' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      {moment.imageUrl && (
        <img src={moment.imageUrl} alt="Moment" style={{ width: '100%', borderRadius: 8 }} />
      )}
      <div style={{ marginTop: 16 }}>
        <div style={{ color: '#10b981', marginBottom: 8 }}>
          {moment.kind} #{moment.id}
        </div>
        <div style={{ color: '#9ca3af', fontSize: 11 }}>
          {moment.scoreP1} – {moment.scoreP2} | {moment.minute ? `${moment.minute}'` : 'FT'}
        </div>
        {moment.momentPda && (
          <div style={{ marginTop: 12, fontSize: 10, color: '#6b7280' }}>
            On-chain:{' '}
            <a
              href={`https://explorer.solana.com/address/${moment.momentPda}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#60a5fa' }}
            >
              {moment.momentPda.substring(0, 20)}...
            </a>
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 10, color: '#6b7280' }}>
          Mints: {moment.mints?.length ?? 0}
        </div>
        <div style={{ marginTop: 16 }}>
          <a href="/" style={{ color: '#60a5fa', fontSize: 11 }}>
            ← back to feed
          </a>
        </div>
      </div>
    </div>
  );
}
