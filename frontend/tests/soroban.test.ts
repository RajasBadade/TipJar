import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REGISTRY_ID = "CBW2IVTRWZUMNJKEH6NJGGVFL2UVCI3BJZ2E3VUF3YDYMHEJC5C5ZYB5";
const TIPJAR_ID = "CBSGQUWTCUIK7WUSHKUWW2PUKPZARXOY22VJLBPITBT7762DJB7AMSKN";
const PASSPHRASE = "Test SDF Network ; September 2015";
const RPC_URL = "https://soroban-testnet.stellar.org";

/** Env vars are read at module load, so each case needs a fresh import. */
async function loadSoroban(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return import("@/lib/soroban");
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isSorobanConfigured", () => {
  it("is true only when every required env var is set", async () => {
    const { isSorobanConfigured } = await loadSoroban({
      NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID: REGISTRY_ID,
      NEXT_PUBLIC_TIPJAR_CONTRACT_ID: TIPJAR_ID,
      NEXT_PUBLIC_SOROBAN_RPC_URL: RPC_URL,
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: PASSPHRASE,
    });
    expect(isSorobanConfigured()).toBe(true);
  });

  it("is false when a contract id is missing", async () => {
    const { isSorobanConfigured } = await loadSoroban({
      NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID: REGISTRY_ID,
      NEXT_PUBLIC_TIPJAR_CONTRACT_ID: "",
      NEXT_PUBLIC_SOROBAN_RPC_URL: RPC_URL,
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: PASSPHRASE,
    });
    expect(isSorobanConfigured()).toBe(false);
  });
});

describe("client construction guards", () => {
  it("fails with an actionable message when the registry id is unset", async () => {
    const { getCreatorRegistryClient } = await loadSoroban({
      NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID: "",
      NEXT_PUBLIC_SOROBAN_RPC_URL: RPC_URL,
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: PASSPHRASE,
    });
    await expect(getCreatorRegistryClient({})).rejects.toThrow(
      /NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID/
    );
  });

  it("fails with an actionable message when the tip jar id is unset", async () => {
    const { getTipJarClient } = await loadSoroban({
      NEXT_PUBLIC_TIPJAR_CONTRACT_ID: "",
      NEXT_PUBLIC_SOROBAN_RPC_URL: RPC_URL,
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: PASSPHRASE,
    });
    await expect(getTipJarClient({})).rejects.toThrow(/NEXT_PUBLIC_TIPJAR_CONTRACT_ID/);
  });

  it("fails before any network call when the RPC URL is unset", async () => {
    const { getTipJarClient } = await loadSoroban({
      NEXT_PUBLIC_TIPJAR_CONTRACT_ID: TIPJAR_ID,
      NEXT_PUBLIC_SOROBAN_RPC_URL: "",
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: PASSPHRASE,
    });
    await expect(getTipJarClient({})).rejects.toThrow(/NEXT_PUBLIC_SOROBAN_RPC_URL/);
  });

  it("fails before any network call when the network passphrase is unset", async () => {
    const { getTipJarClient } = await loadSoroban({
      NEXT_PUBLIC_TIPJAR_CONTRACT_ID: TIPJAR_ID,
      NEXT_PUBLIC_SOROBAN_RPC_URL: RPC_URL,
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "",
    });
    await expect(getTipJarClient({})).rejects.toThrow(
      /NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE/
    );
  });

  it("reports the RPC URL as missing before the passphrase, so setup is ordered", async () => {
    const { getTipJarClient } = await loadSoroban({
      NEXT_PUBLIC_TIPJAR_CONTRACT_ID: TIPJAR_ID,
      NEXT_PUBLIC_SOROBAN_RPC_URL: "",
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "",
    });
    await expect(getTipJarClient({})).rejects.toThrow(/NEXT_PUBLIC_SOROBAN_RPC_URL/);
  });
});
