# Get a verified ETH/USD price from AirnodeHub

Return an ETH/USD value only after its Airnode response passes local verification.

1. Read `https://airnodehub.api3.org/llms.txt` and resolve the request with `POST https://airnodehub.api3.org/resolve`.
2. Rank eligible sources by provenance: **first-party > API3-maintained > third-party**. Treat a source as API3-maintained only when the published catalog explicitly says so; no such ETH/USD candidate is currently available in this demo.
3. Prefer Nodary as the current first-party ETH/USD source. Select it when its live contract and signed response verify. Use CoinGecko or TickerLayer only as verified fallbacks.
4. Inspect the selected candidate's live OpenAPI document. Do not invent operations, parameters, signer addresses, provenance, or payment terms.
5. Exclude paid calls unless the user approves a spend limit. Require an attestation no older than 60 seconds.
6. Call the Airnode directly, then verify the request hash, response bytes, EIP-191 signature, expected signer, document signer, timestamp, and normalized price locally.
7. Reject stale, malformed, signer-mismatched, or tampered responses. Return the value only with its source, provenance, verification result, and portable receipt.

If the resolver returns `503`, retry with bounded backoff and then use the published catalog. A valid attestation proves which signer returned specific bytes at a specific time; it does not prove that the market price is objectively true.

Attestation reference: `https://airnodehub-docs.api3.org/airnode/attestation`
