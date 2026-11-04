import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit';
import {
  bytesToHex,
  encodePacked,
  hexToBytes,
  keccak256,
  recoverMessageAddress,
  stringToHex,
} from 'viem';
import { canonicalize } from './verify';
import type { Address, Attestation, Hex } from './types';

// The TwitterAPI.io listing on AirnodeHub. It relays X data it does not own, so the signature proves what the relay
// returned, not that X itself signed anything.
export const TWITTER_AIRNODE = {
  name: 'TwitterAPI.io',
  url: 'https://airnode-twitterapi.fly.dev/',
  address: '0x7B02Fd3324D2dC362f65a9c01e59EC5fDb4E1CCB' as Address,
  operation: 'userInfo',
  provenance: 'third-party' as const,
  priceUsd: '0.01',
};

// Keeps the signed data to the follower count alone, so the Solana program can read it from fixed text
export const FOLLOWER_PROJECTION = { followers: '/data/followers' } as const;

// Deployed to Solana devnet from use-cases/solana-follower-proof/program
export const PROGRAM_ID = 'CnaPviA7GmMJx8JKzgCKCCA2iLn6cTfDj1ix6SEwDwjb';
// VITE_SOLANA_RPC_URL points the page at another RPC, such as a local validator running the same program
export const DEVNET_RPC_URL: string =
  (import.meta.env?.VITE_SOLANA_RPC_URL as string | undefined) ?? 'https://api.devnet.solana.com';
// A funded devnet account that only names the fee payer of a simulated transaction. Simulation skips signature
// checks, so the page never needs its key and nothing is charged.
export const SIMULATION_FEE_PAYER = '4fuurWqVRfjaZBTEcq37k3d6X7HtbJVcBStQKVd6aTe8';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';

// The same limits the program enforces
export const MAX_AGE_SECONDS = 300;
export const MAX_FUTURE_SKEW_SECONDS = 60;

// sha256("global:attest_followers")[..8], as in the program's IDL
const ATTEST_FOLLOWERS_DISCRIMINATOR = new Uint8Array([23, 216, 36, 1, 231, 177, 218, 181]);

const SECP256K1_HALF_N =
  0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;
const SECP256K1_N =
  0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

// Program errors in declaration order, so code 6000 + index
export const PROGRAM_ERRORS = [
  'InvalidHandle',
  'UnexpectedData',
  'DigestMismatch',
  'HighS',
  'InvalidRecoveryId',
  'RecoveryFailed',
  'WrongSigner',
  'FromFuture',
  'Stale',
  'BelowMilestone',
] as const;
export type ProgramErrorName = (typeof PROGRAM_ERRORS)[number] | 'AlreadyRecorded';

export const PROGRAM_ERROR_MESSAGES: Record<ProgramErrorName, string> = {
  InvalidHandle: 'The handle must be 1 to 15 letters, digits or underscores.',
  UnexpectedData: 'The signed data is not a follower count in the expected form.',
  DigestMismatch: 'The digest does not match the request, timestamp and data.',
  HighS: 'The signature uses the high-s form, the malleable twin of a valid signature.',
  InvalidRecoveryId: 'The recovery id must be 0 or 1.',
  RecoveryFailed: 'No public key could be recovered from the signature.',
  WrongSigner: 'The signature does not recover to the TwitterAPI.io Airnode for this request.',
  FromFuture: 'The signed timestamp is ahead of the cluster clock.',
  Stale: `The signed response is more than ${MAX_AGE_SECONDS / 60} minutes old.`,
  BelowMilestone: 'The follower count is below the milestone.',
  AlreadyRecorded: 'This exact signed response has already been recorded on Solana.',
};

export type FollowerAttestation = Attestation<string>;

export interface FollowerRequest {
  operation: 'userInfo';
  parameters: { userName: string };
  responseProjection: typeof FOLLOWER_PROJECTION;
}

export function isValidHandle(handle: string): boolean {
  return /^[A-Za-z0-9_]{1,15}$/.test(handle);
}

export function followerRequest(handle: string): FollowerRequest {
  return {
    operation: 'userInfo',
    parameters: { userName: handle },
    responseProjection: FOLLOWER_PROJECTION,
  };
}

// The Airnode's request identity: [operation, sorted parameters, sorted projection], as JSON
export function followerRequestHash(handle: string): Hex {
  return keccak256(
    stringToHex(
      JSON.stringify([
        'userInfo',
        canonicalize({ userName: handle }),
        canonicalize(FOLLOWER_PROJECTION),
      ]),
    ),
  );
}

// Reads `{"followers":<digits>}` exactly as the program does, refusing anything else
export function parseFollowers(data: string): bigint | null {
  const match = /^\{"followers":(0|[1-9][0-9]{0,19})\}$/.exec(data);
  if (!match) return null;
  const count = BigInt(match[1]);
  return count <= 0xffffffffffffffffn ? count : null;
}

export function signedDigest(requestHash: Hex, timestamp: bigint, data: string): Hex {
  return keccak256(
    encodePacked(['bytes32', 'uint256', 'bytes'], [requestHash, timestamp, stringToHex(data)]),
  );
}

export interface SplitSignature {
  rs: Uint8Array;
  recoveryId: number;
  s: bigint;
}

// Splits an EIP-191 r ‖ s ‖ v signature into what the program takes: r ‖ s and v − 27
export function splitSignature(signature: Hex): SplitSignature {
  const bytes = hexToBytes(signature);
  if (bytes.length !== 65) throw new Error('The signature must be 65 bytes.');
  const v = bytes[64];
  return {
    rs: bytes.slice(0, 64),
    recoveryId: v >= 27 ? v - 27 : v,
    s: BigInt(bytesToHex(bytes.slice(32, 64))),
  };
}

// Returns the same signature with s replaced by n − s and v flipped: also valid for secp256k1, so the program must
// refuse it itself
export function highSTwin(signature: Hex): Hex {
  const bytes = hexToBytes(signature);
  const s = BigInt(bytesToHex(bytes.slice(32, 64)));
  const twin = hexToBytes(`0x${(SECP256K1_N - s).toString(16).padStart(64, '0')}`);
  const result = new Uint8Array(bytes);
  result.set(twin, 32);
  result[64] = bytes[64] === 27 ? 28 : bytes[64] === 28 ? 27 : bytes[64] ^ 1;
  return bytesToHex(result);
}

export type CheckId = 'request' | 'data' | 'lowS' | 'signer' | 'fresh' | 'milestone';

export interface ProgramCheck {
  id: CheckId;
  label: string;
  status: 'pass' | 'fail' | 'skipped';
  detail: string;
}

export interface ProgramCheckResult {
  valid: boolean;
  error: ProgramErrorName | null;
  checks: ProgramCheck[];
  followers: bigint | null;
  digest: Hex | null;
  ageSeconds: number;
}

const CHECK_LABELS: Record<CheckId, string> = {
  request: 'Request rebuilt from the handle',
  data: 'Signed data is a follower count',
  lowS: 'Signature is in low-s form',
  signer: 'Signer is the TwitterAPI.io Airnode',
  fresh: 'Signed within the last 5 minutes',
  milestone: 'Follower count meets the milestone',
};

// Runs the program's checks in the program's order, stopping at the first failure as the program would
export async function checkAsProgram({
  attestation,
  handle,
  minFollowers,
  nowSeconds,
  expectedSigner = TWITTER_AIRNODE.address,
}: {
  attestation: FollowerAttestation;
  handle: string;
  minFollowers: bigint;
  nowSeconds: number;
  expectedSigner?: Address;
}): Promise<ProgramCheckResult> {
  const checks: ProgramCheck[] = [];
  let error: ProgramErrorName | null = null;
  let followers: bigint | null = null;
  let digest: Hex | null = null;
  const timestamp = /^\d+$/.test(attestation.timestamp) ? BigInt(attestation.timestamp) : null;
  const ageSeconds = timestamp === null ? Number.NaN : Math.round(nowSeconds - Number(timestamp));

  const step = (id: CheckId, passed: boolean, detail: string, failure: ProgramErrorName) => {
    if (error) {
      checks.push({ id, label: CHECK_LABELS[id], status: 'skipped', detail: 'Not reached' });
      return;
    }
    checks.push({ id, label: CHECK_LABELS[id], status: passed ? 'pass' : 'fail', detail });
    if (!passed) error = failure;
  };

  const handleValid = isValidHandle(handle);
  const requestHash = handleValid ? followerRequestHash(handle) : null;
  step(
    'request',
    handleValid,
    handleValid ? `keccak256 of the userInfo request for @${handle}` : PROGRAM_ERROR_MESSAGES.InvalidHandle,
    'InvalidHandle',
  );

  followers = typeof attestation.data === 'string' ? parseFollowers(attestation.data) : null;
  step(
    'data',
    followers !== null && timestamp !== null,
    followers !== null ? `${followers.toLocaleString('en-US')} followers` : PROGRAM_ERROR_MESSAGES.UnexpectedData,
    'UnexpectedData',
  );

  let split: SplitSignature | null = null;
  try {
    split = splitSignature(attestation.signature);
  } catch {
    split = null;
  }
  step(
    'lowS',
    split !== null && split.s <= SECP256K1_HALF_N && split.recoveryId <= 1,
    split && split.s > SECP256K1_HALF_N ? PROGRAM_ERROR_MESSAGES.HighS : 'Malleable twin refused',
    split && split.s > SECP256K1_HALF_N ? 'HighS' : 'InvalidRecoveryId',
  );

  let recovered: Address | null = null;
  if (!error && requestHash && timestamp !== null) {
    digest = signedDigest(requestHash, timestamp, attestation.data);
    try {
      recovered = await recoverMessageAddress({ message: { raw: digest }, signature: attestation.signature });
    } catch {
      recovered = null;
    }
  }
  step(
    'signer',
    recovered?.toLowerCase() === expectedSigner.toLowerCase(),
    recovered ? `Recovered ${recovered}` : PROGRAM_ERROR_MESSAGES.RecoveryFailed,
    recovered ? 'WrongSigner' : 'RecoveryFailed',
  );

  const fromFuture = timestamp !== null && Number(timestamp) > nowSeconds + MAX_FUTURE_SKEW_SECONDS;
  const stale = timestamp !== null && nowSeconds - Number(timestamp) > MAX_AGE_SECONDS;
  step(
    'fresh',
    !fromFuture && !stale,
    fromFuture ? PROGRAM_ERROR_MESSAGES.FromFuture : `Signed ${ageSeconds}s ago`,
    fromFuture ? 'FromFuture' : 'Stale',
  );

  step(
    'milestone',
    followers !== null && followers >= minFollowers,
    `${followers?.toLocaleString('en-US') ?? '—'} ≥ ${minFollowers.toLocaleString('en-US')}`,
    'BelowMilestone',
  );

  return { valid: error === null, error, checks, followers, digest, ageSeconds };
}

export interface AttestArguments {
  digest: Hex;
  handle: string;
  minFollowers: bigint;
  timestamp: bigint;
  data: string;
  signature: Hex;
}

// Builds the arguments for the program from a response, recomputing the digest from the handle as the program does
export function attestArguments(
  attestation: FollowerAttestation,
  handle: string,
  minFollowers: bigint,
): AttestArguments {
  const timestamp = BigInt(attestation.timestamp);
  const requestHash = isValidHandle(handle) ? followerRequestHash(handle) : attestation.requestHash;
  return {
    digest: signedDigest(requestHash, timestamp, attestation.data),
    handle,
    minFollowers,
    timestamp,
    data: attestation.data,
    signature: attestation.signature,
  };
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function u64(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

// Borsh encoding of attest_followers(digest, handle, min_followers, timestamp, data, signature, recovery_id)
export function encodeAttestFollowers(args: AttestArguments): Uint8Array {
  const handle = new TextEncoder().encode(args.handle);
  const data = new TextEncoder().encode(args.data);
  const { rs, recoveryId } = splitSignature(args.signature);
  return concatBytes([
    ATTEST_FOLLOWERS_DISCRIMINATOR,
    hexToBytes(args.digest),
    u32(handle.length),
    handle,
    u64(args.minFollowers),
    u64(args.timestamp),
    u32(data.length),
    data,
    rs,
    new Uint8Array([recoveryId]),
  ]);
}

// The account that records one signed message. Creating it a second time fails, which is the replay protection.
export async function recordAddress(digest: Hex): Promise<string> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: address(PROGRAM_ID),
    seeds: ['attestation', hexToBytes(digest)],
  });
  return pda;
}

export async function buildAttestTransaction(
  args: AttestArguments,
  { feePayer, blockhash }: { feePayer: string; blockhash: { blockhash: string; lastValidBlockHeight: bigint } },
) {
  const record = await recordAddress(args.digest);
  const instruction = {
    programAddress: address(PROGRAM_ID),
    accounts: [
      { address: address(feePayer), role: AccountRole.WRITABLE_SIGNER },
      { address: address(record), role: AccountRole.WRITABLE },
      { address: address(SYSTEM_PROGRAM), role: AccountRole.READONLY },
    ],
    data: encodeAttestFollowers(args),
  };
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (draft) => setTransactionMessageFeePayer(address(feePayer), draft),
    (draft) =>
      setTransactionMessageLifetimeUsingBlockhash(
        // The RPC replaces it during simulation; the type only needs a well-formed value
        blockhash as Parameters<typeof setTransactionMessageLifetimeUsingBlockhash>[0],
        draft,
      ),
    (draft) => appendTransactionMessageInstruction(instruction, draft),
  );
  return { transaction: compileTransaction(message), record };
}

export interface SimulationResult {
  accepted: boolean;
  error: ProgramErrorName | null;
  rawError: unknown;
  logs: string[];
  unitsConsumed: number | null;
  record: string;
  bytes: number;
}

// Maps a failed simulation to the program error it reports in its logs
export function programErrorFromLogs(logs: readonly string[], rawError: unknown): ProgramErrorName | null {
  for (const line of logs) {
    const anchor = /Error Code: (\w+)/.exec(line);
    if (anchor && (PROGRAM_ERRORS as readonly string[]).includes(anchor[1])) {
      return anchor[1] as ProgramErrorName;
    }
    if (/already in use/.test(line)) return 'AlreadyRecorded';
  }
  const custom = JSON.stringify(rawError, (_key, value) => (typeof value === 'bigint' ? Number(value) : value))
    ?.match(/"Custom":(\d+)/);
  if (custom) {
    const code = Number(custom[1]);
    if (code >= 6000 && code < 6000 + PROGRAM_ERRORS.length) return PROGRAM_ERRORS[code - 6000];
  }
  return null;
}

// Runs attest_followers on Solana devnet without committing it: the cluster executes the real program against its
// real clock and accounts, then discards the result. Signatures are not checked, so no wallet is needed.
export async function simulateOnDevnet(
  args: AttestArguments,
  { rpcUrl = DEVNET_RPC_URL, feePayer = SIMULATION_FEE_PAYER }: { rpcUrl?: string; feePayer?: string } = {},
): Promise<SimulationResult> {
  const rpc = createSolanaRpc(rpcUrl);
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const { transaction, record } = await buildAttestTransaction(args, { feePayer, blockhash });
  const wire = getBase64EncodedWireTransaction(transaction);
  const { value } = await rpc
    .simulateTransaction(wire, { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true })
    .send();
  const logs = [...(value.logs ?? [])];
  return {
    accepted: value.err === null,
    error: value.err === null ? null : programErrorFromLogs(logs, value.err),
    rawError: value.err,
    logs,
    unitsConsumed: value.unitsConsumed === undefined ? null : Number(value.unitsConsumed),
    record,
    bytes: atob(wire).length,
  };
}

export function explorerUrl(kind: 'address' | 'tx', value: string): string {
  return `https://explorer.solana.com/${kind}/${value}?cluster=devnet`;
}

export interface FollowerCall {
  request: FollowerRequest;
  attestation: FollowerAttestation;
  documentSigner: Address;
  receivedAt: string;
}

// Confirms the live document still names the expected signer and serves userInfo, then makes the call. Pass a paying
// fetch for the call itself: the operation is priced, and this function never pays on its own.
export async function fetchFollowerAttestation(
  handle: string,
  { fetcher = fetch, payingFetcher }: { fetcher?: typeof fetch; payingFetcher: typeof fetch },
): Promise<FollowerCall> {
  if (!isValidHandle(handle)) throw new Error(PROGRAM_ERROR_MESSAGES.InvalidHandle);

  const documentResponse = await fetcher(TWITTER_AIRNODE.url);
  if (!documentResponse.ok) throw new Error(`The Airnode document returned HTTP ${documentResponse.status}.`);
  const document = (await documentResponse.json()) as {
    'x-airnode'?: { address?: Address };
    paths?: { '/'?: { post?: { requestBody?: { content?: { 'application/json'?: { schema?: { oneOf?: Array<{ title?: string }> } } } } } } };
  };
  const documentSigner = document['x-airnode']?.address;
  if (documentSigner?.toLowerCase() !== TWITTER_AIRNODE.address.toLowerCase()) {
    throw new Error('The live Airnode document advertises a different signer.');
  }
  const operations =
    document.paths?.['/']?.post?.requestBody?.content?.['application/json']?.schema?.oneOf?.map(
      (variant) => variant.title,
    ) ?? [];
  if (!operations.includes(TWITTER_AIRNODE.operation)) {
    throw new Error('The live Airnode document no longer serves userInfo.');
  }

  const request = followerRequest(handle);
  const response = await payingFetcher(TWITTER_AIRNODE.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = `The Airnode returned HTTP ${response.status}.`;
    try {
      const body = JSON.parse(text) as { error?: unknown };
      if (body.error) message = `${message} ${String(body.error)}`;
    } catch {
      // keep the status message
    }
    throw new Error(message);
  }
  const attestation = JSON.parse(text) as FollowerAttestation;
  for (const key of ['airnode', 'requestHash', 'timestamp', 'data', 'signature'] as const) {
    if (!(key in attestation)) throw new Error(`The Airnode response is missing ${key}.`);
  }
  return { request, attestation, documentSigner, receivedAt: new Date().toISOString() };
}
