# Build an asset price monitor

Compare ETH/USD values from Nodary, CoinGecko, and TickerLayer through AirnodeHub. Treat Nodary as the reference only after its first-party response passes local verification.

1. Read each listing's live OpenAPI document. Confirm its current operation, parameters, signer address, and payment terms; use the repository's reviewed catalog metadata for provenance labels.
2. Request the equivalent ETH/USD value from all three sources.
3. Verify every request hash, response payload, EIP-191 signature, expected signer, and timestamp locally. Reject responses older than five minutes.
4. Normalize accepted values to USD. Use the verified Nodary value as the reference and flag any accepted comparison source whose absolute deviation from it exceeds 1%.
5. Calculate the accepted-input median only as secondary context; do not replace the first-party reference with consensus.
6. Keep the reviewed provenance metadata aligned with the published AirnodeHub catalog. Label relayed sources as third-party provenance and never infer an unsupported tier.
7. Return the Nodary reference, accepted and rejected inputs, deviations, secondary median, verification outcomes, and a portable evidence bundle containing every signed receipt plus the exact calculation rule.

Prefer first-party data over API3-maintained sources, and API3-maintained sources over third parties. Do not present an unavailable tier as supported. A signature proves which signer returned specific bytes at a specific time; it does not make a market price objectively true.

Catalog: `https://airnodehub.api3.org/llms.txt`
