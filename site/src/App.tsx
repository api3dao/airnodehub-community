import { CatalogView } from './views/CatalogView';
import { DisasterEvidenceMapDetail } from './views/DisasterEvidenceMapDetail';
import { MarketIntegrityMonitorDetail } from './views/MarketIntegrityMonitorDetail';
import { RevisionWitnessDetail } from './views/RevisionWitnessDetail';
import { TrustAwareAgentDetail } from './views/TrustAwareAgentDetail';

const REPO_URL = 'https://github.com/api3dao/airnodehub-community';
const AIRNODEHUB_URL = 'https://airnodehub.api3.org/';

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function ExternalMark() {
  return (
    <svg className="external-mark" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M4.2 2h5.3v5.3" />
      <path d="M9.5 2 2.6 8.9" />
    </svg>
  );
}

export default function App() {
  const projectSlug = new URLSearchParams(window.location.search).get('project');
  const isCatalog = projectSlug === null;
  const knownProject = [
    'trust-aware-agent',
    'market-integrity-monitor',
    'disaster-evidence-map',
    'revision-witness',
  ].includes(projectSlug ?? '');

  return (
    <div className={`app-shell ${isCatalog ? 'is-catalog-view' : 'is-project-view'}`}>
      <header className="site-header">
        <div className="header-primary">
          <a className="brand" href="./" aria-label="AirnodeHub Community">
            <BrandMark />
            <strong>AirnodeHub Community</strong>
          </a>
          {!isCatalog && knownProject && (
            <nav aria-label="Primary navigation">
              <a href="#live-demo">Live demo</a>
            </nav>
          )}
        </div>
        <nav className="header-external" aria-label="Related sites">
          <a href={AIRNODEHUB_URL} target="_blank" rel="noreferrer">
            AirnodeHub
            <ExternalMark />
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
            <ExternalMark />
          </a>
        </nav>
      </header>

      {isCatalog && <CatalogView />}
      {projectSlug === 'trust-aware-agent' && <TrustAwareAgentDetail />}
      {projectSlug === 'market-integrity-monitor' && <MarketIntegrityMonitorDetail />}
      {projectSlug === 'disaster-evidence-map' && <DisasterEvidenceMapDetail />}
      {projectSlug === 'revision-witness' && <RevisionWitnessDetail />}
      {!isCatalog && !knownProject && (
        <main className="project-not-found">
          <span>Project not found</span>
          <h1>This community project does not exist.</h1>
          <p>Choose one of the runnable projects in the community catalog.</p>
          <a href="./">Return to use cases</a>
        </main>
      )}

      <footer>
        <span>Open to community contributions and maintained by API3.</span>
      </footer>
    </div>
  );
}
