import { Suspense, lazy, useState } from 'react';
import { ProjectDetailFrame } from '../components/ProjectDetailFrame';
import { downloadJson } from '../lib';
import type { PaymentSettlement } from '../lib/browserPayment';
import {
  MAX_AGE_SECONDS,
  PROGRAM_ERROR_MESSAGES,
  PROGRAM_ID,
  TWITTER_AIRNODE,
  attestArguments,
  checkAsProgram,
  explorerUrl,
  followerRequest,
  highSTwin,
  parseFollowers,
  simulateOnDevnet,
} from '../lib/solanaFollowerProof';
import type { LiveCapture } from './SolanaFollowerProofLiveCall';

// The paid x402 path is an optional reference module, loaded only when someone opens it
const LivePaidCall = lazy(() => import('./SolanaFollowerProofLiveCall'));
import type {
  FollowerAttestation,
  FollowerRequest,
  ProgramCheckResult,
  ProgramErrorName,
  SimulationResult,
} from '../lib/solanaFollowerProof';

const FIXTURE_PATH = '/fixtures/twitterapi-userinfo-followers.json';

type SourceMode = 'recorded' | 'live';
type Variant = 'original' | 'edit-count' | 'other-handle' | 'high-s' | 'raise-milestone';

interface CapturedResponse {
  mode: SourceMode;
  handle: string;
  request: FollowerRequest;
  attestation: FollowerAttestation;
  receivedAt: string;
  settlement?: PaymentSettlement;
}

interface Run {
  variant: Variant;
  handle: string;
  minFollowers: bigint;
  attestation: FollowerAttestation;
  browser: ProgramCheckResult;
  solana: SimulationResult | null;
  solanaError: string;
}

const VARIANTS: Array<{ id: Exclude<Variant, 'original'>; label: string; expected: ProgramErrorName; detail: string }> = [
  { id: 'edit-count', label: 'Inflate the count', expected: 'WrongSigner', detail: 'Add a million followers to the signed text.' },
  { id: 'other-handle', label: 'Claim another account', expected: 'WrongSigner', detail: 'Submit the same response for a different handle.' },
  { id: 'high-s', label: 'Use the high-s twin', expected: 'HighS', detail: 'Swap in the other valid form of the same signature.' },
  { id: 'raise-milestone', label: 'Raise the milestone', expected: 'BelowMilestone', detail: 'Ask for one more follower than were signed.' },
];

function applyVariant(captured: CapturedResponse, variant: Variant, milestone: bigint) {
  const { attestation, handle } = captured;
  switch (variant) {
    case 'edit-count': {
      const followers = parseFollowers(attestation.data) ?? 0n;
      return { handle, minFollowers: milestone, attestation: { ...attestation, data: `{"followers":${followers + 1_000_000n}}` } };
    }
    case 'other-handle':
      return { handle: handle.toLowerCase() === 'jack' ? 'elonmusk' : 'jack', minFollowers: milestone, attestation };
    case 'high-s':
      return { handle, minFollowers: milestone, attestation: { ...attestation, signature: highSTwin(attestation.signature) } };
    case 'raise-milestone':
      return { handle, minFollowers: (parseFollowers(attestation.data) ?? 0n) + 1n, attestation };
    default:
      return { handle, minFollowers: milestone, attestation };
  }
}

function formatCount(value: bigint | null): string {
  return value === null ? '—' : value.toLocaleString('en-US');
}

function shortValue(value: string, keep = 6): string {
  return value.length <= keep * 2 + 1 ? value : `${value.slice(0, keep + 2)}…${value.slice(-keep)}`;
}

function errorText(error: ProgramErrorName | null): string {
  return error ? PROGRAM_ERROR_MESSAGES[error] : 'All checks passed.';
}

export function SolanaFollowerProofDetail() {
  const [mode, setMode] = useState<SourceMode>('recorded');
  const [milestoneInput, setMilestoneInput] = useState('1000');
  const [captured, setCaptured] = useState<CapturedResponse | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState<'' | 'wallet' | 'fetch' | 'verify'>('');
  const [error, setError] = useState('');

  const milestone = /^\d{1,19}$/.test(milestoneInput) ? BigInt(milestoneInput) : null;

  async function verify(source: CapturedResponse, variant: Variant, minimum: bigint) {
    setBusy('verify');
    const applied = applyVariant(source, variant, minimum);
    const browser = await checkAsProgram({ ...applied, nowSeconds: Date.now() / 1000 });
    const pending: Run = { variant, ...applied, browser, solana: null, solanaError: '' };
    setRun(pending);
    try {
      const solana = await simulateOnDevnet(attestArguments(applied.attestation, applied.handle, applied.minFollowers));
      setRun({ ...pending, solana });
    } catch (caught) {
      setRun({ ...pending, solanaError: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy('');
    }
  }

  async function loadRecorded() {
    if (milestone === null) return;
    setError('');
    setBusy('fetch');
    try {
      const response = await fetch(FIXTURE_PATH);
      // A static host may answer a missing file with the app shell, so check the type as well as the status
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
        throw new Error('No recorded response has been captured yet. Use the optional live call, or record one with the capture script.');
      }
      const fixture = (await response.json()) as {
        capturedAt: string;
        request: FollowerRequest;
        response: FollowerAttestation;
      };
      const source: CapturedResponse = {
        mode: 'recorded',
        handle: fixture.request.parameters.userName,
        request: fixture.request,
        attestation: fixture.response,
        receivedAt: fixture.capturedAt,
      };
      setCaptured(source);
      await verify(source, 'original', milestone);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy('');
    }
  }

  async function acceptLiveCapture(capture: LiveCapture) {
    if (milestone === null) return;
    const source: CapturedResponse = { mode: 'live', ...capture };
    setCaptured(source);
    await verify(source, 'original', milestone);
  }

  const solanaAccepted = run?.solana?.accepted ?? false;
  const solanaError = run?.solana?.error ?? null;
  const agrees = run?.solana ? run.browser.error === solanaError : null;
  const followers = run ? parseFollowers(run.attestation.data) : null;

  const receipt = captured && run ? {
    schemaVersion: '1.0',
    type: 'airnodehub.solana-follower-proof',
    source: { listing: TWITTER_AIRNODE.name, url: TWITTER_AIRNODE.url, signer: TWITTER_AIRNODE.address, provenance: TWITTER_AIRNODE.provenance },
    mode: captured.mode,
    request: captured.request,
    attestation: captured.attestation,
    payment: captured.settlement ?? null,
    variant: run.variant,
    submitted: { handle: run.handle, minFollowers: run.minFollowers.toString(), attestation: run.attestation },
    browser: { valid: run.browser.valid, error: run.browser.error, checks: run.browser.checks },
    solana: run.solana && {
      cluster: 'devnet',
      program: PROGRAM_ID,
      simulated: true,
      accepted: run.solana.accepted,
      error: run.solana.error,
      unitsConsumed: run.solana.unitsConsumed,
      transactionBytes: run.solana.bytes,
      recordAccount: run.solana.record,
      logs: run.solana.logs,
    },
  } : null;

  return (
    <ProjectDetailFrame
      title="Follower Proof on Solana"
      tagline="Check a signed X follower count inside a Solana program, and watch it refuse every tampered copy."
      problem="Solana programs cannot call an API, and a follower count pasted into a transaction proves nothing about where it came from."
      outcome="A TwitterAPI.io response signed by its Airnode is verified by a Solana program on devnet: exact request, pinned signer, low-s signature, freshness and milestone, with each signed response recordable only once."
      boundary="TwitterAPI.io relays X data it does not own. The signature proves what that Airnode returned and when, not that X or the account owner vouches for the count."
      prompt={{
        path: '/prompts/solana-follower-proof.md',
        title: 'Ask an agent to prove a follower count on Solana.',
        description: 'This prompt fetches a signed follower count, verifies it locally, and checks it against the devnet program without committing anything.',
      }}
    >
      <section className="live-demo-heading" id="live-demo" aria-labelledby="sfp-demo-title">
        <h2 id="sfp-demo-title">Verify a follower count on Solana devnet</h2>
        <p>
          Get a signed count, check it in your browser, then run the real program on Solana devnet. Devnet runs it as a
          simulation, so no Solana wallet or SOL is needed and nothing is written.
        </p>
      </section>

      <section className="demo-workbench sfp-workbench">
        <div className="workbench-toolbar sfp-toolbar">
          <div>
            <strong>1. Get a signed follower count</strong>
            <span>{mode === 'recorded' ? 'A real response captured earlier · free' : 'Optional live call · $0.01 test aUSD on Base Sepolia'}</span>
          </div>
          <div className="sfp-mode" role="radiogroup" aria-label="Response source">
            {(['recorded', 'live'] as const).map((option) => (
              <button
                aria-checked={mode === option}
                className={mode === option ? 'is-selected' : ''}
                disabled={busy !== ''}
                key={option}
                onClick={() => setMode(option)}
                role="radio"
                type="button"
              >
                {option === 'recorded' ? 'Recorded' : 'Live (optional, paid)'}
              </button>
            ))}
          </div>
        </div>

        <div className="sfp-inputs">
          <label>
            <span>Milestone (followers)</span>
            <input
              aria-invalid={milestone === null}
              inputMode="numeric"
              onChange={(event) => setMilestoneInput(event.target.value.trim())}
              value={milestoneInput}
            />
            {milestone === null && <small>Enter a whole number.</small>}
          </label>

          {mode === 'recorded' ? (
            <div className="sfp-actions">
              <button className="workbench-run" disabled={busy !== '' || milestone === null} onClick={loadRecorded} type="button">
                {busy === 'fetch' ? 'Loading…' : 'Load recorded response'}
              </button>
              <small>A genuine signed response saved in the repo. Once it is more than {MAX_AGE_SECONDS / 60} minutes old, the program rejects it as stale; the signature and tamper checks still run.</small>
            </div>
          ) : (
            <Suspense fallback={<div className="sfp-actions"><small>Loading the payment module…</small></div>}>
              <LivePaidCall
                busy={busy !== ''}
                milestoneReady={milestone !== null}
                onBusy={setBusy}
                onCaptured={acceptLiveCapture}
                onError={setError}
              />
            </Suspense>
          )}
        </div>

        {error && <div className="workbench-error" role="alert"><strong>Request stopped</strong><span>{error}</span></div>}

        {!captured && !error && busy !== 'fetch' && (
          <div className="workbench-empty">
            <span className="empty-glyph">◎</span>
            <strong>No signed count yet</strong>
            <p>Load the recorded response for free. The optional Live mode shows how to pay $0.01 in test aUSD for a fresh one.</p>
          </div>
        )}

        {captured && run && (
          <div className="sfp-result">
            <div className="sfp-subject">
              <div>
                <span>@{run.handle} · {run.variant === 'original' ? (captured.mode === 'live' ? 'live response' : 'recorded response') : 'tampered copy'}</span>
                <strong>{formatCount(followers)} followers</strong>
                <small>
                  Signed {new Date(Number(run.attestation.timestamp) * 1000).toLocaleString()} by {TWITTER_AIRNODE.name} · relay-signed ·
                  milestone {formatCount(run.minFollowers)}
                </small>
              </div>
              <code title={run.attestation.data}>{run.attestation.data}</code>
            </div>

            <div className="sfp-columns">
              <section aria-labelledby="sfp-browser-title">
                <h3 id="sfp-browser-title">2. Checked in your browser</h3>
                <p className={run.browser.valid ? 'sfp-verdict is-pass' : 'sfp-verdict is-fail'}>
                  {run.browser.valid ? '✓ Would be accepted' : `× ${run.browser.error}`}
                </p>
                <ol className="sfp-checks">
                  {run.browser.checks.map((check) => (
                    <li className={`is-${check.status}`} key={check.id}>
                      <b aria-hidden="true">{check.status === 'pass' ? '✓' : check.status === 'fail' ? '×' : '·'}</b>
                      <span><strong>{check.label}</strong><small>{check.detail}</small></span>
                    </li>
                  ))}
                </ol>
              </section>

              <section aria-labelledby="sfp-solana-title">
                <h3 id="sfp-solana-title">3. Run by the program on Solana devnet</h3>
                {!run.solana && !run.solanaError && <p className="sfp-verdict">Simulating on devnet…</p>}
                {run.solanaError && (
                  <p className="sfp-verdict is-fail">Devnet did not answer: {run.solanaError}</p>
                )}
                {run.solana && (
                  <>
                    <p className={solanaAccepted ? 'sfp-verdict is-pass' : 'sfp-verdict is-fail'}>
                      {solanaAccepted ? '✓ Program accepted it' : `× Program rejected it: ${solanaError ?? 'unrecognised error'}`}
                    </p>
                    <p className="sfp-explain">{solanaAccepted ? 'The attestation account would be created with this count.' : errorText(solanaError)}</p>
                    <dl className="sfp-facts">
                      <div><dt>Compute units</dt><dd>{run.solana.unitsConsumed?.toLocaleString('en-US') ?? '—'}</dd></div>
                      <div><dt>Transaction size</dt><dd>{run.solana.bytes} of 1,232 bytes</dd></div>
                      <div>
                        <dt>Program</dt>
                        <dd><a href={explorerUrl('address', PROGRAM_ID)} target="_blank" rel="noreferrer">{shortValue(PROGRAM_ID)}</a></dd>
                      </div>
                      <div>
                        <dt>Replay guard account</dt>
                        <dd><a href={explorerUrl('address', run.solana.record)} target="_blank" rel="noreferrer">{shortValue(run.solana.record)}</a></dd>
                      </div>
                    </dl>
                    {agrees === false && (
                      <p className="sfp-explain">
                        The browser and the cluster disagree. This usually means the devnet clock differs from yours near the
                        {' '}{MAX_AGE_SECONDS / 60}-minute limit.
                      </p>
                    )}
                    <details className="json-disclosure">
                      <summary>Program logs</summary>
                      <pre>{run.solana.logs.join('\n')}</pre>
                    </details>
                  </>
                )}
              </section>
            </div>

            <div className="sfp-tamper">
              <div>
                <strong>Try to fool the program</strong>
                <span>Each button changes a copy of the response and runs both checks again. The signed original is kept.</span>
              </div>
              <div className="sfp-tamper-grid">
                {VARIANTS.map((variant) => (
                  <button
                    className={run.variant === variant.id ? 'is-selected' : ''}
                    disabled={busy !== '' || milestone === null}
                    key={variant.id}
                    onClick={() => milestone !== null && verify(captured, variant.id, milestone)}
                    type="button"
                  >
                    <strong>{variant.label}</strong>
                    <small>{variant.detail}</small>
                    <code>Expect {variant.expected}</code>
                  </button>
                ))}
                {run.variant !== 'original' && (
                  <button disabled={busy !== '' || milestone === null} onClick={() => milestone !== null && verify(captured, 'original', milestone)} type="button">
                    <strong>Restore the signed original</strong>
                    <small>Run the untouched response again.</small>
                  </button>
                )}
              </div>
            </div>

            {captured.settlement?.transaction && (
              <p className="sfp-explain sfp-payment">
                Paid $0.01 aUSD ·{' '}
                <a href={`https://sepolia.basescan.org/tx/${captured.settlement.transaction}`} target="_blank" rel="noreferrer">
                  settlement on Base Sepolia
                </a>
              </p>
            )}

            {receipt && (
              <div className="evidence-export">
                <div>
                  <strong>Portable proof record</strong>
                  <span>The request, the signed response, the browser checks and the devnet program result.</span>
                </div>
                <button onClick={() => downloadJson('solana-follower-proof.json', receipt)} type="button">Download record</button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="live-demo-heading sfp-how" aria-labelledby="sfp-how-title">
        <h2 id="sfp-how-title">What the program checks</h2>
        <ol>
          <li><strong>The exact request.</strong> It rebuilds the request hash from the handle, so a response for any other account or query cannot pass.</li>
          <li><strong>The signed bytes.</strong> It reads the count from <code>{'{"followers":N}'}</code>, the projection requested as <code>{JSON.stringify(followerRequest('handle').responseProjection)}</code>.</li>
          <li><strong>The signer.</strong> <code>secp256k1_recover</code> must return the pinned Airnode address <code>{TWITTER_AIRNODE.address}</code>, after refusing high-s signatures that the syscall would otherwise accept.</li>
          <li><strong>Freshness.</strong> The signed time must be within {MAX_AGE_SECONDS / 60} minutes of the cluster clock.</li>
          <li><strong>One use.</strong> Each signed response creates one account derived from its digest. Submitting it again fails because that account exists.</li>
        </ol>
      </section>
    </ProjectDetailFrame>
  );
}
