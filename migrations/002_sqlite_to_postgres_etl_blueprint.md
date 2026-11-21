# Plan de Migration Sécurisée — SQLite vers Google Cloud SQL PostgreSQL

**Statut** : Préparé pour revue — **Aucune migration ni provisionnement exécuté.**

---

## 1. Pourquoi la migration est bloquante avant lancement commercial sur Cloud Run

1. **Disque éphémère Cloud Run** :
   - `server.ts` persiste `.data/samastock.db` (`WAL` + `-wal` + `-shm`) sur le système de fichiers local du conteneur (`Dockerfile` ligne 27 : `/app/.data`).
   - Sur Cloud Run, le système de fichiers racine est stocké en mémoire (`tmpfs`) et **effacé intégralement** à chaque redémarrage, mise à l’échelle vers zéro, remplacement de révision ou incident d’instance.
2. **Divergence multi-instances (`split-brain`)** :
   - Dès que Cloud Run démarre `>= 2` instances, chaque conteneur possède son propre `.data/samastock.db` isolé : un commerçant créé sur l’instance A n’existe pas sur l’instance B, et l’idempotence UnitechPay (`unitechpay_processed_events`) ou les quotas mensuels divergent.
   - Le mode `WAL` de SQLite repose sur la mémoire partagée POSIX (`-shm`) et ne doit jamais être partagé via Cloud Storage FUSE.

---

## 2. Architecture cible Cloud Run + Cloud SQL

- **Région recommandée** : `europe-west1` (cohérente avec `.env.example` et la configuration Cloud Run).
- **Instance Cloud SQL PostgreSQL 16** :
  - Private IP / Unix socket Cloud SQL Auth Proxy (`/cloudsql/<PROJECT_ID>:europe-west1:<INSTANCE_NAME>`).
  - Sauvegardes automatiques quotidiennes chiffrées Google-managed / KMS + Point-In-Time Recovery (PITR) activé.
  - Pool de connexions `pg` (`max: 10`, `idleTimeoutMillis: 30000`) adapté au nombre maximal d’instances Cloud Run.
- **Adaptateur `serverDb.ts`** :
  - Extraire une interface asynchrone `DatabaseAdapter` (ou porter les transactions atomiques vers `BEGIN ISOLATION LEVEL SERIALIZABLE` / `SELECT ... FOR UPDATE` côté `pg`) pour :
    - `processUnitechCompletedWebhookAtomic` (`INSERT INTO unitechpay_processed_events ... ON CONFLICT DO NOTHING`)
    - `recordInvoiceQuotaCheck` / `createStoreQuotaCheck` / `createProductQuotaCheck` (verrouillage ligne `subscriptions` via `FOR UPDATE` afin d’empêcher deux requêtes concurrentes de dépasser les limites `5 / 1 / 3` ou `250 / 1 / 50`)
    - `applyMerchantSyncOperation` (`CREATE_SALE` avec décrément de stock atomique).

---

## 3. Procédure de migration sans perte de données (Zero-Downtime / Fenêtre contrôlée)

1. **Snapshot cohérent avant migration** :
   - Exécuter `VACUUM INTO '/tmp/samastock_pre_pg.db'` sur la base SQLite active (garantit un fichier unique incluant toutes les pages du `-wal`).
   - Vérifier `PRAGMA integrity_check;` = `ok` et noter les compteurs par table (`accounts`, `organizations`, `stores`, `products`, `sales`, `invoices`, `plans`, `subscriptions`, `payment_transactions`, `unitechpay_orders`, `unitechpay_processed_events`).
2. **Provisionnement & création du schéma** :
   - Créer l’instance Cloud SQL PostgreSQL et l’utilisateur applicatif `samastock_app` avec mot de passe stocké dans **Secret Manager**.
   - Appliquer `migrations/001_cloudsql_postgres_schema.sql`.
3. **Transfert ETL paramétré** :
   - Lire les 29 tables SQLite en lecture seule (`readonly: true`) dans l’ordre topologique des clés étrangères (`accounts` -> `plans` -> `organizations`, `stores`, `subscriptions`, `employees`, ..., `unitechpay_*`, `app_migrations`).
   - Convertir explicitement :
     - entiers booléens `0/1` -> `BOOLEAN` (`false`/`true`),
     - JSON texte -> `JSONB` validé,
     - champs de date ISO -> `TIMESTAMPTZ`.
   - Ne jamais stocker la clé API UnitechPay en clair si elle est injectée via Secret Manager (`UNITECHPAY_API_KEY`).
4. **Vérification post-ETL (avant bascule trafic)** :
   - Comparer `COUNT(*)` et sommes financières (`payment_transactions.amount`, `sales`, `plans.monthly_price`, `plans.annual_price`, `plans.limits_json`) entre SQLite et PostgreSQL.
   - Vérifier qu’aucun champ `ninea` / `rccm` n’est présent dans les `payload_json`.
   - Tester une connexion admin, une connexion commerçant, une création de facture sous quota et un replay webhook UnitechPay sur la révision Cloud Run reliée à Cloud SQL (`--no-traffic` / tag de prévisualisation).
5. **Bascule & plan de retour arrière (Rollback)** :
   - Basculer 100 % du trafic Cloud Run vers la révision PostgreSQL.
   - Conserver l’archive SQLite chiffrée pendant 30 jours hors ligne en cas d’audit ou de rollback d’urgence.
