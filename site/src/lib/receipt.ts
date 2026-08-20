import type { Receipt } from './types';

export function cloneReceipt(receipt: Receipt): Receipt {
  return JSON.parse(JSON.stringify(receipt)) as Receipt;
}

export function tamperWithPrice(receipt: Receipt): Receipt {
  const tampered = cloneReceipt(receipt);
  const data = tampered.attestation.data as Record<string, unknown>;
  tampered.normalized.value += 100;

  if (tampered.selected.candidate.listing === 'nodary') {
    const feed = data['ETH/USD'] as Record<string, unknown>;
    feed.value = Number(feed.value) + 100;
  } else if (tampered.selected.candidate.listing === 'coingecko') {
    const ethereum = data.ethereum as Record<string, unknown>;
    ethereum.usd = Number(ethereum.usd) + 100;
  } else {
    const key = 'price' in data ? 'price' : 'last_price';
    data[key] = Number(data[key]) + 100;
  }

  return tampered;
}

export function downloadReceipt(receipt: Receipt): void {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `airnodehub-receipt-${receipt.selected.candidate.listing}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
