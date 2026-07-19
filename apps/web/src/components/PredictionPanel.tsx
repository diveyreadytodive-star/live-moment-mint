'use client';

import { useEffect, useState } from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import type { Provider } from '@reown/appkit-adapter-solana/react';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

type Outcome = 'HOME' | 'DRAW' | 'AWAY';

interface Props {
  fixtureId: string;
  p1Name: string;
  p2Name: string;
  kickoffTs: number;
  /** statusId >= 100 means the match is over */
  statusId: number | null;
  liveScoreP1: number | null;
  liveScoreP2: number | null;
  /** id of the prediction-reward moment so we can link to it */
  rewardMomentId: number | null;
}

const LABEL: Record<Outcome, string> = {
  HOME: 'Home Win',
  DRAW: 'Draw',
  AWAY: 'Away Win',
};

export function PredictionPanel({
  fixtureId,
  p1Name,
  p2Name,
  kickoffTs,
  statusId,
  liveScoreP1,
  liveScoreP2,
  rewardMomentId,
}: Props) {
  const { open } = useAppKit();
  const { address, isConnected: connected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('solana');
  const publicKey = address ? new PublicKey(address) : null;
  const signMessage = walletProvider?.signMessage?.bind(walletProvider);

  const [myPrediction, setMyPrediction]   = useState<Outcome | null>(null);
  const [fixtureOutcome, setFixtureOutcome] = useState<Outcome | null>(null);
  const [selected, setSelected]           = useState<Outcome | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);

  const nowSec = Math.floor(Date.now() / 1000);
  const isMatchEnded = (statusId ?? 0) >= 100;
  const isPredictionOpen = nowSec < kickoffTs + 15 * 60;

  // Derive live fixture outcome for display (may not be finalised yet)
  const liveOutcome: Outcome | null = (() => {
    const s1 = liveScoreP1 ?? 0;
    const s2 = liveScoreP2 ?? 0;
    if (liveScoreP1 === null) return null;
    if (s1 > s2) return 'HOME';
    if (s2 > s1) return 'AWAY';
    return 'DRAW';
  })();

  const isCorrect = myPrediction !== null && fixtureOutcome !== null && myPrediction === fixtureOutcome;

  // Load my prediction from server whenever wallet changes
  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    fetch(`/api/predictions?fixtureId=${fixtureId}&wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(data => {
        setMyPrediction(data.prediction?.outcome ?? null);
        setFixtureOutcome(data.fixtureOutcome ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fixtureId, publicKey]);

  const handleSubmit = async () => {
    if (!publicKey || !signMessage || !selected) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const ts = Math.floor(Date.now() / 1000);
      const message = `Momento prediction\nfixture:${fixtureId}\noutcome:${selected}\nwallet:${publicKey.toBase58()}\nts:${ts}`;
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const messageSignature = bs58.encode(sigBytes);

      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId, outcome: selected,
          wallet: publicKey.toBase58(),
          messageSignature, messageTs: ts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit');
      setMyPrediction(data.prediction.outcome);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '24px 28px',
      marginBottom: 28,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 16 }}>🔮</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: '#fff', textTransform: 'uppercase' }}>
            Match Prediction
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
            {isMatchEnded
              ? 'Predictions closed — results in'
              : isPredictionOpen
              ? 'Predict the winner. Correct picks earn a special NFT.'
              : 'Prediction window closed'}
          </div>
        </div>
        {rewardMomentId && isMatchEnded && isCorrect && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
            color: 'var(--gold)', background: 'rgba(201,149,42,0.12)',
            border: '1px solid var(--gold)', borderRadius: 4, padding: '3px 8px',
            textTransform: 'uppercase',
          }}>
            NFT Available
          </span>
        )}
      </div>

      {/* Not connected */}
      {!connected && (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
            Connect wallet to predict and win special NFTs
          </div>
          <button
            onClick={() => open()}
            style={{
              fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800,
              letterSpacing: 1, padding: '10px 24px', borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-blue)', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Connect Wallet
          </button>
        </div>
      )}

      {/* Connected — show prediction UI */}
      {connected && !loading && (
        <>
          {/* Already predicted */}
          {myPrediction ? (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, letterSpacing: 1 }}>
                YOUR PREDICTION
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--surface2)',
                fontSize: 13, fontWeight: 800, color: '#fff',
              }}>
                <span>{myPrediction === 'HOME' ? p1Name : myPrediction === 'AWAY' ? p2Name : 'Draw'}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({LABEL[myPrediction]})</span>
              </div>

              {/* Match ended — show result */}
              {isMatchEnded && fixtureOutcome && (
                <div style={{ marginTop: 16 }}>
                  {isCorrect ? (
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                        background: 'rgba(201,149,42,0.10)', border: '1px solid var(--gold)',
                        marginBottom: 12,
                      }}>
                        <span style={{ fontSize: 16 }}>✨</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)', letterSpacing: 1 }}>
                            YOU CALLED IT!
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                            Your prediction was correct — claim your exclusive Oracle NFT
                          </div>
                        </div>
                      </div>
                      {rewardMomentId && (
                        <a
                          href={`/moment/${rewardMomentId}`}
                          style={{
                            display: 'block', textAlign: 'center',
                            padding: '12px', borderRadius: 'var(--radius-sm)',
                            background: 'linear-gradient(180deg, var(--gold-light) 0%, var(--gold) 100%)',
                            color: '#1a1206', fontSize: 12, fontWeight: 800,
                            letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'none',
                          }}
                        >
                          Claim Oracle NFT →
                        </a>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      fontSize: 11, color: 'var(--text3)',
                    }}>
                      Result: <strong style={{ color: 'var(--text2)' }}>
                        {fixtureOutcome === 'HOME' ? p1Name : fixtureOutcome === 'AWAY' ? p2Name : 'Draw'}
                      </strong> — Better luck next match.
                    </div>
                  )}
                </div>
              )}

              {/* Match ongoing — show current score tendency */}
              {!isMatchEnded && liveOutcome && (
                <div style={{
                  marginTop: 12, fontSize: 11, color: 'var(--text3)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span className="live-dot" style={{ width: 6, height: 6 }} />
                  Currently: <strong style={{ color: myPrediction === liveOutcome ? 'var(--live)' : 'var(--text2)' }}>
                    {liveOutcome === 'HOME' ? p1Name : liveOutcome === 'AWAY' ? p2Name : 'Draw'}
                  </strong>
                  {myPrediction === liveOutcome && (
                    <span style={{ color: 'var(--live)', fontWeight: 700 }}> ← on track ✓</span>
                  )}
                </div>
              )}
            </div>

          ) : isPredictionOpen ? (
            /* Not yet predicted + window open → show form */
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginBottom: 14 }}>
                {(['HOME', 'DRAW', 'AWAY'] as Outcome[]).map(o => {
                  const label = o === 'HOME' ? p1Name : o === 'AWAY' ? p2Name : 'Draw';
                  const active = selected === o;
                  return (
                    <button
                      key={o}
                      onClick={() => setSelected(o)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: active ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                        background: active ? 'rgba(59,108,246,0.15)' : 'var(--surface2)',
                        color: active ? '#fff' : 'var(--text2)',
                        fontSize: 11, fontWeight: active ? 800 : 500,
                        cursor: 'pointer', textAlign: 'center',
                        transition: 'all .15s',
                        letterSpacing: 0.5,
                      }}
                    >
                      <div style={{ marginBottom: 2, fontSize: 10, color: active ? 'var(--accent-blue-light)' : 'var(--text3)', letterSpacing: 1 }}>
                        {LABEL[o]}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {label}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!selected || submitting}
                style={{
                  width: '100%', padding: '11px',
                  borderRadius: 'var(--radius-sm)',
                  background: selected ? 'var(--accent-blue)' : 'var(--surface2)',
                  color: selected ? '#fff' : 'var(--text3)',
                  border: 'none', fontSize: 12, fontWeight: 800,
                  letterSpacing: 1.5, textTransform: 'uppercase',
                  cursor: selected && !submitting ? 'pointer' : 'default',
                  transition: 'background .15s',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit Prediction'}
              </button>
              {submitError && (
                <p style={{ marginTop: 8, fontSize: 11, color: 'var(--danger)' }}>{submitError}</p>
              )}
              <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>
                Correct predictions unlock an exclusive Oracle NFT — no gas required to predict.
              </div>
            </div>

          ) : (
            /* Window closed, no prediction made */
            <div style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 0' }}>
              Prediction window closed before the match started.
            </div>
          )}
        </>
      )}
    </div>
  );
}
