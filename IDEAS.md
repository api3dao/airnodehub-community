# Project ideas

These are open directions for the next AirnodeHub Community contributions. The four shipped demos live in the [use-case index](use-cases/README.md).

## Demos

### Travel Disruption Evidence Pack

Combine flight information, natural-event context, location data, and FX into one downloadable evidence pack for a travel-operations decision.

### Odds Time Capsule

Preserve signed bookmaker odds at decision time, then bind the later score check to the original receipt without presenting relay provenance as bookmaker authorship.

### EU Macro Brief

Compose ECB, Eurostat, and FX inputs into a weekly brief where every chart cell opens the exact signed response behind it.

## Browser building blocks

- Live OpenAPI explorer that turns an operation into a form and shows the signed envelope.
- Agent-tool JSON preview returning a value plus verification status and receipt.
- Local freshness and spending-policy simulator for future priced operations.
- Receipt re-verification screen that works entirely from an uploaded JSON file.

## Recipes

- Resolve a natural-language request with bounded retry and explicit fallback mode.
- Rank first-party and relayed sources without hiding the trust difference.
- Verify an EIP-191 response in the browser.
- Save and re-check a receipt without calling the source again.
- Reject stale data using both attestation age and upstream-data age.
- Add an explicit x402 spend cap before paid listings become available.

## Good first contribution

Add one recorded, tamper-tested fixture for a catalogue operation that is not yet represented. Document the operation, expected signer, capture time, provenance class, and licence.
