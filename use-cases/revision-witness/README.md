# Verified Change Tracker

**Status:** Working  
**Category:** Data history  
**Difficulty:** Intermediate  
**Artifact:** Signed before-and-after record

## Problem

Changing APIs usually expose only their current response. Applications can see the new value, but cannot prove what the same source returned at an earlier decision point.

## Outcome

Repeat one identical live API request over time. Preserve each verified response as a signed before-or-after state and show exactly which fields changed.

## Airnode listing

- Wikidata — Berlin (`Q64`) population statements (`P1082`) through `getItemStatements`.

## Trust pattern

Live call → signed baseline → repeat call → verified field-level diff.

## Implemented flow

1. Pin one deterministic operation and parameter set.
2. Capture its live response as the signed “before” state.
3. Repeat the identical request later to create the “after” state.
4. Verify both signed responses before accepting them.
5. Produce a field-level diff between the two complete responses.
6. Export the request, receipts, and diff as one portable change record.

## Run it

```sh
cd trust-aware-agent
npm install
npm run dev
```

Open `http://localhost:5173/?project=revision-witness`.

Snapshots persist in local browser storage. The current demo tracks Berlin population statements returned by Wikidata. Capture the same request again later to obtain either a verified unchanged result or a field-level diff.

## Acceptance

- Invalid snapshots never enter the accepted timeline.
- Array ordering and object canonicalization are tested explicitly.
- Diffs are reproducible from the saved receipts.
- Failed calls create gaps, not fabricated unchanged snapshots.

## Contribution scope

Background scheduling and webhooks are intentionally outside this frontend-only repository. The browser recipe never invents an unchanged snapshot when a capture fails.
