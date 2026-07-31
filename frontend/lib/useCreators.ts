"use client";

import { useEffect, useState } from "react";
import { useStellar } from "@/components/StellarProvider";
import { getCreatorRegistryClient, getTipJarClient } from "@/lib/soroban";

export type CreatorProfile = {
  wallet: string;
  name: string;
  bio: string;
  avatar: string;
  registeredAt: bigint;
  balance: bigint;
};

export function useCreators() {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { networkPassphrase, rpcUrl } = useStellar();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        // Reads are simulation-only, so no connected wallet is required.
        const ctx = {
          networkPassphrase: networkPassphrase ?? undefined,
          rpcUrl: rpcUrl ?? undefined,
        };
        const registry = await getCreatorRegistryClient(ctx);
        const jar = await getTipJarClient(ctx);

        const listTx = await registry.get_creators({ offset: 0, limit: 100 });
        const addresses = listTx.result;

        const profiles = await Promise.all(
          addresses.map(async (addr) => {
            const [profileTx, balanceTx] = await Promise.all([
              registry.get_creator({ wallet: addr }),
              jar.balance_of({ creator: addr }),
            ]);
            const profile = profileTx.result;
            return {
              wallet: addr,
              name: profile?.name ?? "",
              bio: profile?.bio ?? "",
              avatar: profile?.avatar ?? "",
              registeredAt: profile?.registered_at ?? 0n,
              balance: balanceTx.result,
            };
          })
        );

        if (!cancelled) {
          setCreators(profiles);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setCreators([]);
          setError(e instanceof Error ? e.message : "Failed to load creators");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [networkPassphrase, rpcUrl]);

  return { creators, loading, error };
}
