import { CatalogView } from './views/CatalogView';
import { DisasterEvidenceMapDetail } from './views/DisasterEvidenceMapDetail';
import { MarketIntegrityMonitorDetail } from './views/MarketIntegrityMonitorDetail';
import { RevisionWitnessDetail } from './views/RevisionWitnessDetail';
import { TrustAwareAgentDetail } from './views/TrustAwareAgentDetail';

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
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
        <a className="brand" href="./" aria-label="AirnodeHub Community catalog">
          <BrandMark />
          <strong>AirnodeHub</strong>
          <span>Community Catalog</span>
        </a>
        <nav aria-label="Primary navigation">
          {isCatalog ? (
            <>
              <a href="#use-cases">Use cases</a>
              <a href="#contribute">Contribute</a>
            </>
          ) : (
            <>
              <a href="./">All use cases</a>
              {knownProject && <a href="#live-demo">Live demo</a>}
            </>
          )}
          <a
            href="https://airnodehub-docs.api3.org/api-consumers/"
            target="_blank"
            rel="noreferrer"
          >
            Docs
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
        <span>AirnodeHub Community.</span>
        <span>Signatures prove provenance and integrity, not objective truth.</span>
      </footer>
    </div>
  );
}
