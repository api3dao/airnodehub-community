import { isPinnedPriceCandidate } from './catalog';
import type {
  Candidate,
  CandidateDecision,
  TrustPolicy,
} from './types';

export const DEFAULT_POLICY: TrustPolicy = {
  preferFirstParty: true,
  maxAttestationAgeSeconds: 60,
  allowPaidCalls: false,
};

function compareCandidates(
  left: Candidate,
  right: Candidate,
  policy: TrustPolicy,
): number {
  if (policy.preferFirstParty && left.attestation !== right.attestation) {
    return left.attestation === 'first-party' ? -1 : 1;
  }

  if ((left.payment === null) !== (right.payment === null)) {
    return left.payment === null ? -1 : 1;
  }

  return left.listing.localeCompare(right.listing);
}

export function evaluateCandidates(
  candidates: Candidate[],
  policy: TrustPolicy,
): {
  ordered: Candidate[];
  decisions: CandidateDecision[];
} {
  const unique = new Map<string, Candidate>();
  for (const candidate of candidates) {
    unique.set(`${candidate.listing}:${candidate.operation}`, candidate);
  }

  const accepted: Candidate[] = [];
  const rejected: CandidateDecision[] = [];

  for (const candidate of unique.values()) {
    if (!isPinnedPriceCandidate(candidate)) {
      rejected.push({
        listing: candidate.listing,
        provenance: candidate.attestation,
        status: 'rejected',
        reason: 'This MVP has no pinned identity for the listing and operation.',
        rank: null,
        candidate,
      });
      continue;
    }

    if (candidate.payment && !policy.allowPaidCalls) {
      rejected.push({
        listing: candidate.listing,
        provenance: candidate.attestation,
        status: 'rejected',
        reason: 'Paid calls are blocked by policy.',
        rank: null,
        candidate,
      });
      continue;
    }

    accepted.push(candidate);
  }

  const ordered = [...accepted].sort((left, right) =>
    compareCandidates(left, right, policy),
  );

  const eligible = ordered.map<CandidateDecision>((candidate, index) => ({
    listing: candidate.listing,
    provenance: candidate.attestation,
    status: 'eligible',
    reason:
      policy.preferFirstParty && candidate.attestation === 'first-party'
        ? 'Preferred by the first-party provenance policy.'
        : candidate.payment === null
          ? 'Eligible and free to call.'
          : 'Eligible under the paid-call policy.',
    rank: index + 1,
    candidate,
  }));

  return { ordered, decisions: [...eligible, ...rejected] };
}
