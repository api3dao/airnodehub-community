# Follower Proof on Solana

**Status:** Working

**Category:** Cross-chain verification

**Artifact:** Solana devnet program and browser demo

## Problem

On-chain agreements often depend on social results: pay a creator when an account passes 100,000 followers, or release a reward when a post reaches a target number of likes. A Solana program cannot call an API, and a number pasted into a transaction proves nothing about where it came from.

## Outcome

Pull legitimate stats from a social platform and have a Solana program verify them itself, so a contract can be honored without trusting whoever submits the number. This demo proves an X follower count against a milestone. Post engagement, such as likes, reposts or views, follows the same pattern with another TwitterAPI.io operation.

It also shows that AirnodeHub data is cross-chain. The response is paid for on Base and signed by the Airnode, then verified on Solana, a non-EVM chain, with no bridge and no oracle deployed there. The program checks the exact request, the pinned signer, the signature form, freshness and the milestone, and records each signed response only once.

## Airnode listing

- TwitterAPI.io: `userInfo`.

TwitterAPI.io relays X data it does not own. Its attestation proves which bytes that Airnode returned for which request and when. It does not prove that X or the account owner vouches for the count.

## Trust pattern

Projected request → signed count → browser check → Solana program check → one record per signed digest.

## Implemented flow

1. **Discover.** The page reads the Airnode's live OpenAPI document and confirms it still names the pinned signer and serves `userInfo`.
2. **Evaluate.** The call is priced. The demo runs free on a recorded response by default. Paying is an optional reference module (see below): the page pays only after you open it, connect a wallet and press the pay button, and never more than $0.01 per click.
3. **Call.** It asks for `userInfo` with the projection `{"followers":"/data/followers"}`. The Airnode then signs only the text `{"followers":N}`, which a Solana program can read without a JSON parser.
4. **Verify locally.** The browser runs the program's checks in the program's order.
5. **Verify on Solana.** The browser simulates `attest_followers` against the deployed devnet program. The cluster runs the real program with its real clock and accounts and then discards the result, so no Solana wallet or SOL is needed.
6. **Preserve.** Download a record with the request, signed response, payment settlement, browser checks and program logs.

The tamper buttons change a copy of the response and run both checks again. Each case has an expected program error:

| Change | Program error |
|---|---|
| Inflate the signed count | `WrongSigner`: the signature recovers some other key |
| Claim a different handle | `WrongSigner`: the program rebuilds the request hash from the handle |
| Swap in the high-s twin of the signature | `HighS` |
| Ask for one more follower than were signed | `BelowMilestone` |
| Submit a response older than 5 minutes | `Stale` |
| Submit the same signed response twice | the record account already exists |

## The program

[`program/`](program/) is an Anchor 1.2 workspace. Program ID on devnet: `CnaPviA7GmMJx8JKzgCKCCA2iLn6cTfDj1ix6SEwDwjb`.

The program recovers the signer with Solana's `secp256k1_recover` syscall, the same secp256k1 cryptography EVM chains use, so an Airnode signature verifies natively. The syscall accepts high-s signatures, so the program rejects them itself. Freshness uses `Clock::unix_timestamp`, a stake-weighted estimate, with a 5-minute window and 60 seconds of allowed skew.

Measured on a local validator: about 37,000 compute units, and a 393-byte transaction against Solana's 1,232-byte limit.

## Run it

```sh
cd site
pnpm install
pnpm dev
```

Open `http://localhost:5173/?project=solana-follower-proof`.

**Recorded** mode is the default and is free. It loads a real signed response captured earlier. Its signature is genuine, but it is older than the 5-minute window, so the program rejects it as `Stale`. That is the expected result.

### Optional: live paid calls (reference module)

A fresh response needs an x402 payment. Costs $0.01 per call in aUSD on Base Sepolia. The demo does not depend on this. The **Live (optional, paid)** mode is kept as a reference for calling a priced Airnode operation from a browser:

- [`site/src/views/SolanaFollowerProofLiveCall.tsx`](../../site/src/views/SolanaFollowerProofLiveCall.tsx): the UI. It is lazy-loaded, so the wallet and x402 code is downloaded only when someone opens Live mode.
- [`site/src/lib/browserPayment.ts`](../../site/src/lib/browserPayment.ts): wallet connection and an x402 fetch limited to aUSD, at most $0.01, one payment per click.
- [`site/scripts/capture-solana-follower-fixture.mjs`](../../site/scripts/capture-solana-follower-fixture.mjs): the same payment from Node with a private key, used to record the fixture.

Live mode needs a browser wallet on Base Sepolia holding test aUSD from the [faucet](https://airnodehub.api3.org/faucet). aUSD has no real value, and the x402 facilitator settles the payment, so no ETH is needed.

To point the page at a local validator running the same program, start `pnpm dev` with `VITE_SOLANA_RPC_URL=http://127.0.0.1:8899`.

## Verify it

```sh
# Browser checks, encoding and error mapping
cd site && pnpm test

# Program: build, then run LiteSVM tests against the recorded fixture
cd use-cases/solana-follower-proof/program
anchor build
cargo test
```

The program tests run the compiled program against the shared fixture, [`site/public/fixtures/twitterapi-userinfo-followers.json`](../../site/public/fixtures/twitterapi-userinfo-followers.json). They cover acceptance and storage, replay, an edited count, a different request, stale and future timestamps, the milestone, the high-s twin, a foreign signer and malformed input.

To record a new fixture, which costs $0.01 in test aUSD:

```sh
cd site
PAYER_PRIVATE_KEY=0x... node scripts/capture-solana-follower-fixture.mjs API3DAO
```

## Acceptance

- A response is shown as accepted only when the browser checks and the devnet program both accept it.
- Every tamper case is rejected by the program with the error listed above.
- No payment happens without an explicit click, and never more than $0.01 per click.
- Recorded and live responses are labelled as such.
- The downloaded record reproduces both verdicts from its own contents.

## Devnet deployment

The program is deployed to Solana devnet as an upgradeable program. Its upgrade authority is a contributor-held devnet key. To own the deployment, redeploy from `program/` with your own keypair, or ask for the upgrade authority to be transferred.

CI builds and tests only `site/`. Run the program tests locally with the commands above. They need the Agave CLI and Anchor 1.2.

## Scope

The page simulates the transaction and never sends one. Recording a count on-chain requires a Solana wallet to pay rent for the record account, and that is left to the program's tests and to integrators. This program is a demonstration and has not been audited.

## References

- [AirnodeHub catalogue](https://airnodehub.api3.org/llms.txt)
- [Attestation algorithm](https://airnodehub-docs.api3.org/airnode/attestation)
- [Program on Solana Explorer (devnet)](https://explorer.solana.com/address/CnaPviA7GmMJx8JKzgCKCCA2iLn6cTfDj1ix6SEwDwjb?cluster=devnet)

## License

MIT. The recorded follower count is X data relayed by TwitterAPI.io and is included only as a test fixture.
