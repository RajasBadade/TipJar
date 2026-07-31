#![cfg(test)]

use super::*;
use creator_registry::{CreatorRegistry, CreatorRegistryClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

/// One XLM in stroops.
const XLM: i128 = 10_000_000;

struct Setup {
    env: Env,
    jar: TipJarClient<'static>,
    registry: CreatorRegistryClient<'static>,
    token: TokenClient<'static>,
    /// Mints the test token.
    minter: StellarAssetClient<'static>,
    jar_address: Address,
}

impl Setup {
    /// Register `who` as a creator so they can receive tips.
    fn make_creator(&self, who: &Address) {
        self.registry.register(
            who,
            &String::from_str(&self.env, "Creator"),
            &String::from_str(&self.env, "bio"),
            &String::from_str(&self.env, "ipfs://a"),
        );
    }

    fn fund(&self, who: &Address, amount: i128) {
        self.minter.mint(who, &amount);
    }

    fn message(&self, text: &str) -> String {
        String::from_str(&self.env, text)
    }
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();

    // A Stellar Asset Contract standing in for native XLM.
    let issuer = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(issuer);
    let token_address = asset.address();

    let registry_address = env.register(CreatorRegistry, ());
    let jar_address = env.register(TipJar, (registry_address.clone(), token_address.clone()));

    Setup {
        jar: TipJarClient::new(&env, &jar_address),
        registry: CreatorRegistryClient::new(&env, &registry_address),
        token: TokenClient::new(&env, &token_address),
        minter: StellarAssetClient::new(&env, &token_address),
        jar_address,
        env,
    }
}

#[test]
fn constructor_wires_registry_and_token() {
    let s = setup();
    assert_eq!(s.jar.token(), s.token.address);
    assert_eq!(s.jar.registry(), s.registry.address);
}

#[test]
fn tip_moves_funds_into_escrow_and_credits_creator() {
    let s = setup();
    s.env.ledger().set_timestamp(1_700_000_000);
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, 10 * XLM);

    s.jar
        .tip(&alice, &bob, &(2 * XLM), &s.message("Great work!"));

    // Funds left the supporter and are held by the contract, not the creator.
    assert_eq!(s.token.balance(&alice), 8 * XLM);
    assert_eq!(s.token.balance(&s.jar_address), 2 * XLM);
    assert_eq!(s.token.balance(&bob), 0);
    // The creator's withdrawable balance reflects the tip.
    assert_eq!(s.jar.balance_of(&bob), 2 * XLM);
    assert_eq!(s.jar.tip_count(&alice, &bob), 1);
}

#[test]
fn tips_accumulate_from_multiple_supporters() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let carol = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, 5 * XLM);
    s.fund(&carol, 5 * XLM);

    s.jar.tip(&alice, &bob, &XLM, &s.message("one"));
    s.jar.tip(&carol, &bob, &(3 * XLM), &s.message("two"));
    s.jar.tip(&alice, &bob, &XLM, &s.message("three"));

    assert_eq!(s.jar.balance_of(&bob), 5 * XLM);
    assert_eq!(s.token.balance(&s.jar_address), 5 * XLM);
    // Counts are tracked per supporter, not globally.
    assert_eq!(s.jar.tip_count(&alice, &bob), 2);
    assert_eq!(s.jar.tip_count(&carol, &bob), 1);
}

#[test]
fn tip_to_unregistered_creator_fails_and_moves_no_funds() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let stranger = Address::generate(&s.env);
    s.fund(&alice, 5 * XLM);

    let err = s
        .jar
        .try_tip(&alice, &stranger, &XLM, &s.message("hi"))
        .unwrap_err()
        .unwrap();

    assert_eq!(err, Error::NotRegisteredCreator);
    // Critically, the failed tip must not have moved any funds.
    assert_eq!(s.token.balance(&alice), 5 * XLM);
    assert_eq!(s.token.balance(&s.jar_address), 0);
    assert_eq!(s.jar.balance_of(&stranger), 0);
}

#[test]
fn zero_and_negative_tips_are_rejected() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, 5 * XLM);

    assert_eq!(
        s.jar
            .try_tip(&alice, &bob, &0, &s.message("nope"))
            .unwrap_err()
            .unwrap(),
        Error::ZeroTip
    );
    // A negative amount must not be usable to drain the contract.
    assert_eq!(
        s.jar
            .try_tip(&alice, &bob, &-(5 * XLM), &s.message("nope"))
            .unwrap_err()
            .unwrap(),
        Error::ZeroTip
    );

    assert_eq!(s.jar.balance_of(&bob), 0);
    assert_eq!(s.token.balance(&alice), 5 * XLM);
}

#[test]
fn self_tipping_is_rejected() {
    let s = setup();
    let alice = Address::generate(&s.env);
    s.make_creator(&alice);
    s.fund(&alice, 5 * XLM);

    let err = s
        .jar
        .try_tip(&alice, &alice, &XLM, &s.message("me"))
        .unwrap_err()
        .unwrap();

    assert_eq!(err, Error::SelfTip);
    assert_eq!(s.jar.balance_of(&alice), 0);
}

#[test]
fn over_long_message_is_rejected() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, 5 * XLM);

    let long = String::from_str(&s.env, core::str::from_utf8(&[b'x'; 201]).unwrap());
    let err = s
        .jar
        .try_tip(&alice, &bob, &XLM, &long)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, Error::MessageTooLong);
    assert_eq!(s.jar.balance_of(&bob), 0);
}

#[test]
fn tip_beyond_supporter_balance_fails() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, XLM);

    // The token transfer itself must fail, leaving no escrow credit behind.
    let result = s
        .jar
        .try_tip(&alice, &bob, &(5 * XLM), &s.message("too much"));
    assert!(result.is_err());
    assert_eq!(s.jar.balance_of(&bob), 0);
    assert_eq!(s.token.balance(&alice), XLM);
}

#[test]
fn withdraw_pays_creator_and_zeroes_balance() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, 10 * XLM);
    s.jar.tip(&alice, &bob, &(4 * XLM), &s.message("thanks"));

    let withdrawn = s.jar.withdraw(&bob);

    assert_eq!(withdrawn, 4 * XLM);
    assert_eq!(s.token.balance(&bob), 4 * XLM);
    assert_eq!(s.token.balance(&s.jar_address), 0);
    assert_eq!(s.jar.balance_of(&bob), 0);
}

#[test]
fn withdraw_with_empty_balance_fails() {
    let s = setup();
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);

    let err = s.jar.try_withdraw(&bob).unwrap_err().unwrap();
    assert_eq!(err, Error::NothingToWithdraw);
}

#[test]
fn double_withdraw_fails_the_second_time() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, 10 * XLM);
    s.jar.tip(&alice, &bob, &(2 * XLM), &s.message("ty"));

    assert_eq!(s.jar.withdraw(&bob), 2 * XLM);
    assert_eq!(
        s.jar.try_withdraw(&bob).unwrap_err().unwrap(),
        Error::NothingToWithdraw
    );
    // The creator cannot have been paid twice.
    assert_eq!(s.token.balance(&bob), 2 * XLM);
}

#[test]
fn one_creator_cannot_withdraw_anothers_balance() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    let carol = Address::generate(&s.env);
    s.make_creator(&bob);
    s.make_creator(&carol);
    s.fund(&alice, 10 * XLM);
    s.jar.tip(&alice, &bob, &(3 * XLM), &s.message("for bob"));

    // Carol has her own (empty) balance; Bob's escrow is untouched by her.
    assert_eq!(
        s.jar.try_withdraw(&carol).unwrap_err().unwrap(),
        Error::NothingToWithdraw
    );
    assert_eq!(s.jar.balance_of(&bob), 3 * XLM);
    assert_eq!(s.token.balance(&carol), 0);
}

#[test]
fn badge_is_earned_on_the_third_tip() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, 10 * XLM);

    assert!(!s.jar.has_badge(&alice, &bob));
    s.jar.tip(&alice, &bob, &XLM, &s.message("1"));
    assert!(!s.jar.has_badge(&alice, &bob));
    s.jar.tip(&alice, &bob, &XLM, &s.message("2"));
    assert!(!s.jar.has_badge(&alice, &bob));

    s.jar.tip(&alice, &bob, &XLM, &s.message("3"));
    assert!(s.jar.has_badge(&alice, &bob));
    assert_eq!(s.jar.tip_count(&alice, &bob), 3);

    // The badge stays earned on subsequent tips.
    s.jar.tip(&alice, &bob, &XLM, &s.message("4"));
    assert!(s.jar.has_badge(&alice, &bob));
    assert_eq!(s.jar.tip_count(&alice, &bob), 4);
}

#[test]
fn badges_are_scoped_per_creator() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    let carol = Address::generate(&s.env);
    s.make_creator(&bob);
    s.make_creator(&carol);
    s.fund(&alice, 20 * XLM);

    for _ in 0..3 {
        s.jar.tip(&alice, &bob, &XLM, &s.message("x"));
    }

    assert!(s.jar.has_badge(&alice, &bob));
    // Tipping Bob must not earn a badge for Carol.
    assert!(!s.jar.has_badge(&alice, &carol));
    assert_eq!(s.jar.tip_count(&alice, &carol), 0);
}

#[test]
fn withdrawing_does_not_reset_badges() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, 10 * XLM);
    for _ in 0..3 {
        s.jar.tip(&alice, &bob, &XLM, &s.message("x"));
    }

    s.jar.withdraw(&bob);

    assert!(s.jar.has_badge(&alice, &bob));
    assert_eq!(s.jar.tip_count(&alice, &bob), 3);
}

#[test]
fn tip_requires_supporter_auth() {
    // No mock_all_auths: an unauthorized tip must not succeed.
    let env = Env::default();
    let issuer = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(issuer);
    let registry_address = env.register(CreatorRegistry, ());
    let jar_address = env.register(TipJar, (registry_address.clone(), asset.address()));
    let jar = TipJarClient::new(&env, &jar_address);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let result = jar.try_tip(&alice, &bob, &XLM, &String::from_str(&env, "hi"));
    assert!(result.is_err(), "unauthorized tip must fail");
}

#[test]
fn withdraw_requires_creator_auth() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    s.make_creator(&bob);
    s.fund(&alice, 10 * XLM);
    s.jar.tip(&alice, &bob, &(2 * XLM), &s.message("ty"));

    // Re-create the client on an env that no longer auto-approves auth.
    let env2 = Env::default();
    let issuer = Address::generate(&env2);
    let asset = env2.register_stellar_asset_contract_v2(issuer);
    let registry2 = env2.register(CreatorRegistry, ());
    let jar2 = env2.register(TipJar, (registry2, asset.address()));
    let client2 = TipJarClient::new(&env2, &jar2);
    let someone = Address::generate(&env2);

    assert!(client2.try_withdraw(&someone).is_err());
}

#[test]
fn balances_of_unknown_addresses_default_to_zero() {
    let s = setup();
    let nobody = Address::generate(&s.env);
    let other = Address::generate(&s.env);

    assert_eq!(s.jar.balance_of(&nobody), 0);
    assert_eq!(s.jar.tip_count(&nobody, &other), 0);
    assert!(!s.jar.has_badge(&nobody, &other));
}

#[test]
fn escrow_isolates_multiple_creators() {
    let s = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    let carol = Address::generate(&s.env);
    s.make_creator(&bob);
    s.make_creator(&carol);
    s.fund(&alice, 20 * XLM);

    s.jar.tip(&alice, &bob, &(2 * XLM), &s.message("b"));
    s.jar.tip(&alice, &carol, &(5 * XLM), &s.message("c"));

    assert_eq!(s.jar.balance_of(&bob), 2 * XLM);
    assert_eq!(s.jar.balance_of(&carol), 5 * XLM);
    assert_eq!(s.token.balance(&s.jar_address), 7 * XLM);

    // Bob withdrawing must not touch Carol's escrow.
    s.jar.withdraw(&bob);
    assert_eq!(s.jar.balance_of(&bob), 0);
    assert_eq!(s.jar.balance_of(&carol), 5 * XLM);
    assert_eq!(s.token.balance(&s.jar_address), 5 * XLM);
}
