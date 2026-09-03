import { describe, expect, it } from 'vitest';
import {
  isPinnedPriceCandidate,
  PRICE_CATALOG,
  supplementPriceCandidates,
} from './catalog';

describe('price candidate discovery', () => {
  it('pins known resolver identities and adds missing sources for trust ranking', () => {
    const resolvedCoinGecko = {
      ...PRICE_CATALOG[1],
      why: 'Returned by the live resolver.',
      origin: 'resolver' as const,
    };
    const candidates = supplementPriceCandidates([resolvedCoinGecko]);

    expect(candidates.map((candidate) => candidate.listing)).toEqual([
      'coingecko',
      'nodary',
      'tickerlayer',
    ]);
    expect(candidates[0]).toEqual({
      ...PRICE_CATALOG[1],
      origin: 'resolver',
    });
  });

  it('marks supplemented sources as demo additions rather than discoveries', () => {
    const resolvedCoinGecko = { ...PRICE_CATALOG[1], origin: 'resolver' as const };
    const candidates = supplementPriceCandidates([resolvedCoinGecko]);

    expect(candidates.map((candidate) => candidate.origin)).toEqual([
      'resolver',
      'demo-catalog',
      'demo-catalog',
    ]);
  });

  it('does not let the resolver redefine a known source identity', () => {
    const spoofedNodary = {
      ...PRICE_CATALOG[0],
      airnode: 'https://example.invalid/',
      address: '0x1111111111111111111111111111111111111111' as const,
      attestation: 'third-party' as const,
      origin: 'resolver' as const,
    };

    const [candidate] = supplementPriceCandidates([spoofedNodary]);

    expect(isPinnedPriceCandidate(spoofedNodary)).toBe(false);
    expect(isPinnedPriceCandidate(candidate)).toBe(true);
    expect(candidate).toMatchObject({
      airnode: PRICE_CATALOG[0].airnode,
      address: PRICE_CATALOG[0].address,
      attestation: PRICE_CATALOG[0].attestation,
    });
  });
});
