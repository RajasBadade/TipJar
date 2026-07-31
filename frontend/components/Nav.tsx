"use client";

import Link from "next/link";
import { useStellar } from "@/components/StellarProvider";
import { shortAddress } from "@/lib/format";

export function Nav() {
  const { address, connect, disconnect } = useStellar();

  return (
    <header className="border-b border-slate">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-tight text-paper">
            Tip<span className="text-gold">Jar</span>
          </span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40 sm:inline">
            No. 001 — On-chain ledger
          </span>
        </Link>

        <nav className="flex items-center gap-6">
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
              className="rounded-full border border-slate px-4 py-2 font-body text-sm text-paper/80 transition hover:border-gold hover:text-gold"
            >
              {shortAddress(address)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void connect();
              }}
              className="rounded-full bg-gold px-4 py-2 font-body text-sm text-forest transition hover:bg-gold/90"
            >
              Connect Freighter
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
