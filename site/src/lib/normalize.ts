import type { Attestation, Candidate, NormalizedPrice } from './types';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The Airnode returned an unexpected data shape.');
  }
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('The Airnode response did not contain a numeric ETH price.');
  }
  return value;
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

export function normalizePrice(
  candidate: Candidate,
  attestation: Attestation,
  nowMilliseconds = Date.now(),
): NormalizedPrice {
  const data = asRecord(attestation.data);
  let value: number;
  let sourceTimestamp: number | null = null;

  switch (candidate.listing) {
    case 'nodary': {
      const feed = asRecord(data['ETH/USD']);
      value = asFiniteNumber(feed.value);
      sourceTimestamp = normalizeTimestamp(feed.timestamp);
      break;
    }
    case 'coingecko': {
      const ethereum = asRecord(data.ethereum);
      value = asFiniteNumber(ethereum.usd);
      break;
    }
    case 'tickerlayer': {
      value = asFiniteNumber(data.price ?? data.last_price);
      sourceTimestamp = normalizeTimestamp(
        data.timestamp ?? data.last_timestamp,
      );
      break;
    }
    default:
      throw new Error(`No price adapter is installed for ${candidate.listing}.`);
  }

  return {
    pair: 'ETH/USD',
    value,
    currency: 'USD',
    sourceTimestamp,
    sourceAgeSeconds:
      sourceTimestamp === null
        ? null
        : Math.max(0, Math.round((nowMilliseconds - sourceTimestamp) / 1000)),
  };
}
