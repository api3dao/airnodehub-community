import { verifyAttestation } from './verify';
import type {
  Address,
  AirnodeDocument,
  Attestation,
  VerificationResult,
} from './types';

export interface ListingCallSpec {
  id: string;
  name: string;
  url: string;
  operation: string;
  address: Address;
  provenance: 'first-party' | 'third-party';
  parameters: Record<string, unknown>;
}

export interface VerifiedCall<T = unknown> {
  spec: ListingCallSpec;
  attestation: Attestation<T>;
  documentSigner: Address;
  verification: VerificationResult;
  receivedAt: string;
}

async function readJson<T>(response: Response): Promise<T> {
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
    throw new Error(message);
  }

  return body as T;
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

function parseAttestation<T>(value: unknown): Attestation<T> {
  if (!value || typeof value !== 'object') {
    throw new Error('The Airnode returned a non-object response.');
  }

  const response = value as Record<string, unknown>;
  const required = ['airnode', 'requestHash', 'timestamp', 'data', 'signature'];
  const missing = required.find((key) => !(key in response));
  if (missing) {
    throw new Error(`The Airnode response is missing ${missing}.`);
  }

  return response as unknown as Attestation<T>;
}

export async function callVerifiedListing<T = unknown>(
  spec: ListingCallSpec,
  options: {
    fetcher?: typeof fetch;
    maxAgeSeconds?: number;
    now?: () => number;
  } = {},
): Promise<VerifiedCall<T>> {
  const {
    fetcher = fetch,
    maxAgeSeconds = 300,
    now = Date.now,
  } = options;

  const document = await readJson<AirnodeDocument>(await fetcher(spec.url));
  const documentSigner = document['x-airnode']?.address;
  if (!documentSigner) {
    throw new Error('The live document does not advertise a signer.');
  }
  if (documentSigner.toLowerCase() !== spec.address.toLowerCase()) {
    throw new Error('The live document advertises a different signer.');
  }
  if (!documentSupportsOperation(document, spec.operation)) {
    throw new Error(`The live document no longer serves ${spec.operation}.`);
  }
  if (document['x-airnode']?.payment) {
    throw new Error('This operation now requires payment; automatic spending is disabled.');
  }

  const attestation = parseAttestation<T>(
    await readJson<unknown>(
      await fetcher(spec.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: spec.operation,
          parameters: spec.parameters,
        }),
      }),
    ),
  );
  const receivedAtMilliseconds = now();
  const verification = await verifyAttestation({
    operation: spec.operation,
    parameters: spec.parameters,
    attestation,
    expectedSigner: spec.address,
    documentSigner,
    maxAgeSeconds,
    nowSeconds: receivedAtMilliseconds / 1000,
  });

  if (!verification.valid) {
    throw new Error(verification.issues.join(' '));
  }

  return {
    spec,
    attestation,
    documentSigner,
    verification,
    receivedAt: new Date(receivedAtMilliseconds).toISOString(),
  };
}

export function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
