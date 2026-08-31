/**
 * ЮKassa mock integration layer.
 *
 * In production, replace the mock functions with real API calls.
 * The structure is identical — only the HTTP calls change.
 */

import { config } from './config.js';

interface YooKassaPayment {
  id: string;
  amount: { value: string; currency: string };
  status: 'pending' | 'succeeded' | 'cancelled';
  confirmation?: { confirmation_url: string };
  description?: string;
  metadata?: Record<string, string>;
}

interface YooKassaSubscription {
  id: string;
  status: 'active' | 'cancelled' | 'expired';
  current_period_start: string;
  current_period_end: string;
}

const isTestMode = config.yookassa.shopId === 'test' || config.yookassa.secretKey === 'test';

// ===== MOCK IMPLEMENTATION =====

let mockPaymentCounter = 0;

export async function createPayment(
  amountKopeks: number,
  description: string,
  metadata: Record<string, string> = {}
): Promise<YooKassaPayment> {
  if (!isTestMode) {
    // REAL IMPLEMENTATION (uncomment in production):
    // const response = await fetch('https://api.yookassa.ru/v3/payments', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': 'Basic ' + Buffer.from(`${config.yookassa.shopId}:${config.yookassa.secretKey}`).toString('base64'),
    //     'Content-Type': 'application/json',
    //     'Idempotency-Key': nanoid(),
    //   },
    //   body: JSON.stringify({
    //     amount: { value: (amountKopeks / 100).toFixed(2), currency: 'RUB' },
    //     confirmation: { type: 'redirect', return_url: `${config.appUrl}/dashboard/billing` },
    //     capture: true,
    //     description,
    //     metadata,
    //   }),
    // });
    // return response.json();
  }

  // MOCK: simulate payment creation
  mockPaymentCounter++;
  const paymentId = `mock_payment_${mockPaymentCounter}_${Date.now()}`;

  return {
    id: paymentId,
    amount: { value: (amountKopeks / 100).toFixed(2), currency: 'RUB' },
    status: 'pending',
    confirmation: { confirmation_url: `${config.appUrl}/payment/mock?payment_id=${paymentId}` },
    description,
    metadata,
  };
}

export async function getPayment(paymentId: string): Promise<YooKassaPayment | null> {
  if (!isTestMode) {
    // REAL: await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, ...)
  }

  // MOCK: if starts with mock_, it's always succeeded after creation
  if (paymentId.startsWith('mock_')) {
    return {
      id: paymentId,
      amount: { value: '100.00', currency: 'RUB' },
      status: 'succeeded',
      description: 'Mock payment',
    };
  }
  return null;
}

export async function createSubscription(
  planCode: string,
  amountKopeks: number,
  metadata: Record<string, string> = {}
): Promise<YooKassaSubscription> {
  if (!isTestMode) {
    // REAL: POST to https://api.yookassa.ru/v3/subscriptions
  }

  // MOCK
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return {
    id: `mock_sub_${Date.now()}`,
    status: 'active',
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
  };
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  if (!isTestMode) {
    // REAL: POST to https://api.yookassa.ru/v3/subscriptions/${id}/cancel
  }
  // MOCK: no-op
}

export function isTestModeEnabled(): boolean {
  return isTestMode;
}
