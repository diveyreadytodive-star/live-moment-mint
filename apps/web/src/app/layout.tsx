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
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <a href="/" className="logo" style={{ textDecoration: 'none', color: '#fff' }}>MOMENTO</a>
              <a href="/collection" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textDecoration: 'none' }}>MY COLLECTION</a>
            </div>
            <HeaderWallet />
          </header>
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
