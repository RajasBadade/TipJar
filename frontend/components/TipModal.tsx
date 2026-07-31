"use client";

import { useState, useEffect } from "react";
import { useStellar } from "@/components/StellarProvider";
import { getTipJarClient } from "@/lib/soroban";
import { parseXlmToStroops } from "@/lib/format";

const PRESET_AMOUNTS = ["0.5", "1", "5"];

export function TipModal({ creator, onClose }: { creator: string; onClose: () => void }) {
  const { address, networkPassphrase, rpcUrl, signTransactionXdr, signAuthEntryXdr } = useStellar();
  const [amount, setAmount] = useState("1");
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState(false);

  useEffect(() => {
    if (txSuccess) {
      const timeout = setTimeout(onClose, 1500);
      return () => clearTimeout(timeout);
    }
  }, [txSuccess, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    setTxError(null);

    const stroops = parseXlmToStroops(amount);
    if (!stroops || stroops <= 0n) {
      setValidationError("Enter an amount greater than 0.");
      return;
    }

    if (!address) {
      setValidationError("Connect your wallet first.");
      return;
    }

    if (!networkPassphrase || !rpcUrl) {
      setValidationError("Freighter network details unavailable.");
      return;
    }

    try {
      setIsPending(true);
      const ctx = {
        publicKey: address,
        networkPassphrase,
        rpcUrl,
        signTransaction: signTransactionXdr,
        signAuthEntry: signAuthEntryXdr,
      };
      const jar = await getTipJarClient(ctx);
      const tx = await jar.tip({
        from: address,
        creator,
        amount: stroops,
        message: message.trim(),
      });

      setIsPending(false);
      setIsConfirming(true);
      await tx.signAndSend();
      setIsConfirming(false);
      setTxSuccess(true);
    } catch (err) {
      setIsPending(false);
      setIsConfirming(false);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxError(
        msg.includes("User declined") || msg.includes("rejected")
          ? "Transaction rejected in wallet."
          : "Transaction failed. Please try again."
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md border border-slate bg-ink-light p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-paper">Send a tip</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-sm text-paper/40 hover:text-gold"
          >
            ✕
          </button>
        </div>

        {!address ? (
          <p className="mt-6 font-body text-sm text-paper/60">
            Connect your wallet first to send a tip.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-paper/50">
                Amount (XLM)
              </label>
              <div className="mt-2 flex gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setAmount(preset)}
                    className={`border px-3 py-1.5 font-mono text-sm transition ${
                      amount === preset
                        ? "border-gold text-gold"
                        : "border-slate text-paper/60 hover:border-gold hover:text-gold"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-3 w-full border border-slate bg-ink px-3 py-2.5 font-mono text-paper focus:border-gold"
              />
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-paper/50">
                Message <span className="text-paper/30">(optional, public)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Love your work!"
                className="mt-2 w-full border border-slate bg-ink px-3 py-2.5 font-body text-paper placeholder:text-paper/30 focus:border-gold"
              />
            </div>

            {validationError && <p className="font-body text-sm text-copper">{validationError}</p>}
            {txError && <p className="font-body text-sm text-copper">{txError}</p>}
            {txSuccess && <p className="font-body text-sm text-mint">Tip sent — thank you!</p>}

            <button
              type="submit"
              disabled={isPending || isConfirming}
              className="w-full border border-gold bg-gold px-5 py-3 font-body text-sm font-medium text-ink transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending
                ? "Confirm in wallet…"
                : isConfirming
                ? "Sending…"
                : `Send ${amount || "0"} XLM`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
