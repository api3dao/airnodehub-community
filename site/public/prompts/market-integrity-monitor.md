# Build a signed market integrity check

Compare ETH/USD values from Nodary, CoinGecko, and TickerLayer through AirnodeHub. Produce a median only from responses that pass local verification.

1. Read the live AirnodeHub catalog and each listing's OpenAPI document. Confirm the current operations, parameters, signer addresses, provenance, and payment terms instead of hardcoding them.
2. Request the equivalent ETH/USD value from all three sources.
3. Verify every request hash, response payload, EIP-191 signature, expected signer, and timestamp locally. Reject responses older than five minutes.
4. Normalize accepted values to USD, calculate their median, and flag any source whose absolute deviation exceeds 1%.
5. Label Nodary as first-party only if the live listing still says so. Label relayed sources as third-party provenance.
6. Return the median, accepted and rejected inputs, deviations, verification outcomes, and a portable evidence bundle containing every signed receipt plus the exact calculation rule.

Do not treat agreement as objective truth. Consensus reduces single-source risk, while each attestation proves only which signer returned specific bytes at a specific time.

Catalog: `https://airnodehub.api3.org/llms.txt`
