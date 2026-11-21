import {
  UnitechPayConfig,
  UnitechPayOrder,
  UnitechPayWebhookLog,
  UnitechPayWebhookNotification,
} from '../types';
import { getAuthHeaders } from './storage';

/**
 * UnitechPay Client Service for SAMA STOCK (Admin-only)
 */

export async function getUnitechPayConfig(): Promise<UnitechPayConfig> {
  const res = await fetch('/api/unitechpay/config', {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Erreur récupération config UnitechPay (${res.status})`);
  }
  const data = await res.json();
  return data.config;
}

export async function updateUnitechPayConfig(
  updates: Partial<UnitechPayConfig>
): Promise<{ success: boolean; config: UnitechPayConfig; message: string }> {
  const res = await fetch('/api/unitechpay/config', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur mise à jour config (${res.status})`);
  }
  return await res.json();
}

export async function configureRemoteUnitechPayWebhook(
  customWebhookUrl?: string
): Promise<{ success: boolean; message: string; remoteResponse?: any; configuredUrl: string }> {
  const res = await fetch('/api/unitechpay/configure-remote', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ webhookUrl: customWebhookUrl }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Échec de la configuration du webhook UnitechPay');
  }
  return data;
}

export async function createUnitechPayOrder(orderData: {
  planId: string;
  planName: string;
  billingCycle: 'mensuel' | 'annuel';
  amount: number;
  description?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  samaStockUserId: string;
  samaStockSubscriptionId: string;
}): Promise<{
  success: boolean;
  order: UnitechPayOrder;
  wavePaymentUrl: string;
  reference: string;
  paymentUrlDomain?: string;
}> {
  const res = await fetch('/api/unitechpay/create-order', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(orderData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(
      data?.error ||
        data?.message ||
        'Erreur lors de la création de la commande de paiement Wave UnitechPay'
    );
  }

  const rawUrl = data.wavePaymentUrl;
  if (typeof rawUrl !== 'string' || !/^https:\/\/[^/\s]+/i.test(rawUrl)) {
    throw new Error(
      'Le lien de paiement Wave retourné par UnitechPay est absent ou invalide.'
    );
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' || rawUrl === String(data.reference || '')) {
      throw new Error('URL Wave invalide');
    }
  } catch {
    throw new Error(
      'Le lien de paiement Wave retourné par UnitechPay n’est pas une URL HTTPS valide.'
    );
  }

  return data;
}

export async function getUnitechPayOrders(): Promise<UnitechPayOrder[]> {
  const res = await fetch('/api/unitechpay/orders', {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.orders || [];
}

export async function getUnitechPayWebhookLogs(): Promise<UnitechPayWebhookLog[]> {
  const res = await fetch('/api/unitechpay/webhook-logs', {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.logs || [];
}

export async function getUnitechPayOrderStatus(reference: string): Promise<{
  success: boolean;
  reference: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  isPaid: boolean;
  webhookVerified: boolean;
  transactionId?: string | number;
  receiptNumber?: string;
  paidAt?: string;
  message: string;
}> {
  const res = await fetch(`/api/unitechpay/order-status/${encodeURIComponent(reference)}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erreur vérification statut (${res.status})`);
  }
  return await res.json();
}

export async function runUnitechPaySimulation(scenario: {
  type:
    | 'payment_completed'
    | 'payment_failed'
    | 'payment_expired'
    | 'invalid_signature'
    | 'unknown_reference'
    | 'amount_mismatch'
    | 'duplicate_notification'
    | 'delayed_notification';
  reference?: string;
  amount?: number;
  planId?: string;
  billingCycle?: 'mensuel' | 'annuel';
  customPayload?: Partial<UnitechPayWebhookNotification>;
}): Promise<{
  success: boolean;
  httpStatus: number;
  message: string;
  response: any;
  log?: UnitechPayWebhookLog;
}> {
  const res = await fetch('/api/unitechpay/simulate-test', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(scenario),
  });
  const data = await res.json();
  return {
    success: res.ok,
    httpStatus: res.status,
    message: data.message || (res.ok ? 'Simulation exécutée avec succès' : 'Échec de la simulation'),
    response: data,
    log: data.log,
  };
}

