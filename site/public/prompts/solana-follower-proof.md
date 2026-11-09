# Prove an X follower count on Solana

Fetch an X follower count signed by the TwitterAPI.io Airnode, verify it locally, and check it against the Solana devnet program without committing a transaction. The goal is a social stat that an on-chain agreement can rely on.

1. Read the live AirnodeHub catalog and inspect the TwitterAPI.io OpenAPI document at `https://airnode-twitterapi.fly.dev/`. Confirm that it serves `userInfo` and signs with `0x7B02Fd3324D2dC362f65a9c01e59EC5fDb4E1CCB`.
2. The call costs $0.01 in aUSD on Base Sepolia over x402. Ask before paying, and pay at most $0.01.
3. POST `{"operation":"userInfo","parameters":{"userName":"<handle>"},"responseProjection":{"followers":"/data/followers"}}`. The signed `data` must be exactly `{"followers":N}`.
4. Verify locally, stopping at the first failure:
   - The request hash is `keccak256` of `["userInfo",[["userName","<handle>"]],[["followers","/data/followers"]]]`.
   - The signature is low-s.
   - The EIP-191 signer of `keccak256(requestHash ‖ uint256 timestamp ‖ data)` is the address above.
   - The timestamp is no more than 300 seconds old and no more than 60 seconds ahead.
   - The count meets the requested milestone.
5. Simulate `attest_followers(digest, handle, min_followers, timestamp, data, signature[0..64], v - 27)` on program `CnaPviA7GmMJx8JKzgCKCCA2iLn6cTfDj1ix6SEwDwjb` on Solana devnet. Use `sigVerify: false` and `replaceRecentBlockhash: true`. The accounts are the fee payer, the PDA `["attestation", digest]` and the system program. Report the program's verdict and error code.
6. Return the request, the complete signed response, the payment settlement, the local checks and the program logs as one record.

TwitterAPI.io relays X data it does not own. The attestation proves which count that Airnode returned and when. It does not prove that X or the account owner vouches for it. A simulation does not write anything to Solana.

Catalog: `https://airnodehub.api3.org/llms.txt`
