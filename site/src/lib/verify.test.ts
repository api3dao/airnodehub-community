import { describe, expect, it } from 'vitest';
import { PRICE_CATALOG } from './catalog';
import { evaluateCandidates } from './policy';
import { tamperWithPrice } from './receipt';
import type { Attestation, Receipt } from './types';
import {
  computeRequestHash,
  verifyAttestation,
  verifyReceipt,
} from './verify';

const nodary = PRICE_CATALOG[0];
const capturedAtSeconds = 1_786_651_475;
const attestation: Attestation = {
  airnode: '0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0',
  requestHash:
    '0x95f2f0aef992826cc93ff0632171cce8258cc98d8796d6141e7c20601c20e439',
  timestamp: String(capturedAtSeconds),
  data: {
    'ETH/USD': {
      value: 1887.46,
      timestamp: 1_786_651_475_341,
      category: 'crypto',
    },
  },
  signature:
    '0x57e6316b66fe8e527a02de593f63e293419abfa7d6e12ef0335b0bf78ec99c301a6b9641cfe042b4f275502eec1c002fc62e8408f136de63981f08d27efcfafc1b',
};

async function fixtureReceipt(): Promise<Receipt> {
  const policy = {
    preferFirstParty: true,
    maxAttestationAgeSeconds: 60,
    allowPaidCalls: false,
  };
  const verification = await verifyAttestation({
    operation: nodary.operation,
    parameters: nodary.example,
    attestation,
    expectedSigner: nodary.address,
    documentSigner: nodary.address,
    maxAgeSeconds: 60,
    nowSeconds: capturedAtSeconds + 5,
  });
  const { decisions } = evaluateCandidates(PRICE_CATALOG, policy);

  return {
    schemaVersion: '1.0',
    intent: 'current USD price of ETH',
    createdAt: new Date((capturedAtSeconds + 5) * 1000).toISOString(),
    policy,
    discovery: { mode: 'catalog-fallback', resolverAttempts: 2 },
    decisions,
    selected: {
      candidate: nodary,
      documentUrl: nodary.airnode,
      documentSigner: nodary.address,
    },
    request: { operation: nodary.operation, parameters: nodary.example },
    attestation,
    normalized: {
      pair: 'ETH/USD',
      value: 1887.46,
      currency: 'USD',
      sourceTimestamp: 1_786_651_475_341,
      sourceAgeSeconds: 5,
    },
    verification,
  };
}

describe('request identity', () => {
  it('is stable across nested object key order', () => {
    const left = computeRequestHash('example', {
      z: 1,
      nested: { b: 2, a: 1 },
    });
    const right = computeRequestHash('example', {
      nested: { a: 1, b: 2 },
      z: 1,
    });

    expect(left).toBe(right);
  });

  it('keeps array order meaningful', () => {
    expect(computeRequestHash('example', { values: [1, 2] })).not.toBe(
      computeRequestHash('example', { values: [2, 1] }),
    );
  });
});

describe('local attestation verification', () => {
  it('verifies a captured live Nodary fixture without networking', async () => {
    const verification = await verifyAttestation({
      operation: nodary.operation,
      parameters: nodary.example,
      attestation,
      expectedSigner: nodary.address,
      documentSigner: nodary.address,
      maxAgeSeconds: 60,
      nowSeconds: capturedAtSeconds + 5,
    });

    expect(verification.valid).toBe(true);
    expect(verification.issues).toEqual([]);
  });

  it('rejects changed data', async () => {
    const receipt = await fixtureReceipt();
    const tampered = tamperWithPrice(receipt);
    const verification = await verifyReceipt(
      tampered,
      capturedAtSeconds + 5,
    );

    expect(verification.valid).toBe(false);
    expect(verification.checks.signature).toBe(false);
  });

  it('rejects a changed timestamp without throwing', async () => {
    const changed = structuredClone(attestation);
    changed.timestamp = String(capturedAtSeconds + 1);
    const verification = await verifyAttestation({
      operation: nodary.operation,
      parameters: nodary.example,
      attestation: changed,
      expectedSigner: nodary.address,
      documentSigner: nodary.address,
      maxAgeSeconds: 60,
      nowSeconds: capturedAtSeconds + 5,
    });

    expect(verification.valid).toBe(false);
    expect(verification.checks.signature).toBe(false);
  });

  it('rejects stale signed data', async () => {
    const verification = await verifyAttestation({
      operation: nodary.operation,
      parameters: nodary.example,
      attestation,
      expectedSigner: nodary.address,
      documentSigner: nodary.address,
      maxAgeSeconds: 60,
      nowSeconds: capturedAtSeconds + 61,
    });

    expect(verification.valid).toBe(false);
    expect(verification.checks.fresh).toBe(false);
  });

  it('re-verifies a receipt after JSON round-trip', async () => {
    const receipt = await fixtureReceipt();
    const roundTripped = JSON.parse(JSON.stringify(receipt)) as Receipt;
    const verification = await verifyReceipt(
      roundTripped,
      capturedAtSeconds + 5,
    );

    expect(verification.valid).toBe(true);
  });

  it('rejects a changed derived price even when signed data is untouched', async () => {
    const receipt = await fixtureReceipt();
    receipt.normalized.value += 1;
    const verification = await verifyReceipt(
      receipt,
      capturedAtSeconds + 5,
    );

    expect(verification.valid).toBe(false);
    expect(verification.checks.normalizedData).toBe(false);
  });
});

describe('trust policy ranking', () => {
  it('selects deterministically when candidates arrive shuffled', () => {
    const policy = {
      preferFirstParty: true,
      maxAttestationAgeSeconds: 60,
      allowPaidCalls: false,
    };
    const ordered = evaluateCandidates(
      [PRICE_CATALOG[2], PRICE_CATALOG[1], PRICE_CATALOG[0]],
      policy,
    ).ordered;

    expect(ordered.map((candidate) => candidate.listing)).toEqual([
      'nodary',
      'coingecko',
      'tickerlayer',
    ]);
  });

  it('rejects a paid first-party candidate when spending is blocked', () => {
    const paidNodary = {
      ...nodary,
      payment: {
        scheme: 'exact' as const,
        network: 'eip155:8453',
        asset: 'USDC',
        maxAmountRequired: '10000',
      },
    };
    const evaluation = evaluateCandidates(
      [paidNodary, PRICE_CATALOG[1]],
      {
        preferFirstParty: true,
        maxAttestationAgeSeconds: 60,
        allowPaidCalls: false,
      },
    );

    expect(evaluation.ordered[0].listing).toBe('coingecko');
    expect(
      evaluation.decisions.find((decision) => decision.listing === 'nodary')
        ?.status,
    ).toBe('rejected');
  });
});
