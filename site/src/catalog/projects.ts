export interface CatalogProject {
  slug: string;
  title: string;
  listings: readonly string[];
  outcome: string;
}

export const CATALOG_PROJECTS: readonly CatalogProject[] = [
  {
    slug: 'trust-aware-agent',
    title: 'Trust-Aware Agent',
    listings: ['Nodary', 'CoinGecko', 'TickerLayer'],
    outcome:
      'Prefer provider-run Nodary and release ETH/USD only after local verification.',
  },
  {
    slug: 'market-integrity-monitor',
    title: 'Asset Price Monitor',
    listings: ['Nodary', 'CoinGecko', 'TickerLayer'],
    outcome:
      'Use first-party Nodary as the reference and compare every verified relay against it.',
  },
  {
    slug: 'disaster-evidence-map',
    title: 'Disaster Evidence Map',
    listings: ['NASA EONET', 'USGS', 'GeoDB'],
    outcome:
      'Attach the exact signed event and location responses to every marker and alert.',
  },
  {
    slug: 'revision-witness',
    title: 'Verified Change Tracker',
    listings: ['Nodary'],
    outcome:
      'Compare two signed ETH/USD snapshots and preserve the receipt behind each value.',
  },
] as const;
