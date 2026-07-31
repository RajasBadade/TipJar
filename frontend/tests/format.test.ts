import { describe, expect, it } from "vitest";
import { formatXlm, parseXlmToStroops, shortAddress, timeAgo } from "@/lib/format";

describe("parseXlmToStroops", () => {
  it("converts whole XLM to stroops", () => {
    expect(parseXlmToStroops("1")).toBe(10_000_000n);
    expect(parseXlmToStroops("250")).toBe(2_500_000_000n);
  });

  it("keeps all 7 decimal places of precision", () => {
    expect(parseXlmToStroops("0.0000001")).toBe(1n);
    expect(parseXlmToStroops("1.2345678".slice(0, 9))).toBe(12_345_678n);
  });

  it("pads short fractions instead of truncating the wrong end", () => {
    expect(parseXlmToStroops("0.5")).toBe(5_000_000n);
    expect(parseXlmToStroops("0.05")).toBe(500_000n);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseXlmToStroops("  2.5  ")).toBe(25_000_000n);
  });

  it("rejects malformed input rather than coercing it to zero", () => {
    expect(parseXlmToStroops("")).toBeNull();
    expect(parseXlmToStroops("abc")).toBeNull();
    expect(parseXlmToStroops("1.2.3")).toBeNull();
    expect(parseXlmToStroops("1e5")).toBeNull();
    expect(parseXlmToStroops(".5")).toBeNull();
  });

  it("rejects more than 7 decimals, which stroops cannot represent", () => {
    expect(parseXlmToStroops("0.12345678")).toBeNull();
  });
});

describe("formatXlm", () => {
  it("renders stroops as human-readable XLM", () => {
    expect(formatXlm(10_000_000n)).toBe("1");
    expect(formatXlm(0n)).toBe("0");
    expect(formatXlm(12_345_678n)).toBe("1.2345678");
  });

  it("trims trailing zeros from the fraction", () => {
    expect(formatXlm(15_000_000n)).toBe("1.5");
    expect(formatXlm(100_000n)).toBe("0.01");
  });

  it("accepts numbers as well as bigints", () => {
    expect(formatXlm(10_000_000)).toBe("1");
  });

  it("preserves the sign of negative amounts", () => {
    expect(formatXlm(-15_000_000n)).toBe("-1.5");
  });
});

describe("formatXlm/parseXlmToStroops round trip", () => {
  it.each(["0", "1", "0.5", "1.2345678", "999999.9999999"])("round-trips %s", (input) => {
    const stroops = parseXlmToStroops(input);
    expect(stroops).not.toBeNull();
    expect(parseXlmToStroops(formatXlm(stroops as bigint))).toBe(stroops);
  });
});

describe("shortAddress", () => {
  it("truncates a Stellar G-address to a readable stub", () => {
    const addr = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";
    expect(shortAddress(addr)).toBe("GBZXN7…MADI");
  });
});

describe("timeAgo", () => {
  const now = () => Math.floor(Date.now() / 1000);

  it("formats seconds, minutes, hours and days", () => {
    expect(timeAgo(now() - 5)).toMatch(/^\d+s ago$/);
    expect(timeAgo(now() - 120)).toBe("2m ago");
    expect(timeAgo(now() - 7200)).toBe("2h ago");
    expect(timeAgo(now() - 172_800)).toBe("2d ago");
  });

  it("clamps future timestamps to 0 instead of going negative", () => {
    expect(timeAgo(now() + 600)).toBe("0s ago");
  });

  it("accepts the bigint timestamps emitted by Soroban events", () => {
    expect(timeAgo(BigInt(now() - 60))).toBe("1m ago");
  });
});
