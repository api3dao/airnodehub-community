import type { ReactNode } from 'react';

export function ProjectDetailFrame({
  title,
  tagline,
  category,
  listings,
  runtime,
  repoPath,
  problem,
  outcome,
  boundary,
  children,
}: {
  title: string;
  tagline: string;
  category: string;
  listings: string;
  runtime: string;
  repoPath: string;
  problem: string;
  outcome: string;
  boundary: string;
  children: ReactNode;
}) {
  return (
    <main className="project-page community-detail" id="top">
      <nav className="project-breadcrumb" aria-label="Breadcrumb">
        <a href="./">Use cases</a>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>

      <header className="project-summary">
        <div className="project-summary-copy">
          <span className="catalog-status catalog-status--working">
            <i aria-hidden="true" />Working
          </span>
          <h1>{title}</h1>
          <p>{tagline}</p>
        </div>
        <dl>
          <div><dt>Category</dt><dd>{category}</dd></div>
          <div><dt>Listings</dt><dd>{listings}</dd></div>
          <div><dt>Runtime</dt><dd>{runtime}</dd></div>
          <div><dt>API key</dt><dd>Not required</dd></div>
        </dl>
      </header>

      <nav className="project-tabs" aria-label="Project sections">
        <a href="#overview">Overview</a>
        <a href="#live-demo">Live demo</a>
        <a href="#evidence">Evidence</a>
        <a href="./#contribute">Contribute</a>
        <code>{repoPath}</code>
      </nav>

      <section className="project-overview" id="overview" aria-labelledby={`${title}-overview`}>
        <h2 id={`${title}-overview`}>What the receipt changes</h2>
        <div>
          <article><span>Problem</span><p>{problem}</p></article>
          <article><span>Outcome</span><p>{outcome}</p></article>
          <article><span>Boundary</span><p>{boundary}</p></article>
        </div>
      </section>

      {children}
    </main>
  );
}

export function VerificationStamp({
  ageSeconds,
  provenance,
}: {
  ageSeconds: number;
  provenance: 'first-party' | 'third-party';
}) {
  return (
    <span className={`verification-stamp verification-stamp--${provenance}`}>
      <i aria-hidden="true">✓</i>
      {provenance === 'first-party' ? 'Provider-signed' : 'Relay-signed'} / {ageSeconds}s old
    </span>
  );
}

export function LiveCallLoading({
  title,
  detail,
  sources,
}: {
  title: string;
  detail: string;
  sources: readonly string[];
}) {
  return (
    <section className="live-call-loading" aria-live="polite" role="status">
      <div className="live-loader-orbit" aria-hidden="true">
        <i className="live-loader-ring live-loader-ring--outer" />
        <i className="live-loader-ring live-loader-ring--inner" />
        <b />
      </div>
      <div className="live-loading-copy">
        <span>Live API calls in progress</span>
        <strong>{title}</strong>
        <p>{detail}</p>
        <div className="live-source-waitlist">
          {sources.map((source) => (
            <span key={source}><i aria-hidden="true" />{source}<small>Waiting for signed response</small></span>
          ))}
        </div>
        <div className="indeterminate-track" aria-hidden="true"><i /></div>
        <small>No backend is involved. This screen stays open while your browser waits and verifies locally.</small>
      </div>
    </section>
  );
}
