'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export function ConnectWalletButton() {
  const { publicKey, connected, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!connected || !publicKey) {
    return (
      <button className="cwb-btn" onClick={() => setVisible(true)}>
        Connect Wallet
      </button>
    );
  }

  const addr = publicKey.toBase58();
  const short = `${addr.slice(0, 4)}…${addr.slice(-4)}`;

  return (
    <div className="cwb-wrap" ref={menuRef}>
      <button className="cwb-btn connected" onClick={() => setMenuOpen(o => !o)}>
        {wallet?.adapter.icon && (
          <img src={wallet.adapter.icon} alt="" width={16} height={16} style={{ borderRadius: 4 }} />
        )}
        {short}
        <span className="cwb-chevron">{menuOpen ? '▲' : '▼'}</span>
      </button>
      {menuOpen && (
        <div className="cwb-menu">
          <div className="cwb-addr">{addr.slice(0, 12)}…{addr.slice(-8)}</div>
          <button
            className="cwb-menu-item"
            onClick={() => { navigator.clipboard.writeText(addr); setMenuOpen(false); }}
          >
            Copy address
          </button>
          <a
            className="cwb-menu-item"
            href={`https://explorer.solana.com/address/${addr}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuOpen(false)}
          >
            View on Explorer ↗
          </a>
          <button
            className="cwb-menu-item danger"
            onClick={() => { disconnect(); setMenuOpen(false); }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
