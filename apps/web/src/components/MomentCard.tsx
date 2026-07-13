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
const MINT_DISCRIMINATOR = Buffer.from([157, 243, 211, 63, 10, 118, 217, 42]);

export function MomentCard({ moment, onMinted }: Props) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [timeLeft, setTimeLeft] = useState(0);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintTx, setMintTx] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setTimeLeft(Math.max(0, moment.closeTs - Math.floor(Date.now() / 1000)));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [moment.closeTs]);

  const isOpen = moment.status === 'OPEN' && timeLeft > 0;
  const isVoid = moment.status === 'VOID';

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleMint = async () => {
    if (!publicKey || !connected) return;
    setMinting(true);
    setMintError(null);
    try {
      let txSig: string;
      if (moment.momentPda) {
        const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: new PublicKey(moment.momentPda), isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: false },
          ],
          data: MINT_DISCRIMINATOR,
        });
        const tx = new Transaction().add(ix);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;
        txSig = await sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');
      } else {
        txSig = `offline-${Date.now()}`;
      }
      await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: moment.id, minter: publicKey.toBase58(), txSig }),
      });
      setMintTx(txSig);
      onMinted();
    } catch (err: any) {
      setMintError(err.message);
    } finally {
      setMinting(false);
    }
  };

  const label = moment.kind === 'GOAL'
    ? `GOAL ${moment.minute}'  ${moment.scoreP1}–${moment.scoreP2}`
    : `FT  ${moment.scoreP1}–${moment.scoreP2}`;

  return (
    <div className="moment-card">
      {moment.imageUrl && (
        <img src={moment.imageUrl} alt={label} loading="lazy" />
      )}
      <div className="moment-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: isVoid ? '#444' : isOpen ? '#fff' : '#555', letterSpacing: 1 }}>
            {isVoid ? 'VOID' : label}
          </span>
          {isOpen && (
            <span className="countdown">{fmt(timeLeft)}</span>
          )}
          {!isOpen && !isVoid && (
            <span style={{ fontSize: 9, color: '#444' }}>CLOSED</span>
          )}
        </div>

        {isOpen && (
          connected ? (
            <button className="mint-btn" onClick={handleMint} disabled={minting}>
              {minting ? 'MINTING...' : 'MINT'}
            </button>
          ) : (
            <WalletMultiButton />
          )
        )}

        {mintTx && !mintTx.startsWith('offline-') && (
          <a
            href={`https://explorer.solana.com/tx/${mintTx}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', marginTop: 8, fontSize: 9, color: '#666' }}
          >
            ↗ explorer
          </a>
        )}
        {mintError && (
          <p style={{ color: '#666', fontSize: 9, marginTop: 6 }}>{mintError}</p>
        )}
      </div>
    </div>
  );
}
