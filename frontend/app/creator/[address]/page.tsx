"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useStellar } from "@/components/StellarProvider";
import { getCreatorRegistryClient, getTipJarClient } from "@/lib/soroban";
import { TipTicker } from "@/components/TipTicker";
import { TipModal } from "@/components/TipModal";
import { formatXlm, shortAddress } from "@/lib/format";

export default function CreatorProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const [showTipModal, setShowTipModal] = useState(false);
  const { networkPassphrase, rpcUrl } = useStellar();

  const [profile, setProfile] = useState<{
    wallet: string;
    name: string;
    bio: string;
    avatar: string;
    registeredAt: bigint;
  } | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const ctx = {
          networkPassphrase: networkPassphrase ?? undefined,
          rpcUrl: rpcUrl ?? undefined,
        };
        const registry = await getCreatorRegistryClient(ctx);
        const jar = await getTipJarClient(ctx);

        const [profileTx, balanceTx] = await Promise.all([
          registry.get_creator({ wallet: address }),
          jar.balance_of({ creator: address }),
        ]);

        const p = profileTx.result;
        if (!cancelled) {
          if (!p) {
            setError("No creator is registered at this address.");
            setProfile(null);
          } else {
            setProfile({
              wallet: p.wallet,
              name: p.name,
              bio: p.bio,
              avatar: p.avatar,
              registeredAt: p.registered_at,
            });
            setBalance(balanceTx.result);
            setError(null);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [address, networkPassphrase, rpcUrl]);

  if (loading) {
    return <p className="py-16 font-mono text-sm text-paper/40">Loading profile…</p>;
  }

  if (error || !profile) {
    return (
      <div className="py-16">
        <p className="font-body text-sm text-copper">
          {error || "No creator is registered at this address."}
        </p>
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-slate bg-ink-light font-display text-3xl text-gold">
              {profile.name.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <h1 className="font-display text-3xl text-paper">{profile.name}</h1>
              <p className="font-mono text-xs text-paper/40">{shortAddress(profile.wallet)}</p>
            </div>
          </div>

          <p className="mt-6 max-w-xl font-body text-base text-paper/70">
            {profile.bio || "This creator hasn't written a bio yet."}
          </p>

          <div className="mt-8 flex items-center gap-6 border-y border-slate py-4">
            <div>
              <p className="font-mono text-2xl text-gold">{formatXlm(balance)} XLM</p>
              <p className="font-mono text-[11px] uppercase tracking-wide text-paper/40">
                total received
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowTipModal(true)}
            className="mt-8 border border-gold bg-gold px-6 py-3 font-body text-sm font-medium text-ink transition hover:bg-transparent hover:text-gold"
          >
            Send a tip
          </button>
        </div>

        <aside>
          <TipTicker creatorFilter={address} emptyLabel="No tips yet — send the first one." />
        </aside>
      </div>

      {showTipModal && <TipModal creator={address} onClose={() => setShowTipModal(false)} />}
    </div>
  );
}
