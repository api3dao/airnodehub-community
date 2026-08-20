import { describe, expect, it } from 'vitest';
import { trustedFetch } from './client';

const live = process.env.RUN_LIVE === '1' ? describe : describe.skip;

live('AirnodeHub live smoke test', () => {
  it(
    'discovers, calls, and verifies a current ETH/USD price',
    async () => {
      const result = await trustedFetch({
        intent: 'current USD price of ETH from the strongest available source',
        policy: { maxAttestationAgeSeconds: 300 },
      });

      expect(result.trust.valid).toBe(true);
      expect(result.normalized.value).toBeGreaterThan(0);
      expect(result.receipt.attestation.signature).toMatch(/^0x/);
    },
    90_000,
  );
});
