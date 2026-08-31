import type { Receipt, VerificationResult } from '../lib';

const CHECK_LABELS: Array<[keyof VerificationResult['checks'], string]> = [
  ['requestHash', 'Agent’s question is unchanged'],
  ['responseSigner', 'Response came from the expected source'],
  ['documentSigner', 'Source matches its published API details'],
  ['signature', 'Digital signature is valid'],
  ['fresh', 'Response is recent enough'],
  ['timestampNotFuture', 'Response time is valid'],
  ['normalizedData', 'Displayed price matches the response'],
];

function sourceLabel(listing: string): string {
  if (listing === 'coingecko') return 'CoinGecko';
  if (listing === 'tickerlayer') return 'TickerLayer';
  if (listing === 'nodary') return 'Nodary';
  return listing;
}

export function ProofPanel({
  receipt,
  verification,
  tampered,
  onTamper,
  onReset,
  onDownload,
}: {
  receipt: Receipt;
  verification: VerificationResult;
  tampered: boolean;
  onTamper: () => void;
  onReset: () => void;
  onDownload: () => void;
}) {
  const candidate = receipt.selected.candidate;
  const source = sourceLabel(candidate.listing);
  const directFromProvider = candidate.attestation === 'first-party';
  const passedChecks = Object.values(verification.checks).filter(Boolean).length;
  const failureMessage = !verification.checks.signature
    ? 'The displayed price was changed after signing, so it no longer matches the source response.'
    : !verification.checks.fresh
      ? 'The signed price is older than the maximum age allowed by your settings.'
      : verification.issues[0] ?? 'One of the response checks failed.';

  return (
    <section
      className={`proof-card ${verification.valid ? 'is-valid' : 'is-invalid'}`}
      aria-labelledby="proof-title"
    >
      <div className="proof-heading">
        <div>
          <h2 id="proof-title">
            {verification.valid ? 'Verified ETH price' : 'Rejected ETH price'}
          </h2>
          <span>{tampered ? 'Tampering simulation' : 'Result for your AI agent'}</span>
        </div>
        <span className={`proof-badge ${verification.valid ? 'is-valid' : 'is-invalid'}`}>
          <i aria-hidden="true">{verification.valid ? '✓' : '×'}</i>
          {verification.valid ? 'Signature valid' : 'Not released'}
        </span>
      </div>

      <div className="result-row">
        <div className="price-block">
          <span>{verification.valid ? 'ETH / USD' : 'Rejected value · ETH / USD'}</span>
          <strong className={tampered ? 'value-flash value-flash--down' : undefined} key={receipt.normalized.value}>
            <small>$</small>
            {receipt.normalized.value.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
          <p>
            {!verification.valid
              ? `This displayed value does not match the signed ${source} response.`
              : directFromProvider
                ? `${source} returned and signed this price ${verification.ageSeconds}s ago.`
                : `The Airnode relay returned ${source} data and signed it ${verification.ageSeconds}s ago.`}
          </p>
        </div>

        <div className="trust-message" role={verification.valid ? 'status' : 'alert'}>
          <span aria-hidden="true">
            {verification.valid ? '✓' : (
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" />
                <path d="m9 9 6 6m0-6-6 6" />
              </svg>
            )}
          </span>
          <div>
            <strong>
              {verification.valid ? 'Your agent can use this price' : 'Blocked from the agent'}
            </strong>
            <p>
              {verification.valid
                ? directFromProvider
                  ? `The signature proves this exact response came from ${source} and was not changed.`
                  : `The signature proves the Airnode relay returned this exact ${source} response and it was not changed.`
                : failureMessage}
            </p>
          </div>
        </div>
      </div>

      <ol className="proof-path" aria-label="Proof path">
        <li className="is-complete"><i>✓</i><span>Agent asks</span></li>
        <li className="is-complete"><i>✓</i><span>{source} answers</span></li>
        <li className={verification.checks.signature ? 'is-complete' : 'is-failed'}>
          <i>{verification.checks.signature ? '✓' : '×'}</i><span>Browser checks</span>
        </li>
        <li className={verification.valid ? 'is-complete' : 'is-failed'}>
          <i>{verification.valid ? '✓' : '×'}</i><span>{verification.valid ? 'Agent receives' : 'Agent blocked'}</span>
        </li>
      </ol>

      <dl className="result-facts">
        <div>
          <dt>Source</dt>
          <dd>{source}</dd>
        </div>
        <div><dt>Response age</dt><dd>{verification.ageSeconds}s</dd></div>
        <div>
          <dt>Source relationship</dt>
          <dd>{directFromProvider ? 'Direct from provider' : 'Relayed by API3'}</dd>
        </div>
        <div><dt>Request cost</dt><dd>{candidate.payment ? 'Priced' : 'Free'}</dd></div>
      </dl>

      <div className="proof-actions">
        {tampered ? (
          <>
            <button className="primary-action" onClick={onReset} type="button">
              Restore verified price
            </button>
            <button className="secondary-action" onClick={onDownload} type="button">
              Download verified record
            </button>
          </>
        ) : (
          <>
            <button className="primary-action" onClick={onDownload} type="button">
              Download verification record
            </button>
            <button className="secondary-action" onClick={onTamper} type="button">
              Simulate tampering
            </button>
          </>
        )}
      </div>

      <details className="proof-disclosure">
        <summary>
          <span>
            <strong>How was this result checked?</strong>
            <small>{passedChecks} of {CHECK_LABELS.length} checks passed in this browser</small>
          </span>
          <i aria-hidden="true" />
        </summary>

        <div className="proof-details">
          <div className="verification-checks">
            {CHECK_LABELS.map(([key, label]) => (
              <span className={verification.checks[key] ? 'check-pass' : 'check-fail'} key={key}>
                <b aria-hidden="true">{verification.checks[key] ? '✓' : '×'}</b>
                {label}
              </span>
            ))}
          </div>

          <dl className="attestation-fields">
            <div><dt>API action</dt><dd><code>{receipt.request.operation}</code></dd></div>
            <div><dt>Source address</dt><dd><code>{receipt.attestation.airnode}</code></dd></div>
            <div><dt>Request fingerprint</dt><dd><code>{receipt.attestation.requestHash}</code></dd></div>
            <div>
              <dt>How the source was found</dt>
              <dd>
                <code>
                  {receipt.discovery.mode} · {receipt.discovery.resolverAttempts}{' '}
                  {receipt.discovery.resolverAttempts === 1 ? 'attempt' : 'attempts'}
                </code>
                {receipt.discovery.resolverError && (
                  <small>{receipt.discovery.resolverError}</small>
                )}
              </dd>
            </div>
          </dl>

          <details className="json-disclosure">
            <summary>View full verification record (JSON)</summary>
            <pre>{JSON.stringify(receipt, null, 2)}</pre>
          </details>
        </div>
      </details>

      <p className="proof-note">
        These checks show who returned the data and whether it changed. They do
        not prove that the real-world market price is objectively correct.
      </p>
    </section>
  );
}
