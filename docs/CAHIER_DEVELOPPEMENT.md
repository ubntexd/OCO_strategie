# CAHIER DE DÉVELOPPEMENT — BOT DE TRADING AUTOMATISÉ
## ROHAN Innovation — BotTrader v1.0
**Version :** 1.1.0 — Corrigé (13 corrections appliquées)
**Date :** 09 juillet 2026
**Basé sur :** CDC v1.1.0
**Environnement :** Cursor / Claude Code — Architecture multi-agents
**Statut :** En attente — alignement infra validé (voir `RAPPORT_ALIGNEMENT_CDC_CD.md`)

> **Rectifications infra v1.1.1 (10/07/2026) :**
> - VPS : `176.97.70.254` (cohabitation UltiumGrid) — remplace `37.1.209.232`
> - Chemin : `/home/dev/dev/OCO_strategie`
> - Déploiement : **BTC seul → valider → SOL → valider → ETH**
> - Postgres host : port **5435** (conflit 5433 UltiumGrid)
> - N8n : `ultiumgrid_obs-n8n-1` (port 25678) — remplace `rohan_n8n`
> - IP whitelist Binance : `176.97.70.254`

> **Changelog v1.1 CD :**
> - P0-1 : `waitForResult()` définie dans `monitor.js`
> - P0-2 : `waitForFill()` définie dans `order.js`
> - P0-3 : `await` ajouté sur `computeKellyAuto()` dans `bot.js`
> - P0-4 : Handler SIGTERM propre dans `bot.js`
> - P1-5 : `@modelcontextprotocol/sdk` + `zod` ajoutés à `package.json`
> - P1-6 : `dashboard/Dockerfile` et `mcp/Dockerfile` définis
> - P1-7 : Injection SQL `run_query` sécurisée
> - P1-8 : `reset_daily` géré dans `health.js`
> - P1-9 : `pgPool` injecté proprement dans `signal.js`
> - P2-10 : `roundToStep` floating point corrigé
> - P2-11 : `computeKellyFormula` (sync) séparée de `computeKellyAuto` (async)
> - P2-12 : `.gitkeep` dans dossiers logs
> - P2-13 : Autorité CDC v1.1 §17 sur C2 (absence `pendingQuantity`) clarifiée

---

## TABLE DES MATIÈRES

1. Conventions et règles de code
2. Environnement de développement
3. Ordre de développement (séquence stricte)
4. Phase 1 — Fondation
5. Phase 2 — Intelligence
6. Phase 3 — Orchestration
7. Phase 4 — Validation
8. Prompts Cursor par module
9. Tests unitaires et d'intégration
10. Checklist de validation par livrable
11. Règles Git et déploiement

---

## 1. CONVENTIONS ET RÈGLES DE CODE

### 1.1 Langage et style
- **Node.js 22 LTS** — ESM interdit, CommonJS (`require`) uniquement
- **Async/await** partout, jamais de callbacks
- **Pas de `var`** — `const` par défaut, `let` si mutation nécessaire
- **Nommage :** camelCase variables/fonctions, SCREAMING_SNAKE_CASE constantes, PascalCase classes
- **Indentation :** 2 espaces
- **Point-virgule :** toujours présent
- **Longueur de ligne max :** 100 caractères
- **Commentaires :** en français, concis, uniquement si non-évident

### 1.2 Gestion des erreurs
```js
// ✅ Toujours wrapper les appels API dans try/catch
try {
  const result = await binanceClient.placeOrder(payload);
  return result;
} catch (err) {
  logger.error(`[${symbol}] Erreur ordre: ${err.message}`, { payload, stack: err.stack });
  throw err; // re-throw sauf si géré localement
}

// ❌ catch (err) {} — INTERDIT (avaler silencieusement)
```

### 1.3 Variables d'environnement
```js
// ✅ Toujours valider au démarrage dans bot.js
const REQUIRED_ENV = [
  'SYMBOL', 'CAPITAL', 'TP_BRUT', 'SL_BRUT',
  'BINANCE_API_KEY', 'BINANCE_API_SECRET',
  'REDIS_URL', 'POSTGRES_URL',
  'RESTART_SECRET', 'TELEGRAM_BOT_TOKEN',
  'MAX_SLIPPAGE_PCT', 'MAX_POSITION_HOURS',
  'MAX_SPREAD', 'MAX_TRADES_DAY', 'MAX_CONSEC_LOSS', 'MAX_LOSS_DAY'
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Variable manquante : ${key}`);
}
```

### 1.4 Logging
```js
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) =>
      `[${timestamp}] [${SYMBOL}] [${level.toUpperCase()}] ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/bot.log', maxsize: 5242880, maxFiles: 7 })
  ]
});
```

### 1.5 Précision numérique — ✅ CORRIGÉ (P2-10)

```js
// ✅ Correction : toFixed(decimals) appliqué pour éliminer les erreurs floating point
const roundToStep = (value, step) => {
  const decimals = step.toString().split('.')[1]?.length || 0;
  return parseFloat((Math.floor(value / step) * step).toFixed(decimals));
  // Math.floor + toFixed : Binance rejette si arrondi supérieur au filtre LOT_SIZE
};

const roundToTick = (price, tickSize) => {
  const decimals = tickSize.toString().split('.')[1]?.length || 0;
  return parseFloat((Math.round(price / tickSize) * tickSize).toFixed(decimals));
};

// Utilitaire : nombre de décimales d'un step/tick
const getDecimals = (step) => step.toString().split('.')[1]?.length || 0;
```

> **Pourquoi le fix est critique :** Sans `toFixed(decimals)`, `roundToStep(0.57234, 0.00001)`
> retourne `0.5723399999999999` au lieu de `0.57234` — rejet Binance `-1013`.

### 1.6 Pas de magic numbers
```js
// ❌ if (correlation > 0.85)
// ✅
const CORRELATION_BLOCK_THRESHOLD = parseFloat(process.env.CORRELATION_THRESHOLD || '0.85');
```

### 1.7 Kelly — deux fonctions distinctes ✅ CORRIGÉ (P2-11)

```js
// Fonction PURE synchrone — testable unitairement sans dépendances
const computeKellyFormula = (winRate, ratioRR) => {
  const f = (winRate * ratioRR - (1 - winRate)) / ratioRR;
  const halfKelly = f * 0.5;
  return Math.max(0.05, Math.min(halfKelly, 0.20));
};

// Fonction ASYNC — utilise Postgres + Redis, appelée dans bot.js
const computeKellyAuto = async (pgPool, redis, symbol, tpBrut, slBrut) => {
  const total = parseInt(await redis.get('bot:global:total_trades') || '0');
  if (total < 100) return 0.10; // fraction fixe sous 100 trades

  const trades = await pgPool.query(
    `SELECT pnl_net FROM trades WHERE symbol=$1 AND dry_run=false
     ORDER BY created_at DESC LIMIT 100`, [symbol]
  );
  const wins = trades.rows.filter(t => parseFloat(t.pnl_net) > 0).length;
  const winRate = wins / 100;
  const ratioRR = tpBrut / slBrut;
  const fraction = computeKellyFormula(winRate, ratioRR);

  logger.info(`Kelly recalculé: WR=${(winRate * 100).toFixed(1)}% fraction=${fraction.toFixed(3)}`);
  return fraction;
};

module.exports = { computeKellyFormula, computeKellyAuto };
```

---

## 2. ENVIRONNEMENT DE DÉVELOPPEMENT

### 2.1 Prérequis locaux
```bash
node --version   # >= 22.0.0
npm --version    # >= 10.0.0
docker --version # >= 24.0.0
git --version    # >= 2.40.0
```

### 2.2 Installation initiale
```bash
git clone git@github.com:<org>/bot-trading.git
cd bot-trading
npm install
cp .env.example.btc .env.btc
cp .env.example.shared .env.shared
# → Remplir les valeurs réelles
docker compose up -d bot_redis bot_postgres
```

### 2.3 Dépendances npm ✅ CORRIGÉ (P1-5)

```json
{
  "dependencies": {
    "axios": "^1.7.0",
    "winston": "^3.13.0",
    "ioredis": "^5.4.1",
    "pg": "^8.12.0",
    "ws": "^8.18.0",
    "express": "^4.19.0",
    "dotenv": "^16.4.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nock": "^13.5.0",
    "ioredis-mock": "^8.9.0"
  }
}
```

> `crypto` est un module Node.js natif — ne pas l'ajouter aux dépendances.
> `chart.js` est côté frontend (CDN dans le HTML) — inutile dans `package.json`.

### 2.4 Scripts npm
```json
{
  "scripts": {
    "start:btc": "node -r dotenv/config src/bot.js dotenv_config_path=.env.btc",
    "start:eth": "node -r dotenv/config src/bot.js dotenv_config_path=.env.eth",
    "start:sol": "node -r dotenv/config src/bot.js dotenv_config_path=.env.sol",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint src/"
  }
}
```

### 2.5 Structure complète des fichiers ✅ CORRIGÉ (P1-6, P2-12)

```
bot-trading/
├── docker-compose.yml
├── Dockerfile                      # Bot principal (btc/eth/sol)
├── package.json
├── .env.example.btc
├── .env.example.eth
├── .env.example.sol
├── .env.example.shared
├── .gitignore
├── .eslintrc.js
├── src/
│   ├── bot.js
│   ├── signal.js
│   ├── order.js
│   ├── monitor.js
│   ├── protection.js
│   ├── journal.js
│   ├── atr.js
│   ├── regime.js
│   ├── correlation.js
│   ├── kelly.js                    # ← computeKellyFormula + computeKellyAuto
│   └── health.js
├── dashboard/
│   ├── Dockerfile                  # ← AJOUTÉ (P1-6)
│   ├── server.js
│   ├── public/
│   │   ├── index.html
│   │   ├── js/
│   │   │   ├── main.js
│   │   │   ├── charts.js
│   │   │   ├── history.js
│   │   │   ├── backtest.js
│   │   │   └── commands.js
│   │   └── css/style.css
│   └── api/
│       ├── pnl.js
│       ├── trades.js
│       ├── status.js
│       ├── backtest.js
│       └── fronttest.js
├── mcp/
│   ├── Dockerfile                  # ← AJOUTÉ (P1-6)
│   └── server.js
├── db/
│   ├── schema.sql
│   └── migrations/
├── n8n/
│   └── workflows/
│       ├── wf1_health.json
│       ├── wf2_trade_alert.json
│       ├── wf3_stop_global.json
│       ├── wf4_daily_report.json
│       ├── wf5_daily_reset.json
│       └── wf6_config_update.json
├── tests/
│   ├── unit/
│   │   ├── signal.test.js
│   │   ├── order.test.js
│   │   ├── atr.test.js
│   │   ├── regime.test.js
│   │   ├── correlation.test.js
│   │   └── kelly.test.js           # ← teste computeKellyFormula (sync)
│   └── integration/
│       ├── bot.test.js
│       └── monitor.test.js
└── logs/
    ├── btc/
    │   └── .gitkeep                # ← AJOUTÉ (P2-12)
    ├── eth/
    │   └── .gitkeep                # ← AJOUTÉ (P2-12)
    └── sol/
        └── .gitkeep                # ← AJOUTÉ (P2-12)
```

---

## 3. ORDRE DE DÉVELOPPEMENT (SÉQUENCE STRICTE)

```
PHASE 1 — FONDATION
  ├── 1.1  db/schema.sql
  ├── 1.2  Dockerfile + docker-compose.yml (+ dashboard/Dockerfile + mcp/Dockerfile)
  ├── 1.3  src/kelly.js              ← en premier : utilisé par bot.js
  ├── 1.4  src/health.js
  ├── 1.5  src/journal.js
  ├── 1.6  src/atr.js
  ├── 1.7  src/regime.js
  ├── 1.8  src/correlation.js
  ├── 1.9  src/signal.js
  ├── 1.10 src/order.js
  ├── 1.11 src/monitor.js            ← inclut waitForFill + waitForResult
  ├── 1.12 src/protection.js
  └── 1.13 src/bot.js               ← en dernier : orchestre tout

PHASE 2 — INTELLIGENCE
  ├── 2.1  Calibration seuils signal (données DRY_RUN)
  ├── 2.2  ATR multi-timeframe
  ├── 2.3  Corrélation dynamique
  └── 2.4  Kelly recalcul automatique

PHASE 3 — ORCHESTRATION
  ├── 3.1  n8n/workflows/ (6 fichiers JSON)
  ├── 3.2  dashboard/ (9 onglets)
  ├── 3.3  mcp/server.js
  └── 3.4  Backtest engine

PHASE 4 — VALIDATION
  ├── 4.1  DRY_RUN complet
  ├── 4.2  Testnet Binance
  ├── 4.3  Production 10% capital
  └── 4.4  Production complète
```

> **Règle absolue :** Ne jamais passer à l'étape suivante si les tests de l'étape courante
> ne passent pas à 100%.

---

## 4. PHASE 1 — FONDATION

---

### 4.1 `db/schema.sql`

**Commande de création :**
```bash
docker exec -i bot_postgres psql -U bot -d bot_trading < db/schema.sql
```

**Validation :**
```sql
-- Doit retourner 4 tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

**Contenu attendu :** Voir CDC v1.1 §13 — script idempotent (`CREATE TABLE IF NOT EXISTS`),
contraintes `NOT NULL` sur champs critiques, index, commentaires SQL, INSERT de test.

---

### 4.2 `Dockerfile` + `docker-compose.yml` ✅ CORRIGÉ (P1-6)

**Dockerfile principal (bot btc/eth/sol) :**
```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1
CMD ["node", "src/bot.js"]
```

**dashboard/Dockerfile :**
```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY dashboard/ ./dashboard/
COPY src/kelly.js ./src/kelly.js
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3010/health || exit 1
CMD ["node", "dashboard/server.js"]
```

**mcp/Dockerfile :**
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY mcp/ ./mcp/
EXPOSE 5010
CMD ["node", "mcp/server.js"]
```

**docker-compose.yml :**
```yaml
version: '3.9'

networks:
  bot_network:
    driver: bridge

services:
  bot_redis:
    image: redis:7-alpine
    container_name: bot_redis
    ports: ["6380:6379"]
    networks: [bot_network]
    restart: unless-stopped

  bot_postgres:
    image: postgres:16
    container_name: bot_postgres
    environment:
      POSTGRES_DB: bot_trading
      POSTGRES_USER: bot
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports: ["5435:5432"]  # 5433 occupé par UltiumGrid sur 176.97.70.254
    volumes: ["bot_pgdata:/var/lib/postgresql/data"]
    networks: [bot_network]
    restart: unless-stopped

  bot_btc:
    build: .
    container_name: bot_btc
    env_file: [.env.btc, .env.shared]
    networks: [bot_network]
    depends_on: [bot_redis, bot_postgres]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    volumes: ["./logs/btc:/app/logs"]

  bot_eth:
    build: .
    container_name: bot_eth
    env_file: [.env.eth, .env.shared]
    networks: [bot_network]
    depends_on: [bot_redis, bot_postgres]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4002/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    volumes: ["./logs/eth:/app/logs"]

  bot_sol:
    build: .
    container_name: bot_sol
    env_file: [.env.sol, .env.shared]
    networks: [bot_network]
    depends_on: [bot_redis, bot_postgres]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4003/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    volumes: ["./logs/sol:/app/logs"]

  bot_dashboard:
    build:
      context: .
      dockerfile: dashboard/Dockerfile
    container_name: bot_dashboard
    env_file: [.env.shared]
    ports: ["3010:3010"]
    networks: [bot_network]
    depends_on: [bot_redis, bot_postgres]
    restart: unless-stopped

  bot_mcp:
    build:
      context: .
      dockerfile: mcp/Dockerfile
    container_name: bot_mcp
    env_file: [.env.shared]
    ports: ["5010:5010"]
    networks: [bot_network]
    depends_on: [bot_redis, bot_postgres]
    restart: unless-stopped

volumes:
  bot_pgdata:
```

---

### 4.3 `src/kelly.js` ✅ NOUVEAU MODULE (P2-11)

```js
// src/kelly.js
// Séparation volontaire : pure (testable) vs async (Postgres)

const { Pool } = require('pg');

/**
 * Formule Kelly pure — synchrone, aucune dépendance externe.
 * Utilisée dans les tests unitaires et comme sous-fonction de computeKellyAuto.
 *
 * @param {number} winRate - Taux de gains [0, 1]
 * @param {number} ratioRR - Ratio Risk/Reward (TP_BRUT / SL_BRUT)
 * @returns {number} - Fraction Kelly clampée entre 5% et 20%
 */
const computeKellyFormula = (winRate, ratioRR) => {
  const f = (winRate * ratioRR - (1 - winRate)) / ratioRR;
  const halfKelly = f * 0.5;
  return Math.max(0.05, Math.min(halfKelly, 0.20));
};

/**
 * Calcul Kelly automatique — async, lit Postgres et Redis.
 * Retourne 0.10 (fixe) si moins de 100 trades réels disponibles.
 *
 * @param {Pool} pgPool - Connexion PostgreSQL
 * @param {object} redis - Client Redis
 * @param {string} symbol - Paire (ex: 'BTCUSDT')
 * @param {number} tpBrut - TP brut en USDT
 * @param {number} slBrut - SL brut en USDT
 * @returns {Promise<number>} - Fraction Kelly clampée
 */
const computeKellyAuto = async (pgPool, redis, symbol, tpBrut, slBrut) => {
  const KELLY_MIN_TRADES = 100;
  const total = parseInt(await redis.get('bot:global:total_trades') || '0');

  if (total < KELLY_MIN_TRADES) {
    return 0.10; // fraction fixe conservative sous 100 trades
  }

  const result = await pgPool.query(
    `SELECT pnl_net FROM trades
     WHERE symbol = $1 AND dry_run = false
     ORDER BY created_at DESC LIMIT 100`,
    [symbol]
  );

  const wins = result.rows.filter(t => parseFloat(t.pnl_net) > 0).length;
  const winRate = wins / 100;
  const ratioRR = tpBrut / slBrut;
  const fraction = computeKellyFormula(winRate, ratioRR);

  return fraction;
};

module.exports = { computeKellyFormula, computeKellyAuto };
```

---

### 4.4 `src/health.js` ✅ CORRIGÉ (P1-8)

**Interface :**
```
GET  /health    → 200 { status, uptime, symbol, lastTradeAt, version }
GET  /status    → 200 { pnl_day, trades_day, open_orders, consec_loss, regime, dry_run, kelly_fraction }
POST /stop      → 200 { status:'stopping' }
POST /config    → 200 { status:'applied', key, value }
POST /restart   → 200 { status:'restarting' }  — auth x-restart-token requis
```

**Endpoint `/restart` sécurisé :**
```js
app.post('/restart', (req, res) => {
  const token = req.headers['x-restart-token'];
  if (token !== process.env.RESTART_SECRET) {
    logger.warn(`/restart refusé — token invalide (IP: ${req.ip})`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  logger.info('/restart déclenché — process.exit(1) dans 500ms');
  res.json({ status: 'restarting' });
  setTimeout(() => process.exit(1), 500); // Docker restart: unless-stopped
});
```

**Endpoint `/config` avec `reset_daily` ✅ CORRIGÉ (P1-8) :**
```js
app.post('/config', async (req, res) => {
  const token = req.headers['x-bot-token'];
  if (token !== process.env.RESTART_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { key, value } = req.body;

  // Commande spéciale reset_daily — réinitialisations de fin de journée
  if (key === 'reset_daily') {
    const symbol = process.env.SYMBOL.toLowerCase();
    await redis.del(`bot:${symbol}:daily_loss_locked`);
    await redis.del(`bot:global:stop`);
    await redis.set(`bot:${symbol}:consec_loss`, '0');
    await redis.set(`bot:${symbol}:trades_day`, '0');
    logger.info(`[${process.env.SYMBOL}] reset_daily appliqué`);
    return res.json({ status: 'applied', key: 'reset_daily' });
  }

  // Config à chaud via Redis pub/sub (autres paramètres)
  const channel = `bot:${process.env.SYMBOL.toLowerCase()}:config`;
  await redis.publish(channel, `${key}:${value}`);
  logger.info(`Config publiée: ${key}=${value}`);
  res.json({ status: 'applied', key, value });
});
```

**Toutes les routes :** logger chaque appel avec IP + heure. Timeout 5s.

---

### 4.5 `src/journal.js`

**Interface attendue :**
```js
module.exports = {
  logTradeOpen,
  logTradeFill,
  logTradeClose,
  logEvent,
  logDryRun,
  logSlippageAbort,
  logForcedExit,
  getDayPnl,
  getConsecLoss,
  getTotalTrades,
  getProfitFactor,
};
```

**Compteur Phase 2 (seuil 1500) :**
```js
const logTradeClose = async (pgPool, redis, symbol, tradeId, closeData) => {
  // UPDATE trades SET exit_price=..., result=..., pnl_net=... WHERE id=$1
  await pgPool.query(
    `UPDATE trades SET exit_price=$1, exit_time=NOW(), duration_min=$2,
     pnl_brut=$3, fees=$4, pnl_net=$5, result=$6
     WHERE id=$7`,
    [closeData.exitPrice, closeData.durationMin, closeData.pnlBrut,
     closeData.fees, closeData.pnlNet, closeData.result, tradeId]
  );

  const total = await redis.incr('bot:global:total_trades');
  if (total === 1500) {
    await notifyTelegram('🧠 Seuil 1500 trades atteint — entraînement XGBoost Phase 2 possible');
  }
};
```

**`getDayPnl` — utilisé par `signal.js` et `protection.js` :**
```js
const getDayPnl = async (pgPool, symbol) => {
  const result = await pgPool.query(
    `SELECT COALESCE(SUM(pnl_net), 0) as total
     FROM trades
     WHERE symbol = $1
     AND entry_time >= CURRENT_DATE
     AND dry_run = false
     AND result IN ('TP', 'SL', 'FORCED_EXIT', 'SLIPPAGE_ABORT')`,
    [symbol]
  );
  return parseFloat(result.rows[0].total);
};
```

---

### 4.6 `src/atr.js`

**Interface :**
```js
module.exports = { getATR };
// getATR(symbol, redis, axiosInstance) → { atr: number, cached: boolean }
```

**Logique :**
1. Vérifier cache Redis `atr:{symbol}` (TTL 5 min)
2. Si miss → GET `/api/v3/klines?symbol=X&interval=5m&limit=15`
3. Calculer 14 True Range : `TR = max(H-L, |H-Cprev|, |L-Cprev|)`
4. ATR = moyenne des 14 TR
5. Stocker Redis TTL 300s
6. Retourner `{ atr, cached }`

---

### 4.7 `src/regime.js`

**Interface :**
```js
module.exports = { getRegime, checkTrendDown };
// getRegime(symbol, redis, axiosInstance) → 'TREND_UP'|'TREND_DOWN'|'VOLATILE'|'RANGE'
// checkTrendDown(symbol, regime, redis) → { alert48h: boolean, alert96h: boolean }
```

**Logique régime :**
```
EMA5  sur 5 clôtures 5min
EMA20 sur 20 clôtures 5min
ATRmoy20j = cache Redis 24h

Si EMA5 > EMA20 × 1.002 → TREND_UP
Si EMA5 < EMA20 × 0.998 → TREND_DOWN
Si ATR > ATRmoy20j × 1.8 → VOLATILE
Sinon → RANGE
```

**Suivi TREND_DOWN :**
```js
const checkTrendDown = async (symbol, regime, redis) => {
  const key = `bot:${symbol.toLowerCase()}:trend_down_since`;

  if (regime !== 'TREND_DOWN') {
    await redis.del(key);
    await redis.del(`bot:${symbol.toLowerCase()}:trend_down_alert`);
    return { alert48h: false, alert96h: false };
  }

  const since = await redis.get(key);
  if (!since) {
    await redis.set(key, Date.now().toString());
    return { alert48h: false, alert96h: false };
  }

  const hoursDown = (Date.now() - parseInt(since)) / 3600000;
  const alert48h = hoursDown >= 48;
  const alert96h = hoursDown >= 96;

  if (alert48h) {
    await notifyTelegram(
      `⚠️ [${symbol}] TREND_DOWN depuis ${Math.round(hoursDown)}h — vérification recommandée`
    );
  }
  if (alert96h) {
    await redis.set(`bot:${symbol.toLowerCase()}:trend_down_alert`, '1');
  }

  return { alert48h, alert96h };
};
```

---

### 4.8 `src/correlation.js`

**Interface :**
```js
module.exports = { getPairCorrelation, shouldBlockOnCorrelation };
```

```js
const getPairCorrelation = async (symbolA, symbolB, n = 20, redis) => {
  const pricesA = await redis.lrange(`closes:${symbolA}`, 0, n - 1);
  const pricesB = await redis.lrange(`closes:${symbolB}`, 0, n - 1);
  if (pricesA.length < n || pricesB.length < n) return null;

  const a = pricesA.map(Number);
  const b = pricesB.map(Number);
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;
  const num = a.reduce((s, x, i) => s + (x - meanA) * (b[i] - meanB), 0);
  const denA = Math.sqrt(a.reduce((s, x) => s + (x - meanA) ** 2, 0));
  const denB = Math.sqrt(b.reduce((s, x) => s + (x - meanB) ** 2, 0));

  if (denA === 0 || denB === 0) return null;
  return num / (denA * denB);
};

const CORRELATION_BLOCK_THRESHOLD = parseFloat(
  process.env.CORRELATION_THRESHOLD || '0.85'
);

const PAIR_CORRELATIONS = {
  'BTCUSDT': ['ETHUSDT'],
  'ETHUSDT': ['BTCUSDT', 'SOLUSDT'],
  'SOLUSDT': ['ETHUSDT'],
};

const shouldBlockOnCorrelation = async (symbol, redis) => {
  for (const other of PAIR_CORRELATIONS[symbol] || []) {
    const corr = await getPairCorrelation(symbol, other, 20, redis);
    if (corr === null) continue;
    if (corr > CORRELATION_BLOCK_THRESHOLD) {
      const otherOpen = await redis.get(`bot:${other.toLowerCase()}:position_open`);
      if (otherOpen === '1') {
        logger.warn(`[${symbol}] Corrélation ${symbol}/${other}=${corr.toFixed(2)} > ${CORRELATION_BLOCK_THRESHOLD} — bloqué`);
        return true;
      }
    }
  }
  return false;
};
```

---

### 4.9 `src/signal.js` ✅ CORRIGÉ (P1-9)

**Interface :**
```js
module.exports = { evaluateSignal };
// evaluateSignal(symbol, redis, binanceClient, pgPool) → { ok: boolean, reason: string|null }
```

> **Correction P1-9 :** `pgPool` est passé en paramètre explicite — `signal.js` n'importe pas
> de singleton global. Cela permet le mock dans les tests Jest.

**Séquence des filtres :**
```js
const evaluateSignal = async (symbol, redis, binanceClient, pgPool) => {
  const MAX_SPREAD = parseFloat(process.env.MAX_SPREAD);
  const MAX_TRADES_DAY = parseInt(process.env.MAX_TRADES_DAY);
  const MAX_CONSEC_LOSS = parseInt(process.env.MAX_CONSEC_LOSS);
  const MAX_LOSS_DAY = parseFloat(process.env.MAX_LOSS_DAY);

  // 1. Heure trading
  if (!isWithinTradingHours()) return { ok: false, reason: 'TRADING_HOURS' };

  // 2. Verrous Redis
  if (await redis.get('bot:global:stop') === '1')
    return { ok: false, reason: 'GLOBAL_STOP' };
  if (await redis.get(`bot:${symbol.toLowerCase()}:daily_loss_locked`) === '1')
    return { ok: false, reason: 'DAILY_LOSS_LOCKED' };

  // 3. Pertes consécutives
  const consecLoss = parseInt(await redis.get(`bot:${symbol.toLowerCase()}:consec_loss`) || '0');
  if (consecLoss >= MAX_CONSEC_LOSS)
    return { ok: false, reason: 'MAX_CONSEC_LOSS' };

  // 4. Trades jour
  const tradesDay = parseInt(await redis.get(`bot:${symbol.toLowerCase()}:trades_day`) || '0');
  if (tradesDay >= MAX_TRADES_DAY)
    return { ok: false, reason: 'MAX_TRADES_DAY' };

  // 5. PnL jour — pgPool injecté en paramètre
  const dayPnl = await journal.getDayPnl(pgPool, symbol);
  if (dayPnl <= -MAX_LOSS_DAY)
    return { ok: false, reason: 'MAX_LOSS_DAY' };

  // 6. Spread
  const bid = parseFloat(await redis.get(`bid:${symbol}`));
  const ask = parseFloat(await redis.get(`ask:${symbol}`));
  const spread = ask - bid;
  if (spread > MAX_SPREAD) {
    logger.warn(`[${symbol}] Spread trop élevé: ${spread.toFixed(4)} > ${MAX_SPREAD}`);
    return { ok: false, reason: 'SPREAD_TOO_HIGH' };
  }

  // 7. Volume relatif [0.8, 4.0]
  const relVol = await getRelativeVolume(symbol, redis);
  if (relVol < 0.8) return { ok: false, reason: 'VOLUME_TOO_LOW' };
  if (relVol > 4.0) return { ok: false, reason: 'VOLUME_SPIKE' };

  // 8. ATR dans plage acceptable
  const { atr } = await atrModule.getATR(symbol, redis, binanceClient);
  const atrAvg = parseFloat(await redis.get(`atr_avg:${symbol}`) || '0');
  if (atrAvg > 0) {
    if (atr < atrAvg * 0.5) return { ok: false, reason: 'ATR_TOO_LOW' };
    if (atr > atrAvg * 3.0) return { ok: false, reason: 'ATR_TOO_HIGH' };
  }

  // 9. Cascade liquidations
  if (await redis.get(`liq:${symbol}`) === '1')
    return { ok: false, reason: 'LIQUIDATION_CASCADE' };

  // 10. Régime
  const regime = await regimeModule.getRegime(symbol, redis, binanceClient);
  if (regime === 'TREND_DOWN')
    return { ok: false, reason: 'TREND_DOWN' };
  if (regime === 'VOLATILE' && symbol === 'SOLUSDT')
    return { ok: false, reason: 'VOLATILE_SOL' };

  // 11. Corrélation
  if (await correlation.shouldBlockOnCorrelation(symbol, redis))
    return { ok: false, reason: 'CORRELATION_BLOCK' };

  // 12. Momentum EMA
  const closes = (await redis.lrange(`closes:${symbol}`, 0, 19)).map(Number);
  if (closes.length >= 20) {
    const ema5  = computeEMA(closes.slice(0, 5), 5);
    const ema20 = computeEMA(closes, 20);
    if (ema5 < ema20 * 0.998)
      return { ok: false, reason: 'MOMENTUM_BEARISH' };
  }

  return { ok: true, reason: null };
};
```

---

### 4.10 `src/order.js` ✅ CORRIGÉ (P0-2)

**Interface :**
```js
module.exports = {
  getExchangeFilters,
  placeEntry,
  placeOPOCO,
  placeOCO,
  cancelOrder,
  cancelAllOrders,
  getOpenOrders,
  placeMarketSell,
  waitForFill,          // ← AJOUTÉ (P0-2)
};
```

**`waitForFill` — définie ici, alimentée par `monitor.js` via Redis ✅ CORRIGÉ (P0-2) :**
```js
/**
 * Attend le fill d'un ordre d'entrée via Redis (alimenté par User Data Stream).
 * monitor.js publie dans Redis fill:{orderId} à la réception de executionReport FILLED.
 *
 * @param {string|number} orderId
 * @param {object} redis
 * @param {number} timeoutMs - Délai max en ms (ENTRY_TIMEOUT × 1000)
 * @returns {Promise<object|null>} - Données du fill ou null si timeout
 */
const waitForFill = async (orderId, redis, timeoutMs) => {
  const key = `fill:${orderId}`;
  const start = Date.now();
  const POLL_INTERVAL = 200; // ms

  while (Date.now() - start < timeoutMs) {
    const data = await redis.get(key);
    if (data) {
      await redis.del(key);
      return JSON.parse(data);
    }
    await sleep(POLL_INTERVAL);
  }
  return null; // timeout
};
```

**`placeEntry` avec waitForFill intégré :**
```js
const placeEntry = async (symbol, qty, entryPrice, filters, redis) => {
  if (process.env.DRY_RUN === 'true') {
    logger.info(`[DRY_RUN] Signal BUY ${symbol} @ ${entryPrice}`);
    await journal.logDryRun(symbol, entryPrice, qty);
    return { simulated: true };
  }

  const qtyRounded   = roundToStep(qty, filters.stepSize);
  const priceRounded = roundToTick(entryPrice, filters.tickSize);

  const order = await postSignedRequest('/api/v3/order', {
    symbol, side: 'BUY', type: 'LIMIT_MAKER',
    quantity: qtyRounded.toFixed(getDecimals(filters.stepSize)),
    price: priceRounded.toFixed(getDecimals(filters.tickSize)),
    newOrderRespType: 'RESULT',
  });

  const ENTRY_TIMEOUT = parseInt(process.env.ENTRY_TIMEOUT || '45');
  const filled = await waitForFill(order.orderId, redis, ENTRY_TIMEOUT * 1000);

  if (!filled) {
    logger.warn(`[${symbol}] LIMIT_MAKER non fillé après ${ENTRY_TIMEOUT}s — fallback MARKET`);
    await cancelOrder(symbol, order.orderId);

    const marketOrder = await postSignedRequest('/api/v3/order', {
      symbol, side: 'BUY', type: 'MARKET',
      quantity: qtyRounded.toFixed(getDecimals(filters.stepSize)),
    });

    const fillPrice = parseFloat(marketOrder.fills[0].price);
    const slippage  = Math.abs((fillPrice - priceRounded) / priceRounded) * 100;
    logger.warn(`[${symbol}] Fallback MARKET — slippage: ${slippage.toFixed(3)}%`);

    const MAX_SLIPPAGE = parseFloat(process.env.MAX_SLIPPAGE_PCT);
    if (slippage > MAX_SLIPPAGE) {
      logger.error(`[${symbol}] Slippage excessif (${slippage.toFixed(2)}%) — sortie immédiate`);
      await placeMarketSell(symbol, qtyRounded);
      await journal.logSlippageAbort(symbol, fillPrice, priceRounded, slippage);
      return null;
    }

    return {
      orderId: marketOrder.orderId,
      fillPrice,
      quantity: qtyRounded,
      mode: 'MARKET',
      slippage,
    };
  }

  return {
    orderId: order.orderId,
    fillPrice: parseFloat(filled.price),
    quantity: parseFloat(filled.quantity),
    mode: 'LIMIT_MAKER',
    slippage: 0,
  };
};
```

**Structure OPOCO — règle d'autorité CDC v1.1 §17 ✅ CORRIGÉ (P2-13) :**

> **Référence absolue : CDC v1.1 §17 C2.** `pendingQuantity` est ABSENT dans OPOCO.
> C'est la différence fondamentale avec OTOCO. Binance calcule automatiquement la quantité
> des ordres pending à partir des fonds réellement reçus après fill du working order.
> Ne PAS ajouter `pendingQuantity` même si un prompt antérieur le suggérait.

```js
const placeOPOCO = async (symbol, qty, entryFillPrice, tpPrice, slPrice, filters) => {
  const tickDec = getDecimals(filters.tickSize);
  const stepDec = getDecimals(filters.stepSize);

  const payload = {
    symbol,
    workingType: 'LIMIT_MAKER',          // entrée maker, frais 0%
    workingSide: 'BUY',
    workingPrice: roundToTick(entryFillPrice, filters.tickSize).toFixed(tickDec),
    workingQuantity: qty.toFixed(stepDec),
    workingTimeInForce: 'GTC',
    pendingSide: 'SELL',
    // ⚠️ pendingQuantity ABSENT — calculé par Binance après fill (spec OPOCO)
    pendingAboveType: 'LIMIT',            // TP en LIMIT GTC (pas LIMIT_MAKER)
    pendingAbovePrice: roundToTick(tpPrice, filters.tickSize).toFixed(tickDec),
    pendingAboveTimeInForce: 'GTC',       // obligatoire avec LIMIT
    pendingBelowType: 'STOP_LOSS',        // SL
    pendingBelowStopPrice: roundToTick(slPrice, filters.tickSize).toFixed(tickDec),
    newOrderRespType: 'RESULT',
  };

  return await postSignedRequest('/api/v3/orderList/opoco', payload);
};
```

---

### 4.11 `src/monitor.js` ✅ CORRIGÉ (P0-1)

**Interface :**
```js
module.exports = {
  startMonitor,
  stopMonitor,
  waitForResult,    // ← AJOUTÉ (P0-1)
};
```

**`waitForResult` — définie ici ✅ CORRIGÉ (P0-1) :**
```js
/**
 * Attend le résultat d'un ordre OPOCO/OCO (TP ou SL).
 * monitor.js publie dans Redis result:{orderListId} à la réception
 * de executionReport avec status FILLED sur l'un des pending orders.
 *
 * @param {string|number} orderListId
 * @param {object} redis
 * @param {number} timeoutMs - Max 24h par défaut (position fermée par protection avant)
 * @returns {Promise<object>} - { result: 'TP'|'SL', exitPrice, quantity, fees }
 */
const waitForResult = async (orderListId, redis, timeoutMs = 86400000) => {
  const key = `result:${orderListId}`;
  const start = Date.now();
  const POLL_INTERVAL = 500;

  while (Date.now() - start < timeoutMs) {
    const data = await redis.get(key);
    if (data) {
      await redis.del(key);
      return JSON.parse(data);
    }
    await sleep(POLL_INTERVAL);
  }

  // Timeout (ne devrait pas arriver si protection.checkPositionTimeout fonctionne)
  throw new Error(`waitForResult timeout orderListId=${orderListId}`);
};
```

**Traitement `executionReport` dans le User Data Stream :**
```js
const handleExecutionReport = async (report, redis) => {
  const { orderId, orderListId, status, side, price, executedQty, commission } = report;

  // Fill d'un ordre d'entrée individuel (LIMIT_MAKER)
  if (status === 'FILLED' && orderListId === -1) {
    await redis.setex(`fill:${orderId}`, 120, JSON.stringify({
      orderId, price, quantity: executedQty, commission,
    }));
    return;
  }

  // Fill d'un pending order dans un OPOCO/OCO → TP ou SL atteint
  if (status === 'FILLED' && orderListId !== -1 && side === 'SELL') {
    const type = parseFloat(price) > 0 ? 'TP' : 'SL';
    // En pratique : comparer price avec les niveaux stockés en Redis
    const tpPrice = parseFloat(await redis.get(`tp:${orderListId}`));
    const result  = parseFloat(price) >= tpPrice ? 'TP' : 'SL';

    await redis.setex(`result:${orderListId}`, 300, JSON.stringify({
      result,
      exitPrice: parseFloat(price),
      quantity: parseFloat(executedQty),
      fees: parseFloat(commission),
    }));
  }
};
```

**Keepalive listenKey 20 minutes (C4) :**
```js
setInterval(() => keepAliveListenKey(listenKey), 20 * 60 * 1000); // 20 min
```

**Alimentation Redis closes pour corrélation :**
```js
if (kline.x === true) {
  await redis.lpush(`closes:${symbol}`, parseFloat(kline.c));
  await redis.ltrim(`closes:${symbol}`, 0, 49);
}
```

**Reconnexion avec backoff exponentiel :**
```js
const connectWithRetry = async (url, onMessage, symbol, maxRetries = 5) => {
  let attempt = 0;
  const connect = async () => {
    const ws = new WebSocket(url);
    ws.on('message', onMessage);
    ws.on('close', async () => {
      if (attempt >= maxRetries) {
        logger.error(`[${symbol}] WS non récupérable après ${maxRetries} tentatives`);
        await notifyTelegram(`⛔ [${symbol}] WebSocket irrécupérable — intervention requise`);
        return;
      }
      attempt++;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      logger.warn(`[${symbol}] WS déconnecté — retry ${attempt}/${maxRetries} dans ${delay}ms`);
      await sleep(delay);
      await connect();
    });
    ws.on('error', (err) => logger.error(`[${symbol}] WS erreur: ${err.message}`));
  };
  await connect();
};
```

---

### 4.12 `src/protection.js`

**Interface :**
```js
module.exports = {
  checkAndLock,
  isGloballyLocked,
  isPairLocked,
  checkPositionTimeout,
  resetDailyLocks,
};
```

**`checkAndLock` (après chaque SL) :**
```js
const checkAndLock = async (symbol, redis, pgPool) => {
  const sym = symbol.toLowerCase();

  // Incrémenter pertes consécutives
  const consec = await redis.incr(`bot:${sym}:consec_loss`);
  if (consec >= parseInt(process.env.MAX_CONSEC_LOSS)) {
    await redis.set(`bot:${sym}:daily_loss_locked`, '1');
    logger.warn(`[${symbol}] ${consec} pertes consécutives — paire lockée`);
    await notifyTelegram(`⚠️ [${symbol}] ${consec} pertes consécutives — bot stoppé`);
  }

  // PnL journalier
  const dayPnl = await journal.getDayPnl(pgPool, symbol);
  const MAX_LOSS_DAY = parseFloat(process.env.MAX_LOSS_DAY);
  if (dayPnl <= -MAX_LOSS_DAY) {
    await redis.set(`bot:${sym}:daily_loss_locked`, '1');
    logger.warn(`[${symbol}] Perte jour ${dayPnl.toFixed(2)} USDT — paire lockée`);
    await notifyTelegram(`⚠️ [${symbol}] Perte journalière max atteinte — bot stoppé`);
  }

  // Stop global — somme des 3 paires
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  let totalPnl = 0;
  for (const s of symbols) {
    totalPnl += await journal.getDayPnl(pgPool, s);
  }
  if (totalPnl <= -120) {
    await redis.set('bot:global:stop', '1');
    logger.error(`STOP GLOBAL — Perte totale ${totalPnl.toFixed(2)} USDT`);
    await notifyTelegram(`⛔ STOP GLOBAL — Perte totale: ${totalPnl.toFixed(2)} USDT`);
  }
};
```

**`checkPositionTimeout` (appelé à chaque cycle de boucle) :**
```js
const checkPositionTimeout = async (symbol, redis, orderManager) => {
  const openSince = await redis.get(`bot:${symbol.toLowerCase()}:position_open_since`);
  if (!openSince) return;

  const MAX_POSITION_HOURS = parseFloat(process.env.MAX_POSITION_HOURS || '4');
  const hoursOpen = (Date.now() - parseInt(openSince)) / 3600000;

  if (hoursOpen > MAX_POSITION_HOURS) {
    logger.warn(`[${symbol}] Position ouverte depuis ${hoursOpen.toFixed(1)}h — fermeture forcée`);
    const qty = await redis.get(`bot:${symbol.toLowerCase()}:position_qty`);
    await orderManager.placeMarketSell(symbol, parseFloat(qty));
    await journal.logForcedExit(symbol, 'MAX_POSITION_TIME');
    await redis.del(`bot:${symbol.toLowerCase()}:position_open`);
    await redis.del(`bot:${symbol.toLowerCase()}:position_open_since`);
    await redis.del(`bot:${symbol.toLowerCase()}:position_qty`);
  }
};
```

---

### 4.13 `src/bot.js` ✅ CORRIGÉ (P0-3, P0-4)

```js
'use strict';
require('dotenv').config();

const Redis = require('ioredis');
const { Pool } = require('pg');
const winston = require('winston');

const order      = require('./order');
const monitor    = require('./monitor');
const signal     = require('./signal');
const protection = require('./protection');
const journal    = require('./journal');
const atr        = require('./atr');
const health     = require('./health');
const { computeKellyAuto } = require('./kelly');
const { notifyTelegram, notifyN8n } = require('./notify');

// ── Validation env vars ──────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'SYMBOL', 'CAPITAL', 'TP_BRUT', 'SL_BRUT',
  'BINANCE_API_KEY', 'BINANCE_API_SECRET',
  'REDIS_URL', 'POSTGRES_URL',
  'RESTART_SECRET', 'TELEGRAM_BOT_TOKEN',
  'MAX_SLIPPAGE_PCT', 'MAX_POSITION_HOURS',
  'MAX_SPREAD', 'MAX_TRADES_DAY', 'MAX_CONSEC_LOSS', 'MAX_LOSS_DAY',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Variable manquante : ${key}`);
}

const SYMBOL         = process.env.SYMBOL;
const CAPITAL        = parseFloat(process.env.CAPITAL);
const TP_BRUT        = parseFloat(process.env.TP_BRUT);
const SL_BRUT        = parseFloat(process.env.SL_BRUT);
const ATR_TP_MULT    = parseFloat(process.env.ATR_TP_MULT || '1.5');
const ATR_SL_MULT    = parseFloat(process.env.ATR_SL_MULT || '0.8');
const PORT           = parseInt(process.env.PORT);
const SCAN_INTERVAL  = 30000; // 30 secondes

// ── Connexions ───────────────────────────────────────────────────────────────
const redis  = new Redis(process.env.REDIS_URL);
const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });

// ── Logger ───────────────────────────────────────────────────────────────────
const logger = winston.createLogger({ /* ... config §1.4 ... */ });

// ── Handler arrêt propre ✅ CORRIGÉ (P0-4) ───────────────────────────────────
const gracefulShutdown = async (signal) => {
  logger.info(`[${SYMBOL}] ${signal} reçu — arrêt propre en cours`);
  try {
    // Annuler tous les ordres ouverts sur la paire
    await order.cancelAllOrders(SYMBOL);
    // Nettoyer le flag position_open pour ne pas bloquer le redémarrage
    await redis.del(`bot:${SYMBOL.toLowerCase()}:position_open`);
    await redis.del(`bot:${SYMBOL.toLowerCase()}:position_open_since`);
    logger.info(`[${SYMBOL}] Ordres annulés — arrêt propre terminé`);
  } catch (err) {
    logger.error(`[${SYMBOL}] Erreur pendant l'arrêt propre: ${err.message}`);
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ── Boucle principale ────────────────────────────────────────────────────────
const run = async () => {
  // Vérifier opoAllowed au démarrage
  const filters = await order.getExchangeFilters(SYMBOL);
  logger.info(`[${SYMBOL}] opoAllowed=${filters.opoAllowed} tickSize=${filters.tickSize} stepSize=${filters.stepSize}`);

  // Démarrer WebSocket monitor
  await monitor.startMonitor(SYMBOL, redis);

  // Démarrer serveur HTTP health
  await health.startHealthServer(PORT, redis, pgPool);

  // Abonnement config à chaud via Redis pub/sub (WF6)
  const redisSub = redis.duplicate();
  redisSub.subscribe(`bot:${SYMBOL.toLowerCase()}:config`);
  redisSub.on('message', (channel, message) => {
    const [key, value] = message.split(':');
    logger.info(`[${SYMBOL}] Config à chaud: ${key}=${value}`);
    // Mettre à jour la variable locale si nécessaire
    if (key === 'MAX_SPREAD') process.env.MAX_SPREAD = value;
    if (key === 'MAX_CONSEC_LOSS') process.env.MAX_CONSEC_LOSS = value;
    // ... autres params
  });

  while (true) {
    try {
      // Verrous globaux
      if (await protection.isGloballyLocked(redis)) {
        await sleep(60000);
        continue;
      }
      if (await protection.isPairLocked(SYMBOL, redis)) {
        await sleep(30000);
        continue;
      }

      // Timeout position ouverte
      await protection.checkPositionTimeout(SYMBOL, redis, order);

      // Signal
      const sig = await signal.evaluateSignal(SYMBOL, redis, binanceClient, pgPool);
      if (!sig.ok) {
        logger.debug(`[${SYMBOL}] Signal rejeté: ${sig.reason}`);
        // Logger event pour calibration (filtre fréquent > 80% = ajuster seuil)
        await journal.logEvent(pgPool, SYMBOL, 'SIGNAL_REJECTED', { reason: sig.reason });
        await sleep(SCAN_INTERVAL);
        continue;
      }

      // Calcul paramètres
      const price   = parseFloat(await redis.get(`bid:${SYMBOL}`));
      const atrData = await atr.getATR(SYMBOL, redis, binanceClient);
      const tp      = price + Math.max(TP_BRUT, atrData.atr * ATR_TP_MULT);
      const sl      = price - Math.max(SL_BRUT, atrData.atr * ATR_SL_MULT);

      // Kelly sizing — await obligatoire (P0-3) ✅ CORRIGÉ
      const kellyFraction = await computeKellyAuto(pgPool, redis, SYMBOL, TP_BRUT, SL_BRUT);
      const qty = (CAPITAL * kellyFraction) / price;

      logger.info(`[${SYMBOL}] Signal OK — price=${price} tp=${tp.toFixed(2)} sl=${sl.toFixed(2)} kelly=${kellyFraction.toFixed(3)} qty=${qty.toFixed(6)}`);

      // Marquer position ouverte
      await redis.set(`bot:${SYMBOL.toLowerCase()}:position_open`, '1');
      await redis.set(`bot:${SYMBOL.toLowerCase()}:position_open_since`, Date.now().toString());
      await redis.set(`bot:${SYMBOL.toLowerCase()}:position_qty`, qty.toFixed(getDecimals(filters.stepSize)));

      // Log ouverture
      const tradeId = await journal.logTradeOpen(pgPool, SYMBOL, price, qty, tp, sl, atrData.atr, kellyFraction);

      // Ordre entrée
      const entry = await order.placeEntry(SYMBOL, qty, price, filters, redis);
      if (!entry || entry.simulated) {
        await redis.del(`bot:${SYMBOL.toLowerCase()}:position_open`);
        await redis.del(`bot:${SYMBOL.toLowerCase()}:position_open_since`);
        continue;
      }

      await journal.logTradeFill(pgPool, tradeId, entry);

      // Stocker niveaux TP/SL pour handleExecutionReport
      const exitOrder = filters.opoAllowed
        ? await order.placeOPOCO(SYMBOL, entry.quantity, entry.fillPrice, tp, sl, filters)
        : await order.placeOCO(SYMBOL, entry.quantity, entry.fillPrice, tp, sl, filters);

      await redis.setex(`tp:${exitOrder.orderListId}`, 86400, tp.toFixed(getDecimals(filters.tickSize)));

      // Attendre résultat TP ou SL
      const result = await monitor.waitForResult(exitOrder.orderListId, redis);

      // Nettoyage
      await redis.del(`bot:${SYMBOL.toLowerCase()}:position_open`);
      await redis.del(`bot:${SYMBOL.toLowerCase()}:position_open_since`);
      await redis.del(`bot:${SYMBOL.toLowerCase()}:position_qty`);
      await redis.del(`tp:${exitOrder.orderListId}`);

      // Journal clôture
      await journal.logTradeClose(pgPool, redis, SYMBOL, tradeId, {
        exitPrice: result.exitPrice,
        durationMin: Math.round((Date.now() - entry.timestamp) / 60000),
        pnlBrut: (result.exitPrice - entry.fillPrice) * entry.quantity,
        fees: result.fees,
        pnlNet: result.pnlNet,
        result: result.result,
      });

      // Incrémenter compteur trades du jour
      await redis.incr(`bot:${SYMBOL.toLowerCase()}:trades_day`);

      // Protection post-trade
      if (result.result === 'SL') {
        await protection.checkAndLock(SYMBOL, redis, pgPool);
      } else {
        await redis.set(`bot:${SYMBOL.toLowerCase()}:consec_loss`, '0');
      }

      // Webhook N8n
      await notifyN8n('/webhook/trade', { symbol: SYMBOL, ...result });

    } catch (err) {
      logger.error(`[${SYMBOL}] Erreur boucle principale: ${err.message}`, { stack: err.stack });
      await sleep(SCAN_INTERVAL);
    }
  }
};

run().catch(err => {
  logger.error(`Erreur fatale: ${err.message}`);
  process.exit(1);
});
```

---

## 5. PHASE 2 — INTELLIGENCE

### 5.1 Calibration seuils signal

Après 1 semaine de DRY_RUN :
```sql
-- Fréquence de rejet par filtre — identifier les filtres trop restrictifs
SELECT detail->>'reason' AS reason, COUNT(*) AS rejets
FROM events
WHERE type = 'SIGNAL_REJECTED'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY reason
ORDER BY rejets DESC;
```

Si un filtre rejette > 80% des signaux → ajuster le seuil via `/config` ou `.env`.

### 5.2 Kelly recalcul automatique

Géré par `computeKellyAuto` dans `src/kelly.js` — appelé à chaque cycle `bot.js`.
Recalcul réel dès 100 trades, fraction fixe 10% en dessous.

---

## 6. PHASE 3 — ORCHESTRATION

### 6.1 N8n — WF1 Health Check

```json
{
  "name": "WF1 — Health Check",
  "nodes": [
    {
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": { "rule": { "interval": [{ "field": "minutes", "minutesInterval": 5 }] } }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Ping bot_btc",
      "parameters": { "url": "http://bot_btc:4001/health", "timeout": 5000 }
    },
    {
      "type": "n8n-nodes-base.if",
      "name": "Bot mort ?",
      "parameters": {
        "conditions": {
          "string": [{ "value1": "={{$json.status}}", "operation": "notEqual", "value2": "ok" }]
        }
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Restart via HTTP (pas SSH)",
      "parameters": {
        "method": "POST",
        "url": "http://bot_btc:4001/restart",
        "headers": { "x-restart-token": "={{$env.RESTART_SECRET}}" },
        "timeout": 5000
      }
    },
    {
      "type": "n8n-nodes-base.telegram",
      "name": "Alerte critique",
      "parameters": { "text": "⛔ bot_btc non répondant — restart déclenché" }
    }
  ]
}
```

> Répliquer pour bot_eth (4002) et bot_sol (4003).

### 6.2 Dashboard — Architecture serveur

```js
// dashboard/server.js
const express  = require('express');
const { Pool } = require('pg');
const Redis    = require('ioredis');
const { WebSocketServer } = require('ws');
const http     = require('http');

const app    = express();
const server = http.createServer(app);
const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
const redis  = new Redis(process.env.REDIS_URL);

// Auth basique
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  const expected = `Basic ${Buffer.from(`admin:${process.env.DASHBOARD_PASSWORD}`).toString('base64')}`;
  if (!auth || auth !== expected) {
    res.set('WWW-Authenticate', 'Basic realm="ROHAN Trading"');
    return res.status(401).send('Unauthorized');
  }
  next();
});

app.use(express.json());
app.use(express.static('dashboard/public'));

// API endpoints
app.get('/api/pnl/today',   require('./api/pnl').today(pgPool));
app.get('/api/trades',      require('./api/trades').list(pgPool));
app.get('/api/status',      require('./api/status').get(redis, pgPool));
app.post('/api/backtest',   require('./api/backtest').run(pgPool));
app.get('/api/correlation', require('./api/correlation').current(redis));

// WebSocket temps réel — push toutes les secondes
const wss = new WebSocketServer({ server });
setInterval(async () => {
  const data = await buildRealtimeData(redis, pgPool);
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(payload); // 1 = OPEN
  });
}, 1000);

server.listen(3010, () => console.log('Dashboard: http://0.0.0.0:3010'));
```

### 6.3 MCP Server ✅ CORRIGÉ (P1-7)

```js
// mcp/server.js
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { Pool } = require('pg');
const Redis = require('ioredis');

const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
const redis  = new Redis(process.env.REDIS_URL);
const server = new McpServer({ name: 'bot-trading', version: '1.0.0' });

// outil get_pnl
server.tool('get_pnl',
  { symbol: z.string().optional(), period: z.enum(['today', 'week', 'month']).default('today') },
  async ({ symbol, period }) => {
    const intervalMap = { today: '1 day', week: '7 days', month: '30 days' };
    const rows = await pgPool.query(`
      SELECT symbol,
             SUM(pnl_net) AS pnl,
             COUNT(*) AS trades,
             SUM(CASE WHEN result='TP' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*),0) AS wr,
             SUM(CASE WHEN pnl_net>0 THEN pnl_net ELSE 0 END) /
               NULLIF(ABS(SUM(CASE WHEN pnl_net<0 THEN pnl_net ELSE 0 END)),0) AS profit_factor
      FROM trades
      WHERE dry_run = false
        AND entry_time >= NOW() - INTERVAL '${intervalMap[period]}'
        ${symbol ? `AND symbol = '${symbol}'` : ''}
      GROUP BY symbol
    `);
    return { content: [{ type: 'text', text: JSON.stringify(rows.rows, null, 2) }] };
  }
);

// outil run_query — ✅ CORRIGÉ injection SQL (P1-7)
server.tool('run_query',
  { sql: z.string() },
  async ({ sql }) => {
    const cleaned = sql.trim().toLowerCase();

    // Vérifier que c'est un SELECT et qu'il n'y a pas de statement secondaire
    if (!cleaned.startsWith('select')) {
      return { content: [{ type: 'text', text: 'Erreur: SELECT uniquement autorisé' }] };
    }

    // Bloquer les injections via point-virgule suivi d'un autre statement
    // (ex: "select 1; DROP TABLE trades;")
    const stripped = cleaned.replace(/\/\*.*?\*\//gs, '').replace(/--[^\n]*/g, '');
    if (stripped.indexOf(';') !== stripped.lastIndexOf(';') ||
        (stripped.includes(';') && stripped.split(';').filter(s => s.trim()).length > 1)) {
      return { content: [{ type: 'text', text: 'Erreur: un seul statement autorisé' }] };
    }

    // Bloquer les mots-clés dangereux
    const FORBIDDEN = ['drop', 'delete', 'truncate', 'update', 'insert', 'alter', 'create'];
    if (FORBIDDEN.some(kw => stripped.includes(kw))) {
      return { content: [{ type: 'text', text: 'Erreur: opération non autorisée' }] };
    }

    const result = await pgPool.query(sql);
    await pgPool.query('INSERT INTO mcp_actions (tool, params, result) VALUES ($1,$2,$3)',
      ['run_query', { sql }, { rows: result.rows.length }]);
    return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
  }
);

// outil set_config
server.tool('set_config',
  { symbol: z.string(), param: z.string(), value: z.string() },
  async ({ symbol, param, value }) => {
    const ALLOWED_PARAMS = ['MAX_SPREAD', 'MAX_CONSEC_LOSS', 'TP_BRUT', 'SL_BRUT', 'ATR_TP_MULT'];
    if (!ALLOWED_PARAMS.includes(param)) {
      return { content: [{ type: 'text', text: `Paramètre non autorisé: ${param}` }] };
    }
    await redis.publish(`bot:${symbol.toLowerCase()}:config`, `${param}:${value}`);
    await pgPool.query('INSERT INTO mcp_actions (tool, params) VALUES ($1,$2)',
      ['set_config', { symbol, param, value }]);
    return { content: [{ type: 'text', text: `Config ${param}=${value} envoyée à ${symbol}` }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport);
```

---

## 7. PHASE 4 — VALIDATION

### 7.1 Checklist DRY_RUN (1 semaine)

```
□ Les 3 bots démarrent sans erreur avec DRY_RUN=true
□ Les signaux sont détectés et logués (events.type='SIGNAL_REJECTED' ou trades.dry_run=true)
□ Aucune erreur await manquant (vérifier logs pour NaN ou [object Promise])
□ SIGTERM déclenche l'annulation des ordres (test : docker stop bot_btc)
□ Les filtres spread se déclenchent avec les nouveaux seuils (BTC 1.50 / ETH 0.40 / SOL 0.08)
□ La corrélation BTC/ETH bloque correctement
□ Le régime TREND_DOWN met en pause + alerte 48h fonctionne
□ N8n WF1 ping /health toutes les 5 min
□ N8n WF5 reset_daily déclenché → compteurs remis à zéro (vérifier Redis)
□ Kelly = 0.10 fixe (< 100 trades confirmé)
□ Dashboard WebSocket data refresh toutes les secondes
□ run_query MCP : injection SQL bloquée (tester "select 1; drop table trades;")
□ reset_daily via /config fonctionne (verrous Redis supprimés)
```

### 7.2 Checklist Testnet Binance (2 semaines)

```
□ BINANCE_TESTNET=true, DRY_RUN=false
□ Vérifier opoAllowed=true sur Testnet au démarrage
□ Premier ordre OPOCO : payload sans pendingQuantity, TP=LIMIT GTC
□ Fill LIMIT_MAKER → OPOCO posé → attente via waitForResult
□ TP fill → position_open nettoyé dans Redis → journal logTradeClose
□ SL fill → protection.checkAndLock appelé
□ Timeout 45s → fallback MARKET → slippage loggé
□ Slippage > 0.20% → placeMarketSell + SLIPPAGE_ABORT dans events
□ SIGTERM pendant WAITING_FILL → cancelAllOrders exécuté
□ Protection 3 pertes consécutives → lock Redis persisté
□ WF3 Stop global → POST /stop 3 bots → Redis global:stop=1
□ WR sur 2 semaines >= 50%
□ Aucun NaN dans pnl_net ou qty des trades
```

### 7.3 Checklist Production 10% (1 semaine)

```
□ Capital réduit : BTC 600 / ETH 500 / SOL 400 USDT
□ BINANCE_TESTNET=false, DRY_RUN=false
□ 3 clés API distinctes avec IP whitelist 176.97.70.254
□ rclone configuré + premier backup cloud vérifié
□ Dashboard accessible + auth basique active
□ Premier trade réel journalisé avec fees réels
□ Telegram trade alert reçu avec Profit Factor
□ Aucune alerte N8n non attendue en 48h
□ PnL réel vs simulé DRY_RUN : cohérence vérifiée
```

---

## 8. PROMPTS CURSOR PAR MODULE

### 8.1 Prompt — `db/schema.sql`
```
Crée db/schema.sql pour BotTrader v1.0 — CDC v1.1 §13.
4 tables : trades, events, daily_summary, mcp_actions.
Script idempotent (CREATE TABLE IF NOT EXISTS).
Champs trades : inclure correlation_btc_eth, slippage_pct, dry_run, kelly_fraction.
CHECK sur result : 'TP','SL','OPEN','CANCELLED','FORCED_EXIT','SLIPPAGE_ABORT','DRY_RUN'.
CHECK sur order_type : 'OPOCO','OCO'.
CHECK sur entry_mode : 'LIMIT_MAKER','MARKET'.
Tous les index CDC §13.
Commentaires SQL sur chaque table.
INSERT de test à la fin pour valider le schéma.
```

### 8.2 Prompt — `src/kelly.js`
```
Crée src/kelly.js pour BotTrader v1.0.
Deux fonctions séparées :

1. computeKellyFormula(winRate, ratioRR) — SYNCHRONE, PURE, aucune dépendance
   Formule : f = (winRate * ratioRR - (1 - winRate)) / ratioRR
   halfKelly = f * 0.5
   Return : Math.max(0.05, Math.min(halfKelly, 0.20))

2. computeKellyAuto(pgPool, redis, symbol, tpBrut, slBrut) — ASYNC
   Si total_trades Redis < 100 → return 0.10
   Sinon → SELECT 100 derniers trades, calculer WR, appeler computeKellyFormula

Export : module.exports = { computeKellyFormula, computeKellyAuto }
CommonJS uniquement.
Tests dans tests/unit/kelly.test.js — voir §9.2.
```

### 8.3 Prompt — `src/order.js`
```
Crée src/order.js pour BotTrader v1.0.

Règles strictes :
1. OPOCO : pendingQuantity ABSENT (CDC v1.1 §17 C2 fait autorité)
2. TP : pendingAboveType='LIMIT' + pendingAboveTimeInForce='GTC' (jamais LIMIT_MAKER)
3. Entrée BUY : type='LIMIT_MAKER' (maker, frais 0%)
4. waitForFill(orderId, redis, timeoutMs) : polling Redis clé 'fill:{orderId}' (TTL 120s)
   Retourne null si timeout, objet fill si trouvé
5. Slippage MARKET > MAX_SLIPPAGE_PCT → placeMarketSell + logSlippageAbort + return null
6. DRY_RUN=true → log + return {simulated:true}, zéro appel API
7. roundToStep et roundToTick : appliquer toFixed(decimals) pour éviter floating point
8. Signature HMAC-SHA256 sur tous les endpoints signés
9. Gestion erreurs : -1013 recalculer stepSize, HTTP 429 backoff 60s

Export : { getExchangeFilters, placeEntry, placeOPOCO, placeOCO,
           cancelOrder, cancelAllOrders, getOpenOrders, placeMarketSell, waitForFill }
Tests : tests/unit/order.test.js — voir §9.2
```

### 8.4 Prompt — `src/monitor.js`
```
Crée src/monitor.js pour BotTrader v1.0.

3 streams WebSocket :
1. {symbol}@bookTicker → Redis bid:{symbol} et ask:{symbol}
2. {symbol}@kline_5m → si kline.x===true : redis.lpush closes:{symbol} + ltrim 0,49
3. userDataStream (listenKey) → handleExecutionReport

handleExecutionReport :
- Si FILLED et orderListId===-1 : redis.setex('fill:{orderId}', 120, JSON)
- Si FILLED et side==='SELL' et orderListId !== -1 :
  comparer price avec redis.get('tp:{orderListId}') → result='TP' ou 'SL'
  redis.setex('result:{orderListId}', 300, JSON)

waitForResult(orderListId, redis, timeoutMs=86400000) :
- Polling Redis 'result:{orderListId}' toutes les 500ms
- Retourne le JSON parsé ou throw après timeout

Keepalive listenKey : setInterval 20 minutes (pas 30).
Reconnexion : backoff exponentiel, max 5 tentatives, alerte Telegram si échec total.

Export : { startMonitor, stopMonitor, waitForResult }
```

### 8.5 Prompt — `src/signal.js`
```
Crée src/signal.js pour BotTrader v1.0.

Interface : evaluateSignal(symbol, redis, binanceClient, pgPool)
pgPool est TOUJOURS passé en paramètre — jamais importé comme singleton global.

12 filtres dans l'ordre exact du CD §4.9 :
1. Heure UTC (TRADING_HOURS_START/END)
2. Verrous Redis global_stop + daily_loss_locked
3. Pertes consécutives >= MAX_CONSEC_LOSS
4. Trades jour >= MAX_TRADES_DAY
5. getDayPnl(pgPool, symbol) <= -MAX_LOSS_DAY
6. Spread > MAX_SPREAD → logger.warn + return false
7. Volume relatif hors [0.8, 4.0]
8. ATR hors [0.5×, 3×] ATR moyen
9. Cascade liquidations Redis liq:{symbol}==='1'
10. Régime TREND_DOWN ou VOLATILE (SOL seulement)
11. shouldBlockOnCorrelation(symbol, redis) === true
12. EMA5 < EMA20 × 0.998

Chaque filtre : logger.warn + logEvent(pgPool, symbol, 'SIGNAL_REJECTED', {reason}) + return {ok:false, reason}
Si tout passe : return {ok:true, reason:null}

Export : { evaluateSignal }
Tests : chaque filtre individuellement avec pgPool mocké
```

### 8.6 Prompt — `src/bot.js`
```
Crée src/bot.js pour BotTrader v1.0.

Règles absolues :
1. Handler SIGTERM + SIGINT → gracefulShutdown() → cancelAllOrders + del position_open + exit(0)
2. computeKellyAuto est ASYNC → toujours await (jamais oublier)
3. Après entry fill : stocker tp:{orderListId} dans Redis pour handleExecutionReport
4. Après waitForResult : del position_open + position_open_since + position_qty + tp:{orderListId}
5. Boucle while(true) avec try/catch global — logger.error + sleep(SCAN_INTERVAL) sur erreur
6. Redis subscribe config à chaud (channel bot:{symbol}:config)
7. Incrémenter trades_day Redis après chaque trade clôturé
8. Protection.checkPositionTimeout à chaque cycle

Ne jamais laisser un appel async sans await.
Loguer chaque étape avec le niveau approprié (debug pour cycles normaux, info pour trades, warn/error pour problèmes).
```

### 8.7 Prompt — Workflows N8n
```
Génère 6 fichiers JSON de workflows N8n importables.

WF1 — Health Check :
- Cron /5min
- HTTP GET /health sur les 3 bots
- Si status != 'ok' → HTTP POST /restart avec header x-restart-token=${RESTART_SECRET}
- PAS de nœud SSH
- Telegram si restart échoue

WF2 — Trade Alert :
- Webhook POST /webhook/trade
- Log dans Postgres (table events)
- Calcul Profit Factor depuis derniers trades
- Telegram formaté avec Profit Factor et PnL cumulé

WF3 — Stop Global :
- Webhook POST /webhook/stop-global
- HTTP POST /stop sur les 3 bots
- Telegram alerte critique

WF4 — Rapport Daily (23h58 UTC) :
- SELECT agrégats depuis Postgres par paire
- Sharpe annualisé + Sortino + Profit Factor
- Telegram rapport complet

WF5 — Reset Daily (00h01 UTC) :
- HTTP POST /config key=reset_daily sur les 3 bots (pas manipulation Redis directe)
- Telegram confirmation

WF6 — Config Update :
- Webhook POST /webhook/config
- HTTP POST /config vers le bot concerné
- Log dans mcp_actions

Contrainte globale : zéro nœud SSH. Tout passe par HTTP.
```

---

## 9. TESTS UNITAIRES ET D'INTÉGRATION

### 9.1 Couverture minimale requise

| Module | Couverture min | Tests critiques |
|---|---|---|
| kelly.js | 95% | Formule correcte, clamp min/max, async < 100 trades |
| atr.js | 90% | Calcul correct, cache, erreur API |
| signal.js | 95% | Chaque filtre individuellement, pgPool mocké |
| order.js | 90% | OPOCO sans pendingQuantity, TP LIMIT GTC, slippage, DRY_RUN |
| regime.js | 85% | Chaque régime, TREND_DOWN 48h/96h |
| correlation.js | 85% | Pearson sur données fixes, blocage correct |
| protection.js | 90% | Lock après 3 SL, perte journalière, stop global |
| journal.js | 80% | INSERT/UPDATE trades, compteur 1500 |
| monitor.js | 80% | waitForResult, waitForFill, executionReport routing |

### 9.2 Tests critiques

```js
// tests/unit/kelly.test.js
const { computeKellyFormula, computeKellyAuto } = require('../../src/kelly');

describe('computeKellyFormula — synchrone pure', () => {
  test('formule correcte WR=60% RR=1.55', () => {
    // f = (0.60 * 1.55 - 0.40) / 1.55 = 0.53 / 1.55 = 0.3419
    // halfKelly = 0.1710 → clamp → 0.1710
    expect(computeKellyFormula(0.60, 1.55)).toBeCloseTo(0.171, 2);
  });

  test('clamp à 0.05 minimum (WR très faible)', () => {
    expect(computeKellyFormula(0.30, 1.0)).toBe(0.05); // Kelly négatif → 0.05
  });

  test('clamp à 0.20 maximum (WR très élevé)', () => {
    expect(computeKellyFormula(0.90, 5.0)).toBe(0.20); // halfKelly >> 0.20 → 0.20
  });
});

describe('computeKellyAuto — async avec mocks', () => {
  test('retourne 0.10 si total_trades < 100', async () => {
    const mockRedis  = { get: jest.fn().mockResolvedValue('50') };
    const mockPgPool = { query: jest.fn() }; // jamais appelé
    const result = await computeKellyAuto(mockPgPool, mockRedis, 'BTCUSDT', 28, 18);
    expect(result).toBe(0.10);
    expect(mockPgPool.query).not.toHaveBeenCalled();
  });

  test('calcule WR depuis Postgres si total_trades >= 100', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue('150') };
    // 60 trades positifs sur 100
    const rows = Array.from({ length: 100 }, (_, i) => ({ pnl_net: i < 60 ? '10' : '-8' }));
    const mockPgPool = { query: jest.fn().mockResolvedValue({ rows }) };
    const result = await computeKellyAuto(mockPgPool, mockRedis, 'BTCUSDT', 28, 18);
    // WR=0.60, ratioRR=28/18=1.555, f=(0.60*1.555-0.40)/1.555≈0.342, half=0.171
    expect(result).toBeCloseTo(0.171, 2);
  });
});

// tests/unit/order.test.js
const order = require('../../src/order');

describe('placeOPOCO', () => {
  const filters = { tickSize: 0.01, stepSize: 0.00001, opoAllowed: true };

  test('payload sans pendingQuantity (CDC v1.1 §17 C2)', async () => {
    const mockPost = jest.fn().mockResolvedValue({ orderListId: 1 });
    await order.placeOPOCO('BTCUSDT', 0.0572, 104650, 104932, 104200, filters, mockPost);
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('pendingQuantity');
  });

  test('TP en LIMIT GTC (pas LIMIT_MAKER)', async () => {
    const mockPost = jest.fn().mockResolvedValue({ orderListId: 1 });
    await order.placeOPOCO('BTCUSDT', 0.0572, 104650, 104932, 104200, filters, mockPost);
    const payload = mockPost.mock.calls[0][1];
    expect(payload.pendingAboveType).toBe('LIMIT');
    expect(payload.pendingAboveTimeInForce).toBe('GTC');
  });

  test('entrée en LIMIT_MAKER (pas LIMIT)', async () => {
    const mockPost = jest.fn().mockResolvedValue({ orderListId: 1 });
    await order.placeOPOCO('BTCUSDT', 0.0572, 104650, 104932, 104200, filters, mockPost);
    expect(mockPost.mock.calls[0][1].workingType).toBe('LIMIT_MAKER');
  });
});

describe('roundToStep — précision floating point', () => {
  test('0.57234 avec step 0.00001 → pas de floating point', () => {
    expect(order.roundToStep(0.57234, 0.00001)).toBe(0.57234);
  });

  test('0.99999 avec step 0.0001 → floor correct', () => {
    expect(order.roundToStep(0.99999, 0.0001)).toBe(0.9999);
  });
});

describe('slippage MARKET', () => {
  test('slippage > MAX_SLIPPAGE_PCT déclenche placeMarketSell', async () => {
    process.env.MAX_SLIPPAGE_PCT = '0.20';
    const mockSell = jest.spyOn(order, 'placeMarketSell').mockResolvedValue({});
    const mockLog  = jest.spyOn(require('../../src/journal'), 'logSlippageAbort').mockResolvedValue();
    // 0.21% de slippage
    await order.handleMarketFill('BTCUSDT', 0.0572, 104870, 104650, {});
    expect(mockSell).toHaveBeenCalled();
  });
});

describe('DRY_RUN', () => {
  test('DRY_RUN=true retourne {simulated:true} sans appel API', async () => {
    process.env.DRY_RUN = 'true';
    const mockPost = jest.fn();
    const result = await order.placeEntry('BTCUSDT', 0.05, 104650, filters, {}, mockPost);
    expect(result).toEqual({ simulated: true });
    expect(mockPost).not.toHaveBeenCalled();
    delete process.env.DRY_RUN;
  });
});

// tests/unit/monitor.test.js
describe('waitForResult', () => {
  test('retourne le résultat dès que Redis est alimenté', async () => {
    const mockData = JSON.stringify({ result: 'TP', exitPrice: 104932, quantity: 0.0572, fees: 0.008 });
    let callCount = 0;
    const mockRedis = {
      get: jest.fn().mockImplementation(async () => {
        callCount++;
        return callCount >= 3 ? mockData : null; // disponible au 3e poll
      }),
      del: jest.fn().mockResolvedValue(1),
    };
    const { waitForResult } = require('../../src/monitor');
    const result = await waitForResult(12345, mockRedis, 5000);
    expect(result.result).toBe('TP');
    expect(result.exitPrice).toBe(104932);
  });

  test('throw après timeout', async () => {
    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn(),
    };
    const { waitForResult } = require('../../src/monitor');
    await expect(waitForResult(99999, mockRedis, 600)).rejects.toThrow('waitForResult timeout');
  });
});
```

---

## 10. CHECKLIST DE VALIDATION PAR LIVRABLE

### L1 — docker-compose.yml
```
□ 7 conteneurs définis (redis, postgres, btc, eth, sol, dashboard, mcp)
□ dashboard/Dockerfile et mcp/Dockerfile présents et fonctionnels
□ healthcheck sur les 3 bots
□ restart: unless-stopped sur tous
□ Volumes ./logs/btc:/app/logs etc.
□ docker compose up -d démarre sans erreur
```

### L2–L13 — Modules src/
```
□ Tous les exports correspondent à l'interface définie
□ Tests Jest > couverture minimale
□ Zéro console.log (logger uniquement)
□ await sur chaque appel async (vérification manuelle + eslint)
□ pgPool toujours injecté en paramètre (jamais singleton dans signal.js)
□ Gestion d'erreur sur chaque appel externe
□ SIGTERM handler présent dans bot.js
□ reset_daily géré dans health.js /config
```

### L14 — MCP server
```
□ run_query bloque les injections SQL (tester ; + DROP + UPDATE)
□ set_config : whitelist ALLOWED_PARAMS respectée
□ Toutes actions loggées dans mcp_actions
□ Authentification token active
```

### L15 — N8n workflows
```
□ 6 fichiers JSON importables
□ WF1 : HTTP Request (pas SSH) pour /restart avec x-restart-token
□ WF5 : POST /config key=reset_daily (pas manipulation Redis directe)
□ Tous les secrets via variables N8n (pas en dur)
```

### L16 — Fichiers .env
```
□ MAX_SPREAD : BTC=1.50 / ETH=0.40 / SOL=0.08
□ MAX_SLIPPAGE_PCT=0.20
□ MAX_POSITION_HOURS=4
□ RESTART_SECRET défini (token 256 bits)
□ BINANCE_API_KEY distincts par paire (.env.btc/.env.eth/.env.sol)
□ .gitignore couvre .env*
□ logs/btc/.gitkeep, logs/eth/.gitkeep, logs/sol/.gitkeep présents
```

---

## 11. RÈGLES GIT ET DÉPLOIEMENT

### 11.1 .gitignore
```
.env*
*.env
logs/**/*
!logs/btc/.gitkeep
!logs/eth/.gitkeep
!logs/sol/.gitkeep
node_modules/
coverage/
*.sql.gz
.DS_Store
```

### 11.2 Convention de commits
```
feat(module): description courte en français
fix(module): description du bug corrigé
test(module): ajout/modification tests
chore: maintenance (deps, config)
docs: documentation uniquement

Exemples :
feat(order): implémenter OPOCO sans pendingQuantity + waitForFill
fix(bot): ajouter await sur computeKellyAuto
fix(order): corriger roundToStep floating point avec toFixed
feat(health): ajouter commande reset_daily dans /config
fix(mcp): sécuriser run_query contre injection SQL
```

### 11.3 Branches
```
main        → production uniquement
develop     → intégration
feature/xxx → développement module
fix/xxx     → correction bug
```

### 11.4 Déploiement VPS (176.97.70.254)

> **Stratégie BTC first :** démarrer avec `docker-compose.btc.yml` (BTC seul).
> Activer ETH/SOL uniquement après validation GO/NO-GO de la paire précédente.
> Voir `docs/RAPPORT_ALIGNEMENT_CDC_CD.md`.

```bash
cd /home/dev/dev/OCO_strategie
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.btc.yml build
docker compose -f docker-compose.yml -f docker-compose.btc.yml up -d
docker compose logs -f bot_btc --tail=50
```

### 11.5 Rollback d'urgence
```bash
git log --oneline -5
git checkout <commit-hash>
docker compose up -d --build
```

---

## ANNEXE — RÉCAPITULATIF DES CORRECTIONS v1.1 CD

| ID | Sévérité | Module | Correction |
|---|---|---|---|
| P0-1 | 🔴 | monitor.js | `waitForResult()` définie + mécanisme Redis complet |
| P0-2 | 🔴 | order.js | `waitForFill()` définie + polling Redis |
| P0-3 | 🔴 | bot.js | `await computeKellyAuto()` — évite qty=NaN |
| P0-4 | 🔴 | bot.js | Handler SIGTERM/SIGINT → cancelAllOrders propre |
| P1-5 | 🟠 | package.json | `@modelcontextprotocol/sdk` + `zod` ajoutés |
| P1-6 | 🟠 | docker-compose | `dashboard/Dockerfile` + `mcp/Dockerfile` créés |
| P1-7 | 🟠 | mcp/server.js | Injection SQL bloquée (`;` + FORBIDDEN keywords) |
| P1-8 | 🟠 | health.js | `reset_daily` géré dans POST /config |
| P1-9 | 🟠 | signal.js | `pgPool` injecté en paramètre (pas singleton) |
| P2-10 | 🟡 | bot.js §1.5 | `roundToStep` + `toFixed(decimals)` — floating point |
| P2-11 | 🟡 | kelly.js | `computeKellyFormula` (sync) séparée de `computeKellyAuto` (async) |
| P2-12 | 🟡 | logs/ | `.gitkeep` dans chaque sous-dossier logs |
| P2-13 | 🟡 | order.js | Autorité CDC v1.1 §17 C2 clarifiée — `pendingQuantity` ABSENT |

---

*Fin du cahier de développement — Version 1.1.0*
*ROHAN Innovation — Abidjan, Côte d'Ivoire — Juillet 2026*

---

## 12. DASHBOARD — SPÉCIFICATIONS COMPLÈTES v2.0
### Livré le 10/07/2026 — Validé visuellement en production

### 12.1 Architecture serveur

**Fichier :** `dashboard/server.js` — 254 lignes

```
Express + HTTP + WebSocketServer
├── GET  /health              → sans auth — health check
├── Auth Basic admin:DASHBOARD_PASSWORD (middleware)
├── GET  /api/pnl/today       → PnL par symbole depuis Postgres
├── GET  /api/trades          → Liste trades (limit param)
├── GET  /api/trades/filtered → Filtres avancés + stats agrégées + tri
├── GET  /api/status          → État 3 bots via Redis
├── POST /api/backtest        → Backtest Sharpe/Sortino/PF
├── GET  /api/correlation     → Matrice corrélation depuis Redis
├── GET  /api/events          → Flux events Postgres
├── POST /api/config          → Config à chaud Redis pub/sub
├── GET  /api/pnl/history     → PnL journalier N jours
├── GET  /api/system          → CPU/RAM/uptime/Docker via os module
└── WS push toutes les secondes :
    { ts, bid_btc, bid_eth, bid_sol, pnl_day, global_stop, pairs:{...} }
```

### 12.2 buildRealtimeData — payload WS

```javascript
{
  ts: Date.now(),
  bid_btc: string,        // redis GET bid:BTCUSDT
  bid_eth: string,        // redis GET bid:ETHUSDT
  bid_sol: string,        // redis GET bid:SOLUSDT
  pnl_day: number,        // SUM pnl_net trades aujourd'hui
  global_stop: boolean,   // redis GET bot:global:stop
  pairs: {
    BTCUSDT: {
      position_open: boolean,
      trades_day: number,
      consec_loss: number,
      regime: string,
      kelly: number,
      atr: number,
      ws_status: string,
      listen_key_age: number,
      last_signal: string,
    },
    ETHUSDT: { ... },
    SOLUSDT: { ... },
  }
}
```

### 12.3 Endpoint /api/trades/filtered — paramètres

| Param | Type | Valeurs | Défaut |
|-------|------|---------|--------|
| `symbol` | string | BTCUSDT/ETHUSDT/SOLUSDT/ALL | ALL |
| `result` | string | TP/SL/FORCED_EXIT/SLIPPAGE_ABORT/ALL | ALL |
| `from` | date | ISO date | — |
| `to` | date | ISO date | — |
| `pnl_min` | number | — | — |
| `pnl_max` | number | — | — |
| `dry_run` | boolean | true/false | — |
| `sort_col` | string | entry_time/exit_time/pnl_net/symbol/result/qty | entry_time |
| `sort_dir` | string | ASC/DESC | DESC |
| `limit` | number | max 1000 | 200 |
| `offset` | number | — | 0 |

**Retourne :**
```javascript
{
  rows: [...],     // trades filtrés
  stats: {
    total, wins, losses, total_pnl,
    avg_pnl, best, worst, avg_duration_s
  }
}
```

### 12.4 Frontend — 10 onglets

| Onglet | data-tab | Source données | Chart.js |
|--------|----------|----------------|----------|
| Overview | overview | WS live | Equity 7j |
| Historique | trades | /api/trades/filtered | Equity filtrée |
| PnL | pnl | /api/pnl/today + /api/pnl/history | Equity 30j + barres + par symbole |
| Statut Bots | status | /api/status + WS live | — |
| Marché | market | Binance REST public + CoinGecko | — |
| Corrélation | correlation | /api/correlation | — |
| Backtest | backtest | POST /api/backtest | Equity curve |
| Events | events | /api/events | — |
| Config | config | POST /api/config | — |
| Health/VPS | health | /api/system + /api/status | — |

### 12.5 Marché — 2 sources indépendantes

**Source 1 — Binance REST (publique, sans clé)**
```
GET https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT&symbol=ETHUSDT&symbol=SOLUSDT
Retourne : lastPrice, priceChangePercent, highPrice, lowPrice, volume, quoteVolume
```

**Source 2 — CoinGecko (publique, sans clé)**
```
GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd
  &include_24hr_change=true&include_market_cap=true&include_24hr_vol=true
Retourne : usd, usd_24h_change, usd_market_cap, usd_24h_vol
```

Chaque source affiche un badge `✅` si disponible, `❌` si API down.

### 12.6 Déploiement dashboard

**Conteneur :** `bot_dashboard` (profile `ops`)
**Dockerfile :** `dashboard/Dockerfile`
```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY dashboard/ ./dashboard/
COPY src/correlation.js ./src/correlation.js
EXPOSE 3010
CMD ["node", "dashboard/server.js"]
```

**Volume bind-mount (docker-compose.yml) :**
```yaml
volumes:
  - ./dashboard:/app/dashboard
  - ./node_modules:/app/node_modules:ro
```
→ Permet mise à jour des fichiers sans rebuild.

**Commande rebuild si nécessaire :**
```bash
docker compose --profile ops up -d --build bot_dashboard
```

### 12.7 Auth dashboard

- Auth HTTP Basic : `admin` / `DASHBOARD_PASSWORD` (variable env)
- Stockée en `sessionStorage` côté client (pas de prompt répété)
- Retry automatique sur 401
- La route `/health` est exclue de l'auth (monitoring)

### 12.8 Tests dashboard

**Suite :** `tests/unit/dashboard.test.js` — 10 tests
```
✅ index.html expose 9 onglets (data-tab ×9)
✅ GET /health sans auth → 200
✅ GET /api/pnl/today requiert auth → 401
✅ GET /api/pnl/today avec auth → 200 + rows
✅ GET /api/status → 200 + pairs[3]
✅ GET /api/correlation → 200 + BTCUSDT
✅ buildRealtimeData → bid_btc + pnl_day
✅ GET /api/trades → 200 + rows
✅ POST /api/backtest → 200 + total_pnl
✅ startDashboardServer démarre WebSocket
```

---

*Fin du cahier de développement — Version 1.2.0*
*ROHAN Innovation — Abidjan, Côte d'Ivoire — 10 juillet 2026*
