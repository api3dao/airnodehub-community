import { describe, expect, it } from 'vitest';
import { keccak256, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  attestArguments,
  checkAsProgram,
  encodeAttestFollowers,
  followerRequestHash,
  highSTwin,
  MAX_AGE_SECONDS,
  MAX_FUTURE_SKEW_SECONDS,
  parseFollowers,
  programErrorFromLogs,
  recordAddress,
  signedDigest,
  splitSignature,
} from './solanaFollowerProof';
import type { FollowerAttestation } from './solanaFollowerProof';

const signer = privateKeyToAccount(`0x${'07'.repeat(32)}`);
const SIGNED_AT = 1_800_000_000;

async function sign(handle: string, data: string, timestamp = SIGNED_AT): Promise<FollowerAttestation> {
  const requestHash = followerRequestHash(handle);
  const digest = signedDigest(requestHash, BigInt(timestamp), data);
  return {
    airnode: signer.address,
    requestHash,
    timestamp: String(timestamp),
    data,
    signature: await signer.signMessage({ message: { raw: digest } }),
  };
}

const check = (
  attestation: FollowerAttestation,
  { handle = 'api3dao', minFollowers = 1n, nowSeconds = SIGNED_AT + 10 } = {},
) => checkAsProgram({ attestation, handle, minFollowers, nowSeconds, expectedSigner: signer.address });

describe('Solana follower proof request identity', () => {
  it('hashes the projected userInfo request exactly as the program rebuilds it', () => {
    const programPreimage = '["userInfo",[["userName","api3dao"]],[["followers","/data/followers"]]]';
    expect(followerRequestHash('api3dao')).toBe(keccak256(stringToHex(programPreimage)));
  });

  it('reads only a plain follower count', () => {
    expect(parseFollowers('{"followers":0}')).toBe(0n);
    expect(parseFollowers('{"followers":18446744073709551615}')).toBe(18446744073709551615n);
    for (const malformed of [
      '{"followers":18446744073709551616}',
      '{"followers":012}',
      '{"followers":-1}',
      '{"followers":1.5}',
      '{"followers": 12}',
      '{"followers":"12"}',
      '{"following":12}',
    ]) {
      expect(parseFollowers(malformed), malformed).toBeNull();
    }
  });
});

describe('checks mirrored from the Solana program', () => {
  it('accepts a fresh, correctly signed count that meets the milestone', async () => {
    const result = await check(await sign('api3dao', '{"followers":4321}'), { minFollowers: 4321n });
    expect(result.valid).toBe(true);
    expect(result.followers).toBe(4321n);
    expect(result.checks.every((entry) => entry.status === 'pass')).toBe(true);
  });

  it('rejects an edited count as a wrong signer', async () => {
    const attestation = await sign('api3dao', '{"followers":4321}');
    const result = await check({ ...attestation, data: '{"followers":5004321}' });
    expect(result.error).toBe('WrongSigner');
    expect(result.checks.find((entry) => entry.id === 'fresh')?.status).toBe('skipped');
  });

  it('rejects a response for a different handle', async () => {
    const result = await check(await sign('api3dao', '{"followers":4321}'), { handle: 'jack' });
    expect(result.error).toBe('WrongSigner');
  });

  it('rejects the high-s twin even though it is a valid secp256k1 signature', async () => {
    const attestation = await sign('api3dao', '{"followers":4321}');
    const twin = highSTwin(attestation.signature);
    expect(splitSignature(twin).recoveryId).toBe(1 - splitSignature(attestation.signature).recoveryId);
    expect((await check({ ...attestation, signature: twin })).error).toBe('HighS');
  });

  it('enforces the same freshness window as the program', async () => {
    const attestation = await sign('api3dao', '{"followers":4321}');
    expect((await check(attestation, { nowSeconds: SIGNED_AT + MAX_AGE_SECONDS })).valid).toBe(true);
    expect((await check(attestation, { nowSeconds: SIGNED_AT + MAX_AGE_SECONDS + 1 })).error).toBe('Stale');
    expect((await check(attestation, { nowSeconds: SIGNED_AT - MAX_FUTURE_SKEW_SECONDS - 1 })).error).toBe(
      'FromFuture',
    );
  });

  it('rejects a count below the milestone', async () => {
    const result = await check(await sign('api3dao', '{"followers":4321}'), { minFollowers: 4322n });
    expect(result.error).toBe('BelowMilestone');
  });

  it('rejects handles the program cannot embed in its request', async () => {
    const attestation = await sign('api3dao', '{"followers":4321}');
    expect((await check(attestation, { handle: 'x"]],[["a' })).error).toBe('InvalidHandle');
  });
});

describe('Solana instruction encoding', () => {
  it('encodes attest_followers in the Borsh layout of the program IDL', async () => {
    const attestation = await sign('api3dao', '{"followers":4321}');
    const args = attestArguments(attestation, 'api3dao', 1000n);
    const bytes = encodeAttestFollowers(args);
    const handleLength = 'api3dao'.length;
    const dataLength = '{"followers":4321}'.length;
    expect(bytes.length).toBe(8 + 32 + 4 + handleLength + 8 + 8 + 4 + dataLength + 64 + 1);
    expect([...bytes.slice(0, 8)]).toEqual([23, 216, 36, 1, 231, 177, 218, 181]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(40, true)).toBe(handleLength);
    expect(view.getBigUint64(44 + handleLength, true)).toBe(1000n);
    expect(view.getBigUint64(52 + handleLength, true)).toBe(BigInt(SIGNED_AT));
    expect(bytes.at(-1)).toBe(splitSignature(attestation.signature).recoveryId);
  });

  it('derives one record account per signed digest', async () => {
    const first = attestArguments(await sign('api3dao', '{"followers":1}'), 'api3dao', 1n);
    const second = attestArguments(await sign('api3dao', '{"followers":2}'), 'api3dao', 1n);
    expect(await recordAddress(first.digest)).toBe(await recordAddress(first.digest));
    expect(await recordAddress(first.digest)).not.toBe(await recordAddress(second.digest));
  });

  it('reads program errors from simulation logs', () => {
    expect(
      programErrorFromLogs(
        ['Program log: AnchorError occurred. Error Code: Stale. Error Number: 6008. Error Message: x.'],
        null,
      ),
    ).toBe('Stale');
    expect(programErrorFromLogs([], { InstructionError: [0, { Custom: 6006 }] })).toBe('WrongSigner');
    expect(
      programErrorFromLogs(['Allocate: account Address { address: X, base: None } already in use'], null),
    ).toBe('AlreadyRecorded');
  });
});
