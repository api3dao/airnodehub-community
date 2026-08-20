import type { TraceEvent } from '../lib';

const STAGES: Array<{
  key: TraceEvent['stage'];
  label: string;
}> = [
  { key: 'discover', label: 'Find sources' },
  { key: 'evaluate', label: 'Pick one' },
  { key: 'inspect', label: 'Check source' },
  { key: 'call', label: 'Get price' },
  { key: 'verify', label: 'Check signature' },
];

function runningCopy(event?: TraceEvent): { title: string; detail: string } {
  if (!event) {
    return {
      title: 'Starting the live check…',
      detail: 'Your agent receives nothing until every check passes.',
    };
  }

  if (event.stage === 'discover' && event.status === 'warning') {
    return {
      title: 'The live matcher is busy',
      detail: 'Trying the demo’s known ETH price sources instead.',
    };
  }

  const copy: Record<TraceEvent['stage'], { title: string; detail: string }> = {
    discover: {
      title: 'Finding ETH price sources…',
      detail: 'AirnodeHub is matching the agent’s question to live APIs.',
    },
    evaluate: {
      title: 'Choosing the strongest source…',
      detail: 'Available sources are compared using the settings above.',
    },
    inspect: {
      title: 'Confirming who will send the price…',
      detail: 'The source’s published identity and API action are checked.',
    },
    call: {
      title: 'Getting the signed ETH price…',
      detail: 'The chosen source is returning a price plus its signature.',
    },
    verify: {
      title: 'Checking the signature…',
      detail: 'Your browser is confirming that the response was not changed.',
    },
  };

  return copy[event.stage];
}

export function DecisionTape({
  trace,
  running,
}: {
  trace: TraceEvent[];
  running: boolean;
}) {
  const latest = trace.at(-1);
  const completed = trace.some(
    (event) => event.stage === 'verify' && event.status === 'success',
  );
  const failed = trace.some((event) => event.status === 'error');
  const warning = trace.some((event) => event.status === 'warning');
  const current = runningCopy(latest);
  const gateState = failed ? 'blocked' : completed ? 'open' : 'locked';

  return (
    <section className="progress-card" aria-label="Agent progress" aria-live="polite">
      <div className="progress-copy">
        <span className={`progress-orb ${running ? 'is-live' : ''}`} aria-hidden="true">
          {failed ? '×' : completed ? '✓' : running ? '' : warning ? '!' : '·'}
        </span>
        <div>
          <strong>
            {running
              ? current.title
              : failed
                ? 'The price was not given to your agent'
                : completed
                  ? 'The price passed every check'
                  : warning
                    ? 'The demo used its known source list'
                    : 'Preparing the live check'}
          </strong>
          <small>
            {running
              ? current.detail
              : 'Your agent receives nothing until every check passes.'}
          </small>
        </div>
      </div>

      <div className={`agent-decision-gate agent-decision-gate--${gateState}`}>
        <div className="gate-payload">
          <i aria-hidden="true" />
          <span><strong>External data</strong><small>Value + signed receipt</small></span>
        </div>
        <div className="gate-rail" aria-hidden="true"><i /></div>
        <div className="gate-core">
          <i aria-hidden="true">{failed ? '×' : completed ? '✓' : ''}</i>
          <span><strong>Verification gate</strong><small>{failed ? 'Blocked invalid input' : completed ? 'Released verified input' : 'Locked until checks pass'}</small></span>
        </div>
        <div className="gate-rail gate-rail--output" aria-hidden="true"><i /></div>
        <div className="gate-agent">
          <i aria-hidden="true">A</i>
          <span><strong>AI agent</strong><small>{completed ? 'Input available' : 'No input yet'}</small></span>
        </div>
      </div>

      <ol className="progress-path">
        {STAGES.map((stage) => {
          const events = trace.filter((event) => event.stage === stage.key);
          const status = events.at(-1)?.status ?? 'idle';
          return (
            <li className={`progress-step progress-step--${status}`} key={stage.key}>
              <i aria-hidden="true">
                {status === 'success'
                  ? '✓'
                  : status === 'warning'
                    ? '!'
                    : status === 'error'
                      ? '×'
                      : ''}
              </i>
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
