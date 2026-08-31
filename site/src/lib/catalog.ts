import type { Candidate } from './types';

const emptyReturns = {
  airnode: 'address',
  requestHash: '0x…',
  timestamp: 'unix seconds',
  data: '<the upstream response>',
  signature: '0x…',
};

export const PRICE_CATALOG: Candidate[] = [
  {
    listing: 'nodary',
    airnode: 'https://airnode-nodary.fly.dev/',
    operation: 'latestFeeds',
    address: '0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0',
    attestation: 'first-party',
    parameters: { name: { type: 'string', required: false } },
    example: { name: 'ETH/USD' },
    returns: emptyReturns,
    payment: null,
    origin: 'demo-catalog',
    why: 'First-party aggregated ETH/USD data from Nodary.',
  },
  {
    listing: 'coingecko',
    airnode: 'https://airnode-coingecko.fly.dev/',
    operation: 'simplePrice',
    address: '0x896B7a7F8872639e45F4Fd5F975b1031Ad57bfba',
    attestation: 'third-party',
    parameters: {
      ids: { type: 'string', required: true },
      vs_currencies: { type: 'string', required: true },
      include_market_cap: { type: 'string', required: false },
      include_24hr_change: { type: 'string', required: false },
    },
    example: { ids: 'ethereum', vs_currencies: 'usd' },
    returns: emptyReturns,
    payment: null,
    origin: 'demo-catalog',
    why: 'Current Ethereum price relayed from CoinGecko.',
  },
  {
    listing: 'tickerlayer',
    airnode: 'https://airnode-tickerlayer.fly.dev/',
    operation: 'lastTrade',
    address: '0x32f5eA20F05fdADfCD50Cb8eD920acE96D5f9f2c',
    attestation: 'third-party',
    parameters: {
      assetClass: { type: 'string', required: true },
      symbol: { type: 'string', required: true },
    },
    example: { assetClass: 'crypto', symbol: 'ETHUSD' },
    returns: emptyReturns,
    payment: null,
    origin: 'demo-catalog',
    why: 'Latest ETH/USD trade relayed from TickerLayer.',
  },
];

export const SUPPORTED_LISTINGS = new Set(
  PRICE_CATALOG.map((candidate) => candidate.listing),
);

export function supplementPriceCandidates(candidates: Candidate[]): Candidate[] {
  const discovered = new Set(
    candidates.map((candidate) => `${candidate.listing}:${candidate.operation}`),
  );
  return [
    ...candidates,
    ...PRICE_CATALOG.filter(
      (candidate) => !discovered.has(`${candidate.listing}:${candidate.operation}`),
    ),
  ];
}

export function supportsCatalogFallback(intent: string): boolean {
  const normalized = intent.toLowerCase();
  const asksForEth = /\b(eth|ethereum)\b/.test(normalized);
  const asksForUsd = /\b(usd|dollar|dollars)\b/.test(normalized);
  const asksForPrice = /\b(price|value|worth|quote|fiyat)\b/.test(normalized);

  return asksForEth && asksForUsd && asksForPrice;
}
