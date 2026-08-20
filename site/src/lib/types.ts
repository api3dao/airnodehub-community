export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export interface PaymentRequirement {
  scheme: 'exact';
  network: string;
  asset: string;
  maxAmountRequired: string;
}

export interface Candidate {
  listing: string;
  airnode: string;
  operation: string;
  address: Address;
  attestation: 'first-party' | 'third-party';
  parameters: Record<string, { type: string; required: boolean }>;
  example: Record<string, unknown>;
  returns: Record<string, string>;
  payment: PaymentRequirement | null;
  why: string;
}

export interface Resolution {
  intent: string;
  candidates: Candidate[];
}

export interface Attestation<T = unknown> {
  airnode: Address;
  requestHash: Hex;
  timestamp: string;
  data: T;
  signature: Hex;
}

export interface TrustPolicy {
  preferFirstParty: boolean;
  maxAttestationAgeSeconds: number;
  allowPaidCalls: boolean;
}

export type CandidateDecisionStatus =
  | 'eligible'
  | 'rejected'
  | 'selected'
  | 'failed';

export interface CandidateDecision {
  listing: string;
  provenance: Candidate['attestation'];
  status: CandidateDecisionStatus;
  reason: string;
  rank: number | null;
  candidate: Candidate;
}

export interface VerificationChecks {
  requestHash: boolean;
  responseSigner: boolean;
  documentSigner: boolean;
  signature: boolean;
  fresh: boolean;
  timestampNotFuture: boolean;
  normalizedData: boolean;
}

export interface VerificationResult {
  valid: boolean;
  checks: VerificationChecks;
  ageSeconds: number;
  issues: string[];
}

export interface NormalizedPrice {
  pair: 'ETH/USD';
  value: number;
  currency: 'USD';
  sourceTimestamp: number | null;
  sourceAgeSeconds: number | null;
}

export type DiscoveryMode = 'resolver' | 'catalog-fallback';

export interface Receipt {
  schemaVersion: '1.0';
  intent: string;
  createdAt: string;
  policy: TrustPolicy;
  discovery: {
    mode: DiscoveryMode;
    resolverAttempts: number;
    resolverError?: string;
  };
  decisions: CandidateDecision[];
  selected: {
    candidate: Candidate;
    documentUrl: string;
    documentSigner: Address;
  };
  request: {
    operation: string;
    parameters: Record<string, unknown>;
  };
  attestation: Attestation;
  normalized: NormalizedPrice;
  verification: VerificationResult;
}

export interface TrustedFetchResult {
  data: unknown;
  normalized: NormalizedPrice;
  trust: VerificationResult & {
    provenance: Candidate['attestation'];
    signer: Address;
  };
  decision: {
    selected: Candidate;
    decisions: CandidateDecision[];
    discoveryMode: DiscoveryMode;
  };
  receipt: Receipt;
}

export interface TraceEvent {
  id: number;
  stage: 'discover' | 'evaluate' | 'inspect' | 'call' | 'verify';
  label: string;
  detail: string;
  status: 'running' | 'success' | 'warning' | 'error';
}

export interface TrustedFetchOptions {
  intent: string;
  policy?: Partial<TrustPolicy>;
  onTrace?: (event: Omit<TraceEvent, 'id'>) => void;
  fetcher?: typeof fetch;
  now?: () => number;
}

export interface AirnodeDocument {
  paths?: {
    '/'?: {
      post?: {
        requestBody?: {
          content?: {
            'application/json'?: {
              schema?: {
                oneOf?: Array<{
                  title?: string;
                  properties?: { operation?: { const?: string } };
                }>;
              };
            };
          };
        };
      };
    };
  };
  'x-airnode'?: {
    address?: Address;
    payment?: PaymentRequirement;
  };
}

export type TrustedFetchErrorCode =
  | 'UNSUPPORTED_INTENT'
  | 'RESOLVER_UNAVAILABLE'
  | 'POLICY_NO_MATCH'
  | 'PAYMENT_REQUIRED'
  | 'AIRNODE_UNAVAILABLE'
  | 'VERIFICATION_FAILED';

export class TrustedFetchError extends Error {
  readonly code: TrustedFetchErrorCode;
  readonly decisions?: CandidateDecision[];

  constructor(
    code: TrustedFetchErrorCode,
    message: string,
    decisions?: CandidateDecision[],
  ) {
    super(message);
    this.name = 'TrustedFetchError';
    this.code = code;
    this.decisions = decisions;
  }
}
