# Trust-Aware Agent · Community Project 01

This project runs in the shared static browser app for [AirnodeHub Community](../../README.md), an unofficial collection of frontend-only API demonstrations.

**Status:** Working  
**Category:** Agent safety  
**Airnode listings:** Nodary, CoinGecko, TickerLayer  
**Artifact:** Runnable browser demo

## Problem

Agents often accept API output without checking who returned it, whether the response was changed, or whether it is still fresh enough for the decision.

## Outcome

Accept an ETH/USD value only after its signer, request, freshness, and derived price pass every check; return a portable verification record with the value.

Give an AI agent one tool to discover, call, and verify external data through AirnodeHub.

This first community demo accepts an ETH/USD price intent, evaluates live Airnode candidates against an explicit trust policy, calls the selected Airnode directly, verifies its EIP-191 attestation locally, and exports a portable evidence receipt.

## Why an agent would use it

A normal data tool returns a value. `trustedFetch()` also returns:

- why one source was selected and the others were not;
- whether the source is first-party or a third-party relay;
- whether the response signer matches the resolver and live Airnode document;
- whether the response is still fresh enough for the agent's policy;
- a receipt that can be re-verified offline or handed to another agent.

An attestation proves that a signer returned specific bytes for a specific request at a specific time. It does **not** prove that the underlying fact is universally true. Today, Nodary is the first-party option in this demo; CoinGecko and TickerLayer are third-party relay attestations.

## Run it

Requires Node.js 22.12+.

```bash
cd site
pnpm install
pnpm dev
```

Open the local URL printed by Vite, then run the pre-filled intent:

> Get the current USD price of ETH from the strongest available source.

No API key is required for the current early-access listings. The browser calls AirnodeHub and the selected Airnode directly; their CORS policies permit the flow.

There is no application backend: no proxy route, database, serverless function, secret, account system, webhook, or worker. Vite's local development server only serves the static frontend during development.

The catalog links to these runnable routes:

- `?project=trust-aware-agent`
- `?project=market-integrity-monitor`
- `?project=disaster-evidence-map`
- `?project=revision-witness`

## Agent-facing API

```ts
import { trustedFetch } from '../../site/src/lib';

const result = await trustedFetch({
  intent: 'current USD price of ETH',
  policy: {
    preferFirstParty: true,
    maxAttestationAgeSeconds: 60,
    allowPaidCalls: false,
  },
});

if (!result.trust.valid) throw new Error('Untrusted external input');

console.log(result.normalized.value);
console.log(result.decision);
console.log(result.receipt);
```

The framework-neutral tool contract is in [`examples/agent-tool.json`](../../site/examples/agent-tool.json). This repository only demonstrates the contract in the browser; it does not run an MCP or agent backend.

## What happens on every call

1. Send the natural-language intent to `POST https://airnodehub.api3.org/resolve`.
2. Apply deterministic provenance and payment policy to returned candidates.
3. Read the selected Airnode's live OpenAPI document over HTTPS.
4. Confirm the current operation and expected signer.
5. Call the operation directly on the Airnode.
6. Recompute the canonical request hash and recover the EIP-191 signer locally.
7. Enforce signed-response freshness and export `receipt.json`.

The resolver may return a retryable `503` during early access. After two bounded attempts, this demo can use a clearly labelled, pinned price catalog. Degraded mode still reads the selected Airnode's live document and verifies the live response. A successful resolver response with zero candidates is treated as unsupported; the app never fabricates a match.

## Verification and tamper demo

The local verifier binds:

- operation and canonical parameters;
- `requestHash`;
- signed timestamp;
- response bytes;
- response signer;
- signer advertised by the live Airnode document;
- normalized price derived from the signed data.

Use **Tamper with price +$100** in the UI. It changes only a cloned receipt and immediately invalidates the signature. Restore returns to the untouched original.

## Tests

```bash
pnpm test      # deterministic, offline fixtures
pnpm build     # typecheck + production build
pnpm test:live # optional 90-second live smoke test
```

Offline fixtures cover canonical key ordering, meaningful array ordering, signature verification, tampered data, changed timestamp, stale responses, receipt round-tripping, derived-data integrity, deterministic source ranking, and blocked paid calls.

## Current scope

Included:

- ETH/USD only;
- Nodary, CoinGecko, and TickerLayer;
- browser UI and reusable TypeScript trust core;
- local verification, receipt export, and tamper demonstration;
- bounded resolver retry with explicit degraded mode.

Deferred until the vertical slice is proven:

- automatic x402 payment;
- MCP and framework-specific adapters;
- server-side polling and webhooks, which are outside this frontend demonstration repository.

The other three working demos reuse the generic live-contract and local-verification layer for price consensus, disaster evidence, and data-revision history. See the shared [project backlog](../../IDEAS.md) and [contribution guide](../../CONTRIBUTING.md).

## References

- [AirnodeHub catalogue](https://airnodehub.api3.org/llms.txt)
- [Full operation catalogue](https://airnodehub.api3.org/llms-full.txt)
- [Consumer flow](https://airnodehub-docs.api3.org/api-consumers/)
- [Attestation algorithm](https://airnodehub-docs.api3.org/airnode/attestation)

## License

MIT
