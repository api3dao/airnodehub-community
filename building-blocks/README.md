# Building blocks

Reusable pieces already proven by the first Working project, plus one open adapter direction.

| Building block | Status | Purpose | Current path |
|---|---|---|---|
| `trustedFetch()` | Available | Resolve, choose, call, verify, and return a value with its evidence. | `trust-aware-agent/src/lib/client.ts` |
| Attestation verifier | Available | Recompute the request hash and recover the EIP-191 signer locally. | `trust-aware-agent/src/lib/verify.ts` |
| Verification record | Available | Save the request, response, signature, policy, and verification result. | `trust-aware-agent/src/lib/receipt.ts` |
| MCP adapter | Wanted | Expose AirnodeHub listings as tools while retaining verification metadata. | [`IDEAS.md`](../IDEAS.md) |

These modules are currently owned by the Trust-Aware Agent project. Move them into a shared package only after a second Working project demonstrates the same boundary.
