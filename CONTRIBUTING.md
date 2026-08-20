# Contributing

Contributions should be small, runnable, and honest about what an Airnode attestation proves.

## Choose a contribution

- Build one focused demo around a live AirnodeHub operation.
- Add a frontend-only visualization for a live Airnode operation.
- Write a narrow browser recipe for discovery, source selection, verification, receipts, or payment policy.
- Add an agent skill that preserves the same trust and payment boundaries.
- Improve a working project's tests, fixtures, accessibility, or explanation.

The current backlog is in [IDEAS.md](IDEAS.md). Before implementation, confirm the required operation still appears in the [live catalogue](https://airnodehub.api3.org/llms-full.txt).

Agent skill contributions should follow [`SKILLS.md`](SKILLS.md).

## Minimum project shape

Each standalone project should contain:

```text
project-name/
├── README.md
├── src/
├── fixtures/
├── tests/
└── evidence/example.json
```

Framework conventions can change this layout, but the same information must remain easy to find.

## Catalog metadata contract

Every use case must keep these fields aligned between the web catalog, root project table, and its own README:

- title and stable directory slug;
- `Working` or `Planned` status;
- category;
- exact Airnode listing names;
- difficulty;
- intended artifact;
- one-sentence problem and outcome;
- trust pattern;
- repository README path.

Update the UI catalog and README inventory in the same pull request. A Planned brief must not link to a nonexistent runnable demo.

## Acceptance checklist

- [ ] The project runs locally from documented commands.
- [ ] It is a static frontend demonstration with no backend, proxy, database, secret, serverless function, webhook, or worker.
- [ ] It uses a currently published AirnodeHub operation.
- [ ] It shows discover → evaluate → call → verify → preserve evidence.
- [ ] Live and recorded-fixture modes are clearly distinguished.
- [ ] At least one focused test covers a changed response, wrong signer, or stale timestamp.
- [ ] First-party and relayed data are labelled correctly.
- [ ] Paid calls are never authorized implicitly.
- [ ] The README explains what the signature proves and what it does not.
- [ ] A screenshot or short recording makes the outcome visible.
- [ ] Licences and upstream data attribution are documented.

## Status labels

- **Working** — runnable code exists and its documented check passes.
- **Planned** — accepted direction without a complete implementation.
- **Experiment** — runnable exploration that is not yet a supported example.

Do not mark a project Working based only on a mockup or recorded response.

## Pull request scope

Prefer one project or one reusable improvement per pull request. Include the commands you ran and the result. Avoid adding a shared framework until two working projects demonstrate the same abstraction.
