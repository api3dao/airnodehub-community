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
      'Accept an ETH/USD value only after its signer, request, freshness, and derived price pass every check.',
  },
  {
    slug: 'market-integrity-monitor',
    title: 'Market Integrity Monitor',
    listings: ['Nodary', 'CoinGecko', 'TickerLayer'],
    outcome:
      'Compare signed prices while preserving a verification record for every source.',
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
    listings: ['Wikidata', 'Eurostat', 'ECB'],
    outcome:
      'Compare the same live request over time and preserve both signed responses behind every change.',
  },
] as const;
