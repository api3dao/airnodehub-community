// Records one signed TwitterAPI.io follower count as the fixture the site and the program tests share.
//
// Costs $0.01 in aUSD, API3's test dollar on Base Sepolia. The payer needs aUSD (mint it at
// https://airnodehub.api3.org/faucet) but no ETH. Run from site/ so the dependencies resolve:
//
//   PAYER_PRIVATE_KEY=0x... node scripts/capture-solana-follower-fixture.mjs API3DAO
//
// The key is read from the environment only and never written anywhere.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExactEvmScheme } from '@x402/evm';
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { privateKeyToAccount } from 'viem/accounts';

const AIRNODE_URL = 'https://airnode-twitterapi.fly.dev/';
const BASE_SEPOLIA = 'eip155:84532';
const AUSD = '0xbeA34973e5f67F18F656A2C6070C64326C791808';
const MAX_ATOMIC = 10_000n; // $0.01
const OUTPUT = fileURLToPath(new URL('../public/fixtures/twitterapi-userinfo-followers.json', import.meta.url));

const handle = process.argv[2] ?? 'API3DAO';
if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) throw new Error('The handle must be 1 to 15 letters, digits or underscores.');
const key = process.env.PAYER_PRIVATE_KEY;
if (!key?.startsWith('0x')) throw new Error('Set PAYER_PRIVATE_KEY to a Base Sepolia key that holds aUSD.');

let paid = false;
const payingFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: BASE_SEPOLIA, client: new ExactEvmScheme(privateKeyToAccount(key)) }],
  spendControls: {
    maxAmountPerPayment: '$0.01',
    allowedAssets: [{ network: BASE_SEPOLIA, asset: AUSD, maxAmountPerPayment: MAX_ATOMIC.toString() }],
  },
  policies: [
    (_version, requirements) => {
      if (paid) return [];
      const affordable = requirements.filter(
        ({ asset, amount }) => asset.toLowerCase() === AUSD.toLowerCase() && BigInt(amount) <= MAX_ATOMIC,
      );
      paid = affordable.length > 0;
      return affordable;
    },
  ],
});

const request = {
  operation: 'userInfo',
  parameters: { userName: handle },
  responseProjection: { followers: '/data/followers' },
};
const response = await payingFetch(AIRNODE_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
});
const text = await response.text();
if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
const settlementHeader = response.headers.get('PAYMENT-RESPONSE');
const settlement = settlementHeader ? decodePaymentResponseHeader(settlementHeader) : null;

const fixture = {
  description:
    'A real TwitterAPI.io userInfo response projected to the follower count, as signed by its Airnode. Shared by the site and the Solana program tests.',
  capturedAt: new Date().toISOString(),
  source: { listing: 'TwitterAPI.io', url: AIRNODE_URL, signer: '0x7B02Fd3324D2dC362f65a9c01e59EC5fDb4E1CCB' },
  request,
  response: JSON.parse(text),
  payment: settlement && { network: BASE_SEPOLIA, transaction: settlement.transaction ?? null },
};
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Wrote ${OUTPUT}`);
console.log(`data: ${fixture.response.data}`);
