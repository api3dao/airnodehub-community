import { ExactEvmScheme } from '@x402/evm';
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { createPublicClient, createWalletClient, custom, erc20Abi, formatUnits, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { Address } from './types';

// AirnodeHub prices calls in aUSD, API3's test dollar on Base Sepolia. It has no real value.
export const BASE_SEPOLIA = 'eip155:84532' as const;
export const AUSD_ADDRESS = '0xbeA34973e5f67F18F656A2C6070C64326C791808' as Address;
export const AUSD_DECIMALS = 6;
export const AUSD_FAUCET_URL = 'https://airnodehub.api3.org/faucet';
// The most a single click may spend: one $0.01 call
export const MAX_PAYMENT_ATOMIC = 10_000n;

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
}

export function injectedProvider(): Eip1193Provider | null {
  const candidate = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return candidate ?? null;
}

export interface ConnectedWallet {
  provider: Eip1193Provider;
  account: Address;
}

export async function connectWallet(provider: Eip1193Provider): Promise<ConnectedWallet> {
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as Address[];
  if (!accounts[0]) throw new Error('The wallet did not share an account.');
  // The payment is EIP-712 typed data bound to Base Sepolia, which wallets only sign on the matching chain
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x14a34' }] });
  } catch {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: '0x14a34',
          chainName: 'Base Sepolia',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org'],
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        },
      ],
    });
  }
  return { provider, account: accounts[0] };
}

export async function readAusdBalance(account: Address): Promise<bigint> {
  const client = createPublicClient({ chain: baseSepolia, transport: http() });
  return client.readContract({ address: AUSD_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account] });
}

export function formatAusd(amount: bigint): string {
  return `$${formatUnits(amount, AUSD_DECIMALS)}`;
}

export interface PaymentSettlement {
  success: boolean;
  transaction?: string;
}

// A fetch that answers one 402 by asking the wallet to sign an aUSD payment of at most MAX_PAYMENT_ATOMIC. The
// x402 facilitator submits the transfer, so the wallet needs aUSD but no ETH.
export function createWalletPayingFetch(wallet: ConnectedWallet): typeof fetch {
  const walletClient = createWalletClient({
    account: wallet.account,
    chain: baseSepolia,
    transport: custom(wallet.provider),
  });
  const signer = {
    address: wallet.account,
    signTypedData: (message: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) =>
      // x402 builds the typed data at runtime, so it is passed through untyped
      walletClient.signTypedData({
        account: wallet.account,
        ...message,
      } as unknown as Parameters<typeof walletClient.signTypedData>[0]),
  };
  let paid = false;

  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: BASE_SEPOLIA, client: new ExactEvmScheme(signer) }],
    spendControls: {
      maxAmountPerPayment: formatAusd(MAX_PAYMENT_ATOMIC),
      allowedAssets: [
        { network: BASE_SEPOLIA, asset: AUSD_ADDRESS, maxAmountPerPayment: MAX_PAYMENT_ATOMIC.toString() },
      ],
    },
    // Only aUSD, only up to the cap, and only once per fetch created
    policies: [
      (_version, requirements) => {
        if (paid) return [];
        const affordable = requirements.filter(
          ({ asset, amount }) =>
            asset.toLowerCase() === AUSD_ADDRESS.toLowerCase() && BigInt(amount) <= MAX_PAYMENT_ATOMIC,
        );
        if (affordable.length > 0) paid = true;
        return affordable;
      },
    ],
  });
}

export function readPaymentSettlement(response: Response): PaymentSettlement | undefined {
  const header = response.headers.get('PAYMENT-RESPONSE');
  if (!header) return undefined;
  const settlement = decodePaymentResponseHeader(header) as { success?: boolean; transaction?: string };
  return { success: Boolean(settlement.success), transaction: settlement.transaction };
}
