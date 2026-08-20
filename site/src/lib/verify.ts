import {
  encodePacked,
  keccak256,
  stringToHex,
  verifyMessage,
} from 'viem';
import { normalizePrice } from './normalize';
import type {
  Address,
  Attestation,
  Receipt,
  VerificationResult,
} from './types';

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]);
  }

  return value;
}

export function computeRequestHash(
  operation: string,
  parameters: Record<string, unknown>,
) {
  return keccak256(
    stringToHex(JSON.stringify([operation, canonicalize(parameters)])),
  );
}

function sameAddress(left: string | undefined, right: string): boolean {
  return left?.toLowerCase() === right.toLowerCase();
}

export async function verifyAttestation({
  operation,
  parameters,
  attestation,
  expectedSigner,
  documentSigner,
  maxAgeSeconds,
  nowSeconds = Date.now() / 1000,
}: {
  operation: string;
  parameters: Record<string, unknown>;
  attestation: Attestation;
  expectedSigner: Address;
  documentSigner: Address;
  maxAgeSeconds: number;
  nowSeconds?: number;
}): Promise<VerificationResult> {
  const expectedRequestHash = computeRequestHash(operation, parameters);
  const requestHash =
    expectedRequestHash.toLowerCase() === attestation.requestHash.toLowerCase();
  const responseSigner = sameAddress(attestation.airnode, expectedSigner);
  const documentSignerMatches = sameAddress(documentSigner, expectedSigner);
  const timestamp = Number(attestation.timestamp);
  const ageSeconds = nowSeconds - timestamp;
  const timestampNotFuture =
    Number.isFinite(timestamp) && ageSeconds >= -5;
  const fresh =
    timestampNotFuture && ageSeconds <= Math.max(0, maxAgeSeconds);

  const serializedData =
    typeof attestation.data === 'string'
      ? attestation.data
      : JSON.stringify(attestation.data);

  let signature = false;
  try {
    if (typeof serializedData === 'string' && /^\d+$/.test(attestation.timestamp)) {
      const digest = keccak256(
        encodePacked(
          ['bytes32', 'uint256', 'bytes'],
          [
            attestation.requestHash,
            BigInt(attestation.timestamp),
            stringToHex(serializedData),
          ],
        ),
      );
      signature = await verifyMessage({
        address: expectedSigner,
        message: { raw: digest },
        signature: attestation.signature,
      });
    }
  } catch {
    signature = false;
  }

  const checks = {
    requestHash,
    responseSigner,
    documentSigner: documentSignerMatches,
    signature,
    fresh,
    timestampNotFuture,
    normalizedData: true,
  };
  const issues = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => {
      switch (check) {
        case 'requestHash':
          return 'The response is not bound to the exact request.';
        case 'responseSigner':
          return 'The response signer differs from the selected listing.';
        case 'documentSigner':
          return 'The live Airnode document advertises a different signer.';
        case 'signature':
          return 'The EIP-191 signature does not verify.';
        case 'fresh':
          return 'The signed response is older than policy allows.';
        case 'timestampNotFuture':
          return 'The signed timestamp is unexpectedly in the future.';
        case 'normalizedData':
          return 'The normalized price differs from the signed source data.';
        default:
          return `Verification check failed: ${check}.`;
      }
    });

  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    ageSeconds: Math.round(ageSeconds),
    issues,
  };
}

export async function verifyReceipt(
  receipt: Receipt,
  nowSeconds = Date.now() / 1000,
): Promise<VerificationResult> {
  const verification = await verifyAttestation({
    operation: receipt.request.operation,
    parameters: receipt.request.parameters,
    attestation: receipt.attestation,
    expectedSigner: receipt.selected.candidate.address,
    documentSigner: receipt.selected.documentSigner,
    maxAgeSeconds: receipt.policy.maxAttestationAgeSeconds,
    nowSeconds,
  });
  let normalizedData = false;
  try {
    const normalized = normalizePrice(
      receipt.selected.candidate,
      receipt.attestation,
      nowSeconds * 1000,
    );
    normalizedData =
      normalized.pair === receipt.normalized.pair &&
      normalized.value === receipt.normalized.value &&
      normalized.sourceTimestamp === receipt.normalized.sourceTimestamp;
  } catch {
    normalizedData = false;
  }

  return {
    ...verification,
    valid: verification.valid && normalizedData,
    checks: { ...verification.checks, normalizedData },
    issues: normalizedData
      ? verification.issues
      : [
          ...verification.issues,
          'The normalized price differs from the signed source data.',
        ],
  };
}
