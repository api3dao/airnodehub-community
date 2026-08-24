import { useMemo, useState } from 'react';
import { LiveCallLoading, ProjectDetailFrame, VerificationStamp } from '../components/ProjectDetailFrame';
import { PRICE_CATALOG } from '../lib/catalog';
import { normalizePrice } from '../lib/normalize';
import { callVerifiedListing, downloadJson } from '../lib';
import type { ListingCallSpec, VerifiedCall } from '../lib';
import type { Candidate, NormalizedPrice } from '../lib/types';
import { deviationPercent, median } from '../lib/useCases';

interface MarketResult {
  candidate: Candidate;
  call?: VerifiedCall;
  normalized?: NormalizedPrice;
  error?: string;
}

function sourceName(slug: string): string {
  if (slug === 'nodary') return 'Nodary';
  if (slug === 'coingecko') return 'CoinGecko';
  return 'TickerLayer';
}

function toSpec(candidate: Candidate): ListingCallSpec {
  return {
    id: candidate.listing,
    name: sourceName(candidate.listing),
    url: candidate.airnode,
    operation: candidate.operation,
    address: candidate.address,
    provenance: candidate.attestation,
    parameters: candidate.example,
  };
}

function MarketRangePlot({
  results,
  reference,
  threshold,
}: {
  results: Array<MarketResult & { call: VerifiedCall; normalized: NormalizedPrice }>;
  reference: number;
  threshold: number;
}) {
  const values = results.map((result) => result.normalized.value);
  const thresholdWidth = reference * (threshold / 100);
  const observedWidth = Math.max(...values) - Math.min(...values);
  const halfDomain = Math.max(thresholdWidth * 1.65, observedWidth * 0.78, reference * 0.001);
  const domainMin = reference - halfDomain;
  const domainMax = reference + halfDomain;
  const position = (value: number) =>
    Math.max(0, Math.min(100, ((value - domainMin) / (domainMax - domainMin)) * 100));
  const safeStart = position(reference - thresholdWidth);
  const safeEnd = position(reference + thresholdWidth);

  return (
    <section className="market-range-plot" aria-label="Verified price distribution around the Nodary reference">
      <header>
        <div><span>Signed price distribution</span><strong>Nodary reference corridor</strong></div>
        <p>The green band is your ±{threshold}% policy around the verified first-party price.</p>
      </header>
      <div className="market-plot-body">
        <div className="market-axis-labels" aria-hidden="true">
          <span>${domainMin.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          <strong>Nodary ${reference.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
          <span>${domainMax.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </div>
        {results.map((result) => {
          const price = result.normalized.value;
          const outside = Math.abs(deviationPercent(price, reference)) > threshold;
          return (
            <div className="market-source-track" key={result.candidate.listing}>
              <span>{sourceName(result.candidate.listing)}<small>{result.candidate.attestation === 'first-party' ? 'Provider' : 'Relay'}</small></span>
              <div className="market-track-line">
                <i className="market-safe-band" style={{ left: `${safeStart}%`, width: `${safeEnd - safeStart}%` }} />
                <i className="market-median-line" style={{ left: `${position(reference)}%` }} />
                <b className={outside ? 'is-outside' : ''} style={{ left: `${position(price)}%` }}>
                  <span>${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                </b>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function MarketIntegrityMonitorDetail() {
  const [results, setResults] = useState<MarketResult[]>([]);
  const [running, setRunning] = useState(false);
  const [threshold, setThreshold] = useState(1);

  const accepted = results.filter(
    (result): result is MarketResult & { call: VerifiedCall; normalized: NormalizedPrice } =>
      Boolean(result.call && result.normalized),
  );
  const nodaryReference = accepted.find(
    (result) => result.candidate.listing === 'nodary' && result.candidate.attestation === 'first-party',
  ) ?? null;
  const marketMedian = accepted.length
    ? median(accepted.map((result) => result.normalized.value))
    : null;

  const bundle = useMemo(
    () => !nodaryReference || marketMedian === null ? null : {
      schemaVersion: '1.0',
      type: 'airnodehub.asset-price-monitor',
      createdAt: new Date().toISOString(),
      rule: {
        pair: 'ETH/USD',
        reference: { listing: 'nodary', value: nodaryReference.normalized.value },
        median: marketMedian,
        deviationThresholdPercent: threshold,
      },
      inputs: accepted.map(({ call, normalized }) => ({ call, normalized })),
    },
    [accepted, marketMedian, nodaryReference, threshold],
  );

  async function compareSources() {
    setRunning(true);
    setResults([]);
    const settled = await Promise.allSettled(
      PRICE_CATALOG.map(async (candidate) => {
        const call = await callVerifiedListing(toSpec(candidate), { maxAgeSeconds: 300 });
        return {
          candidate,
          call,
          normalized: normalizePrice(candidate, call.attestation),
        };
      }),
    );
    setResults(
      settled.map((result, index) =>
        result.status === 'fulfilled'
          ? result.value
          : {
              candidate: PRICE_CATALOG[index],
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            },
      ),
    );
    setRunning(false);
  }

  return (
    <ProjectDetailFrame
      title="Asset Price Monitor"
      tagline="Use verified first-party Nodary data as the reference, then compare other signed ETH/USD prices."
      problem="Price dashboards often hide which provider supplied each value."
      outcome="Every price and its deviation from Nodary remain bound to a verified receipt."
      boundary="A signed response proves its source and integrity, not that a market price is objectively true."
      prompt={{
        path: '/prompts/market-integrity-monitor.md',
        title: 'Ask an agent to compare prices against Nodary.',
        description: 'This prompt treats verified first-party Nodary data as the reference and preserves every source receipt.',
      }}
    >
      <section className="live-demo-heading" id="live-demo" aria-labelledby="market-demo-title">
        <h2 id="market-demo-title">One reference, three receipts</h2>
        <p>Nodary is the first-party reference. Other verified prices are measured against it.</p>
      </section>

      <section className="demo-workbench market-workbench" aria-live="polite">
        <div className="workbench-toolbar">
          <div>
            <strong>ETH / USD</strong>
            <span>Free calls · 5 minute freshness</span>
          </div>
          <label>
            Flag above
            <select value={threshold} onChange={(event) => setThreshold(Number(event.target.value))}>
              <option value={0.5}>0.5%</option>
              <option value={1}>1%</option>
              <option value={2}>2%</option>
            </select>
          </label>
          <button className="workbench-run" disabled={running} onClick={compareSources} type="button">
            {running ? 'Checking three sources…' : 'Compare signed prices'}
          </button>
        </div>

        {running && (
          <LiveCallLoading
            title="Checking Nodary and two comparison sources"
            detail="The browser verifies every response before measuring other prices against the first-party Nodary reference."
            sources={['Nodary', 'CoinGecko', 'TickerLayer']}
          />
        )}

        {!running && marketMedian === null && results.length === 0 && (
          <div className="workbench-empty">
            <span className="empty-glyph">↔</span>
            <strong>Compare live verified prices</strong>
            <p>Nodary becomes the reference only after its request, signer, signature, and freshness checks pass.</p>
          </div>
        )}

        {!running && results.length > 0 && !nodaryReference && (
          <div className="workbench-empty">
            <strong>Nodary reference unavailable</strong>
            <p>Other verified receipts remain visible, but no deviation is calculated without the first-party reference.</p>
          </div>
        )}

        {nodaryReference && marketMedian !== null && (
          <>
            <div className="market-summary">
              <div><span>Nodary reference</span><strong>${nodaryReference.normalized.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong></div>
              <div><span>Accepted inputs</span><strong>{accepted.length} / {PRICE_CATALOG.length}</strong></div>
              <div><span>Verified median</span><strong>${marketMedian.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong></div>
            </div>
            <MarketRangePlot results={accepted} reference={nodaryReference.normalized.value} threshold={threshold} />
          </>
        )}

        {results.length > 0 && (
          <div className="source-ledger" id="evidence">
            <div className="ledger-columns" aria-hidden="true">
              <span>Source</span><span>Price</span><span>vs Nodary</span><span>Receipt</span>
            </div>
            {results.map((result) => {
              const deviation = result.normalized && nodaryReference
                ? deviationPercent(result.normalized.value, nodaryReference.normalized.value)
                : null;
              const flagged = deviation !== null && Math.abs(deviation) > threshold;
              return (
                <article className={result.error ? 'is-rejected' : flagged ? 'is-flagged' : ''} key={result.candidate.listing}>
                  <div className="ledger-source">
                    <i className={`source-dot source-dot--${result.candidate.attestation}`} />
                    <span><strong>{sourceName(result.candidate.listing)}</strong><small>{result.candidate.attestation === 'first-party' ? 'Original provider' : 'Third-party relay'}</small></span>
                  </div>
                  <strong className="ledger-price">
                    {result.normalized ? `$${result.normalized.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Excluded'}
                  </strong>
                  <span className={`ledger-deviation ${flagged ? 'is-flagged' : ''}`}>
                    {deviation === null ? (result.normalized ? 'No reference' : 'Not accepted') : `${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%`}
                  </span>
                  <div>
                    {result.call ? (
                      <VerificationStamp ageSeconds={result.call.verification.ageSeconds} provenance={result.call.spec.provenance} />
                    ) : <span className="rejection-reason">{result.error}</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {bundle && (
          <div className="evidence-export">
            <div><strong>Comparison is reproducible</strong><span>The bundle contains every signed input plus the reference and deviation rule.</span></div>
            <button onClick={() => downloadJson('asset-price-evidence.json', bundle)} type="button">Download evidence bundle</button>
          </div>
        )}
      </section>
    </ProjectDetailFrame>
  );
}
