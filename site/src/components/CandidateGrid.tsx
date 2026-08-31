import type { CandidateDecision, DiscoveryMode } from '../lib';

function sourceLabel(listing: string): string {
  if (listing === 'coingecko') return 'CoinGecko';
  if (listing === 'tickerlayer') return 'TickerLayer';
  if (listing === 'nodary') return 'Nodary';
  return listing;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function decisionLabel(status: CandidateDecision['status']): string {
  if (status === 'selected') return 'Chosen';
  if (status === 'eligible') return 'Backup';
  if (status === 'failed') return 'Call failed';
  return 'Not chosen';
}

function decisionReason(decision: CandidateDecision): string {
  if (decision.status === 'selected') {
    return decision.provenance === 'first-party'
      ? 'Chosen because this endpoint is run by the data provider and every check passed.'
      : 'Chosen because it ranked highest and every check passed.';
  }
  if (decision.status === 'eligible') return 'Available as a backup source.';
  if (decision.status === 'failed') {
    return decision.reason.trim() || 'The source call or one of its checks failed.';
  }
  return decision.reason.trim() || 'This source did not meet the current settings.';
}

export function CandidateGrid({
  decisions,
  mode,
}: {
  decisions: CandidateDecision[];
  mode?: DiscoveryMode;
}) {
  const selected = decisions.find((decision) => decision.status === 'selected');

  return (
    <details className="source-choice">
      <summary>
        <div>
          <span>Why this source?</span>
          <strong>
            {selected
              ? `${sourceLabel(selected.listing)} was chosen for the agent`
              : 'See why no source was chosen'}
          </strong>
          <small>
            {mode === 'catalog-fallback'
              ? 'Source search was unavailable, so the demo checked its built-in live source list.'
              : mode === 'resolver+catalog'
                ? 'AirnodeHub matched the question; the demo ranked all three known ETH/USD sources.'
              : mode === 'resolver'
                ? 'AirnodeHub matched the question to live sources.'
                : 'No source met the current settings.'}
          </small>
        </div>
        <span className="disclosure-count">Compare {decisions.length} sources</span>
        <i aria-hidden="true" />
      </summary>

      <div className="source-list">
        {decisions.map((decision) => {
          const candidate = decision.candidate;
          return (
            <article
              className={`source-option source-option--${decision.status}`}
              key={`${decision.listing}:${candidate.operation}`}
            >
              <span className="source-rank">
                {decision.rank ? String(decision.rank).padStart(2, '0') : 'NR'}
              </span>
              <div className="source-copy">
                <div>
                  <strong>{sourceLabel(decision.listing)}</strong>
                  <span className={`source-status source-status--${decision.status}`}>
                    {decisionLabel(decision.status)}
                  </span>
                </div>
                <p>{decisionReason(decision)}</p>
                <small>
                  {candidate.operation} ·{' '}
                  {decision.provenance === 'first-party'
                    ? 'direct from provider'
                    : 'relayed by another service'}{' '}
                  ·{' '}
                  {candidate.payment
                    ? `${candidate.payment.maxAmountRequired} ${candidate.payment.asset}`
                    : 'free'}
                </small>
              </div>
              <code title={candidate.address}>{shortAddress(candidate.address)}</code>
            </article>
          );
        })}
      </div>
    </details>
  );
}
