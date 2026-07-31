"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStellar } from "@/components/StellarProvider";
import { getCreatorRegistryClient, getTipJarClient } from "@/lib/soroban";
import { formatXlm } from "@/lib/format";
import { TipTicker } from "@/components/TipTicker";

export default function DashboardPage() {
  const { address, networkPassphrase, rpcUrl, signTransactionXdr, signAuthEntryXdr } = useStellar();
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState(false);

  const ctx = useMemo(() => {
    if (!address || !networkPassphrase) return null;
    return {
      publicKey: address,
      networkPassphrase,
      rpcUrl: rpcUrl ?? "",
      signTransaction: signTransactionXdr,
      signAuthEntry: signAuthEntryXdr,
    };
  }, [address, networkPassphrase, rpcUrl, signAuthEntryXdr, signTransactionXdr]);

  const refresh = useCallback(async () => {
    if (!ctx) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const registry = await getCreatorRegistryClient(ctx);
      const jar = await getTipJarClient(ctx);

      const regTx = await registry.is_registered({ wallet: ctx.publicKey });
      await regTx.simulate();
      setIsRegistered(regTx.result);

      const balTx = await jar.balance_of({ creator: ctx.publicKey });
      await balTx.simulate();
      setBalance(balTx.result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load dashboard.");
      setIsRegistered(null);
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [ctx]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!address) {
    return (
      <div className="py-16">
        <p className="font-body text-sm text-paper/60">
          Connect your wallet to view your dashboard.
        </p>
      </div>
    );
  }

  if (isRegistered === false) {
    return (
      <div className="py-16">
        <p className="font-body text-sm text-paper/60">
          This wallet isn&apos;t registered as a creator yet.{" "}
          <Link href="/register" className="text-gold underline underline-offset-4">
            Register now
          </Link>
          .
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-16">
        <p className="font-body text-sm text-copper">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="py-12">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-copper">
        Your ledger
      </p>
      <h1 className="mt-3 font-display text-3xl text-paper">Dashboard</h1>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="border border-slate bg-ink-light p-6">
            <p className="font-mono text-[11px] uppercase tracking-wide text-paper/40">
              Withdrawable balance
            </p>
            <p className="mt-2 font-mono text-4xl text-gold">
              {balance !== null ? `${formatXlm(balance)} XLM` : isLoading ? "…" : "0 XLM"}
            </p>

            <button
              type="button"
              onClick={() => {
                void (async () => {
                  if (!ctx) return;
                  setTxError(null);
                  setTxSuccess(false);
                  setIsPending(true);
                  try {
                    const jar = await getTipJarClient(ctx);
                    const tx = await jar.withdraw({ creator: ctx.publicKey });
                    setIsPending(false);
                    setIsConfirming(true);
                    await tx.signAndSend();
                    setIsConfirming(false);
                    setTxSuccess(true);
                    await refresh();
                  } catch (err) {
                    setIsPending(false);
                    setIsConfirming(false);
                    setTxError(err instanceof Error ? err.message : "Withdrawal failed.");
                  }
                })();
              }}
              disabled={isPending || isConfirming || !balance || balance <= 0n}
              className="mt-6 border border-gold bg-gold px-6 py-3 font-body text-sm font-medium text-ink transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending
                ? "Confirm in wallet…"
                : isConfirming
                ? "Withdrawing…"
                : "Withdraw to wallet"}
            </button>

            {txError && <p className="mt-3 font-body text-sm text-copper">{txError}</p>}
            {txSuccess && <p className="mt-3 font-body text-sm text-mint">Withdrawal complete.</p>}
          </div>

          <div className="mt-10">
            <h2 className="border-b border-slate pb-3 font-display text-xl text-paper">
              Tips you&apos;ve received
            </h2>
            <div className="mt-4">
              <TipTicker creatorFilter={address} emptyLabel="No tips received yet." />
            </div>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="border border-slate bg-ink-light p-4">
            <p className="font-mono text-[11px] uppercase tracking-wide text-paper/40">
              Your public profile
            </p>
            <Link
              href={`/creator/${address}`}
              className="mt-2 block font-body text-sm text-gold underline underline-offset-4"
            >
              View as supporters see it →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
