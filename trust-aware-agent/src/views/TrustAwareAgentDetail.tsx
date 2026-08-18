import { type FormEvent, useState } from 'react';
import { CandidateGrid } from '../components/CandidateGrid';
import { DecisionTape } from '../components/DecisionTape';
import { ProofPanel } from '../components/ProofPanel';
import {
  DEFAULT_POLICY,
  TrustedFetchError,
  downloadReceipt,
  tamperWithPrice,
  trustedFetch,
  verifyReceipt,
} from '../lib';
import type {
  CandidateDecision,
  Receipt,
  TraceEvent,
  TrustedFetchResult,
  TrustPolicy,
  VerificationResult,
} from '../lib';

const DEFAULT_INTENT =
  'Get the current USD price of ETH from the strongest available source.';

const SDK_EXAMPLE = `const result = await trustedFetch({
  intent: "current USD price of ETH",
  policy: {
    preferFirstParty: true,
    maxAttestationAgeSeconds: 60,
    allowPaidCalls: false,
  },
});

if (!result.trust.valid) throw new Error("Untrusted input");`;

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'is-on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span />
    </button>
  );
}

export function TrustAwareAgentDetail() {
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [policy, setPolicy] = useState<TrustPolicy>(DEFAULT_POLICY);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [result, setResult] = useState<TrustedFetchResult | null>(null);
  const [visibleReceipt, setVisibleReceipt] = useState<Receipt | null>(null);
  const [visibleVerification, setVisibleVerification] =
    useState<VerificationResult | null>(null);
  const [failedDecisions, setFailedDecisions] = useState<CandidateDecision[]>([]);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [tampered, setTampered] = useState(false);

  async function runAgent(event: FormEvent) {
    event.preventDefault();
    setRunning(true);
    setError('');
    setTrace([]);
    setResult(null);
    setVisibleReceipt(null);
    setVisibleVerification(null);
    setFailedDecisions([]);
    setTampered(false);

    try {
      const nextResult = await trustedFetch({
        intent,
        policy,
        onTrace: (nextEvent) => {
          setTrace((current) => [
            ...current,
            { ...nextEvent, id: (current.at(-1)?.id ?? 0) + 1 },
          ]);
        },
      });
      setResult(nextResult);
      setVisibleReceipt(nextResult.receipt);
      setVisibleVerification(nextResult.trust);
    } catch (caught) {
      if (caught instanceof TrustedFetchError) {
        setError(`${caught.code}: ${caught.message}`);
        setFailedDecisions(caught.decisions ?? []);
      } else {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      setRunning(false);
    }
  }

  async function showTamperedReceipt() {
    if (!result) return;
    const nextReceipt = tamperWithPrice(result.receipt);
    const nextVerification = await verifyReceipt(nextReceipt);
    setVisibleReceipt(nextReceipt);
    setVisibleVerification(nextVerification);
    setTampered(true);
  }

  async function restoreReceipt() {
    if (!result) return;
    const restoredVerification = await verifyReceipt(result.receipt);
    setVisibleReceipt(result.receipt);
    setVisibleVerification(restoredVerification);
    setTampered(false);
  }

  const decisions = result?.decision.decisions ?? failedDecisions;
  const discoveryMode = result?.decision.discoveryMode;
  const policySummary = [
    policy.preferFirstParty ? 'Prefer the source owner' : 'Allow relayed sources',
    `answer newer than ${policy.maxAttestationAgeSeconds}s`,
    policy.allowPaidCalls ? 'show priced sources' : 'free sources only',
  ].join(' · ');

  return (
    <main className="project-page" id="top">
      <nav className="project-breadcrumb" aria-label="Breadcrumb">
        <a href="./">Use cases</a>
        <span aria-hidden="true">/</span>
        <span>Trust-Aware Agent</span>
      </nav>

      <header className="project-summary">
        <div className="project-summary-copy">
          <span className="catalog-status catalog-status--working">
            <i aria-hidden="true" />Working
          </span>
          <h1>Trust-Aware Agent</h1>
          <p>
            Choose, call, and verify an ETH/USD source before an agent uses its
            value.
          </p>
        </div>
        <dl>
          <div><dt>Category</dt><dd>Agent safety</dd></div>
          <div><dt>Listings</dt><dd>Nodary +2</dd></div>
          <div><dt>Runtime</dt><dd>Browser-only</dd></div>
          <div><dt>API key</dt><dd>Not required</dd></div>
        </dl>
      </header>

      <nav className="project-tabs" aria-label="Project sections">
        <a href="#overview">Overview</a>
        <a href="#live-demo">Live demo</a>
        <a href="#code">Code</a>
        <a href="./#contribute">Contribute</a>
        <code>use-cases/trust-aware-agent/README.md</code>
      </nav>

      <section className="project-overview" id="overview" aria-labelledby="overview-title">
        <h2 id="overview-title">What the receipt changes</h2>
        <div>
          <article>
            <span>Problem</span>
            <p>Agents often accept API output without checking its signer or whether the response changed.</p>
          </article>
          <article>
            <span>Outcome</span>
            <p>The ETH/USD value is released only after request, signer, freshness, and derived-price checks pass.</p>
          </article>
          <article>
            <span>Boundary</span>
            <p>The signature proves provenance and integrity. It does not prove that a market price is objectively true.</p>
          </article>
        </div>
      </section>

      <section className="live-demo-heading" id="live-demo" aria-labelledby="live-demo-title">
        <h2 id="live-demo-title">Put a verification gate in front of the agent</h2>
        <p>Runs against published AirnodeHub listings and verifies the response in this browser.</p>
      </section>

      <form className="prompt-card" onSubmit={runAgent}>
        <label htmlFor="intent">Agent request</label>
        <div className="prompt-row">
          <textarea
            id="intent"
            onChange={(event) => setIntent(event.target.value)}
            rows={2}
            value={intent}
          />
          <button className="run-button" disabled={running} type="submit">
            {running ? 'Checking…' : 'Get verified price'}
          </button>
        </div>

        <details className="policy-disclosure">
          <summary>
            <span className="policy-icon" aria-hidden="true">✓</span>
            <span>
              <strong>Advanced verification settings</strong>
              <small>{policySummary}</small>
            </span>
            <i aria-hidden="true" />
          </summary>

          <div className="policy-grid">
            <div className="policy-control">
              <div>
                <strong>Prefer the source owner</strong>
                <small>Choose data signed by its provider when possible</small>
              </div>
              <Toggle
                checked={policy.preferFirstParty}
                disabled={running}
                label="Prefer sources run by the data provider"
                onChange={(preferFirstParty) =>
                  setPolicy((current) => ({ ...current, preferFirstParty }))
                }
              />
            </div>

            <label className="policy-control policy-select">
              <div>
                <strong>Maximum answer age</strong>
                <small>Reject a price signed too long ago</small>
              </div>
              <select
                disabled={running}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    maxAttestationAgeSeconds: Number(event.target.value),
                  }))
                }
                value={policy.maxAttestationAgeSeconds}
              >
                <option value={30}>30 sec</option>
                <option value={60}>60 sec</option>
                <option value={300}>5 min</option>
              </select>
            </label>

            <div className="policy-control">
              <div>
                <strong>Show priced sources</strong>
                <small>This demo never pays automatically</small>
              </div>
              <Toggle
                checked={policy.allowPaidCalls}
                disabled={running}
                label="Include priced sources"
                onChange={(allowPaidCalls) =>
                  setPolicy((current) => ({ ...current, allowPaidCalls }))
                }
              />
            </div>
          </div>
        </details>
      </form>

      {!trace.length && !error && !visibleReceipt && (
        <section className="how-it-works" aria-labelledby="how-title">
          <h2 id="how-title">What happens when you run it</h2>
          <div className="promise-row">
            <div>
              <span aria-hidden="true">1</span>
              <p><strong>AirnodeHub finds</strong> a live ETH price source.</p>
            </div>
            <div>
              <span aria-hidden="true">2</span>
              <p><strong>The source returns</strong> a price plus its signature.</p>
            </div>
            <div>
              <span aria-hidden="true">3</span>
              <p><strong>Your browser checks</strong> it before the agent uses it.</p>
            </div>
          </div>
        </section>
      )}

      {(running || trace.length > 0) && (
        <DecisionTape trace={trace} running={running} />
      )}

      {error && (
        <section className="error-card" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Your agent did not receive an unverified price.</strong>
            <p>{error}</p>
          </div>
          <button onClick={() => setIntent(DEFAULT_INTENT)} type="button">
            Restore sample
          </button>
        </section>
      )}

      {visibleReceipt && visibleVerification && (
        <ProofPanel
          onDownload={() => result && downloadReceipt(result.receipt)}
          onReset={restoreReceipt}
          onTamper={showTamperedReceipt}
          receipt={visibleReceipt}
          tampered={tampered}
          verification={visibleVerification}
        />
      )}

      {decisions.length > 0 && (
        <CandidateGrid decisions={decisions} mode={discoveryMode} />
      )}

      <section className="integration-section" id="code">
        <div className="integration-copy">
          <span>Reusable code</span>
          <h2>Use the verification core in your own agent.</h2>
          <p>
            <code>trustedFetch()</code> runs the same flow: it finds a source,
            calls it, checks the signature locally, and returns the value with
            downloadable proof.
          </p>
          <ul>
            <li>Use the verified value in any agent framework</li>
            <li>Recheck the saved proof without calling an API</li>
            <li>No API key or automatic spending in this demo</li>
          </ul>
        </div>
        <div className="code-window">
          <div>
            <span>agent.ts</span>
            <span>trusted input</span>
          </div>
          <pre><code>{SDK_EXAMPLE}</code></pre>
        </div>
      </section>
    </main>
  );
}
