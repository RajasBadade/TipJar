"use client";

import { useEffect, useState, useCallback } from "react";
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { useStellar } from "@/components/StellarProvider";
import { CONTRACT_IDS, DEFAULT_SOROBAN_RPC_URL } from "@/lib/contracts";

export type TipEvent = {
  id: string;
  from: string;
  to: string;
  amount: bigint;
  message: string;
  timestamp: bigint;
};

const POLL_INTERVAL_MS = 5000;

/**
 * Soroban has no push-based event subscription, so the feed backfills recent
 * history on mount and then polls for new events using a cursor.
 */
export function useTipFeed(creatorFilter?: string, historyLedgers = 17_280) {
  const [tips, setTips] = useState<TipEvent[]>([]);
  const { rpcUrl } = useStellar();

  const addTips = useCallback((incoming: TipEvent[]) => {
    if (incoming.length === 0) return;
    setTips((prev) => {
      const seen = new Set(prev.map((t) => t.id));
      const fresh = incoming.filter((t) => !seen.has(t.id));
      if (fresh.length === 0) return prev;
      // Newest first.
      return [...fresh.reverse(), ...prev].slice(0, 100);
    });
  }, []);

  useEffect(() => {
    const url = rpcUrl || DEFAULT_SOROBAN_RPC_URL;
    if (!url || !CONTRACT_IDS.tipJar) return;

    let cancelled = false;
    let cursor: string | undefined;
    const server = new rpc.Server(url, { allowHttp: url.startsWith("http://") });

    async function poll() {
      try {
        const filters: rpc.Api.EventFilter[] = [
          { type: "contract", contractIds: [CONTRACT_IDS.tipJar] },
        ];

        // startLedger and cursor are mutually exclusive in the RPC API.
        const request: rpc.Api.GetEventsRequest = cursor
          ? { filters, cursor, limit: 100 }
          : {
              filters,
              startLedger: Math.max(
                (await server.getLatestLedger()).sequence - historyLedgers,
                1
              ),
              limit: 100,
            };

        const response = await server.getEvents(request);
        if (cancelled) return;

        const parsed: TipEvent[] = [];
        for (const evt of response.events) {
          try {
            const topics = evt.topic.map((t) => scValToNative(t));
            // Topics are (symbol "tip", from, creator).
            if (topics.length < 3 || topics[0] !== "tip") continue;

            const from = String(topics[1]);
            const to = String(topics[2]);
            if (creatorFilter && to !== creatorFilter) continue;

            // Data is (amount, message, timestamp).
            const data = scValToNative(evt.value) as [bigint, string, bigint];
            if (!Array.isArray(data) || data.length < 3) continue;

            parsed.push({
              id: evt.id,
              from,
              to,
              amount: BigInt(data[0]),
              message: String(data[1] ?? ""),
              timestamp: BigInt(data[2] ?? 0),
            });
          } catch {
            // Skip any event we cannot decode rather than breaking the feed.
          }
        }

        addTips(parsed);

        if (response.events.length > 0) {
          cursor = response.events[response.events.length - 1].id;
        } else if (!cursor && response.cursor) {
          cursor = response.cursor;
        }
      } catch {
        // Network hiccups are non-fatal; the next tick retries.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rpcUrl, creatorFilter, historyLedgers, addTips]);

  return tips;
}
