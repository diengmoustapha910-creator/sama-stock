# Guide d’Infrastructure de Production — SAMA STOCK (`europe-west1`)

**État** : Prêt pour exécution — Aucun déploiement automatique effectué.

---

## 1. Architecture & Région retenue (`europe-west1` — Belgique)

- **Cloud Run (`sama-stock`)** : région `europe-west1` (`TZ=Africa/Dakar`).
- **Cloud SQL PostgreSQL** : région `europe-west1` (co-localisé avec Cloud Run, latence SQL < 2 ms).
- **Firebase Hosting (CDN mondial)** : sert le frontend statique (`dist/`) avec compression Brotli/Gzip et transmet `/api/**` + le cookie `HttpOnly` `__session` vers Cloud Run (`europe-west1`).

---

## 2. Configuration DNS & HTTPS (`sama-stock.com`, `www.sama-stock.com`, `app.sama-stock.com`)

### Règle absolue sur les e-mails (À RESPECTER LORS DE LA SAISIE DNS)
- **NE JAMAIS modifier, remplacer ou supprimer** vos enregistrements existants :
  - `MX` (réception des e-mails)
  - `TXT` commençant par `v=spf1...` (SPF)
  - `TXT` / `CNAME` `*_domainkey` (DKIM)
  - `TXT` `_dmarc` (DMARC)
- Lors de l’ajout dans Firebase Hosting, **ajoutez uniquement** les nouveaux enregistrements ci-dessous (si un enregistrement `TXT` existe déjà sur `@` pour SPF, **ajoutez un second enregistrement `TXT` distinct** pour la vérification Firebase sans écraser la ligne SPF).

### Enregistrements à ajouter dans votre registrar DNS (fournis par la console Firebase Hosting → *Ajouter un domaine personnalisé*)

| Hôte / Sous-domaine | Type | Valeur | Rôle |
| :--- | :--- | :--- | :--- |
| `@` (`sama-stock.com`) | `TXT` | `hosting-site=<ID_PROJET>` *(ou jeton fourni par Firebase)* | Vérification de propriété (ne pas toucher au `TXT` SPF existant) |
| `@` (`sama-stock.com`) | `A` | IPv4 fournies par Firebase Hosting (`199.36.158.100` ou IP attribuées) | Routage CDN HTTPS domaine racine |
| `www` (`www.sama-stock.com`) | `A` ou `CNAME` | Cible fournie par Firebase Hosting *(ex. redirection ou site principal)* | Routage `www` en HTTPS |
| `app` (`app.sama-stock.com`) | `A` ou `CNAME` | Cible fournie par Firebase Hosting *(ou CNAME `ghs.googlehosted.com` si mappage Cloud Run direct)* | Accès direct application POS commerçants |

> **Certificats SSL / TLS** : provisionnés et renouvelés automatiquement en HTTPS par Google / Let’s Encrypt après propagation DNS (15 min à quelques heures). Activer la redirection forcée `HTTP -> HTTPS`.

---

## 3. Secrets Google Secret Manager (aucun secret dans le code ou Docker)

Créer les secrets dans le projet GCP (`europe-west1` / réplication automatique) :
1. `UNITECHPAY_API_KEY` : clé API UnitechPay officielle.
2. `CSRF_SECRET` : clé aléatoire 32+ octets (`openssl rand -hex 32`).
3. `SQL_PASSWORD` / `SQL_ADMIN_PASSWORD` : mots de passe Cloud SQL PostgreSQL.
4. `REDIS_URL` *(optionnel si mono-instance au lancement, recommandé dès multi-instances)* : URL Cloud Memorystore.

---

## 4. Déploiement Cloud Run & Firebase Hosting (`europe-west1`)

```bash
# 1. Déploiement Cloud Run (région europe-west1)
gcloud run deploy sama-stock \
  --source . \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances=1 \
  --set-env-vars="NODE_ENV=production,TZ=Africa/Dakar,APP_URL=https://sama-stock.com,UNITECHPAY_WEBHOOK_URL=https://sama-stock.com/api/webhooks/unitechpay,ENABLE_UNITECHPAY_SANDBOX=false" \
  --set-secrets="UNITECHPAY_API_KEY=UNITECHPAY_API_KEY:latest,CSRF_SECRET=CSRF_SECRET:latest"

# 2. Build frontend & déploiement Firebase Hosting CDN
npm run build
firebase deploy --only hosting
```

---

## 5. Bascule Webhook UnitechPay (après activation HTTPS)

1. Vérifier que `https://sama-stock.com/api/health` retourne `{"status":"ok","environment":"production"}` avec cadenas SSL valide.
2. Depuis l’espace Administrateur principal SAMA STOCK (ou directement via l’API UnitechPay), enregistrer l’URL officielle :
   - **`https://sama-stock.com/api/webhooks/unitechpay`**
3. Effectuer un test de paiement Wave réel de validation et vérifier dans les journaux administrateur :
   - Signature HMAC-SHA256 valide (`signatureValid: true`),
   - Activation atomique de l’abonnement uniquement sur `payment_completed` + `completed`,
   - Idempotence respectée en cas de renvoi du webhook (`already_processed`),
   - Conservation des anciens abonnements, comptes, boutiques, produits, ventes et factures.
