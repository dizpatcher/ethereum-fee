import { useState, useCallback, useEffect } from 'react';
import type { WalletState } from '../types';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function useWallet(): WalletState {
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if user already connected
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accs) => {
        const list = accs as string[];
        if (list.length > 0) setAccount(list[0]);
      })
      .catch(() => {});

    const onAccountsChanged = (accs: unknown) => {
      const list = accs as string[];
      setAccount(list.length > 0 ? list[0] : null);
    };
    window.ethereum.on('accountsChanged', onAccountsChanged);
    return () => window.ethereum?.removeListener('accountsChanged', onAccountsChanged);
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('Кошелёк не найден. Установите MetaMask или Rabby.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accs = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      setAccount(accs[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Отказано в подключении');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setAccount(null), []);

  const sendTransaction = useCallback(
    async (params: Record<string, string>) => {
      if (!window.ethereum || !account) throw new Error('Кошелёк не подключён');
      return window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: account, ...params }],
      });
    },
    [account],
  );

  return { account, connecting, error, connect, disconnect, sendTransaction };
}
