//! Runs the compiled program in LiteSVM against a recorded TwitterAPI.io response and against tampered copies of it.

use {
    airnode_follower_proof::{
        accounts, instruction, parse_followers, request_hash, signed_digest, FollowerAttestation, FollowerProofError,
        MAX_AGE_SECONDS, MAX_FUTURE_SKEW_SECONDS,
    },
    anchor_lang::{
        error::ERROR_CODE_OFFSET,
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    k256::ecdsa::SigningKey,
    litesvm::LiteSVM,
    solana_keccak_hasher::hashv,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    solana_instruction_error::InstructionError,
    solana_transaction_error::TransactionError,
};

const FIXTURE: &str = include_str!("../../../../../../site/public/fixtures/twitterapi-userinfo-followers.json");

/// secp256k1 group order, to build the high-s twin of a signature.
const SECP256K1_N: [u8; 32] = [
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe, 0xba, 0xae, 0xdc,
    0xe6, 0xaf, 0x48, 0xa0, 0x3b, 0xbf, 0xd2, 0x5e, 0x8c, 0xd0, 0x36, 0x41, 0x41,
];

#[derive(Clone)]
struct Attestation {
    handle: String,
    request_hash: [u8; 32],
    timestamp: u64,
    data: Vec<u8>,
    signature: [u8; 64],
    recovery_id: u8,
}

impl Attestation {
    fn digest(&self) -> [u8; 32] {
        signed_digest(&self.request_hash, self.timestamp, &self.data)
    }
}

fn hex_bytes(value: &str) -> Vec<u8> {
    let value = value.trim_start_matches("0x");
    (0..value.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&value[index..index + 2], 16).unwrap())
        .collect()
}

fn recorded() -> Attestation {
    let fixture: serde_json::Value = serde_json::from_str(FIXTURE).unwrap();
    let response = &fixture["response"];
    let signature = hex_bytes(response["signature"].as_str().unwrap());
    assert_eq!(signature.len(), 65);
    Attestation {
        handle: fixture["request"]["parameters"]["userName"].as_str().unwrap().to_owned(),
        request_hash: hex_bytes(response["requestHash"].as_str().unwrap()).try_into().unwrap(),
        timestamp: response["timestamp"].as_str().unwrap().parse().unwrap(),
        data: response["data"].as_str().unwrap().as_bytes().to_vec(),
        signature: signature[..64].try_into().unwrap(),
        recovery_id: signature[64] - 27,
    }
}

/// Signs like an Airnode would, with a key that is not the pinned Airnode.
fn signed_by(key: &SigningKey, handle: &str, timestamp: u64, data: &[u8]) -> Attestation {
    let request_hash = request_hash(handle).unwrap();
    let digest = signed_digest(&request_hash, timestamp, data);
    let message = hashv(&[b"\x19Ethereum Signed Message:\n32", &digest]).to_bytes();
    // k256 always returns the low-s form
    let (signature, recovery_id) = key.sign_prehash_recoverable(&message);
    Attestation {
        handle: handle.to_owned(),
        request_hash,
        timestamp,
        data: data.to_vec(),
        signature: signature.to_bytes().into(),
        recovery_id: recovery_id.to_byte(),
    }
}

struct Harness {
    svm: LiteSVM,
    payer: Keypair,
}

impl Harness {
    fn new(now: i64) -> Self {
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/airnode_follower_proof.so"));
        svm.add_program(airnode_follower_proof::id(), bytes).unwrap();
        let payer = Keypair::new();
        svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();
        let mut harness = Self { svm, payer };
        harness.set_clock(now);
        harness
    }

    fn set_clock(&mut self, now: i64) {
        let mut clock: Clock = self.svm.get_sysvar();
        clock.unix_timestamp = now;
        self.svm.set_sysvar(&clock);
    }

    fn record_address(digest: &[u8; 32]) -> Pubkey {
        Pubkey::find_program_address(&[b"attestation", digest], &airnode_follower_proof::id()).0
    }

    fn attest(&mut self, attestation: &Attestation, digest: [u8; 32], min_followers: u64) -> Result<(), TransactionError> {
        let instruction = Instruction::new_with_bytes(
            airnode_follower_proof::id(),
            &instruction::AttestFollowers {
                digest,
                handle: attestation.handle.clone(),
                min_followers,
                timestamp: attestation.timestamp,
                data: attestation.data.clone(),
                signature: attestation.signature,
                recovery_id: attestation.recovery_id,
            }
            .data(),
            accounts::AttestFollowers {
                payer: self.payer.pubkey(),
                record: Self::record_address(&digest),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.svm.expire_blockhash();
        let message = Message::new_with_blockhash(&[instruction], Some(&self.payer.pubkey()), &self.svm.latest_blockhash());
        let transaction = VersionedTransaction::try_new(VersionedMessage::Legacy(message), &[&self.payer]).unwrap();
        self.svm.send_transaction(transaction).map(|_| ()).map_err(|failure| failure.err)
    }
}

fn custom(error: FollowerProofError) -> TransactionError {
    TransactionError::InstructionError(0, InstructionError::Custom(ERROR_CODE_OFFSET + error as u32))
}

#[test]
fn request_hash_matches_the_recorded_response() {
    let attestation = recorded();
    assert_eq!(request_hash(&attestation.handle).unwrap(), attestation.request_hash);
}

#[test]
fn parses_only_the_projected_follower_count() {
    assert_eq!(parse_followers(br#"{"followers":0}"#).unwrap(), 0);
    assert_eq!(parse_followers(br#"{"followers":18446744073709551615}"#).unwrap(), u64::MAX);
    for malformed in [
        &br#"{"followers":18446744073709551616}"#[..],
        br#"{"followers":012}"#,
        br#"{"followers":-1}"#,
        br#"{"followers":1.5}"#,
        br#"{"followers": 12}"#,
        br#"{"followers":"12"}"#,
        br#"{"followers":}"#,
        br#"{"following":12}"#,
    ] {
        assert!(parse_followers(malformed).is_err(), "{}", String::from_utf8_lossy(malformed));
    }
}

#[test]
fn accepts_the_recorded_response_and_stores_it() {
    let attestation = recorded();
    let mut harness = Harness::new(attestation.timestamp as i64 + 10);
    harness.attest(&attestation, attestation.digest(), 1).unwrap();

    let account = harness.svm.get_account(&Harness::record_address(&attestation.digest())).unwrap();
    let record = FollowerAttestation::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(record.handle, attestation.handle);
    assert_eq!(record.followers, parse_followers(&attestation.data).unwrap());
    assert_eq!(record.signed_at, attestation.timestamp as i64);
    assert_eq!(record.request_hash, attestation.request_hash);
    assert_eq!(record.recorded_by, harness.payer.pubkey());
}

#[test]
fn rejects_a_replayed_response() {
    let attestation = recorded();
    let mut harness = Harness::new(attestation.timestamp as i64 + 10);
    harness.attest(&attestation, attestation.digest(), 1).unwrap();
    // The record account already exists, so the system program refuses to create it again
    assert!(matches!(
        harness.attest(&attestation, attestation.digest(), 1),
        Err(TransactionError::InstructionError(0, _))
    ));
}

#[test]
fn rejects_an_edited_follower_count() {
    let mut attestation = recorded();
    let followers = parse_followers(&attestation.data).unwrap();
    attestation.data = format!(r#"{{"followers":{}}}"#, followers + 1_000_000).into_bytes();
    let mut harness = Harness::new(attestation.timestamp as i64 + 10);
    // Claiming the original digest for the edited bytes
    assert_eq!(
        harness.attest(&attestation, recorded().digest(), 1),
        Err(custom(FollowerProofError::DigestMismatch))
    );
    // Recomputing the digest leaves a signature over different bytes, which recovers some other key
    assert_eq!(harness.attest(&attestation, attestation.digest(), 1), Err(custom(FollowerProofError::WrongSigner)));
}

#[test]
fn rejects_a_response_to_a_different_request() {
    let mut attestation = recorded();
    attestation.handle = if attestation.handle == "jack" { "elonmusk".into() } else { "jack".into() };
    attestation.request_hash = request_hash(&attestation.handle).unwrap();
    let mut harness = Harness::new(attestation.timestamp as i64 + 10);
    assert_eq!(harness.attest(&attestation, attestation.digest(), 1), Err(custom(FollowerProofError::WrongSigner)));
}

#[test]
fn rejects_a_stale_response() {
    let attestation = recorded();
    let mut harness = Harness::new(attestation.timestamp as i64 + MAX_AGE_SECONDS + 1);
    assert_eq!(harness.attest(&attestation, attestation.digest(), 1), Err(custom(FollowerProofError::Stale)));
    harness.set_clock(attestation.timestamp as i64 + MAX_AGE_SECONDS);
    harness.attest(&attestation, attestation.digest(), 1).unwrap();
}

#[test]
fn rejects_a_timestamp_ahead_of_the_cluster_clock() {
    let attestation = recorded();
    let mut harness = Harness::new(attestation.timestamp as i64 - MAX_FUTURE_SKEW_SECONDS - 1);
    assert_eq!(harness.attest(&attestation, attestation.digest(), 1), Err(custom(FollowerProofError::FromFuture)));
}

#[test]
fn rejects_a_count_below_the_milestone() {
    let attestation = recorded();
    let followers = parse_followers(&attestation.data).unwrap();
    let mut harness = Harness::new(attestation.timestamp as i64 + 10);
    assert_eq!(
        harness.attest(&attestation, attestation.digest(), followers + 1),
        Err(custom(FollowerProofError::BelowMilestone))
    );
    harness.attest(&attestation, attestation.digest(), followers).unwrap();
}

#[test]
fn rejects_the_high_s_twin_of_a_valid_signature() {
    let mut attestation = recorded();
    let mut s = [0u8; 32];
    let mut borrow = 0i16;
    for index in (0..32).rev() {
        let difference = i16::from(SECP256K1_N[index]) - i16::from(attestation.signature[32 + index]) - borrow;
        s[index] = difference.rem_euclid(256) as u8;
        borrow = i16::from(difference < 0);
    }
    attestation.signature[32..].copy_from_slice(&s);
    attestation.recovery_id ^= 1;
    let mut harness = Harness::new(attestation.timestamp as i64 + 10);
    assert_eq!(harness.attest(&attestation, attestation.digest(), 1), Err(custom(FollowerProofError::HighS)));
}

#[test]
fn rejects_a_response_signed_by_another_key() {
    let key = SigningKey::from_slice(&[7u8; 32]).unwrap();
    let attestation = signed_by(&key, "api3dao", 1_800_000_000, br#"{"followers":123}"#);
    let mut harness = Harness::new(1_800_000_010);
    assert_eq!(harness.attest(&attestation, attestation.digest(), 1), Err(custom(FollowerProofError::WrongSigner)));
}

#[test]
fn rejects_malformed_handles_and_data() {
    let key = SigningKey::from_slice(&[7u8; 32]).unwrap();
    let mut harness = Harness::new(1_800_000_010);

    let mut attestation = signed_by(&key, "api3dao", 1_800_000_000, br#"{"followers":123}"#);
    attestation.handle = r#"x"]],[["a"#.into();
    assert_eq!(harness.attest(&attestation, attestation.digest(), 1), Err(custom(FollowerProofError::InvalidHandle)));

    let attestation = signed_by(&key, "api3dao", 1_800_000_000, br#"{"followers":123,"x":1}"#);
    assert_eq!(harness.attest(&attestation, attestation.digest(), 1), Err(custom(FollowerProofError::UnexpectedData)));
}
