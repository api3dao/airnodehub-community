# Asset Price Monitor

**Status:** Working  
**Category:** Market data  
**Artifact:** Multi-source dashboard

## Problem

Price dashboards commonly normalize values and discard the provenance of each underlying response. A later reviewer cannot tell who returned a value, when it was signed, or whether it changed in transit.

## Outcome

Use Nodary's verified first-party ETH/USD price as the reference, then compare other signed prices against it without losing any source receipt.

## Airnode listings

- Nodary — first-party reference price.
- CoinGecko — third-party comparison price.
- TickerLayer — third-party comparison price.

## Trust pattern

Parallel calls → local verification → Nodary reference → deviation check → evidence bundle.

## Implemented flow

1. Discover comparable ETH/USD operations.
2. Read each live OpenAPI document and expected signer.
3. Call all eligible listings under one freshness policy.
4. Verify every response independently.
5. Use Nodary as the reference and calculate each accepted source's deviation from it.
6. Show the accepted-input median only as secondary context.
7. Export an evidence bundle containing every receipt and the exact comparison rule.

## Run it

```sh
cd site
pnpm install
pnpm dev
```

Open `http://localhost:5173/?project=market-integrity-monitor`.

## Acceptance

- A changed response or wrong signer is excluded from the comparison.
- First-party and third-party provenance remain visibly different.
- Nodary is used as the reference only after its receipt passes local verification.
- Every deviation and the secondary median are bound to the exact accepted receipts.
- Median and deviation calculations are deterministic in tests.

The current implementation calls all three sources in parallel, verifies each response independently in the browser, excludes failures, compares accepted prices against Nodary, and exports the exact calls plus the comparison rule.

## Contribution scope

Useful next steps are deterministic signed fixtures and explicit source-data freshness checks where an upstream timestamp exists.
