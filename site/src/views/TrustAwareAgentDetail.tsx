import { useState } from 'react';
import { CandidateGrid } from '../components/CandidateGrid';
import { DecisionTape } from '../components/DecisionTape';
import { ProofPanel } from '../components/ProofPanel';
import { AgentPromptCallout } from '../components/ProjectDetailFrame';
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

const DEFAULT_INTENT = 'Get the current USD price of ETH.';

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
  async function runAgent() {
    let verificationFailure = '';
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
        intent: DEFAULT_INTENT,
        policy,
        onTrace: (nextEvent) => {
          if (nextEvent.stage === 'verify' && nextEvent.status === 'error') {
            verificationFailure = `${nextEvent.label}. ${nextEvent.detail}`;
          }
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
        const nextDecisions = caught.decisions ?? [];
        setError(caught.code === 'VERIFICATION_FAILED' && verificationFailure
          ? verificationFailure
          : `${caught.code}: ${caught.message}`);
        setFailedDecisions(nextDecisions);
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
    'Nodary first',
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
          <h1>Trust-Aware Agent</h1>
          <p>
            Prefer the data provider, verify its response, then release the
            value to the agent.
          </p>
        </div>
      </header>

      <section className="project-overview" id="overview" aria-labelledby="overview-title">
        <h2 id="overview-title">Source priority</h2>
        <div>
          <article>
            <span>1 · First-party</span>
            <p><a className="provider-link" href="https://nodary.io/" target="_blank" rel="noreferrer">Nodary</a> runs and signs its own ETH/USD feed, so the demo tries it first.</p>
          </article>
          <article>
            <span>2 · API3-maintained</span>
            <p>This is the next tier, but no eligible ETH/USD candidate is listed today.</p>
          </article>
          <article>
            <span>3 · Third-party</span>
            <p>CoinGecko and TickerLayer relays are verified fallbacks if Nodary cannot be used.</p>
          </article>
        </div>
      </section>

      <section className="live-demo-heading" id="live-demo" aria-labelledby="live-demo-title">
        <h2 id="live-demo-title">Try Nodary first. Trust only what verifies.</h2>
        <p>A signature proves provenance and integrity, not that a market price is objectively true.</p>
      </section>

      <section className="prompt-card" aria-labelledby="agent-request-label">
        <span className="prompt-label" id="agent-request-label">Example agent request</span>
        <div className="prompt-row">
          <p className="agent-request-copy">{DEFAULT_INTENT}</p>
          <button
            aria-busy={running}
            className="run-button"
            disabled={running}
            onClick={runAgent}
            type="button"
          >
            {running ? 'Checking…' : 'Get verified price'}
          </button>
        </div>

        <details className="policy-disclosure">
          <summary>
            <span className="policy-icon" aria-hidden="true">✓</span>
            <span>
              <strong>Verification settings</strong>
              <small>{policySummary}</small>
            </span>
            <i aria-hidden="true" />
          </summary>

          <div className="policy-grid">
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
      </section>

      {!trace.length && !error && !visibleReceipt && (
        <section className="how-it-works" aria-labelledby="how-title">
          <h2 id="how-title">What happens when you run it</h2>
          <div className="promise-row">
            <div>
              <span aria-hidden="true">1</span>
              <p><strong>Try Nodary</strong> as the first-party source.</p>
            </div>
            <div>
              <span aria-hidden="true">2</span>
              <p><strong>Verify</strong> its signer, response, and freshness.</p>
            </div>
            <div>
              <span aria-hidden="true">3</span>
              <p><strong>Release</strong> only verified data to the agent.</p>
            </div>
          </div>
        </section>
      )}

      {(running || trace.length > 0) && (
        <DecisionTape
          blocked={visibleVerification?.valid === false}
          trace={trace}
          running={running}
          terminalFailure={Boolean(error)}
        />
      )}

      {error && (
        <section className="error-card" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Your agent did not receive an unverified price.</strong>
            <p>{error}</p>
          </div>
          <button onClick={runAgent} type="button">
            Try again
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

      <AgentPromptCallout
        path="/prompts/trust-aware-agent.md"
        title="Give your agent a trust policy, not just an endpoint."
        description="Use this prompt to make an agent discover, call, and verify an AirnodeHub source before consuming its answer."
      />
    </main>
  );
}
