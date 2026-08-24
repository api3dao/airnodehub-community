# Trust-Aware Agent

A browser demo that requests ETH/USD, tries the highest-priority eligible source first, and releases the value to an agent only after local verification.

## Source policy

The preferred order is:

1. **First-party** — Nodary is provider-operated and provider-signed, so the demo tries it first.
2. **API3-maintained** — the next-best tier; no eligible ETH/USD candidate is currently listed in this demo.
3. **Third-party** — CoinGecko and TickerLayer relay listings are fallbacks.

Nodary is selected when its live contract matches and its signed response passes every check. If it is unavailable or fails verification, the demo can try the next eligible candidate. The receipt records the selected source and every rejected or failed candidate.

An attestation proves which signer returned specific bytes for a specific request at a specific time. It does **not** prove that the market price is objectively true.

## Run it

Requires Node.js 22.12+.

```bash
cd site
pnpm install
pnpm dev
```

Open the local URL printed by Vite and select **Trust-Aware Agent**. No API key or application backend is required.

## What happens

1. AirnodeHub resolves the ETH/USD request to live candidates.
2. The local policy ranks first-party provenance first and blocks paid calls by default.
3. The browser checks the selected listing's live operation and expected signer.
4. It calls the Airnode directly and verifies the request hash, response bytes, EIP-191 signature, signer, freshness, and normalized price.
5. Only a verified value is released with a portable receipt.

The resolver may return a retryable `503` during early access. After two bounded attempts, the demo uses its clearly labelled price catalog, still checks the selected Airnode's live document, and still verifies the live response.

The agent-ready prompt is [`site/public/prompts/trust-aware-agent.md`](../../site/public/prompts/trust-aware-agent.md). The framework-neutral tool contract is [`site/examples/agent-tool.json`](../../site/examples/agent-tool.json).

## Verify the demo

```bash
cd site
pnpm test
pnpm build
pnpm test:live # optional live smoke test
```

Use **Change the price to test the checks** after a successful call. The demo changes a cloned receipt, invalidates its signature, and leaves the original receipt untouched.

## Current scope

- ETH/USD only
- Nodary, CoinGecko, and TickerLayer
- frontend-only calls and local verification
- no automatic payment, MCP server, proxy, database, webhook, or worker

## References

- [AirnodeHub catalogue](https://airnodehub.api3.org/llms.txt)
- [Consumer flow](https://airnodehub-docs.api3.org/api-consumers/)
- [Attestation algorithm](https://airnodehub-docs.api3.org/airnode/attestation)

## License

MIT
