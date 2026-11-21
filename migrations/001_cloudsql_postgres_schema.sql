-- ============================================================================
-- SAMA STOCK — Schéma PostgreSQL préparé pour Cloud SQL (europe-west1)
-- ÉTAT : PRÉPARATION UNIQUEMENT — NE PAS EXÉCUTER SANS AUTORISATION EXPLICITE
-- Correspondance exacte avec les 29 tables SQLite de serverDb.ts
-- ============================================================================

BEGIN;

-- 1. Comptes utilisateurs indépendants (administrateur principal + commerçants)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('administrateur', 'commercant')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email_unique
  ON accounts (LOWER(email))
  WHERE email IS NOT NULL AND email <> '';

-- 2. Sessions serveur (stockage du hash SHA-256 du jeton uniquement)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  active_employee_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON sessions (account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- 2b. Jetons de réinitialisation de mot de passe (hash SHA-256 uniquement, 15 min, usage unique)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  request_ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_account ON password_reset_tokens (account_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires ON password_reset_tokens (expires_at);

-- 3. Organisations commerçants (sans champs NINEA / RCCM supprimés)
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
  vat_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 18,
  logo_url TEXT NOT NULL DEFAULT '/assets/aistudio/Logo_SAMA_STOCK__gestion_et_croissance_7ffcabd3.png',
  bank_details TEXT NOT NULL DEFAULT '',
  wave_number TEXT NOT NULL DEFAULT '',
  orange_money_number TEXT NOT NULL DEFAULT '',
  loyalty_settings_json JSONB NOT NULL DEFAULT '{"enabled":true,"amountPerPoint":1000,"pointValueFCFA":25,"minRedeemPoints":10}'::jsonb,
  receipt_footer TEXT NOT NULL DEFAULT 'Merci pour votre confiance ! À bientôt.',
  receipt_show_logo BOOLEAN NOT NULL DEFAULT TRUE,
  receipt_default_width TEXT NOT NULL DEFAULT '80mm',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Préférences utilisateur (boutique active, session de caisse active)
CREATE TABLE IF NOT EXISTS account_preferences (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  active_store_id TEXT NOT NULL DEFAULT '',
  active_shift_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Boutiques (multi-tenant strict par account_id)
CREATE TABLE IF NOT EXISTS stores (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Dakar',
  phone TEXT NOT NULL DEFAULT '',
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);

-- 6. Catégories de produits
CREATE TABLE IF NOT EXISTS categories (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);

-- 7. Produits
CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);
CREATE INDEX IF NOT EXISTS idx_products_account_active ON products (account_id, active);

-- 8. Mouvements de stock
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL,
  PRIMARY KEY (account_id, id)
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_account_date ON stock_movements (account_id, date DESC);

-- 9. Clients
CREATE TABLE IF NOT EXISTS customers (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);

-- 10. Fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);

-- 11. Achats fournisseurs
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);

-- 12. Ventes POS & comptoir
CREATE TABLE IF NOT EXISTS sales (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL,
  PRIMARY KEY (account_id, id)
);
CREATE INDEX IF NOT EXISTS idx_sales_account_date ON sales (account_id, date DESC);

-- 13. Factures
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);
CREATE INDEX IF NOT EXISTS idx_invoices_account_date ON invoices (account_id, date DESC);

-- 14. Dépenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL,
  PRIMARY KEY (account_id, id)
);

-- 15. Sessions d'inventaire
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL,
  PRIMARY KEY (account_id, id)
);

-- 16. Formules d'abonnement (tarifs et quotas protégés)
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  monthly_price INTEGER NOT NULL,
  annual_price INTEGER NOT NULL,
  badge TEXT,
  description TEXT NOT NULL,
  limits_json JSONB NOT NULL,
  features_json JSONB NOT NULL,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 17. Abonnements des comptes commerçants
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  account_id TEXT UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL,
  billing_cycle TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  renewal_date TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  trial_ends_at TIMESTAMPTZ,
  is_trial BOOLEAN NOT NULL DEFAULT FALSE,
  is_comped BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT,
  last_payment_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Transactions de paiement d'abonnements
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
  webhook_verified BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL,
  failure_reason TEXT,
  receipt_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payment_tx_account ON payment_transactions (account_id, created_at DESC);

-- 19. Historique des événements d'abonnements
CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  justification TEXT,
  date TIMESTAMPTZ NOT NULL,
  meta_json JSONB
);

-- 20. Employés & opérateurs POS (PIN haché scrypt)
CREATE TABLE IF NOT EXISTS employees (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  store_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  permissions_json JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);

-- 21. Fermetures / sessions de caisse
CREATE TABLE IF NOT EXISTS cash_shifts (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  PRIMARY KEY (account_id, id)
);

-- 22. Paniers en attente POS
CREATE TABLE IF NOT EXISTS held_sales (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL,
  PRIMARY KEY (account_id, id)
);

-- 23. Journaux d'audit métier par organisation
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL,
  PRIMARY KEY (account_id, id)
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account_date ON audit_logs (account_id, date DESC);

-- 24. Journal d'idempotence de synchronisation hors ligne
CREATE TABLE IF NOT EXISTS sync_operations_log (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_op_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, client_op_id)
);

-- 25. Configuration UnitechPay (clé API recommandée uniquement via Secret Manager)
CREATE TABLE IF NOT EXISTS unitechpay_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  api_url TEXT NOT NULL DEFAULT 'https://api.unitech.sn/api.php',
  api_key TEXT NOT NULL DEFAULT '',
  webhook_url TEXT NOT NULL DEFAULT '',
  events_json JSONB NOT NULL DEFAULT '["payment_completed","payment_failed","payment_expired"]'::jsonb,
  is_configured BOOLEAN NOT NULL DEFAULT FALSE,
  last_configured_at TIMESTAMPTZ,
  signature_method TEXT NOT NULL DEFAULT 'auto',
  auto_activate BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. Commandes UnitechPay pré-enregistrées
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
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_unitechpay_orders_ref ON unitechpay_orders (reference);
CREATE INDEX IF NOT EXISTS idx_unitechpay_orders_local_ref ON unitechpay_orders (local_reference);
CREATE INDEX IF NOT EXISTS idx_unitechpay_orders_provider_ref ON unitechpay_orders (provider_reference);

-- 27. Journaux des webhooks UnitechPay
CREATE TABLE IF NOT EXISTS unitechpay_webhook_logs (
  id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL,
  event TEXT NOT NULL,
  reference TEXT NOT NULL,
  result_status TEXT NOT NULL,
  payload_json JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_unitechpay_logs_received ON unitechpay_webhook_logs (received_at DESC);

-- 28. Verrou d'idempotence atomique des paiements UnitechPay
CREATE TABLE IF NOT EXISTS unitechpay_processed_events (
  key_type TEXT NOT NULL,
  key_value TEXT NOT NULL,
  reference TEXT,
  transaction_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key_type, key_value)
);

-- 29. Registre des migrations applicatives
CREATE TABLE IF NOT EXISTS app_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
