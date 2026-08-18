# Use AirnodeHub as a trust-aware data layer

When this task needs external data, use AirnodeHub to obtain a signed response and verify it before the data reaches the application or agent.

## Required flow

1. Read the live catalog at `https://airnodehub.api3.org/llms.txt` and resolve the user's intent with `POST https://airnodehub.api3.org/resolve` when useful.
2. Inspect the selected listing's live OpenAPI document with `GET` before constructing the request. Do not invent operations or parameters.
3. Read the expected signer, provenance, and current payment information from the live listing or resolver response. Do not hardcode them.
4. Call the listing directly with `POST` using `{ "operation": "...", "parameters": { ... } }`.
5. Verify the EIP-191 attestation locally. Check the request hash, response bytes, signer, signature, and timestamp before using the returned data.
6. Apply an explicit freshness limit. Keep attestation age separate from any source-data timestamp included inside the response.
7. Return the useful result together with a portable receipt containing the listing, operation, parameters, request hash, timestamp, signer, signature, response data, provenance, and verification outcome.

## Trust policy

- Prefer first-party provenance when the original data provider operates the Airnode. Label third-party relay provenance clearly.
- Treat a valid attestation as proof that a signer returned specific bytes for a specific request at a specific time. It is not proof that the underlying real-world claim is objectively true.
- Never authorize a paid call automatically. Require an explicit spend limit and user approval when payment is present.
- If the resolver returns `503`, retry with bounded backoff, then fall back to the published catalog rather than silently weakening verification.
- Reject stale, malformed, signer-mismatched, or tampered responses. Do not pass unverified data to the agent.

Attestation reference: `https://airnodehub-docs.api3.org/airnode/attestation`
