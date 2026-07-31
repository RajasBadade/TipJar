"use client";

import { useTipFeed } from "@/lib/useTipFeed";
import { formatXlm, shortAddress, timeAgo } from "@/lib/format";

export function TipTicker({
  creatorFilter,
  emptyLabel = "No tips yet — be the first to print one.",
}: {
  creatorFilter?: string;
  emptyLabel?: string;
}) {
  const tips = useTipFeed(creatorFilter);

  return (
    <div className="border border-slate bg-ink-light">
      <div className="flex items-center justify-between border-b border-slate px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50">
          Live ledger feed
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-mint">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-mint" />
          streaming
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {tips.length === 0 && (
          <p className="px-4 py-8 text-center font-mono text-sm text-paper/40">{emptyLabel}</p>
        )}

        <ul>
          {tips.map((tip, i) => (
            <li
              key={tip.id}
              className="animate-tickerIn border-b border-slate/60 px-4 py-3 last:border-b-0"
              style={{ animationDelay: `${Math.min(i, 5) * 40}ms` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-sm font-medium text-gold">
                  {formatXlm(tip.amount)} XLM
                </span>
                <span className="shrink-0 font-mono text-[11px] text-paper/40">
                  {timeAgo(tip.timestamp)}
                </span>
              </div>
              {tip.message && (
                <p className="mt-1 font-body text-sm italic text-paper/80">&ldquo;{tip.message}&rdquo;</p>
              )}
              <p className="mt-1 font-mono text-[11px] text-paper/40">
                from {shortAddress(tip.from)}
                {!creatorFilter && <> → {shortAddress(tip.to)}</>}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
