'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { Moment } from '@momento/shared';

interface Props {
  moment: Moment;
  onMinted: () => void;
}

export function MomentCard({ moment, onMinted }: Props) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const [timeLeft, setTimeLeft] = useState(0);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, moment.closeTs - now));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [moment.closeTs]);

  const isOpen = moment.status === 'OPEN' && timeLeft > 0;
  const isVoid = moment.status === 'VOID';

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleMint = async () => {
    if (!publicKey || !connected) return;
    setMinting(true);
    setMintError(null);
    try {
      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: moment.id, minter: publicKey.toBase58() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Mint failed');
      }
      onMinted();
    } catch (err: any) {
      setMintError(err.message);
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="moment-card">
      {moment.imageUrl && (
        <img src={moment.imageUrl} alt={moment.teamScorerId ? `Team ${moment.teamScorerId} Goal` : 'Moment'} loading="lazy" />
      )}
      <div className="moment-card-body">
        <div>
          <span className={`badge badge-${moment.kind.toLowerCase()}`}>{moment.kind}</span>
          {isVoid && <span className="badge badge-void">VOID</span>}
          {!isOpen && !isVoid && <span className="badge badge-closed">CLOSED</span>}
        </div>

        {isOpen && (
          <div className="countdown">⏱ {fmt(timeLeft)}</div>
        )}

        {isOpen && (
          connected ? (
            <button className="mint-btn" onClick={handleMint} disabled={minting}>
              {minting ? 'MINTING...' : 'MINT NOW'}
            </button>
          ) : (
            <WalletMultiButton style={{ width: '100%', justifyContent: 'center', fontFamily: 'inherit', fontSize: '11px' }} />
          )
        )}

        {mintError && (
          <p style={{ color: '#f87171', fontSize: 9, marginTop: 6 }}>{mintError}</p>
        )}

        <a href={'/moment/' + moment.id} style={{ color: '#60a5fa', fontSize: 9, marginTop: 8, display: 'block' }}>
          view details →
        </a>
      </div>
    </div>
  );
}
