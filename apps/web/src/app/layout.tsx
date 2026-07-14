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
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <a href="/" className="logo">
                MOM<em>E</em>NTO
              </a>
              <a href="/collection" className="nav-link">My Collection</a>
            </div>
            <HeaderWallet />
          </header>
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
