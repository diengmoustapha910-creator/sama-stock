# Préparation du Rate Limiting Partagé sur Redis (Cloud Memorystore)

**Statut** : Préparé pour revue — **Aucune dépendance installée ni bascule exécutée.**

---

## 1. Limites constatées dans l’implémentation actuelle (`server.ts`)

1. **Stockage en mémoire locale (`SlidingWindowRateLimiter`, `server.ts` lignes 40–96)** :
   - Les 6 compteurs (`loginFailLimiter`, `loginIpLimiter`, `registerLimiter`, `changePasswordLimiter`, `pinFailLimiter`, `webhookLimiter`) reposent sur une `Map<string, number[]>` en RAM dans chaque processus Node.js.
   - Sur Cloud Run multi-instances :
     - Un attaquant réparti sur 4 instances obtient `4 × 10 = 40` tentatives de mot de passe avant blocage.
     - Chaque déploiement ou recyclage d’instance remet tous les compteurs à zéro.
2. **Contournement IP par en-tête `X-Forwarded-For` (`getClientIp`, `server.ts` lignes 98–104)** :
   - Même si `app.set('trust proxy', 1)` est configuré ligne 417, `getClientIp(req)` lit manuellement `fwd.split(',')[0].trim()` (l’adresse la plus à gauche).
   - Derrière Cloud Run / Google Front End (GFE), un attaquant peut envoyer `X-Forwarded-For: 1.2.3.4` (changé à chaque requête) et contourner `loginIpLimiter`, `registerLimiter`, `pinFailLimiter` et `webhookLimiter`.
   - **Correction requise avant prod** : remplacer la lecture manuelle du premier élément de `X-Forwarded-For` par `req.ip` (résolu par Express via `trust proxy: 1`).

---

## 2. Conception Redis atomique (Cloud Memorystore)

### Script Lua Sliding Window (atomique, sans condition de concurrence)

```lua
-- KEYS[1] = clé de limitation (ex: "rl:login_ip:196.200.x.x")
-- ARGV[1] = timestamp courant en ms
-- ARGV[2] = fenêtre en ms (ex: 900000 pour 15 min)
-- ARGV[3] = quota max (ex: 40)
-- ARGV[4] = identifiant unique membre (ex: "<now>-<random>")
-- ARGV[5] = mode: "check" | "record"

local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local maxAttempts = tonumber(ARGV[3])
local member = ARGV[4]
local mode = ARGV[5]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)

if count >= maxAttempts then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retrySec = 1
  if oldest[2] then
    retrySec = math.max(1, math.ceil((tonumber(oldest[2]) + window - now) / 1000))
  end
  return { 1, retrySec, count }
end

if mode == 'record' then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  count = count + 1
end

return { 0, 0, count }
```

### Paramètres recommandés pour Cloud Run

- **Service** : Google Cloud Memorystore for Redis (Basic ou Standard HA en `europe-west1`) relié via **Direct VPC Egress** sur le même réseau VPC que Cloud Run.
- **Variable d’environnement** : `REDIS_URL="redis://:<PASSWORD>@<PRIVATE_IP>:6379"` injectée via Secret Manager.
- **Politique de repli contrôlée (`fail-safe`)** :
  - En cas de latence ou coupure brève Redis : basculer temporairement sur `SlidingWindowRateLimiter` local (journalisation alerte) afin de ne pas bloquer toute la caisse POS tout en évitant un passage totalement sans limite.
- **Clés conservées** :
  - `rl:login_fail:<identifiant_compte>` (`5` / 15 min)
  - `rl:login_ip:<req.ip>` (`40` / 15 min)
  - `rl:register:<req.ip>` (`8` / 60 min)
  - `rl:pwd_change:<account_id>` (`5` / 15 min)
  - `rl:pin_fail:<account_id>:<req.ip>` (`5` / 10 min)
  - `rl:wh:<req.ip>` (`60` / 1 min)
