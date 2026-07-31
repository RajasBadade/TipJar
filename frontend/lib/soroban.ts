import { contract } from "@stellar/stellar-sdk";
import type {
  AssembledTransaction,
  ClientOptions,
  MethodOptions,
} from "@stellar/stellar-sdk/contract";
import {
  CONTRACT_IDS,
  DEFAULT_NETWORK_PASSPHRASE,
  DEFAULT_SOROBAN_RPC_URL,
} from "@/lib/contracts";

/**
 * Signing callbacks are optional: read-only calls are simulated against a
 * throw-away account by the SDK, so a wallet is not required to browse.
 */
export type SorobanClientContext = {
  publicKey?: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  signTransaction?: (txXdr: string) => Promise<string>;
  signAuthEntry?: (authEntryXdr: string) => Promise<string>;
};

export type CreatorProfile = {
  wallet: string;
  name: string;
  bio: string;
  avatar: string;
  registered_at: bigint;
};

export type CreatorRegistryContract = {
  register: (
    args: { caller: string; name: string; bio: string; avatar: string },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;
  update_profile: (
    args: { caller: string; name: string; bio: string; avatar: string },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;
  is_registered: (
    args: { wallet: string },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<boolean>>;
  get_creator: (
    args: { wallet: string },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<CreatorProfile | undefined>>;
  creator_count: (opts?: MethodOptions) => Promise<AssembledTransaction<number>>;
  get_creators: (
    args: { offset: number; limit: number },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<string[]>>;
};

export type TipJarContract = {
  tip: (
    args: { from: string; creator: string; amount: bigint; message: string },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;
  withdraw: (
    args: { creator: string },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<bigint>>;
  balance_of: (
    args: { creator: string },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<bigint>>;
  tip_count: (
    args: { supporter: string; creator: string },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<number>>;
  has_badge: (
    args: { supporter: string; creator: string },
    opts?: MethodOptions
  ) => Promise<AssembledTransaction<boolean>>;
  registry: (opts?: MethodOptions) => Promise<AssembledTransaction<string>>;
  token: (opts?: MethodOptions) => Promise<AssembledTransaction<string>>;
};

function buildClientOptions(
  ctx: SorobanClientContext,
  contractId: string
): ClientOptions {
  const rpcUrl = ctx.rpcUrl || DEFAULT_SOROBAN_RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      "Missing Soroban RPC URL. Set NEXT_PUBLIC_SOROBAN_RPC_URL or connect Freighter."
    );
  }
  const networkPassphrase = ctx.networkPassphrase || DEFAULT_NETWORK_PASSPHRASE;
  if (!networkPassphrase) {
    throw new Error(
      "Missing Stellar network passphrase. Set NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE."
    );
  }

  const { signTransaction, signAuthEntry, publicKey } = ctx;

  return {
    contractId,
    rpcUrl,
    networkPassphrase,
    allowHttp: rpcUrl.startsWith("http://"),
    publicKey,
    // The SDK expects wallet-shaped results, not bare XDR strings.
    signTransaction: signTransaction
      ? async (txXdr: string) => ({
          signedTxXdr: await signTransaction(txXdr),
          signerAddress: publicKey,
        })
      : undefined,
    signAuthEntry: signAuthEntry
      ? async (entryXdr: string) => ({
          signedAuthEntry: await signAuthEntry(entryXdr),
          signerAddress: publicKey,
        })
      : undefined,
  };
}

export async function getCreatorRegistryClient(ctx: SorobanClientContext) {
  if (!CONTRACT_IDS.creatorRegistry) {
    throw new Error(
      "Missing CreatorRegistry contract id. Set NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID."
    );
  }
  return contract.Client.from<CreatorRegistryContract>(
    buildClientOptions(ctx, CONTRACT_IDS.creatorRegistry)
  );
}

export async function getTipJarClient(ctx: SorobanClientContext) {
  if (!CONTRACT_IDS.tipJar) {
    throw new Error(
      "Missing TipJar contract id. Set NEXT_PUBLIC_TIPJAR_CONTRACT_ID."
    );
  }
  return contract.Client.from<TipJarContract>(
    buildClientOptions(ctx, CONTRACT_IDS.tipJar)
  );
}

/** True when the env vars needed for any contract call are present. */
export function isSorobanConfigured() {
  return Boolean(
    CONTRACT_IDS.creatorRegistry &&
      CONTRACT_IDS.tipJar &&
      DEFAULT_SOROBAN_RPC_URL &&
      DEFAULT_NETWORK_PASSPHRASE
  );
}
