#![no_std]

//! TipJar — non-custodial XLM tipping with pull-payment withdrawals.
//!
//! Inter-contract communication: `tip` calls `CreatorRegistry::is_registered`
//! before accepting funds, so a tip can never be escrowed for an address with
//! no public profile.
//!
//! Amounts are XLM stroops (1 XLM = 10_000_000 stroops), moved via the Stellar
//! Asset Contract for native XLM.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, String,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_LEDGERS: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_THRESHOLD: u32 = BUMP_LEDGERS - DAY_IN_LEDGERS;

const MAX_MESSAGE_LEN: u32 = 200;
/// Number of tips to the same creator that earns a supporter badge.
pub const BADGE_THRESHOLD: u32 = 3;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Immutable config, set once by the constructor.
    Config,
    /// Withdrawable balance, in stroops, for a creator.
    Balance(Address),
    /// How many tips a supporter has sent to a given creator.
    TipCount(Address, Address),
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    /// The CreatorRegistry this jar validates recipients against.
    pub registry: Address,
    /// The token being tipped (the native XLM Stellar Asset Contract).
    pub token: Address,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotRegisteredCreator = 1,
    ZeroTip = 2,
    NothingToWithdraw = 3,
    MessageTooLong = 4,
    SelfTip = 5,
}

/// Emitted on every accepted tip. The frontend streams these for its live feed.
/// Wire format: topics `("tip", from, creator)`, data `[amount, message, timestamp]`.
#[contractevent(topics = ["tip"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tip {
    #[topic]
    pub from: Address,
    #[topic]
    pub creator: Address,
    pub amount: i128,
    pub message: String,
    pub timestamp: u64,
}

/// Emitted when a creator pulls their escrowed balance.
/// Wire format: topics `("withdrawn", creator)`, data `[amount, timestamp]`.
#[contractevent(topics = ["withdrawn"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Withdrawn {
    #[topic]
    pub creator: Address,
    pub amount: i128,
    pub timestamp: u64,
}

/// Minimal view of the registry we depend on. Declaring only the function we
/// call keeps this contract decoupled from the registry's full interface.
mod registry {
    use soroban_sdk::{contractclient, Address, Env};

    #[contractclient(name = "RegistryClient")]
    #[allow(dead_code)] // Only the generated `RegistryClient` is used.
    pub trait Registry {
        fn is_registered(env: Env, wallet: Address) -> bool;
    }
}

use registry::RegistryClient;

#[contract]
pub struct TipJar;

#[contractimpl]
impl TipJar {
    /// Wire the jar to its registry and token. Called once, at deploy time.
    pub fn __constructor(env: Env, registry: Address, token: Address) {
        env.storage()
            .instance()
            .set(&DataKey::Config, &Config { registry, token });
        env.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_LEDGERS);
    }

    /// Send `amount` stroops from `from` to a registered `creator`, with an
    /// optional public message. Funds are held in escrow until the creator
    /// withdraws them.
    pub fn tip(
        env: Env,
        from: Address,
        creator: Address,
        amount: i128,
        message: String,
    ) -> Result<(), Error> {
        from.require_auth();

        if amount <= 0 {
            return Err(Error::ZeroTip);
        }
        if message.len() > MAX_MESSAGE_LEN {
            return Err(Error::MessageTooLong);
        }
        if from == creator {
            return Err(Error::SelfTip);
        }

        let config = Self::config(&env);

        // Inter-contract call: only registered creators can be tipped.
        if !RegistryClient::new(&env, &config.registry).is_registered(&creator) {
            return Err(Error::NotRegisteredCreator);
        }

        // Pull the funds in first; if this fails the whole invocation reverts.
        token::Client::new(&env, &config.token).transfer(
            &from,
            env.current_contract_address(),
            &amount,
        );

        // Credit the creator's withdrawable balance.
        let balance_key = DataKey::Balance(creator.clone());
        let balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&balance_key, &(balance + amount));
        env.storage()
            .persistent()
            .extend_ttl(&balance_key, BUMP_THRESHOLD, BUMP_LEDGERS);

        // Track this supporter's tip count toward their badge.
        let count_key = DataKey::TipCount(from.clone(), creator.clone());
        let new_count: u32 = env
            .storage()
            .persistent()
            .get(&count_key)
            .unwrap_or(0u32)
            .saturating_add(1);
        env.storage().persistent().set(&count_key, &new_count);
        env.storage()
            .persistent()
            .extend_ttl(&count_key, BUMP_THRESHOLD, BUMP_LEDGERS);

        Tip {
            from,
            creator,
            amount,
            message,
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);

        Ok(())
    }

    /// Withdraw the caller's full accumulated balance (pull-payment pattern).
    /// Returns the amount withdrawn, in stroops.
    pub fn withdraw(env: Env, creator: Address) -> Result<i128, Error> {
        creator.require_auth();

        let key = DataKey::Balance(creator.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::NothingToWithdraw);
        }

        // Zero the balance before transferring out, so a re-entrant call during
        // the transfer sees nothing left to withdraw.
        env.storage().persistent().set(&key, &0i128);

        let config = Self::config(&env);
        token::Client::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &creator,
            &amount,
        );

        Withdrawn {
            creator,
            amount,
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);

        Ok(amount)
    }

    /// A creator's current withdrawable balance, in stroops.
    pub fn balance_of(env: Env, creator: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(creator))
            .unwrap_or(0)
    }

    /// How many tips `supporter` has sent to `creator`.
    pub fn tip_count(env: Env, supporter: Address, creator: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::TipCount(supporter, creator))
            .unwrap_or(0)
    }

    /// Whether `supporter` has earned a badge for `creator` by reaching the
    /// tip threshold.
    pub fn has_badge(env: Env, supporter: Address, creator: Address) -> bool {
        Self::tip_count(env, supporter, creator) >= BADGE_THRESHOLD
    }

    /// The registry address this jar validates against.
    pub fn registry(env: Env) -> Address {
        Self::config(&env).registry
    }

    /// The token address this jar accepts.
    pub fn token(env: Env) -> Address {
        Self::config(&env).token
    }

    fn config(env: &Env) -> Config {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .expect("contract not initialized")
    }
}

#[cfg(test)]
mod test;
