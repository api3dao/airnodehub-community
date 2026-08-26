import { describe, expect, it } from 'vitest';
import { PRICE_CATALOG, supplementPriceCandidates } from './catalog';

describe('price candidate discovery', () => {
  it('keeps resolver data and adds missing known sources for trust ranking', () => {
    const resolvedCoinGecko = {
      ...PRICE_CATALOG[1],
      why: 'Returned by the live resolver.',
    };
    const candidates = supplementPriceCandidates([resolvedCoinGecko]);

    expect(candidates.map((candidate) => candidate.listing)).toEqual([
      'coingecko',
      'nodary',
      'tickerlayer',
    ]);
    expect(candidates[0]).toBe(resolvedCoinGecko);
  });
});
