"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getNetworkDetails,
  isBrowser,
  isConnected,
  requestAccess,
  signAuthEntry,
  signTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";

/**
 * `freighter-api` talks to the provider injected by the Freighter browser
 * extension. The Freighter mobile app exists but reaches dapps over
 * WalletConnect instead, so it cannot satisfy these calls.
 */
const NO_EXTENSION_MESSAGE =
  "Freighter extension not detected. Open this page in a desktop browser with the Freighter extension installed to connect.";

export type StellarContextValue = {
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  rpcUrl: string | null;
  /** `null` while detection is in flight, then whether the extension responded. */
  isFreighterAvailable: boolean | null;
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
  const [isFreighterAvailable, setIsFreighterAvailable] = useState<boolean | null>(null);

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
    const detected = await isConnected();
    if (detected.error || !detected.isConnected) {
      setIsFreighterAvailable(false);
      throw new Error(NO_EXTENSION_MESSAGE);
    }
    setIsFreighterAvailable(true);
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
    if (!isBrowser) {
      setIsFreighterAvailable(false);
      return;
    }
    let cancelled = false;
    isConnected()
      .then((res) => {
        if (!cancelled) setIsFreighterAvailable(!res.error && res.isConnected);
      })
      .catch(() => {
        if (!cancelled) setIsFreighterAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      isFreighterAvailable,
      connect,
      disconnect,
      signTransactionXdr,
      signAuthEntryXdr,
    }),
    [
      address,
      connect,
      disconnect,
      isFreighterAvailable,
      network,
      networkPassphrase,
      rpcUrl,
      signAuthEntryXdr,
      signTransactionXdr,
    ]
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

