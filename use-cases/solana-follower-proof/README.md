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

1. Read the TwitterAPI.io Airnode's live OpenAPI document and expected signer.
2. Load a recorded signed follower count, or optionally pay $0.01 for a fresh one.
3. Ask the Airnode to sign only the follower count, so the Solana program can read it easily.
4. Verify the response in the browser.
5. Run the same response through the Solana program on devnet as a simulation, with no Solana wallet needed.
6. Try tampered copies and see the program reject each one.
7. Export a record with the request, signed response, browser checks and program result.

| Tampered copy | Program result |
|---|---|
| Inflate the follower count | Rejected: `WrongSigner` |
| Claim a different account | Rejected: `WrongSigner` |
| Use the other valid form of the signature | Rejected: `HighS` |
| Ask for more followers than were signed | Rejected: `BelowMilestone` |
| Submit a response older than 5 minutes | Rejected: `Stale` |
| Submit the same response twice | Rejected: already recorded |

## The program

[`program/`](program/) is an Anchor workspace. It is deployed on devnet as `CnaPviA7GmMJx8JKzgCKCCA2iLn6cTfDj1ix6SEwDwjb`.

It checks that the response:

- answers the exact request for that account;
- is signed by the TwitterAPI.io Airnode;
- uses the standard form of the signature;
- was signed within the last 5 minutes;
- meets the follower milestone;
- has not been recorded before.

Solana uses the same signature cryptography as EVM chains, so the program can check an Airnode signature directly. One check costs about 37,000 compute units and fits in a single transaction.

## Run it

```sh
cd site
pnpm install
pnpm dev
```

Open `http://localhost:5173/?project=solana-follower-proof`.

**Recorded** mode is the default and is free. It loads a real signed response saved in the repo. Because it is older than 5 minutes, the program rejects it as `Stale`. That is expected; every other check still runs.

### Optional: live paid calls (reference module)

A fresh response needs an x402 payment. Costs $0.01 per call in aUSD on Base Sepolia. The demo works without it; **Live (optional, paid)** mode is a reference for paying for an Airnode call from a browser.

- [`SolanaFollowerProofLiveCall.tsx`](../../site/src/views/SolanaFollowerProofLiveCall.tsx): the Live mode screen. It only loads when someone opens Live mode.
- [`browserPayment.ts`](../../site/src/lib/browserPayment.ts): connects the wallet and pays, at most $0.01 per click.
- [`capture-solana-follower-fixture.mjs`](../../site/scripts/capture-solana-follower-fixture.mjs): the same payment from Node, used to record the saved response.

You need a Base Sepolia wallet with test aUSD from the [faucet](https://airnodehub.api3.org/faucet). aUSD has no real value, and no ETH is needed.

To point the page at a local validator running the same program, start `pnpm dev` with `VITE_SOLANA_RPC_URL=http://127.0.0.1:8899`.

## Verify it

```sh
# Site tests
cd site && pnpm test

# Program tests
cd use-cases/solana-follower-proof/program
anchor build
cargo test
```

Both test suites use the same [saved response](../../site/public/fixtures/twitterapi-userinfo-followers.json). The program tests cover a valid response, every tamper case above, a future timestamp, a different signer and bad input.

To record a new response ($0.01 in test aUSD):

```sh
cd site
PAYER_PRIVATE_KEY=0x... node scripts/capture-solana-follower-fixture.mjs API3DAO
```

## Acceptance

- A response counts as accepted only when the browser and the program both accept it.
- The program rejects every tampered copy with the error listed above.
- Nothing is paid without a click, and never more than $0.01 per click.
- Recorded and live responses are clearly labelled.
- The exported record contains everything needed to check both results again.

## Devnet deployment

The program can be upgraded by a contributor-held devnet key. To take it over, redeploy from `program/` with your own key, or ask for the upgrade key to be transferred.

CI only tests `site/`. Run the program tests locally; they need the Solana CLI and Anchor 1.2.

## Scope

The page simulates the program and never sends a transaction. Actually recording a count needs a Solana wallet to pay for the record, which is left to integrators. The program is a demonstration and has not been audited.

## References

- [AirnodeHub catalogue](https://airnodehub.api3.org/llms.txt)
- [Attestation algorithm](https://airnodehub-docs.api3.org/airnode/attestation)
- [Program on Solana Explorer (devnet)](https://explorer.solana.com/address/CnaPviA7GmMJx8JKzgCKCCA2iLn6cTfDj1ix6SEwDwjb?cluster=devnet)

## License

MIT. The recorded follower count is X data relayed by TwitterAPI.io and is included only as a test fixture.
