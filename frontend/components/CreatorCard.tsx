"use client";

import Link from "next/link";
import { CreatorProfile } from "@/lib/useCreators";
import { formatXlm, shortAddress } from "@/lib/format";

export function CreatorCard({ creator, index }: { creator: CreatorProfile; index: number }) {
  return (
    <Link
      href={`/creator/${creator.wallet}`}
      className="group flex items-center gap-4 border-b border-slate/60 px-2 py-5 transition hover:bg-ink-light sm:px-4"
    >
      <span className="w-8 shrink-0 font-mono text-xs text-paper/30">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate bg-ink font-display text-lg text-gold">
        {creator.name.charAt(0).toUpperCase() || "?"}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg text-paper group-hover:text-gold">
          {creator.name || shortAddress(creator.wallet)}
        </p>
        <p className="truncate font-body text-sm text-paper/50">
          {creator.bio || "No bio yet."}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-mono text-sm text-gold">{formatXlm(creator.balance)} XLM</p>
        <p className="font-mono text-[11px] text-paper/40">received</p>
      </div>
    </Link>
  );
}
