import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import {
  ActiveTab,
  AccountCapabilities,
  AdminOverviewData,
  AuditLog,
  BillingCycle,
  CartItem,
  CashMovement,
  CashRegisterShift,
  Category,
  Customer,
  Employee,
  Expense,
  HeldSale,
  InventorySession,
  Invoice,
  LoyaltyTransaction,
  Organization,
  PaymentMethod,
  PaymentSplit,
  Plan,
  PlanFeatureKey,
  Product,
  Purchase,
  Sale,
  StaffPermissions,
  StaffRole,
  StockMovement,
  Store,
  SubscriptionStatus,
  Supplier,
  SyncOperation,
  UnitechPayConfig,
  UnitechPayOrder,
  UnitechPayWebhookLog,
  User,
} from '../types';
import {
  STORAGE_KEYS,
  LEGACY_MIGRATION_DONE_KEY,
  defaultCategories,
  defaultOrganization,
  defaultStores,
  defaultUnitechPayConfig,
  defaultUsers,
  getStoredItem,
  setStoredItem,
  setInMemoryCsrfToken,
  clearStoredSessionToken,
  getAuthHeaders,
  getAccountWorkspaceKey,
  getAccountSyncQueueKey,
  getAccountOperatorKey,
  stripTaxFields,
  clearAllData,
} from '../services/storage';
import {
  hasEmployeePermission,
  canEmployeeAccessStore,
} from '../services/permissions';
import { AccessCheckResult } from '../services/subscriptionService';
import {
  getUnitechPayConfig,
  updateUnitechPayConfig as apiUpdateUnitechConfig,
  configureRemoteUnitechPayWebhook as apiConfigureRemoteUnitech,
  createUnitechPayOrder as apiCreateUnitechOrder,
  getUnitechPayOrders,
  getUnitechPayWebhookLogs,
  getUnitechPayOrderStatus,
  runUnitechPaySimulation as apiRunUnitechSimulation,
} from '../services/unitechPayService';

const DEFAULT_CAPABILITIES: AccountCapabilities = {
  planId: 'plan-gratuit',
  planName: 'Gratuit',
  maxProducts: 5,
  maxStores: 1,
  maxInvoicesPerMonth: 3,
  allowedFeatures: ['sales_purchases'],
  isAccountOperational: true,
};

interface WorkspacePayload {
  organization: Organization;
  stores: Store[];
  employees?: Employee[];
  activeStoreId: string;
  activeShift: CashRegisterShift | null;
  shiftHistory?: CashRegisterShift[];
  heldSales?: HeldSale[];
  auditLogs?: AuditLog[];
  categories: Category[];
  products: Product[];
  stockMovements: StockMovement[];
  customers: Customer[];
  suppliers: Supplier[];
  purchases: Purchase[];
  sales: Sale[];
  invoices: Invoice[];
  expenses: Expense[];
  inventorySessions: InventorySession[];
  capabilities?: AccountCapabilities;
}

interface AppContextType {
  // Navigation & session
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: User;
  isAuthChecking: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  register: (data: {
    name: string;
    phone: string;
    email: string;
    businessName: string;
    storeName: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: {
    name: string;
    email: string;
    phone: string;
  }) => Promise<{ success: boolean; error?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword?: string
  ) => Promise<{ success: boolean; error?: string; code?: string }>;

  // POS Full-Screen & Consolidated Mode
  isPosFullScreen: boolean;
  setIsPosFullScreen: (v: boolean) => void;
  consolidatedView: boolean;
  setConsolidatedView: (v: boolean) => void;

  // Staff, PIN Switching, Permissions & Audit Logs
  employees: Employee[];
  activeOperator: Employee | null;
  isPinModalOpen: boolean;
  openPinModal: () => void;
  closePinModal: () => void;
  verifyOperatorPin: (
    employeeId: string,
    pin: string
  ) => Promise<{ success: boolean; error?: string; employee?: Employee }>;
  saveEmployee: (
    emp: Partial<Employee> & { name: string; role: StaffRole; pinCode?: string }
  ) => Promise<{ success: boolean; error?: string; employee?: Employee }>;
  removeEmployee: (employeeId: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (perm: Exclude<keyof StaffPermissions, 'maxDiscountPercent'>) => boolean;
  canAccessStore: (storeId: string) => boolean;
  auditLogs: AuditLog[];
  logAudit: (
    action: string,
    entity: string,
    summary: string,
    entityId?: string,
    details?: string
  ) => void;

  // Stores
  activeStoreId: string;
  setActiveStoreId: (storeId: string) => void;
  currentStore: Store | undefined;
  stores: Store[];
  addStore: (store: Omit<Store, 'id'>) => void;
  updateStore: (id: string, updates: Partial<Store>) => void;

  // Organization & Settings
  organization: Organization;
  updateOrganization: (updates: Partial<Organization>) => void;

  // Offline & Sync
  isOnline: boolean;
  toggleOnlineMode: () => void;
  pendingSyncOperations: SyncOperation[];
  syncPendingOperations: () => Promise<void>;

  // Catalog & Inventory
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  clearAllProducts: () => void;
  archiveProduct: (id: string) => void;
  importProducts: (newProducts: Product[]) => void;
  clearMerchantWorkspaceData: () => void;
  importWorkspaceData: (parsedData: Partial<WorkspacePayload>) => Promise<boolean>;

  // Categories
  categories: Category[];
  addCategory: (categoryData: Omit<Category, 'id' | 'createdAt'>) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => boolean;
  resetCategoriesToDefault: () => void;

  // Stock Movements & Transfers
  stockMovements: StockMovement[];
  addStockMovement: (movement: Omit<StockMovement, 'id' | 'date' | 'syncStatus'>) => void;
  transferStock: (
    productId: string,
    fromStoreId: string,
    toStoreId: string,
    quantity: number,
    reason: string
  ) => boolean;

  // Commercial: Sales, Cash Register Shifts, Held Sales & POS
  sales: Sale[];
  activeShift: CashRegisterShift | null;
  shiftHistory: CashRegisterShift[];
  openShift: (initialCash: number) => void;
  closeShift: (actualCash: number, notes?: string) => CashRegisterShift | null;
  recordCashMovement: (
    type: CashMovement['type'],
    amount: number,
    reason: string,
    category?: string
  ) => boolean;
  heldSales: HeldSale[];
  holdCurrentSale: (data: {
    label?: string;
    customerId?: string;
    customerName?: string;
    items: CartItem[];
    discountType: 'amount' | 'percent';
    discountValue: number;
    notes?: string;
  }) => HeldSale;
  deleteHeldSale: (id: string) => void;
  recordSale: (saleData: {
    items: CartItem[];
    customerId?: string;
    customerName: string;
    subtotal: number;
    discount: number;
    discountType?: 'amount' | 'percent';
    discountValue?: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    changeDue?: number;
    paymentMethod: PaymentMethod;
    paymentSplits?: PaymentSplit[];
    paymentReference?: string;
    loyaltyPointsRedeemed?: number;
    loyaltyDiscountAmount?: number;
    notes?: string;
  }) => Sale | null;
  voidSale: (saleId: string, reason: string) => boolean;

  // Invoicing (FAC, PRO, DEV, BL, AVR)
  invoices: Invoice[];
  createInvoice: (
    invData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'payments'>
  ) => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  recordInvoicePayment: (
    invoiceId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    reference?: string,
    notes?: string
  ) => boolean;
  convertQuoteToInvoice: (quoteId: string) => Invoice | null;

  // Customers, Credits & Loyalty
  customers: Customer[];
  addCustomer: (
    cust: Omit<Customer, 'id' | 'totalPurchases' | 'outstandingBalance' | 'createdAt'>
  ) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  recordCustomerCreditPayment: (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod
  ) => void;
  adjustCustomerPoints: (customerId: string, pointsDelta: number, note: string) => void;

  // Suppliers & Purchasing
  suppliers: Supplier[];
  addSupplier: (
    sup: Omit<Supplier, 'id' | 'totalPurchases' | 'outstandingBalance' | 'createdAt'>
  ) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  recordSupplierPayment: (supplierId: string, amount: number) => void;
  purchases: Purchase[];
  createPurchase: (purchaseData: Omit<Purchase, 'id' | 'purchaseNumber'>) => Purchase;
  receivePurchase: (purchaseId: string) => boolean;

  // Expenses & Accounting
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'userName' | 'userId' | 'storeName'>) => void;
  deleteExpense: (id: string) => void;

  // Physical Inventory Sessions
  inventorySessions: InventorySession[];
  createInventorySession: (storeId: string, notes?: string) => InventorySession;
  validateInventorySession: (sessionId: string, items: any[]) => boolean;

  // Computed Real KPIs
  kpis: {
    totalProductsCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    stockValueCost: number;
    stockValueRetail: number;
    todaySalesTotal: number;
    weekSalesTotal: number;
    monthSalesTotal: number;
    costOfGoodsSold: number;
    grossMargin: number;
    monthExpensesTotal: number;
    estimatedNetProfit: number;
    totalCustomerDebt: number;
    totalSupplierDebt: number;
    unpaidInvoicesCount: number;
    unpaidInvoicesTotal: number;
  };

  // Capabilities & Operational Quotas (without exposing subscription financials to merchants)
  capabilities: AccountCapabilities;
  quotaSummary: {
    planId: string;
    planName: string;
    monthKey: string;
    products: { used: number; limit: number; remaining: number | null; reached: boolean };
    stores: { used: number; limit: number; remaining: number | null; reached: boolean };
    invoices: { used: number; limit: number; remaining: number | null; reached: boolean };
  };
  canAddProduct: () => AccessCheckResult;
  canAddStore: () => AccessCheckResult;
  canCreateInvoice: () => AccessCheckResult;
  hasFeature: (featureKey: PlanFeatureKey) => boolean;

  // Quota Notice Modal Control
  isUpgradeModalOpen: boolean;
  upgradeModalReason: string;
  openUpgradeModal: (reason?: string) => void;
  closeUpgradeModal: () => void;

  // Administrateur-only Subscription & Account Dashboard
  adminOverview: AdminOverviewData | null;
  refreshAdminOverview: () => Promise<void>;
  updatePlanConfig: (planId: string, updates: Partial<Plan>) => Promise<void>;
  resetPlansToDefault: () => Promise<void>;
  adminUpdateSubscription: (
    accountId: string,
    updates: {
      planId?: string;
      status?: SubscriptionStatus;
      billingCycle?: BillingCycle;
      startDate?: string;
      renewalDate?: string | null;
      expiresAt?: string | null;
      isTrial?: boolean;
      isComped?: boolean;
      justification: string;
      eventType?: string;
    }
  ) => Promise<void>;
  adminRecordPayment: (
    accountId: string,
    payload: {
      planId: string;
      billingCycle: BillingCycle;
      amount: number;
      paymentMethod: string;
      status: 'succes' | 'en_attente' | 'echec';
      reference?: string;
      phoneNumber?: string;
    }
  ) => Promise<void>;
  adminToggleAccountStatus: (accountId: string, active: boolean) => Promise<void>;
  adminResetAccountPassword: (
    accountId: string
  ) => Promise<{ temporaryPassword: string; accountName: string }>;

  // UnitechPay Webhook Module (Administrateur-only)
  unitechPayConfig: UnitechPayConfig;
  unitechPayOrders: UnitechPayOrder[];
  unitechPayWebhookLogs: UnitechPayWebhookLog[];
  refreshUnitechPayData: () => Promise<void>;
  updateUnitechPayConfig: (
    updates: Partial<UnitechPayConfig>
  ) => Promise<{ success: boolean; message: string }>;
  configureRemoteUnitechPayWebhook: (
    customUrl?: string
  ) => Promise<{ success: boolean; message: string; configuredUrl: string }>;
  initiateUnitechPayWavePayment: (
    planId: string,
    cycle: BillingCycle,
    customerPhone?: string,
    targetAccountId?: string
  ) => Promise<{ order: UnitechPayOrder; wavePaymentUrl: string; reference: string }>;
  checkUnitechPayOrderStatus: (
    reference: string
  ) => Promise<{ success: boolean; status: string; isPaid: boolean; message: string }>;
  simulateUnitechPayWebhookEvent: (scenario: {
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
    customPayload?: any;
  }) => Promise<{
    success: boolean;
    httpStatus: number;
    message: string;
    response: any;
    log?: UnitechPayWebhookLog;
  }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function collectLegacyLocalData(): Partial<WorkspacePayload> | null {
  try {
    const legacyProducts = getStoredItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const legacySales = getStoredItem<Sale[]>(STORAGE_KEYS.SALES, []);
    const legacyInvoices = getStoredItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    const legacyCustomers = getStoredItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    const legacySuppliers = getStoredItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
    const legacyPurchases = getStoredItem<Purchase[]>(STORAGE_KEYS.PURCHASES, []);
    const legacyExpenses = getStoredItem<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    const legacyMovements = getStoredItem<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
    const legacyInventories = getStoredItem<InventorySession[]>(STORAGE_KEYS.INVENTORIES, []);
    const legacyStores = getStoredItem<Store[]>(STORAGE_KEYS.STORES, []);
    const legacyCategories = getStoredItem<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const legacyOrg = getStoredItem<Organization | null>(STORAGE_KEYS.ORG, null);
    const legacyShift = getStoredItem<CashRegisterShift | null>(STORAGE_KEYS.REGISTER_SHIFT, null);
    const legacyActiveStore = getStoredItem<string>(STORAGE_KEYS.ACTIVE_STORE, '');

    const hasRealData =
      legacyProducts.length > 0 ||
      legacySales.length > 0 ||
      legacyInvoices.length > 0 ||
      legacyCustomers.length > 0 ||
      legacySuppliers.length > 0 ||
      legacyPurchases.length > 0 ||
      legacyExpenses.length > 0;

    if (!hasRealData) return null;

    return {
      organization: legacyOrg ? stripTaxFields(legacyOrg) : undefined,
      stores: legacyStores.length > 0 ? legacyStores : undefined,
      activeStoreId: legacyActiveStore || undefined,
      activeShift: legacyShift || null,
      categories: legacyCategories.length > 0 ? legacyCategories : undefined,
      products: legacyProducts,
      stockMovements: legacyMovements,
      customers: legacyCustomers,
      suppliers: legacySuppliers.map(stripTaxFields),
      purchases: legacyPurchases,
      sales: legacySales,
      invoices: legacyInvoices.map(stripTaxFields),
      expenses: legacyExpenses,
      inventorySessions: legacyInventories,
    };
  } catch {
    return null;
  }
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<ActiveTab>('dashboard');
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User>(defaultUsers[0]);

  // Commercial workspace state (isolated per account)
  const [organization, setOrganization] = useState<Organization>(defaultOrganization);
  const [stores, setStores] = useState<Store[]>(defaultStores);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeOperator, setActiveOperator] = useState<Employee | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPosFullScreen, setIsPosFullScreen] = useState(false);
  const [consolidatedView, setConsolidatedView] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState<string>(defaultStores[0].id);
  const [activeShift, setActiveShift] = useState<CashRegisterShift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<CashRegisterShift[]>([]);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventorySessions, setInventorySessions] = useState<InventorySession[]>([]);
  const [capabilities, setCapabilities] = useState<AccountCapabilities>(DEFAULT_CAPABILITIES);

  // Offline mode & sync queue
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    return true;
  });
  const [pendingSyncOperations, setPendingSyncOperations] = useState<SyncOperation[]>([]);

  // Quota notice modal
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState('');

  // Administrateur-only state
  const [adminOverview, setAdminOverview] = useState<AdminOverviewData | null>(null);
  const [unitechPayConfig, setUnitechPayConfig] = useState<UnitechPayConfig>(
    defaultUnitechPayConfig
  );
  const [unitechPayOrders, setUnitechPayOrders] = useState<UnitechPayOrder[]>([]);
  const [unitechPayWebhookLogs, setUnitechPayWebhookLogs] = useState<UnitechPayWebhookLog[]>([]);

  // Track which account has been hydrated so we only auto-sync mutations after hydration
  const hydratedAccountIdRef = useRef<string | null>(null);
  const skipNextSyncRef = useRef<boolean>(false);

  const setActiveTab = useCallback(
    (tab: ActiveTab) => {
      if (currentUser.mustChangePassword && tab !== 'settings') {
        setActiveTabState('settings');
        return;
      }
      if (tab === 'admin_subscriptions' && currentUser.role !== 'administrateur') {
        setActiveTabState('dashboard');
        return;
      }
      setActiveTabState(tab);
    },
    [currentUser.role, currentUser.mustChangePassword]
  );

  const applyWorkspaceState = useCallback(
    (accountId: string, ws: WorkspacePayload, serverActiveOperator?: Employee | null) => {
      skipNextSyncRef.current = true;
      const nextStores =
        Array.isArray(ws.stores) && ws.stores.length > 0 ? ws.stores : defaultStores;
      const nextOrg = ws.organization ? stripTaxFields(ws.organization) : defaultOrganization;
      const nextEmployees = Array.isArray(ws.employees) ? ws.employees : [];

      setOrganization(nextOrg);
      setStores(nextStores);
      setEmployees(nextEmployees);

      const savedOpId = getStoredItem<string>(getAccountOperatorKey(accountId), '');
      const matchedServerOp =
        serverActiveOperator && serverActiveOperator.id
          ? nextEmployees.find((e) => e.id === serverActiveOperator.id && e.active) || null
          : null;
      const matchedOp =
        matchedServerOp ||
        nextEmployees.find((e) => e.id === savedOpId && e.active) ||
        nextEmployees.find((e) => e.role === 'proprietaire' && e.active) ||
        nextEmployees.find((e) => e.active) ||
        null;
      setActiveOperator(matchedOp);
      if (matchedOp) {
        setStoredItem(getAccountOperatorKey(accountId), matchedOp.id);
      }

    setActiveStoreId(ws.activeStoreId || nextStores[0]?.id || '');
    setActiveShift(ws.activeShift || null);
    setShiftHistory(Array.isArray(ws.shiftHistory) ? ws.shiftHistory : []);
    setHeldSales(Array.isArray(ws.heldSales) ? ws.heldSales : []);
    setAuditLogs(Array.isArray(ws.auditLogs) ? ws.auditLogs : []);
    setCategories(
      Array.isArray(ws.categories) && ws.categories.length > 0 ? ws.categories : defaultCategories
    );
    setProducts(Array.isArray(ws.products) ? ws.products : []);
    setStockMovements(Array.isArray(ws.stockMovements) ? ws.stockMovements : []);
    setCustomers(Array.isArray(ws.customers) ? ws.customers : []);
    setSuppliers(Array.isArray(ws.suppliers) ? ws.suppliers.map(stripTaxFields) : []);
    setPurchases(Array.isArray(ws.purchases) ? ws.purchases : []);
    setSales(Array.isArray(ws.sales) ? ws.sales : []);
    setInvoices(Array.isArray(ws.invoices) ? ws.invoices.map(stripTaxFields) : []);
    setExpenses(Array.isArray(ws.expenses) ? ws.expenses : []);
    setInventorySessions(Array.isArray(ws.inventorySessions) ? ws.inventorySessions : []);
    setCapabilities(ws.capabilities || DEFAULT_CAPABILITIES);

    hydratedAccountIdRef.current = accountId;
    setStoredItem(getAccountWorkspaceKey(accountId), {
      organization: nextOrg,
      stores: nextStores,
      employees: nextEmployees,
      activeStoreId: ws.activeStoreId || nextStores[0]?.id || '',
      activeShift: ws.activeShift || null,
      shiftHistory: Array.isArray(ws.shiftHistory) ? ws.shiftHistory : [],
      heldSales: Array.isArray(ws.heldSales) ? ws.heldSales : [],
      auditLogs: Array.isArray(ws.auditLogs) ? ws.auditLogs : [],
      categories:
        Array.isArray(ws.categories) && ws.categories.length > 0
          ? ws.categories
          : defaultCategories,
      products: Array.isArray(ws.products) ? ws.products : [],
      stockMovements: Array.isArray(ws.stockMovements) ? ws.stockMovements : [],
      customers: Array.isArray(ws.customers) ? ws.customers : [],
      suppliers: Array.isArray(ws.suppliers) ? ws.suppliers.map(stripTaxFields) : [],
      purchases: Array.isArray(ws.purchases) ? ws.purchases : [],
      sales: Array.isArray(ws.sales) ? ws.sales : [],
      invoices: Array.isArray(ws.invoices) ? ws.invoices.map(stripTaxFields) : [],
      expenses: Array.isArray(ws.expenses) ? ws.expenses : [],
      inventorySessions: Array.isArray(ws.inventorySessions) ? ws.inventorySessions : [],
    });

    const savedQueue = getStoredItem<SyncOperation[]>(getAccountSyncQueueKey(accountId), []);
    setPendingSyncOperations(savedQueue);
  }, []);

  const resetInMemoryWorkspace = useCallback(() => {
    hydratedAccountIdRef.current = null;
    skipNextSyncRef.current = true;
    setOrganization(defaultOrganization);
    setStores(defaultStores);
    setEmployees([]);
    setActiveOperator(null);
    setIsPinModalOpen(false);
    setIsPosFullScreen(false);
    setConsolidatedView(false);
    setActiveStoreId(defaultStores[0].id);
    setActiveShift(null);
    setShiftHistory([]);
    setHeldSales([]);
    setAuditLogs([]);
    setCategories(defaultCategories);
    setProducts([]);
    setStockMovements([]);
    setCustomers([]);
    setSuppliers([]);
    setPurchases([]);
    setSales([]);
    setInvoices([]);
    setExpenses([]);
    setInventorySessions([]);
    setCapabilities(DEFAULT_CAPABILITIES);
    setPendingSyncOperations([]);
    setAdminOverview(null);
    setUnitechPayConfig(defaultUnitechPayConfig);
    setUnitechPayOrders([]);
    setUnitechPayWebhookLogs([]);
    setActiveTabState('dashboard');
  }, []);

  const refreshAdminOverview = useCallback(async () => {
    if (currentUser.role !== 'administrateur') return;
    try {
      const resp = await fetch('/api/admin/overview', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data?.success) {
        setAdminOverview({
          plans: data.plans || [],
          merchantAccounts: data.merchantAccounts || [],
          paymentTransactions: data.paymentTransactions || [],
          subscriptionEvents: data.subscriptionEvents || [],
          unitechOrders: data.unitechOrders || [],
          unitechWebhookLogs: data.unitechWebhookLogs || [],
        });
      }
    } catch (err) {
      console.warn('Unable to load admin overview', err);
    }
  }, [currentUser.role]);

  const refreshUnitechPayData = useCallback(async () => {
    if (currentUser.role !== 'administrateur') return;
    try {
      const [cfg, ords, logs] = await Promise.all([
        getUnitechPayConfig(),
        getUnitechPayOrders(),
        getUnitechPayWebhookLogs(),
      ]);
      setUnitechPayConfig(cfg);
      setUnitechPayOrders(ords);
      setUnitechPayWebhookLogs(logs);
    } catch (e) {
      console.warn('Failed to refresh UnitechPay data', e);
    }
  }, [currentUser.role]);

  const attemptOneTimeLegacyMigration = useCallback(
    async (accountId: string, currentWs: WorkspacePayload): Promise<WorkspacePayload> => {
      try {
        if (localStorage.getItem(LEGACY_MIGRATION_DONE_KEY) === 'true') {
          return currentWs;
        }
        const isEmptyWorkspace =
          (currentWs.products?.length || 0) === 0 &&
          (currentWs.sales?.length || 0) === 0 &&
          (currentWs.invoices?.length || 0) === 0;
        if (!isEmptyWorkspace) {
          localStorage.setItem(LEGACY_MIGRATION_DONE_KEY, 'true');
          return currentWs;
        }
        const legacyData = collectLegacyLocalData();
        if (!legacyData) {
          localStorage.setItem(LEGACY_MIGRATION_DONE_KEY, 'true');
          return currentWs;
        }
        const resp = await fetch('/api/merchant/migrate-local', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(legacyData),
        });
        localStorage.setItem(LEGACY_MIGRATION_DONE_KEY, 'true');
        if (resp.ok) {
          const data = await resp.json();
          if (data?.workspace) {
            return data.workspace;
          }
        }
      } catch (err) {
        console.warn('Legacy migration skipped:', err);
      }
      return currentWs;
    },
    []
  );

  // Restore session on initial mount
  useEffect(() => {
    let active = true;
    const bootstrapSession = async () => {
      // Purge toute éventuelle trace héritée dans sessionStorage/localStorage
      clearStoredSessionToken();

      try {
        const meResp = await fetch('/api/auth/me', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });

        if (!meResp.ok) {
          clearStoredSessionToken();
          if (active) {
            setIsAuthenticated(false);
            setIsAuthChecking(false);
          }
          return;
        }

        const meData = await meResp.json();
        const account = meData?.account;
        if (!account) {
          clearStoredSessionToken();
          if (active) {
            setIsAuthenticated(false);
            setIsAuthChecking(false);
          }
          return;
        }
        if (typeof meData?.csrfToken === 'string' && meData.csrfToken) {
          setInMemoryCsrfToken(meData.csrfToken);
        }

        const mappedUser: User = {
          id: account.id,
          name: account.name,
          email: account.email || '',
          phone: account.phone || '',
          role: account.role,
          storeIds: [],
          active: Boolean(account.active),
          mustChangePassword: Boolean(account.mustChangePassword),
        };

        const wsResp = await fetch('/api/merchant/workspace', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });

        if (wsResp.ok) {
          const wsData = await wsResp.json();
          let workspace: WorkspacePayload = wsData.workspace;
          workspace = await attemptOneTimeLegacyMigration(account.id, workspace);

          if (active) {
            mappedUser.storeIds = (workspace.stores || []).map((s) => s.id);
            setCurrentUser(mappedUser);
            applyWorkspaceState(
              account.id,
              workspace,
              wsData.activeOperator || meData.activeOperator || null
            );
            if (mappedUser.mustChangePassword) {
              setActiveTabState('settings');
            }
            setIsAuthenticated(true);
          }
        } else {
          // Offline / fallback from per-account cache
          const cached = getStoredItem<WorkspacePayload | null>(
            getAccountWorkspaceKey(account.id),
            null
          );
          if (active && cached) {
            mappedUser.storeIds = (cached.stores || []).map((s) => s.id);
            setCurrentUser(mappedUser);
            applyWorkspaceState(account.id, cached);
            setIsAuthenticated(true);
          } else if (active) {
            setIsAuthenticated(false);
          }
        }
      } catch {
        // Network unavailable — try cached session fallback only if token exists
        if (active) {
          setIsAuthenticated(false);
        }
      } finally {
        if (active) {
          setIsAuthChecking(false);
        }
      }
    };

    bootstrapSession();
    return () => {
      active = false;
    };
  }, [applyWorkspaceState, attemptOneTimeLegacyMigration]);

  // Load administrateur overview & UnitechPay data ONLY for role 'administrateur'
  useEffect(() => {
    if (!isAuthenticated || currentUser.role !== 'administrateur') {
      setAdminOverview(null);
      setUnitechPayOrders([]);
      setUnitechPayWebhookLogs([]);
      return;
    }
    refreshAdminOverview();
    refreshUnitechPayData();
  }, [isAuthenticated, currentUser.role, refreshAdminOverview, refreshUnitechPayData]);

  // Persist account sync queue
  useEffect(() => {
    const accId = hydratedAccountIdRef.current;
    if (!accId) return;
    setStoredItem(getAccountSyncQueueKey(accId), pendingSyncOperations);
  }, [pendingSyncOperations]);

  const buildCurrentWorkspacePayload = useCallback(
    (): WorkspacePayload => ({
      organization,
      stores,
      employees,
      activeStoreId,
      activeShift,
      shiftHistory,
      heldSales,
      auditLogs,
      categories,
      products,
      stockMovements,
      customers,
      suppliers,
      purchases,
      sales,
      invoices,
      expenses,
      inventorySessions,
    }),
    [
      organization,
      stores,
      employees,
      activeStoreId,
      activeShift,
      shiftHistory,
      heldSales,
      auditLogs,
      categories,
      products,
      stockMovements,
      customers,
      suppliers,
      purchases,
      sales,
      invoices,
      expenses,
      inventorySessions,
    ]
  );

  const pushWorkspaceToServer = useCallback(
    async (payload: WorkspacePayload): Promise<boolean> => {
      if (!isAuthenticated || !hydratedAccountIdRef.current) return false;
      try {
        const resp = await fetch('/api/merchant/workspace/sync', {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const data = await resp.json().catch(() => ({}));
        if (
          resp.status === 403 &&
          (data?.code === 'QUOTA_EXCEEDED' || data?.code === 'FORBIDDEN_PERMISSION')
        ) {
          if (data?.code === 'QUOTA_EXCEEDED') {
            setUpgradeModalReason(
              data.error ||
                'Quota atteint sur votre formule actuelle. Passez à une formule supérieure pour continuer.'
            );
            setIsUpgradeModalOpen(true);
          }
          try {
            const wsResp = await fetch('/api/merchant/workspace', {
              headers: getAuthHeaders(),
              credentials: 'include',
            });
            if (wsResp.ok && hydratedAccountIdRef.current) {
              const wsData = await wsResp.json();
              if (wsData?.workspace) {
                applyWorkspaceState(
                  hydratedAccountIdRef.current,
                  wsData.workspace,
                  wsData.activeOperator || null
                );
              }
            }
          } catch {
            // ignore reload fallback error
          }
          return false;
        }
        if (!resp.ok) return false;
        if (data?.capabilities) {
          setCapabilities(data.capabilities);
        }
        return true;
      } catch {
        return false;
      }
    },
    [isAuthenticated, applyWorkspaceState]
  );

  // Save per-account local cache & debounced server sync on workspace changes
  useEffect(() => {
    const accId = hydratedAccountIdRef.current;
    if (!isAuthenticated || !accId) return;

    const payload = buildCurrentWorkspacePayload();
    setStoredItem(getAccountWorkspaceKey(accId), payload);

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    if (!isOnline) {
      return;
    }

    const timer = setTimeout(() => {
      pushWorkspaceToServer(payload);
    }, 450);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isOnline, buildCurrentWorkspacePayload, pushWorkspaceToServer]);

  const syncPendingOperations = useCallback(async () => {
    if (!isAuthenticated || !hydratedAccountIdRef.current) return;

    if (pendingSyncOperations.length > 0) {
      try {
        await fetch('/api/merchant/sync/operations', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ operations: pendingSyncOperations }),
        });
      } catch {
        return;
      }
    }

    const payload = buildCurrentWorkspacePayload();
    const ok = await pushWorkspaceToServer(payload);
    if (ok) {
      setSales((prev) => prev.map((s) => (s.synced ? s : { ...s, synced: true })));
      setStockMovements((prev) =>
        prev.map((m) => (m.syncStatus === 'pending' ? { ...m, syncStatus: 'synced' } : m))
      );
      setPendingSyncOperations((prev) => prev.map((op) => ({ ...op, status: 'synchronise' })));
      setTimeout(() => {
        setPendingSyncOperations([]);
      }, 900);
    }
  }, [isAuthenticated, pendingSyncOperations, buildCurrentWorkspacePayload, pushWorkspaceToServer]);

  // Browser online / offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingOperations();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingOperations]);

  const currentStore = useMemo(() => {
    return stores.find((s) => s.id === activeStoreId) || stores[0];
  }, [stores, activeStoreId]);

  const queueSync = (
    action: SyncOperation['action'],
    entity: string,
    entityId: string,
    payload: any,
    clientOpId?: string
  ) => {
    if (!isOnline) {
      const clientOperationId =
        clientOpId || `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const op: SyncOperation = {
        id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        clientOperationId,
        timestamp: new Date().toISOString(),
        action,
        entity,
        entityId,
        payload,
        status: 'en_attente',
      };
      setPendingSyncOperations((prev) => [op, ...prev]);
    }
  };

  // Staff & Audit helpers
  const logAudit = useCallback(
    (action: string, entity: string, summary: string, entityId?: string, details?: string) => {
      const opName = activeOperator?.name || currentUser.name;
      const opId = activeOperator?.id || currentUser.id;
      const opRole = activeOperator?.role || currentUser.role;
      const entry: AuditLog = {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        storeId: activeStoreId,
        storeName: currentStore?.name || 'Boutique Principale',
        employeeId: opId,
        employeeName: opName,
        employeeRole: opRole,
        action,
        entity,
        entityId,
        summary,
        details,
      };
      setAuditLogs((prev) => [entry, ...prev].slice(0, 400));
    },
    [activeOperator, currentUser, activeStoreId, currentStore]
  );

  const openPinModal = useCallback(() => setIsPinModalOpen(true), []);
  const closePinModal = useCallback(() => setIsPinModalOpen(false), []);

  const verifyOperatorPin = async (
    employeeId: string,
    pin: string
  ): Promise<{ success: boolean; error?: string; employee?: Employee }> => {
    try {
      const resp = await fetch('/api/merchant/employees/verify-pin', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ employeeId, pin }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success || !data?.employee) {
        return { success: false, error: data?.error || 'Code PIN incorrect.' };
      }
      const verifiedEmp: Employee = data.employee;
      setActiveOperator(verifiedEmp);
      if (hydratedAccountIdRef.current) {
        setStoredItem(getAccountOperatorKey(hydratedAccountIdRef.current), verifiedEmp.id);
      }
      if (verifiedEmp.storeIds.length > 0 && !verifiedEmp.storeIds.includes(activeStoreId)) {
        setActiveStoreId(verifiedEmp.storeIds[0]);
      }
      setIsPinModalOpen(false);
      logAudit(
        'CHANGEMENT_OPERATEUR',
        'Employee',
        `Session caisse basculée vers ${verifiedEmp.name} (${verifiedEmp.role})`,
        verifiedEmp.id
      );
      return { success: true, employee: verifiedEmp };
    } catch {
      return { success: false, error: 'Impossible de vérifier le code PIN (hors ligne).' };
    }
  };

  const saveEmployee = async (
    emp: Partial<Employee> & { name: string; role: StaffRole; pinCode?: string }
  ): Promise<{ success: boolean; error?: string; employee?: Employee }> => {
    try {
      const resp = await fetch('/api/merchant/employees', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(emp),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success || !data?.employee) {
        return { success: false, error: data?.error || 'Impossible d’enregistrer l’employé.' };
      }
      const saved: Employee = data.employee;
      setEmployees((prev) => {
        const exists = prev.some((e) => e.id === saved.id);
        return exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved];
      });
      if (activeOperator?.id === saved.id) {
        setActiveOperator(saved);
      }
      logAudit(
        emp.id ? 'MODIFICATION_EMPLOYE' : 'CREATION_EMPLOYE',
        'Employee',
        `Profil employé enregistré : ${saved.name} (${saved.role})`,
        saved.id
      );
      return { success: true, employee: saved };
    } catch {
      return { success: false, error: 'Erreur réseau lors de la sauvegarde de l’employé.' };
    }
  };

  const removeEmployee = async (
    employeeId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const target = employees.find((e) => e.id === employeeId);
      const resp = await fetch(`/api/merchant/employees/${encodeURIComponent(employeeId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        return { success: false, error: data?.error || 'Impossible de supprimer cet employé.' };
      }
      setEmployees((prev) => prev.filter((e) => e.id !== employeeId));
      logAudit(
        'SUPPRESSION_EMPLOYE',
        'Employee',
        `Employé supprimé : ${target?.name || employeeId}`,
        employeeId
      );
      return { success: true };
    } catch {
      return { success: false, error: 'Erreur réseau.' };
    }
  };

  const hasPermission = useCallback(
    (perm: Exclude<keyof StaffPermissions, 'maxDiscountPercent'>) => {
      return hasEmployeePermission(activeOperator, perm);
    },
    [activeOperator]
  );

  const canAccessStore = useCallback(
    (storeId: string) => {
      return canEmployeeAccessStore(activeOperator, storeId);
    },
    [activeOperator]
  );

  const toggleOnlineMode = () => {
    setIsOnline((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          syncPendingOperations();
        }, 50);
      }
      return next;
    });
  };

  // Current month key for invoice limits (YYYY-MM, resets automatically each calendar month)
  const currentMonthKey = useMemo(() => {
    return new Date().toISOString().slice(0, 7);
  }, []);

  const quotaSummary = useMemo(() => {
    const activeProductsUsed = products.filter((p) => p.active).length;
    const storesUsed = stores.length;
    const monthlyInvoicesUsed = invoices.filter((i) =>
      String(i.date || '').startsWith(currentMonthKey)
    ).length;

    const prodLimit = capabilities.maxProducts;
    const storeLimit = capabilities.maxStores;
    const invLimit = capabilities.maxInvoicesPerMonth;

    return {
      planId: capabilities.planId || 'plan-gratuit',
      planName: capabilities.planName || 'Gratuit',
      monthKey: currentMonthKey,
      products: {
        used: activeProductsUsed,
        limit: prodLimit,
        remaining: prodLimit === -1 ? null : Math.max(0, prodLimit - activeProductsUsed),
        reached: prodLimit !== -1 && activeProductsUsed >= prodLimit,
      },
      stores: {
        used: storesUsed,
        limit: storeLimit,
        remaining: storeLimit === -1 ? null : Math.max(0, storeLimit - storesUsed),
        reached: storeLimit !== -1 && storesUsed >= storeLimit,
      },
      invoices: {
        used: monthlyInvoicesUsed,
        limit: invLimit,
        remaining: invLimit === -1 ? null : Math.max(0, invLimit - monthlyInvoicesUsed),
        reached: invLimit !== -1 && monthlyInvoicesUsed >= invLimit,
      },
    };
  }, [capabilities, products, stores, invoices, currentMonthKey]);

  // Capability checks (no financial/subscription exposure)
  const canAddProduct = (): AccessCheckResult => {
    const activeCount = products.filter((p) => p.active).length;
    const planLabel = capabilities.planName || 'Gratuit';
    const nextPlan: 'Professionnel' | 'Entreprise' =
      capabilities.planId === 'plan-gratuit' ? 'Professionnel' : 'Entreprise';
    if (!capabilities.isAccountOperational) {
      return {
        allowed: false,
        reason: 'Votre compte est actuellement restreint. Contactez l’administrateur SAMA STOCK.',
        limit: capabilities.maxProducts,
        current: activeCount,
        upgradeSuggestedPlan: nextPlan,
      };
    }
    if (capabilities.maxProducts === -1 || activeCount < capabilities.maxProducts) {
      return { allowed: true, limit: capabilities.maxProducts, current: activeCount };
    }
    return {
      allowed: false,
      reason: `Limite atteinte : votre formule ${planLabel} autorise ${capabilities.maxProducts} produits maximum (${activeCount}/${capabilities.maxProducts} utilisés). Passez à une formule supérieure (${nextPlan}) pour ajouter d'autres produits.`,
      limit: capabilities.maxProducts,
      current: activeCount,
      upgradeSuggestedPlan: nextPlan,
    };
  };

  const canAddStore = (): AccessCheckResult => {
    const count = stores.length;
    const planLabel = capabilities.planName || 'Gratuit';
    if (!capabilities.isAccountOperational) {
      return {
        allowed: false,
        reason: 'Votre compte est actuellement restreint. Contactez l’administrateur SAMA STOCK.',
        limit: capabilities.maxStores,
        current: count,
        upgradeSuggestedPlan: 'Entreprise',
      };
    }
    if (capabilities.maxStores === -1 || count < capabilities.maxStores) {
      return { allowed: true, limit: capabilities.maxStores, current: count };
    }
    return {
      allowed: false,
      reason: `Limite atteinte : votre formule ${planLabel} est limitée à ${capabilities.maxStores} boutique (${count}/${capabilities.maxStores} utilisée). Passez à une formule supérieure (Entreprise) pour créer une deuxième boutique.`,
      limit: capabilities.maxStores,
      current: count,
      upgradeSuggestedPlan: 'Entreprise',
    };
  };

  const canCreateInvoice = (): AccessCheckResult => {
    const monthlyCount = invoices.filter((i) => String(i.date || '').startsWith(currentMonthKey)).length;
    const planLabel = capabilities.planName || 'Gratuit';
    const nextPlan: 'Professionnel' | 'Entreprise' =
      capabilities.planId === 'plan-gratuit' ? 'Professionnel' : 'Entreprise';
    if (!capabilities.isAccountOperational) {
      return {
        allowed: false,
        reason: 'Votre compte est actuellement restreint. Contactez l’administrateur SAMA STOCK.',
        limit: capabilities.maxInvoicesPerMonth,
        current: monthlyCount,
        upgradeSuggestedPlan: nextPlan,
      };
    }
    if (
      capabilities.maxInvoicesPerMonth === -1 ||
      monthlyCount < capabilities.maxInvoicesPerMonth
    ) {
      return { allowed: true, limit: capabilities.maxInvoicesPerMonth, current: monthlyCount };
    }
    return {
      allowed: false,
      reason: `Quota mensuel atteint : votre formule ${planLabel} autorise ${capabilities.maxInvoicesPerMonth} factures par mois (${monthlyCount}/${capabilities.maxInvoicesPerMonth} utilisées ce mois-ci). Passez à une formule supérieure (${nextPlan}) pour émettre plus de factures.`,
      limit: capabilities.maxInvoicesPerMonth,
      current: monthlyCount,
      upgradeSuggestedPlan: nextPlan,
    };
  };

  const hasFeature = (featureKey: PlanFeatureKey): boolean => {
    if (!capabilities.isAccountOperational) return false;
    return capabilities.allowedFeatures.includes(featureKey);
  };

  const openUpgradeModal = (reason?: string) => {
    setUpgradeModalReason(
      reason ||
        'Cette capacité nécessite une extension de votre compte. Contactez l’administrateur SAMA STOCK.'
    );
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  // Authentication handlers
  const login = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success || !data?.account) {
        return {
          success: false,
          error: data?.error || 'Identifiant ou mot de passe incorrect.',
        };
      }

      clearStoredSessionToken();
      if (typeof data?.csrfToken === 'string' && data.csrfToken) {
        setInMemoryCsrfToken(data.csrfToken);
      }
      let workspace: WorkspacePayload = data.workspace;
      workspace = await attemptOneTimeLegacyMigration(data.account.id, workspace);

      const user: User = {
        id: data.account.id,
        name: data.account.name,
        email: data.account.email || '',
        phone: data.account.phone || '',
        role: data.account.role,
        storeIds: (workspace.stores || []).map((s) => s.id),
        active: Boolean(data.account.active),
        mustChangePassword: Boolean(data.account.mustChangePassword),
      };

      setCurrentUser(user);
      applyWorkspaceState(data.account.id, workspace, data.activeOperator || null);
      setActiveTabState(user.mustChangePassword ? 'settings' : 'dashboard');
      setIsAuthenticated(true);
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Impossible de contacter le serveur. Vérifiez votre connexion.',
      };
    }
  };

  const register = async (data: {
    name: string;
    phone: string;
    email: string;
    businessName: string;
    storeName: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success || !json?.account) {
        return {
          success: false,
          error: json?.error || 'Impossible de créer le compte.',
        };
      }

      clearStoredSessionToken();
      if (typeof json?.csrfToken === 'string' && json.csrfToken) {
        setInMemoryCsrfToken(json.csrfToken);
      }
      const workspace: WorkspacePayload = json.workspace;
      const user: User = {
        id: json.account.id,
        name: json.account.name,
        email: json.account.email || '',
        phone: json.account.phone || '',
        role: json.account.role,
        storeIds: (workspace.stores || []).map((s) => s.id),
        active: Boolean(json.account.active),
        mustChangePassword: Boolean(json.account.mustChangePassword),
      };

      setCurrentUser(user);
      applyWorkspaceState(json.account.id, workspace, json.activeOperator || null);
      setActiveTabState('dashboard');
      setIsAuthenticated(true);
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Erreur réseau lors de la création du compte.',
      };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
    } catch {
      // ignore network error on logout
    }
    const accId = hydratedAccountIdRef.current || currentUser.id;
    try {
      if (accId) {
        localStorage.removeItem(getAccountWorkspaceKey(accId));
        localStorage.removeItem(getAccountOperatorKey(accId));
      }
      localStorage.removeItem('samastock_backup_pre_unitech_cleanup_20261115');
      clearAllData();
    } catch {
      // ignore storage errors
    }
    clearStoredSessionToken();
    setIsAuthenticated(false);
    resetInMemoryWorkspace();
  };

  const updateProfile = async (updates: {
    name: string;
    email: string;
    phone: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const resp = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success || !data?.account) {
        return { success: false, error: data?.error || 'Erreur lors de la mise à jour.' };
      }
      setCurrentUser((prev) => ({
        ...prev,
        name: data.account.name,
        email: data.account.email || '',
        phone: data.account.phone || '',
      }));
      return { success: true };
    } catch {
      return { success: false, error: 'Erreur réseau.' };
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
    confirmPassword?: string
  ): Promise<{ success: boolean; error?: string; code?: string }> => {
    const payload = JSON.stringify({
      currentPassword,
      newPassword,
      confirmPassword: confirmPassword !== undefined ? confirmPassword : newPassword,
    });

    try {
      let resp = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: payload,
      });
      let data = await resp.json().catch(() => ({}));

      // If CSRF token in memory was out of sync with the valid HttpOnly session cookie, resync via /api/auth/me once
      if (resp.status === 403 && data?.code === 'CSRF_TOKEN_INVALID') {
        const meResp = await fetch('/api/auth/me', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const meData = await meResp.json().catch(() => ({}));
        if (meResp.ok && typeof meData?.csrfToken === 'string' && meData.csrfToken) {
          setInMemoryCsrfToken(meData.csrfToken);
          resp = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: payload,
          });
          data = await resp.json().catch(() => ({}));
        }
      }

      if (!resp.ok || !data?.success) {
        return {
          success: false,
          code: data?.code,
          error: data?.error || 'Impossible de modifier le mot de passe.',
        };
      }
      clearStoredSessionToken();
      if (typeof data?.csrfToken === 'string' && data.csrfToken) {
        setInMemoryCsrfToken(data.csrfToken);
      }
      setCurrentUser((prev) => ({
        ...prev,
        ...(data?.account
          ? {
              name: data.account.name || prev.name,
              email: data.account.email || prev.email,
              phone: data.account.phone || prev.phone,
              role: data.account.role || prev.role,
              active: Boolean(data.account.active),
            }
          : {}),
        mustChangePassword: false,
      }));
      return { success: true };
    } catch {
      return { success: false, error: 'Erreur réseau.' };
    }
  };

  // Organization & Store management
  const updateOrganization = (updates: Partial<Organization>) => {
    setOrganization((prev) => stripTaxFields({ ...prev, ...updates }));
  };

  const addStore = (storeData: Omit<Store, 'id'>) => {
    const check = canAddStore();
    if (!check.allowed) {
      openUpgradeModal(check.reason);
      return;
    }

    const newStore: Store = {
      ...storeData,
      id: `store-${Date.now()}`,
    };
    setStores((prev) => [...prev, newStore]);
    queueSync('CREATE_STORE', 'Store', newStore.id, newStore);

    if (isAuthenticated && isOnline) {
      fetch('/api/merchant/stores', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(newStore),
      })
        .then(async (resp) => {
          const data = await resp.json().catch(() => ({}));
          if (resp.status === 403 && data?.code === 'QUOTA_EXCEEDED') {
            setStores((prev) => prev.filter((s) => s.id !== newStore.id));
            openUpgradeModal(data.error);
          } else if (data?.capabilities) {
            setCapabilities(data.capabilities);
          }
        })
        .catch(() => {});
    }
  };

  const updateStore = (id: string, updates: Partial<Store>) => {
    setStores((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Product Catalog
  const addProduct = (prodData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const check = canAddProduct();
    if (!check.allowed) {
      openUpgradeModal(check.reason);
      return;
    }

    const id = `prod-${Date.now()}`;
    const now = new Date().toISOString();
    const newProd: Product = {
      ...prodData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    setProducts((prev) => [newProd, ...prev]);

    let initialMovId = '';
    if (prodData.quantity > 0) {
      initialMovId = `mov-${Date.now()}`;
      const mov: StockMovement = {
        id: initialMovId,
        productId: id,
        productName: newProd.name,
        storeId: activeStoreId,
        storeName: currentStore?.name || 'Boutique Principale',
        type: 'initial',
        quantity: prodData.quantity,
        previousQuantity: 0,
        newQuantity: prodData.quantity,
        reason: 'Création du produit avec stock initial',
        date: now,
        userId: currentUser.id,
        userName: currentUser.name,
        syncStatus: isOnline ? 'synced' : 'pending',
      };
      setStockMovements((prev) => [mov, ...prev]);
    }

    queueSync('CREATE_PRODUCT', 'Product', id, newProd);

    if (isAuthenticated && isOnline) {
      fetch('/api/merchant/products', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(newProd),
      })
        .then(async (resp) => {
          const data = await resp.json().catch(() => ({}));
          if (resp.status === 403 && data?.code === 'QUOTA_EXCEEDED') {
            setProducts((prev) => prev.filter((p) => p.id !== id));
            if (initialMovId) {
              setStockMovements((prev) => prev.filter((m) => m.id !== initialMovId));
            }
            openUpgradeModal(data.error);
          } else if (data?.capabilities) {
            setCapabilities(data.capabilities);
          }
        })
        .catch(() => {});
    }
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const now = new Date().toISOString();
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: now } : p))
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setStockMovements((prev) => prev.filter((m) => m.productId !== id));
  };

  const clearAllProducts = () => {
    setProducts([]);
    setStockMovements([]);
  };

  const clearMerchantWorkspaceData = () => {
    setProducts([]);
    setStockMovements([]);
    setSales([]);
    setInvoices([]);
    setCustomers([]);
    setSuppliers([]);
    setPurchases([]);
    setExpenses([]);
    setInventorySessions([]);
  };

  const importWorkspaceData = async (
    parsedData: Partial<WorkspacePayload>
  ): Promise<boolean> => {
    if (!parsedData) return false;
    const accId = hydratedAccountIdRef.current;
    if (parsedData.organization) {
      setOrganization(stripTaxFields(parsedData.organization));
    }
    if (Array.isArray(parsedData.stores) && parsedData.stores.length > 0) {
      setStores(parsedData.stores);
      setActiveStoreId(parsedData.stores[0].id);
    }
    if (Array.isArray(parsedData.categories) && parsedData.categories.length > 0) {
      setCategories(parsedData.categories);
    }
    if (Array.isArray(parsedData.products)) setProducts(parsedData.products);
    if (Array.isArray(parsedData.customers)) setCustomers(parsedData.customers);
    if (Array.isArray(parsedData.suppliers)) {
      setSuppliers(parsedData.suppliers.map(stripTaxFields));
    }
    if (Array.isArray(parsedData.sales)) setSales(parsedData.sales);
    if (Array.isArray(parsedData.invoices)) {
      setInvoices(parsedData.invoices.map(stripTaxFields));
    }
    if (Array.isArray(parsedData.purchases)) setPurchases(parsedData.purchases);
    if (Array.isArray(parsedData.expenses)) setExpenses(parsedData.expenses);
    if (Array.isArray(parsedData.stockMovements)) setStockMovements(parsedData.stockMovements);
    if (Array.isArray(parsedData.inventorySessions)) {
      setInventorySessions(parsedData.inventorySessions);
    }
    if (accId) {
      const merged: WorkspacePayload = {
        organization: parsedData.organization
          ? stripTaxFields(parsedData.organization)
          : organization,
        stores:
          Array.isArray(parsedData.stores) && parsedData.stores.length > 0
            ? parsedData.stores
            : stores,
        activeStoreId:
          Array.isArray(parsedData.stores) && parsedData.stores.length > 0
            ? parsedData.stores[0].id
            : activeStoreId,
        activeShift,
        categories:
          Array.isArray(parsedData.categories) && parsedData.categories.length > 0
            ? parsedData.categories
            : categories,
        products: Array.isArray(parsedData.products) ? parsedData.products : products,
        stockMovements: Array.isArray(parsedData.stockMovements)
          ? parsedData.stockMovements
          : stockMovements,
        customers: Array.isArray(parsedData.customers) ? parsedData.customers : customers,
        suppliers: Array.isArray(parsedData.suppliers)
          ? parsedData.suppliers.map(stripTaxFields)
          : suppliers,
        purchases: Array.isArray(parsedData.purchases) ? parsedData.purchases : purchases,
        sales: Array.isArray(parsedData.sales) ? parsedData.sales : sales,
        invoices: Array.isArray(parsedData.invoices)
          ? parsedData.invoices.map(stripTaxFields)
          : invoices,
        expenses: Array.isArray(parsedData.expenses) ? parsedData.expenses : expenses,
        inventorySessions: Array.isArray(parsedData.inventorySessions)
          ? parsedData.inventorySessions
          : inventorySessions,
      };
      await pushWorkspaceToServer(merged);
    }
    return true;
  };

  const archiveProduct = (id: string) => {
    updateProduct(id, { active: false });
  };

  const importProducts = (newProducts: Product[]) => {
    if (!Array.isArray(newProducts) || newProducts.length === 0) return;
    const activeCount = products.filter((p) => p.active).length;
    const incomingActive = newProducts.filter((p) => p.active !== false);
    if (capabilities.maxProducts !== -1 && activeCount + incomingActive.length > capabilities.maxProducts) {
      const remaining = Math.max(0, capabilities.maxProducts - activeCount);
      const nextPlan = capabilities.planId === 'plan-gratuit' ? 'Professionnel' : 'Entreprise';
      openUpgradeModal(
        `Import bloqué : votre formule ${capabilities.planName || 'Gratuit'} est limitée à ${capabilities.maxProducts} produits (${remaining} emplacement(s) restant(s) pour ${incomingActive.length} article(s) à importer). Passez à la formule ${nextPlan}.`
      );
      return;
    }
    setProducts((prev) => [...newProducts, ...prev]);
  };

  // Categories Management
  const addCategory = (catData: Omit<Category, 'id' | 'createdAt'>): Category => {
    const id = `cat-${Date.now()}`;
    const newCat: Category = {
      ...catData,
      id,
      slug: catData.slug || catData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      createdAt: new Date().toISOString(),
    };
    setCategories((prev) => [...prev, newCat]);
    return newCat;
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...updates };
          if (updates.name && updates.name !== c.name) {
            setProducts((pList) =>
              pList.map((p) => (p.category === c.name ? { ...p, category: updates.name! } : p))
            );
          }
          return updated;
        }
        return c;
      })
    );
  };

  const deleteCategory = (id: string): boolean => {
    const target = categories.find((c) => c.id === id);
    if (!target) return false;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    return true;
  };

  const resetCategoriesToDefault = () => {
    setCategories(defaultCategories);
  };

  // Stock Movements & Transfers
  const addStockMovement = (movementData: Omit<StockMovement, 'id' | 'date' | 'syncStatus'>) => {
    const now = new Date().toISOString();
    const movId = `mov-${Date.now()}`;
    const newMov: StockMovement = {
      ...movementData,
      id: movId,
      date: now,
      syncStatus: isOnline ? 'synced' : 'pending',
    };

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== movementData.productId) return p;
        const currentStoreQty = p.storeQuantities?.[movementData.storeId] ?? 0;
        const newStoreQty = Math.max(0, currentStoreQty + movementData.quantity);
        const updatedStoreQuantities = {
          ...p.storeQuantities,
          [movementData.storeId]: newStoreQty,
        };
        const totalQty = Object.values(updatedStoreQuantities).reduce((a, b) => a + b, 0);

        return {
          ...p,
          storeQuantities: updatedStoreQuantities,
          quantity: totalQty,
          updatedAt: now,
        };
      })
    );

    setStockMovements((prev) => [newMov, ...prev]);
    queueSync('UPDATE_STOCK', 'StockMovement', movId, newMov);
  };

  const transferStock = (
    productId: string,
    fromStoreId: string,
    toStoreId: string,
    quantity: number,
    reason: string
  ): boolean => {
    const product = products.find((p) => p.id === productId);
    if (!product) return false;

    const sourceQty = product.storeQuantities?.[fromStoreId] ?? 0;
    if (sourceQty < quantity) {
      return false;
    }

    const fromStore = stores.find((s) => s.id === fromStoreId);
    const toStore = stores.find((s) => s.id === toStoreId);
    const now = new Date().toISOString();
    const transferRef = `TR-${Date.now().toString().slice(-6)}`;

    const outboundMov: StockMovement = {
      id: `mov-${Date.now()}-out`,
      productId,
      productName: product.name,
      storeId: fromStoreId,
      storeName: fromStore?.name || 'Départ',
      destinationStoreId: toStoreId,
      type: 'transfert_sortant',
      quantity: -quantity,
      previousQuantity: sourceQty,
      newQuantity: sourceQty - quantity,
      reason: `Transfert vers ${toStore?.name || 'Boutique'} (${reason})`,
      referenceId: transferRef,
      date: now,
      userId: currentUser.id,
      userName: currentUser.name,
      syncStatus: isOnline ? 'synced' : 'pending',
    };

    const destQty = product.storeQuantities?.[toStoreId] ?? 0;
    const inboundMov: StockMovement = {
      id: `mov-${Date.now()}-in`,
      productId,
      productName: product.name,
      storeId: toStoreId,
      storeName: toStore?.name || 'Arrivée',
      type: 'transfert_entrant',
      quantity: quantity,
      previousQuantity: destQty,
      newQuantity: destQty + quantity,
      reason: `Réception transfert de ${fromStore?.name || 'Boutique'} (${reason})`,
      referenceId: transferRef,
      date: now,
      userId: currentUser.id,
      userName: currentUser.name,
      syncStatus: isOnline ? 'synced' : 'pending',
    };

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const updatedStoreQuantities = {
          ...p.storeQuantities,
          [fromStoreId]: Math.max(0, sourceQty - quantity),
          [toStoreId]: destQty + quantity,
        };
        const totalQty = Object.values(updatedStoreQuantities).reduce((a, b) => a + b, 0);
        return {
          ...p,
          storeQuantities: updatedStoreQuantities,
          quantity: totalQty,
          updatedAt: now,
        };
      })
    );

    setStockMovements((prev) => [inboundMov, outboundMov, ...prev]);
    return true;
  };

  // Register Shifts & Cash Movements
  const openShift = (initialCash: number) => {
    const opName = activeOperator?.name || currentUser.name;
    const opId = activeOperator?.id || currentUser.id;
    const shift: CashRegisterShift = {
      id: `shift-${Date.now()}`,
      storeId: activeStoreId,
      storeName: currentStore?.name || 'Boutique Principale',
      userId: opId,
      userName: opName,
      openedAt: new Date().toISOString(),
      initialCash,
      cashSales: 0,
      waveSales: 0,
      orangeMoneySales: 0,
      carteSales: 0,
      virementSales: 0,
      creditSales: 0,
      otherSales: 0,
      totalSales: 0,
      salesCount: 0,
      cashInTotal: 0,
      cashOutTotal: 0,
      expensesTotal: 0,
      expectedCash: initialCash,
      movements: [],
      status: 'ouverte',
    };
    setActiveShift(shift);
    logAudit(
      'OUVERTURE_CAISSE',
      'CashRegisterShift',
      `Ouverture de caisse avec fond initial ${initialCash.toLocaleString('fr-FR')} FCFA`,
      shift.id
    );
  };

  const recordCashMovement = (
    type: CashMovement['type'],
    amount: number,
    reason: string,
    category?: string
  ): boolean => {
    if (!activeShift || amount <= 0) return false;
    const opName = activeOperator?.name || currentUser.name;
    const opId = activeOperator?.id || currentUser.id;
    const mov: CashMovement = {
      id: `cmov-${Date.now()}`,
      shiftId: activeShift.id,
      storeId: activeStoreId,
      type,
      amount,
      reason,
      category,
      date: new Date().toISOString(),
      operatorId: opId,
      operatorName: opName,
    };

    setActiveShift((prev) => {
      if (!prev) return null;
      const nextCashIn = (prev.cashInTotal || 0) + (type === 'entree' ? amount : 0);
      const nextCashOut = (prev.cashOutTotal || 0) + (type === 'sortie' ? amount : 0);
      const nextExp = (prev.expensesTotal || 0) + (type === 'depense' ? amount : 0);
      const nextExpected =
        prev.initialCash + prev.cashSales + nextCashIn - nextCashOut - nextExp;
      return {
        ...prev,
        cashInTotal: nextCashIn,
        cashOutTotal: nextCashOut,
        expensesTotal: nextExp,
        expectedCash: nextExpected,
        movements: [mov, ...(prev.movements || [])],
      };
    });

    if (type === 'depense') {
      addExpense({
        date: new Date().toISOString().split('T')[0],
        category: (category as any) || 'autre',
        amount,
        description: `[Caisse] ${reason}`,
        paymentMethod: 'especes',
        storeId: activeStoreId,
      });
    }

    logAudit(
      'MOUVEMENT_CAISSE',
      'CashMovement',
      `${type === 'entree' ? 'Entrée' : type === 'sortie' ? 'Sortie' : 'Dépense'} caisse : ${amount.toLocaleString('fr-FR')} FCFA (${reason})`,
      mov.id
    );
    queueSync('CASH_MOVEMENT', 'CashMovement', mov.id, mov);
    return true;
  };

  const closeShift = (actualCash: number, notes?: string): CashRegisterShift | null => {
    if (!activeShift) return null;
    const opName = activeOperator?.name || currentUser.name;
    const closedShift: CashRegisterShift = {
      ...activeShift,
      closedAt: new Date().toISOString(),
      closedBy: opName,
      actualCash,
      cashDifference: actualCash - activeShift.expectedCash,
      status: 'fermee',
      notes: notes || activeShift.notes,
    };
    setShiftHistory((prev) => [closedShift, ...prev]);
    setActiveShift(null);
    logAudit(
      'CLOTURE_CAISSE',
      'CashRegisterShift',
      `Clôture caisse : attendu ${closedShift.expectedCash.toLocaleString('fr-FR')} FCFA · compté ${actualCash.toLocaleString('fr-FR')} FCFA (écart ${(actualCash - closedShift.expectedCash).toLocaleString('fr-FR')} FCFA)`,
      closedShift.id
    );
    queueSync('CLOSE_SHIFT', 'CashRegisterShift', closedShift.id, closedShift);
    return closedShift;
  };

  // Held Sales (Tickets en attente)
  const holdCurrentSale = (data: {
    label?: string;
    customerId?: string;
    customerName?: string;
    items: CartItem[];
    discountType: 'amount' | 'percent';
    discountValue: number;
    notes?: string;
  }): HeldSale => {
    const now = new Date().toISOString();
    const opName = activeOperator?.name || currentUser.name;
    const opId = activeOperator?.id || currentUser.id;
    const held: HeldSale = {
      id: `hold-${Date.now()}`,
      label:
        data.label?.trim() ||
        data.customerName ||
        `Ticket #${String(heldSales.length + 1).padStart(2, '0')}`,
      storeId: activeStoreId,
      storeName: currentStore?.name || 'Boutique Principale',
      createdAt: now,
      updatedAt: now,
      operatorId: opId,
      operatorName: opName,
      customerId: data.customerId,
      customerName: data.customerName,
      items: data.items,
      discountType: data.discountType,
      discountValue: data.discountValue,
      notes: data.notes,
    };
    setHeldSales((prev) => [held, ...prev]);
    return held;
  };

  const deleteHeldSale = (id: string) => {
    setHeldSales((prev) => prev.filter((h) => h.id !== id));
  };

  // Commercial: Sales & POS execution
  const recordSale = (saleData: {
    items: CartItem[];
    customerId?: string;
    customerName: string;
    subtotal: number;
    discount: number;
    discountType?: 'amount' | 'percent';
    discountValue?: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    changeDue?: number;
    paymentMethod: PaymentMethod;
    paymentSplits?: PaymentSplit[];
    paymentReference?: string;
    loyaltyPointsRedeemed?: number;
    loyaltyDiscountAmount?: number;
    notes?: string;
  }): Sale | null => {
    const now = new Date().toISOString();
    const saleId = `sale-${Date.now()}`;
    const saleNum = `VNT-2026-${String(sales.length + 1).padStart(4, '0')}`;
    const clientOperationId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const balanceDue = Math.max(0, saleData.totalAmount - saleData.paidAmount);
    const opName = activeOperator?.name || currentUser.name;
    const opId = activeOperator?.id || currentUser.id;
    const opRole = activeOperator?.role || currentUser.role;

    let status: Sale['status'] = 'payee';
    if (balanceDue > 0) {
      status = saleData.paidAmount > 0 ? 'partielle' : 'credit';
    }

    const loyaltyCfg = organization.loyaltySettings;
    let loyaltyPointsEarned = 0;
    if (
      saleData.customerId &&
      loyaltyCfg?.enabled &&
      (loyaltyCfg.amountPerPoint || 0) > 0 &&
      saleData.paidAmount > 0
    ) {
      loyaltyPointsEarned = Math.floor(saleData.paidAmount / loyaltyCfg.amountPerPoint);
    }

    const newSale: Sale = {
      id: saleId,
      saleNumber: saleNum,
      date: now,
      storeId: activeStoreId,
      storeName: currentStore?.name || 'Boutique Principale',
      customerId: saleData.customerId,
      customerName: saleData.customerName,
      items: saleData.items,
      subtotal: saleData.subtotal,
      discount: saleData.discount,
      discountType: saleData.discountType,
      discountValue: saleData.discountValue,
      taxRate: saleData.taxRate,
      taxAmount: saleData.taxAmount,
      totalAmount: saleData.totalAmount,
      paidAmount: saleData.paidAmount,
      changeDue: saleData.changeDue,
      balanceDue,
      paymentMethod: saleData.paymentMethod,
      paymentSplits: saleData.paymentSplits,
      paymentReference: saleData.paymentReference,
      status,
      cashierId: opId,
      cashierName: opName,
      operatorRole: opRole,
      loyaltyPointsEarned,
      loyaltyPointsRedeemed: saleData.loyaltyPointsRedeemed || 0,
      loyaltyDiscountAmount: saleData.loyaltyDiscountAmount || 0,
      notes: saleData.notes,
      clientOperationId,
      updatedAt: now,
      synced: isOnline,
    };

    const movementsToAdd: StockMovement[] = [];

    setProducts((prev) =>
      prev.map((prod) => {
        const matchingItems = saleData.items.filter((i) => i.productId === prod.id);
        if (matchingItems.length === 0) return prod;

        let totalDeductedForProd = 0;
        let updatedVariants = prod.variants ? [...prod.variants] : undefined;
        let updatedBatches = prod.batches ? [...prod.batches] : undefined;

        for (const itemSold of matchingItems) {
          const factor = Number(itemSold.unitFactor || 1);
          const baseUnitsSold = itemSold.quantity * factor;
          totalDeductedForProd += baseUnitsSold;

          if (itemSold.variantId && updatedVariants) {
            updatedVariants = updatedVariants.map((v) => {
              if (v.id !== itemSold.variantId) return v;
              const vCurr = v.storeQuantities?.[activeStoreId] ?? 0;
              return {
                ...v,
                storeQuantities: {
                  ...v.storeQuantities,
                  [activeStoreId]: Math.max(0, vCurr - baseUnitsSold),
                },
              };
            });
          }

          // FEFO batch deduction if batches exist for this store
          if (updatedBatches && updatedBatches.length > 0) {
            let remaining = baseUnitsSold;
            const sortedIndices = updatedBatches
              .map((b, idx) => ({ b, idx }))
              .filter(({ b }) => b.storeId === activeStoreId && b.quantity > 0)
              .sort((a, b) => a.b.expiryDate.localeCompare(b.b.expiryDate))
              .map((x) => x.idx);

            for (const idx of sortedIndices) {
              if (remaining <= 0) break;
              const take = Math.min(updatedBatches[idx].quantity, remaining);
              updatedBatches[idx] = {
                ...updatedBatches[idx],
                quantity: updatedBatches[idx].quantity - take,
              };
              remaining -= take;
            }
          }
        }

        const currentStoreQty = prod.storeQuantities?.[activeStoreId] ?? 0;
        const newStoreQty = Math.max(0, currentStoreQty - totalDeductedForProd);
        const updatedStoreQuantities = {
          ...prod.storeQuantities,
          [activeStoreId]: newStoreQty,
        };
        const newTotalQty = Object.values(updatedStoreQuantities).reduce((a, b) => a + b, 0);

        movementsToAdd.push({
          id: `mov-${Date.now()}-${prod.id}`,
          productId: prod.id,
          productName: prod.name,
          storeId: activeStoreId,
          storeName: currentStore?.name || 'Boutique Principale',
          type: 'vente',
          quantity: -totalDeductedForProd,
          previousQuantity: currentStoreQty,
          newQuantity: newStoreQty,
          reason: `Vente caisse #${saleNum}`,
          referenceId: saleNum,
          variantId: matchingItems[0]?.variantId,
          variantName: matchingItems[0]?.variantName,
          date: now,
          userId: opId,
          userName: opName,
          syncStatus: isOnline ? 'synced' : 'pending',
        });

        return {
          ...prod,
          storeQuantities: updatedStoreQuantities,
          quantity: newTotalQty,
          variants: updatedVariants,
          batches: updatedBatches,
          updatedAt: now,
        };
      })
    );

    setStockMovements((prev) => [...movementsToAdd, ...prev]);

    if (saleData.customerId) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id !== saleData.customerId) return c;
          const prevPts = c.loyaltyPoints || 0;
          const redeemed = saleData.loyaltyPointsRedeemed || 0;
          const nextPts = Math.max(0, prevPts - redeemed + loyaltyPointsEarned);
          const nextHistory: LoyaltyTransaction[] = [...(c.loyaltyHistory || [])];
          if (redeemed > 0) {
            nextHistory.unshift({
              id: `loy-use-${Date.now()}`,
              date: now,
              type: 'utilisation',
              points: -redeemed,
              saleId,
              saleNumber: saleNum,
              note: `Remise fidélité sur ticket #${saleNum}`,
            });
          }
          if (loyaltyPointsEarned > 0) {
            nextHistory.unshift({
              id: `loy-earn-${Date.now()}`,
              date: now,
              type: 'gain',
              points: loyaltyPointsEarned,
              saleId,
              saleNumber: saleNum,
              note: `Points gagnés sur vente #${saleNum}`,
            });
          }
          return {
            ...c,
            totalPurchases: c.totalPurchases + saleData.totalAmount,
            outstandingBalance: c.outstandingBalance + balanceDue,
            loyaltyPoints: nextPts,
            loyaltyHistory: nextHistory.slice(0, 100),
            updatedAt: now,
          };
        })
      );
    }

    if (activeShift) {
      let addCash = 0;
      let addWave = 0;
      let addOM = 0;
      let addCarte = 0;
      let addVirement = 0;
      let addCredit = balanceDue;
      let addOther = 0;

      if (saleData.paymentMethod === 'mixte' && Array.isArray(saleData.paymentSplits)) {
        for (const sp of saleData.paymentSplits) {
          if (sp.method === 'especes') addCash += sp.amount;
          else if (sp.method === 'wave') addWave += sp.amount;
          else if (sp.method === 'orange_money') addOM += sp.amount;
          else if (sp.method === 'carte') addCarte += sp.amount;
          else if (sp.method === 'virement') addVirement += sp.amount;
          else addOther += sp.amount;
        }
      } else {
        if (saleData.paymentMethod === 'especes') addCash = saleData.paidAmount;
        else if (saleData.paymentMethod === 'wave') addWave = saleData.paidAmount;
        else if (saleData.paymentMethod === 'orange_money') addOM = saleData.paidAmount;
        else if (saleData.paymentMethod === 'carte') addCarte = saleData.paidAmount;
        else if (saleData.paymentMethod === 'virement') addVirement = saleData.paidAmount;
        else if (saleData.paymentMethod !== 'credit') addOther = saleData.paidAmount;
      }

      setActiveShift((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          cashSales: prev.cashSales + addCash,
          waveSales: prev.waveSales + addWave,
          orangeMoneySales: prev.orangeMoneySales + addOM,
          carteSales: (prev.carteSales || 0) + addCarte,
          virementSales: (prev.virementSales || 0) + addVirement,
          creditSales: (prev.creditSales || 0) + addCredit,
          otherSales: prev.otherSales + addOther + addCarte + addVirement,
          totalSales: prev.totalSales + saleData.paidAmount,
          salesCount: (prev.salesCount || 0) + 1,
          expectedCash: prev.expectedCash + addCash,
        };
      });
    }

    setSales((prev) => [newSale, ...prev]);
    queueSync('CREATE_SALE', 'Sale', saleId, newSale, clientOperationId);

    return newSale;
  };

  const voidSale = (saleId: string, reason: string): boolean => {
    const target = sales.find((s) => s.id === saleId);
    if (!target || target.status === 'annulee') return false;
    const now = new Date().toISOString();
    const opName = activeOperator?.name || currentUser.name;
    const opId = activeOperator?.id || currentUser.id;
    const cleanReason = reason.trim() || 'Annulation sécurisée en caisse';

    const movementsToAdd: StockMovement[] = [];
    setProducts((prev) =>
      prev.map((prod) => {
        const matched = target.items.filter((i) => i.productId === prod.id);
        if (matched.length === 0) return prod;
        const qtyRestore = matched.reduce(
          (sum, it) => sum + it.quantity * Number(it.unitFactor || 1),
          0
        );
        const currQty = prod.storeQuantities?.[target.storeId] ?? 0;
        const nextStoreQty = currQty + qtyRestore;
        const nextStoreMap = { ...prod.storeQuantities, [target.storeId]: nextStoreQty };
        const totalQty = Object.values(nextStoreMap).reduce((a, b) => a + b, 0);

        let updatedVariants = prod.variants ? [...prod.variants] : undefined;
        for (const it of matched) {
          if (it.variantId && updatedVariants) {
            const restoreV = it.quantity * Number(it.unitFactor || 1);
            updatedVariants = updatedVariants.map((v) =>
              v.id === it.variantId
                ? {
                    ...v,
                    storeQuantities: {
                      ...v.storeQuantities,
                      [target.storeId]: (v.storeQuantities?.[target.storeId] ?? 0) + restoreV,
                    },
                  }
                : v
            );
          }
        }

        movementsToAdd.push({
          id: `mov-void-${Date.now()}-${prod.id}`,
          productId: prod.id,
          productName: prod.name,
          storeId: target.storeId,
          storeName: target.storeName,
          type: 'retour_client',
          quantity: qtyRestore,
          previousQuantity: currQty,
          newQuantity: nextStoreQty,
          reason: `Annulation vente #${target.saleNumber} (${cleanReason})`,
          referenceId: target.saleNumber,
          date: now,
          userId: opId,
          userName: opName,
          syncStatus: isOnline ? 'synced' : 'pending',
        });

        return {
          ...prod,
          storeQuantities: nextStoreMap,
          quantity: totalQty,
          variants: updatedVariants,
          updatedAt: now,
        };
      })
    );

    setStockMovements((prev) => [...movementsToAdd, ...prev]);

    if (target.customerId) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id !== target.customerId) return c;
          const ptsEarned = target.loyaltyPointsEarned || 0;
          const ptsRedeemed = target.loyaltyPointsRedeemed || 0;
          const nextPts = Math.max(0, (c.loyaltyPoints || 0) - ptsEarned + ptsRedeemed);
          return {
            ...c,
            totalPurchases: Math.max(0, c.totalPurchases - target.totalAmount),
            outstandingBalance: Math.max(0, c.outstandingBalance - target.balanceDue),
            loyaltyPoints: nextPts,
            updatedAt: now,
          };
        })
      );
    }

    setSales((prev) =>
      prev.map((s) =>
        s.id === saleId
          ? {
              ...s,
              status: 'annulee',
              voidedAt: now,
              voidedBy: opName,
              voidReason: cleanReason,
              updatedAt: now,
            }
          : s
      )
    );

    logAudit(
      'ANNULATION_VENTE',
      'Sale',
      `Vente #${target.saleNumber} annulée (${target.totalAmount.toLocaleString('fr-FR')} FCFA) — Motif : ${cleanReason}`,
      saleId
    );
    queueSync('VOID_SALE', 'Sale', saleId, {
      saleId,
      voidedAt: now,
      voidedBy: opName,
      reason: cleanReason,
    });
    return true;
  };

  // Invoices
  const createInvoice = (
    invData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'payments'>
  ): Invoice => {
    const check = canCreateInvoice();
    if (!check.allowed) {
      openUpgradeModal(check.reason);
      throw new Error(check.reason || 'Quota mensuel de factures atteint.');
    }

    const now = new Date().toISOString();
    const id = `inv-${Date.now()}`;
    const prefixMap: Record<string, string> = {
      facture_vente: 'FAC',
      proforma: 'PRO',
      devis: 'DEV',
      bon_commande: 'BC',
      bon_livraison: 'BL',
      recu: 'REC',
      avoir: 'AVR',
    };
    const prefix = prefixMap[invData.type] || 'DOC';
    const num = `${prefix}-2026-${String(invoices.length + 1).padStart(4, '0')}`;

    const newInvoice: Invoice = stripTaxFields({
      ...invData,
      id,
      invoiceNumber: num,
      payments:
        invData.paidAmount > 0
          ? [
              {
                id: `pay-${Date.now()}`,
                date: invData.date,
                amount: invData.paidAmount,
                paymentMethod: 'especes',
                receivedBy: currentUser.name,
                notes: 'Paiement initial',
              },
            ]
          : [],
      createdAt: now,
      updatedAt: now,
    });

    if (invData.type === 'facture_vente' && invData.status !== 'brouillon') {
      invData.items.forEach((item) => {
        if (item.productId) {
          const product = products.find((p) => p.id === item.productId);
          if (product) {
            const currentStoreQty = product.storeQuantities?.[invData.storeId] ?? 0;
            const newStoreQty = Math.max(0, currentStoreQty - item.quantity);
            const updatedStoreQuantities = {
              ...product.storeQuantities,
              [invData.storeId]: newStoreQty,
            };
            const newTotalQty = Object.values(updatedStoreQuantities).reduce((a, b) => a + b, 0);

            setProducts((prev) =>
              prev.map((p) =>
                p.id === product.id
                  ? {
                      ...p,
                      storeQuantities: updatedStoreQuantities,
                      quantity: newTotalQty,
                      updatedAt: now,
                    }
                  : p
              )
            );

            setStockMovements((prev) => [
              {
                id: `mov-${Date.now()}-${product.id}`,
                productId: product.id,
                productName: product.name,
                storeId: invData.storeId,
                storeName: invData.storeName,
                type: 'vente',
                quantity: -item.quantity,
                previousQuantity: currentStoreQty,
                newQuantity: newStoreQty,
                reason: `Facture validée #${num}`,
                referenceId: num,
                date: now,
                userId: currentUser.id,
                userName: currentUser.name,
                syncStatus: isOnline ? 'synced' : 'pending',
              },
              ...prev,
            ]);
          }
        }
      });
    }

    setInvoices((prev) => [newInvoice, ...prev]);
    queueSync('CREATE_INVOICE', 'Invoice', id, newInvoice);

    if (isAuthenticated && isOnline) {
      fetch('/api/merchant/invoices', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(newInvoice),
      })
        .then(async (resp) => {
          const data = await resp.json().catch(() => ({}));
          if (resp.status === 403 && data?.code === 'QUOTA_EXCEEDED') {
            setInvoices((prev) => prev.filter((inv) => inv.id !== id));
            openUpgradeModal(data.error);
          } else if (data?.capabilities) {
            setCapabilities(data.capabilities);
          }
        })
        .catch(() => {});
    }

    return newInvoice;
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    const now = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? stripTaxFields({ ...inv, ...updates, updatedAt: now }) : inv))
    );
  };

  const recordInvoicePayment = (
    invoiceId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    reference?: string,
    notes?: string
  ): boolean => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return false;

    const newPaidAmount = inv.paidAmount + amount;
    const newBalanceDue = Math.max(0, inv.totalAmount - newPaidAmount);
    const newStatus: Invoice['status'] = newBalanceDue === 0 ? 'payee' : 'partiellement_payee';

    const paymentRecord = {
      id: `pay-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      amount,
      paymentMethod,
      reference,
      receivedBy: currentUser.name,
      notes,
    };

    updateInvoice(invoiceId, {
      paidAmount: newPaidAmount,
      balanceDue: newBalanceDue,
      status: newStatus,
      payments: [...inv.payments, paymentRecord],
    });

    if (inv.customerId) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === inv.customerId
            ? { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - amount) }
            : c
        )
      );
    }

    return true;
  };

  const convertQuoteToInvoice = (quoteId: string): Invoice | null => {
    const quote = invoices.find((i) => i.id === quoteId);
    if (!quote || quote.type !== 'devis') return null;

    return createInvoice({
      type: 'facture_vente',
      storeId: quote.storeId,
      storeName: quote.storeName,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      customerId: quote.customerId,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      customerAddress: quote.customerAddress,
      items: quote.items,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxRate: quote.taxRate,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      paidAmount: 0,
      balanceDue: quote.totalAmount,
      status: 'emise',
      paymentTerms: 'Converti depuis devis. Règlement sous 15 jours.',
      convertedFromQuoteId: quote.invoiceNumber,
      notes: `Établi à partir du ${quote.invoiceNumber}`,
    });
  };

  // Customers & Credits
  const addCustomer = (
    custData: Omit<Customer, 'id' | 'totalPurchases' | 'outstandingBalance' | 'createdAt'>
  ) => {
    const newCust: Customer = {
      ...custData,
      id: `cust-${Date.now()}`,
      totalPurchases: 0,
      outstandingBalance: 0,
      createdAt: new Date().toISOString(),
    };
    setCustomers((prev) => [newCust, ...prev]);
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const recordCustomerCreditPayment = (
    customerId: string,
    amount: number,
    _paymentMethod: PaymentMethod
  ) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== customerId) return c;
        const newBalance = Math.max(0, c.outstandingBalance - amount);
        return { ...c, outstandingBalance: newBalance };
      })
    );
  };

  const adjustCustomerPoints = (customerId: string, pointsDelta: number, note: string) => {
    const now = new Date().toISOString();
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== customerId) return c;
        const nextPts = Math.max(0, (c.loyaltyPoints || 0) + pointsDelta);
        const txn: LoyaltyTransaction = {
          id: `loy-adj-${Date.now()}`,
          date: now,
          type: 'ajustement',
          points: pointsDelta,
          note: note.trim() || 'Ajustement manuel des points',
        };
        return {
          ...c,
          loyaltyPoints: nextPts,
          loyaltyHistory: [txn, ...(c.loyaltyHistory || [])].slice(0, 100),
          updatedAt: now,
        };
      })
    );
    logAudit(
      'AJUSTEMENT_FIDELITE',
      'Customer',
      `Points fidélité ajustés (${pointsDelta >= 0 ? '+' : ''}${pointsDelta} pts) : ${note}`,
      customerId
    );
  };

  // Suppliers & Purchases
  const addSupplier = (
    supData: Omit<Supplier, 'id' | 'totalPurchases' | 'outstandingBalance' | 'createdAt'>
  ) => {
    const newSup: Supplier = stripTaxFields({
      ...supData,
      id: `sup-${Date.now()}`,
      totalPurchases: 0,
      outstandingBalance: 0,
      createdAt: new Date().toISOString(),
    });
    setSuppliers((prev) => [newSup, ...prev]);
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? stripTaxFields({ ...s, ...updates }) : s))
    );
  };

  const recordSupplierPayment = (supplierId: string, amount: number) => {
    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.id !== supplierId) return s;
        const newBalance = Math.max(0, s.outstandingBalance - amount);
        return { ...s, outstandingBalance: newBalance };
      })
    );
  };

  const createPurchase = (purchaseData: Omit<Purchase, 'id' | 'purchaseNumber'>): Purchase => {
    const id = `pur-${Date.now()}`;
    const num = `ACH-2026-${String(purchases.length + 1).padStart(4, '0')}`;
    const newPur: Purchase = {
      ...purchaseData,
      id,
      purchaseNumber: num,
    };
    setPurchases((prev) => [newPur, ...prev]);
    return newPur;
  };

  const receivePurchase = (purchaseId: string): boolean => {
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (!purchase || purchase.status === 'recue') return false;

    const now = new Date().toISOString();
    const movementsToAdd: StockMovement[] = [];

    setProducts((prev) =>
      prev.map((p) => {
        const itemReceived = purchase.items.find((i) => i.productId === p.id);
        if (!itemReceived) return p;

        const currentStoreQty = p.storeQuantities?.[purchase.storeId] ?? 0;
        const newStoreQty = currentStoreQty + itemReceived.quantity;
        const updatedStoreQuantities = {
          ...p.storeQuantities,
          [purchase.storeId]: newStoreQty,
        };
        const newTotalQty = Object.values(updatedStoreQuantities).reduce((a, b) => a + b, 0);

        movementsToAdd.push({
          id: `mov-${Date.now()}-${p.id}`,
          productId: p.id,
          productName: p.name,
          storeId: purchase.storeId,
          storeName: purchase.storeName,
          type: 'reception',
          quantity: itemReceived.quantity,
          previousQuantity: currentStoreQty,
          newQuantity: newStoreQty,
          reason: `Réception bon de commande #${purchase.purchaseNumber}`,
          referenceId: purchase.purchaseNumber,
          date: now,
          userId: currentUser.id,
          userName: currentUser.name,
          syncStatus: isOnline ? 'synced' : 'pending',
        });

        return {
          ...p,
          storeQuantities: updatedStoreQuantities,
          quantity: newTotalQty,
          buyPrice: itemReceived.unitBuyPrice || p.buyPrice,
          updatedAt: now,
        };
      })
    );

    setStockMovements((prev) => [...movementsToAdd, ...prev]);

    if (purchase.supplierId && purchase.balanceDue > 0) {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === purchase.supplierId
            ? {
                ...s,
                totalPurchases: s.totalPurchases + purchase.totalAmount,
                outstandingBalance: s.outstandingBalance + purchase.balanceDue,
              }
            : s
        )
      );
    }

    setPurchases((prev) =>
      prev.map((pur) =>
        pur.id === purchaseId ? { ...pur, status: 'recue', receivedDate: now.split('T')[0] } : pur
      )
    );

    return true;
  };

  // Expenses & Operating Costs
  const addExpense = (expenseData: Omit<Expense, 'id' | 'userName' | 'userId' | 'storeName'>) => {
    const newExp: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      storeName: currentStore?.name || 'Boutique Principale',
    };
    setExpenses((prev) => [newExp, ...prev]);
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  // Inventory Sessions & Physical Stocktake
  const createInventorySession = (storeId: string, notes?: string): InventorySession => {
    const store = stores.find((s) => s.id === storeId) || currentStore || stores[0];
    const items = products
      .filter((p) => p.active)
      .map((p) => {
        const qty = p.storeQuantities?.[storeId] ?? 0;
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          theoreticalQty: qty,
          countedQty: qty,
          discrepancyQty: 0,
          unitCost: p.buyPrice,
          discrepancyValue: 0,
        };
      });

    const newSession: InventorySession = {
      id: `inv-sess-${Date.now()}`,
      sessionNumber: `INV-2026-${String(inventorySessions.length + 1).padStart(3, '0')}`,
      storeId,
      storeName: store.name,
      date: new Date().toISOString().split('T')[0],
      status: 'en_cours',
      items,
      totalTheoreticalQty: items.reduce((a, b) => a + b.theoreticalQty, 0),
      totalCountedQty: items.reduce((a, b) => a + b.countedQty, 0),
      totalDiscrepancyQty: 0,
      totalDiscrepancyValue: 0,
      createdBy: currentUser.name,
      notes,
    };

    setInventorySessions((prev) => [newSession, ...prev]);
    return newSession;
  };

  const validateInventorySession = (sessionId: string, items: any[]): boolean => {
    const session = inventorySessions.find((s) => s.id === sessionId);
    if (!session) return false;

    const now = new Date().toISOString();
    const movementsToAdd: StockMovement[] = [];

    setProducts((prev) =>
      prev.map((p) => {
        const item = items.find((i: any) => i.productId === p.id);
        if (!item) return p;

        const currentStoreQty = p.storeQuantities?.[session.storeId] ?? 0;
        const counted = item.countedQty;
        const diff = counted - currentStoreQty;

        if (diff !== 0) {
          movementsToAdd.push({
            id: `mov-${Date.now()}-${p.id}`,
            productId: p.id,
            productName: p.name,
            storeId: session.storeId,
            storeName: session.storeName,
            type: 'inventaire',
            quantity: diff,
            previousQuantity: currentStoreQty,
            newQuantity: counted,
            reason: `Ajustement inventaire physique #${session.sessionNumber}`,
            referenceId: session.sessionNumber,
            date: now,
            userId: currentUser.id,
            userName: currentUser.name,
            syncStatus: isOnline ? 'synced' : 'pending',
          });
        }

        const updatedStoreQuantities = {
          ...p.storeQuantities,
          [session.storeId]: Math.max(0, counted),
        };
        const newTotalQty = Object.values(updatedStoreQuantities).reduce((a, b) => a + b, 0);

        return {
          ...p,
          storeQuantities: updatedStoreQuantities,
          quantity: newTotalQty,
          updatedAt: now,
        };
      })
    );

    setStockMovements((prev) => [...movementsToAdd, ...prev]);

    const totalTheo = items.reduce((a, b) => a + b.theoreticalQty, 0);
    const totalCount = items.reduce((a, b) => a + b.countedQty, 0);
    const totalDiffQty = totalCount - totalTheo;
    const totalDiffVal = items.reduce(
      (a, b) => a + (b.countedQty - b.theoreticalQty) * (b.unitCost || 0),
      0
    );

    setInventorySessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status: 'validee',
              items,
              totalTheoreticalQty: totalTheo,
              totalCountedQty: totalCount,
              totalDiscrepancyQty: totalDiffQty,
              totalDiscrepancyValue: totalDiffVal,
              validatedBy: currentUser.name,
              validatedAt: now,
            }
          : s
      )
    );

    return true;
  };

  // Real KPIs calculation (isolated to the connected account's data)
  const kpis = useMemo(() => {
    let stockValueCost = 0;
    let stockValueRetail = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      if (!p.active) return;
      const qty = p.quantity;
      stockValueCost += qty * p.buyPrice;
      stockValueRetail += qty * p.sellPrice;
      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= p.alertThreshold) {
        lowStockCount++;
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    let todaySalesTotal = 0;
    let weekSalesTotal = 0;
    let monthSalesTotal = 0;
    let costOfGoodsSold = 0;

    sales.forEach((s) => {
      if (s.status === 'annulee') return;
      const sDate = new Date(s.date);
      const sDay = s.date.split('T')[0];

      if (sDay === todayStr) {
        todaySalesTotal += s.totalAmount;
      }
      if (sDate >= sevenDaysAgo) {
        weekSalesTotal += s.totalAmount;
      }
      if (sDate >= thirtyDaysAgo) {
        monthSalesTotal += s.totalAmount;
        s.items.forEach((item) => {
          costOfGoodsSold += item.buyPrice * item.quantity;
        });
      }
    });

    const grossMargin = monthSalesTotal - costOfGoodsSold;
    const monthExpensesTotal = expenses
      .filter((e) => new Date(e.date) >= thirtyDaysAgo)
      .reduce((sum, e) => sum + e.amount, 0);
    const estimatedNetProfit = grossMargin - monthExpensesTotal;
    const totalCustomerDebt = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
    const totalSupplierDebt = suppliers.reduce((sum, s) => sum + (s.outstandingBalance || 0), 0);

    const unpaidInvoices = invoices.filter(
      (i) =>
        i.type === 'facture_vente' &&
        (i.status === 'emise' || i.status === 'partiellement_payee' || i.status === 'en_retard')
    );

    return {
      totalProductsCount: products.filter((p) => p.active).length,
      lowStockCount,
      outOfStockCount,
      stockValueCost,
      stockValueRetail,
      todaySalesTotal,
      weekSalesTotal,
      monthSalesTotal,
      costOfGoodsSold,
      grossMargin,
      monthExpensesTotal,
      estimatedNetProfit,
      totalCustomerDebt,
      totalSupplierDebt,
      unpaidInvoicesCount: unpaidInvoices.length,
      unpaidInvoicesTotal: unpaidInvoices.reduce((sum, i) => sum + i.balanceDue, 0),
    };
  }, [products, sales, expenses, customers, suppliers, invoices]);

  // =========================================================================
  // ADMINISTRATEUR-ONLY SUBSCRIPTION & UNITECHPAY ACTIONS
  // =========================================================================

  const updatePlanConfig = async (planId: string, updates: Partial<Plan>) => {
    if (currentUser.role !== 'administrateur') return;
    const resp = await fetch(`/api/admin/plans/${encodeURIComponent(planId)}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error || 'Impossible de modifier la formule.');
    }
    await refreshAdminOverview();
  };

  const resetPlansToDefault = async () => {
    if (currentUser.role !== 'administrateur') return;
    const resp = await fetch('/api/admin/plans/reset', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!resp.ok) {
      throw new Error('Erreur lors de la réinitialisation des formules.');
    }
    await refreshAdminOverview();
  };

  const adminUpdateSubscription = async (
    accountId: string,
    updates: {
      planId?: string;
      status?: SubscriptionStatus;
      billingCycle?: BillingCycle;
      startDate?: string;
      renewalDate?: string | null;
      expiresAt?: string | null;
      isTrial?: boolean;
      isComped?: boolean;
      justification: string;
      eventType?: string;
    }
  ) => {
    if (currentUser.role !== 'administrateur') return;
    const resp = await fetch(`/api/admin/subscriptions/${encodeURIComponent(accountId)}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success) {
      throw new Error(data?.error || 'Impossible de modifier cet abonnement.');
    }
    if (data.overview) {
      setAdminOverview((prev) => ({
        ...data.overview,
        unitechOrders: prev?.unitechOrders || unitechPayOrders,
        unitechWebhookLogs: prev?.unitechWebhookLogs || unitechPayWebhookLogs,
      }));
    } else {
      await refreshAdminOverview();
    }
  };

  const adminRecordPayment = async (
    accountId: string,
    payload: {
      planId: string;
      billingCycle: BillingCycle;
      amount: number;
      paymentMethod: string;
      status: 'succes' | 'en_attente' | 'echec';
      reference?: string;
      phoneNumber?: string;
    }
  ) => {
    if (currentUser.role !== 'administrateur') return;
    const resp = await fetch(
      `/api/admin/subscriptions/${encodeURIComponent(accountId)}/payments`,
      {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload),
      }
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success) {
      throw new Error(data?.error || 'Impossible d’enregistrer le paiement.');
    }
    if (data.overview) {
      setAdminOverview((prev) => ({
        ...data.overview,
        unitechOrders: prev?.unitechOrders || unitechPayOrders,
        unitechWebhookLogs: prev?.unitechWebhookLogs || unitechPayWebhookLogs,
      }));
    } else {
      await refreshAdminOverview();
    }
  };

  const adminToggleAccountStatus = async (accountId: string, active: boolean) => {
    if (currentUser.role !== 'administrateur') return;
    const resp = await fetch(`/api/admin/accounts/${encodeURIComponent(accountId)}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ active }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success) {
      throw new Error(data?.error || 'Impossible de modifier le statut du compte.');
    }
    await refreshAdminOverview();
  };

  const adminResetAccountPassword = async (
    accountId: string
  ): Promise<{ temporaryPassword: string; accountName: string }> => {
    if (currentUser.role !== 'administrateur') {
      throw new Error('Accès administrateur requis.');
    }
    const resp = await fetch(
      `/api/admin/accounts/${encodeURIComponent(accountId)}/reset-password`,
      {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
      }
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success || !data?.temporaryPassword) {
      throw new Error(data?.error || 'Impossible de réinitialiser le mot de passe.');
    }
    if (data.overview) {
      setAdminOverview((prev) => ({
        ...data.overview,
        unitechOrders: prev?.unitechOrders || unitechPayOrders,
        unitechWebhookLogs: prev?.unitechWebhookLogs || unitechPayWebhookLogs,
      }));
    } else {
      await refreshAdminOverview();
    }
    return {
      temporaryPassword: String(data.temporaryPassword),
      accountName: String(data.account?.name || ''),
    };
  };

  const updateUnitechPayConfig = async (
    updates: Partial<UnitechPayConfig>
  ): Promise<{ success: boolean; message: string }> => {
    if (currentUser.role !== 'administrateur') {
      return { success: false, message: 'Accès administrateur requis.' };
    }
    const res = await apiUpdateUnitechConfig(updates);
    if (res.success && res.config) {
      setUnitechPayConfig(res.config);
    }
    return { success: res.success, message: res.message };
  };

  const configureRemoteUnitechPayWebhook = async (
    customUrl?: string
  ): Promise<{ success: boolean; message: string; configuredUrl: string }> => {
    if (currentUser.role !== 'administrateur') {
      throw new Error('Accès administrateur requis.');
    }
    const res = await apiConfigureRemoteUnitech(customUrl);
    await refreshUnitechPayData();
    return res;
  };

  const initiateUnitechPayWavePayment = async (
    planId: string,
    cycle: BillingCycle,
    customerPhone?: string,
    targetAccountId?: string
  ): Promise<{ order: UnitechPayOrder; wavePaymentUrl: string; reference: string }> => {
    if (currentUser.role !== 'administrateur') {
      throw new Error('Accès administrateur requis.');
    }
    const targetPlan =
      adminOverview?.plans.find((p) => p.id === planId) ||
      ({ id: 'plan-pro', name: 'Professionnel', monthlyPrice: 5000, annualPrice: 50000 } as Plan);
    const amount = cycle === 'annuel' ? targetPlan.annualPrice : targetPlan.monthlyPrice;
    const targetAccount = adminOverview?.merchantAccounts.find(
      (m) => m.account.id === targetAccountId
    );
    const resolvedPhone = (
      customerPhone ||
      targetAccount?.account.phone ||
      currentUser.phone ||
      ''
    ).trim();
    if (!resolvedPhone) {
      throw new Error('Veuillez saisir un numéro de téléphone Wave valide.');
    }

    const result = await apiCreateUnitechOrder({
      planId: targetPlan.id,
      planName: targetPlan.name,
      billingCycle: cycle,
      amount,
      description: `Abonnement SAMA STOCK - Formule ${targetPlan.name} (${cycle})`,
      customerName: targetAccount?.account.name || currentUser.name,
      customerPhone: resolvedPhone,
      customerEmail: targetAccount?.account.email || currentUser.email,
      samaStockUserId: targetAccount?.account.id || currentUser.id,
      samaStockSubscriptionId: targetAccount?.subscription?.id || `sub-${currentUser.id}`,
    });

    if (typeof result.wavePaymentUrl !== 'string' || !/^https:\/\//i.test(result.wavePaymentUrl)) {
      throw new Error('Lien de paiement Wave invalide ou absent de la réponse UnitechPay.');
    }

    await Promise.all([refreshUnitechPayData(), refreshAdminOverview()]);
    return result;
  };

  const checkUnitechPayOrderStatus = async (
    reference: string
  ): Promise<{ success: boolean; status: string; isPaid: boolean; message: string }> => {
    if (currentUser.role !== 'administrateur') {
      return { success: false, status: 'forbidden', isPaid: false, message: 'Accès refusé.' };
    }
    const res = await getUnitechPayOrderStatus(reference);
    await Promise.all([refreshUnitechPayData(), refreshAdminOverview()]);
    return {
      success: Boolean(res.isPaid),
      status: res.status,
      isPaid: Boolean(res.isPaid),
      message: res.message,
    };
  };

  const simulateUnitechPayWebhookEvent = async (scenario: {
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
    customPayload?: any;
  }) => {
    if (currentUser.role !== 'administrateur') {
      throw new Error('Accès administrateur requis.');
    }
    const res = await apiRunUnitechSimulation(scenario);
    await Promise.all([refreshUnitechPayData(), refreshAdminOverview()]);
    return res;
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        currentUser,
        isAuthChecking,
        isAuthenticated,
        login,
        logout,
        register,
        updateProfile,
        changePassword,
        isPosFullScreen,
        setIsPosFullScreen,
        consolidatedView,
        setConsolidatedView,
        employees,
        activeOperator,
        isPinModalOpen,
        openPinModal,
        closePinModal,
        verifyOperatorPin,
        saveEmployee,
        removeEmployee,
        hasPermission,
        canAccessStore,
        auditLogs,
        logAudit,
        activeStoreId,
        setActiveStoreId,
        currentStore,
        stores,
        addStore,
        updateStore,
        organization,
        updateOrganization,
        isOnline,
        toggleOnlineMode,
        pendingSyncOperations,
        syncPendingOperations,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        clearAllProducts,
        archiveProduct,
        importProducts,
        clearMerchantWorkspaceData,
        importWorkspaceData,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        resetCategoriesToDefault,
        stockMovements,
        addStockMovement,
        transferStock,
        sales,
        activeShift,
        shiftHistory,
        openShift,
        closeShift,
        recordCashMovement,
        heldSales,
        holdCurrentSale,
        deleteHeldSale,
        recordSale,
        voidSale,
        invoices,
        createInvoice,
        updateInvoice,
        recordInvoicePayment,
        convertQuoteToInvoice,
        customers,
        addCustomer,
        updateCustomer,
        recordCustomerCreditPayment,
        adjustCustomerPoints,
        suppliers,
        addSupplier,
        updateSupplier,
        recordSupplierPayment,
        purchases,
        createPurchase,
        receivePurchase,
        expenses,
        addExpense,
        deleteExpense,
        inventorySessions,
        createInventorySession,
        validateInventorySession,
        kpis,
        capabilities,
        quotaSummary,
        canAddProduct,
        canAddStore,
        canCreateInvoice,
        hasFeature,
        isUpgradeModalOpen,
        upgradeModalReason,
        openUpgradeModal,
        closeUpgradeModal,
        adminOverview,
        refreshAdminOverview,
        updatePlanConfig,
        resetPlansToDefault,
        adminUpdateSubscription,
        adminRecordPayment,
        adminToggleAccountStatus,
        adminResetAccountPassword,
        unitechPayConfig,
        unitechPayOrders,
        unitechPayWebhookLogs,
        refreshUnitechPayData,
        updateUnitechPayConfig,
        configureRemoteUnitechPayWebhook,
        initiateUnitechPayWavePayment,
        checkUnitechPayOrderStatus,
        simulateUnitechPayWebhookEvent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
