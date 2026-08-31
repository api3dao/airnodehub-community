# Build a verified price change tracker

Track the first-party Nodary ETH/USD feed across two separate live calls and preserve a signed snapshot A and B.

1. Read the live AirnodeHub catalog and inspect Nodary's OpenAPI document.
2. Call Nodary's published ETH/USD operation and preserve the exact operation and parameters.
3. Read the expected signer and first-party provenance from the live listing. Verify the request hash, response payload, EIP-191 signature, signer, and timestamp locally before accepting snapshot A.
4. Make a separate live call with the same operation and parameters. Independently verify and store its complete receipt as snapshot B.
5. Normalize the ETH/USD value from each signed response. Report the absolute and percentage delta plus the elapsed time between captures.
6. If the two signed values match, report that they are unchanged; never manufacture movement. If either call fails verification, report the gap instead of creating a snapshot.
7. Return both complete receipts, capture timestamps, signer, provenance, delta, and a portable change record.

A Nodary attestation proves which value its Airnode returned at capture time. It does not guarantee that the price is universally correct, and two captures made seconds apart may legitimately contain the same value.

Catalog: `https://airnodehub.api3.org/llms.txt`
