import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export type ServerUserRole = 'administrateur' | 'commercant';

export interface AccountRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: ServerUserRole;
  active: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionResult {
  token: string;
  account: AccountRecord;
  expiresAt: string;
}

export interface CapabilitiesSummary {
  planId: string;
  planName: string;
  maxProducts: number;
  maxStores: number;
  maxInvoicesPerMonth: number;
  allowedFeatures: string[];
  isAccountOperational: boolean;
  usage: {
    activeProducts: number;
    stores: number;
    monthlyInvoices: number;
    monthKey: string;
  };
}

export class QuotaExceededError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'QUOTA_EXCEEDED';
  public readonly quotaType: 'products' | 'stores' | 'invoices';
  public readonly limit: number;
  public readonly current: number;
  public readonly planId: string;
  public readonly planName: string;
  public readonly upgradeSuggestedPlan: 'Professionnel' | 'Entreprise';

  constructor(opts: {
    message: string;
    quotaType: 'products' | 'stores' | 'invoices';
    limit: number;
    current: number;
    planId: string;
    planName: string;
    upgradeSuggestedPlan: 'Professionnel' | 'Entreprise';
  }) {
    super(opts.message);
    this.name = 'QuotaExceededError';
    this.quotaType = opts.quotaType;
    this.limit = opts.limit;
    this.current = opts.current;
    this.planId = opts.planId;
    this.planName = opts.planName;
    this.upgradeSuggestedPlan = opts.upgradeSuggestedPlan;
  }
}

export class ForbiddenError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'FORBIDDEN_PERMISSION';

  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function getMonthKey(dateInput?: string | Date): string {
  const formatDakarMonth = (d: Date): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Dakar',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value || '1970';
    const m = parts.find((p) => p.type === 'month')?.value || '01';
    return `${y}-${m}`;
  };
  if (dateInput instanceof Date) {
    return formatDakarMonth(dateInput);
  }
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}/.test(dateInput.trim())) {
    return dateInput.trim().slice(0, 7);
  }
  return formatDakarMonth(new Date());
}

const DEFAULT_PLANS = [
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
    annualPrice: 50000,
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
    annualPrice: 120000,
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

const DEFAULT_CATEGORIES = [
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

export function stripFiscalFields<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const copy: Record<string, any> = { ...obj };
  delete copy.ninea;
  delete copy.rccm;
  delete copy.customerNinea;
  return copy as T;
}

export function sanitizeMediaUrl(url: unknown, fallback = ''): string {
  if (typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('/assets/') && !trimmed.includes('..') && !/[<>"'`]/.test(trimmed)) {
    return trimmed;
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.length <= 2 * 1024 * 1024 ? trimmed : fallback;
  }
  if (/^https:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:') {
        return trimmed;
      }
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function normalizeDateString(val: unknown, fallbackIso?: string): string {
  const raw = typeof val === 'string' ? val.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) {
      return raw;
    }
  }
  return (fallbackIso || new Date().toISOString()).slice(0, 10);
}

export function normalizeRole(role: unknown): ServerUserRole {
  const val = String(role || '').toLowerCase().trim();
  if (val === 'administrateur' || val === 'admin') {
    return 'administrateur';
  }
  return 'commercant';
}

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/[\s\-().+]/g, '');
}

const BCRYPT_COST_ROUNDS = 12;

function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

function hashPassword(password: string): { hash: string; salt: string } {
  const hash = bcrypt.hashSync(password, BCRYPT_COST_ROUNDS);
  return { hash, salt: 'bcrypt' };
}

function verifyPasswordDetailed(
  password: string,
  expectedHash: string,
  salt: string
): { valid: boolean; needsUpgrade: boolean; scheme: 'bcrypt' | 'scrypt' | 'unknown' } {
  if (!password || !expectedHash) {
    return { valid: false, needsUpgrade: false, scheme: 'unknown' };
  }
  if (isBcryptHash(expectedHash)) {
    try {
      const valid = bcrypt.compareSync(password, expectedHash);
      const rounds = bcrypt.getRounds(expectedHash);
      return {
        valid,
        needsUpgrade: valid && rounds < BCRYPT_COST_ROUNDS,
        scheme: 'bcrypt',
      };
    } catch {
      return { valid: false, needsUpgrade: false, scheme: 'bcrypt' };
    }
  }
  if (!salt || !/^[0-9a-f]+$/i.test(expectedHash)) {
    return { valid: false, needsUpgrade: false, scheme: 'unknown' };
  }
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expectedBuf.length) {
      return { valid: false, needsUpgrade: false, scheme: 'scrypt' };
    }
    const valid = crypto.timingSafeEqual(derived, expectedBuf);
    return {
      valid,
      needsUpgrade: valid,
      scheme: 'scrypt',
    };
  } catch {
    return { valid: false, needsUpgrade: false, scheme: 'scrypt' };
  }
}

function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  return verifyPasswordDetailed(password, expectedHash, salt).valid;
}

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function maskEmailForLog(email?: string): string {
  const clean = String(email || '').trim().toLowerCase();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 0) return '***';
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function maskIdentifierForLog(identifier: string): string {
  const clean = String(identifier || '').trim();
  if (!clean) return '(empty)';
  if (clean.includes('@')) return maskEmailForLog(clean);
  if (clean.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, clean.length - 2))}${clean.slice(-2)}`;
}

export class SamaStockDatabase {
  private db: DatabaseSync;

  constructor(dataDir: string) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.resolve(dataDir, 'samastock.db');
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
    this.seedDefaults();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL CHECK(role IN ('administrateur', 'commercant')),
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email_unique
        ON accounts(LOWER(email)) WHERE email IS NOT NULL AND email != '';

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON sessions(account_id);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        request_ip TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pwd_reset_account ON password_reset_tokens(account_id);
      CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires ON password_reset_tokens(expires_at);

      CREATE TABLE IF NOT EXISTS organizations (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slogan TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT 'Dakar',
        country TEXT NOT NULL DEFAULT 'Sénégal',
        currency TEXT NOT NULL DEFAULT 'FCFA',
        vat_enabled INTEGER NOT NULL DEFAULT 1,
        vat_rate REAL NOT NULL DEFAULT 18,
        logo_url TEXT NOT NULL DEFAULT '/assets/aistudio/Logo_SAMA_STOCK__gestion_et_croissance_7ffcabd3.png',
        bank_details TEXT DEFAULT '',
        wave_number TEXT DEFAULT '',
        orange_money_number TEXT DEFAULT '',
        loyalty_settings_json TEXT DEFAULT '{"enabled":true,"amountPerPoint":1000,"pointValueFCFA":25,"minRedeemPoints":10}',
        receipt_footer TEXT DEFAULT 'Merci pour votre confiance ! À bientôt.',
        receipt_show_logo INTEGER DEFAULT 1,
        receipt_default_width TEXT DEFAULT '80mm',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS account_preferences (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        active_store_id TEXT NOT NULL DEFAULT '',
        active_shift_json TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stores (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT 'Dakar',
        phone TEXT NOT NULL DEFAULT '',
        is_main INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        active INTEGER NOT NULL DEFAULT 1,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS inventory_sessions (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        monthly_price INTEGER NOT NULL,
        annual_price INTEGER NOT NULL,
        badge TEXT,
        description TEXT NOT NULL,
        limits_json TEXT NOT NULL,
        features_json TEXT NOT NULL,
        is_popular INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        account_id TEXT UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL,
        billing_cycle TEXT NOT NULL,
        start_date TEXT NOT NULL,
        renewal_date TEXT,
        expires_at TEXT,
        cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
        trial_ends_at TEXT,
        is_trial INTEGER NOT NULL DEFAULT 0,
        is_comped INTEGER NOT NULL DEFAULT 0,
        payment_method TEXT,
        last_payment_date TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'FCFA',
        billing_cycle TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        phone_number TEXT,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        reference TEXT UNIQUE NOT NULL,
        provider_transaction_id TEXT,
        wave_checkout_url TEXT,
        webhook_verified INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        failure_reason TEXT,
        receipt_number TEXT,
        created_at TEXT NOT NULL,
        confirmed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS subscription_events (
        id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        justification TEXT,
        date TEXT NOT NULL,
        meta_json TEXT
      );

      CREATE TABLE IF NOT EXISTS employees (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        email TEXT DEFAULT '',
        role TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        pin_salt TEXT NOT NULL,
        store_ids_json TEXT NOT NULL DEFAULT '[]',
        permissions_json TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS cash_shifts (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        opened_at TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS held_sales (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (account_id, id)
      );

      CREATE TABLE IF NOT EXISTS sync_operations_log (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        client_op_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        PRIMARY KEY (account_id, client_op_id)
      );

      CREATE TABLE IF NOT EXISTS unitechpay_config (
        id TEXT PRIMARY KEY DEFAULT 'default',
        api_url TEXT NOT NULL DEFAULT 'https://api.unitech.sn/api.php',
        api_key TEXT NOT NULL DEFAULT '',
        webhook_url TEXT NOT NULL DEFAULT '',
        events_json TEXT NOT NULL DEFAULT '["payment_completed","payment_failed","payment_expired"]',
        is_configured INTEGER NOT NULL DEFAULT 0,
        last_configured_at TEXT,
        signature_method TEXT NOT NULL DEFAULT 'auto',
        auto_activate INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS unitechpay_orders (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL,
        local_reference TEXT,
        provider_reference TEXT,
        transaction_id TEXT,
        account_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        amount INTEGER NOT NULL,
        plan_id TEXT NOT NULL,
        billing_cycle TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_unitechpay_orders_ref ON unitechpay_orders(reference);
      CREATE INDEX IF NOT EXISTS idx_unitechpay_orders_local_ref ON unitechpay_orders(local_reference);
      CREATE INDEX IF NOT EXISTS idx_unitechpay_orders_provider_ref ON unitechpay_orders(provider_reference);

      CREATE TABLE IF NOT EXISTS unitechpay_webhook_logs (
        id TEXT PRIMARY KEY,
        received_at TEXT NOT NULL,
        event TEXT NOT NULL,
        reference TEXT NOT NULL,
        result_status TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_unitechpay_logs_received ON unitechpay_webhook_logs(received_at DESC);

      CREATE TABLE IF NOT EXISTS unitechpay_processed_events (
        key_type TEXT NOT NULL,
        key_value TEXT NOT NULL,
        reference TEXT,
        transaction_id TEXT,
        processed_at TEXT NOT NULL,
        PRIMARY KEY (key_type, key_value)
      );
    `);

    this.ensureColumn('accounts', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('sessions', 'active_employee_id', 'TEXT');
    this.ensureColumn(
      'organizations',
      'loyalty_settings_json',
      `TEXT DEFAULT '{"enabled":true,"amountPerPoint":1000,"pointValueFCFA":25,"minRedeemPoints":10}'`
    );
    this.ensureColumn(
      'organizations',
      'receipt_footer',
      `TEXT DEFAULT 'Merci pour votre confiance ! À bientôt.'`
    );
    this.ensureColumn('organizations', 'receipt_show_logo', 'INTEGER DEFAULT 1');
    this.ensureColumn('organizations', 'receipt_default_width', `TEXT DEFAULT '80mm'`);
  }

  private ensureColumn(tableName: string, columnName: string, columnDef: string): void {
    const cols = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    if (!cols.some((c) => c.name === columnName)) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
    }
  }

  private seedDefaults(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const planCountRow = this.db.prepare('SELECT COUNT(*) as cnt FROM plans').get() as { cnt: number };
    if (!planCountRow || planCountRow.cnt === 0) {
      const insertPlan = this.db.prepare(`
        INSERT INTO plans (id, name, slug, monthly_price, annual_price, badge, description, limits_json, features_json, is_popular, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of DEFAULT_PLANS) {
        insertPlan.run(
          p.id,
          p.name,
          p.slug,
          p.monthlyPrice,
          p.annualPrice,
          p.badge || null,
          p.description,
          JSON.stringify(p.limits),
          JSON.stringify(p.features),
          p.isPopular ? 1 : 0,
          p.active ? 1 : 0
        );
      }
    }

    // One-time non-destructive quota migration for existing databases (preserves prices & all user data)
    const quotaMigrationId = 'plan_quotas_v2_gratuit_5_3_pro_250_50';
    const hasQuotaMigration = this.db
      .prepare('SELECT 1 FROM app_migrations WHERE id = ?')
      .get(quotaMigrationId);
    if (!hasQuotaMigration) {
      const freePlan = DEFAULT_PLANS[0];
      const proPlan = DEFAULT_PLANS[1];
      this.db
        .prepare('UPDATE plans SET description = ?, limits_json = ? WHERE id = ?')
        .run(freePlan.description, JSON.stringify(freePlan.limits), freePlan.id);
      this.db
        .prepare('UPDATE plans SET description = ?, limits_json = ?, features_json = ? WHERE id = ?')
        .run(
          proPlan.description,
          JSON.stringify(proPlan.limits),
          JSON.stringify(proPlan.features),
          proPlan.id
        );
      this.db
        .prepare('INSERT INTO app_migrations (id, applied_at) VALUES (?, ?)')
        .run(quotaMigrationId, new Date().toISOString());
    }

    const adminCountRow = this.db
      .prepare("SELECT COUNT(*) as cnt FROM accounts WHERE role = 'administrateur'")
      .get() as { cnt: number };

    if (!adminCountRow || adminCountRow.cnt === 0) {
      const now = new Date().toISOString();
      const adminId = 'acc-admin-primary';
      const envAdminPass = (process.env.SAMA_ADMIN_INITIAL_PASSWORD || '').trim();
      const generatedTempPass = envAdminPass ? '' : crypto.randomBytes(12).toString('base64url');
      const initialAdminPassword = envAdminPass || generatedTempPass;
      const mustChange = envAdminPass ? 0 : 1;
      const { hash, salt } = hashPassword(initialAdminPassword);

      if (generatedTempPass) {
        console.log(
          `[SAMA STOCK SECURITY] Administrateur initial créé. Mot de passe temporaire unique : ${generatedTempPass} (changement requis après connexion).`
        );
      }

      this.db
        .prepare(
          `INSERT INTO accounts (id, name, email, phone, role, password_hash, password_salt, active, must_change_password, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'administrateur', ?, ?, 1, ?, ?, ?)`
        )
        .run(
          adminId,
          'Moustapha Dieng',
          'diengmoustapha910@gmail.com',
          '+221 77 450 12 34',
          hash,
          salt,
          mustChange,
          now,
          now
        );

      this.provisionMerchantDefaults(adminId, {
        name: 'Moustapha Dieng',
        email: 'diengmoustapha910@gmail.com',
        phone: '+221 77 450 12 34',
        businessName: 'SAMA STOCK ADMINISTRATION',
        storeName: 'Siège SAMA STOCK Dakar',
      });
    }

    const cfgRow = this.db.prepare("SELECT id FROM unitechpay_config WHERE id = 'default'").get();
    if (!cfgRow) {
      this.db
        .prepare(
          `INSERT INTO unitechpay_config
           (id, api_url, api_key, webhook_url, events_json, is_configured, signature_method, auto_activate, updated_at)
           VALUES ('default', ?, '', '', '["payment_completed","payment_failed","payment_expired"]', 0, 'auto', 1, ?)`
        )
        .run(
          (process.env.UNITECHPAY_API_URL || 'https://api.unitech.sn/api.php').trim(),
          new Date().toISOString()
        );
    }
  }

  private provisionMerchantDefaults(
    accountId: string,
    opts: {
      name: string;
      email: string;
      phone: string;
      businessName: string;
      storeName: string;
    }
  ): void {
    const now = new Date().toISOString();
    const storeId = `store-${accountId}-main`;

    this.db
      .prepare(
        `INSERT OR IGNORE INTO organizations
         (account_id, name, slogan, phone, email, address, city, country, currency, vat_enabled, vat_rate, logo_url, bank_details, wave_number, orange_money_number, updated_at)
         VALUES (?, ?, 'Gérez votre stock. Développez votre business.', ?, ?, 'Dakar, Sénégal', 'Dakar', 'Sénégal', 'FCFA', 1, 18, '/assets/aistudio/Logo_SAMA_STOCK__gestion_et_croissance_7ffcabd3.png', '', ?, '', ?)`
      )
      .run(accountId, opts.businessName || opts.name, opts.phone, opts.email, opts.phone, now);

    this.db
      .prepare(
        `INSERT OR IGNORE INTO stores (id, account_id, name, address, city, phone, is_main, created_at)
         VALUES (?, ?, ?, 'Dakar, Sénégal', 'Dakar', ?, 1, ?)`
      )
      .run(storeId, accountId, opts.storeName || 'Boutique Principale', opts.phone, now);

    this.db
      .prepare(
        `INSERT OR IGNORE INTO account_preferences (account_id, active_store_id, active_shift_json, updated_at)
         VALUES (?, ?, NULL, ?)`
      )
      .run(accountId, storeId, now);

    const insertCat = this.db.prepare(
      'INSERT OR IGNORE INTO categories (id, account_id, payload_json, updated_at) VALUES (?, ?, ?, ?)'
    );
    for (const c of DEFAULT_CATEGORIES) {
      insertCat.run(c.id, accountId, JSON.stringify(c), now);
    }

    const subId = `sub-${accountId}`;
    this.db
      .prepare(
        `INSERT OR IGNORE INTO subscriptions
         (id, account_id, plan_id, status, billing_cycle, start_date, cancel_at_period_end, payment_method, notes, created_at, updated_at)
         VALUES (?, ?, 'plan-gratuit', 'gratuit', 'mensuel', ?, 0, 'gratuit', 'Compte initialisé sur SAMA STOCK.', ?, ?)`
      )
      .run(subId, accountId, now, now, now);

    this.db
      .prepare(
        `INSERT OR IGNORE INTO subscription_events
         (id, subscription_id, account_id, type, description, performed_by, date)
         VALUES (?, ?, ?, 'CREATED', ?, 'Système', ?)`
      )
      .run(
        `evt-init-${accountId}`,
        subId,
        accountId,
        `Initialisation du compte ${opts.businessName || opts.name}`,
        now
      );

    this.ensureDefaultOwnerEmployee(accountId);
  }

  private getDefaultStaffPermissions(role: string) {
    switch (role) {
      case 'proprietaire':
        return {
          posAccess: true,
          applyDiscount: true,
          maxDiscountPercent: 100,
          voidSale: true,
          manageCashShift: true,
          cashInOut: true,
          manageProducts: true,
          editPrices: true,
          manageStock: true,
          viewReports: true,
          viewMargins: true,
          manageCustomers: true,
          manageEmployees: true,
        };
      case 'administrateur':
        return {
          posAccess: true,
          applyDiscount: true,
          maxDiscountPercent: 50,
          voidSale: true,
          manageCashShift: true,
          cashInOut: true,
          manageProducts: true,
          editPrices: true,
          manageStock: true,
          viewReports: true,
          viewMargins: true,
          manageCustomers: true,
          manageEmployees: true,
        };
      case 'gestionnaire':
        return {
          posAccess: true,
          applyDiscount: true,
          maxDiscountPercent: 25,
          voidSale: true,
          manageCashShift: true,
          cashInOut: true,
          manageProducts: true,
          editPrices: true,
          manageStock: true,
          viewReports: true,
          viewMargins: false,
          manageCustomers: true,
          manageEmployees: false,
        };
      case 'caissier':
        return {
          posAccess: true,
          applyDiscount: true,
          maxDiscountPercent: 10,
          voidSale: false,
          manageCashShift: true,
          cashInOut: true,
          manageProducts: false,
          editPrices: false,
          manageStock: false,
          viewReports: false,
          viewMargins: false,
          manageCustomers: true,
          manageEmployees: false,
        };
      case 'vendeur':
        return {
          posAccess: true,
          applyDiscount: true,
          maxDiscountPercent: 5,
          voidSale: false,
          manageCashShift: false,
          cashInOut: false,
          manageProducts: false,
          editPrices: false,
          manageStock: false,
          viewReports: false,
          viewMargins: false,
          manageCustomers: true,
          manageEmployees: false,
        };
      default:
        return {
          posAccess: false,
          applyDiscount: false,
          maxDiscountPercent: 0,
          voidSale: false,
          manageCashShift: false,
          cashInOut: false,
          manageProducts: true,
          editPrices: false,
          manageStock: true,
          viewReports: false,
          viewMargins: false,
          manageCustomers: false,
          manageEmployees: false,
        };
    }
  }

  private mapEmployeeRow(row: any) {
    return {
      id: String(row.id),
      name: String(row.name),
      phone: String(row.phone || ''),
      email: String(row.email || ''),
      role: String(row.role),
      pinSet: true,
      storeIds: row.store_ids_json ? JSON.parse(row.store_ids_json) : [],
      permissions: row.permissions_json
        ? JSON.parse(row.permissions_json)
        : this.getDefaultStaffPermissions(String(row.role)),
      active: Boolean(row.active),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  public ensureDefaultOwnerEmployee(accountId: string): void {
    const countRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM employees WHERE account_id = ?')
      .get(accountId) as any;
    if (countRow && countRow.cnt > 0) return;

    const acc = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    if (!acc) return;

    const now = new Date().toISOString();
    const randomPin = String(crypto.randomInt(100000, 999999));
    const { hash, salt } = hashPassword(randomPin);
    const perms = this.getDefaultStaffPermissions('proprietaire');
    this.db
      .prepare(
        `INSERT OR IGNORE INTO employees
         (id, account_id, name, phone, email, role, pin_hash, pin_salt, store_ids_json, permissions_json, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'proprietaire', ?, ?, '[]', ?, 1, ?, ?)`
      )
      .run(
        `emp-owner-${accountId}`,
        accountId,
        String(acc.name || 'Propriétaire'),
        String(acc.phone || ''),
        String(acc.email || ''),
        hash,
        salt,
        JSON.stringify(perms),
        now,
        now
      );
  }

  public verifyEmployeePin(accountId: string, employeeId: string, pin: string) {
    this.ensureDefaultOwnerEmployee(accountId);
    const row = this.db
      .prepare('SELECT * FROM employees WHERE account_id = ? AND id = ? AND active = 1')
      .get(accountId, employeeId) as any;
    if (!row) return null;
    const ok = verifyPassword(String(pin || '').trim(), String(row.pin_hash), String(row.pin_salt));
    if (!ok) return null;
    return this.mapEmployeeRow(row);
  }

  public upsertEmployee(accountId: string, emp: any, operatorEmployee?: any) {
    this.ensureDefaultOwnerEmployee(accountId);
    if (operatorEmployee) {
      this.assertStaffPermission(operatorEmployee, 'manageEmployees', 'Permission requise pour gérer les employés et leurs accès.');
    }
    const now = new Date().toISOString();
    const cleanName = String(emp.name || '').trim();
    if (!cleanName) throw new Error('Le nom de l’employé est requis.');

    const allowedRoles = ['proprietaire', 'administrateur', 'gestionnaire', 'caissier', 'vendeur', 'magasinier'];
    const role = allowedRoles.includes(String(emp.role)) ? String(emp.role) : 'caissier';
    const empId = String(emp.id || `emp-${crypto.randomUUID().slice(0, 10)}`);

    const existing = this.db
      .prepare('SELECT * FROM employees WHERE account_id = ? AND id = ?')
      .get(accountId, empId) as any;

    if (existing && existing.role === 'proprietaire' && (emp.active === false || role !== 'proprietaire')) {
      const activeOwners = (
        this.db
          .prepare(
            "SELECT COUNT(*) as cnt FROM employees WHERE account_id = ? AND role = 'proprietaire' AND active = 1 AND id != ?"
          )
          .get(accountId, empId) as any
      ).cnt;
      if (activeOwners === 0) {
        throw new Error('Au moins un compte Propriétaire actif doit être conservé.');
      }
    }

    let pinHash = existing?.pin_hash;
    let pinSalt = existing?.pin_salt;
    const rawPin = emp.pinCode !== undefined ? String(emp.pinCode).trim() : '';
    if (rawPin) {
      if (!/^\d{4,6}$/.test(rawPin)) {
        throw new Error('Le code PIN doit contenir 4 à 6 chiffres.');
      }
      const hashed = hashPassword(rawPin);
      pinHash = hashed.hash;
      pinSalt = hashed.salt;
    } else if (!existing) {
      throw new Error('Un code PIN (4 à 6 chiffres) est obligatoire lors de la création d’un employé.');
    }

    const storeIds = Array.isArray(emp.storeIds) ? emp.storeIds : existing ? JSON.parse(existing.store_ids_json || '[]') : [];
    const permissions =
      emp.permissions && typeof emp.permissions === 'object'
        ? emp.permissions
        : this.getDefaultStaffPermissions(role);
    const activeInt = emp.active === false ? 0 : 1;

    this.db
      .prepare(
        `INSERT INTO employees
         (id, account_id, name, phone, email, role, pin_hash, pin_salt, store_ids_json, permissions_json, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id, id) DO UPDATE SET
           name = excluded.name,
           phone = excluded.phone,
           email = excluded.email,
           role = excluded.role,
           pin_hash = excluded.pin_hash,
           pin_salt = excluded.pin_salt,
           store_ids_json = excluded.store_ids_json,
           permissions_json = excluded.permissions_json,
           active = excluded.active,
           updated_at = excluded.updated_at`
      )
      .run(
        empId,
        accountId,
        cleanName,
        String(emp.phone || ''),
        String(emp.email || ''),
        role,
        pinHash,
        pinSalt,
        JSON.stringify(storeIds),
        JSON.stringify(permissions),
        activeInt,
        existing?.created_at || now,
        now
      );

    const saved = this.db
      .prepare('SELECT * FROM employees WHERE account_id = ? AND id = ?')
      .get(accountId, empId);
    return this.mapEmployeeRow(saved);
  }

  public deleteEmployee(accountId: string, employeeId: string, operatorEmployee?: any): void {
    if (operatorEmployee) {
      this.assertStaffPermission(operatorEmployee, 'manageEmployees', 'Permission requise pour supprimer un employé.');
    }
    const existing = this.db
      .prepare('SELECT * FROM employees WHERE account_id = ? AND id = ?')
      .get(accountId, employeeId) as any;
    if (!existing) throw new Error('Employé introuvable.');
    if (existing.role === 'proprietaire') {
      const activeOwners = (
        this.db
          .prepare(
            "SELECT COUNT(*) as cnt FROM employees WHERE account_id = ? AND role = 'proprietaire' AND active = 1 AND id != ?"
          )
          .get(accountId, employeeId) as any
      ).cnt;
      if (activeOwners === 0) {
        throw new Error('Impossible de supprimer le dernier propriétaire actif.');
      }
    }
    this.db
      .prepare('DELETE FROM employees WHERE account_id = ? AND id = ?')
      .run(accountId, employeeId);
  }

  private assertStaffPermission(
    operatorEmployee: any,
    perm: string,
    message: string
  ): void {
    if (!operatorEmployee) return;
    if (operatorEmployee.role === 'proprietaire') return;
    if (operatorEmployee.permissions && operatorEmployee.permissions[perm] === true) return;
    throw new ForbiddenError(message);
  }

  private assertStaffOwnerOrAdmin(operatorEmployee: any, message: string): void {
    if (!operatorEmployee) return;
    if (operatorEmployee.role === 'proprietaire' || operatorEmployee.role === 'administrateur') return;
    throw new ForbiddenError(message);
  }

  private assertStaffStoreAccess(operatorEmployee: any, storeId?: string): void {
    if (!operatorEmployee || !storeId) return;
    if (operatorEmployee.role === 'proprietaire') return;
    const allowedStores: string[] = Array.isArray(operatorEmployee.storeIds)
      ? operatorEmployee.storeIds
      : [];
    if (allowedStores.length > 0 && !allowedStores.includes(storeId)) {
      throw new ForbiddenError('Accès refusé à cette boutique pour l’opérateur actif.');
    }
  }

  private mapAccountRow(row: any): AccountRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email || ''),
      phone: String(row.phone || ''),
      role: normalizeRole(row.role),
      active: Boolean(row.active),
      mustChangePassword: Boolean(row.must_change_password),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  public registerMerchant(data: {
    name: string;
    email?: string;
    phone: string;
    businessName: string;
    storeName?: string;
    password: string;
  }): SessionResult {
    const cleanName = String(data.name || '').trim();
    const cleanEmail = String(data.email || '').trim().toLowerCase();
    const cleanPhone = String(data.phone || '').trim();
    const cleanBusiness = String(data.businessName || '').trim();
    const cleanStore = String(data.storeName || '').trim() || `Boutique ${cleanBusiness || cleanName}`;
    const cleanPassword = String(data.password || '');

    if (!cleanName || !cleanBusiness || !cleanPhone || cleanPassword.length < 8) {
      throw new Error('Veuillez renseigner votre nom, entreprise, téléphone et un mot de passe (minimum 8 caractères).');
    }

    if (cleanEmail) {
      const existingEmail = this.db
        .prepare('SELECT id FROM accounts WHERE LOWER(email) = ?')
        .get(cleanEmail) as any;
      if (existingEmail) {
        throw new Error('Un compte existe déjà avec cette adresse e-mail.');
      }
    }

    const normalizedIncomingPhone = normalizePhone(cleanPhone);
    if (normalizedIncomingPhone.length >= 6) {
      const allAccounts = this.db.prepare('SELECT id, phone FROM accounts').all() as any[];
      const dupPhone = allAccounts.find(
        (a) => normalizePhone(a.phone) === normalizedIncomingPhone
      );
      if (dupPhone) {
        throw new Error('Un compte existe déjà avec ce numéro de téléphone.');
      }
    }

    const now = new Date().toISOString();
    const accountId = `acc-${crypto.randomUUID().slice(0, 12)}`;
    const { hash, salt } = hashPassword(cleanPassword);

    // Role is ALWAYS forced to 'commercant' during public registration
    this.db
      .prepare(
        `INSERT INTO accounts (id, name, email, phone, role, password_hash, password_salt, active, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'commercant', ?, ?, 1, 0, ?, ?)`
      )
      .run(accountId, cleanName, cleanEmail || '', cleanPhone, hash, salt, now, now);

    this.provisionMerchantDefaults(accountId, {
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      businessName: cleanBusiness,
      storeName: cleanStore,
    });

    const accountRow = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    const account = this.mapAccountRow(accountRow);
    return this.createSession(account);
  }

  public loginWithPassword(
    identifier: string,
    password: string,
    meta?: { ip?: string }
  ): SessionResult | null {
    const trimmed = String(identifier || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
    const lower = trimmed.toLowerCase();
    const normPhone = normalizePhone(trimmed);
    const identifierType = trimmed.includes('@') ? 'email' : 'phone';
    const identifierMasked = maskIdentifierForLog(trimmed);

    if (!trimmed || !password) {
      console.info('[AUTH LOGIN]', {
        outcome: 'rejected_missing_fields',
        identifierType,
        identifierMasked,
        hasPassword: Boolean(password),
        ip: meta?.ip || 'unknown',
      });
      return null;
    }

    const emailMatched = this.db
      .prepare('SELECT * FROM accounts WHERE LOWER(email) = ? LIMIT 1')
      .get(lower) as any;

    let matched = emailMatched;
    if (!matched && normPhone.length >= 6) {
      const allRows = this.db.prepare('SELECT * FROM accounts').all() as any[];
      matched = allRows.find((row) => normalizePhone(row.phone) === normPhone) || null;
    }

    if (!matched) {
      console.info('[AUTH LOGIN]', {
        outcome: 'account_not_found',
        identifierType,
        identifierMasked,
        ip: meta?.ip || 'unknown',
      });
      return null;
    }

    if (!matched.active) {
      console.warn('[AUTH LOGIN]', {
        outcome: 'account_inactive',
        accountId: matched.id,
        role: matched.role,
        identifierType,
        identifierMasked,
        ip: meta?.ip || 'unknown',
      });
      return null;
    }

    const check = verifyPasswordDetailed(
      password,
      String(matched.password_hash || ''),
      String(matched.password_salt || '')
    );

    if (!check.valid) {
      console.info('[AUTH LOGIN]', {
        outcome: 'invalid_password',
        accountId: matched.id,
        role: matched.role,
        identifierType,
        identifierMasked,
        hashScheme: check.scheme,
        mustChangePassword: Boolean(matched.must_change_password),
        ip: meta?.ip || 'unknown',
      });
      return null;
    }

    let upgradedHash = false;
    if (check.needsUpgrade) {
      const upgraded = hashPassword(password);
      this.db
        .prepare('UPDATE accounts SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
        .run(upgraded.hash, upgraded.salt, new Date().toISOString(), matched.id);
      upgradedHash = true;
    }

    const account = this.mapAccountRow(matched);
    const session = this.createSession(account);

    console.info('[AUTH LOGIN]', {
      outcome: 'success',
      accountId: account.id,
      role: account.role,
      identifierType,
      identifierMasked,
      hashScheme: check.scheme,
      upgradedToBcrypt: upgradedHash,
      mustChangePassword: Boolean(account.mustChangePassword),
      ip: meta?.ip || 'unknown',
    });

    return session;
  }

  public findActiveAccountByEmail(email: string): AccountRecord | null {
    const cleanEmail = String(email || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase();
    if (!cleanEmail) return null;
    const row = this.db
      .prepare('SELECT * FROM accounts WHERE LOWER(email) = ? AND active = 1 LIMIT 1')
      .get(cleanEmail) as any;
    return row ? this.mapAccountRow(row) : null;
  }

  public createPasswordResetToken(
    accountId: string,
    requestIp = '',
    ttlMinutes = 15
  ): { id: string; rawToken: string; expiresAt: string } {
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
    const id = `prt-${crypto.randomUUID().slice(0, 14)}`;
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(rawToken);

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      // Purge expired tokens and invalidate any prior unused reset token for this account
      this.db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ?').run(nowIso);
      this.db
        .prepare('DELETE FROM password_reset_tokens WHERE account_id = ? AND used_at IS NULL')
        .run(accountId);
      this.db
        .prepare(
          `INSERT INTO password_reset_tokens (id, account_id, token_hash, expires_at, used_at, request_ip, created_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`
        )
        .run(id, accountId, tokenHash, expiresAt, String(requestIp || ''), nowIso);
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return { id, rawToken, expiresAt };
  }

  public revokePasswordResetTokenById(tokenId: string): void {
    if (!tokenId) return;
    this.db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(tokenId);
  }

  public validatePasswordResetToken(rawToken: string): {
    valid: boolean;
    reason?: 'invalid' | 'used' | 'expired';
    expiresAt?: string;
  } {
    const cleanToken = String(rawToken || '').trim();
    if (!cleanToken || cleanToken.length < 20) {
      return { valid: false, reason: 'invalid' };
    }
    const tokenHash = hashResetToken(cleanToken);
    const row = this.db
      .prepare(
        `SELECT t.id, t.expires_at, t.used_at, a.active
         FROM password_reset_tokens t
         JOIN accounts a ON a.id = t.account_id
         WHERE t.token_hash = ?`
      )
      .get(tokenHash) as any;

    if (!row || !row.active) {
      return { valid: false, reason: 'invalid' };
    }
    if (row.used_at) {
      return { valid: false, reason: 'used' };
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { valid: false, reason: 'expired' };
    }
    return { valid: true, expiresAt: String(row.expires_at) };
  }

  public completePasswordReset(
    rawToken: string,
    newPassword: string,
    requestIp = ''
  ): { accountId: string; role: ServerUserRole; email: string } {
    const cleanToken = String(rawToken || '').trim();
    const cleanPwd = String(newPassword || '');
    if (!cleanToken || cleanToken.length < 20) {
      throw new Error('Lien de réinitialisation invalide ou incomplet.');
    }
    if (cleanPwd.length < 8) {
      throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    }
    if (cleanPwd.length > 128) {
      throw new Error('Le mot de passe ne doit pas dépasser 128 caractères.');
    }

    const tokenHash = hashResetToken(cleanToken);
    const nowIso = new Date().toISOString();
    const { hash, salt } = hashPassword(cleanPwd);

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const row = this.db
        .prepare(
          `SELECT t.id, t.account_id, t.expires_at, t.used_at, a.role, a.email, a.active
           FROM password_reset_tokens t
           JOIN accounts a ON a.id = t.account_id
           WHERE t.token_hash = ?`
        )
        .get(tokenHash) as any;

      if (!row || !row.active) {
        throw new Error('Lien de réinitialisation invalide ou expiré.');
      }
      if (row.used_at) {
        throw new Error('Ce lien de réinitialisation a déjà été utilisé.');
      }
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        throw new Error('Ce lien de réinitialisation a expiré (validité 15 minutes). Veuillez faire une nouvelle demande.');
      }

      const markUsed = this.db
        .prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL')
        .run(nowIso, row.id);
      if (markUsed.changes !== 1) {
        throw new Error('Ce lien de réinitialisation a déjà été utilisé.');
      }

      // Remove any other unused reset tokens for this account
      this.db
        .prepare('DELETE FROM password_reset_tokens WHERE account_id = ? AND id != ? AND used_at IS NULL')
        .run(row.account_id, row.id);

      // Update account password with bcrypt cost 12 and clear must_change_password
      this.db
        .prepare(
          'UPDATE accounts SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
        )
        .run(hash, salt, nowIso, row.account_id);

      // Invalidate ALL active sessions for security
      const revokedSessions = this.db
        .prepare('DELETE FROM sessions WHERE account_id = ?')
        .run(row.account_id);

      this.db.exec('COMMIT;');

      console.info('[AUTH RESET COMPLETED]', {
        accountId: row.account_id,
        role: row.role,
        emailMasked: maskEmailForLog(row.email),
        sessionsRevoked: revokedSessions.changes,
        ip: requestIp || 'unknown',
      });

      return {
        accountId: String(row.account_id),
        role: normalizeRole(row.role),
        email: String(row.email || ''),
      };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  private getDefaultOperatorEmployeeId(accountId: string): string | null {
    this.ensureDefaultOwnerEmployee(accountId);
    const row = this.db
      .prepare(
        `SELECT id FROM employees
         WHERE account_id = ? AND active = 1
         ORDER BY CASE WHEN role = 'proprietaire' THEN 0 ELSE 1 END, created_at ASC
         LIMIT 1`
      )
      .get(accountId) as any;
    return row ? String(row.id) : null;
  }

  private createSession(account: AccountRecord, activeEmployeeId?: string | null): SessionResult {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const resolvedOpId = activeEmployeeId || this.getDefaultOperatorEmployeeId(account.id);

    this.db
      .prepare(
        `INSERT INTO sessions (token_hash, account_id, active_employee_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(tokenHash, account.id, resolvedOpId, expiresAt, now.toISOString());

    return { token, account, expiresAt };
  }

  public verifySessionContext(token: string): {
    account: AccountRecord;
    activeEmployee: any | null;
  } | null {
    if (!token || typeof token !== 'string') return null;
    const tokenHash = hashSessionToken(token.trim());
    const row = this.db
      .prepare(
        `SELECT a.*, s.expires_at, s.active_employee_id
         FROM sessions s
         JOIN accounts a ON a.id = s.account_id
         WHERE s.token_hash = ? AND a.active = 1`
      )
      .get(tokenHash) as any;

    if (!row) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }

    const account = this.mapAccountRow(row);
    this.ensureDefaultOwnerEmployee(account.id);
    let empRow: any = null;
    if (row.active_employee_id) {
      empRow = this.db
        .prepare('SELECT * FROM employees WHERE account_id = ? AND id = ? AND active = 1')
        .get(account.id, String(row.active_employee_id));
    }
    if (!empRow) {
      empRow = this.db
        .prepare(
          `SELECT * FROM employees WHERE account_id = ? AND active = 1
           ORDER BY CASE WHEN role = 'proprietaire' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`
        )
        .get(account.id);
    }

    return {
      account,
      activeEmployee: empRow ? this.mapEmployeeRow(empRow) : null,
    };
  }

  public verifySessionToken(token: string): AccountRecord | null {
    return this.verifySessionContext(token)?.account || null;
  }

  public setSessionActiveEmployee(token: string, accountId: string, employeeId: string): void {
    if (!token) return;
    const tokenHash = hashSessionToken(token.trim());
    this.db
      .prepare('UPDATE sessions SET active_employee_id = ? WHERE token_hash = ? AND account_id = ?')
      .run(employeeId, tokenHash, accountId);
  }

  public revokeSessionToken(token: string): void {
    if (!token) return;
    const tokenHash = hashSessionToken(token.trim());
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  public updateOwnProfile(
    accountId: string,
    updates: { name?: string; email?: string; phone?: string }
  ): AccountRecord {
    const existing = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    if (!existing) throw new Error('Compte introuvable.');

    const nextName = updates.name !== undefined ? String(updates.name).trim() : existing.name;
    const nextEmail = updates.email !== undefined ? String(updates.email).trim().toLowerCase() : existing.email;
    const nextPhone = updates.phone !== undefined ? String(updates.phone).trim() : existing.phone;
    const now = new Date().toISOString();

    if (nextEmail && nextEmail !== String(existing.email || '').toLowerCase()) {
      const dup = this.db
        .prepare('SELECT id FROM accounts WHERE LOWER(email) = ? AND id != ?')
        .get(nextEmail, accountId);
      if (dup) {
        throw new Error('Cette adresse e-mail est déjà utilisée par un autre compte.');
      }
    }

    this.db
      .prepare('UPDATE accounts SET name = ?, email = ?, phone = ?, updated_at = ? WHERE id = ?')
      .run(nextName, nextEmail, nextPhone, now, accountId);

    const updated = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    return this.mapAccountRow(updated);
  }

  public changeOwnPassword(
    accountId: string,
    currentPassword: string,
    newPassword: string,
    activeEmployeeId?: string | null
  ): SessionResult {
    const row = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    if (!row) throw new Error('Compte introuvable.');
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    }
    const valid = verifyPassword(currentPassword, row.password_hash, row.password_salt);
    if (!valid) {
      throw new Error('Mot de passe actuel incorrect.');
    }
    const { hash, salt } = hashPassword(newPassword);
    const now = new Date().toISOString();

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db
        .prepare(
          'UPDATE accounts SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
        )
        .run(hash, salt, now, accountId);
      this.db.prepare('DELETE FROM sessions WHERE account_id = ?').run(accountId);
      const updatedRow = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
      const account = this.mapAccountRow(updatedRow);
      const newSession = this.createSession(account, activeEmployeeId);
      this.db.exec('COMMIT;');
      return newSession;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public adminResetAccountPassword(
    targetAccountId: string,
    adminName: string
  ): { temporaryPassword: string; account: AccountRecord } {
    const target = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(targetAccountId) as any;
    if (!target) throw new Error('Compte introuvable.');
    if (normalizeRole(target.role) === 'administrateur') {
      throw new Error('Utilisez "Mon Compte & Sécurité" pour modifier le mot de passe administrateur.');
    }

    const temporaryPassword = crypto.randomBytes(9).toString('base64url');
    const { hash, salt } = hashPassword(temporaryPassword);
    const now = new Date().toISOString();

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db
        .prepare(
          'UPDATE accounts SET password_hash = ?, password_salt = ?, must_change_password = 1, updated_at = ? WHERE id = ?'
        )
        .run(hash, salt, now, targetAccountId);
      this.db.prepare('DELETE FROM sessions WHERE account_id = ?').run(targetAccountId);

      const sub = this.db
        .prepare('SELECT id FROM subscriptions WHERE account_id = ?')
        .get(targetAccountId) as any;
      if (sub) {
        this.db
          .prepare(
            `INSERT INTO subscription_events (id, subscription_id, account_id, type, description, performed_by, justification, date)
             VALUES (?, ?, ?, 'MANUAL_OVERRIDE', ?, ?, ?, ?)`
          )
          .run(
            `evt-pwd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sub.id,
            targetAccountId,
            'Réinitialisation sécurisée du mot de passe (mot de passe temporaire requis au prochain login).',
            adminName,
            'Assistance administrateur',
            now
          );
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    const updated = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(targetAccountId);
    return { temporaryPassword, account: this.mapAccountRow(updated) };
  }

  public getAccountCapabilities(accountId: string, monthKeyOverride?: string): CapabilitiesSummary {
    const sub = this.db
      .prepare(
        'SELECT id, plan_id, status, expires_at, renewal_date, trial_ends_at, is_trial, is_comped FROM subscriptions WHERE account_id = ?'
      )
      .get(accountId) as any;
    const planId = sub?.plan_id || 'plan-gratuit';
    let status = String(sub?.status || 'gratuit');
    const freePlan = DEFAULT_PLANS[0];

    if (
      sub &&
      !Boolean(sub.is_comped) &&
      planId !== 'plan-gratuit' &&
      (status === 'actif' || status === 'periode_grace' || status === 'resiliation_programmee')
    ) {
      const effectiveExpiry =
        Boolean(sub.is_trial) && sub.trial_ends_at
          ? String(sub.trial_ends_at)
          : String(sub.expires_at || sub.renewal_date || '');
      if (effectiveExpiry) {
        const expTime = new Date(effectiveExpiry).getTime();
        if (!Number.isNaN(expTime) && expTime < Date.now()) {
          status = 'expire';
          this.db
            .prepare("UPDATE subscriptions SET status = 'expire', updated_at = ? WHERE account_id = ?")
            .run(new Date().toISOString(), accountId);
        }
      }
    }

    const planRow = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as any;
    const limits = planRow ? JSON.parse(planRow.limits_json) : freePlan.limits;
    const features = planRow ? JSON.parse(planRow.features_json) : freePlan.features;
    const planName = planRow?.name || (planId === 'plan-pro' ? 'Professionnel' : planId === 'plan-entreprise' ? 'Entreprise' : 'Gratuit');

    const monthKey = monthKeyOverride || getMonthKey();
    const activeProducts = Number(
      (
        this.db
          .prepare('SELECT COUNT(*) as cnt FROM products WHERE account_id = ? AND active = 1')
          .get(accountId) as any
      )?.cnt ?? 0
    );
    const stores = Number(
      (
        this.db
          .prepare('SELECT COUNT(*) as cnt FROM stores WHERE account_id = ?')
          .get(accountId) as any
      )?.cnt ?? 0
    );
    const monthlyInvoices = Number(
      (
        this.db
          .prepare('SELECT COUNT(*) as cnt FROM invoices WHERE account_id = ? AND substr(date, 1, 7) = ?')
          .get(accountId, monthKey) as any
      )?.cnt ?? 0
    );

    const usage = {
      activeProducts,
      stores,
      monthlyInvoices,
      monthKey,
    };

    if (status === 'expire' || status === 'suspendu') {
      return {
        planId: 'plan-gratuit',
        planName: 'Gratuit',
        maxProducts: freePlan.limits.maxProducts,
        maxStores: freePlan.limits.maxStores,
        maxInvoicesPerMonth: freePlan.limits.maxInvoicesPerMonth,
        allowedFeatures: ['sales_purchases'],
        isAccountOperational: status !== 'suspendu',
        usage,
      };
    }

    return {
      planId,
      planName,
      maxProducts: Number(limits.maxProducts ?? freePlan.limits.maxProducts),
      maxStores: Number(limits.maxStores ?? freePlan.limits.maxStores),
      maxInvoicesPerMonth: Number(limits.maxInvoicesPerMonth ?? freePlan.limits.maxInvoicesPerMonth),
      allowedFeatures: Array.isArray(features) ? features : ['sales_purchases'],
      isAccountOperational: true,
      usage,
    };
  }

  public assertCanAddProducts(accountId: string, additionalCount = 1): CapabilitiesSummary {
    const caps = this.getAccountCapabilities(accountId);
    if (!caps.isAccountOperational) {
      throw new QuotaExceededError({
        message: 'Votre compte est actuellement suspendu. Contactez l’administrateur SAMA STOCK.',
        quotaType: 'products',
        limit: caps.maxProducts,
        current: caps.usage.activeProducts,
        planId: caps.planId,
        planName: caps.planName,
        upgradeSuggestedPlan: 'Professionnel',
      });
    }
    if (caps.maxProducts !== -1 && caps.usage.activeProducts + additionalCount > caps.maxProducts) {
      const nextPlan: 'Professionnel' | 'Entreprise' =
        caps.planId === 'plan-gratuit' ? 'Professionnel' : 'Entreprise';
      throw new QuotaExceededError({
        message: `Limite atteinte : votre formule ${caps.planName} autorise au maximum ${caps.maxProducts} produits actifs (${caps.usage.activeProducts}/${caps.maxProducts} utilisés). Passez à une formule supérieure (${nextPlan}) pour ajouter plus de produits.`,
        quotaType: 'products',
        limit: caps.maxProducts,
        current: caps.usage.activeProducts,
        planId: caps.planId,
        planName: caps.planName,
        upgradeSuggestedPlan: nextPlan,
      });
    }
    return caps;
  }

  public assertCanAddStore(accountId: string, additionalCount = 1): CapabilitiesSummary {
    const caps = this.getAccountCapabilities(accountId);
    if (!caps.isAccountOperational) {
      throw new QuotaExceededError({
        message: 'Votre compte est actuellement suspendu. Contactez l’administrateur SAMA STOCK.',
        quotaType: 'stores',
        limit: caps.maxStores,
        current: caps.usage.stores,
        planId: caps.planId,
        planName: caps.planName,
        upgradeSuggestedPlan: 'Entreprise',
      });
    }
    if (caps.maxStores !== -1 && caps.usage.stores + additionalCount > caps.maxStores) {
      throw new QuotaExceededError({
        message: `Limite atteinte : votre formule ${caps.planName} est limitée à ${caps.maxStores} boutique (${caps.usage.stores}/${caps.maxStores} utilisée). Passez à une formule supérieure (Entreprise) pour créer une deuxième boutique.`,
        quotaType: 'stores',
        limit: caps.maxStores,
        current: caps.usage.stores,
        planId: caps.planId,
        planName: caps.planName,
        upgradeSuggestedPlan: 'Entreprise',
      });
    }
    return caps;
  }

  public assertCanCreateInvoice(
    accountId: string,
    invoiceDate?: string,
    additionalCount = 1
  ): CapabilitiesSummary {
    const monthKey = getMonthKey(invoiceDate);
    const caps = this.getAccountCapabilities(accountId, monthKey);
    if (!caps.isAccountOperational) {
      throw new QuotaExceededError({
        message: 'Votre compte est actuellement suspendu. Contactez l’administrateur SAMA STOCK.',
        quotaType: 'invoices',
        limit: caps.maxInvoicesPerMonth,
        current: caps.usage.monthlyInvoices,
        planId: caps.planId,
        planName: caps.planName,
        upgradeSuggestedPlan: 'Professionnel',
      });
    }
    if (
      caps.maxInvoicesPerMonth !== -1 &&
      caps.usage.monthlyInvoices + additionalCount > caps.maxInvoicesPerMonth
    ) {
      const nextPlan: 'Professionnel' | 'Entreprise' =
        caps.planId === 'plan-gratuit' ? 'Professionnel' : 'Entreprise';
      throw new QuotaExceededError({
        message: `Quota mensuel atteint : votre formule ${caps.planName} autorise ${caps.maxInvoicesPerMonth} factures par mois (${caps.usage.monthlyInvoices}/${caps.maxInvoicesPerMonth} utilisées pour ${monthKey}). Passez à une formule supérieure (${nextPlan}) ou attendez la réinitialisation du mois prochain.`,
        quotaType: 'invoices',
        limit: caps.maxInvoicesPerMonth,
        current: caps.usage.monthlyInvoices,
        planId: caps.planId,
        planName: caps.planName,
        upgradeSuggestedPlan: nextPlan,
      });
    }
    return caps;
  }

  public createMerchantProduct(accountId: string, prod: any, operatorEmployee?: any) {
    if (operatorEmployee) {
      this.assertStaffPermission(
        operatorEmployee,
        'manageProducts',
        'Permission requise pour créer ou modifier un produit.'
      );
    }
    if (!prod || !prod.id || !String(prod.name || '').trim()) {
      throw new Error('Données du produit invalides.');
    }
    const buyPrice = Number(prod.buyPrice ?? 0);
    const sellPrice = Number(prod.sellPrice ?? 0);
    if (!Number.isFinite(buyPrice) || buyPrice < 0 || !Number.isFinite(sellPrice) || sellPrice < 0) {
      throw new Error('Les prix du produit doivent être des nombres positifs valides.');
    }

    const existing = this.db
      .prepare('SELECT id, active FROM products WHERE account_id = ? AND id = ?')
      .get(accountId, String(prod.id)) as any;

    const isActivating = prod.active !== false && (!existing || Number(existing.active) === 0);
    if (isActivating) {
      this.assertCanAddProducts(accountId, 1);
    }

    const now = new Date().toISOString();
    const record = {
      ...prod,
      id: String(prod.id),
      name: String(prod.name).trim(),
      buyPrice,
      sellPrice,
      imageUrl: sanitizeMediaUrl(prod.imageUrl, ''),
      active: prod.active !== false,
      createdAt: prod.createdAt || now,
      updatedAt: prod.updatedAt || now,
    };

    this.db
      .prepare(
        `INSERT INTO products (id, account_id, active, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(account_id, id) DO UPDATE SET active = excluded.active, payload_json = excluded.payload_json, updated_at = excluded.updated_at`
      )
      .run(record.id, accountId, record.active ? 1 : 0, JSON.stringify(record), record.updatedAt);

    return {
      product: record,
      capabilities: this.getAccountCapabilities(accountId),
    };
  }

  public createMerchantStore(accountId: string, store: any, operatorEmployee?: any) {
    if (operatorEmployee) {
      this.assertStaffOwnerOrAdmin(
        operatorEmployee,
        'Seul le propriétaire ou administrateur peut créer ou modifier une boutique.'
      );
    }
    if (!store || !store.id || !String(store.name || '').trim()) {
      throw new Error('Nom de la boutique requis.');
    }
    const existing = this.db
      .prepare('SELECT id FROM stores WHERE account_id = ? AND id = ?')
      .get(accountId, String(store.id));
    if (!existing) {
      this.assertCanAddStore(accountId, 1);
    }

    const now = new Date().toISOString();
    const record = {
      id: String(store.id),
      name: String(store.name).trim(),
      address: String(store.address || ''),
      city: String(store.city || 'Dakar'),
      phone: String(store.phone || ''),
      isMain: Boolean(store.isMain),
    };

    this.db
      .prepare(
        `INSERT INTO stores (id, account_id, name, address, city, phone, is_main, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id, id) DO UPDATE SET name = excluded.name, address = excluded.address, city = excluded.city, phone = excluded.phone`
      )
      .run(
        record.id,
        accountId,
        record.name,
        record.address,
        record.city,
        record.phone,
        record.isMain ? 1 : 0,
        now
      );

    return {
      store: record,
      capabilities: this.getAccountCapabilities(accountId),
    };
  }

  public createMerchantInvoice(accountId: string, invoice: any, operatorEmployee?: any) {
    if (!invoice || !invoice.id) {
      throw new Error('Données de facture invalides.');
    }
    if (operatorEmployee && invoice.storeId) {
      this.assertStaffStoreAccess(operatorEmployee, String(invoice.storeId));
    }
    const existing = this.db
      .prepare('SELECT id FROM invoices WHERE account_id = ? AND id = ?')
      .get(accountId, String(invoice.id));

    const now = new Date().toISOString();
    const invDate = normalizeDateString(invoice.date, now);
    if (!existing) {
      this.assertCanCreateInvoice(accountId, invDate, 1);
    }

    const cleanInvoice = stripFiscalFields({
      ...invoice,
      id: String(invoice.id),
      date: invDate,
      updatedAt: invoice.updatedAt || now,
    });

    this.db
      .prepare(
        `INSERT INTO invoices (id, account_id, date, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(account_id, id) DO UPDATE SET date = excluded.date, payload_json = excluded.payload_json, updated_at = excluded.updated_at`
      )
      .run(cleanInvoice.id, accountId, invDate, JSON.stringify(cleanInvoice), cleanInvoice.updatedAt);

    return {
      invoice: cleanInvoice,
      capabilities: this.getAccountCapabilities(accountId),
    };
  }

  public getMerchantWorkspace(accountId: string) {
    this.ensureDefaultOwnerEmployee(accountId);

    const orgRow = this.db
      .prepare('SELECT * FROM organizations WHERE account_id = ?')
      .get(accountId) as any;
    const prefRow = this.db
      .prepare('SELECT * FROM account_preferences WHERE account_id = ?')
      .get(accountId) as any;

    const storeRows = this.db
      .prepare('SELECT * FROM stores WHERE account_id = ? ORDER BY is_main DESC, created_at ASC')
      .all(accountId) as any[];
    const employeeRows = this.db
      .prepare('SELECT * FROM employees WHERE account_id = ? ORDER BY created_at ASC')
      .all(accountId) as any[];
    const categoryRows = this.db
      .prepare('SELECT payload_json FROM categories WHERE account_id = ?')
      .all(accountId) as any[];
    const productRows = this.db
      .prepare('SELECT payload_json FROM products WHERE account_id = ? ORDER BY updated_at DESC')
      .all(accountId) as any[];
    const movementRows = this.db
      .prepare('SELECT payload_json FROM stock_movements WHERE account_id = ? ORDER BY date DESC')
      .all(accountId) as any[];
    const customerRows = this.db
      .prepare('SELECT payload_json FROM customers WHERE account_id = ? ORDER BY updated_at DESC')
      .all(accountId) as any[];
    const supplierRows = this.db
      .prepare('SELECT payload_json FROM suppliers WHERE account_id = ? ORDER BY updated_at DESC')
      .all(accountId) as any[];
    const purchaseRows = this.db
      .prepare('SELECT payload_json FROM purchases WHERE account_id = ? ORDER BY updated_at DESC')
      .all(accountId) as any[];
    const saleRows = this.db
      .prepare('SELECT payload_json FROM sales WHERE account_id = ? ORDER BY date DESC')
      .all(accountId) as any[];
    const invoiceRows = this.db
      .prepare('SELECT payload_json FROM invoices WHERE account_id = ? ORDER BY date DESC')
      .all(accountId) as any[];
    const expenseRows = this.db
      .prepare('SELECT payload_json FROM expenses WHERE account_id = ? ORDER BY date DESC')
      .all(accountId) as any[];
    const inventoryRows = this.db
      .prepare('SELECT payload_json FROM inventory_sessions WHERE account_id = ? ORDER BY date DESC')
      .all(accountId) as any[];
    const shiftRows = this.db
      .prepare('SELECT payload_json FROM cash_shifts WHERE account_id = ? ORDER BY opened_at DESC')
      .all(accountId) as any[];
    const heldRows = this.db
      .prepare('SELECT payload_json FROM held_sales WHERE account_id = ? ORDER BY created_at DESC')
      .all(accountId) as any[];
    const auditRows = this.db
      .prepare('SELECT payload_json FROM audit_logs WHERE account_id = ? ORDER BY date DESC LIMIT 400')
      .all(accountId) as any[];

    const stores = storeRows.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      city: s.city,
      phone: s.phone,
      isMain: Boolean(s.is_main),
    }));

    let parsedLoyalty = {
      enabled: true,
      amountPerPoint: 1000,
      pointValueFCFA: 25,
      minRedeemPoints: 10,
    };
    if (orgRow?.loyalty_settings_json) {
      try {
        parsedLoyalty = { ...parsedLoyalty, ...JSON.parse(orgRow.loyalty_settings_json) };
      } catch {
        // fallback to default
      }
    }

    const organization = orgRow
      ? {
          id: `org-${accountId}`,
          name: orgRow.name,
          slogan: orgRow.slogan,
          phone: orgRow.phone,
          email: orgRow.email,
          address: orgRow.address,
          city: orgRow.city,
          country: orgRow.country,
          currency: orgRow.currency,
          vatEnabled: Boolean(orgRow.vat_enabled),
          vatRate: Number(orgRow.vat_rate),
          logoUrl: orgRow.logo_url,
          bankDetails: orgRow.bank_details || '',
          waveNumber: orgRow.wave_number || '',
          orangeMoneyNumber: orgRow.orange_money_number || '',
          loyaltySettings: parsedLoyalty,
          receiptFooter: orgRow.receipt_footer || 'Merci pour votre confiance ! À bientôt.',
          receiptShowLogo: orgRow.receipt_show_logo !== undefined ? Boolean(orgRow.receipt_show_logo) : true,
          receiptDefaultWidth: orgRow.receipt_default_width === '58mm' ? '58mm' : '80mm',
        }
      : null;

    return {
      organization,
      stores,
      employees: employeeRows.map((e) => this.mapEmployeeRow(e)),
      activeStoreId: prefRow?.active_store_id || stores[0]?.id || '',
      activeShift: prefRow?.active_shift_json ? JSON.parse(prefRow.active_shift_json) : null,
      shiftHistory: shiftRows.map((r) => JSON.parse(r.payload_json)),
      heldSales: heldRows.map((r) => JSON.parse(r.payload_json)),
      auditLogs: auditRows.map((r) => JSON.parse(r.payload_json)),
      categories: categoryRows.map((r) => JSON.parse(r.payload_json)),
      products: productRows.map((r) => JSON.parse(r.payload_json)),
      stockMovements: movementRows.map((r) => JSON.parse(r.payload_json)),
      customers: customerRows.map((r) => JSON.parse(r.payload_json)),
      suppliers: supplierRows.map((r) => stripFiscalFields(JSON.parse(r.payload_json))),
      purchases: purchaseRows.map((r) => JSON.parse(r.payload_json)),
      sales: saleRows.map((r) => JSON.parse(r.payload_json)),
      invoices: invoiceRows.map((r) => stripFiscalFields(JSON.parse(r.payload_json))),
      expenses: expenseRows.map((r) => JSON.parse(r.payload_json)),
      inventorySessions: inventoryRows.map((r) => JSON.parse(r.payload_json)),
      capabilities: this.getAccountCapabilities(accountId),
    };
  }

  public syncMerchantWorkspace(
    accountId: string,
    body: any,
    onlyIfEmpty = false,
    operatorEmployee?: any
  ): boolean {
    if (!body || typeof body !== 'object') return false;
    const now = new Date().toISOString();

    if (onlyIfEmpty) {
      const existingProducts = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM products WHERE account_id = ?').get(accountId) as any
      ).cnt;
      const existingSales = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM sales WHERE account_id = ?').get(accountId) as any
      ).cnt;
      const existingInvoices = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM invoices WHERE account_id = ?').get(accountId) as any
      ).cnt;
      if (existingProducts > 0 || existingSales > 0 || existingInvoices > 0) {
        return false;
      }
    }

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const isRestrictedStaff =
        Boolean(operatorEmployee) &&
        operatorEmployee.role !== 'proprietaire' &&
        operatorEmployee.role !== 'administrateur';

      if (body.organization && typeof body.organization === 'object') {
        const org = stripFiscalFields(body.organization);
        const existingOrg = this.db
          .prepare('SELECT * FROM organizations WHERE account_id = ?')
          .get(accountId) as any;

        const safeLogoUrl = sanitizeMediaUrl(
          org.logoUrl,
          existingOrg?.logo_url || '/assets/aistudio/Logo_SAMA_STOCK__gestion_et_croissance_7ffcabd3.png'
        );
        if (isRestrictedStaff && existingOrg) {
          const orgChanged =
            String(org.name || '') !== String(existingOrg.name || '') ||
            Boolean(org.vatEnabled) !== Boolean(existingOrg.vat_enabled) ||
            Number(org.vatRate ?? 18) !== Number(existingOrg.vat_rate ?? 18) ||
            safeLogoUrl !== String(existingOrg.logo_url || '');
          if (orgChanged) {
            throw new ForbiddenError('Seul le propriétaire ou administrateur peut modifier les paramètres de l’entreprise.');
          }
        }
        const loyaltyJson = org.loyaltySettings
          ? JSON.stringify(org.loyaltySettings)
          : JSON.stringify({ enabled: true, amountPerPoint: 1000, pointValueFCFA: 25, minRedeemPoints: 10 });
        this.db
          .prepare(
            `UPDATE organizations
             SET name = ?, slogan = ?, phone = ?, email = ?, address = ?, city = ?, country = ?, currency = ?, vat_enabled = ?, vat_rate = ?, logo_url = ?, bank_details = ?, wave_number = ?, orange_money_number = ?, loyalty_settings_json = ?, receipt_footer = ?, receipt_show_logo = ?, receipt_default_width = ?, updated_at = ?
             WHERE account_id = ?`
          )
          .run(
            String(org.name || 'Mon Entreprise'),
            String(org.slogan || ''),
            String(org.phone || ''),
            String(org.email || ''),
            String(org.address || ''),
            String(org.city || 'Dakar'),
            String(org.country || 'Sénégal'),
            String(org.currency || 'FCFA'),
            org.vatEnabled ? 1 : 0,
            Number(org.vatRate ?? 18),
            safeLogoUrl,
            String(org.bankDetails || ''),
            String(org.waveNumber || ''),
            String(org.orangeMoneyNumber || ''),
            loyaltyJson,
            String(org.receiptFooter || 'Merci pour votre confiance ! À bientôt.'),
            org.receiptShowLogo === false ? 0 : 1,
            org.receiptDefaultWidth === '58mm' ? '58mm' : '80mm',
            now,
            accountId
          );
      }

      if (Array.isArray(body.stores) && body.stores.length > 0) {
        const caps = this.getAccountCapabilities(accountId);
        const existingStoreRows = this.db
          .prepare('SELECT id, name FROM stores WHERE account_id = ?')
          .all(accountId) as any[];
        const existingStoreIds = new Set(existingStoreRows.map((r) => String(r.id)));

        if (isRestrictedStaff) {
          const incomingIds = new Set(body.stores.filter((s: any) => s?.id).map((s: any) => String(s.id)));
          const storeSetChanged =
            incomingIds.size !== existingStoreIds.size ||
            body.stores.some((s: any) => s?.id && !existingStoreIds.has(String(s.id)));
          if (storeSetChanged) {
            throw new ForbiddenError('Seul le propriétaire ou administrateur peut modifier les boutiques.');
          }
        }

        const hasNewStore = body.stores.some(
          (s: any) => s?.id && !existingStoreIds.has(String(s.id))
        );
        if ((onlyIfEmpty || hasNewStore) && caps.maxStores !== -1 && body.stores.length > caps.maxStores) {
          throw new QuotaExceededError({
            message: `Limite atteinte : votre formule ${caps.planName} est limitée à ${caps.maxStores} boutique (${existingStoreIds.size}/${caps.maxStores} utilisée). Passez à une formule supérieure (Entreprise) pour créer une deuxième boutique.`,
            quotaType: 'stores',
            limit: caps.maxStores,
            current: existingStoreIds.size,
            planId: caps.planId,
            planName: caps.planName,
            upgradeSuggestedPlan: 'Entreprise',
          });
        }
        this.db.prepare('DELETE FROM stores WHERE account_id = ?').run(accountId);
        const insStore = this.db.prepare(
          'INSERT INTO stores (id, account_id, name, address, city, phone, is_main, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const s of body.stores) {
          if (!s?.id) continue;
          insStore.run(
            String(s.id),
            accountId,
            String(s.name || 'Boutique'),
            String(s.address || ''),
            String(s.city || 'Dakar'),
            String(s.phone || ''),
            s.isMain ? 1 : 0,
            now
          );
        }
      }

      if (body.activeStoreId !== undefined || body.activeShift !== undefined) {
        if (operatorEmployee && body.activeStoreId) {
          this.assertStaffStoreAccess(operatorEmployee, String(body.activeStoreId));
        }
        const currentPref = this.db
          .prepare('SELECT active_store_id, active_shift_json FROM account_preferences WHERE account_id = ?')
          .get(accountId) as any;
        const nextStoreId =
          body.activeStoreId !== undefined ? String(body.activeStoreId) : currentPref?.active_store_id || '';
        const nextShiftJson =
          body.activeShift !== undefined
            ? body.activeShift
              ? JSON.stringify(body.activeShift)
              : null
            : currentPref?.active_shift_json || null;
        this.db
          .prepare(
            `INSERT INTO account_preferences (account_id, active_store_id, active_shift_json, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(account_id) DO UPDATE SET active_store_id = excluded.active_store_id, active_shift_json = excluded.active_shift_json, updated_at = excluded.updated_at`
          )
          .run(accountId, nextStoreId, nextShiftJson, now);
      }

      if (Array.isArray(body.categories)) {
        this.db.prepare('DELETE FROM categories WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO categories (id, account_id, payload_json, updated_at) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.categories) {
          if (item?.id) ins.run(String(item.id), accountId, JSON.stringify(item), now);
        }
      }

      if (Array.isArray(body.products)) {
        const caps = this.getAccountCapabilities(accountId);
        const existingProductRows = this.db
          .prepare('SELECT id, active, payload_json FROM products WHERE account_id = ?')
          .all(accountId) as any[];
        const existingMap = new Map<string, { active: number; parsed: any }>(
          existingProductRows.map((r) => [
            String(r.id),
            { active: Number(r.active), parsed: JSON.parse(r.payload_json) },
          ])
        );

        if (operatorEmployee && operatorEmployee.role !== 'proprietaire') {
          const canManageProd = Boolean(operatorEmployee.permissions?.manageProducts);
          const canEditPrices = Boolean(operatorEmployee.permissions?.editPrices);
          if (!canManageProd) {
            const incomingIds = new Set(body.products.filter((p: any) => p?.id).map((p: any) => String(p.id)));
            if (
              incomingIds.size !== existingMap.size ||
              body.products.some((p: any) => p?.id && !existingMap.has(String(p.id)))
            ) {
              throw new ForbiddenError('Permission requise pour ajouter ou supprimer des produits.');
            }
          }
          if (!canEditPrices) {
            for (const p of body.products) {
              if (!p?.id) continue;
              const prev = existingMap.get(String(p.id))?.parsed;
              if (
                prev &&
                (Number(p.sellPrice) !== Number(prev.sellPrice) ||
                  Number(p.buyPrice) !== Number(prev.buyPrice))
              ) {
                throw new ForbiddenError('Permission requise pour modifier les prix des produits.');
              }
            }
          }
        }

        const incomingActive = body.products.filter((p: any) => p?.id && p.active !== false);
        const hasNewOrReactivated = incomingActive.some(
          (p: any) => (existingMap.get(String(p.id))?.active ?? 0) === 0
        );
        if ((onlyIfEmpty || hasNewOrReactivated) && caps.maxProducts !== -1 && incomingActive.length > caps.maxProducts) {
          const nextPlan: 'Professionnel' | 'Entreprise' =
            caps.planId === 'plan-gratuit' ? 'Professionnel' : 'Entreprise';
          throw new QuotaExceededError({
            message: `Limite atteinte : votre formule ${caps.planName} autorise au maximum ${caps.maxProducts} produits actifs (${caps.usage.activeProducts}/${caps.maxProducts} utilisés). Passez à une formule supérieure (${nextPlan}) pour ajouter plus de produits.`,
            quotaType: 'products',
            limit: caps.maxProducts,
            current: caps.usage.activeProducts,
            planId: caps.planId,
            planName: caps.planName,
            upgradeSuggestedPlan: nextPlan,
          });
        }
        this.db.prepare('DELETE FROM products WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO products (id, account_id, active, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)'
        );
        for (const item of body.products) {
          if (item?.id) {
            const cleanItem = {
              ...item,
              imageUrl: sanitizeMediaUrl(item.imageUrl, ''),
            };
            ins.run(String(item.id), accountId, item.active === false ? 0 : 1, JSON.stringify(cleanItem), item.updatedAt || now);
          }
        }
      }

      if (Array.isArray(body.stockMovements)) {
        this.db.prepare('DELETE FROM stock_movements WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO stock_movements (id, account_id, date, payload_json) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.stockMovements) {
          if (item?.id) ins.run(String(item.id), accountId, String(item.date || now), JSON.stringify(item));
        }
      }

      if (Array.isArray(body.customers)) {
        this.db.prepare('DELETE FROM customers WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO customers (id, account_id, payload_json, updated_at) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.customers) {
          if (item?.id) ins.run(String(item.id), accountId, JSON.stringify(item), now);
        }
      }

      if (Array.isArray(body.suppliers)) {
        this.db.prepare('DELETE FROM suppliers WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO suppliers (id, account_id, payload_json, updated_at) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.suppliers) {
          if (item?.id) ins.run(String(item.id), accountId, JSON.stringify(stripFiscalFields(item)), now);
        }
      }

      if (Array.isArray(body.purchases)) {
        this.db.prepare('DELETE FROM purchases WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO purchases (id, account_id, payload_json, updated_at) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.purchases) {
          if (item?.id) ins.run(String(item.id), accountId, JSON.stringify(item), now);
        }
      }

      if (Array.isArray(body.sales)) {
        if (operatorEmployee && operatorEmployee.role !== 'proprietaire' && !operatorEmployee.permissions?.voidSale) {
          const prevSalesRows = this.db
            .prepare('SELECT id, payload_json FROM sales WHERE account_id = ?')
            .all(accountId) as any[];
          const prevStatusMap = new Map<string, string>(
            prevSalesRows.map((r) => [String(r.id), String(JSON.parse(r.payload_json)?.status || '')])
          );
          for (const s of body.sales) {
            if (!s?.id) continue;
            const prevStatus = prevStatusMap.get(String(s.id));
            if (prevStatus && prevStatus !== 'annulee' && s.status === 'annulee') {
              throw new ForbiddenError('Permission requise pour annuler une vente.');
            }
          }
        }
        this.db.prepare('DELETE FROM sales WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO sales (id, account_id, date, payload_json) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.sales) {
          if (item?.id) ins.run(String(item.id), accountId, String(item.date || now), JSON.stringify(item));
        }
      }

      if (Array.isArray(body.invoices)) {
        const caps = this.getAccountCapabilities(accountId);
        if (caps.maxInvoicesPerMonth !== -1) {
          const existingInvRows = this.db
            .prepare('SELECT id FROM invoices WHERE account_id = ?')
            .all(accountId) as any[];
          const existingInvIds = new Set(existingInvRows.map((r) => String(r.id)));
          const byMonth = new Map<string, any[]>();
          for (const inv of body.invoices) {
            if (!inv?.id) continue;
            const invDate = normalizeDateString(inv.date, now);
            const mKey = getMonthKey(invDate);
            const list = byMonth.get(mKey) || [];
            list.push(inv);
            byMonth.set(mKey, list);
          }
          for (const [mKey, list] of byMonth.entries()) {
            const hasNewInMonth = list.some((inv) => !existingInvIds.has(String(inv.id)));
            if ((onlyIfEmpty || hasNewInMonth) && list.length > caps.maxInvoicesPerMonth) {
              const nextPlan: 'Professionnel' | 'Entreprise' =
                caps.planId === 'plan-gratuit' ? 'Professionnel' : 'Entreprise';
              const monthCaps = this.getAccountCapabilities(accountId, mKey);
              throw new QuotaExceededError({
                message: `Quota mensuel atteint : votre formule ${caps.planName} autorise ${caps.maxInvoicesPerMonth} factures par mois (${monthCaps.usage.monthlyInvoices}/${caps.maxInvoicesPerMonth} utilisées pour ${mKey}). Passez à une formule supérieure (${nextPlan}) ou attendez la réinitialisation du mois prochain.`,
                quotaType: 'invoices',
                limit: caps.maxInvoicesPerMonth,
                current: monthCaps.usage.monthlyInvoices,
                planId: caps.planId,
                planName: caps.planName,
                upgradeSuggestedPlan: nextPlan,
              });
            }
          }
        }
        this.db.prepare('DELETE FROM invoices WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO invoices (id, account_id, date, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)'
        );
        for (const item of body.invoices) {
          if (item?.id) {
            const cleanDate = normalizeDateString(item.date, now);
            ins.run(
              String(item.id),
              accountId,
              cleanDate,
              JSON.stringify(stripFiscalFields({ ...item, date: cleanDate })),
              item.updatedAt || now
            );
          }
        }
      }

      if (Array.isArray(body.expenses)) {
        this.db.prepare('DELETE FROM expenses WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO expenses (id, account_id, date, payload_json) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.expenses) {
          if (item?.id) ins.run(String(item.id), accountId, String(item.date || now), JSON.stringify(item));
        }
      }

      if (Array.isArray(body.inventorySessions)) {
        this.db.prepare('DELETE FROM inventory_sessions WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO inventory_sessions (id, account_id, date, payload_json) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.inventorySessions) {
          if (item?.id) ins.run(String(item.id), accountId, String(item.date || now), JSON.stringify(item));
        }
      }

      if (Array.isArray(body.shiftHistory)) {
        this.db.prepare('DELETE FROM cash_shifts WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO cash_shifts (id, account_id, opened_at, status, payload_json) VALUES (?, ?, ?, ?, ?)'
        );
        for (const item of body.shiftHistory) {
          if (item?.id) {
            ins.run(
              String(item.id),
              accountId,
              String(item.openedAt || now),
              String(item.status || 'fermee'),
              JSON.stringify(item)
            );
          }
        }
      }

      if (Array.isArray(body.heldSales)) {
        this.db.prepare('DELETE FROM held_sales WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO held_sales (id, account_id, created_at, payload_json) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.heldSales) {
          if (item?.id) ins.run(String(item.id), accountId, String(item.createdAt || now), JSON.stringify(item));
        }
      }

      if (Array.isArray(body.auditLogs)) {
        this.db.prepare('DELETE FROM audit_logs WHERE account_id = ?').run(accountId);
        const ins = this.db.prepare(
          'INSERT INTO audit_logs (id, account_id, date, payload_json) VALUES (?, ?, ?, ?)'
        );
        for (const item of body.auditLogs.slice(0, 500)) {
          if (item?.id) ins.run(String(item.id), accountId, String(item.date || now), JSON.stringify(item));
        }
      }

      this.db.exec('COMMIT;');
      return true;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public processIncrementalSyncOperations(
    accountId: string,
    operations: any[],
    operatorEmployee?: any
  ) {
    if (!Array.isArray(operations)) {
      return { processedIds: [], skippedIds: [], workspace: this.getMerchantWorkspace(accountId) };
    }
    const now = new Date().toISOString();
    const processedIds: string[] = [];
    const skippedIds: string[] = [];

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const op of operations) {
        if (!op) continue;
        const opKey = String(op.clientOperationId || op.id || '').trim();
        if (!opKey) continue;

        const alreadyProcessed = this.db
          .prepare('SELECT 1 FROM sync_operations_log WHERE account_id = ? AND client_op_id = ?')
          .get(accountId, opKey);
        if (alreadyProcessed) {
          skippedIds.push(opKey);
          continue;
        }

        const payload = op.payload || {};
        if (operatorEmployee && payload?.storeId) {
          this.assertStaffStoreAccess(operatorEmployee, String(payload.storeId));
        }

        switch (op.action) {
          case 'CREATE_SALE': {
            if (operatorEmployee) {
              this.assertStaffPermission(
                operatorEmployee,
                'posAccess',
                'Permission requise pour enregistrer une vente.'
              );
            }
            if (payload?.id) {
              const existingSale = this.db
                .prepare('SELECT id FROM sales WHERE account_id = ? AND id = ?')
                .get(accountId, String(payload.id));
              if (!existingSale) {
                const syncedSale = { ...payload, synced: true };
                this.db
                  .prepare('INSERT INTO sales (id, account_id, date, payload_json) VALUES (?, ?, ?, ?)')
                  .run(String(payload.id), accountId, String(payload.date || now), JSON.stringify(syncedSale));

                const items = Array.isArray(payload.items) ? payload.items : [];
                const storeId = String(payload.storeId || '');
                for (const item of items) {
                  if (!item?.productId) continue;
                  const prodRow = this.db
                    .prepare('SELECT payload_json FROM products WHERE account_id = ? AND id = ?')
                    .get(accountId, String(item.productId)) as any;
                  if (prodRow) {
                    const prod = JSON.parse(prodRow.payload_json);
                    const factor = Number(item.unitFactor || 1);
                    const deductQty = Number(item.quantity || 0) * factor;
                    const currentQty = Number(prod.storeQuantities?.[storeId] ?? 0);
                    const nextStoreQty = Math.max(0, currentQty - deductQty);
                    prod.storeQuantities = { ...prod.storeQuantities, [storeId]: nextStoreQty };
                    prod.quantity = Object.values(prod.storeQuantities).reduce(
                      (sum: number, v: any) => sum + Number(v || 0),
                      0
                    );
                    if (item.variantId && Array.isArray(prod.variants)) {
                      prod.variants = prod.variants.map((v: any) => {
                        if (v.id !== item.variantId) return v;
                        const vCurr = Number(v.storeQuantities?.[storeId] ?? 0);
                        return {
                          ...v,
                          storeQuantities: {
                            ...v.storeQuantities,
                            [storeId]: Math.max(0, vCurr - deductQty),
                          },
                        };
                      });
                    }
                    prod.updatedAt = now;
                    this.db
                      .prepare('UPDATE products SET payload_json = ?, updated_at = ? WHERE account_id = ? AND id = ?')
                      .run(JSON.stringify(prod), now, accountId, String(prod.id));
                  }
                }
              }
            }
            break;
          }
          case 'VOID_SALE': {
            if (operatorEmployee) {
              this.assertStaffPermission(
                operatorEmployee,
                'voidSale',
                'Permission requise pour annuler une vente.'
              );
            }
            if (payload?.saleId) {
              const saleRow = this.db
                .prepare('SELECT payload_json FROM sales WHERE account_id = ? AND id = ?')
                .get(accountId, String(payload.saleId)) as any;
              if (saleRow) {
                const sale = JSON.parse(saleRow.payload_json);
                if (sale.status !== 'annulee') {
                  sale.status = 'annulee';
                  sale.voidedAt = payload.voidedAt || now;
                  sale.voidedBy = payload.voidedBy || 'Opérateur';
                  sale.voidReason = payload.reason || 'Annulation caisse';
                  sale.updatedAt = now;
                  this.db
                    .prepare('UPDATE sales SET payload_json = ? WHERE account_id = ? AND id = ?')
                    .run(JSON.stringify(sale), accountId, String(sale.id));
                }
              }
            }
            break;
          }
          case 'CREATE_PRODUCT': {
            if (operatorEmployee) {
              this.assertStaffPermission(
                operatorEmployee,
                'manageProducts',
                'Permission requise pour créer un produit.'
              );
            }
            if (payload?.id) {
              const existingProd = this.db
                .prepare('SELECT id, active FROM products WHERE account_id = ? AND id = ?')
                .get(accountId, String(payload.id)) as any;
              if ((!existingProd || Number(existingProd.active) === 0) && payload.active !== false) {
                this.assertCanAddProducts(accountId, 1);
              }
              const cleanProd = { ...payload, imageUrl: sanitizeMediaUrl(payload.imageUrl, '') };
              this.db
                .prepare(
                  'INSERT OR IGNORE INTO products (id, account_id, active, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)'
                )
                .run(
                  String(payload.id),
                  accountId,
                  payload.active === false ? 0 : 1,
                  JSON.stringify(cleanProd),
                  payload.updatedAt || now
                );
            }
            break;
          }
          case 'CREATE_STORE': {
            if (operatorEmployee) {
              this.assertStaffOwnerOrAdmin(
                operatorEmployee,
                'Seul le propriétaire ou administrateur peut créer une boutique.'
              );
            }
            if (payload?.id) {
              const existingStore = this.db
                .prepare('SELECT id FROM stores WHERE account_id = ? AND id = ?')
                .get(accountId, String(payload.id));
              if (!existingStore) {
                this.assertCanAddStore(accountId, 1);
                this.db
                  .prepare(
                    'INSERT OR IGNORE INTO stores (id, account_id, name, address, city, phone, is_main, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                  )
                  .run(
                    String(payload.id),
                    accountId,
                    String(payload.name || 'Boutique'),
                    String(payload.address || ''),
                    String(payload.city || 'Dakar'),
                    String(payload.phone || ''),
                    payload.isMain ? 1 : 0,
                    now
                  );
              }
            }
            break;
          }
          case 'UPDATE_STOCK': {
            if (operatorEmployee) {
              this.assertStaffPermission(
                operatorEmployee,
                'manageStock',
                'Permission requise pour ajuster le stock.'
              );
            }
            if (payload?.id) {
              this.db
                .prepare('INSERT OR IGNORE INTO stock_movements (id, account_id, date, payload_json) VALUES (?, ?, ?, ?)')
                .run(
                  String(payload.id),
                  accountId,
                  String(payload.date || now),
                  JSON.stringify({ ...payload, syncStatus: 'synced' })
                );
            }
            break;
          }
          case 'CREATE_INVOICE':
          case 'UPDATE_INVOICE': {
            if (payload?.id) {
              const existingInv = this.db
                .prepare('SELECT id FROM invoices WHERE account_id = ? AND id = ?')
                .get(accountId, String(payload.id));
              const invDate = normalizeDateString(payload.date, now);
              if (!existingInv) {
                this.assertCanCreateInvoice(accountId, invDate, 1);
              }
              this.db
                .prepare(
                  `INSERT INTO invoices (id, account_id, date, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(account_id, id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`
                )
                .run(
                  String(payload.id),
                  accountId,
                  invDate,
                  JSON.stringify(stripFiscalFields({ ...payload, date: invDate })),
                  payload.updatedAt || now
                );
            }
            break;
          }
          case 'CLOSE_SHIFT': {
            if (operatorEmployee) {
              this.assertStaffPermission(
                operatorEmployee,
                'manageCashShift',
                'Permission requise pour clôturer la caisse.'
              );
            }
            if (payload?.id) {
              this.db
                .prepare(
                  `INSERT INTO cash_shifts (id, account_id, opened_at, status, payload_json) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(account_id, id) DO UPDATE SET status = excluded.status, payload_json = excluded.payload_json`
                )
                .run(
                  String(payload.id),
                  accountId,
                  String(payload.openedAt || now),
                  String(payload.status || 'fermee'),
                  JSON.stringify(payload)
                );
            }
            break;
          }
          default:
            break;
        }

        this.db
          .prepare(
            `INSERT INTO sync_operations_log (account_id, client_op_id, action, entity, entity_id, processed_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            accountId,
            opKey,
            String(op.action || 'UNKNOWN'),
            String(op.entity || ''),
            String(op.entityId || ''),
            now
          );
        processedIds.push(opKey);
      }

      this.db.exec('COMMIT;');
      return {
        processedIds,
        skippedIds,
        workspace: this.getMerchantWorkspace(accountId),
      };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  // =========================================================================
  // ADMINISTRATEUR-ONLY SUBSCRIPTION & ACCOUNT OVERVIEW METHODS
  // =========================================================================

  public getAllPlans() {
    const rows = this.db.prepare('SELECT * FROM plans ORDER BY monthly_price ASC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      monthlyPrice: Number(r.monthly_price),
      annualPrice: Number(r.annual_price),
      badge: r.badge || undefined,
      description: r.description,
      limits: JSON.parse(r.limits_json),
      features: JSON.parse(r.features_json),
      isPopular: Boolean(r.is_popular),
      active: Boolean(r.active),
    }));
  }

  public updatePlan(planId: string, updates: any) {
    const existing = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as any;
    if (!existing) throw new Error('Formule introuvable.');

    const monthlyPrice =
      updates.monthlyPrice !== undefined ? Number(updates.monthlyPrice) : Number(existing.monthly_price);
    const annualPrice =
      updates.annualPrice !== undefined ? Number(updates.annualPrice) : Number(existing.annual_price);
    const limitsJson = updates.limits ? JSON.stringify(updates.limits) : existing.limits_json;
    const featuresJson = updates.features ? JSON.stringify(updates.features) : existing.features_json;

    this.db
      .prepare(
        `UPDATE plans SET monthly_price = ?, annual_price = ?, limits_json = ?, features_json = ? WHERE id = ?`
      )
      .run(monthlyPrice, annualPrice, limitsJson, featuresJson, planId);

    return this.getAllPlans();
  }

  public resetDefaultPlans() {
    const upd = this.db.prepare(
      `UPDATE plans SET name = ?, slug = ?, monthly_price = ?, annual_price = ?, badge = ?, description = ?, limits_json = ?, features_json = ?, is_popular = ?, active = ? WHERE id = ?`
    );
    for (const p of DEFAULT_PLANS) {
      upd.run(
        p.name,
        p.slug,
        p.monthlyPrice,
        p.annualPrice,
        p.badge || null,
        p.description,
        JSON.stringify(p.limits),
        JSON.stringify(p.features),
        p.isPopular ? 1 : 0,
        p.active ? 1 : 0,
        p.id
      );
    }
    return this.getAllPlans();
  }

  public getAdminOverview() {
    const plans = this.getAllPlans();
    const accountRows = this.db
      .prepare('SELECT * FROM accounts ORDER BY created_at DESC')
      .all() as any[];

    const merchantAccounts = accountRows.map((acc) => {
      const org = this.db
        .prepare('SELECT name, phone, email, city FROM organizations WHERE account_id = ?')
        .get(acc.id) as any;
      const sub = this.db
        .prepare('SELECT * FROM subscriptions WHERE account_id = ?')
        .get(acc.id) as any;
      const storesCount = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM stores WHERE account_id = ?').get(acc.id) as any
      ).cnt;
      const productsCount = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM products WHERE account_id = ? AND active = 1').get(acc.id) as any
      ).cnt;
      const invoicesCount = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM invoices WHERE account_id = ?').get(acc.id) as any
      ).cnt;

      const plan = plans.find((p) => p.id === (sub?.plan_id || 'plan-gratuit')) || plans[0];

      return {
        account: this.mapAccountRow(acc),
        organizationName: org?.name || acc.name,
        city: org?.city || 'Dakar',
        storesCount,
        productsCount,
        invoicesCount,
        subscription: sub
          ? {
              id: sub.id,
              accountId: sub.account_id,
              organizationId: `org-${sub.account_id}`,
              planId: sub.plan_id,
              planName: plan.name,
              monthlyPrice: plan.monthlyPrice,
              annualPrice: plan.annualPrice,
              status: sub.status,
              billingCycle: sub.billing_cycle,
              startDate: sub.start_date,
              renewalDate: sub.renewal_date || undefined,
              expiresAt: sub.expires_at || undefined,
              cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
              trialEndsAt: sub.trial_ends_at || undefined,
              isTrial: Boolean(sub.is_trial),
              isComped: Boolean(sub.is_comped),
              paymentMethod: sub.payment_method || 'gratuit',
              lastPaymentDate: sub.last_payment_date || undefined,
              notes: sub.notes || undefined,
              createdAt: sub.created_at,
              updatedAt: sub.updated_at,
            }
          : null,
      };
    });

    const txnRows = this.db
      .prepare('SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 300')
      .all() as any[];

    const paymentTransactions = txnRows.map((t) => ({
      id: t.id,
      subscriptionId: t.subscription_id,
      accountId: t.account_id,
      organizationId: `org-${t.account_id}`,
      planId: t.plan_id,
      planName: t.plan_name,
      amount: Number(t.amount),
      currency: t.currency,
      billingCycle: t.billing_cycle,
      paymentMethod: t.payment_method,
      phoneNumber: t.phone_number || undefined,
      customerName: t.customer_name,
      customerEmail: t.customer_email || undefined,
      reference: t.reference,
      providerTransactionId: t.provider_transaction_id || undefined,
      waveCheckoutUrl: t.wave_checkout_url || undefined,
      webhookVerified: Boolean(t.webhook_verified),
      status: t.status,
      failureReason: t.failure_reason || undefined,
      receiptNumber: t.receipt_number || undefined,
      createdAt: t.created_at,
      confirmedAt: t.confirmed_at || undefined,
    }));

    const eventRows = this.db
      .prepare('SELECT * FROM subscription_events ORDER BY date DESC LIMIT 300')
      .all() as any[];

    const subscriptionEvents = eventRows.map((e) => ({
      id: e.id,
      subscriptionId: e.subscription_id,
      accountId: e.account_id,
      type: e.type,
      description: e.description,
      performedBy: e.performed_by,
      justification: e.justification || undefined,
      date: e.date,
      meta: e.meta_json ? JSON.parse(e.meta_json) : undefined,
    }));

    return {
      plans,
      merchantAccounts,
      paymentTransactions,
      subscriptionEvents,
    };
  }

  public adminUpdateSubscription(
    targetAccountId: string,
    adminName: string,
    updates: {
      planId?: string;
      status?: string;
      billingCycle?: 'mensuel' | 'annuel';
      startDate?: string;
      renewalDate?: string | null;
      expiresAt?: string | null;
      isTrial?: boolean;
      isComped?: boolean;
      justification: string;
      eventType?: string;
    }
  ) {
    const existing = this.db
      .prepare('SELECT * FROM subscriptions WHERE account_id = ?')
      .get(targetAccountId) as any;
    if (!existing) throw new Error('Abonnement introuvable pour ce compte.');

    const now = new Date().toISOString();
    const nextPlanId = updates.planId || existing.plan_id;
    const nextStatus = updates.status || existing.status;
    const nextCycle = updates.billingCycle || existing.billing_cycle;
    const nextStart = updates.startDate || existing.start_date;
    const nextRenewal =
      updates.renewalDate !== undefined ? updates.renewalDate : existing.renewal_date;
    const nextExpires =
      updates.expiresAt !== undefined ? updates.expiresAt : nextRenewal || existing.expires_at;
    const nextTrial = updates.isTrial !== undefined ? (updates.isTrial ? 1 : 0) : existing.is_trial;
    const nextComped = updates.isComped !== undefined ? (updates.isComped ? 1 : 0) : existing.is_comped;

    const planRow = this.db.prepare('SELECT name FROM plans WHERE id = ?').get(nextPlanId) as any;
    const planName = planRow?.name || nextPlanId;

    this.db
      .prepare(
        `UPDATE subscriptions
         SET plan_id = ?, status = ?, billing_cycle = ?, start_date = ?, renewal_date = ?, expires_at = ?, is_trial = ?, is_comped = ?, notes = ?, updated_at = ?
         WHERE account_id = ?`
      )
      .run(
        nextPlanId,
        nextStatus,
        nextCycle,
        nextStart,
        nextRenewal || null,
        nextExpires || null,
        nextTrial,
        nextComped,
        updates.justification,
        now,
        targetAccountId
      );

    this.db
      .prepare(
        `INSERT INTO subscription_events (id, subscription_id, account_id, type, description, performed_by, justification, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        existing.id,
        targetAccountId,
        updates.eventType || 'MANUAL_OVERRIDE',
        `Abonnement mis à jour vers « ${nextStatus} » (${planName} · ${nextCycle}).`,
        adminName,
        updates.justification,
        now
      );
  }

  public adminRecordPayment(
    targetAccountId: string,
    adminName: string,
    payload: {
      planId: string;
      billingCycle: 'mensuel' | 'annuel';
      amount: number;
      paymentMethod: string;
      status: 'succes' | 'en_attente' | 'echec';
      reference?: string;
      phoneNumber?: string;
      receiptNumber?: string;
      webhookVerified?: boolean;
      waveCheckoutUrl?: string;
      providerTransactionId?: string;
    }
  ) {
    const account = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(targetAccountId) as any;
    const sub = this.db.prepare('SELECT * FROM subscriptions WHERE account_id = ?').get(targetAccountId) as any;
    const plan = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(payload.planId) as any;
    if (!account || !sub) throw new Error('Compte ou abonnement introuvable.');

    const now = new Date();
    const nowIso = now.toISOString();
    const ref =
      payload.reference || `SAMA-ADM-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`;
    const txnId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const receipt =
      payload.receiptNumber ||
      (payload.status === 'succes' ? `REC-${Date.now().toString().slice(-6)}` : null);

    this.db
      .prepare(
        `INSERT INTO payment_transactions
         (id, subscription_id, account_id, plan_id, plan_name, amount, currency, billing_cycle, payment_method, phone_number, customer_name, customer_email, reference, provider_transaction_id, wave_checkout_url, webhook_verified, status, receipt_number, created_at, confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?, 'FCFA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        txnId,
        sub.id,
        targetAccountId,
        payload.planId,
        plan?.name || payload.planId,
        Number(payload.amount),
        payload.billingCycle,
        payload.paymentMethod,
        payload.phoneNumber || account.phone || '',
        account.name,
        account.email || '',
        ref,
        payload.providerTransactionId || null,
        payload.waveCheckoutUrl || null,
        payload.webhookVerified ? 1 : 0,
        payload.status,
        receipt,
        nowIso,
        payload.status === 'succes' ? nowIso : null
      );

    if (payload.status === 'succes') {
      const renewal = new Date(now);
      if (payload.billingCycle === 'annuel') renewal.setFullYear(renewal.getFullYear() + 1);
      else renewal.setMonth(renewal.getMonth() + 1);
      const renewalIso = renewal.toISOString();

      this.db
        .prepare(
          `UPDATE subscriptions
           SET plan_id = ?, status = 'actif', billing_cycle = ?, start_date = ?, renewal_date = ?, expires_at = ?, is_trial = 0, is_comped = 0, payment_method = ?, last_payment_date = ?, notes = ?, updated_at = ?
           WHERE account_id = ?`
        )
        .run(
          payload.planId,
          payload.billingCycle,
          nowIso,
          renewalIso,
          renewalIso,
          payload.paymentMethod,
          nowIso,
          `Paiement confirmé (${Number(payload.amount).toLocaleString('fr-FR')} FCFA · Réf ${ref})`,
          nowIso,
          targetAccountId
        );

      this.db
        .prepare(
          `INSERT INTO subscription_events (id, subscription_id, account_id, type, description, performed_by, date)
           VALUES (?, ?, ?, 'PAYMENT_SUCCESS', ?, ?, ?)`
        )
        .run(
          `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sub.id,
          targetAccountId,
          `Paiement de ${Number(payload.amount).toLocaleString('fr-FR')} FCFA confirmé (${plan?.name || payload.planId}). Échéance : ${renewal.toLocaleDateString('fr-FR')}.`,
          adminName,
          nowIso
        );
    }
  }

  public accountExists(accountId: string): boolean {
    if (!accountId) return false;
    return Boolean(this.db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId));
  }

  public getPlanById(planId: string) {
    const row = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as any;
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      monthlyPrice: Number(row.monthly_price),
      annualPrice: Number(row.annual_price),
      limits: JSON.parse(row.limits_json),
      features: JSON.parse(row.features_json),
      active: Boolean(row.active),
    };
  }

  public activateSubscriptionFromWebhook(opts: {
    accountId: string;
    reference: string;
    transactionId?: string | number;
    planId: string;
    billingCycle: 'mensuel' | 'annuel';
    amount: number;
    receiptNumber: string;
  }) {
    if (
      !opts.accountId ||
      !this.db.prepare('SELECT id FROM accounts WHERE id = ?').get(opts.accountId)
    ) {
      throw new Error('Compte SAMA STOCK associé au paiement introuvable.');
    }
    const targetAccId = opts.accountId;

    const existingTxn = this.db
      .prepare('SELECT id FROM payment_transactions WHERE reference = ?')
      .get(opts.reference) as any;

    if (existingTxn) {
      const now = new Date();
      const nowIso = now.toISOString();
      const renewal = new Date(now);
      if (opts.billingCycle === 'annuel') renewal.setFullYear(renewal.getFullYear() + 1);
      else renewal.setMonth(renewal.getMonth() + 1);
      const renewalIso = renewal.toISOString();

      this.db
        .prepare(
          `UPDATE payment_transactions
           SET status = 'succes', webhook_verified = 1, provider_transaction_id = ?, receipt_number = ?, confirmed_at = ?
           WHERE reference = ?`
        )
        .run(
          opts.transactionId ? String(opts.transactionId) : null,
          opts.receiptNumber,
          nowIso,
          opts.reference
        );

      this.db
        .prepare(
          `UPDATE subscriptions
           SET plan_id = ?, status = 'actif', billing_cycle = ?, start_date = ?, renewal_date = ?, expires_at = ?, is_trial = 0, is_comped = 0, payment_method = 'wave', last_payment_date = ?, notes = ?, updated_at = ?
           WHERE account_id = ?`
        )
        .run(
          opts.planId,
          opts.billingCycle,
          nowIso,
          renewalIso,
          renewalIso,
          nowIso,
          `Activé via Webhook UnitechPay (Reçu ${opts.receiptNumber})`,
          nowIso,
          targetAccId
        );
      return;
    }

    this.adminRecordPayment(targetAccId, 'Serveur Webhook UnitechPay', {
      planId: opts.planId,
      billingCycle: opts.billingCycle,
      amount: opts.amount,
      paymentMethod: 'unitechpay_wave',
      status: 'succes',
      reference: opts.reference,
      receiptNumber: opts.receiptNumber,
      webhookVerified: true,
      providerTransactionId: opts.transactionId ? String(opts.transactionId) : undefined,
    });
  }

  public setAccountActiveStatus(targetAccountId: string, active: boolean) {
    const target = this.db.prepare('SELECT role FROM accounts WHERE id = ?').get(targetAccountId) as any;
    if (!target) throw new Error('Compte introuvable.');
    if (target.role === 'administrateur' && !active) {
      throw new Error('Impossible de désactiver le compte administrateur principal.');
    }
    this.db
      .prepare('UPDATE accounts SET active = ?, updated_at = ? WHERE id = ?')
      .run(active ? 1 : 0, new Date().toISOString(), targetAccountId);
    if (!active) {
      this.db.prepare('DELETE FROM sessions WHERE account_id = ?').run(targetAccountId);
    }
  }

  // =========================================================================
  // UNITECHPAY SQLITE PERSISTENCE & ATOMIC IDEMPOTENCY
  // =========================================================================

  public migrateLegacyUnitechStoreIfNeeded(jsonFilePath: string): void {
    const migId = 'unitechpay_sqlite_migration_v1';
    const done = this.db.prepare('SELECT 1 FROM app_migrations WHERE id = ?').get(migId);
    if (done) return;

    try {
      if (fs.existsSync(jsonFilePath)) {
        const raw = fs.readFileSync(jsonFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const now = new Date().toISOString();

        if (parsed?.config && typeof parsed.config === 'object') {
          const rawKey = String(parsed.config.apiKey || '').trim();
          const safeKey = rawKey === 'unitech_sec_live_2026_samastock' ? '' : rawKey;
          this.db
            .prepare(
              `UPDATE unitechpay_config
               SET api_url = ?, api_key = ?, webhook_url = ?, events_json = ?, is_configured = ?, last_configured_at = ?, signature_method = ?, auto_activate = ?, updated_at = ?
               WHERE id = 'default'`
            )
            .run(
              String(parsed.config.apiUrl || 'https://api.unitech.sn/api.php'),
              safeKey,
              String(parsed.config.webhookUrl || ''),
              JSON.stringify(
                Array.isArray(parsed.config.events)
                  ? parsed.config.events
                  : ['payment_completed', 'payment_failed', 'payment_expired']
              ),
              parsed.config.isConfiguredWithUnitech ? 1 : 0,
              parsed.config.lastConfiguredAt || null,
              String(parsed.config.signatureMethod || 'auto'),
              parsed.config.autoActivate === false ? 0 : 1,
              now
            );
        }

        if (Array.isArray(parsed?.orders)) {
          const insOrd = this.db.prepare(
            `INSERT OR IGNORE INTO unitechpay_orders
             (id, reference, local_reference, provider_reference, transaction_id, account_id, status, amount, plan_id, billing_cycle, payload_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          for (const o of parsed.orders) {
            if (!o?.id || !o?.reference) continue;
            insOrd.run(
              String(o.id),
              String(o.reference),
              o.localReference ? String(o.localReference) : null,
              o.providerReference ? String(o.providerReference) : null,
              o.transactionId !== undefined ? String(o.transactionId) : null,
              o.samaStockUserId ? String(o.samaStockUserId) : null,
              String(o.status || 'pending'),
              Number(o.amount || 0),
              String(o.planId || 'plan-pro'),
              String(o.billingCycle || 'mensuel'),
              JSON.stringify(o),
              String(o.dateCreated || now),
              now
            );
          }
        }

        if (Array.isArray(parsed?.webhookLogs)) {
          const insLog = this.db.prepare(
            `INSERT OR IGNORE INTO unitechpay_webhook_logs (id, received_at, event, reference, result_status, payload_json)
             VALUES (?, ?, ?, ?, ?, ?)`
          );
          for (const l of parsed.webhookLogs) {
            if (!l?.id) continue;
            insLog.run(
              String(l.id),
              String(l.receivedAt || now),
              String(l.event || 'unknown'),
              String(l.reference || 'unknown'),
              String(l.resultStatus || 'success'),
              JSON.stringify(l)
            );
          }
        }

        if (Array.isArray(parsed?.processedTransactionIds)) {
          const insEvt = this.db.prepare(
            `INSERT OR IGNORE INTO unitechpay_processed_events (key_type, key_value, reference, transaction_id, processed_at)
             VALUES ('tx_id', ?, NULL, ?, ?)`
          );
          for (const txId of parsed.processedTransactionIds) {
            if (txId) insEvt.run(String(txId), String(txId), now);
          }
        }

        if (Array.isArray(parsed?.processedReferences)) {
          const insRef = this.db.prepare(
            `INSERT OR IGNORE INTO unitechpay_processed_events (key_type, key_value, reference, transaction_id, processed_at)
             VALUES ('ref', ?, ?, NULL, ?)`
          );
          for (const ref of parsed.processedReferences) {
            if (ref) insRef.run(String(ref), String(ref), now);
          }
        }
      }

      this.db
        .prepare('INSERT OR IGNORE INTO app_migrations (id, applied_at) VALUES (?, ?)')
        .run(migId, new Date().toISOString());
    } catch (err) {
      console.warn('[UNITECHPAY] Migration JSON -> SQLite skipped:', err);
    }
  }

  public getUnitechPayConfig() {
    const row = this.db.prepare("SELECT * FROM unitechpay_config WHERE id = 'default'").get() as any;
    if (!row) {
      return {
        apiUrl: process.env.UNITECHPAY_API_URL || 'https://api.unitech.sn/api.php',
        apiKey: '',
        webhookUrl: '',
        events: ['payment_completed', 'payment_failed', 'payment_expired'],
        isConfiguredWithUnitech: false,
        signatureMethod: 'auto' as const,
        autoActivate: true,
      };
    }
    return {
      apiUrl: String(row.api_url || 'https://api.unitech.sn/api.php'),
      apiKey: String(row.api_key || ''),
      webhookUrl: String(row.webhook_url || ''),
      events: row.events_json ? JSON.parse(row.events_json) : ['payment_completed', 'payment_failed', 'payment_expired'],
      isConfiguredWithUnitech: Boolean(row.is_configured),
      lastConfiguredAt: row.last_configured_at || undefined,
      signatureMethod: (row.signature_method || 'auto') as 'auto' | 'raw_body' | 'canonical_pipe',
      autoActivate: Boolean(row.auto_activate),
    };
  }

  public updateUnitechPayConfig(updates: {
    apiUrl?: string;
    apiKey?: string;
    webhookUrl?: string;
    events?: string[];
    isConfiguredWithUnitech?: boolean;
    lastConfiguredAt?: string;
    signatureMethod?: 'auto' | 'raw_body' | 'canonical_pipe';
    autoActivate?: boolean;
  }) {
    const curr = this.getUnitechPayConfig();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE unitechpay_config
         SET api_url = ?, api_key = ?, webhook_url = ?, events_json = ?, is_configured = ?, last_configured_at = ?, signature_method = ?, auto_activate = ?, updated_at = ?
         WHERE id = 'default'`
      )
      .run(
        updates.apiUrl !== undefined ? updates.apiUrl : curr.apiUrl,
        updates.apiKey !== undefined ? updates.apiKey : curr.apiKey,
        updates.webhookUrl !== undefined ? updates.webhookUrl : curr.webhookUrl,
        JSON.stringify(updates.events !== undefined ? updates.events : curr.events),
        (updates.isConfiguredWithUnitech !== undefined ? updates.isConfiguredWithUnitech : curr.isConfiguredWithUnitech) ? 1 : 0,
        updates.lastConfiguredAt !== undefined ? updates.lastConfiguredAt : curr.lastConfiguredAt || null,
        updates.signatureMethod !== undefined ? updates.signatureMethod : curr.signatureMethod,
        (updates.autoActivate !== undefined ? updates.autoActivate : curr.autoActivate) ? 1 : 0,
        now
      );
    return this.getUnitechPayConfig();
  }

  public getUnitechPayOrders(limit = 100): any[] {
    const rows = this.db
      .prepare('SELECT payload_json FROM unitechpay_orders ORDER BY created_at DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => JSON.parse(r.payload_json));
  }

  public saveUnitechPayOrder(order: any): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO unitechpay_orders
         (id, reference, local_reference, provider_reference, transaction_id, account_id, status, amount, plan_id, billing_cycle, payload_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           reference = excluded.reference,
           transaction_id = excluded.transaction_id,
           status = excluded.status,
           payload_json = excluded.payload_json,
           updated_at = excluded.updated_at`
      )
      .run(
        String(order.id),
        String(order.reference),
        order.localReference ? String(order.localReference) : null,
        order.providerReference ? String(order.providerReference) : null,
        order.transactionId !== undefined ? String(order.transactionId) : null,
        order.samaStockUserId ? String(order.samaStockUserId) : null,
        String(order.status || 'pending'),
        Number(order.amount || 0),
        String(order.planId || 'plan-pro'),
        String(order.billingCycle || 'mensuel'),
        JSON.stringify(order),
        String(order.dateCreated || now),
        now
      );
  }

  public findUnitechPayOrderByReference(reference: string): any | null {
    const ref = String(reference || '').trim();
    if (!ref) return null;
    const row = this.db
      .prepare(
        `SELECT payload_json FROM unitechpay_orders
         WHERE reference = ? OR provider_reference = ? OR local_reference = ? OR id = ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(ref, ref, ref, ref) as any;
    return row ? JSON.parse(row.payload_json) : null;
  }

  public getUnitechPayWebhookLogs(limit = 200): any[] {
    const rows = this.db
      .prepare('SELECT payload_json FROM unitechpay_webhook_logs ORDER BY received_at DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => JSON.parse(r.payload_json));
  }

  public appendUnitechPayWebhookLog(log: any): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO unitechpay_webhook_logs (id, received_at, event, reference, result_status, payload_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(log.id),
        String(log.receivedAt || new Date().toISOString()),
        String(log.event || 'unknown'),
        String(log.reference || 'unknown'),
        String(log.resultStatus || 'success'),
        JSON.stringify(log)
      );
  }

  public isUnitechEventProcessed(txId: string, reference: string): boolean {
    if (txId) {
      const hitTx = this.db
        .prepare("SELECT 1 FROM unitechpay_processed_events WHERE key_type = 'tx_id' AND key_value = ?")
        .get(txId);
      if (hitTx) return true;
    }
    if (reference) {
      const hitRef = this.db
        .prepare("SELECT 1 FROM unitechpay_processed_events WHERE key_type = 'ref' AND key_value = ?")
        .get(reference);
      if (hitRef) return true;
    }
    return false;
  }

  public markUnitechEventProcessed(txId: string, reference: string): void {
    const now = new Date().toISOString();
    if (txId) {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO unitechpay_processed_events (key_type, key_value, reference, transaction_id, processed_at)
           VALUES ('tx_id', ?, ?, ?, ?)`
        )
        .run(txId, reference || null, txId, now);
    }
    if (reference) {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO unitechpay_processed_events (key_type, key_value, reference, transaction_id, processed_at)
           VALUES ('ref', ?, ?, ?, ?)`
        )
        .run(reference, reference, txId || null, now);
    }
  }

  public processUnitechCompletedWebhookAtomic(opts: {
    order: any;
    reference: string;
    transactionId?: string | number;
    commission: number;
    netAmount: number;
    receiptNumber: string;
    successLog: any;
  }): { alreadyProcessed: boolean } {
    const strTxId = opts.transactionId !== undefined ? String(opts.transactionId) : '';
    const ref = String(opts.reference || opts.order.reference || '');

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      if (this.isUnitechEventProcessed(strTxId, ref)) {
        this.db.exec('COMMIT;');
        return { alreadyProcessed: true };
      }

      const updatedOrder = {
        ...opts.order,
        status: 'completed',
        transactionId: opts.transactionId,
        commission: opts.commission,
        netAmount: opts.netAmount,
        dateCompleted: new Date().toISOString(),
        receiptNumber: opts.receiptNumber,
        webhookVerified: true,
      };
      this.saveUnitechPayOrder(updatedOrder);
      this.markUnitechEventProcessed(strTxId, ref);
      this.appendUnitechPayWebhookLog(opts.successLog);

      this.activateSubscriptionFromWebhook({
        accountId: String(opts.order.samaStockUserId || ''),
        reference: ref,
        transactionId: opts.transactionId,
        planId: String(opts.order.planId),
        billingCycle: opts.order.billingCycle === 'annuel' ? 'annuel' : 'mensuel',
        amount: Number(opts.order.amount),
        receiptNumber: opts.receiptNumber,
      });

      this.db.exec('COMMIT;');
      return { alreadyProcessed: false };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }
}
