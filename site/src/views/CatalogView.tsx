import { useState } from 'react';
import {
  CATALOG_PROJECTS,
  type CatalogProject,
} from '../catalog/projects';

function StatusBadge({ status }: { status: CatalogProject['status'] }) {
  return (
    <span className={`catalog-status catalog-status--${status}`}>
      <i aria-hidden="true" />
      {status === 'working' ? 'Working' : 'Planned'}
    </span>
  );
}

export function CatalogView() {
  const [selected, setSelected] = useState<CatalogProject>(CATALOG_PROJECTS[0]);

  return (
    <main className="catalog-page" id="catalog">
      <div className="catalog-content">
        <header className="catalog-heading" id="use-cases">
          <div>
            <h1>Use cases with receipts</h1>
            <p>
              Run signed API examples. Inspect every request, signer, and response
              directly in your browser.
            </p>
          </div>
        </header>

        <section className="catalog-table" aria-label="AirnodeHub community use cases">
          <div className="catalog-columns" aria-hidden="true">
            <span>Project</span>
            <span>Status</span>
            <span>Category</span>
            <span>Airnode listings</span>
          </div>

          {CATALOG_PROJECTS.map((project) => (
            <article className="catalog-row-wrap" key={project.slug}>
              <button
                aria-pressed={selected.slug === project.slug}
                className={`catalog-row ${selected.slug === project.slug ? 'is-selected' : ''}`}
                onClick={() => setSelected(project)}
                type="button"
              >
                <span className="catalog-project-copy">
                  <strong>{project.title}</strong>
                  <small>{project.outcome}</small>
                </span>
                <StatusBadge status={project.status} />
                <span className="catalog-cell" data-label="Category">{project.category}</span>
                <span className="catalog-listings" data-label="Listings">
                  {project.listings[0]}
                  {project.listings.length > 1 && <small>+{project.listings.length - 1}</small>}
                </span>
              </button>
              <div className="catalog-mobile-action">
                <code>{project.repoPath}</code>
                {project.status === 'working' ? (
                  <a href={`?project=${project.slug}`}>Open project</a>
                ) : (
                  <a href="#contribute">Help build</a>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="catalog-contribute" id="contribute" aria-labelledby="catalog-contribute-title">
          <div className="utility-section-heading">
            <h2 id="catalog-contribute-title">Good first contributions</h2>
            <a
              href="https://airnodehub.api3.org/llms-full.txt"
              target="_blank"
              rel="noreferrer"
            >
              Browse live operations ↗
            </a>
          </div>
          <ul>
            <li>
              <span>Fixture</span>
              <strong>Add one signed response fixture for an unrepresented listing.</strong>
              <code>CONTRIBUTING.md</code>
            </li>
            <li>
              <span>Adapter</span>
              <strong>Wrap the verifier as an MCP tool with explicit freshness policy.</strong>
              <code>IDEAS.md</code>
            </li>
            <li>
              <span>Demo</span>
              <strong>Propose a fifth real-world use case with a narrow trust boundary.</strong>
              <code>IDEAS.md</code>
            </li>
          </ul>
        </section>
      </div>

      <aside className="catalog-inspector" aria-live="polite" aria-label="Selected project details">
        <div className="inspector-title">
          <StatusBadge status={selected.status} />
          <h2>{selected.title}</h2>
          <p>{selected.problem}</p>
        </div>

        <dl>
          <div><dt>Category</dt><dd>{selected.category}</dd></div>
          <div><dt>Artifact</dt><dd>{selected.artifact}</dd></div>
          <div className="inspector-listings">
            <dt>Airnode listings</dt>
            <dd>{selected.listings.map((listing) => <span key={listing}>{listing}</span>)}</dd>
          </div>
          <div><dt>Trust pattern</dt><dd>{selected.trustPattern}</dd></div>
          <div><dt>Repository brief</dt><dd><code>{selected.repoPath}</code></dd></div>
        </dl>

        {selected.status === 'working' ? (
          <a className="inspector-action" href={`?project=${selected.slug}`}>
            Open working project
          </a>
        ) : (
          <a className="inspector-action is-secondary" href="#contribute">
            Help build this
          </a>
        )}

        <p className="inspector-note">
          {selected.status === 'working'
            ? 'Runnable code and documented checks exist.'
            : 'Implementation is not available yet. The repository contains a scoped README brief.'}
        </p>
      </aside>
    </main>
  );
}
