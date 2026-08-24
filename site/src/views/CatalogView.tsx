import { CATALOG_PROJECTS } from '../catalog/projects';

export function CatalogView() {
  return (
    <main className="catalog-page" id="catalog">
      <div className="catalog-content">
        <header className="catalog-heading" id="use-cases">
          <div>
            <h1>Use cases</h1>
            <p>
              Examples of how you can use AirnodeHub with your agents to support a
              variety of use cases.
            </p>
          </div>
        </header>

        <ul className="use-case-list" aria-label="AirnodeHub community use cases">
          {CATALOG_PROJECTS.map((project) => (
            <li key={project.slug}>
              <a className="use-case-row" href={`?project=${project.slug}`}>
                <span className="use-case-copy">
                  <strong>{project.title}</strong>
                  <small>{project.outcome}</small>
                </span>
                <span className="use-case-meta">
                  <span className="use-case-meta-label">Airnodes used</span>
                  <span className="use-case-listings">
                    {project.listings.map((listing) => (
                      <b key={listing}>{listing}</b>
                    ))}
                  </span>
                </span>
                <span className="use-case-action">
                  Try it yourself
                  <i aria-hidden="true">→</i>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
