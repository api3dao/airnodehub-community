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
  baseline,
  threshold,
}: {
  results: Array<MarketResult & { call: VerifiedCall; normalized: NormalizedPrice }>;
  baseline: number;
  threshold: number;
}) {
  const values = results.map((result) => result.normalized.value);
  const thresholdWidth = baseline * (threshold / 100);
  const observedWidth = Math.max(...values) - Math.min(...values);
  const halfDomain = Math.max(thresholdWidth * 1.65, observedWidth * 0.78, baseline * 0.001);
  const domainMin = baseline - halfDomain;
  const domainMax = baseline + halfDomain;
  const position = (value: number) =>
    Math.max(0, Math.min(100, ((value - domainMin) / (domainMax - domainMin)) * 100));
  const safeStart = position(baseline - thresholdWidth);
  const safeEnd = position(baseline + thresholdWidth);

  return (
    <section className="market-range-plot" aria-label="Verified price distribution around the median">
      <header>
        <div><span>Signed price distribution</span><strong>Median corridor</strong></div>
        <p>The green band is your ±{threshold}% policy. Each dot is positioned from a verified response.</p>
      </header>
      <div className="market-plot-body">
        <div className="market-axis-labels" aria-hidden="true">
          <span>${domainMin.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          <strong>Median ${baseline.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
          <span>${domainMax.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </div>
        {results.map((result) => {
          const price = result.normalized.value;
          const outside = Math.abs(deviationPercent(price, baseline)) > threshold;
          return (
            <div className="market-source-track" key={result.candidate.listing}>
              <span>{sourceName(result.candidate.listing)}<small>{result.candidate.attestation === 'first-party' ? 'Provider' : 'Relay'}</small></span>
              <div className="market-track-line">
                <i className="market-safe-band" style={{ left: `${safeStart}%`, width: `${safeEnd - safeStart}%` }} />
                <i className="market-median-line" style={{ left: `${position(baseline)}%` }} />
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
  const marketMedian = accepted.length
    ? median(accepted.map((result) => result.normalized.value))
    : null;
  const spread = accepted.length > 1
    ? Math.max(...accepted.map((result) => result.normalized.value)) -
      Math.min(...accepted.map((result) => result.normalized.value))
    : 0;

  const bundle = useMemo(
    () => marketMedian === null ? null : {
      schemaVersion: '1.0',
      type: 'airnodehub.market-integrity-monitor',
      createdAt: new Date().toISOString(),
      rule: { pair: 'ETH/USD', median: marketMedian, deviationThresholdPercent: threshold },
      inputs: accepted.map(({ call, normalized }) => ({ call, normalized })),
    },
    [accepted, marketMedian, threshold],
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
      title="Market Integrity Monitor"
      tagline="Compare ETH/USD across signed sources without throwing away the receipt behind each value."
      category="Market data"
      listings="Nodary +2"
      runtime="Browser-only"
      repoPath="use-cases/market-integrity-monitor/README.md"
      problem="Price dashboards usually normalize values and lose who returned each input."
      outcome="The median and every deviation remain bound to independently verified source receipts."
      boundary="Consensus reduces single-source risk; it does not make a market price objectively true."
      prompt={{
        path: '/prompts/market-integrity-monitor.md',
        title: 'Ask an agent to compare signed market inputs.',
        description: 'This prompt produces an ETH/USD median with source-level verification, deviation flags, and a portable evidence bundle.',
      }}
    >
      <section className="live-demo-heading" id="live-demo" aria-labelledby="market-demo-title">
        <h2 id="market-demo-title">One number, three receipts</h2>
        <p>Every source is inspected, called, and verified independently before it enters the median.</p>
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
            title="Comparing three independent price responses"
            detail="The browser is reading each live contract, calling the operation, and checking every signature before calculating a median."
            sources={['Nodary', 'CoinGecko', 'TickerLayer']}
          />
        )}

        {!running && marketMedian === null && results.length === 0 && (
          <div className="workbench-empty">
            <span className="empty-glyph">↔</span>
            <strong>Run a live integrity check</strong>
            <p>The dashboard will exclude any source whose request, signer, signature, or freshness check fails.</p>
          </div>
        )}

        {marketMedian !== null && (
          <>
            <div className="market-summary">
              <div><span>Verified median</span><strong>${marketMedian.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong></div>
              <div><span>Accepted inputs</span><strong>{accepted.length} / {PRICE_CATALOG.length}</strong></div>
              <div><span>Price spread</span><strong>${spread.toFixed(2)}</strong></div>
            </div>
            <MarketRangePlot results={accepted} baseline={marketMedian} threshold={threshold} />
          </>
        )}

        {results.length > 0 && (
          <div className="source-ledger" id="evidence">
            <div className="ledger-columns" aria-hidden="true">
              <span>Source</span><span>Price</span><span>Deviation</span><span>Receipt</span>
            </div>
            {results.map((result) => {
              const deviation = result.normalized && marketMedian !== null
                ? deviationPercent(result.normalized.value, marketMedian)
                : null;
              const flagged = deviation !== null && Math.abs(deviation) > threshold;
              return (
                <article className={result.error ? 'is-rejected' : flagged ? 'is-flagged' : ''} key={result.candidate.listing}>
                  <div className="ledger-source">
                    <i className={`source-dot source-dot--${result.candidate.attestation}`} />
                    <span><strong>{sourceName(result.candidate.listing)}</strong><small>{result.candidate.attestation === 'first-party' ? 'Original provider' : 'API3 relay'}</small></span>
                  </div>
                  <strong className="ledger-price">
                    {result.normalized ? `$${result.normalized.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Excluded'}
                  </strong>
                  <span className={`ledger-deviation ${flagged ? 'is-flagged' : ''}`}>
                    {deviation === null ? 'Not accepted' : `${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%`}
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
            <div><strong>Comparison is reproducible</strong><span>The bundle contains every signed input plus the exact median rule.</span></div>
            <button onClick={() => downloadJson('market-integrity-evidence.json', bundle)} type="button">Download evidence bundle</button>
          </div>
        )}
      </section>
    </ProjectDetailFrame>
  );
}
