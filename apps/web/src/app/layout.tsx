import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';
import { HeaderWallet } from '@/components/HeaderWallet';

export const metadata: Metadata = {
  title: 'MOMENTO',
  description: 'Mint time-locked NFTs from live World Cup moments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <header className="header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flex: 1 }}>
              <a href="/feed" className="logo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="34" height="34" viewBox="0 0 64 64" style={{ display: 'block', flexShrink: 0 }}>
                  <rect width="64" height="64" fill="#070710" />
                  <circle cx="32" cy="32" r="27" fill="#eaeaf5" />
                  <path d="M32 10 L45 19.5 L40 35.5 L24 35.5 L19 19.5 Z" fill="#070710" />
                  <path d="M32 10 L32 2 M45 19.5 L54 13.5 M40 35.5 L44 46 M24 35.5 L20 46 M19 19.5 L10 13.5" stroke="#070710" strokeWidth="3.2" />
                </svg>
                MOM<em>E</em>NTO
              </a>
              <nav style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <a href="/feed" className="nav-link" style={{ fontSize: 13, fontWeight: 800 }}>Feed</a>
                <a href="/collection" className="nav-link" style={{ fontSize: 13, fontWeight: 800 }}>My Collection</a>
                <a href="/feed" className="nav-link" style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)' }}>Leaderboard</a>
              </nav>
            </div>
            <div style={{ flex: 1, maxWidth: 320, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 12, color: 'var(--text3)', pointerEvents: 'none', userSelect: 'none' }}>
              Search fixtures, teams…
            </div>
            <div style={{ flexShrink: 0, marginLeft: 24 }}>
              <HeaderWallet />
            </div>
          </header>
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
