import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { hasVault, loadVault, saveVault } from '../lib/vault';

const VaultContext = createContext(null);
const EMPTY_VAULT = { version: 1, wallets: {} };

export function VaultProvider({ children }) {
  const [status, setStatus] = useState(() => (hasVault() ? 'locked' : 'setup'));
  const [vault, setVault] = useState(EMPTY_VAULT);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);
  const vaultRef = useRef(EMPTY_VAULT);

  const applyVault = (next) => {
    vaultRef.current = next;
    setVault(next);
  };

  const setupVault = async (password) => {
    setBusy(true);
    try {
      const initial = { version: 1, wallets: {} };
      await saveVault(initial, password);
      passwordRef.current = password;
      applyVault(initial);
      setStatus('unlocked');
    } finally {
      setBusy(false);
    }
  };

  const unlockVault = async (password) => {
    setBusy(true);
    try {
      const data = await loadVault(password);
      if (!data) throw new Error('No local vault found');
      passwordRef.current = password;
      applyVault(data);
      setStatus('unlocked');
    } finally {
      setBusy(false);
    }
  };

  const lockVault = () => {
    passwordRef.current = null;
    applyVault(EMPTY_VAULT);
    setStatus(hasVault() ? 'locked' : 'setup');
  };

  const addWallet = async (wallet) => {
    if (!passwordRef.current) throw new Error('Unlock your vault first');
    const current = vaultRef.current;
    const next = {
      ...current,
      wallets: { ...current.wallets, [wallet.address]: wallet },
    };
    await saveVault(next, passwordRef.current);
    applyVault(next);
    return wallet;
  };

  const wallets = useMemo(
    () => Object.values(vault.wallets || {}),
    [vault],
  );

  const getWallet = (address) => vault.wallets?.[address] || null;

  const value = {
    status,
    busy,
    wallets,
    setupVault,
    unlockVault,
    lockVault,
    addWallet,
    getWallet,
    isUnlocked: status === 'unlocked',
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used inside VaultProvider');
  return context;
}
