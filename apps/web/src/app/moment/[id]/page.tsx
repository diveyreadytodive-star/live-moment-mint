'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import type { Provider } from '@reown/appkit-adapter-solana/react';
import { Connection, Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

const PROGRAM_ID = new PublicKey('CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja');
const MINT_DISCRIMINATOR = Buffer.from([157, 243, 211, 63, 10, 118, 217, 42]);

interface MomentDetail {
  id: number;
  kind: string;
  status: string;
  scoreP1: number;
  scoreP2: number;
  minute?: number;
  imageUrl?: string;
  momentPda?: string;
  closeTs: number;
  fixtureId: string;
  mints: { id: number }[];
}

export default function MomentPage() {
  const { id } = useParams();
  const { open } = useAppKit();
  const { address, isConnected: connected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('solana');
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const publicKey = address ? new PublicKey(address) : null;

  const [moment, setMoment] = useState<MomentDetail | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintedAsset, setMintedAsset] = useState<string | null>(null);
  const [mintTx, setMintTx] = useState<string | null>(null);

  const fetchMoment = async () => {
    const res = await fetch(`/api/moments/${id}`);
    if (res.ok) setMoment(await res.json());
  };

  useEffect(() => { fetchMoment(); }, [id]);

  useEffect(() => {
    if (!moment) return;
    const update = () => setTimeLeft(Math.max(0, moment.closeTs - Math.floor(Date.now() / 1000)));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [moment?.closeTs]);

  const handleMint = async () => {
    if (!publicKey || !connected || !moment) return;
    setMinting(true);
    setMintError(null);
    try {
      let txSig: string | undefined;
      let messageSignature: string | undefined;
      let messageTs: number | undefined;

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
        txSig = await walletProvider.sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');
      } else {
        messageTs = Math.floor(Date.now() / 1000);
        const message = `Momento mint authorization\nmoment:${moment.id}\nwallet:${publicKey.toBase58()}\nts:${messageTs}`;
        const sigBytes = await walletProvider.signMessage(new TextEncoder().encode(message));
        messageSignature = bs58.encode(sigBytes);
      }

      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: moment.id, minter: publicKey.toBase58(), txSig, messageSignature, messageTs }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `mint failed (${res.status})`);
      }
      const body = await res.json();
      setMintTx(txSig ?? null);
      setMintedAsset(body.assetId ?? null);
      fetchMoment();
    } catch (err: any) {
      setMintError(err.message);
    } finally {
      setMinting(false);
    }
  };

  if (!moment) return <div className="empty-state">Loading...</div>;

  const isOpen = moment.status === 'OPEN' && timeLeft > 0;
  const isVoid = moment.status === 'VOID';
  const fmt = (s: number) => {
    if (s <= 0) return '0:00';
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };
  const kindLabel = moment.kind === 'GOAL' ? 'GOAL' : 'FULL TIME';
  const collectors = moment.mints.length;

  return (
    <div className="page-inner" style={{ maxWidth: 580 }}>
      <a href={`/match/${moment.fixtureId}`} className="back-link">← Match</a>

      {/* Hero image */}
      {moment.imageUrl ? (
        <img
          src={moment.imageUrl}
          alt={`${kindLabel} ${moment.scoreP1}–${moment.scoreP2}`}
          className="moment-hero-img"
          style={!isOpen || isVoid ? { filter: 'grayscale(100%) brightness(0.55)' } : undefined}
        />
      ) : (
        <div className="moment-hero-img" style={{
          height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface2)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>—</span>
        </div>
      )}

      {/* Info */}
      <div className="moment-hero-info">
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase',
          color: isVoid ? 'var(--text3)' : moment.kind === 'GOAL' ? 'var(--gold)' : 'var(--text2)',
          marginBottom: 4,
        }}>
          {isVoid ? 'VOIDED' : kindLabel}
          {moment.kind === 'GOAL' && moment.minute ? ` · ${moment.minute}'` : ''}
        </div>

        <div className="moment-hero-score">
          {moment.scoreP1} – {moment.scoreP2}
        </div>
      </div>

      {/* Collectors */}
      {collectors > 0 && (
        <div className="moment-hero-collectors">
          {collectors} {collectors === 1 ? 'person' : 'people'} collected this moment
        </div>
      )}

      {/* Mint / status */}
      {mintedAsset ? (
        <div style={{ marginBottom: 12 }}>
          <div className="moment-hero-mint-btn success" style={{ display: 'block', maxWidth: 360 }}>
            ✓ Minted
          </div>
          {mintedAsset && !mintedAsset.startsWith('db-') && (
            <a
              href={`https://explorer.solana.com/address/${mintedAsset}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="explorer-link"
              style={{ marginTop: 8, display: 'block' }}
            >
              ↗ View NFT on Solana Explorer
            </a>
          )}
          {mintTx && (
            <a
              href={`https://explorer.solana.com/tx/${mintTx}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="explorer-link"
              style={{ display: 'block' }}
            >
              ↗ View transaction
            </a>
          )}
        </div>
      ) : isOpen && !isVoid ? (
        <>
          <div className={`moment-hero-countdown${timeLeft < 60 ? ' urgent' : ''}`}>
            {fmt(timeLeft)}
          </div>
          {connected ? (
            <button
              className="moment-hero-mint-btn"
              onClick={handleMint}
              disabled={minting}
            >
              {minting ? 'Minting…' : 'Mint this moment'}
            </button>
          ) : (
            <button
              className="moment-hero-mint-btn"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}
              onClick={() => open()}
            >
              Connect Wallet
            </button>
          )}
        </>
      ) : (
        <div style={{
          fontSize: 11, letterSpacing: 2, color: 'var(--text3)',
          padding: '16px 0', textTransform: 'uppercase',
        }}>
          {isVoid ? 'Voided — not mintable' : 'Minting window closed'}
        </div>
      )}

      {mintError && <p className="error-text">{mintError}</p>}

      {/* On-chain link */}
      {moment.momentPda && (
        <a
          href={`https://explorer.solana.com/address/${moment.momentPda}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          className="explorer-link"
          style={{ marginTop: 20, display: 'block' }}
        >
          ↗ On-chain PDA
        </a>
      )}
    </div>
  );
}
