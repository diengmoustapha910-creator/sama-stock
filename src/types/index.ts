export type UserRole = 'administrateur' | 'commercant';

export type StaffRole =
  | 'proprietaire'
  | 'administrateur'
  | 'gestionnaire'
  | 'caissier'
  | 'vendeur'
  | 'magasinier';

export interface StaffPermissions {
  posAccess: boolean;
  applyDiscount: boolean;
  maxDiscountPercent: number;
  voidSale: boolean;
  manageCashShift: boolean;
  cashInOut: boolean;
  manageProducts: boolean;
  editPrices: boolean;
  manageStock: boolean;
  viewReports: boolean;
  viewMargins: boolean;
  manageCustomers: boolean;
  manageEmployees: boolean;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: StaffRole;
  pinCode?: string; // Used only when creating/updating PIN; never returned from server
  pinSet?: boolean;
  storeIds: string[]; // Empty array = all stores
  permissions: StaffPermissions;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  date: string;
  storeId: string;
  storeName: string;
  employeeId: string;
  employeeName: string;
  employeeRole: StaffRole | UserRole;
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  details?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  storeIds: string[]; // Stores user has access to
  avatarUrl?: string;
  active: boolean;
  mustChangePassword?: boolean;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  isMain: boolean;
}

export interface LoyaltySettings {
  enabled: boolean;
  amountPerPoint: number; // e.g., 1000 FCFA spent = 1 point
  pointValueFCFA: number; // e.g., 1 point = 25 FCFA discount
  minRedeemPoints: number;
}

export interface Organization {
  id?: string;
  name: string;
  slogan: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
  currency: string;
  vatEnabled: boolean;
  vatRate: number; // e.g. 18 for 18% in Senegal
  logoUrl: string;
  bankDetails?: string;
  waveNumber?: string;
  orangeMoneyNumber?: string;
  loyaltySettings?: LoyaltySettings;
  receiptFooter?: string;
  receiptShowLogo?: boolean;
  receiptDefaultWidth?: '58mm' | '80mm';
}

export interface ProductVariant {
  id: string;
  name: string; // e.g., "Taille M - Rouge"
  sku: string;
  barcode?: string;
  buyPrice: number;
  sellPrice: number;
  storeQuantities: Record<string, number>;
}

export interface ProductUnit {
  id: string;
  name: string; // e.g., "Carton (12)"
  conversionFactor: number; // e.g., 12 base units deducted per sale
  sellPrice: number;
  barcode?: string;
}

export interface ProductBatch {
  id: string;
  lotNumber: string;
  expiryDate: string; // YYYY-MM-DD
  storeId: string;
  quantity: number;
  receivedAt: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  category: string;
  brand?: string;
  unit: string; // e.g. 'Unité', 'Carton', 'Kg', 'Litre', 'Mètre', 'Paquet'
  buyPrice: number; // in FCFA
  sellPrice: number; // in FCFA
  quantity: number; // aggregated or store specific
  storeQuantities: Record<string, number>; // storeId -> quantity
  alertThreshold: number;
  supplierId?: string;
  imageUrl?: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  expiryDate?: string;
  variants?: ProductVariant[];
  units?: ProductUnit[];
  batches?: ProductBatch[];
}

export type MovementType =
  | 'initial'
  | 'reception'
  | 'sortie_manuelle'
  | 'vente'
  | 'retour_client'
  | 'retour_fournisseur'
  | 'transfert_entrant'
  | 'transfert_sortant'
  | 'inventaire'
  | 'perte_degat';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  storeId: string;
  storeName: string;
  destinationStoreId?: string;
  type: MovementType;
  quantity: number; // positive or negative
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  referenceId?: string;
  lotNumber?: string;
  variantId?: string;
  variantName?: string;
  date: string;
  userId: string;
  userName: string;
  syncStatus: 'synced' | 'pending';
}

export interface LoyaltyTransaction {
  id: string;
  date: string;
  type: 'gain' | 'utilisation' | 'ajustement';
  points: number;
  saleId?: string;
  saleNumber?: string;
  note: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  creditLimit: number;
  totalPurchases: number;
  outstandingBalance: number; // Credit owed to the merchant
  loyaltyPoints?: number;
  loyaltyHistory?: LoyaltyTransaction[];
  createdAt: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  outstandingBalance: number; // Money merchant owes supplier
  createdAt: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  discount: number; // computed FCFA discount amount for the line
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  total: number;
  availableStock: number;
  variantId?: string;
  variantName?: string;
  unitName?: string;
  unitFactor?: number;
  lotNumber?: string;
  imageUrl?: string;
}

export type PaymentMethod =
  | 'especes'
  | 'wave'
  | 'orange_money'
  | 'carte'
  | 'virement'
  | 'credit'
  | 'mixte';

export interface PaymentSplit {
  id: string;
  method: Exclude<PaymentMethod, 'mixte'>;
  amount: number;
  reference?: string;
  confirmedManually?: boolean;
}

export interface Sale {
  id: string;
  saleNumber: string;
  date: string;
  storeId: string;
  storeName: string;
  customerId?: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeDue?: number;
  balanceDue: number;
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  paymentReference?: string;
  status: 'payee' | 'partielle' | 'credit' | 'annulee';
  cashierId: string;
  cashierName: string;
  operatorRole?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  loyaltyDiscountAmount?: number;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  notes?: string;
  clientOperationId?: string;
  updatedAt?: string;
  synced: boolean;
}

export interface HeldSale {
  id: string;
  label: string;
  storeId: string;
  storeName: string;
  createdAt: string;
  updatedAt: string;
  operatorId: string;
  operatorName: string;
  customerId?: string;
  customerName?: string;
  items: CartItem[];
  discountType: 'amount' | 'percent';
  discountValue: number;
  notes?: string;
}

export type InvoiceType =
  | 'facture_vente'
  | 'proforma'
  | 'devis'
  | 'bon_commande'
  | 'bon_livraison'
  | 'recu'
  | 'avoir';

export type InvoiceStatus =
  | 'brouillon'
  | 'emise'
  | 'partiellement_payee'
  | 'payee'
  | 'en_retard'
  | 'annulee';

export interface InvoiceItem {
  id: string;
  productId?: string;
  reference: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  receivedBy: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  storeId: string;
  storeName: string;
  date: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: InvoiceStatus;
  paymentTerms?: string;
  notes?: string;
  convertedFromQuoteId?: string;
  payments: PaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  receivedQuantity: number;
  unitBuyPrice: number;
  total: number;
  lotNumber?: string;
  expiryDate?: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  storeId: string;
  storeName: string;
  orderDate: string;
  receivedDate?: string;
  items: PurchaseItem[];
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: 'en_attente' | 'recue' | 'partielle' | 'annulee';
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export type ExpenseCategory =
  | 'loyer'
  | 'electricite_senelec'
  | 'transport_livraison'
  | 'salaires'
  | 'emballages'
  | 'maintenance'
  | 'taxes_impots'
  | 'communication'
  | 'autre';

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
  storeId: string;
  storeName: string;
  userId: string;
  userName: string;
  receiptNumber?: string;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  sku: string;
  theoreticalQty: number;
  countedQty: number;
  discrepancyQty: number; // counted - theoretical
  unitCost: number;
  discrepancyValue: number; // discrepancyQty * unitCost
  notes?: string;
}

export interface InventorySession {
  id: string;
  sessionNumber: string;
  storeId: string;
  storeName: string;
  date: string;
  status: 'en_cours' | 'validee' | 'annulee';
  items: InventoryItem[];
  totalTheoreticalQty: number;
  totalCountedQty: number;
  totalDiscrepancyQty: number;
  totalDiscrepancyValue: number;
  createdBy: string;
  validatedBy?: string;
  validatedAt?: string;
  notes?: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  storeId: string;
  type: 'entree' | 'sortie' | 'depense';
  amount: number;
  reason: string;
  category?: string;
  date: string;
  operatorId: string;
  operatorName: string;
}

export interface CashRegisterShift {
  id: string;
  storeId: string;
  storeName?: string;
  userId: string;
  userName: string;
  openedAt: string;
  closedAt?: string;
  closedBy?: string;
  initialCash: number;
  cashSales: number;
  waveSales: number;
  orangeMoneySales: number;
  carteSales?: number;
  virementSales?: number;
  creditSales?: number;
  otherSales: number;
  totalSales: number;
  salesCount?: number;
  cashInTotal?: number;
  cashOutTotal?: number;
  expensesTotal?: number;
  expectedCash: number;
  actualCash?: number;
  cashDifference?: number;
  movements?: CashMovement[];
  status: 'ouverte' | 'fermee';
  notes?: string;
}

export interface SyncOperation {
  id: string;
  clientOperationId?: string;
  timestamp: string;
  action:
    | 'CREATE_SALE'
    | 'VOID_SALE'
    | 'UPDATE_STOCK'
    | 'CREATE_INVOICE'
    | 'UPDATE_INVOICE'
    | 'CREATE_PRODUCT'
    | 'CREATE_STORE'
    | 'CASH_MOVEMENT'
    | 'CLOSE_SHIFT'
    | 'CUSTOMER_PAYMENT';
  entity: string;
  entityId: string;
  payload: any;
  status: 'en_attente' | 'synchronise' | 'erreur';
  errorMessage?: string;
  retryCount?: number;
}

export interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  imageUrl?: string;
  createdAt: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'pos'
  | 'cash_shifts'
  | 'products'
  | 'categories'
  | 'stock'
  | 'invoices'
  | 'customers'
  | 'suppliers'
  | 'inventory'
  | 'expenses'
  | 'reports'
  | 'employees'
  | 'admin_subscriptions'
  | 'settings';

export interface AccountCapabilities {
  planId?: string;
  planName?: string;
  maxProducts: number;
  maxStores: number;
  maxInvoicesPerMonth: number;
  allowedFeatures: PlanFeatureKey[];
  isAccountOperational: boolean;
  usage?: {
    activeProducts: number;
    stores: number;
    monthlyInvoices: number;
    monthKey: string;
  };
}

export interface AdminMerchantSubscriptionItem {
  account: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  };
  organizationName: string;
  city: string;
  storesCount: number;
  productsCount: number;
  invoicesCount: number;
  subscription: (Subscription & {
    accountId: string;
    planName: string;
    monthlyPrice: number;
    annualPrice: number;
  }) | null;
}

export interface AdminOverviewData {
  plans: Plan[];
  merchantAccounts: AdminMerchantSubscriptionItem[];
  paymentTransactions: (PaymentTransaction & { accountId?: string })[];
  subscriptionEvents: (SubscriptionEvent & { accountId?: string })[];
  unitechOrders?: UnitechPayOrder[];
  unitechWebhookLogs?: UnitechPayWebhookLog[];
}

// Subscription System Types
export type SubscriptionStatus =
  | 'gratuit'
  | 'en_attente'
  | 'actif'
  | 'echec_paiement'
  | 'periode_grace'
  | 'resiliation_programmee'
  | 'expire'
  | 'suspendu';

export type BillingCycle = 'mensuel' | 'annuel';

export type PlanFeatureKey =
  | 'unlimited_products'
  | 'unlimited_invoices'
  | 'sales_purchases'
  | 'expenses_management'
  | 'advanced_reports'
  | 'pdf_excel_exports'
  | 'offline_sync'
  | 'multi_users'
  | 'multi_stores'
  | 'advanced_permissions'
  | 'consolidated_reports'
  | 'inter_store_transfers'
  | 'priority_support';

export interface PlanLimits {
  maxProducts: number; // -1 = unlimited
  maxUsers: number; // -1 = unlimited
  maxStores: number; // -1 = unlimited
  maxInvoicesPerMonth: number; // -1 = unlimited
}

export interface Plan {
  id: string; // 'plan-gratuit' | 'plan-pro' | 'plan-entreprise'
  name: string; // 'Gratuit' | 'Professionnel' | 'Entreprise'
  slug: string;
  monthlyPrice: number; // in FCFA (0, 5000, 12000)
  annualPrice: number; // in FCFA (0, 50000, 120000)
  badge?: string;
  description: string;
  limits: PlanLimits;
  features: PlanFeatureKey[];
  isPopular?: boolean;
  active: boolean;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startDate: string;
  renewalDate?: string;
  expiresAt?: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
  isTrial?: boolean;
  isComped?: boolean;
  paymentMethod?: 'wave' | 'orange_money' | 'carte' | 'virement' | 'gratuit' | 'unitechpay_wave';
  lastPaymentDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionUsage {
  productsCount: number;
  usersCount: number;
  storesCount: number;
  monthlyInvoicesCount: number;
  monthKey: string;
}

export interface PaymentTransaction {
  id: string;
  subscriptionId: string;
  organizationId: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string; // 'FCFA'
  billingCycle: BillingCycle;
  paymentMethod: 'wave' | 'orange_money' | 'carte' | 'virement' | 'unitechpay_wave';
  phoneNumber?: string;
  customerName: string;
  customerEmail?: string;
  reference: string;
  providerTransactionId?: string;
  waveCheckoutUrl?: string;
  waveQrData?: string;
  webhookVerified?: boolean;
  status: 'en_attente' | 'succes' | 'echec' | 'annule';
  failureReason?: string;
  createdAt: string;
  confirmedAt?: string;
  receiptNumber?: string;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  type:
    | 'CREATED'
    | 'UPGRADED'
    | 'DOWNGRADED'
    | 'RENEWED'
    | 'CANCEL_SCHEDULED'
    | 'CANCEL_REVOKED'
    | 'EXPIRED'
    | 'PAYMENT_PENDING'
    | 'PAYMENT_SUCCESS'
    | 'PAYMENT_FAILED'
    | 'TRIAL_STARTED'
    | 'MANUAL_OVERRIDE'
    | 'SUSPENDED'
    | 'REACTIVATED'
    | 'UNITECHPAY_WEBHOOK_RECEIVED'
    | 'UNITECHPAY_PAYMENT_SUCCESS'
    | 'UNITECHPAY_PAYMENT_FAILED'
    | 'UNITECHPAY_PAYMENT_EXPIRED';
  description: string;
  performedBy: string;
  justification?: string;
  date: string;
  meta?: any;
}

export interface UnitechPayConfig {
  apiUrl: string;
  apiKey: string;
  hasApiKey?: boolean;
  isDemoKey?: boolean;
  apiKeyMasked?: string;
  webhookUrl: string;
  events: string[];
  isConfiguredWithUnitech: boolean;
  lastConfiguredAt?: string;
  signatureMethod: 'auto' | 'raw_body' | 'canonical_pipe';
  autoActivate: boolean;
}

export interface UnitechPayWebhookNotification {
  event: 'payment_completed' | 'payment_failed' | 'payment_expired' | string;
  transaction_id: number | string;
  reference: string;
  amount: number;
  status: 'completed' | 'failed' | 'expired' | string;
  method: 'wave' | string;
  commission?: number;
  net_amount?: number;
  timestamp: number;
  signed_at: number;
  signature: string;
}

export interface UnitechPayOrder {
  id: string;
  reference: string;
  localReference?: string;
  providerReference?: string;
  samaStockUserId: string;
  samaStockSubscriptionId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  method: 'wave';
  transactionId?: number | string;
  wavePaymentUrl?: string;
  paymentUrlDomain?: string;
  commission?: number;
  netAmount?: number;
  dateCreated: string;
  dateCompleted?: string;
  receiptNumber?: string;
  webhookVerified: boolean;
}

export interface UnitechPayWebhookLog {
  id: string;
  receivedAt: string;
  event: string;
  reference: string;
  transactionId?: number | string;
  amount?: number;
  status: 'completed' | 'failed' | 'expired' | 'rejected' | string;
  signatureValid: boolean;
  verificationMethodUsed?: 'raw_body' | 'canonical_pipe' | 'none';
  resultStatus: 'success' | 'warning' | 'error' | 'duplicate';
  summary: string;
  rejectionReason?: string;
  subscriptionActivated?: boolean;
  receiptNumber?: string;
  rawPayload?: any;
  ipAddress?: string;
}
