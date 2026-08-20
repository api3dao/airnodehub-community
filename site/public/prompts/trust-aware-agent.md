# Build a trust-aware AirnodeHub agent

Get the current ETH/USD price, but do not release the value to the agent until its AirnodeHub receipt passes local verification.

1. Read `https://airnodehub.api3.org/llms.txt` and use `POST https://airnodehub.api3.org/resolve` to find suitable operations.
2. Inspect each candidate's live OpenAPI document before calling it. Do not invent operations, parameters, signer addresses, or payment terms.
3. Prefer first-party provenance, require a maximum attestation age of 60 seconds, and exclude paid calls unless the user explicitly approves a spend limit.
4. Call the selected listing directly with `{ "operation": "...", "parameters": { ... } }`.
5. Verify the request hash, response bytes, EIP-191 signature, expected signer, and timestamp locally.
6. Reject stale, malformed, signer-mismatched, or tampered responses. Never pass unverified data to the agent.
7. Return the ETH/USD value together with the selected source, provenance type, verification result, and a portable receipt.

If the resolver returns `503`, retry with bounded backoff and then use the published catalog. A valid attestation proves which signer returned specific bytes at a specific time; it does not prove that the market value is objectively true.

Attestation reference: `https://airnodehub-docs.api3.org/airnode/attestation`
