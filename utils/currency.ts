import { CurrencyCode } from '../types/common';

export interface NormalizedCurrencyAmount {
  amountUsd: number;
  amountLbp: number;
  rate: number;
}

export function normalizeCurrencyAmount(
  amount: number,
  currency: CurrencyCode,
  rateInput: number | string
): NormalizedCurrencyAmount {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  const rate = Number(rateInput);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Exchange rate must be a positive number');
  }

  if (currency === 'USD') {
    return {
      amountUsd: roundToTwoDecimals(amount),
      amountLbp: roundToTwoDecimals(amount * rate),
      rate,
    };
  }

  return {
    amountUsd: roundToTwoDecimals(amount / rate),
    amountLbp: roundToTwoDecimals(amount),
    rate,
  };
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
