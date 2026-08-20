# Build a disaster evidence alert

Create a Tokyo watch-area report from NASA EONET events, USGS earthquakes, and a GeoDB city record through AirnodeHub. Keep the signed evidence behind every marker and alert.

1. Read the live AirnodeHub catalog and inspect the OpenAPI document for NASA EONET, USGS, and GeoDB. Use only published operations and parameters.
2. Request active recent EONET events, recent earthquakes of magnitude 5.5 or higher, and Tokyo's city coordinates.
3. Read expected signers and provenance from the live listings, then verify every request hash, response payload, EIP-191 signature, signer, and timestamp locally.
4. Reject the entire derived alert if a required input fails verification or freshness policy.
5. Calculate the distance from each event to Tokyo. Flag strong earthquakes or active events within 1,500 km.
6. Return the map-ready markers, triggered rules, provenance labels, and a portable evidence pack containing the three signed inputs and the exact geofence rule.

These attestations prove what the listed relays returned and when. They do not prove that a physical-world event occurred, and the result must not be presented as an emergency authority.

Catalog: `https://airnodehub.api3.org/llms.txt`
