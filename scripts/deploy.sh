#!/usr/bin/env bash
# Build and deploy the TipJar contracts to a Stellar network.
#
# Reproduces the full deployment workflow:
#   1. Build both contracts to wasm32v1-none
#   2. Deploy CreatorRegistry
#   3. Resolve the native XLM Stellar Asset Contract id
#   4. Deploy TipJar, wiring it to the registry + token via its constructor
#   5. Verify the wiring, then write frontend/.env.local
#
# Requires the `stellar` CLI and a funded identity:
#   stellar keys generate deployer --network testnet --fund
#
# Usage: ./scripts/deploy.sh [network] [identity]
set -euo pipefail

NETWORK="${1:-testnet}"
IDENTITY="${2:-deployer}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT/contracts"
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"

command -v stellar >/dev/null 2>&1 || {
  echo "error: stellar CLI not found on PATH." >&2
  exit 1
}

echo "[1/5] Building contracts (wasm32v1-none, release)"
(cd "$CONTRACTS_DIR" && cargo build --target wasm32v1-none --release)

REGISTRY_WASM="$WASM_DIR/creator_registry.wasm"
TIPJAR_WASM="$WASM_DIR/tipjar.wasm"
for w in "$REGISTRY_WASM" "$TIPJAR_WASM"; do
  [ -f "$w" ] || { echo "error: expected build artifact missing: $w" >&2; exit 1; }
done

echo "[2/5] Deploying CreatorRegistry"
REGISTRY_ID=$(stellar contract deploy \
  --wasm "$REGISTRY_WASM" --source "$IDENTITY" --network "$NETWORK")
echo "      CreatorRegistry: $REGISTRY_ID"

echo "[3/5] Resolving native XLM Stellar Asset Contract"
TOKEN_ID=$(stellar contract id asset \
  --asset native --source "$IDENTITY" --network "$NETWORK")
echo "      Native XLM SAC: $TOKEN_ID"

echo "[4/5] Deploying TipJar (constructor: registry + token)"
TIPJAR_ID=$(stellar contract deploy \
  --wasm "$TIPJAR_WASM" --source "$IDENTITY" --network "$NETWORK" \
  -- --registry "$REGISTRY_ID" --token "$TOKEN_ID")
echo "      TipJar: $TIPJAR_ID"

echo "[5/5] Verifying inter-contract wiring"
WIRED=$(stellar contract invoke \
  --id "$TIPJAR_ID" --source "$IDENTITY" --network "$NETWORK" -- registry \
  | tr -d '"')
if [ "$WIRED" != "$REGISTRY_ID" ]; then
  echo "error: TipJar reports registry '$WIRED' but expected '$REGISTRY_ID'." >&2
  exit 1
fi
echo "      TipJar.registry() matches the deployed registry."

case "$NETWORK" in
  testnet)   PASSPHRASE="Test SDF Network ; September 2015";            RPC_URL="https://soroban-testnet.stellar.org" ;;
  futurenet) PASSPHRASE="Test SDF Future Network ; October 2022";       RPC_URL="https://rpc-futurenet.stellar.org" ;;
  mainnet)   PASSPHRASE="Public Global Stellar Network ; September 2015"; RPC_URL="https://mainnet.sorobanrpc.com" ;;
  *)         PASSPHRASE="Test SDF Network ; September 2015";            RPC_URL="https://soroban-testnet.stellar.org" ;;
esac

cat > "$ROOT/frontend/.env.local" <<EOF
NEXT_PUBLIC_SOROBAN_RPC_URL=$RPC_URL
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=$PASSPHRASE
NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID=$REGISTRY_ID
NEXT_PUBLIC_TIPJAR_CONTRACT_ID=$TIPJAR_ID
EOF

echo
echo "Deployed to $NETWORK. Wrote frontend/.env.local"
echo "  CreatorRegistry : $REGISTRY_ID"
echo "  TipJar          : $TIPJAR_ID"
echo "  Native XLM SAC  : $TOKEN_ID"
echo
echo "Remember to update the contract ids in README.md and .github/workflows/ci.yml."
