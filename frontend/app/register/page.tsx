"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStellar } from "@/components/StellarProvider";
import { getCreatorRegistryClient } from "@/lib/soroban";

export default function RegisterPage() {
  const router = useRouter();
  const { address, networkPassphrase, rpcUrl, signTransactionXdr, signAuthEntryXdr } = useStellar();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarURI, setAvatarURI] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isSuccess && address) {
      const timeout = setTimeout(() => router.push(`/creator/${address}`), 1200);
      return () => clearTimeout(timeout);
    }
  }, [isSuccess, address, router]);

  function handleSubmit(e: React.FormEvent) {
    void (async () => {
      e.preventDefault();
      setFormError(null);
      setTxError(null);
      setIsSuccess(false);

      if (!address) {
        setFormError("Connect your wallet to register.");
        return;
      }
      if (!networkPassphrase) {
        setFormError("Freighter network details unavailable.");
        return;
      }
      if (!name.trim()) {
        setFormError("A display name is required.");
        return;
      }

      setIsPending(true);
      try {
        const client = await getCreatorRegistryClient({
          publicKey: address,
          networkPassphrase,
          rpcUrl: rpcUrl ?? "",
          signTransaction: signTransactionXdr,
          signAuthEntry: signAuthEntryXdr,
        });

        const tx = await client.register({
          caller: address,
          name: name.trim(),
          bio: bio.trim(),
          avatar: avatarURI.trim(),
        });
        setIsPending(false);
        setIsConfirming(true);
        await tx.signAndSend();
        setIsConfirming(false);
        setIsSuccess(true);
      } catch (err) {
        setIsPending(false);
        setIsConfirming(false);
        setTxError(err instanceof Error ? err.message : "Transaction failed.");
      }
    })();
  }

  const isConnected = Boolean(address);

  return (
    <div className="mx-auto max-w-lg py-14">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-copper">
        New ledger entry
      </p>
      <h1 className="mt-3 font-display text-3xl text-paper">Register as a creator</h1>
      <p className="mt-3 font-body text-sm text-paper/60">
        Your profile is stored on-chain and tied to your connected wallet.
        Supporters will send tips directly to this address.
      </p>

      {!isConnected && (
        <div className="mt-8 border border-slate bg-ink-light px-4 py-4">
          <p className="font-body text-sm text-paper/70">
            Connect your wallet using the button in the top right to register.
          </p>
        </div>
      )}

      {isConnected && (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="name" className="block font-mono text-xs uppercase tracking-wide text-paper/50">
              Display name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alice"
              maxLength={64}
              className="mt-2 w-full border border-slate bg-ink px-3 py-2.5 font-body text-paper placeholder:text-paper/30 focus:border-gold"
            />
          </div>

          <div>
            <label htmlFor="bio" className="block font-mono text-xs uppercase tracking-wide text-paper/50">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="I make tutorials on smart contract security."
              maxLength={280}
              rows={3}
              className="mt-2 w-full border border-slate bg-ink px-3 py-2.5 font-body text-paper placeholder:text-paper/30 focus:border-gold"
            />
          </div>

          <div>
            <label htmlFor="avatar" className="block font-mono text-xs uppercase tracking-wide text-paper/50">
              Avatar URI <span className="text-paper/30">(optional, e.g. ipfs://…)</span>
            </label>
            <input
              id="avatar"
              value={avatarURI}
              onChange={(e) => setAvatarURI(e.target.value)}
              placeholder="ipfs://…"
              className="mt-2 w-full border border-slate bg-ink px-3 py-2.5 font-body text-paper placeholder:text-paper/30 focus:border-gold"
            />
          </div>

          {formError && <p className="font-body text-sm text-copper">{formError}</p>}
          {txError && <p className="font-body text-sm text-copper">{txError}</p>}
          {isSuccess && (
            <p className="font-body text-sm text-mint">Registered! Redirecting to your profile…</p>
          )}

          <button
            type="submit"
            disabled={isPending || isConfirming}
            className="w-full border border-gold bg-gold px-5 py-3 font-body text-sm font-medium text-ink transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "Confirm in wallet…"
              : isConfirming
              ? "Writing to the ledger…"
              : "Register"}
          </button>
        </form>
      )}
    </div>
  );
}
