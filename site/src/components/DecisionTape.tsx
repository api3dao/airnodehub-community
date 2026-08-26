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
  blocked = false,
}: {
  trace: TraceEvent[];
  running: boolean;
  blocked?: boolean;
}) {
  const latest = trace.at(-1);
  const traceCompleted = trace.some(
    (event) => event.stage === 'verify' && event.status === 'success',
  );
  const failed = blocked || trace.some((event) => event.status === 'error');
  const released = traceCompleted && !failed;
  const warning = trace.some((event) => event.status === 'warning');
  const current = runningCopy(latest);
  const gateState = failed ? 'blocked' : released ? 'open' : 'locked';

  return (
    <section className="progress-card" aria-label="Agent progress" aria-live="polite">
      <div className="progress-copy">
        <span
          className={`progress-orb ${running ? 'is-live' : ''} ${failed ? 'is-failed' : ''}`}
          aria-hidden="true"
        >
          {failed ? '×' : released ? '✓' : running ? '' : warning ? '!' : '·'}
        </span>
        <div>
          <strong>
            {running
              ? current.title
              : blocked
                ? 'The verification gate blocked this price'
                : failed
                ? 'The price was not given to your agent'
                : released
                  ? 'The price passed every check'
                  : warning
                    ? 'The demo used its known source list'
                    : 'Preparing the live check'}
          </strong>
          <small>
            {running
              ? current.detail
              : blocked
                ? 'The changed value was not released to the agent.'
                : released
                  ? 'The verified value is now available to the agent.'
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
          <i aria-hidden="true">{failed ? '×' : released ? '✓' : ''}</i>
          <span><strong>Verification gate</strong><small>{failed ? 'Blocked invalid input' : released ? 'Released verified input' : 'Locked until checks pass'}</small></span>
        </div>
        <div className="gate-rail gate-rail--output" aria-hidden="true"><i /></div>
        <div className="gate-agent">
          <i aria-hidden="true">A</i>
          <span><strong>AI agent</strong><small>{released ? 'Input available' : failed ? 'Input blocked' : 'No input yet'}</small></span>
        </div>
      </div>

      <ol className="progress-path">
        {STAGES.map((stage) => {
          const events = trace.filter((event) => event.stage === stage.key);
          const status = blocked && stage.key === 'verify'
            ? 'error'
            : events.at(-1)?.status ?? 'idle';
          const label = stage.key === 'discover' && status === 'warning'
            ? 'Use known sources'
            : stage.label;
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
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
