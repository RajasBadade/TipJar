"use client";

import Link from "next/link";
import { useState } from "react";
import { useStellar } from "@/components/StellarProvider";
import { shortAddress } from "@/lib/format";

export function Nav() {
  const { address, connect, disconnect, isFreighterAvailable } = useStellar();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      await connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to Freighter.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <header className="border-b border-slate">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl tracking-tight text-paper sm:text-2xl">
            Tip<span className="text-gold">Jar</span>
          </span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40 sm:inline">
            No. 001 — On-chain ledger
          </span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/register"
            className="hidden font-body text-sm text-paper/70 transition hover:text-gold sm:inline"
          >
            Become a creator
          </Link>
          <Link
            href="/dashboard"
            className="hidden font-body text-sm text-paper/70 transition hover:text-gold sm:inline"
          >
            My dashboard
          </Link>
          {address ? (
            <button
              type="button"
              onClick={disconnect}
              className="rounded-full border border-slate px-3 py-2 font-body text-xs text-paper/80 transition hover:border-gold hover:text-gold sm:px-4 sm:text-sm"
            >
              {shortAddress(address)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void handleConnect();
              }}
              disabled={connecting || isFreighterAvailable === false}
              className="rounded-full bg-gold px-3 py-2 font-body text-xs text-forest transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
            >
              {connecting ? "Connecting…" : "Connect Freighter"}
            </button>
          )}
        </nav>
      </div>

      {isFreighterAvailable === false && !address ? (
        <p className="border-t border-slate bg-forest/40 px-4 py-3 text-center font-body text-xs text-paper/70 sm:px-6">
          Freighter is a desktop browser extension and is not available on mobile. Browse creators and
          the live tip feed here, then open this page on a computer with{" "}
          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold underline decoration-dotted underline-offset-2"
          >
            Freighter installed
          </a>{" "}
          to tip or withdraw.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="border-t border-slate bg-forest/40 px-4 py-3 text-center font-body text-xs text-paper/70 sm:px-6"
        >
          {error}
        </p>
      ) : null}
    </header>
  );
}
