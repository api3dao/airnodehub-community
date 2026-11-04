// Optional reference module: a live, paid TwitterAPI.io call over x402 from a browser wallet.
//
// The follower-proof demo does not need it. The page loads this file only when someone opens the Live option, so the
// wallet and x402 code never ships with the default, free path. It shows the pattern for a priced Airnode operation:
// confirm the live document, pay at most $0.01 in test aUSD after an explicit click, and keep the settlement receipt.
import { useState } from 'react';
import { LiveCallLoading } from '../components/ProjectDetailFrame';
import {
  AUSD_FAUCET_URL,
  MAX_PAYMENT_ATOMIC,
  connectWallet,
  createWalletPayingFetch,
  formatAusd,
  injectedProvider,
  readAusdBalance,
  readPaymentSettlement,
} from '../lib/browserPayment';
import type { ConnectedWallet, PaymentSettlement } from '../lib/browserPayment';
import { TWITTER_AIRNODE, fetchFollowerAttestation, isValidHandle } from '../lib/solanaFollowerProof';
import type { FollowerAttestation, FollowerRequest } from '../lib/solanaFollowerProof';

export interface LiveCapture {
  handle: string;
  request: FollowerRequest;
  attestation: FollowerAttestation;
  receivedAt: string;
  settlement?: PaymentSettlement;
}

interface LivePaidCallProps {
  busy: boolean;
  milestoneReady: boolean;
  onBusy(busy: '' | 'wallet' | 'fetch'): void;
  onError(message: string): void;
  onCaptured(capture: LiveCapture): Promise<void>;
}

function shortValue(value: string, keep = 6): string {
  return value.length <= keep * 2 + 1 ? value : `${value.slice(0, keep + 2)}…${value.slice(-keep)}`;
}

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

export default function LivePaidCall({ busy, milestoneReady, onBusy, onError, onCaptured }: LivePaidCallProps) {
  const [handle, setHandle] = useState('API3DAO');
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [fetching, setFetching] = useState(false);

  const handleValid = isValidHandle(handle);
  const canAfford = balance !== null && balance >= MAX_PAYMENT_ATOMIC;

  async function connect() {
    const provider = injectedProvider();
    if (!provider) {
      onError('No browser wallet was found. Install one that supports Base Sepolia, or use the recorded response.');
      return;
    }
    onError('');
    onBusy('wallet');
    try {
      const connected = await connectWallet(provider);
      setWallet(connected);
      setBalance(await readAusdBalance(connected.account));
    } catch (caught) {
      onError(message(caught));
    } finally {
      onBusy('');
    }
  }

  async function payAndFetch() {
    if (!wallet || !milestoneReady || !handleValid) return;
    onError('');
    onBusy('fetch');
    setFetching(true);
    try {
      let settlement: PaymentSettlement | undefined;
      const payingFetch = createWalletPayingFetch(wallet);
      const call = await fetchFollowerAttestation(handle, {
        payingFetcher: async (input, init) => {
          const response = await payingFetch(input, init);
          settlement = readPaymentSettlement(response);
          return response;
        },
      });
      setFetching(false);
      setBalance(await readAusdBalance(wallet.account).catch(() => balance));
      await onCaptured({ handle, request: call.request, attestation: call.attestation, receivedAt: call.receivedAt, settlement });
    } catch (caught) {
      setFetching(false);
      onError(message(caught));
      onBusy('');
    }
  }

  return (
    <>
      <p className="sfp-explain sfp-reference">
        Optional reference module. It pays for a fresh response with x402, signed in your Base Sepolia wallet, and costs{' '}
        {formatAusd(MAX_PAYMENT_ATOMIC)} in test aUSD per click. The rest of the demo works without it.
      </p>
      <label>
        <span>X handle</span>
        <input
          aria-invalid={!handleValid}
          maxLength={15}
          onChange={(event) => setHandle(event.target.value.replace(/^@/, ''))}
          value={handle}
        />
        {!handleValid && <small>1 to 15 letters, digits or underscores.</small>}
      </label>

      {!wallet ? (
        <div className="sfp-actions">
          <button className="workbench-run" disabled={busy} onClick={connect} type="button">
            Connect a Base Sepolia wallet
          </button>
          <small>The x402 facilitator settles the payment, so you need test aUSD but no ETH.</small>
        </div>
      ) : (
        <div className="sfp-actions">
          <button
            className="workbench-run"
            disabled={busy || !milestoneReady || !handleValid || !canAfford}
            onClick={payAndFetch}
            type="button"
          >
            {fetching ? 'Waiting for the wallet…' : `Pay ${formatAusd(MAX_PAYMENT_ATOMIC)} and fetch`}
          </button>
          <small>
            {shortValue(wallet.account)} · {balance === null ? 'balance unknown' : `${formatAusd(balance)} aUSD`}
            {!canAfford && (
              <> · <a href={AUSD_FAUCET_URL} target="_blank" rel="noreferrer">Mint test aUSD</a></>
            )}
          </small>
        </div>
      )}

      {fetching && (
        <LiveCallLoading
          title="Paying for and fetching a signed follower count"
          detail="Approve the $0.01 aUSD payment in your wallet. The Airnode then calls TwitterAPI.io and signs the projected count."
          sources={[{ name: TWITTER_AIRNODE.name, status: 'waiting' }]}
        />
      )}
    </>
  );
}
