'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface MintRecord {
  id: number;
  momentId: number;
  assetId: string;
  txSig: string;
  createdAt: number;
  moment: {
    kind: string;
    scoreP1: number;
    scoreP2: number;
    minute?: number;
    fixtureId: string;
    imageUrl?: string;
    status: string;
  };
}

export default function CollectionPage() {
  const { publicKey, connected } = useWallet();
  const [mints, setMints] = useState<MintRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    fetch(`/api/mints?wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(data => { setMints(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [publicKey]);

  if (!connected) {
    return (
      <div>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 2.5, color: 'var(--text3)',
          textTransform: 'uppercase', marginBottom: 28,
        }}>
          My Collection
        </p>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 20 }}>
          Connect your wallet to view your moments.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  const wallet = publicKey?.toBase58() ?? '';

  return (
    <div>
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 2.5, color: 'var(--text3)',
        textTransform: 'uppercase', marginBottom: 6,
      }}>
        My Collection
      </p>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 28, fontFamily: 'var(--mono)' }}>
        {wallet.slice(0, 8)}…{wallet.slice(-6)}
      </p>

      {loading && <div className="empty-state">Loading…</div>}

      {!loading && mints.length === 0 && (
        <div className="empty-state">No moments minted yet.</div>
      )}

      <div className="collection-grid">
        {mints.map(m => (
          <div key={m.id} className="collection-item">
            {m.moment.imageUrl ? (
              <img src={m.moment.imageUrl} alt="moment" loading="lazy" />
            ) : (
              <div style={{
                width: '100%', aspectRatio: '4/3', background: 'var(--surface2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 9, color: 'var(--text3)' }}>—</span>
              </div>
            )}

            <div className="collection-item-body">
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
                color: m.moment.kind === 'GOAL' ? 'var(--gold)' : 'var(--text2)',
                marginBottom: 4,
              }}>
                {m.moment.kind === 'GOAL' ? 'Goal' : 'Full Time'}
                {m.moment.kind === 'GOAL' && m.moment.minute ? ` · ${m.moment.minute}'` : ''}
              </div>

              <div style={{
                fontSize: 18, fontWeight: 900, fontFamily: 'var(--mono)',
                letterSpacing: 2, color: 'var(--text)', marginBottom: 8,
              }}>
                {m.moment.scoreP1}–{m.moment.scoreP2}
              </div>

              {!m.assetId.startsWith('no-keeper') && !m.assetId.startsWith('pending') && (
                <a
                  href={`https://explorer.solana.com/address/${m.assetId}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="explorer-link"
                >
                  ↗ View NFT
                </a>
              )}

              <p style={{ fontSize: 9, color: 'var(--text3)', marginTop: 6, fontFamily: 'var(--mono)' }}>
                {new Date(m.createdAt * 1000).toLocaleString('en-GB', {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: false,
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
