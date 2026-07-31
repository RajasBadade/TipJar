export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function timeAgo(timestampSeconds: bigint | number): string {
  const ts = typeof timestampSeconds === "bigint" ? Number(timestampSeconds) : timestampSeconds;
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - ts);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatXlm(stroops: bigint | number): string {
  const value = typeof stroops === "bigint" ? stroops : BigInt(stroops);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 10_000_000n;
  const frac = abs % 10_000_000n;
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  const out = fracStr.length ? `${whole}.${fracStr}` : whole.toString();
  return negative ? `-${out}` : out;
}

export function parseXlmToStroops(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const negative = trimmed.startsWith("-");
  const normalized = negative ? trimmed.slice(1) : trimmed;
  const [wholePart, fracPart = ""] = normalized.split(".");
  if (!wholePart.length) return null;
  if (fracPart.length > 7) return null;
  const whole = BigInt(wholePart || "0") * 10_000_000n;
  const frac = BigInt((fracPart + "0".repeat(7)).slice(0, 7) || "0");
  const val = whole + frac;
  return negative ? -val : val;
}
