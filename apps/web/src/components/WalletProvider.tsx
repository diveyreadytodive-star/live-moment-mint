'use client';

import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { solanaDevnet } from '@reown/appkit/networks';

const solanaAdapter = new SolanaAdapter();

const APP_URL = typeof window !== 'undefined'
  ? window.location.origin
  : 'https://live-moment-mint.vercel.app';

createAppKit({
  adapters: [solanaAdapter],
  networks: [solanaDevnet],
  projectId: '13972b81354acd2c9589ee915af54155',
  metadata: {
    name: 'Momento',
    description: 'Mint live football moments as NFTs',
    url: APP_URL,
    icons: [`${APP_URL}/favicon.ico`],
  },
  features: {
    analytics: false,
    email: true,
    socials: ['google', 'github', 'discord', 'x'],
  },
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
