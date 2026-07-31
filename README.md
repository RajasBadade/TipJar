# TipJar — Non-custodial creator tipping on Stellar

Supporters send XLM tips directly to creators. Funds sit in a Soroban escrow
contract until the creator pulls them, so nobody but the creator can move their
money. Supporters who tip the same creator three or more times earn a badge,
derived entirely from on-chain payment history — no extra asset, no trustline.

Built with Soroban smart contracts (Rust), a Next.js 14 frontend, and the
Freighter wallet.

---

## Live deployment

| Item | Value |
| --- | --- |
| Network | Stellar Testnet |
| CreatorRegistry contract | `CBW2IVTRWZUMNJKEH6NJGGVFL2UVCI3BJZ2E3VUF3YDYMHEJC5C5ZYB5` |
| TipJar contract | `CBSGQUWTCUIK7WUSHKUWW2PUKPZARXOY22VJLBPITBT7762DJB7AMSKN` |
| Native XLM SAC (token) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

Deployment transaction hashes:

| Action | Transaction hash |
| --- | --- |
| Deploy CreatorRegistry | `cb8b4b85da7862ca64288fdca8eb8d0c42954a7760a50d56ec910259d95441b0` |
| Deploy TipJar (with constructor args) | `7372245fdc03f849405e122a8c7fdbd9d4964dde65e1c7496f471dc424684c14` |

Inspect either contract on [Stellar Expert (Testnet)](https://stellar.expert/explorer/testnet):

```
https://stellar.expert/explorer/testnet/contract/CBSGQUWTCUIK7WUSHKUWW2PUKPZARXOY22VJLBPITBT7762DJB7AMSKN
```

**Live demo:** _add your Vercel/Netlify URL here after deploying the frontend_

**Demo video (1–2 min):** _add your video link here_

---

## Architecture

Two contracts, one inter-contract call, and a frontend that streams events
straight from Soroban RPC.

```
                        ┌──────────────────────────────┐
                        │  Next.js 14 frontend (App    │
                        │  Router) + Freighter wallet  │
                        └───────┬──────────────┬───────┘
                    write/read  │              │  getEvents() poll
                                ▼              ▼
   ┌────────────────────────────────────┐   ┌─────────────────────┐
   │ TipJar                             │   │ Soroban RPC         │
   │  • tip(from, creator, amount, msg) │   │  contract events →  │
   │  • withdraw(creator)               │   │  live tip feed      │
   │  • escrow balances + tip counts    │   └─────────────────────┘
   └───────┬──────────────────┬─────────┘
           │ is_registered()  │ transfer()
           ▼                  ▼
   ┌───────────────────┐   ┌─────────────────────────────┐
   │ CreatorRegistry   │   │ Native XLM Stellar Asset    │
   │  • register       │   │ Contract (SAC)              │
   │  • update_profile │   └─────────────────────────────┘
   │  • paginated list │
   └───────────────────┘
```

**Inter-contract communication.** `TipJar::tip` calls
`CreatorRegistry::is_registered` through a generated `RegistryClient`
(`#[contractclient]`) before accepting any funds, so tips can never land on an
unregistered address. The registry contract id is fixed at construction time and
readable via `TipJar::registry`.

**Escrow, not forwarding.** `tip` moves XLM from the supporter into the TipJar
contract and credits an internal `Balance(creator)` entry. Only the creator can
call `withdraw`, which zeroes the balance *before* transferring out.

**Badges from history.** Every accepted tip bumps `TipCount(from, creator)`.
`has_badge(from, creator)` returns `count >= BADGE_THRESHOLD` (3). No token is
minted, so supporters never need a trustline or a second signature.

### Repository layout

```
contracts/
  creator-registry/   # profile registry (Rust, no_std)
  tipjar/             # escrow + tip counting + badge logic
  rust-toolchain.toml # pinned stable + wasm32v1-none target
frontend/
  app/                # Next.js App Router pages
  components/         # wallet provider, cards, forms, tip feed
  lib/                # contract clients, event streaming, formatting
  tests/              # Vitest + Testing Library suite
scripts/
  deploy.ps1          # reproducible deploy (Windows)
  deploy.sh           # reproducible deploy (Linux/macOS/CI)
.github/workflows/
  ci.yml              # contracts job + frontend job
```

---

## Contract API

### CreatorRegistry

| Function | Signature | Notes |
| --- | --- | --- |
| `register` | `(caller: Address, name: String, bio: String, avatar: String)` | Requires auth. Fails with `AlreadyRegistered` on a second call. |
| `update_profile` | `(caller: Address, name: String, bio: String, avatar: String)` | Requires auth. Fails with `NotRegistered`. |
| `is_registered` | `(wallet: Address) -> bool` | Read-only. Called cross-contract by TipJar. |
| `get_creator` | `(wallet: Address) -> Result<Creator, Error>` | Returns `{ wallet, name, bio, avatar, registered_at }`. |
| `creator_count` | `() -> u32` | Size of the index. |
| `get_creators` | `(offset: u32, limit: u32) -> Vec<Address>` | Paginated, `limit` capped at 100. |

Limits: name ≤ 64 chars, bio ≤ 280, avatar URL ≤ 256. Errors: `AlreadyRegistered`,
`NotRegistered`, `NameEmpty`, `NameTooLong`, `BioTooLong`, `AvatarTooLong`.

Events: `Registered` (topics `("register", caller)`) and `Updated`
(topics `("updated", caller)`), both carrying the profile name.

### TipJar

| Function | Signature | Notes |
| --- | --- | --- |
| `__constructor` | `(registry: Address, token: Address)` | Wired at deploy time; immutable afterwards. |
| `tip` | `(from: Address, creator: Address, amount: i128, message: String)` | Requires auth from `from`. Amount in stroops. |
| `withdraw` | `(creator: Address) -> i128` | Requires auth. Returns the amount pulled. |
| `balance_of` | `(creator: Address) -> i128` | Escrowed stroops awaiting withdrawal. |
| `tip_count` | `(from: Address, creator: Address) -> u32` | Supporter's tip count for that creator. |
| `has_badge` | `(from: Address, creator: Address) -> bool` | `tip_count >= 3`. |
| `registry` / `token` / `config` | read-only | Configured addresses. |

Errors: `NotRegisteredCreator`, `ZeroTip`, `NothingToWithdraw`,
`MessageTooLong` (> 200 chars), `SelfTip`.

Events: `Tip` (topics `("tip", from, creator)`, data `[amount, message, timestamp]`)
and `Withdrawn` (topics `("withdrawn", creator)`, data `[amount, timestamp]`).
Both are declared with `#[contractevent]` and an explicit `data_format`, which is
exactly what `frontend/lib/useTipFeed.ts` decodes.

---

## Getting started

### Prerequisites

- **Rust** with the `wasm32v1-none` target (`contracts/rust-toolchain.toml`
  installs it automatically on first build)
- **Stellar CLI** ([install guide](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup))
- **Node.js 20+**
- **[Freighter](https://www.freighter.app/)** browser extension, set to Testnet

### Run the frontend against the deployed contracts

```bash
cd frontend
cp .env.example .env.local   # then paste the contract ids from "Live deployment"
npm install
npm run dev
```

Open http://localhost:3000, connect Freighter, and register as a creator.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | RPC endpoint. Fallback when Freighter reports none. |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Network passphrase fallback. |
| `NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID` | Deployed registry contract id. |
| `NEXT_PUBLIC_TIPJAR_CONTRACT_ID` | Deployed TipJar contract id. |

`isSorobanConfigured()` in `frontend/lib/soroban.ts` gates the UI on all four
being present, so a missing variable surfaces as a readable banner instead of a
runtime crash.

---

## Deployment workflow

Both scripts do the same five things: build the WASM, assert the artifacts
exist, deploy CreatorRegistry, resolve the native XLM SAC id, deploy TipJar with
its constructor args, then invoke `registry` on TipJar and fail loudly if the
returned id does not match. On success they write `frontend/.env.local`.

Windows:

```powershell
./scripts/deploy.ps1 -Network testnet -Identity deployer
```

Linux/macOS/CI:

```bash
./scripts/deploy.sh testnet deployer
```

One-time identity setup:

```bash
stellar keys generate deployer --network testnet --fund
```

<details>
<summary>Equivalent manual commands</summary>

```bash
cd contracts
cargo build --target wasm32v1-none --release

REGISTRY=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/creator_registry.wasm \
  --source deployer --network testnet)

TOKEN=$(stellar contract id asset --asset native --network testnet)

TIPJAR=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/tipjar.wasm \
  --source deployer --network testnet \
  -- --registry "$REGISTRY" --token "$TOKEN")

stellar contract invoke --id "$TIPJAR" --source deployer \
  --network testnet -- registry
```

The bare `--` separates CLI flags from the contract's `__constructor` arguments.
</details>

### Example interaction

```bash
# Register as a creator
stellar contract invoke --id $REGISTRY --source deployer --network testnet \
  -- register --caller $(stellar keys address deployer) \
  --name "Ada" --bio "Writes about ledgers" --avatar ""

# Send a 2.5 XLM tip (25000000 stroops)
stellar contract invoke --id $TIPJAR --source supporter --network testnet \
  -- tip --from $(stellar keys address supporter) \
  --creator $(stellar keys address deployer) \
  --amount 25000000 --message "great post"

# Creator pulls the escrow
stellar contract invoke --id $TIPJAR --source deployer --network testnet \
  -- withdraw --creator $(stellar keys address deployer)
```

---

## Testing

Contracts (29 tests):

```bash
cd contracts
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --all
```

Frontend (32 tests):

```bash
cd frontend
npm run lint
npm run test        # vitest run
npm run test:watch
```

The frontend suite is deliberately offline — the Soroban config tests assert on
which environment variable is reported missing rather than touching the network,
so CI never needs a funded account.

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:

- **contracts** — cargo registry/target cache, `cargo fmt --check`,
  `cargo clippy -D warnings`, `cargo test --all`, release WASM build, then
  uploads both `.wasm` files as build artifacts (`if-no-files-found: error`)
- **frontend** — `npm ci`, `npm run lint`, `npm run test`, `npm run build` with
  the four `NEXT_PUBLIC_*` variables injected

---

## Requirements coverage

| Requirement | Where it lives |
| --- | --- |
| Inter-contract communication | `TipJar::tip` → `RegistryClient::is_registered` (`contracts/tipjar/src/lib.rs`) |
| Event streaming & real-time updates | `#[contractevent]` structs in both contracts; 5s `getEvents()` poll with cursor paging in `frontend/lib/useTipFeed.ts` |
| CI/CD pipeline | `.github/workflows/ci.yml` (contracts + frontend jobs, WASM artifacts) |
| Contract deployment workflow | `scripts/deploy.ps1`, `scripts/deploy.sh`, with post-deploy verification |
| Mobile responsive frontend | Tailwind mobile-first layouts across `frontend/app` and `frontend/components` |
| Error handling & loading states | Typed `#[contracterror]` variants surfaced in the UI; loading/error/empty states in `useCreators`, `useTipFeed`, and every form |
| Contract tests | `contracts/tipjar/src/test.rs` (19), `contracts/creator-registry/src/test.rs` (10) |
| Frontend tests | `frontend/tests/` — format helpers, `CreatorCard`, Soroban config guards (32) |
| Production-ready architecture | Pull-payment escrow, storage TTL extension, input length caps, self-tip guard, pinned toolchain, env-gated clients |
| Documentation | This README plus doc comments on every public contract function |

## Screenshots

Add images under `docs/screenshots/` and link them here:

| What | File |
| --- | --- |
| Mobile responsive UI | `docs/screenshots/mobile.png` |
| CI/CD pipeline running | `docs/screenshots/ci.png` |
| Test output (3+ passing) | `docs/screenshots/tests.png` |

---

## Design notes

The palette is deep bottle-green ledger ink with a gold coin accent — closer to
an accountant's notebook than a crypto dashboard. The tip feed scrolls like a
receipt printer feed, newest slip on top, so activity reads as a running record
rather than a leaderboard.

## License

MIT
