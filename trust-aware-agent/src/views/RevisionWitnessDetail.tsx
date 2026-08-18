import { useMemo, useState } from 'react';
import { LiveCallLoading, ProjectDetailFrame, VerificationStamp } from '../components/ProjectDetailFrame';
import { callVerifiedListing, downloadJson } from '../lib';
import type { ListingCallSpec, VerifiedCall } from '../lib';
import { diffJson } from '../lib/useCases';

const STORAGE_KEY = 'airnodehub-community.revision-witness.v1';

const WIKIDATA_SPEC: ListingCallSpec = {
  id: 'wikidata',
  name: 'Wikidata',
  url: 'https://airnode-wikidata.fly.dev/',
  operation: 'getItemStatements',
  address: '0x9262c0d8cb7d5ccb708ffeA4893103aCb3c273E2',
  provenance: 'third-party',
  parameters: { item_id: 'Q64', property: 'P1082' },
};

interface WikidataStatementData {
  P1082?: Array<{
    id?: string;
    rank?: string;
    qualifiers?: Array<{
      property?: { id?: string };
      value?: { content?: { time?: string } };
    }>;
    value?: { content?: { amount?: string } };
  }>;
}

interface PopulationSummary {
  latestPopulation: number | null;
  asOf: string;
  statementCount: number;
  latestStatementId: string;
}

interface RevisionSnapshot {
  call: VerifiedCall<WikidataStatementData>;
  summary: PopulationSummary;
}

function summarizePopulation(data: WikidataStatementData): PopulationSummary {
  const statements = data.P1082 ?? [];
  const dated = statements.flatMap((statement) => {
    const time = statement.qualifiers?.find(
      (qualifier) => qualifier.property?.id === 'P585',
    )?.value?.content?.time;
    const amount = Number(statement.value?.content?.amount);
    if (!time || !Number.isFinite(amount)) return [];
    return [{ time, amount, id: statement.id ?? 'unknown' }];
  }).sort((left, right) => left.time.localeCompare(right.time));
  const latest = dated.at(-1);

  return {
    latestPopulation: latest?.amount ?? null,
    asOf: latest?.time.replace(/^\+/, '').slice(0, 10) ?? 'Unknown',
    statementCount: statements.length,
    latestStatementId: latest?.id ?? 'Unknown',
  };
}

function loadSnapshots(): RevisionSnapshot[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.slice(-6) as RevisionSnapshot[] : [];
  } catch {
    return [];
  }
}

export function RevisionWitnessDetail() {
  const [snapshots, setSnapshots] = useState<RevisionSnapshot[]>(loadSnapshots);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const latest = snapshots.at(-1) ?? null;
  const previous = snapshots.at(-2) ?? null;
  const changes = useMemo(
    () => previous && latest ? diffJson(previous.summary, latest.summary, 'population') : [],
    [latest, previous],
  );

  async function captureSnapshot() {
    setRunning(true);
    setError('');
    try {
      const call = await callVerifiedListing<WikidataStatementData>(WIKIDATA_SPEC);
      const next = [
        ...snapshots,
        { call, summary: summarizePopulation(call.attestation.data) },
      ].slice(-6);
      setSnapshots(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  }

  function clearSnapshots() {
    setSnapshots([]);
    localStorage.removeItem(STORAGE_KEY);
    setError('');
  }

  const witnessBundle = latest ? {
    schemaVersion: '1.0',
    type: 'airnodehub.revision-witness',
    subject: { item: 'Q64', property: 'P1082', label: 'Berlin population' },
    snapshots,
    latestDiff: changes,
  } : null;

  return (
    <ProjectDetailFrame
      title="Verified Change Tracker"
      tagline="Compare the same API response over time and keep signed evidence of what changed."
      category="Data history"
      listings="Wikidata"
      runtime="Browser-only"
      repoPath="use-cases/revision-witness/README.md"
      problem="Changing APIs usually expose only the current value, so applications lose proof of what the source returned before."
      outcome="The first verified response becomes the before state. Every later response becomes an auditable after state with a field-level diff."
      boundary="A relay attestation proves what was returned at capture time; it does not certify Wikidata as correct."
      prompt={{
        path: '/prompts/revision-witness.md',
        title: 'Ask an agent to preserve a signed before-and-after record.',
        description: 'This prompt repeats one Wikidata request over time and reports changes only from locally verified snapshots.',
      }}
    >
      <section className="live-demo-heading" id="live-demo" aria-labelledby="revision-demo-title">
        <h2 id="revision-demo-title">Track a live Wikidata record</h2>
        <p>The API returns Berlin population statements. Capture the identical request again later to prove whether its response changed.</p>
      </section>

      <section className="demo-workbench revision-workbench" aria-live="polite">
        <div className="workbench-toolbar">
          <div><strong>Snapshot history</strong><span>{snapshots.length} accepted · stored only in this browser</span></div>
          {snapshots.length > 0 && <button className="toolbar-text-action" onClick={clearSnapshots} type="button">Clear local history</button>}
          <button className="workbench-run" disabled={running} onClick={captureSnapshot} type="button">
            {running ? 'Verifying snapshot…' : snapshots.length ? 'Capture next snapshot' : 'Capture first snapshot'}
          </button>
        </div>

        {running && (
          <LiveCallLoading
            title="Capturing a signed Wikidata snapshot"
            detail="The exact Q64 / P1082 request is being repeated. It enters the timeline only if the live contract and signature match."
            sources={['Wikidata']}
          />
        )}

        {!running && !latest && !error && (
          <div className="workbench-empty">
            <span className="empty-glyph">◷</span>
            <strong>Capture the signed “before” state</strong>
            <p>This first live response becomes the baseline. A later call becomes the “after” state, using the exact same request.</p>
          </div>
        )}
        {error && <div className="workbench-error"><strong>Snapshot rejected</strong><span>{error}</span></div>}

        {latest && (
          <div id="evidence">
            <section className="witness-chain" aria-label="Signed snapshot continuity">
              <article className="witness-node">
                <span>{previous ? 'Previous snapshot' : 'Baseline snapshot'}</span>
                <strong>{(previous ?? latest).summary.latestPopulation?.toLocaleString('en-US') ?? 'Unknown'}</strong>
                <small>Signed {new Date((previous ?? latest).call.receivedAt).toLocaleTimeString()}</small>
                <code>{(previous ?? latest).call.attestation.signature.slice(0, 14)}…</code>
              </article>
              <div className={`witness-link ${previous ? 'is-linked' : ''}`}>
                <i aria-hidden="true"><b /></i>
                <span><strong>{previous ? 'Same request' : 'Waiting for next capture'}</strong><small>{latest.call.attestation.requestHash.slice(0, 12)}…</small></span>
              </div>
              {previous ? (
                <article className="witness-node is-latest">
                  <span>Latest snapshot</span>
                  <strong>{latest.summary.latestPopulation?.toLocaleString('en-US') ?? 'Unknown'}</strong>
                  <small>Signed {new Date(latest.call.receivedAt).toLocaleTimeString()}</small>
                  <code>{latest.call.attestation.signature.slice(0, 14)}…</code>
                </article>
              ) : (
                <article className="witness-node is-empty">
                  <span>Next snapshot</span>
                  <strong>Not captured</strong>
                  <small>Repeat the identical request later.</small>
                </article>
              )}
            </section>

            <div className="revision-summary">
              <div className="revision-current">
                <span>Latest accepted value</span>
                <strong>{latest.summary.latestPopulation?.toLocaleString('en-US') ?? 'Unknown'}</strong>
                <p>Berlin population, statement dated {latest.summary.asOf}</p>
                <VerificationStamp ageSeconds={latest.call.verification.ageSeconds} provenance="third-party" />
              </div>
              <div className={`revision-diff-state ${changes.length ? 'has-changes' : ''}`}>
                <i>{previous ? changes.length ? '↗' : '＝' : '1'}</i>
                <span>
                  <strong>{!previous ? '“Before” state recorded' : changes.length ? `${changes.length} fields changed` : 'The API response is unchanged'}</strong>
                  <small>{!previous ? 'Capture again later to add the “after” state.' : 'Compared using both complete, verified API responses.'}</small>
                </span>
              </div>
            </div>
          </div>
        )}

        {changes.length > 0 && (
          <div className="diff-table">
            <div><span>Field</span><span>Before</span><span>After</span></div>
            {changes.map((change) => (
              <article key={change.path}>
                <code>{change.path}</code>
                <span>{String(change.before)}</span>
                <strong>{String(change.after)}</strong>
              </article>
            ))}
          </div>
        )}

        {snapshots.length > 0 && (
          <div className="snapshot-timeline">
            {[...snapshots].reverse().map((snapshot, reverseIndex) => (
              <article key={`${snapshot.call.attestation.requestHash}-${snapshot.call.attestation.timestamp}`}>
                <i aria-hidden="true" />
                <div>
                  <span>{reverseIndex === 0 ? 'Latest' : `Snapshot ${snapshots.length - reverseIndex}`}</span>
                  <strong>{snapshot.summary.latestPopulation?.toLocaleString('en-US') ?? 'Unknown'}</strong>
                  <small>Captured {new Date(snapshot.call.receivedAt).toLocaleString()} · {snapshot.summary.statementCount} statements</small>
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
            <div><strong>Portable change record</strong><span>The identical request, both signed responses, and their field-level diff.</span></div>
            <button onClick={() => downloadJson('verified-change-record.json', witnessBundle)} type="button">Download record</button>
          </div>
        )}
      </section>
    </ProjectDetailFrame>
  );
}
