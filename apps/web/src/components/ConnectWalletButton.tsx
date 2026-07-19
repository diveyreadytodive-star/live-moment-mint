'use client';

import { useAppKit, useAppKitAccount } from '@reown/appkit/react';

export function ConnectWalletButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  if (!isConnected || !address) {
    return (
      <button className="cwb-btn" onClick={() => open()}>
        Connect Wallet
      </button>
    );
  }

  const short = `${address.slice(0, 4)}…${address.slice(-4)}`;

  return (
    <button className="cwb-btn connected" onClick={() => open({ view: 'Account' })}>
      {short}
    </button>
  );
}
