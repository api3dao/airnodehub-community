# Follower Proof on Solana

**Status:** Working

**Category:** Cross-chain verification

**Artifact:** Solana devnet program and browser demo

## Problem

A Solana program cannot call an API. A follower count pasted into a transaction proves nothing about where it came from, and Solana has no `ecrecover` library that rejects malleable signatures for you.

## Outcome

Get an X follower count signed by the TwitterAPI.io Airnode, check it in the browser, then have a Solana program on devnet verify the same response itself: the exact request, the pinned signer, the signature form, freshness, and a follower milestone. Each signed response can be recorded only once.

## Airnode listing

- TwitterAPI.io: `userInfo`, relay-signed by `0x7B02Fd3324D2dC362f65a9c01e59EC5fDb4E1CCB`. Costs $0.01 per call in aUSD on Base Sepolia.

TwitterAPI.io relays X data it does not own. Its attestation proves which bytes that Airnode returned for which request and when. It does not prove that X or the account owner vouches for the count.

## Trust pattern

Projected request → relay-signed count → browser check → Solana program check → one record per signed digest.

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

The signer recovers with the `secp256k1_recover` syscall rather than the native Secp256k1 program. The native-program route requires inspecting the instructions sysvar, which is the pattern behind the 2022 Wormhole exploit. The syscall does not reject high-s signatures, so the program does that itself. Freshness uses `Clock::unix_timestamp`, a stake-weighted estimate, with a 5-minute window and 60 seconds of allowed skew.

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

Every TwitterAPI.io operation is priced at $0.01, so a fresh response needs an x402 payment. The demo does not depend on this. The **Live (optional, paid)** mode is kept as a reference for calling a priced Airnode operation from a browser:

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

## Scope

The page simulates the transaction and never sends one. Recording a count on-chain requires a Solana wallet to pay rent for the record account, and that is left to the program's tests and to integrators. This program is a demonstration and has not been audited.
