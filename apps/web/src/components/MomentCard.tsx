'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';
import type { Moment } from '@momento/shared';

interface Props {
  moment: Moment;
  onMinted: () => void;
}

const PROGRAM_ID = new PublicKey('CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja');
// sha256("global:mint_moment")[0..8]
const MINT_DISCRIMINATOR = Buffer.from([157, 243, 211, 63, 10, 118, 217, 42]);

export function MomentCard({ moment, onMinted }: Props) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [timeLeft, setTimeLeft] = useState(0);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintTx, setMintTx] = useState<string | null>(null);

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
    setMintTx(null);

    try {
      let txSig: string;

      if (moment.momentPda) {
        // --- On-chain path: send mint_moment instruction ---
        const momentPubkey = new PublicKey(moment.momentPda);
        const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: momentPubkey, isSigner: false, isWritable: true },
            { pubkey: publicKey,    isSigner: true,  isWritable: false },
          ],
          data: MINT_DISCRIMINATOR,
        });

        const tx = new Transaction().add(ix);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        txSig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(
          { signature: txSig, blockhash, lastValidBlockHeight },
          'confirmed',
        );
      } else {
        // --- Offline / replay fallback (no on-chain window yet) ---
        txSig = `offline-${Date.now()}`;
      }

      // Record in DB
      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: moment.id, minter: publicKey.toBase58(), txSig }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Mint failed');
      }

      setMintTx(txSig);
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

        {mintTx && !mintTx.startsWith('offline-') && (
          <a
            href={`https://explorer.solana.com/tx/${mintTx}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#10b981', fontSize: 9, marginTop: 6, display: 'block' }}
          >
            ✓ Minted — view tx →
          </a>
        )}
        {mintTx && mintTx.startsWith('offline-') && (
          <p style={{ color: '#10b981', fontSize: 9, marginTop: 6 }}>✓ Minted (offline mode)</p>
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
