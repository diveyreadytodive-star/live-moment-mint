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
        <p style={{ color: '#444', fontSize: 10, letterSpacing: 1, marginBottom: 24 }}>
          MY COLLECTION
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: '#444', fontSize: 10, letterSpacing: 1, marginBottom: 24 }}>
        MY COLLECTION — {publicKey?.toBase58().slice(0, 8)}...
      </p>

      {loading && <p style={{ color: '#333' }}>—</p>}

      {!loading && mints.length === 0 && (
        <p style={{ color: '#333', fontSize: 10 }}>no moments minted yet</p>
      )}

      <div className="grid">
        {mints.map(m => (
          <div key={m.id} className="moment-card">
            {m.moment.imageUrl && (
              <img src={m.moment.imageUrl} alt="moment" loading="lazy" />
            )}
            <div className="moment-card-body">
              <div style={{ fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 8 }}>
                {m.moment.kind === 'GOAL'
                  ? `GOAL ${m.moment.minute ?? '?'}' — ${m.moment.scoreP1}–${m.moment.scoreP2}`
                  : `FT ${m.moment.scoreP1}–${m.moment.scoreP2}`
                }
              </div>

              {!m.assetId.startsWith('no-keeper') && !m.assetId.startsWith('pending') && (
                <a
                  href={`https://core.metaplex.com/explorer/${m.assetId}?env=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', fontSize: 9, color: '#555', marginBottom: 4 }}
                >
                  ↗ Metaplex Explorer
                </a>
              )}

              <a
                href={`https://explorer.solana.com/tx/${m.txSig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', fontSize: 9, color: '#444' }}
              >
                ↗ Tx
              </a>

              <p style={{ fontSize: 9, color: '#333', marginTop: 6 }}>
                {new Date(m.createdAt * 1000).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
