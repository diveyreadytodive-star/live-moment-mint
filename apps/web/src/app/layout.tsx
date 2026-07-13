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
            <span className="logo">MOMENTO</span>
            <HeaderWallet />
          </header>
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
