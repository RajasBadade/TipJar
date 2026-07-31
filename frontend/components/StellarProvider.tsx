"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getNetworkDetails,
  isBrowser,
  requestAccess,
  signAuthEntry,
  signTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";

export type StellarContextValue = {
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  rpcUrl: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransactionXdr: (txXdr: string) => Promise<string>;
  signAuthEntryXdr: (authEntryXdr: string) => Promise<string>;
};

const StellarContext = createContext<StellarContextValue | null>(null);

export function StellarProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);
  const [rpcUrl, setRpcUrl] = useState<string | null>(null);

  const refreshNetwork = useCallback(async () => {
    const details = await getNetworkDetails();
    if (details.error) {
      throw new Error(details.error.message);
    }
    setNetwork(details.network);
    setNetworkPassphrase(details.networkPassphrase);
    setRpcUrl(details.sorobanRpcUrl ?? details.networkUrl ?? null);
  }, []);

  const connect = useCallback(async () => {
    if (!isBrowser) {
      throw new Error("Freighter is only available in the browser.");
    }
    const access = await requestAccess();
    if (access.error) {
      throw new Error(access.error.message);
    }
    setAddress(access.address);
    await refreshNetwork();
  }, [refreshNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const signTransactionXdr = useCallback(
    async (txXdr: string) => {
      if (!address) {
        throw new Error("Wallet not connected.");
      }
      const opts = networkPassphrase ? { networkPassphrase, address } : { address };
      const res = await signTransaction(txXdr, opts);
      if (res.error) {
        throw new Error(res.error.message);
      }
      return res.signedTxXdr;
    },
    [address, networkPassphrase]
  );

  const signAuthEntryXdr = useCallback(
    async (authEntryXdr: string) => {
      if (!address) {
        throw new Error("Wallet not connected.");
      }
      const opts = networkPassphrase ? { networkPassphrase, address } : { address };
      const res = await signAuthEntry(authEntryXdr, opts);
      if (res.error) {
        throw new Error(res.error.message);
      }
      if (!res.signedAuthEntry) {
        throw new Error("Freighter returned an empty auth entry signature.");
      }
      return res.signedAuthEntry;
    },
    [address, networkPassphrase]
  );

  useEffect(() => {
    if (!isBrowser) return;
    const watcher = new WatchWalletChanges();
    const started = watcher.watch((params) => {
      if (params.error) return;
      setAddress(params.address);
      setNetwork(params.network);
      setNetworkPassphrase(params.networkPassphrase);
    });
    return () => {
      if (started.error) return;
      watcher.stop();
    };
  }, []);

  const value = useMemo<StellarContextValue>(
    () => ({
      address,
      network,
      networkPassphrase,
      rpcUrl,
      connect,
      disconnect,
      signTransactionXdr,
      signAuthEntryXdr,
    }),
    [address, connect, disconnect, network, networkPassphrase, rpcUrl, signAuthEntryXdr, signTransactionXdr]
  );

  return <StellarContext.Provider value={value}>{children}</StellarContext.Provider>;
}

export function useStellar() {
  const ctx = useContext(StellarContext);
  if (!ctx) {
    throw new Error("StellarProvider is missing.");
  }
  return ctx;
}

