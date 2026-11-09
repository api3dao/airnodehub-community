import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_AGE_SECONDS,
  TWITTER_AIRNODE,
  attestArguments,
  checkAsProgram,
  followerRequestHash,
  highSTwin,
  simulateOnDevnet,
} from './solanaFollowerProof';
import type { FollowerAttestation, FollowerRequest } from './solanaFollowerProof';

// The real TwitterAPI.io response recorded by scripts/capture-solana-follower-fixture.mjs
const fixture = JSON.parse(
  readFileSync(new URL('../../public/fixtures/twitterapi-userinfo-followers.json', import.meta.url), 'utf8'),
) as { request: FollowerRequest; response: FollowerAttestation };
const handle = fixture.request.parameters.userName;
const attestation = fixture.response;
const signedAt = Number(attestation.timestamp);

const check = (overrides: Partial<Parameters<typeof checkAsProgram>[0]> = {}) =>
  checkAsProgram({ attestation, handle, minFollowers: 1n, nowSeconds: signedAt + 10, ...overrides });

describe('Recorded TwitterAPI.io follower count', () => {
  it('is signed by the pinned TwitterAPI.io Airnode for the projected request', async () => {
    expect(attestation.airnode).toBe(TWITTER_AIRNODE.address);
    expect(attestation.requestHash).toBe(followerRequestHash(handle));
    const result = await check();
    expect(result).toMatchObject({ valid: true, error: null });
  });

  it('is rejected once it is older than the freshness window, as the program would', async () => {
    expect((await check({ nowSeconds: signedAt + MAX_AGE_SECONDS })).error).toBe(null);
    expect((await check({ nowSeconds: signedAt + MAX_AGE_SECONDS + 1 })).error).toBe('Stale');
  });

  it('rejects the high-s twin of the real signature', async () => {
    expect((await check({ attestation: { ...attestation, signature: highSTwin(attestation.signature) } })).error).toBe('HighS');
  });
});

// Simulates against the deployed devnet program. Run with RUN_LIVE=1.
const live = process.env.RUN_LIVE === '1' ? describe : describe.skip;

live('Deployed devnet program', () => {
  it('accepts the recorded response while fresh, and rejects it as stale after that', async () => {
    const result = await simulateOnDevnet(attestArguments(attestation, handle, 1n));
    const fresh = Date.now() / 1000 - signedAt < MAX_AGE_SECONDS - 30;
    expect(result.error).toBe(fresh ? null : 'Stale');
    expect(result.accepted).toBe(fresh);
  }, 30_000);

  it('rejects an inflated count with WrongSigner', async () => {
    const edited = { ...attestation, data: '{"followers":99999999}' };
    const result = await simulateOnDevnet(attestArguments(edited, handle, 1n));
    expect(result.error).toBe('WrongSigner');
  }, 30_000);

  it('rejects the high-s twin with HighS', async () => {
    const twin = { ...attestation, signature: highSTwin(attestation.signature) };
    const result = await simulateOnDevnet(attestArguments(twin, handle, 1n));
    expect(result.error).toBe('HighS');
  }, 30_000);
});
