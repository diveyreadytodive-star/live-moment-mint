'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import type { Moment } from '@momento/shared';

interface Props {
  moment: Moment & { _count?: { mints: number } };
  onMinted: () => void;
}

const PROGRAM_ID = new PublicKey('CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja');
const MINT_DISCRIMINATOR = Buffer.from([157, 243, 211, 63, 10, 118, 217, 42]);

export function MomentCard({ moment, onMinted }: Props) {
  const { publicKey, sendTransaction, signMessage, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible: openWalletModal } = useWalletModal();
  const [timeLeft, setTimeLeft] = useState(0);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintTx, setMintTx] = useState<string | null>(null);
  const [mintedAsset, setMintedAsset] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setTimeLeft(Math.max(0, moment.closeTs - Math.floor(Date.now() / 1000)));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [moment.closeTs]);

  const isOpen = moment.status === 'OPEN' && timeLeft > 0;
  const isVoid = moment.status === 'VOID';
  const mintCount = moment._count?.mints ?? 0;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleMint = async () => {
    if (!publicKey || !connected) return;
    setMinting(true);
    setMintError(null);
    try {
      // momentPda present → on-chain tx first; absent/FAILED → off-chain message signature
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
        txSig = await sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');
      } else {
        // DB-only path: prove wallet ownership via off-chain message signature (no gas)
        if (!signMessage) {
          throw new Error(
            '이 지갑은 서명 인증을 지원하지 않습니다. Phantom 또는 Solflare를 사용하세요.',
          );
        }
        messageTs = Math.floor(Date.now() / 1000);
        const message = `Momento mint authorization\nmoment:${moment.id}\nwallet:${publicKey.toBase58()}\nts:${messageTs}`;
        const sigBytes = await signMessage(new TextEncoder().encode(message));
        messageSignature = bs58.encode(sigBytes);
      }

      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          momentId: moment.id,
          minter: publicKey.toBase58(),
          txSig,
          messageSignature,
          messageTs,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `mint failed (${res.status})`);
      }
      const body = await res.json();
      setMintTx(txSig ?? null);
      setMintedAsset(body.assetId ?? null);
      onMinted();
    } catch (err: any) {
      setMintError(err.message);
    } finally {
      setMinting(false);
    }
  };

  const kindLabel = moment.kind === 'GOAL' ? 'GOAL' : 'FULL TIME';
  const kindClass = isVoid ? 'void' : moment.kind === 'GOAL' ? 'goal' : 'result';

  return (
    <div className={`moment-card${isOpen ? ' open' : ''}`}>
      {moment.imageUrl ? (
        <img
          src={moment.imageUrl}
          alt={`${kindLabel} ${moment.scoreP1}–${moment.scoreP2}`}
          className={`moment-card-img${!isOpen || isVoid ? ' dim' : ''}`}
          loading="lazy"
        />
      ) : (
        <div className="moment-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1 }}>—</span>
        </div>
      )}

      <div className="moment-card-body">
        <div className={`moment-kind-badge ${kindClass}`}>
          {isVoid ? 'VOIDED' : kindLabel}
        </div>

        <div className="moment-score-big">
          {moment.scoreP1}–{moment.scoreP2}
        </div>

        <div className="moment-meta-row">
          <span>{moment.kind === 'GOAL' && moment.minute ? `${moment.minute}'` : ''}</span>
          {mintCount > 0 && <span>{mintCount} collected</span>}
        </div>

        {isOpen && !mintedAsset && (
          <div className={`moment-countdown${timeLeft < 60 ? ' urgent' : ''}`}>
            {fmt(timeLeft)}
          </div>
        )}

        {mintedAsset ? (
          <a
            href={`https://explorer.solana.com/address/${mintedAsset}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="mint-btn success"
          >
            ✓ MINTED
          </a>
        ) : isOpen && !isVoid ? (
          connected ? (
            <button className="mint-btn" onClick={handleMint} disabled={minting}>
              {minting ? 'MINTING…' : 'MINT NOW'}
            </button>
          ) : (
            <button className="connect-btn" onClick={() => openWalletModal(true)}>
              Connect Wallet
            </button>
          )
        ) : !isVoid ? (
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, paddingTop: 2 }}>CLOSED</div>
        ) : null}

        {mintTx && !mintTx.startsWith('offline-') && (
          <a
            href={`https://explorer.solana.com/tx/${mintTx}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="explorer-link"
          >
            ↗ View tx
          </a>
        )}
        {mintError && <p className="error-text">{mintError}</p>}
      </div>
    </div>
  );
}
