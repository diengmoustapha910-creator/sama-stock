import {
  Plan,
  PlanFeatureKey,
  Subscription,
  SubscriptionStatus,
  BillingCycle,
  PaymentTransaction,
  SubscriptionEvent,
} from '../types';

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  limit: number; // -1 for unlimited
  current: number;
  upgradeSuggestedPlan?: 'Professionnel' | 'Entreprise';
}

export interface FeatureAccessResult {
  allowed: boolean;
  reason?: string;
  upgradeSuggestedPlan?: 'Professionnel' | 'Entreprise';
}

// Human-readable labels and descriptions for plan features
export const PLAN_FEATURE_DEFINITIONS: Record<
  PlanFeatureKey,
  { label: string; description: string; minPlan: 'Professionnel' | 'Entreprise' }
> = {
  unlimited_products: {
    label: 'Produits & Articles Illimités',
    description: 'Aucune limite sur la taille de votre catalogue produits.',
    minPlan: 'Professionnel',
  },
  unlimited_invoices: {
    label: 'Factures & Devis Illimités',
    description: 'Émission illimitée de factures officielles, devis et reçus.',
    minPlan: 'Professionnel',
  },
  sales_purchases: {
    label: 'Gestion des Ventes & Achats',
    description: 'Enregistrement des ventes comptoir POS et commandes fournisseurs.',
    minPlan: 'Professionnel',
  },
  expenses_management: {
    label: 'Gestion des Dépenses & Charges',
    description: 'Suivi des frais d’exploitation (loyer, salaires, électricité, transport).',
    minPlan: 'Professionnel',
  },
  advanced_reports: {
    label: 'Rapports Financiers Avancés',
    description: 'Marges réelles, rentabilité nette, bilan des créances et dettes.',
    minPlan: 'Professionnel',
  },
  pdf_excel_exports: {
    label: 'Exports PDF & Excel',
    description: 'Téléchargement de vos bilans comptables et catalogues au format Excel/PDF.',
    minPlan: 'Professionnel',
  },
  offline_sync: {
    label: 'Mode Hors-Ligne & Synchronisation',
    description: 'Continuité de caisse même en cas de panne réseau avec sync automatique.',
    minPlan: 'Professionnel',
  },
  multi_users: {
    label: 'Comptes Multi-Utilisateurs & Rôles',
    description: 'Accès différencié pour gérants, vendeurs et comptables.',
    minPlan: 'Professionnel',
  },
  multi_stores: {
    label: 'Multi-Boutiques & Dépôts',
    description: 'Gestion de plusieurs magasins, succursales ou entrepôts en parallèle.',
    minPlan: 'Entreprise',
  },
  advanced_permissions: {
    label: 'Permissions & Sécurité Avancées',
    description: 'Contrôle granulaire des remises maximales, annulations et accès caisse.',
    minPlan: 'Entreprise',
  },
  consolidated_reports: {
    label: 'Rapports Consolidés Groupe',
    description: 'Vue d’ensemble globale multi-boutiques et performances comparées.',
    minPlan: 'Entreprise',
  },
  inter_store_transfers: {
    label: 'Transferts Inter-Boutiques',
    description: 'Mouvements de stock traçables d’une succursale à une autre.',
    minPlan: 'Entreprise',
  },
  priority_support: {
    label: 'Assistance VIP & Support Dédié',
    description: 'Support technique prioritaire par WhatsApp, téléphone et télémaintenance.',
    minPlan: 'Entreprise',
  },
};

/**
 * Check if a subscription is considered in a functional state
 * (active, in grace period, or scheduled for cancellation at period end)
 */
export const isSubscriptionActive = (status: SubscriptionStatus): boolean => {
  return status === 'actif' || status === 'gratuit' || status === 'periode_grace' || status === 'resiliation_programmee';
};

/**
 * Check if adding a new product is allowed under the current plan and limits
 */
export const checkProductLimit = (
  plan: Plan,
  currentActiveProductsCount: number,
  status: SubscriptionStatus
): AccessCheckResult => {
  // If subscription is expired or suspended, restrict to free limit
  const limit = plan.limits.maxProducts;

  if (status === 'expire' || status === 'suspendu') {
    const freeLimit = 5;
    if (currentActiveProductsCount >= freeLimit) {
      return {
        allowed: false,
        reason: `Votre abonnement est expiré. La formule Gratuite est limitée à ${freeLimit} produits. Passez à une formule supérieure ou renouvelez votre abonnement pour ajouter d'autres articles.`,
        limit: freeLimit,
        current: currentActiveProductsCount,
        upgradeSuggestedPlan: 'Professionnel',
      };
    }
  }

  // -1 indicates unlimited products
  if (limit === -1) {
    return {
      allowed: true,
      limit: -1,
      current: currentActiveProductsCount,
    };
  }

  if (currentActiveProductsCount >= limit) {
    const suggested: 'Professionnel' | 'Entreprise' =
      plan.id === 'plan-gratuit' ? 'Professionnel' : 'Entreprise';
    return {
      allowed: false,
      reason: `Vous avez atteint la limite de ${limit} produits de votre formule ${plan.name}. Passez à la formule ${suggested} pour augmenter votre capacité.`,
      limit,
      current: currentActiveProductsCount,
      upgradeSuggestedPlan: suggested,
    };
  }

  return {
    allowed: true,
    limit,
    current: currentActiveProductsCount,
  };
};

/**
 * Check if adding a new user account is allowed under the current plan
 */
export const checkUserLimit = (
  plan: Plan,
  currentUsersCount: number,
  status: SubscriptionStatus
): AccessCheckResult => {
  const limit = plan.limits.maxUsers;

  if (status === 'expire' || status === 'suspendu') {
    if (currentUsersCount >= 1) {
      return {
        allowed: false,
        reason: `Votre abonnement est expiré. La formule gratuite ne permet qu'un seul compte utilisateur actif.`,
        limit: 1,
        current: currentUsersCount,
        upgradeSuggestedPlan: 'Professionnel',
      };
    }
  }

  if (limit === -1) {
    return { allowed: true, limit: -1, current: currentUsersCount };
  }

  if (currentUsersCount >= limit) {
    const nextPlan = limit < 3 ? 'Professionnel' : 'Entreprise';
    return {
      allowed: false,
      reason: `Vous avez atteint la limite de ${limit} utilisateur${limit > 1 ? 's' : ''} de votre formule ${plan.name}. Passez à la formule ${nextPlan} pour ajouter d'autres collaborateurs.`,
      limit,
      current: currentUsersCount,
      upgradeSuggestedPlan: nextPlan,
    };
  }

  return {
    allowed: true,
    limit,
    current: currentUsersCount,
  };
};

/**
 * Check if adding a new physical store or point of sale is allowed
 */
export const checkStoreLimit = (
  plan: Plan,
  currentStoresCount: number,
  status: SubscriptionStatus
): AccessCheckResult => {
  const limit = plan.limits.maxStores;

  if (status === 'expire' || status === 'suspendu') {
    if (currentStoresCount >= 1) {
      return {
        allowed: false,
        reason: `Votre abonnement est expiré. La formule gratuite ne gère qu'une seule boutique. Réactivez votre formule Entreprise pour le multi-boutiques.`,
        limit: 1,
        current: currentStoresCount,
        upgradeSuggestedPlan: 'Entreprise',
      };
    }
  }

  if (limit === -1) {
    return { allowed: true, limit: -1, current: currentStoresCount };
  }

  if (currentStoresCount >= limit) {
    return {
      allowed: false,
      reason: `Votre formule ${plan.name} est configurée pour ${limit} boutique unique. Passez à la formule Entreprise pour créer plusieurs points de vente et entrepôts.`,
      limit,
      current: currentStoresCount,
      upgradeSuggestedPlan: 'Entreprise',
    };
  }

  return {
    allowed: true,
    limit,
    current: currentStoresCount,
  };
};

/**
 * Check if creating an invoice is allowed this month
 */
export const checkInvoiceLimit = (
  plan: Plan,
  currentMonthInvoicesCount: number,
  status: SubscriptionStatus
): AccessCheckResult => {
  const limit = plan.limits.maxInvoicesPerMonth;

  if (status === 'expire' || status === 'suspendu') {
    const freeLimit = 3;
    if (currentMonthInvoicesCount >= freeLimit) {
      return {
        allowed: false,
        reason: `Vous avez atteint la limite mensuelle de ${freeLimit} factures de la formule Gratuite suite à l'expiration de votre abonnement. Passez à une formule supérieure pour continuer.`,
        limit: freeLimit,
        current: currentMonthInvoicesCount,
        upgradeSuggestedPlan: 'Professionnel',
      };
    }
  }

  if (limit === -1) {
    return { allowed: true, limit: -1, current: currentMonthInvoicesCount };
  }

  if (currentMonthInvoicesCount >= limit) {
    const suggested: 'Professionnel' | 'Entreprise' =
      plan.id === 'plan-gratuit' ? 'Professionnel' : 'Entreprise';
    return {
      allowed: false,
      reason: `Vous avez atteint votre quota mensuel de ${limit} factures de la formule ${plan.name}. Passez à la formule ${suggested} pour augmenter votre quota mensuel.`,
      limit,
      current: currentMonthInvoicesCount,
      upgradeSuggestedPlan: suggested,
    };
  }

  return {
    allowed: true,
    limit,
    current: currentMonthInvoicesCount,
  };
};

/**
 * Check if a specific feature is enabled for the plan and subscription state
 */
export const hasFeatureAccess = (
  plan: Plan,
  featureKey: PlanFeatureKey,
  status: SubscriptionStatus
): FeatureAccessResult => {
  const featDef = PLAN_FEATURE_DEFINITIONS[featureKey];

  if (status === 'expire' || status === 'suspendu') {
    return {
      allowed: false,
      reason: `Votre abonnement est expiré. La fonctionnalité « ${featDef.label} » nécessite un abonnement actif.`,
      upgradeSuggestedPlan: featDef.minPlan,
    };
  }

  const isIncluded = plan.features.includes(featureKey);
  if (!isIncluded) {
    return {
      allowed: false,
      reason: `La fonctionnalité « ${featDef.label} » est réservée aux abonnés de la formule ${featDef.minPlan} ou supérieure.`,
      upgradeSuggestedPlan: featDef.minPlan,
    };
  }

  return { allowed: true };
};

/**
 * Compute the next renewal date based on billing cycle (30 days for month, 365 for year)
 */
export const computeRenewalDate = (fromDate: Date = new Date(), cycle: BillingCycle = 'mensuel'): string => {
  const d = new Date(fromDate);
  if (cycle === 'annuel') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
};

/**
 * Calculate Monthly Recurring Revenue (MRR) in FCFA
 */
export const calculateMRR = (subscriptions: Subscription[], plans: Plan[]): number => {
  return subscriptions.reduce((sum, sub) => {
    if (!isSubscriptionActive(sub.status) || sub.status === 'gratuit' || sub.isComped) {
      return sum;
    }
    const plan = plans.find((p) => p.id === sub.planId);
    if (!plan) return sum;

    if (sub.billingCycle === 'annuel') {
      return sum + Math.round(plan.annualPrice / 12);
    }
    return sum + plan.monthlyPrice;
  }, 0);
};

/**
 * Calculate Annual Recurring Revenue (ARR) in FCFA
 */
export const calculateARR = (subscriptions: Subscription[], plans: Plan[]): number => {
  return calculateMRR(subscriptions, plans) * 12;
};

/**
 * Generate a unique, professional transaction reference for Senegal payments
 */
export const generateTransactionReference = (provider: 'wave' | 'orange_money' | 'carte' | 'virement'): string => {
  const prefix = provider === 'wave' ? 'WAVE' : provider === 'orange_money' ? 'OM' : provider === 'carte' ? 'CB' : 'VIR';
  const rand = Math.floor(100000 + Math.random() * 900000);
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `SAMA-${prefix}-${dateStr}-${rand}`;
};
