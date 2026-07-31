#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger},
    Env, String,
};

struct Setup {
    env: Env,
    client: CreatorRegistryClient<'static>,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(CreatorRegistry, ());
    let client = CreatorRegistryClient::new(&env, &contract_id);
    Setup { env, client }
}

fn profile(env: &Env) -> (String, String, String) {
    (
        String::from_str(env, "Alice"),
        String::from_str(env, "I make security tutorials."),
        String::from_str(env, "ipfs://avatar"),
    )
}

#[test]
fn register_stores_profile_and_emits_event() {
    let Setup { env, client } = setup();
    env.ledger().set_timestamp(1_700_000_000);
    let alice = Address::generate(&env);
    let (name, bio, avatar) = profile(&env);

    client.register(&alice, &name, &bio, &avatar);

    // The registration event was published. Checked first, because the test
    // env only retains events from the most recent invocation.
    assert!(!env.events().all().events().is_empty());

    let stored = client.get_creator(&alice).unwrap();
    assert_eq!(stored.wallet, alice);
    assert_eq!(stored.name, name);
    assert_eq!(stored.bio, bio);
    assert_eq!(stored.avatar, avatar);
    assert_eq!(stored.registered_at, 1_700_000_000);

    assert!(client.is_registered(&alice));
    assert_eq!(client.creator_count(), 1);
}

#[test]
fn unregistered_address_reports_absent() {
    let Setup { env, client } = setup();
    let nobody = Address::generate(&env);

    assert!(!client.is_registered(&nobody));
    assert_eq!(client.get_creator(&nobody), None);
    assert_eq!(client.creator_count(), 0);
}

#[test]
fn register_twice_fails() {
    let Setup { env, client } = setup();
    let alice = Address::generate(&env);
    let (name, bio, avatar) = profile(&env);

    client.register(&alice, &name, &bio, &avatar);
    let err = client
        .try_register(&alice, &name, &bio, &avatar)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, Error::AlreadyRegistered);
    // The duplicate attempt must not have grown the index.
    assert_eq!(client.creator_count(), 1);
}

#[test]
fn empty_name_is_rejected() {
    let Setup { env, client } = setup();
    let alice = Address::generate(&env);
    let (_, bio, avatar) = profile(&env);

    let err = client
        .try_register(&alice, &String::from_str(&env, ""), &bio, &avatar)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, Error::EmptyName);
    assert!(!client.is_registered(&alice));
}

#[test]
fn over_long_fields_are_rejected() {
    let Setup { env, client } = setup();
    let alice = Address::generate(&env);
    let (name, bio, avatar) = profile(&env);

    let long_name = String::from_str(&env, core::str::from_utf8(&[b'a'; 65]).unwrap());
    assert_eq!(
        client
            .try_register(&alice, &long_name, &bio, &avatar)
            .unwrap_err()
            .unwrap(),
        Error::NameTooLong
    );

    let long_bio = String::from_str(&env, core::str::from_utf8(&[b'b'; 281]).unwrap());
    assert_eq!(
        client
            .try_register(&alice, &name, &long_bio, &avatar)
            .unwrap_err()
            .unwrap(),
        Error::BioTooLong
    );

    let long_avatar = String::from_str(&env, core::str::from_utf8(&[b'c'; 257]).unwrap());
    assert_eq!(
        client
            .try_register(&alice, &name, &bio, &long_avatar)
            .unwrap_err()
            .unwrap(),
        Error::AvatarTooLong
    );
}

#[test]
fn update_profile_overwrites_fields_but_keeps_timestamp() {
    let Setup { env, client } = setup();
    env.ledger().set_timestamp(1_000);
    let alice = Address::generate(&env);
    let (name, bio, avatar) = profile(&env);
    client.register(&alice, &name, &bio, &avatar);

    env.ledger().set_timestamp(9_999);
    let new_name = String::from_str(&env, "Alice v2");
    let new_bio = String::from_str(&env, "Now writing about Soroban.");
    let new_avatar = String::from_str(&env, "ipfs://avatar2");
    client.update_profile(&alice, &new_name, &new_bio, &new_avatar);

    let stored = client.get_creator(&alice).unwrap();
    assert_eq!(stored.name, new_name);
    assert_eq!(stored.bio, new_bio);
    assert_eq!(stored.avatar, new_avatar);
    // registered_at is the original registration time, not the update time.
    assert_eq!(stored.registered_at, 1_000);
    // Updating must not duplicate the index entry.
    assert_eq!(client.creator_count(), 1);
}

#[test]
fn update_unregistered_fails() {
    let Setup { env, client } = setup();
    let alice = Address::generate(&env);
    let (name, bio, avatar) = profile(&env);

    let err = client
        .try_update_profile(&alice, &name, &bio, &avatar)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, Error::NotRegistered);
}

#[test]
fn register_requires_caller_auth() {
    let env = Env::default();
    // Note: no mock_all_auths here, so the missing signature must cause a panic.
    let contract_id = env.register(CreatorRegistry, ());
    let client = CreatorRegistryClient::new(&env, &contract_id);
    let alice = Address::generate(&env);
    let (name, bio, avatar) = profile(&env);

    let result = client.try_register(&alice, &name, &bio, &avatar);
    assert!(result.is_err(), "unauthorized registration must fail");
}

#[test]
fn get_creators_paginates() {
    let Setup { env, client } = setup();
    let (name, bio, avatar) = profile(&env);

    let mut expected = alloc_vec();
    for _ in 0..5 {
        let who = Address::generate(&env);
        client.register(&who, &name, &bio, &avatar);
        expected.push(who);
    }
    assert_eq!(client.creator_count(), 5);

    // Full listing preserves registration order.
    let all = client.get_creators(&0, &100);
    assert_eq!(all.len(), 5);
    for (i, who) in expected.iter().enumerate() {
        assert_eq!(all.get_unchecked(i as u32), *who);
    }

    // A window in the middle.
    let page = client.get_creators(&1, &2);
    assert_eq!(page.len(), 2);
    assert_eq!(page.get_unchecked(0), expected[1]);
    assert_eq!(page.get_unchecked(1), expected[2]);

    // A limit running past the end is clamped to what exists.
    assert_eq!(client.get_creators(&3, &50).len(), 2);
}

#[test]
fn get_creators_handles_edge_cases() {
    let Setup { env, client } = setup();
    let (name, bio, avatar) = profile(&env);

    // Empty registry.
    assert_eq!(client.get_creators(&0, &10).len(), 0);

    let alice = Address::generate(&env);
    client.register(&alice, &name, &bio, &avatar);

    // Offset at or past the end returns empty rather than erroring.
    assert_eq!(client.get_creators(&1, &10).len(), 0);
    assert_eq!(client.get_creators(&99, &10).len(), 0);
    // A zero limit returns empty.
    assert_eq!(client.get_creators(&0, &0).len(), 0);
    // Extreme values must not overflow or panic.
    assert_eq!(client.get_creators(&0, &u32::MAX).len(), 1);
    assert_eq!(client.get_creators(&u32::MAX, &u32::MAX).len(), 0);
}

/// Small std-free helper: tests run with std available, so a Vec is fine here.
fn alloc_vec() -> std::vec::Vec<Address> {
    std::vec::Vec::new()
}
