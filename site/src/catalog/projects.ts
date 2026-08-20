export type ProjectStatus = 'working' | 'planned';

export interface CatalogProject {
  slug: string;
  title: string;
  status: ProjectStatus;
  category: string;
  listings: readonly string[];
  artifact: string;
  problem: string;
  outcome: string;
  trustPattern: string;
  repoPath: string;
}

export const CATALOG_PROJECTS: readonly CatalogProject[] = [
  {
    slug: 'trust-aware-agent',
    title: 'Trust-Aware Agent',
    status: 'working',
    category: 'Agent safety',
    listings: ['Nodary', 'CoinGecko', 'TickerLayer'],
    artifact: 'Runnable browser demo',
    problem:
      'Agents often accept API output without checking who returned it or whether the response changed.',
    outcome:
      'Accept an ETH/USD value only after its signer, request, freshness, and derived price pass every check.',
    trustPattern:
      'Resolve → source policy → direct call → local verification → portable record',
    repoPath: 'use-cases/trust-aware-agent/README.md',
  },
  {
    slug: 'market-integrity-monitor',
    title: 'Market Integrity Monitor',
    status: 'working',
    category: 'Market data',
    listings: ['Nodary', 'CoinGecko', 'TickerLayer'],
    artifact: 'Runnable comparison dashboard',
    problem:
      'Comparing prices usually removes the provenance of each underlying value.',
    outcome:
      'Compare signed prices while preserving a verification record for every source.',
    trustPattern: 'Parallel calls → local verification → deviation check → evidence bundle',
    repoPath: 'use-cases/market-integrity-monitor/README.md',
  },
  {
    slug: 'disaster-evidence-map',
    title: 'Disaster Evidence Map',
    status: 'working',
    category: 'Public data',
    listings: ['NASA EONET', 'USGS', 'GeoDB'],
    artifact: 'Runnable evidence map',
    problem:
      'Emergency maps often combine changing sources without preserving the inputs behind each alert.',
    outcome:
      'Attach the exact signed event and location responses to every marker and alert.',
    trustPattern: 'Event calls → geofence → source receipts → alert evidence pack',
    repoPath: 'use-cases/disaster-evidence-map/README.md',
  },
  {
    slug: 'revision-witness',
    title: 'Verified Change Tracker',
    status: 'working',
    category: 'Data history',
    listings: ['Wikidata', 'Eurostat', 'ECB'],
    artifact: 'Signed before-and-after record',
    problem:
      'APIs overwrite changing public data, leaving applications without proof of what was returned before.',
    outcome:
      'Compare the same live request over time and preserve both signed responses behind every change.',
    trustPattern: 'Live call → signed baseline → repeat call → verified field-level diff',
    repoPath: 'use-cases/revision-witness/README.md',
  },
] as const;

export const WORKING_PROJECTS = CATALOG_PROJECTS.filter(
  (project) => project.status === 'working',
);

export const PLANNED_PROJECTS = CATALOG_PROJECTS.filter(
  (project) => project.status === 'planned',
);
