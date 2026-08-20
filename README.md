# AirnodeHub Community

Small, runnable, frontend-only API demonstrations built with live AirnodeHub operations. The default web interface is a project catalog; each entry is backed by a repository README.

This is an unofficial community workspace. Its projects focus on the part a normal API example often omits: how an application discovers a source, evaluates it, verifies the signed response locally, and carries the evidence forward.

## Architecture boundary

This repository intentionally has no application backend. The static Vite app in [`site/`](site/) calls public AirnodeHub and Airnode endpoints directly from the browser, performs EIP-191 verification locally, and keeps optional history in browser storage. It does not contain a proxy, database, serverless function, secret API key, account system, webhook, or background worker. The production artifact is static and can be deployed to Cloudflare Pages or another static host.

## Deployment

Every push to `main` runs tests, builds [`site/`](site/), and deploys `site/dist` to the `airnodehub-community-preview` Cloudflare Pages project. The workflow requires the repository secret `CLOUDFLARE_API_TOKEN` and repository variable `CLOUDFLARE_ACCOUNT_ID`.

## Use-case catalog

| Use case | Outcome | Category | Airnode listings | Status |
|---|---|---|---|---|
| [Trust-Aware Agent](use-cases/trust-aware-agent/README.md) | Accept ETH/USD only after signer, request, freshness, and derived-price checks pass. | Agent safety | Nodary, CoinGecko, TickerLayer | **Working** |
| [Market Integrity Monitor](use-cases/market-integrity-monitor/README.md) | Compare signed prices without losing the receipt behind each value. | Market data | Nodary, CoinGecko, TickerLayer | **Working** |
| [Disaster Evidence Map](use-cases/disaster-evidence-map/README.md) | Attach signed event and location inputs to every marker and alert. | Public data | NASA EONET, USGS, GeoDB | **Working** |
| [Verified Change Tracker](use-cases/revision-witness/README.md) | Compare the same live API request over time and retain both signed responses behind every change. | Data history | Wikidata | **Working** |

All four catalog entries are runnable from the shared browser app. Future ideas remain in [`IDEAS.md`](IDEAS.md).

## What belongs here

- **Demos** — complete, visual use cases with one clear outcome.
- **Browser tools** — discovery, source policy, verification, or receipt handling demonstrated client-side.
- **API explorations** — focused interfaces that expose the live request, signed response, and derived result.
- **Recipes** — one reusable move with a fixture and a test.
- **Agent skills** — focused instructions that help agents discover, call, and verify AirnodeHub data.
- **Experiments** — small explorations that teach something about signed API data.

## Shared project contract

Every finished project should make five stages visible:

1. Discover the operation.
2. Evaluate source, signer, freshness, and payment policy.
3. Call the Airnode directly.
4. Verify the response locally.
5. Export or preserve the underlying evidence.

An attestation proves provenance—who returned which bytes for which request and when. It does not, by itself, guarantee that the underlying real-world claim is true.

Browse the complete [use-case index](use-cases/README.md), inspect the proven [building blocks](building-blocks/README.md), see the [skills guide](SKILLS.md), start with the [Trust-Aware Agent](use-cases/trust-aware-agent/README.md), or read the [contribution guide](CONTRIBUTING.md).

## References

- [AirnodeHub catalogue](https://airnodehub.api3.org/llms.txt)
- [Full operation catalogue](https://airnodehub.api3.org/llms-full.txt)
- [Consumer documentation](https://airnodehub-docs.api3.org/api-consumers/)

## Status

Community-built and open source. Not an official API3 product.
