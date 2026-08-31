import {
  PRICE_CATALOG,
  supplementPriceCandidates,
  supportsCatalogFallback,
} from './catalog';
import { normalizePrice } from './normalize';
import { DEFAULT_POLICY, evaluateCandidates } from './policy';
import type {
  Address,
  AirnodeDocument,
  Attestation,
  Candidate,
  CandidateDecision,
  DiscoveryMode,
  Receipt,
  Resolution,
  TraceEvent,
  TrustedFetchOptions,
  TrustedFetchResult,
  TrustPolicy,
} from './types';
import { TrustedFetchError } from './types';
import { verifyAttestation } from './verify';

const RESOLVER_URL = 'https://airnodehub.api3.org/resolve';
const RESOLVER_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 30_000;

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

async function fetchJson<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : `Request failed with HTTP ${response.status}.`;
      throw new HttpError(response.status, message);
    }

    return body as T;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function emit(
  callback: TrustedFetchOptions['onTrace'],
  stage: TraceEvent['stage'],
  label: string,
  detail: string,
  status: TraceEvent['status'],
) {
  callback?.({ stage, label, detail, status });
}

async function discover(
  intent: string,
  fetcher: typeof fetch,
  onTrace: TrustedFetchOptions['onTrace'],
): Promise<{
  candidates: Candidate[];
  mode: DiscoveryMode;
  attempts: number;
  resolverError?: string;
}> {
  let resolverError = '';

  for (let attempt = 1; attempt <= RESOLVER_ATTEMPTS; attempt += 1) {
    emit(
      onTrace,
      'discover',
      `Resolver attempt ${attempt}/${RESOLVER_ATTEMPTS}`,
      'Matching the intent to live Airnode operations.',
      'running',
    );

    try {
      const resolution = await fetchJson<Resolution>(fetcher, RESOLVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent }),
      });

      if (!Array.isArray(resolution.candidates)) {
        throw new Error('The resolver returned an invalid candidate list.');
      }
      if (resolution.candidates.length === 0) {
        throw new TrustedFetchError(
          'UNSUPPORTED_INTENT',
          'No live AirnodeHub listing matched this intent.',
        );
      }

      const resolved: Candidate[] = resolution.candidates.map((candidate) => ({
        ...candidate,
        origin: 'resolver',
      }));
      const candidates = supportsCatalogFallback(intent)
        ? supplementPriceCandidates(resolved)
        : resolved;
      const addedCount = candidates.length - resolved.length;

      emit(
        onTrace,
        'discover',
        addedCount
          ? `${resolved.length} discovered, ${addedCount} added by the demo`
          : `${resolved.length} candidates discovered`,
        addedCount
          ? 'The resolver returned the discovered sources. The demo added its own known ETH/USD sources so the trust policy can rank them, and marks them separately.'
          : 'Parameters, provenance, signer, and payment requirements came from the resolver.',
        'success',
      );
      return {
        candidates,
        mode: addedCount ? 'resolver+catalog' : 'resolver',
        attempts: attempt,
      };
    } catch (error) {
      if (error instanceof TrustedFetchError) throw error;
      resolverError = error instanceof Error ? error.message : String(error);
      const retryable = !(error instanceof HttpError) || error.status === 503;
      if (!retryable) {
        throw new TrustedFetchError(
          'RESOLVER_UNAVAILABLE',
          `Resolver rejected the request: ${resolverError}`,
        );
      }

      emit(
        onTrace,
        'discover',
        'Resolver temporarily unavailable',
        attempt < RESOLVER_ATTEMPTS
          ? 'The 503 response is retryable; the agent will try once more.'
          : 'The bounded retry budget is exhausted.',
        'warning',
      );

      if (attempt < RESOLVER_ATTEMPTS) {
        await sleep(500 * attempt);
      }
    }
  }

  if (!supportsCatalogFallback(intent)) {
    throw new TrustedFetchError(
      'RESOLVER_UNAVAILABLE',
      'The resolver is unavailable and this intent has no pinned demo fallback.',
    );
  }

  emit(
    onTrace,
    'discover',
    'Pinned price catalog activated',
    'Degraded mode is explicit: each live Airnode contract will still be inspected before use.',
    'warning',
  );
  return {
    candidates: PRICE_CATALOG,
    mode: 'catalog-fallback',
    attempts: RESOLVER_ATTEMPTS,
    resolverError,
  };
}

function documentSupportsOperation(
  document: AirnodeDocument,
  operation: string,
): boolean {
  const variants =
    document.paths?.['/']?.post?.requestBody?.content?.['application/json']
      ?.schema?.oneOf ?? [];
  return variants.some(
    (variant) => variant.properties?.operation?.const === operation,
  );
}

function parseAttestation(value: unknown): Attestation {
  if (!value || typeof value !== 'object') {
    throw new Error('The Airnode returned a non-object response.');
  }
  const response = value as Record<string, unknown>;
  for (const key of [
    'airnode',
    'requestHash',
    'timestamp',
    'data',
    'signature',
  ]) {
    if (!(key in response)) {
      throw new Error(`The Airnode response is missing ${key}.`);
    }
  }
  if (
    typeof response.airnode !== 'string' ||
    typeof response.requestHash !== 'string' ||
    typeof response.timestamp !== 'string' ||
    typeof response.signature !== 'string'
  ) {
    throw new Error('The Airnode returned malformed attestation fields.');
  }

  return response as unknown as Attestation;
}

function updateDecision(
  decisions: CandidateDecision[],
  candidate: Candidate,
  status: CandidateDecision['status'],
  reason: string,
): CandidateDecision[] {
  return decisions.map((decision) =>
    decision.candidate.listing === candidate.listing &&
    decision.candidate.operation === candidate.operation
      ? { ...decision, status, reason }
      : decision,
  );
}

export async function trustedFetch({
  intent,
  policy: policyOverrides,
  onTrace,
  fetcher = fetch,
  now = Date.now,
}: TrustedFetchOptions): Promise<TrustedFetchResult> {
  const normalizedIntent = intent.trim();
  if (!normalizedIntent) {
    throw new TrustedFetchError(
      'UNSUPPORTED_INTENT',
      'Give the agent a non-empty intent.',
    );
  }

  const policy: TrustPolicy = { ...DEFAULT_POLICY, ...policyOverrides };
  const discovery = await discover(normalizedIntent, fetcher, onTrace);
  const evaluation = evaluateCandidates(discovery.candidates, policy);
  let decisions = evaluation.decisions;

  if (evaluation.ordered.length === 0) {
    throw new TrustedFetchError(
      'POLICY_NO_MATCH',
      'No candidate satisfies the current trust and payment policy.',
      decisions,
    );
  }

  emit(
    onTrace,
    'evaluate',
    `${evaluation.ordered[0].listing} ranked first`,
    policy.preferFirstParty
      ? 'First-party provenance is preferred; paid calls are evaluated against policy.'
      : 'Eligible candidates are ranked deterministically by payment status and listing name.',
    'success',
  );

  let sawPaymentRequired = false;
  let sawVerificationFailure = false;

  for (const candidate of evaluation.ordered) {
    try {
      emit(
        onTrace,
        'inspect',
        `Inspecting ${candidate.listing}`,
        'Reading the live OpenAPI contract and expected signer over HTTPS.',
        'running',
      );
      const document = await fetchJson<AirnodeDocument>(
        fetcher,
        candidate.airnode,
      );
      const documentSigner = document['x-airnode']?.address;
      if (!documentSigner) {
        throw new Error('The live document does not advertise an Airnode signer.');
      }
      if (documentSigner.toLowerCase() !== candidate.address.toLowerCase()) {
        throw new Error('Resolver signer and live document signer do not match.');
      }
      if (!documentSupportsOperation(document, candidate.operation)) {
        throw new Error(
          `The live document no longer serves ${candidate.operation}.`,
        );
      }
      if (document['x-airnode']?.payment && !policy.allowPaidCalls) {
        sawPaymentRequired = true;
        throw new HttpError(402, 'The live document now requires payment.');
      }
      emit(
        onTrace,
        'inspect',
        'Live contract matched',
        `Signer ${documentSigner.slice(0, 8)}…${documentSigner.slice(-6)} and operation ${candidate.operation} are current.`,
        'success',
      );

      emit(
        onTrace,
        'call',
        `Calling ${candidate.listing}.${candidate.operation}`,
        'The operation is called directly on the Airnode, not through the Hub.',
        'running',
      );
      const response = await fetchJson<unknown>(fetcher, candidate.airnode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: candidate.operation,
          parameters: candidate.example,
        }),
      });
      const attestation = parseAttestation(response);
      emit(
        onTrace,
        'call',
        'Signed response received',
        'Data, request hash, signing time, signer, and signature arrived together.',
        'success',
      );

      emit(
        onTrace,
        'verify',
        'Verifying locally',
        'Recomputing the request hash and recovering the EIP-191 signer in this browser.',
        'running',
      );
      const nowMilliseconds = now();
      const verification = await verifyAttestation({
        operation: candidate.operation,
        parameters: candidate.example,
        attestation,
        expectedSigner: candidate.address,
        documentSigner: documentSigner as Address,
        maxAgeSeconds: policy.maxAttestationAgeSeconds,
        nowSeconds: nowMilliseconds / 1000,
      });
      if (!verification.valid) {
        sawVerificationFailure = true;
        decisions = updateDecision(
          decisions,
          candidate,
          'failed',
          verification.issues.join(' '),
        );
        emit(
          onTrace,
          'verify',
          `${candidate.listing} failed verification`,
          verification.issues.join(' '),
          'error',
        );
        continue;
      }

      const normalized = normalizePrice(
        candidate,
        attestation,
        nowMilliseconds,
      );
      decisions = updateDecision(
        decisions,
        candidate,
        'selected',
        `${candidate.attestation} provenance selected; all local checks passed.`,
      );
      emit(
        onTrace,
        'verify',
        'Receipt verified',
        `All local checks passed. Signed ${verification.ageSeconds}s ago.`,
        'success',
      );

      const receipt: Receipt = {
        schemaVersion: '1.0',
        intent: normalizedIntent,
        createdAt: new Date(nowMilliseconds).toISOString(),
        policy,
        discovery: {
          mode: discovery.mode,
          resolverAttempts: discovery.attempts,
          ...(discovery.resolverError
            ? { resolverError: discovery.resolverError }
            : {}),
        },
        decisions,
        selected: {
          candidate,
          documentUrl: candidate.airnode,
          documentSigner: documentSigner as Address,
        },
        request: {
          operation: candidate.operation,
          parameters: candidate.example,
        },
        attestation,
        normalized,
        verification,
      };

      return {
        data: attestation.data,
        normalized,
        trust: {
          ...verification,
          provenance: candidate.attestation,
          signer: candidate.address,
        },
        decision: {
          selected: candidate,
          decisions,
          discoveryMode: discovery.mode,
        },
        receipt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof HttpError && error.status === 402) {
        sawPaymentRequired = true;
      }
      decisions = updateDecision(
        decisions,
        candidate,
        'failed',
        message,
      );
      emit(
        onTrace,
        'call',
        `${candidate.listing} skipped`,
        `${message} Trying the next eligible candidate.`,
        'warning',
      );
    }
  }

  if (sawVerificationFailure) {
    throw new TrustedFetchError(
      'VERIFICATION_FAILED',
      'Every returned response failed local verification or freshness policy.',
      decisions,
    );
  }
  if (sawPaymentRequired) {
    throw new TrustedFetchError(
      'PAYMENT_REQUIRED',
      'The available operations require payment, and automatic spending is disabled.',
      decisions,
    );
  }
  throw new TrustedFetchError(
    'AIRNODE_UNAVAILABLE',
    'No eligible Airnode completed the request.',
    decisions,
  );
}
