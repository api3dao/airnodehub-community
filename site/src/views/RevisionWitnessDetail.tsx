import { useState } from 'react';
import { LiveCallLoading, ProjectDetailFrame, VerificationStamp } from '../components/ProjectDetailFrame';
import { callVerifiedListing, downloadJson } from '../lib';
import { PRICE_CATALOG } from '../lib/catalog';
import { normalizePrice } from '../lib/normalize';
import type { ListingCallSpec, VerifiedCall } from '../lib';
import type { NormalizedPrice } from '../lib/types';

const NODARY = (() => {
  const candidate = PRICE_CATALOG.find((entry) => entry.listing === 'nodary');
  if (!candidate) throw new Error('The Nodary price listing is unavailable.');
  return candidate;
})();

const NODARY_SPEC: ListingCallSpec = {
  id: NODARY.listing,
  name: 'Nodary',
  url: NODARY.airnode,
  operation: NODARY.operation,
  address: NODARY.address,
  provenance: NODARY.attestation,
  parameters: NODARY.example,
};

interface PriceSnapshot {
  call: VerifiedCall;
  normalized: NormalizedPrice;
}

function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

function formatDelta(value: number): string {
  if (value !== 0 && Math.abs(value) < 0.000001) {
    return `${value > 0 ? '+' : '-'}<$0.000001`;
  }
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatPrice(Math.abs(value))}`;
}

function formatPercentage(value: number): string {
  if (value !== 0 && Math.abs(value) < 0.000001) {
    return `${value > 0 ? '+' : '-'}<0.000001%`;
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}%`;
}

function signedAtMilliseconds(call: VerifiedCall): number {
  return Number(call.attestation.timestamp) * 1000;
}

function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s apart`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s apart`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function RevisionWitnessDetail() {
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const latest = snapshots.at(-1) ?? null;
  const previous = snapshots.at(-2) ?? null;
  const delta = previous && latest
    ? latest.normalized.value - previous.normalized.value
    : null;
  const percentageDelta = delta !== null && previous && previous.normalized.value !== 0
    ? (delta / previous.normalized.value) * 100
    : null;
  const elapsedMilliseconds = previous && latest
    ? signedAtMilliseconds(latest.call) - signedAtMilliseconds(previous.call)
    : null;

  async function captureSnapshot() {
    setRunning(true);
    setError('');
    try {
      const call = await callVerifiedListing(NODARY_SPEC, { maxAgeSeconds: 300 });
      if (latest && signedAtMilliseconds(call) <= signedAtMilliseconds(latest.call)) {
        throw new Error('Nodary did not return a newer signed response. Wait a moment and capture again.');
      }
      const next = [
        ...snapshots,
        { call, normalized: normalizePrice(NODARY, call.attestation) },
      ].slice(-2);
      setSnapshots(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  }

  function clearSnapshots() {
    setSnapshots([]);
    setError('');
  }

  const witnessBundle = previous && latest ? {
    schemaVersion: '1.0',
    type: 'airnodehub.verified-change-tracker',
    subject: { pair: 'ETH/USD', source: 'Nodary', provenance: 'first-party' },
    snapshots,
    comparison: {
      valueDelta: delta,
      percentageDelta,
      elapsedMilliseconds,
      changed: delta !== 0,
    },
  } : null;

  return (
    <ProjectDetailFrame
      title="Verified Change Tracker"
      tagline="Capture two provider-signed ETH/USD prices and preserve exactly how the value changed."
      problem="Price APIs expose the latest value, but an application may need proof of what the same source returned at two decision points."
      outcome="Two separate Nodary calls become signed snapshot A and B, with their value delta, elapsed time, signer, and receipts kept together."
      boundary="A Nodary attestation proves which value its Airnode returned at capture time; it does not guarantee that the market price cannot move or remain unchanged."
      prompt={{
        path: '/prompts/revision-witness.md',
        title: 'Ask an agent to preserve a signed price change record.',
        description: 'This prompt captures two verified Nodary ETH/USD values and reports the real delta without inventing a change.',
      }}
    >
      <section className="live-demo-heading" id="live-demo" aria-labelledby="revision-demo-title">
        <h2 id="revision-demo-title">Track a live ETH/USD price</h2>
        <p>Capture Nodary twice. Each click makes a separate live call and accepts the price only after local signature verification.</p>
      </section>

      <section className="demo-workbench revision-workbench" aria-live="polite">
        <div className="workbench-toolbar">
          <div><strong>Signed price snapshots</strong><span>{snapshots.length} of 2 captured · held for this comparison</span></div>
          {snapshots.length > 0 && <button className="toolbar-text-action" onClick={clearSnapshots} type="button">Clear local history</button>}
          <button aria-busy={running} className="workbench-run" disabled={running} onClick={captureSnapshot} type="button">
            {running ? 'Verifying snapshot…' : snapshots.length === 0 ? 'Capture snapshot A' : snapshots.length === 1 ? 'Capture snapshot B' : 'Capture next snapshot'}
          </button>
        </div>

        {running && (
          <LiveCallLoading
            title="Capturing a provider-signed ETH/USD price"
            detail="Your browser is calling Nodary and will keep the snapshot only if its request, signer, freshness, and signature all verify."
            sources={['Nodary']}
          />
        )}

        {!running && !latest && !error && (
          <div className="workbench-empty">
            <span className="empty-glyph">◷</span>
            <strong>Capture signed snapshot A</strong>
            <p>Call Nodary now for the baseline, then make a second live call to measure the real price change.</p>
          </div>
        )}
        {error && <div className="workbench-error"><strong>Snapshot rejected</strong><span>{error}</span></div>}

        {latest && (
          <div id="evidence">
            <section className="witness-chain" aria-label="Signed price snapshot comparison">
              <article className="witness-node">
                <span>Snapshot A · first-party</span>
                <strong>{formatPrice((previous ?? latest).normalized.value)}</strong>
                <small>Signed {new Date(signedAtMilliseconds((previous ?? latest).call)).toLocaleTimeString()}</small>
                <code>Signer {shortAddress((previous ?? latest).call.attestation.airnode)}</code>
              </article>
              <div className={`witness-link ${previous ? 'is-linked' : ''}`}>
                <i aria-hidden="true"><b /></i>
                <span>
                  <strong>{previous && elapsedMilliseconds !== null ? formatElapsed(elapsedMilliseconds) : 'Waiting for snapshot B'}</strong>
                  <small>{previous && delta !== null ? formatDelta(delta) : 'Separate live call'}</small>
                </span>
              </div>
              {previous ? (
                <article className="witness-node is-latest">
                  <span>Snapshot B · first-party</span>
                  <strong>{formatPrice(latest.normalized.value)}</strong>
                  <small>Signed {new Date(signedAtMilliseconds(latest.call)).toLocaleTimeString()}</small>
                  <code>Signer {shortAddress(latest.call.attestation.airnode)}</code>
                </article>
              ) : (
                <article className="witness-node is-empty">
                  <span>Snapshot B</span>
                  <strong>Not captured</strong>
                  <small>Make a second live Nodary call.</small>
                </article>
              )}
            </section>

            <div className="revision-summary">
              <div className="revision-current">
                <span>Latest accepted ETH/USD</span>
                <strong
                  className={`value-flash ${delta === null || delta === 0 ? '' : delta > 0 ? 'value-flash--up' : 'value-flash--down'}`}
                  key={latest.call.attestation.signature}
                >
                  {formatPrice(latest.normalized.value)}
                </strong>
                <p>Nodary · signer {shortAddress(latest.call.attestation.airnode)}</p>
                <VerificationStamp ageSeconds={latest.call.verification.ageSeconds} provenance="first-party" />
              </div>
              <div className={`revision-diff-state ${delta !== null && delta !== 0 ? 'has-changes' : ''}`}>
                <i>{!previous ? 'A' : delta === 0 ? '＝' : delta && delta > 0 ? '↗' : '↘'}</i>
                <span>
                  <strong
                    className={previous
                      ? `value-flash ${delta === 0 ? '' : delta && delta > 0 ? 'value-flash--up' : 'value-flash--down'}`
                      : undefined}
                    key={latest.call.attestation.signature}
                  >
                    {!previous
                      ? 'Snapshot A recorded'
                      : delta === 0
                        ? 'The verified price is unchanged'
                        : `${formatDelta(delta ?? 0)} (${formatPercentage(percentageDelta ?? 0)})`}
                  </strong>
                  <small>{!previous
                    ? 'Capture snapshot B to calculate a signed change.'
                    : `${elapsedMilliseconds === null ? '' : formatElapsed(elapsedMilliseconds)} · both receipts verified independently.`}</small>
                </span>
              </div>
            </div>
          </div>
        )}

        {previous && latest && delta !== null && (
          <div className="diff-table">
            <div><span>Value</span><span>Snapshot A</span><span>Snapshot B</span></div>
            <article>
              <code>ETH/USD</code>
              <span>{formatPrice(previous.normalized.value)}</span>
              <strong>{formatPrice(latest.normalized.value)}</strong>
            </article>
          </div>
        )}

        {snapshots.length > 0 && (
          <div className="snapshot-timeline">
            {[...snapshots].reverse().map((snapshot, reverseIndex) => (
              <article key={snapshot.call.attestation.signature}>
                <i aria-hidden="true" />
                <div>
                  <span>{snapshots.length === 1 || reverseIndex === 1 ? 'Snapshot A' : 'Snapshot B'}</span>
                  <strong>{formatPrice(snapshot.normalized.value)}</strong>
                  <small>Signed {new Date(signedAtMilliseconds(snapshot.call)).toLocaleString()} · first-party · signer {shortAddress(snapshot.call.attestation.airnode)}</small>
                </div>
                <code>{snapshot.call.attestation.requestHash.slice(0, 10)}…</code>
                <details>
                  <summary>Receipt</summary>
                  <pre>{JSON.stringify(snapshot.call, null, 2)}</pre>
                </details>
              </article>
            ))}
          </div>
        )}

        {witnessBundle && (
          <div className="evidence-export">
            <div><strong>Portable price change record</strong><span>Snapshot A and B, both complete receipts, their signer, capture times, and the observed delta.</span></div>
            <button onClick={() => downloadJson('verified-price-change-record.json', witnessBundle)} type="button">Download record</button>
          </div>
        )}
      </section>
    </ProjectDetailFrame>
  );
}
