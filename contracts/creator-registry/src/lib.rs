#![no_std]

//! CreatorRegistry — public, on-chain creator profiles.
//!
//! The TipJar contract reads from this registry (via `is_registered`) before
//! accepting a tip, so funds can never be escrowed for an address that has no
//! public profile.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String, Vec,
};

/// Roughly one day's worth of ledgers (5s close time).
const DAY_IN_LEDGERS: u32 = 17_280;
/// How far to extend a storage entry's life on each touch.
const BUMP_LEDGERS: u32 = 30 * DAY_IN_LEDGERS;
/// Extend whenever an entry has less than this much life left.
const BUMP_THRESHOLD: u32 = BUMP_LEDGERS - DAY_IN_LEDGERS;

const MAX_NAME_LEN: u32 = 64;
const MAX_BIO_LEN: u32 = 280;
const MAX_AVATAR_LEN: u32 = 256;
/// Upper bound on how many addresses a single `get_creators` call may return,
/// so the call can never exceed the host's resource limits.
const MAX_PAGE_LIMIT: u32 = 100;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Creator {
    pub wallet: Address,
    pub name: String,
    pub bio: String,
    pub avatar: String,
    pub registered_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Profile for a single creator.
    Creator(Address),
    /// Ordered list of every registered creator, for enumeration.
    Index,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyRegistered = 1,
    NotRegistered = 2,
    EmptyName = 3,
    NameTooLong = 4,
    BioTooLong = 5,
    AvatarTooLong = 6,
}

/// Emitted when a new creator profile is created.
/// Wire format: topics `("register", caller)`, data `name`.
#[contractevent(topics = ["register"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Registered {
    #[topic]
    pub caller: Address,
    pub name: String,
}

/// Emitted when an existing creator profile is edited.
/// Wire format: topics `("updated", caller)`, data `name`.
#[contractevent(topics = ["updated"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Updated {
    #[topic]
    pub caller: Address,
    pub name: String,
}

#[contract]
pub struct CreatorRegistry;

#[contractimpl]
impl CreatorRegistry {
    /// Register `caller` as a creator. Requires `caller`'s authorization.
    pub fn register(
        env: Env,
        caller: Address,
        name: String,
        bio: String,
        avatar: String,
    ) -> Result<(), Error> {
        caller.require_auth();
        validate_profile(&name, &bio, &avatar)?;

        let key = DataKey::Creator(caller.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyRegistered);
        }

        let creator = Creator {
            wallet: caller.clone(),
            name: name.clone(),
            bio,
            avatar,
            registered_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &creator);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_LEDGERS);

        let mut index: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Index)
            .unwrap_or_else(|| Vec::new(&env));
        index.push_back(caller.clone());
        env.storage().instance().set(&DataKey::Index, &index);
        env.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_LEDGERS);

        Registered { caller, name }.publish(&env);

        Ok(())
    }

    /// Update an existing profile. Requires `caller`'s authorization.
    pub fn update_profile(
        env: Env,
        caller: Address,
        name: String,
        bio: String,
        avatar: String,
    ) -> Result<(), Error> {
        caller.require_auth();
        validate_profile(&name, &bio, &avatar)?;

        let key = DataKey::Creator(caller.clone());
        let mut creator: Creator = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotRegistered)?;

        creator.name = name.clone();
        creator.bio = bio;
        creator.avatar = avatar;

        env.storage().persistent().set(&key, &creator);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_LEDGERS);

        Updated { caller, name }.publish(&env);

        Ok(())
    }

    /// Whether `wallet` has a registered profile. Called by TipJar before
    /// accepting a tip.
    pub fn is_registered(env: Env, wallet: Address) -> bool {
        env.storage().persistent().has(&DataKey::Creator(wallet))
    }

    /// Fetch a full profile, or `None` if the address isn't registered.
    pub fn get_creator(env: Env, wallet: Address) -> Option<Creator> {
        env.storage().persistent().get(&DataKey::Creator(wallet))
    }

    /// Total number of registered creators.
    pub fn creator_count(env: Env) -> u32 {
        Self::index(&env).len()
    }

    /// A page of creator addresses, for frontend listing. `limit` is capped at
    /// 100; an out-of-range `offset` yields an empty page rather than an error.
    pub fn get_creators(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        let index = Self::index(&env);
        let total = index.len();
        let mut page = Vec::new(&env);

        if offset >= total || limit == 0 {
            return page;
        }

        let capped = if limit > MAX_PAGE_LIMIT {
            MAX_PAGE_LIMIT
        } else {
            limit
        };
        let end = offset.saturating_add(capped).min(total);

        for i in offset..end {
            page.push_back(index.get_unchecked(i));
        }
        page
    }

    fn index(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Index)
            .unwrap_or_else(|| Vec::new(env))
    }
}

fn validate_profile(name: &String, bio: &String, avatar: &String) -> Result<(), Error> {
    if name.is_empty() {
        return Err(Error::EmptyName);
    }
    if name.len() > MAX_NAME_LEN {
        return Err(Error::NameTooLong);
    }
    if bio.len() > MAX_BIO_LEN {
        return Err(Error::BioTooLong);
    }
    if avatar.len() > MAX_AVATAR_LEN {
        return Err(Error::AvatarTooLong);
    }
    Ok(())
}

#[cfg(test)]
mod test;
