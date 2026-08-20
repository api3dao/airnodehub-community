# Building blocks

Reusable pieces already proven by the first Working project, plus one open adapter direction.

| Building block | Status | Purpose | Current path |
|---|---|---|---|
| `trustedFetch()` | Available | Resolve, choose, call, verify, and return a value with its evidence. | `site/src/lib/client.ts` |
| Attestation verifier | Available | Recompute the request hash and recover the EIP-191 signer locally. | `site/src/lib/verify.ts` |
| Verification record | Available | Save the request, response, signature, policy, and verification result. | `site/src/lib/receipt.ts` |
| MCP adapter | Wanted | Expose AirnodeHub listings as tools while retaining verification metadata. | [`IDEAS.md`](../IDEAS.md) |

These modules currently live inside the shared site. Extract them into a separate package only when a non-site consumer needs the same boundary.
