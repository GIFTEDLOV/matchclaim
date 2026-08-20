"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getConfig } from "@/lib/config";
import type { Address } from "@/lib/address";
import { connectWallet, getInjectedProvider, inspectWallet, type WalletConnection } from "@/lib/wallet";

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function useWalletState() {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setConnection(await inspectWallet(getConfig()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet state could not be read");
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    const provider = getInjectedProvider();
    if (!provider?.on) return () => window.clearTimeout(refreshTimer);
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0];
      if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
        setConnection(null);
        return;
      }
      void refresh();
    };
    const onChainChanged = () => void refresh();
    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);
    return () => {
      window.clearTimeout(refreshTimer);
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refresh]);

  const connect = useCallback(async (): Promise<WalletConnection> => {
    setConnecting(true);
    setError("");
    try {
      const next = await connectWallet(getConfig());
      setConnection(next);
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet connection failed";
      setError(message);
      throw cause;
    } finally {
      setConnecting(false);
    }
  }, []);

  return {
    address: connection?.address as Address | undefined,
    chainId: connection?.chainId,
    provider: connection?.provider,
    connecting,
    error,
    connect,
    refresh,
    disconnect: () => setConnection(null),
  };
}

type WalletState = ReturnType<typeof useWalletState>;
const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  return <WalletContext.Provider value={useWalletState()}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const value = useContext(WalletContext);
  if (!value) throw new Error("WalletProvider is missing");
  return value;
}
