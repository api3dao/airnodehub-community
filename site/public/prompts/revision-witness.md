# Build a verified change tracker

Track the Wikidata response for Berlin population statements over time and preserve a signed before-and-after record.

1. Read the live AirnodeHub catalog and inspect the Wikidata listing's OpenAPI document.
2. Call the published item-statements operation for item `Q64` and property `P1082`. Preserve the exact operation and parameters so every later snapshot repeats the same request.
3. Read the expected signer and provenance from the live listing. Verify the request hash, response payload, EIP-191 signature, signer, and timestamp locally before accepting a snapshot.
4. Store the complete verified receipt as the baseline. On a later run, repeat the identical request and store the new verified receipt.
5. Compare normalized population summaries and report field-level changes. If no field changed, say that the two verified API responses match.
6. Return both receipts, the diff, capture timestamps, provenance labels, and a portable change record.

A relay attestation proves what the relay returned at capture time. It does not certify Wikidata as correct, and two captures made seconds apart are not meaningful historical evidence.

Catalog: `https://airnodehub.api3.org/llms.txt`
