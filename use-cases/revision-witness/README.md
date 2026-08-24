# Verified Change Tracker

**Status:** Working

**Category:** Data history

**Artifact:** Signed price change record

## Problem

Price APIs expose the latest value. Applications can see the new price, but cannot prove what the same source returned at an earlier decision point.

## Outcome

Call the same first-party ETH/USD feed twice. Preserve each verified response as snapshot A or B and show the observed price delta, elapsed time, signer, and both receipts.

## Airnode listing

- Nodary — provider-signed ETH/USD through `latestFeeds`.

## Trust pattern

Live call → signed price A → separate live call → signed price B → verified delta.

## Implemented flow

1. Pin Nodary's ETH/USD operation and parameters.
2. Capture its live response as signed snapshot A.
3. Make a separate live call to create signed snapshot B.
4. Verify both responses locally before accepting them.
5. Calculate the price and percentage delta from the signed values and show the elapsed time.
6. Export the signer, capture times, receipts, and delta as one portable change record.

## Run it

```sh
cd site
pnpm install
pnpm dev
```

Open `http://localhost:5173/?project=revision-witness`.

The two snapshots stay in the page until you clear them or leave the demo. Capture the price twice to obtain either a verified delta or an honest unchanged result; a response without a newer signed timestamp is rejected instead of being presented as a second capture.

## Acceptance

- Invalid snapshots never enter the accepted timeline.
- Both prices are derived from their saved, signed Nodary responses.
- The delta and elapsed time are reproducible from the saved receipts and signed attestation times.
- Failed calls create gaps, not fabricated unchanged snapshots.

## Contribution scope

Background scheduling and webhooks are intentionally outside this frontend-only repository. The browser recipe never invents a price movement or an unchanged snapshot when a capture fails.
