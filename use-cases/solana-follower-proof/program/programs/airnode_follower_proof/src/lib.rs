//! Verifies a signed TwitterAPI.io follower count from AirnodeHub inside a Solana program.
//!
//! The Airnode signs `keccak256(requestHash ‖ uint256 timestamp ‖ data)` with an EIP-191 prefix and secp256k1, the same
//! bytes an EVM contract checks. This program rebuilds the request hash from the handle, so a response to any other
//! request cannot pass. It then recovers the signer with the `secp256k1_recover` syscall and compares it with the pinned
//! Airnode address. It also rejects high-s signatures, checks freshness against the cluster clock, and records each
//! signed message once in an account derived from its digest, so the same response cannot be replayed.
//!
//! An attestation proves which Airnode returned which bytes for which request and when. It does not prove that the
//! follower count is objectively true.

use anchor_lang::prelude::*;
use solana_keccak_hasher::hashv;
use solana_secp256k1_recover::secp256k1_recover;

declare_id!("CnaPviA7GmMJx8JKzgCKCCA2iLn6cTfDj1ix6SEwDwjb");

/// The TwitterAPI.io Airnode on AirnodeHub, as published at https://airnode-twitterapi.fly.dev/.
pub const AIRNODE: [u8; 20] = [
    0x7b, 0x02, 0xfd, 0x33, 0x24, 0xd2, 0xdc, 0x36, 0x2f, 0x65, 0xa9, 0xc0, 0x1e, 0x59, 0xec, 0x5f, 0xdb, 0x4e, 0x1c,
    0xcb,
];

/// Oldest signed response accepted, in seconds.
pub const MAX_AGE_SECONDS: i64 = 300;
/// How far ahead of the cluster clock a signed timestamp may be, in seconds. Solana's clock is a stake-weighted
/// estimate and can trail wall-clock time.
pub const MAX_FUTURE_SKEW_SECONDS: i64 = 60;
/// X handles are 1 to 15 letters, digits or underscores.
pub const MAX_HANDLE_LENGTH: usize = 15;

/// The fixed parts of the signed request and response. The request is `userInfo` for one handle, projected to the
/// follower count alone, so the signed `data` is the text `{"followers":<count>}`.
const REQUEST_PREFIX: &[u8] = br#"["userInfo",[["userName",""#;
const REQUEST_SUFFIX: &[u8] = br#""]],[["followers","/data/followers"]]]"#;
const DATA_PREFIX: &[u8] = br#"{"followers":"#;
const DATA_SUFFIX: &[u8] = b"}";
const EIP191_PREFIX: &[u8] = b"\x19Ethereum Signed Message:\n32";

/// Half the secp256k1 group order. A signature with s above it is the malleable twin of a valid one.
const SECP256K1_HALF_N: [u8; 32] = [
    0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x5d, 0x57, 0x6e,
    0x73, 0x57, 0xa4, 0x50, 0x1d, 0xdf, 0xe9, 0x2f, 0x46, 0x68, 0x1b, 0x20, 0xa0,
];

#[program]
pub mod airnode_follower_proof {
    use super::*;

    /// Records a follower count for `handle` once its Airnode signature, request, freshness and milestone all check out.
    ///
    /// `digest` must equal the digest the Airnode signed. It seeds the record account, which is what stops a replay.
    /// `signature` is r ‖ s and `recovery_id` is the EIP-191 `v` minus 27.
    #[allow(clippy::too_many_arguments)]
    pub fn attest_followers(
        ctx: Context<AttestFollowers>,
        digest: [u8; 32],
        handle: String,
        min_followers: u64,
        timestamp: u64,
        data: Vec<u8>,
        signature: [u8; 64],
        recovery_id: u8,
    ) -> Result<()> {
        let request_hash = request_hash(&handle)?;
        let followers = parse_followers(&data)?;

        let computed = signed_digest(&request_hash, timestamp, &data);
        require!(computed == digest, FollowerProofError::DigestMismatch);

        verify_airnode_signature(&digest, &signature, recovery_id)?;

        let now = Clock::get()?.unix_timestamp;
        check_freshness(timestamp, now)?;

        require!(followers >= min_followers, FollowerProofError::BelowMilestone);

        let record = &mut ctx.accounts.record;
        record.request_hash = request_hash;
        record.signed_at = timestamp as i64;
        record.followers = followers;
        record.min_followers = min_followers;
        record.handle = handle;
        record.recorded_by = ctx.accounts.payer.key();
        record.recorded_at = now;
        record.bump = ctx.bumps.record;

        emit!(FollowersAttested {
            handle: record.handle.clone(),
            followers,
            min_followers,
            signed_at: record.signed_at,
            digest,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(digest: [u8; 32])]
pub struct AttestFollowers<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// One account per signed message. `init` fails if it already exists, which rejects a replayed response.
    #[account(
        init,
        payer = payer,
        space = 8 + FollowerAttestation::INIT_SPACE,
        seeds = [b"attestation", digest.as_ref()],
        bump
    )]
    pub record: Account<'info, FollowerAttestation>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct FollowerAttestation {
    /// The request the Airnode answered, rebuilt from the handle.
    pub request_hash: [u8; 32],
    /// When the Airnode signed the response, in Unix seconds.
    pub signed_at: i64,
    pub followers: u64,
    pub min_followers: u64,
    #[max_len(15)]
    pub handle: String,
    pub recorded_by: Pubkey,
    /// The cluster clock when the record was written.
    pub recorded_at: i64,
    pub bump: u8,
}

#[event]
pub struct FollowersAttested {
    pub handle: String,
    pub followers: u64,
    pub min_followers: u64,
    pub signed_at: i64,
    pub digest: [u8; 32],
}

#[error_code]
pub enum FollowerProofError {
    #[msg("The handle must be 1 to 15 letters, digits or underscores")]
    InvalidHandle,
    #[msg("The signed data is not a follower count in the expected form")]
    UnexpectedData,
    #[msg("The digest does not match the request, timestamp and data")]
    DigestMismatch,
    #[msg("The signature has a high s value")]
    HighS,
    #[msg("The recovery id must be 0 or 1")]
    InvalidRecoveryId,
    #[msg("No public key could be recovered from the signature")]
    RecoveryFailed,
    #[msg("The response was not signed by the TwitterAPI.io Airnode for this request")]
    WrongSigner,
    #[msg("The signed timestamp is ahead of the cluster clock")]
    FromFuture,
    #[msg("The signed response is too old")]
    Stale,
    #[msg("The follower count is below the milestone")]
    BelowMilestone,
}

/// `keccak256` of the JSON request identity the Airnode signs over.
pub fn request_hash(handle: &str) -> Result<[u8; 32]> {
    let bytes = handle.as_bytes();
    require!(
        !bytes.is_empty()
            && bytes.len() <= MAX_HANDLE_LENGTH
            && bytes.iter().all(|byte| byte.is_ascii_alphanumeric() || *byte == b'_'),
        FollowerProofError::InvalidHandle
    );
    Ok(hashv(&[REQUEST_PREFIX, bytes, REQUEST_SUFFIX]).to_bytes())
}

/// Reads the count out of `{"followers":<digits>}`, refusing anything else, including leading zeros.
pub fn parse_followers(data: &[u8]) -> Result<u64> {
    let digits = data
        .strip_prefix(DATA_PREFIX)
        .and_then(|rest| rest.strip_suffix(DATA_SUFFIX))
        .ok_or(error!(FollowerProofError::UnexpectedData))?;
    require!(
        !digits.is_empty() && digits.len() <= 20 && (digits.len() == 1 || digits[0] != b'0'),
        FollowerProofError::UnexpectedData
    );
    digits.iter().try_fold(0u64, |count, digit| {
        require!(digit.is_ascii_digit(), FollowerProofError::UnexpectedData);
        count
            .checked_mul(10)
            .and_then(|count| count.checked_add(u64::from(digit - b'0')))
            .ok_or(error!(FollowerProofError::UnexpectedData))
    })
}

/// `keccak256(requestHash ‖ uint256 timestamp ‖ data)`, the digest the Airnode signs.
pub fn signed_digest(request_hash: &[u8; 32], timestamp: u64, data: &[u8]) -> [u8; 32] {
    let mut timestamp_word = [0u8; 32];
    timestamp_word[24..].copy_from_slice(&timestamp.to_be_bytes());
    hashv(&[request_hash, &timestamp_word, data]).to_bytes()
}

/// Recovers the EIP-191 signer of `digest` and checks it is the pinned Airnode.
pub fn verify_airnode_signature(digest: &[u8; 32], signature: &[u8; 64], recovery_id: u8) -> Result<()> {
    // secp256k1_recover accepts both s and n - s, so the low-s rule is enforced here
    require!(signature[32..] <= SECP256K1_HALF_N[..], FollowerProofError::HighS);
    require!(recovery_id <= 1, FollowerProofError::InvalidRecoveryId);

    let message = hashv(&[EIP191_PREFIX, digest]).to_bytes();
    let public_key = secp256k1_recover(&message, recovery_id, signature)
        .map_err(|_| error!(FollowerProofError::RecoveryFailed))?;
    let address_hash = hashv(&[&public_key.to_bytes()]).to_bytes();
    require!(address_hash[12..] == AIRNODE, FollowerProofError::WrongSigner);
    Ok(())
}

/// Accepts a signed timestamp no more than `MAX_AGE_SECONDS` old and no more than `MAX_FUTURE_SKEW_SECONDS` ahead.
pub fn check_freshness(timestamp: u64, now: i64) -> Result<()> {
    let signed_at = i64::try_from(timestamp).map_err(|_| error!(FollowerProofError::FromFuture))?;
    require!(signed_at <= now.saturating_add(MAX_FUTURE_SKEW_SECONDS), FollowerProofError::FromFuture);
    require!(now.saturating_sub(signed_at) <= MAX_AGE_SECONDS, FollowerProofError::Stale);
    Ok(())
}
