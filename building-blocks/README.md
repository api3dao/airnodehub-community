# Building blocks

Reusable pieces already proven by the Working projects, plus one open adapter direction.

| Building block | Status | Purpose | Current path |
|---|---|---|---|
| `trustedFetch()` | Available | Resolve, choose, call, verify, and return a value with its evidence. | `site/src/lib/client.ts` |
| Attestation verifier | Available | Recompute the request hash and recover the EIP-191 signer locally. | `site/src/lib/verify.ts` |
| Verification record | Available | Save the request, response, signature, policy, and verification result. | `site/src/lib/receipt.ts` |
| Solana attestation check | Available | Run the same checks as the on-chain program in the browser, encode the instruction, and simulate it on devnet. | `site/src/lib/solanaFollowerProof.ts` |
| Solana verifier program | Available | Anchor program that verifies an Airnode attestation on-chain with `secp256k1_recover`, low-s, freshness, and replay checks. | `use-cases/solana-follower-proof/program/` |
| Capped x402 payment | Available (optional) | Pay for one priced Airnode call from a browser wallet, limited to aUSD and $0.01 per click. | `site/src/lib/browserPayment.ts` |
| MCP adapter | Wanted | Expose AirnodeHub listings as tools while retaining verification metadata. | [`IDEAS.md`](../IDEAS.md) |

These modules currently live inside the shared site. Extract them into a separate package only when a non-site consumer needs the same boundary.
