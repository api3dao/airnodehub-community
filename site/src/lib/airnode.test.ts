import { describe, expect, it } from 'vitest';
import { callVerifiedListing, type ListingCallSpec } from './airnode';

const spec: ListingCallSpec = {
  id: 'geodb',
  name: 'GeoDB',
  url: 'https://airnode-geodb.fly.dev/',
  operation: 'city',
  address: '0xBeA7EB5366e0260664Ff8d96362588F0313e395F',
  provenance: 'third-party',
  parameters: { cityId: 'Q727', languageCode: 'en', asciiMode: 'false' },
};

const document = {
  paths: {
    '/': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                oneOf: [{ properties: { operation: { const: 'city' } } }],
              },
            },
          },
        },
      },
    },
  },
  'x-airnode': { address: spec.address },
};

const attestation = {
  airnode: spec.address,
  requestHash: '0x39b01dd90a274d1bc339fc57407504cf504fa58670d51de3dce049df89ddef1e',
  timestamp: '1786739691',
  data: {
    data: {
      id: 3097353,
      wikiDataId: 'Q727',
      type: 'CITY',
      city: 'Amsterdam',
      name: 'Amsterdam',
      country: 'Netherlands',
      countryCode: 'NL',
      elevationMeters: -2,
      latitude: 52.37403,
      longitude: 4.88969,
      population: 921468,
      timezone: 'Europe__Amsterdam',
      deleted: false,
    },
  },
  signature: '0x53ac789634243c9b510982023d47c40e142e688b714f0aba380794fb5e8a38221a92c815114583948960b062c8ae67146840ac4004ed0aaabfbc8bad9a8bf5251c',
};

describe('generic verified Airnode call', () => {
  it('inspects the contract and verifies a captured GeoDB response', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return new Response(JSON.stringify(calls === 1 ? document : attestation));
    };

    const result = await callVerifiedListing(spec, {
      fetcher: fetcher as typeof fetch,
      now: () => Number(attestation.timestamp) * 1000,
    });

    expect(calls).toBe(2);
    expect(result.verification.valid).toBe(true);
    expect(result.attestation.data).toEqual(attestation.data);
  });

  it('stops before the call when the live document signer changed', async () => {
    const fetcher = async () => new Response(JSON.stringify({
      ...document,
      'x-airnode': { address: '0x0000000000000000000000000000000000000000' },
    }));

    await expect(callVerifiedListing(spec, { fetcher: fetcher as typeof fetch }))
      .rejects.toThrow('different signer');
  });
});
