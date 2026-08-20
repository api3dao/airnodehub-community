# Agent skills

AirnodeHub community skills should help an agent discover an operation, apply an explicit source policy, call the Airnode directly, verify its attestation locally, and retain the evidence behind the result.

## What belongs here

- Small, task-focused skills for AirnodeHub discovery, verification, receipts, or integrations.
- Instructions that work without hidden infrastructure or credentials.
- Examples grounded in operations from the live AirnodeHub catalogue.

## Contribution shape

Put each installable skill in its own directory:

```text
skills/<skill-name>/
├── SKILL.md
├── references/  # optional
└── scripts/     # optional
```

Start every `SKILL.md` with discoverable YAML frontmatter:

```yaml
---
name: verify-airnodehub-data
description: Verify signed AirnodeHub responses before an agent uses external data.
---
```

Use a unique lowercase name and make the description say both what the skill does and when an agent should use it. Keep the remaining instructions concise and include:

1. When the skill should be used.
2. The AirnodeHub operations it relies on.
3. How signer, freshness, provenance, and payment policy are checked.
4. A runnable example and the verification command.
5. What the resulting attestation proves—and what it does not.

Do not publish a skill that silently authorizes payments, treats a relayed listing as first-party, asks an Airnode to verify its own signature, or discards the receipt behind a derived answer.

There are no installable community skills yet. Propose one in [`IDEAS.md`](IDEAS.md) or open a focused pull request using the structure above.
