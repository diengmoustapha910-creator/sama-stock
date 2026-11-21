import {
  Product,
  Store,
  Organization,
  User,
  Customer,
  Supplier,
  Sale,
  Invoice,
  Purchase,
  Expense,
  InventorySession,
  StockMovement,
  SyncOperation,
  CashRegisterShift,
  Category,
  Plan,
  Subscription,
  PaymentTransaction,
  SubscriptionEvent,
  UnitechPayConfig,
  UnitechPayOrder,
  UnitechPayWebhookLog,
} from '../types';

export const formatFCFA = (amount: number): string => {
  if (isNaN(amount)) return '0 FCFA';
  return Math.round(amount).toLocaleString('fr-FR').replace(/\s/g, ' ') + ' FCFA';
};

export const defaultCategories: Category[] = [
  {
    id: 'cat-alimentation',
    name: 'Alimentation Générale',
    slug: 'alimentation-generale',
    description: 'Riz, sucre, huile, farine, conserves et denrées alimentaires courantes',
    icon: '🛒',
    color: '#059669',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-boissons',
    name: 'Boissons & Jus',
    slug: 'boissons-jus',
    description: 'Eaux minérales, jus de fruits locaux (Bissap, Bouye, Mangue), sodas et thés',
    icon: '🥤',
    color: '#0284c7',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-produits-laitiers',
    name: 'Produits Laitiers & Frais',
    slug: 'produits-laitiers',
    description: 'Lait concentré, yaourts, beurre, fromages et dérivés frais',
    icon: '🥛',
    color: '#2563eb',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-entretien',
    name: 'Entretien & Nettoyage',
    slug: 'entretien-nettoyage',
    description: 'Savons, poudres à laver, eau de javel, désinfectants et éponges',
    icon: '🧼',
    color: '#7c3aed',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-cosmetique',
    name: 'Cosmétique & Hygiène',
    slug: 'cosmetique-hygiene',
    description: 'Soins corporels, crèmes, savons de toilette, dentifrices et parfums',
    icon: '✨',
    color: '#db2777',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-electronique',
    name: 'Électronique & Téléphonie',
    slug: 'electronique-telephonie',
    description: 'Accessoires smartphones, chargeurs, câbles, écouteurs et ampoules LED',
    icon: '📱',
    color: '#d97706',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-quincaillerie',
    name: 'Quincaillerie & Bricolage',
    slug: 'quincaillerie-bricolage',
    description: 'Outillage, clous, vis, peinture, raccords et matériel de construction',
    icon: '🔨',
    color: '#475569',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-textile',
    name: 'Textile & Habillement',
    slug: 'textile-habillement',
    description: 'Tissus, vêtements, pagnes traditionnels, chaussures et accessoires',
    icon: '👕',
    color: '#4f46e5',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-divers',
    name: 'Divers & Autres',
    slug: 'divers-autres',
    description: 'Articles divers et produits hors catégories principales',
    icon: '📦',
    color: '#64748b',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

export const defaultOrganization: Organization = {
  name: 'SAMA STOCK COMMERCE & DISTRIBUTION',
  slogan: 'Gérez votre stock. Développez votre business.',
  phone: '+221 77 450 12 34',
  email: 'diengmoustapha910@gmail.com',
  address: 'Avenue Blaise Diagne x Rue 11, Médina',
  city: 'Dakar',
  country: 'Sénégal',
  currency: 'FCFA',
  vatEnabled: true,
  vatRate: 18,
  logoUrl: '/assets/aistudio/Logo_SAMA_STOCK__gestion_et_croissance_7ffcabd3.png',
  waveNumber: '+221 77 450 12 34',
  orangeMoneyNumber: '+221 78 510 22 88',
  bankDetails: 'CBAO Sénégal - IBAN: SN08 SN01 2011 5000 2345 6789 0122',
  loyaltySettings: {
    enabled: true,
    amountPerPoint: 1000,
    pointValueFCFA: 25,
    minRedeemPoints: 10,
  },
  receiptFooter: 'Merci pour votre confiance ! À bientôt.',
  receiptShowLogo: true,
  receiptDefaultWidth: '80mm',
};

export const defaultStores: Store[] = [
  {
    id: 'store-principale',
    name: 'Boutique Principale',
    address: 'Dakar',
    city: 'Dakar',
    phone: '+221 77 450 12 34',
    isMain: true,
  },
];

export const defaultUsers: User[] = [
  {
    id: 'acc-admin-primary',
    name: 'Moustapha Dieng',
    email: 'diengmoustapha910@gmail.com',
    phone: '+221 77 450 12 34',
    role: 'administrateur',
    storeIds: ['store-principale'],
    active: true,
  },
];

export const defaultCustomers: Customer[] = [];

export const defaultSuppliers: Supplier[] = [];

export const defaultProducts: Product[] = [];

export const defaultStockMovements: StockMovement[] = [];

export const defaultSales: Sale[] = [];

export const defaultInvoices: Invoice[] = [];

export const defaultExpenses: Expense[] = [];

export const defaultPurchases: Purchase[] = [];

export const defaultRegisterShift: CashRegisterShift | null = null;

export const defaultPlans: Plan[] = [
  {
    id: 'plan-gratuit',
    name: 'Gratuit',
    slug: 'gratuit',
    monthlyPrice: 0,
    annualPrice: 0,
    badge: 'Essentiel',
    description: 'Pour démarrer et tester SAMA STOCK (jusqu’à 5 produits, 1 boutique, 3 factures/mois).',
    limits: {
      maxProducts: 5,
      maxUsers: 1,
      maxStores: 1,
      maxInvoicesPerMonth: 3,
    },
    features: ['sales_purchases'],
    isPopular: false,
    active: true,
  },
  {
    id: 'plan-pro',
    name: 'Professionnel',
    slug: 'professionnel',
    monthlyPrice: 5000,
    annualPrice: 50000, // 2 mois offerts !
    badge: 'Populaire',
    description: 'Pour commerçants et boutiques en croissance (jusqu’à 250 produits, 1 boutique, 50 factures/mois).',
    limits: {
      maxProducts: 250,
      maxUsers: 3,
      maxStores: 1,
      maxInvoicesPerMonth: 50,
    },
    features: [
      'sales_purchases',
      'expenses_management',
      'advanced_reports',
      'pdf_excel_exports',
      'offline_sync',
      'multi_users',
    ],
    isPopular: true,
    active: true,
  },
  {
    id: 'plan-entreprise',
    name: 'Entreprise',
    slug: 'entreprise',
    monthlyPrice: 12000,
    annualPrice: 120000, // 2 mois offerts
    badge: 'Multi-Boutiques',
    description: 'Pour grossistes, chaînes de magasins et transferts inter-boutiques.',
    limits: {
      maxProducts: -1,
      maxUsers: 10,
      maxStores: -1,
      maxInvoicesPerMonth: -1,
    },
    features: [
      'unlimited_products',
      'unlimited_invoices',
      'sales_purchases',
      'expenses_management',
      'advanced_reports',
      'pdf_excel_exports',
      'offline_sync',
      'multi_users',
      'multi_stores',
      'advanced_permissions',
      'consolidated_reports',
      'inter_store_transfers',
      'priority_support',
    ],
    isPopular: false,
    active: true,
  },
];

export const defaultSubscription: Subscription = {
  id: 'sub-org-default',
  organizationId: 'org-default',
  planId: 'plan-gratuit',
  status: 'gratuit',
  billingCycle: 'mensuel',
  startDate: new Date().toISOString(),
  cancelAtPeriodEnd: false,
  paymentMethod: 'gratuit',
  notes: 'Formule initiale gratuite accordée sans interruption des données.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const defaultPaymentTransactions: PaymentTransaction[] = [];

export const defaultSubscriptionEvents: SubscriptionEvent[] = [
  {
    id: 'evt-init',
    subscriptionId: 'sub-org-default',
    type: 'CREATED',
    description: 'Initialisation automatique de la formule Gratuite SAMA STOCK',
    performedBy: 'Système',
    date: new Date().toISOString(),
  },
];

export const defaultUnitechPayConfig: UnitechPayConfig = {
  apiUrl: 'https://api.unitech.sn/api.php',
  apiKey: '',
  webhookUrl: '',
  events: ['payment_completed', 'payment_failed', 'payment_expired'],
  isConfiguredWithUnitech: false,
  signatureMethod: 'auto',
  autoActivate: true,
};

export const defaultUnitechPayOrders: UnitechPayOrder[] = [];

export const defaultUnitechPayWebhookLogs: UnitechPayWebhookLog[] = [];

// Storage keys (v2 - Clean real store without mock products/accounts)
export const STORAGE_KEYS = {
  ORG: 'samastock_org_v2',
  STORES: 'samastock_stores_v2',
  USERS: 'samastock_users_v2',
  CURRENT_USER: 'samastock_cur_user_v2',
  AUTH_STATE: 'samastock_auth_state_v2',
  ACTIVE_STORE: 'samastock_act_store_v2',
  CATEGORIES: 'samastock_categories_v2',
  PRODUCTS: 'samastock_products_v2',
  CUSTOMERS: 'samastock_customers_v2',
  SUPPLIERS: 'samastock_suppliers_v2',
  SALES: 'samastock_sales_v2',
  INVOICES: 'samastock_invoices_v2',
  PURCHASES: 'samastock_purchases_v2',
  EXPENSES: 'samastock_expenses_v2',
  MOVEMENTS: 'samastock_movements_v2',
  INVENTORIES: 'samastock_inventories_v2',
  REGISTER_SHIFT: 'samastock_shift_v2',
  SYNC_OPERATIONS: 'samastock_sync_v2',
  OFFLINE_MODE: 'samastock_offline_mode_v2',
  PLANS: 'samastock_plans_v2',
  SUBSCRIPTION: 'samastock_subscription_v2',
  PAYMENT_TRANSACTIONS: 'samastock_transactions_v2',
  SUBSCRIPTION_EVENTS: 'samastock_sub_events_v2',
  UNITECHPAY_CONFIG: 'samastock_unitech_config_v2',
  UNITECHPAY_ORDERS: 'samastock_unitech_orders_v2',
  UNITECHPAY_WEBHOOK_LOGS: 'samastock_unitech_webhook_logs_v2',
};

export const SESSION_TOKEN_KEY = 'samastock_session_token_v1';
export const LEGACY_MIGRATION_DONE_KEY = 'samastock_legacy_migrated_v1';

let inMemoryCsrfToken = '';

export const setInMemoryCsrfToken = (token?: string): void => {
  inMemoryCsrfToken = typeof token === 'string' ? token.trim() : '';
};

export const clearInMemoryCsrfToken = (): void => {
  inMemoryCsrfToken = '';
};

export const getStoredSessionToken = (): string => {
  return '';
};

export const setStoredSessionToken = (_token: string): void => {
  clearStoredSessionToken();
};

export const clearStoredSessionToken = (): void => {
  clearInMemoryCsrfToken();
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore
  }
};

export const getAuthHeaders = (extra?: Record<string, string>): Record<string, string> => {
  return {
    ...(inMemoryCsrfToken ? { 'X-CSRF-Token': inMemoryCsrfToken } : {}),
    ...(extra || {}),
  };
};

export const formatDakarDate = (dateInput: string | number | Date): string => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' });
};

export const formatDakarTime = (dateInput: string | number | Date): string => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Dakar',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDakarDateTime = (dateInput: string | number | Date): string => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' });
};

export const getAccountWorkspaceKey = (accountId: string): string =>
  `samastock_workspace_cache_${accountId}`;

export const getAccountSyncQueueKey = (accountId: string): string =>
  `samastock_sync_queue_${accountId}`;

export const getAccountOperatorKey = (accountId: string): string =>
  `samastock_active_operator_${accountId}`;

export const compressImageFileToDataUrl = (file: File, maxDim = 320, quality = 0.78): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire l’image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format d’image non pris en charge.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
};

export const escapeCsvCell = (value: unknown): string => {
  const raw = String(value ?? '');
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
};

export const sanitizeClientMediaUrl = (url?: string, fallback = ''): string => {
  if (typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('/assets/') && !trimmed.includes('..') && !/[<>"'`]/.test(trimmed)) {
    return trimmed;
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:') return trimmed;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

export const stripTaxFields = <T extends Record<string, any>>(obj: T): T => {
  if (!obj || typeof obj !== 'object') return obj;
  const copy: Record<string, any> = { ...obj };
  delete copy.ninea;
  delete copy.rccm;
  delete copy.customerNinea;
  return copy as T;
};

export const getStoredItem = <T>(key: string, defaultValue: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error loading ${key} from localStorage`, e);
    return defaultValue;
  }
};

export const setStoredItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key} to localStorage`, e);
  }
};

export const clearAllData = (): void => {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
};

export const exportMerchantWorkspaceJSON = (workspace: {
  organization: Organization;
  stores: Store[];
  categories: Category[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  invoices: Invoice[];
  purchases: Purchase[];
  expenses: Expense[];
  movements: StockMovement[];
  inventorySessions?: InventorySession[];
}): string => {
  const allData = {
    organization: stripTaxFields(workspace.organization),
    stores: workspace.stores,
    categories: workspace.categories,
    products: workspace.products,
    customers: workspace.customers,
    suppliers: workspace.suppliers.map(stripTaxFields),
    sales: workspace.sales,
    invoices: workspace.invoices.map(stripTaxFields),
    purchases: workspace.purchases,
    expenses: workspace.expenses,
    movements: workspace.movements,
    inventorySessions: workspace.inventorySessions || [],
    exportedAt: new Date().toISOString(),
    system: 'SAMA STOCK v2.0',
  };
  return JSON.stringify(allData, null, 2);
};

export const parseImportedWorkspaceJSON = (jsonString: string): any | null => {
  try {
    const data = JSON.parse(jsonString);
    if (!data || !data.organization) {
      return null;
    }
    return {
      organization: stripTaxFields(data.organization),
      stores: Array.isArray(data.stores) ? data.stores : undefined,
      categories: Array.isArray(data.categories) ? data.categories : undefined,
      products: Array.isArray(data.products) ? data.products : undefined,
      customers: Array.isArray(data.customers) ? data.customers : undefined,
      suppliers: Array.isArray(data.suppliers) ? data.suppliers.map(stripTaxFields) : undefined,
      sales: Array.isArray(data.sales) ? data.sales : undefined,
      invoices: Array.isArray(data.invoices) ? data.invoices.map(stripTaxFields) : undefined,
      purchases: Array.isArray(data.purchases) ? data.purchases : undefined,
      expenses: Array.isArray(data.expenses) ? data.expenses : undefined,
      stockMovements: Array.isArray(data.movements) ? data.movements : undefined,
      inventorySessions: Array.isArray(data.inventorySessions) ? data.inventorySessions : undefined,
    };
  } catch (err) {
    console.error('Import failed', err);
    return null;
  }
};

export const clearDemoProducts = (): void => {
  setStoredItem(STORAGE_KEYS.PRODUCTS, []);
  setStoredItem(STORAGE_KEYS.MOVEMENTS, []);
};

export const clearDemoAccounts = (ownerId?: string): User[] => {
  const currentUsers = getStoredItem<User[]>(STORAGE_KEYS.USERS, defaultUsers);
  const cleaned = currentUsers.filter(
    (u) => u.role === 'administrateur' || (ownerId && u.id === ownerId)
  );
  const finalUsers = cleaned.length > 0 ? [cleaned[0]] : defaultUsers;
  setStoredItem(STORAGE_KEYS.USERS, finalUsers);
  return finalUsers;
};

const UNITECH_TEST_CLEANUP_FLAG = 'samastock_unitech_test_cleanup_done_v1';
const UNITECH_TEST_BACKUP_KEY = 'samastock_backup_pre_unitech_cleanup_20261115';
const UNITECH_TEST_CLEANUP_CUTOFF_ISO = '2026-11-15T13:35:00.000Z';

const isConfirmedUnitechTestTransaction = (txn: PaymentTransaction): boolean => {
  if (txn.createdAt && txn.createdAt > UNITECH_TEST_CLEANUP_CUTOFF_ISO) {
    return false;
  }
  const statusMatch = txn.status === 'en_attente' || txn.status === 'echec' || txn.status === 'succes';
  if (!statusMatch) return false;

  const isUnitech =
    txn.paymentMethod === 'unitechpay_wave' ||
    String(txn.id || '').startsWith('txn-unitech-') ||
    String(txn.reference || '').startsWith('wave_') ||
    txn.customerName === 'Testeur Sandbox SAMA STOCK' ||
    txn.customerName === 'Testeur SAMA STOCK' ||
    txn.customerName === 'Test Verification';

  return isUnitech;
};

export const runOneTimeUnitechTestCleanup = (): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (localStorage.getItem(UNITECH_TEST_CLEANUP_FLAG) === 'true') return;

    const existingTxns = getStoredItem<PaymentTransaction[]>(STORAGE_KEYS.PAYMENT_TRANSACTIONS, []);
    const existingSub = getStoredItem<Subscription>(STORAGE_KEYS.SUBSCRIPTION, defaultSubscription);
    const existingEvents = getStoredItem<SubscriptionEvent[]>(STORAGE_KEYS.SUBSCRIPTION_EVENTS, defaultSubscriptionEvents);
    const existingOrders = getStoredItem<UnitechPayOrder[]>(STORAGE_KEYS.UNITECHPAY_ORDERS, []);
    const existingLogs = getStoredItem<UnitechPayWebhookLog[]>(STORAGE_KEYS.UNITECHPAY_WEBHOOK_LOGS, []);

    if (!localStorage.getItem(UNITECH_TEST_BACKUP_KEY)) {
      localStorage.setItem(
        UNITECH_TEST_BACKUP_KEY,
        JSON.stringify({
          backedUpAt: new Date().toISOString(),
          subscription: existingSub,
          paymentTransactions: existingTxns,
          subscriptionEvents: existingEvents,
          unitechPayOrders: existingOrders,
          unitechPayWebhookLogs: existingLogs,
        })
      );
    }

    const deletedTxns = existingTxns.filter(isConfirmedUnitechTestTransaction);
    const remainingTxns = existingTxns.filter((t) => !isConfirmedUnitechTestTransaction(t));
    const deletedRefs = new Set(deletedTxns.map((t) => t.reference).filter(Boolean));

    const remainingOrders = existingOrders.filter((o) => {
      if (o.dateCreated && o.dateCreated > UNITECH_TEST_CLEANUP_CUTOFF_ISO) return true;
      return !(
        String(o.id || '').startsWith('ord-unitech-') ||
        String(o.reference || '').startsWith('wave_') ||
        deletedRefs.has(o.reference)
      );
    });

    const remainingLogs = existingLogs.filter((l) => {
      if (l.receivedAt && l.receivedAt > UNITECH_TEST_CLEANUP_CUTOFF_ISO) return true;
      return l.event === 'system.startup' || l.event === 'webhook.configured';
    });

    const remainingEvents = existingEvents.filter((evt) => {
      if (evt.date && evt.date > UNITECH_TEST_CLEANUP_CUTOFF_ISO) return true;
      if (
        evt.type === 'UNITECHPAY_WEBHOOK_RECEIVED' ||
        evt.type === 'UNITECHPAY_PAYMENT_SUCCESS' ||
        evt.type === 'UNITECHPAY_PAYMENT_FAILED' ||
        evt.type === 'UNITECHPAY_PAYMENT_EXPIRED'
      ) {
        return false;
      }
      if (evt.meta?.reference && deletedRefs.has(evt.meta.reference)) {
        return false;
      }
      if (/unitechpay/i.test(evt.description || '')) {
        return false;
      }
      return true;
    });

    // Only reset subscription if it was generated exclusively by those UnitechPay test payments
    const hasRemainingPaidTxn = remainingTxns.some((t) => t.status === 'succes');
    const isAdminGrantedSub =
      Boolean(existingSub.isTrial) ||
      Boolean(existingSub.isComped) ||
      /modification manuelle|offert|essai gratuit/i.test(existingSub.notes || '');
    const isTestGeneratedSub =
      !hasRemainingPaidTxn &&
      !isAdminGrantedSub &&
      (!existingSub.updatedAt || existingSub.updatedAt <= UNITECH_TEST_CLEANUP_CUTOFF_ISO) &&
      (existingSub.planId !== 'plan-gratuit' || existingSub.status !== 'gratuit') &&
      (existingSub.paymentMethod === 'wave' ||
        existingSub.paymentMethod === 'unitechpay_wave' ||
        /unitechpay/i.test(existingSub.notes || '') ||
        deletedTxns.some((t) => t.status === 'succes' && t.planId === existingSub.planId));

    setStoredItem(STORAGE_KEYS.PAYMENT_TRANSACTIONS, remainingTxns);
    setStoredItem(STORAGE_KEYS.UNITECHPAY_ORDERS, remainingOrders);
    setStoredItem(STORAGE_KEYS.UNITECHPAY_WEBHOOK_LOGS, remainingLogs);
    setStoredItem(STORAGE_KEYS.SUBSCRIPTION_EVENTS, remainingEvents);
    if (isTestGeneratedSub) {
      const now = new Date().toISOString();
      setStoredItem(STORAGE_KEYS.SUBSCRIPTION, {
        ...defaultSubscription,
        id: existingSub.id || defaultSubscription.id,
        organizationId: existingSub.organizationId || defaultSubscription.organizationId,
        createdAt: existingSub.createdAt || now,
        updatedAt: now,
      });
    }

    localStorage.setItem(UNITECH_TEST_CLEANUP_FLAG, 'true');
  } catch (err) {
    console.error('Error during one-time UnitechPay test cleanup:', err);
  }
};


export const clearAllDemoData = (): { users: User[]; products: Product[] } => {
  setStoredItem(STORAGE_KEYS.PRODUCTS, []);
  setStoredItem(STORAGE_KEYS.MOVEMENTS, []);
  setStoredItem(STORAGE_KEYS.SALES, []);
  setStoredItem(STORAGE_KEYS.INVOICES, []);
  setStoredItem(STORAGE_KEYS.CUSTOMERS, []);
  setStoredItem(STORAGE_KEYS.SUPPLIERS, []);
  setStoredItem(STORAGE_KEYS.EXPENSES, []);
  setStoredItem(STORAGE_KEYS.PURCHASES, []);
  setStoredItem(STORAGE_KEYS.INVENTORIES, []);

  const currentUsers = getStoredItem<User[]>(STORAGE_KEYS.USERS, defaultUsers);
  const cleaned = currentUsers.filter((u) => u.role === 'administrateur');
  const finalUsers = cleaned.length > 0 ? [cleaned[0]] : defaultUsers;
  setStoredItem(STORAGE_KEYS.USERS, finalUsers);

  return { users: finalUsers, products: [] };
};


