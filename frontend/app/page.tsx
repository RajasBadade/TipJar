"use client";

import Link from "next/link";
import { useCreators } from "@/lib/useCreators";
import { CreatorCard } from "@/components/CreatorCard";
import { TipTicker } from "@/components/TipTicker";

export default function HomePage() {
  const { creators, loading, error } = useCreators();

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-slate py-16 sm:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-copper">
          Entry no. 1 — Ledger opened
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl italic leading-tight text-paper sm:text-5xl">
          Every tip, <span className="not-italic text-gold">permanently receipted.</span>
        </h1>
        <p className="mt-5 max-w-lg font-body text-base text-paper/60">
          Send XLM straight to the creators you value. No platform cut, no
          custodian holding your money — just a public, tamper-proof ledger of
          who supported whom, and when.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#creators"
            className="border border-gold bg-gold px-5 py-2.5 font-body text-sm font-medium text-ink transition hover:bg-transparent hover:text-gold"
          >
            Browse creators
          </a>
          <Link
            href="/register"
            className="border border-slate px-5 py-2.5 font-body text-sm font-medium text-paper transition hover:border-gold hover:text-gold"
          >
            Register as a creator
          </Link>
        </div>
      </section>

      {/* Ledger + live feed */}
      <section className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1fr_320px]">
        <div id="creators">
          <div className="flex items-baseline justify-between border-b border-slate pb-3">
            <h2 className="font-display text-xl text-paper">Registered creators</h2>
            <span className="font-mono text-xs text-paper/40">
              {loading ? "loading…" : `${creators.length} on the ledger`}
            </span>
          </div>

          {error && (
            <p className="mt-6 font-mono text-sm text-copper">
              Couldn&apos;t load creators: {error}
            </p>
          )}

          {!error && !loading && creators.length === 0 && (
            <p className="mt-8 font-body text-sm text-paper/50">
              No creators registered yet.{" "}
              <Link href="/register" className="text-gold underline underline-offset-4">
                Be the first line item.
              </Link>
            </p>
          )}

          <div>
            {creators.map((creator, i) => (
              <CreatorCard key={creator.wallet} creator={creator} index={i} />
            ))}
          </div>
        </div>

        <aside>
          <TipTicker />
        </aside>
      </section>
    </div>
  );
}
