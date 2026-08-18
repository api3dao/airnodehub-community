import { type ReactNode, useState } from 'react';

export function AgentPromptCallout({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}) {
  const [status, setStatus] = useState('');

  async function copyPrompt() {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Prompt unavailable');
      await navigator.clipboard.writeText(await response.text());
      setStatus('Copied');
    } catch {
      setStatus('Open the raw prompt to copy it');
    }
  }

  return (
    <section className="agent-prompt-callout" id="agent-prompt" aria-labelledby="agent-prompt-title">
      <div>
        <span>For AI agents</span>
        <h2 id="agent-prompt-title">{title}</h2>
        <p>{description}</p>
      </div>
      <div className="agent-prompt-actions">
        <button className="primary-action" onClick={copyPrompt} type="button">
          {status === 'Copied' ? 'Prompt copied' : 'Copy agent prompt'}
        </button>
        <a href={path} target="_blank" rel="noreferrer">View raw prompt</a>
        <small aria-live="polite">{status}</small>
      </div>
    </section>
  );
}

export function ProjectDetailFrame({
  title,
  tagline,
  problem,
  outcome,
  boundary,
  prompt,
  children,
}: {
  title: string;
  tagline: string;
  problem: string;
  outcome: string;
  boundary: string;
  prompt: { path: string; title: string; description: string };
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
      </header>

      <section className="project-overview" id="overview" aria-labelledby={`${title}-overview`}>
        <h2 id={`${title}-overview`}>What the receipt changes</h2>
        <div>
          <article><span>Problem</span><p>{problem}</p></article>
          <article><span>Outcome</span><p>{outcome}</p></article>
          <article><span>Boundary</span><p>{boundary}</p></article>
        </div>
      </section>

      {children}
      <AgentPromptCallout {...prompt} />
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
