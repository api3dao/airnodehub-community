# Market Integrity Monitor

**Status:** Working  
**Category:** Market data  
**Difficulty:** Intermediate  
**Artifact:** Multi-source dashboard

## Problem

Price dashboards commonly normalize values and discard the provenance of each underlying response. A later reviewer cannot tell who returned a value, when it was signed, or whether it changed in transit.

## Outcome

Compare signed ETH/USD prices while preserving a verification record for every source. Show divergence without collapsing first-party and relayed provenance into one generic “trusted” label.

## Airnode listings

- Nodary — currently the direct-provider option in this comparison.
- CoinGecko — relayed listing; the attestation proves what the relay returned.
- TickerLayer — relayed listing; the attestation proves what the relay returned.

## Trust pattern

Parallel calls → local verification → deviation check → evidence bundle.

## Implemented flow

1. Discover comparable ETH/USD operations.
2. Read each live OpenAPI document and expected signer.
3. Call all eligible listings under one freshness policy.
4. Verify every response independently.
5. Calculate median and deviation only from accepted values.
6. Export an evidence bundle containing every receipt and the derived comparison.

## Run it

```sh
cd trust-aware-agent
npm install
npm run dev
```

Open `http://localhost:5173/?project=market-integrity-monitor`.

## Acceptance

- A changed response or wrong signer is excluded from the comparison.
- Direct-provider and relayed provenance remain visibly different.
- The derived median is bound to the exact accepted receipts.
- Recorded fixtures make the comparison deterministic in tests.

The current implementation calls all three sources in parallel, verifies each response independently in the browser, excludes failures, derives the median, flags threshold breaches, and exports the exact calls plus the comparison rule.

## Contribution scope

Useful next steps are deterministic signed fixtures and explicit source-data freshness checks where an upstream timestamp exists.
