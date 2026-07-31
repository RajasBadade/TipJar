export const CONTRACT_IDS = {
  creatorRegistry: process.env.NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID ?? "",
  tipJar: process.env.NEXT_PUBLIC_TIPJAR_CONTRACT_ID ?? "",
};

export const DEFAULT_SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "";

export const DEFAULT_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? "";

export const BADGE_THRESHOLD = 3;
