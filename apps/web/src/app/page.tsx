'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FEATURES = [
  { num: '01', title: 'Real-Time Mints',    body: 'Own a moment within seconds of it happening on the pitch.' },
  { num: '02', title: 'Verified Ownership', body: 'Every moment is a scarce, on-chain collectible — provably yours.' },
  { num: '03', title: 'Trade & Collect',    body: 'Build your collection and trade with fans around the world.' },
];

export default function LandingPage() {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);

  const handleLaunch = () => {
    setLaunching(true);
    setTimeout(() => router.push('/feed'), 480);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      opacity: launching ? 0 : 1,
      transition: 'opacity 0.48s ease',
      background: 'var(--bg)',
    }}>
      {/* Background image */}
      <img
        src="/hero-world-cup-collage.png"
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: '50% 62%',
          filter: 'saturate(0.75) brightness(0.72) contrast(1.05) blur(2px)',
          transform: 'scale(1.25)',
        }}
      />
      {/* Scrim */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(7,7,16,0.40) 0%, rgba(7,7,16,0.32) 35%, rgba(7,7,16,0.70) 78%, var(--bg) 100%)',
      }} />

      {/* Top bar */}
      <div style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '32px 40px 0',
        flexShrink: 0,
      }}>
        <svg width="30" height="30" viewBox="0 0 64 64" style={{ display: 'block', flexShrink: 0 }}>
          <rect width="64" height="64" fill="#070710" />
          <circle cx="32" cy="32" r="27" fill="#eaeaf5" />
          <path d="M32 10 L45 19.5 L40 35.5 L24 35.5 L19 19.5 Z" fill="#070710" />
          <path d="M32 10 L32 2 M45 19.5 L54 13.5 M40 35.5 L44 46 M24 35.5 L20 46 M19 19.5 L10 13.5"
            stroke="#070710" strokeWidth="3.2" />
        </svg>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 900,
          letterSpacing: 4, color: '#fff',
        }}>
          MOM<em style={{ color: 'var(--gold)', fontStyle: 'normal' }}>E</em>NTO
        </span>
      </div>

      {/* Center block */}
      <div style={{
        position: 'relative',
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        textAlign: 'center',
        padding: '40px 24px',
        maxWidth: 760, margin: '0 auto', width: '100%',
      }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800,
          letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
          color: 'var(--gold-light)', margin: '0 0 18px',
        }}>
          2026 FIFA World Cup · On-Chain Collectibles
        </p>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 900,
          lineHeight: 1.02, letterSpacing: -1, color: '#fff',
          margin: '0 0 20px',
        }}>
          Every Moment.<br />Minted.
        </h1>

        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500,
          lineHeight: 1.6, color: 'rgba(234,234,245,0.75)',
          margin: '0 0 40px', maxWidth: 520,
        }}>
          Momento turns World Cup goals, saves and history into officially verified
          digital collectibles — minted live, seconds after they happen.
        </p>

        <button
          onClick={handleLaunch}
          disabled={launching}
          style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800,
            letterSpacing: 0.4, color: '#1a1206',
            background: 'linear-gradient(180deg, var(--gold-light) 0%, var(--gold) 100%)',
            border: 'none', borderRadius: 6, padding: '16px 36px',
            cursor: launching ? 'default' : 'pointer',
            boxShadow: '0 8px 24px rgba(201,149,42,0.25)',
            transition: 'opacity 0.15s',
            opacity: launching ? 0.7 : 1,
          }}
        >
          {launching ? 'Loading…' : 'Launch App'}
        </button>
      </div>

      {/* Bottom feature strip */}
      <div style={{
        position: 'relative',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1, background: 'var(--border)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {FEATURES.map(f => (
          <div key={f.num} style={{
            background: 'var(--bg)', padding: '28px 32px 34px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800,
              letterSpacing: 2, color: 'var(--gold)', marginBottom: 8,
            }}>{f.num}</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800,
              color: '#fff', marginBottom: 6,
            }}>{f.title}</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 12, lineHeight: 1.5,
              color: 'var(--text2)',
            }}>{f.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
