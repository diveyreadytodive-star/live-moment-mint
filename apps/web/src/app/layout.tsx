import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';

export const metadata: Metadata = {
  title: 'Momento — Live Match NFTs',
  description: 'Mint time-locked NFTs from real World Cup moments, powered by TxLINE',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <header className="header">
            <span className="logo">⚽ MOMENTO</span>
            <nav>
              <a href="/">Feed</a>
              <a href="/collection">My Collection</a>
            </nav>
          </header>
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
