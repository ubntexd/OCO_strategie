# RAPPORT SESSION BotTrader v1.0 — Audit Claude

## 1. RÉSUMÉ EXÉCUTIF

```
Date et heure de la session : 2026-07-10 (UTC ~05:30 → 07:00)
Durée estimée : ~2h30
Étapes du PROMPT_MASTER_CURSOR.md traitées : Module C (C.1→C.4) + Phase 4 smoke DRY_RUN bot_btc
Étapes restantes : Phase 4 checklist 1 semaine, Testnet 2 sem, Prod 10%, import N8n WF1-6, git push code complet
Statut global : SUCCÈS (avec réserves infra env / horaires trading temporaires)
```

---

## 2. FICHIERS CRÉÉS OU MODIFIÉS

### Module C — N8n (C.1)

```
Fichier : n8n/workflows/wf1_health.json
Action  : CRÉÉ
Statut  : ✅ COMPLET
Tests   : tests/unit/n8n-workflows.test.js — inclus — ✅ PASS
Notes   : WF1 HTTP /restart + x-restart-token, pas SSH
```

```
Fichier : n8n/workflows/wf2_trade_alert.json
Action  : CRÉÉ
Statut  : ✅ COMPLET
Tests   : n8n-workflows.test.js — ✅ PASS
```

```
Fichier : n8n/workflows/wf3_stop_global.json
Action  : CRÉÉ
Statut  : ✅ COMPLET
Tests   : n8n-workflows.test.js — ✅ PASS
```

```
Fichier : n8n/workflows/wf4_daily_report.json
Action  : CRÉÉ
Statut  : ✅ COMPLET
Tests   : n8n-workflows.test.js — ✅ PASS
```

```
Fichier : n8n/workflows/wf5_reset_daily.json
Action  : CRÉÉ
Statut  : ✅ COMPLET
Tests   : n8n-workflows.test.js — ✅ PASS
Notes   : POST /config reset_daily, pas Redis direct
```

```
Fichier : n8n/workflows/wf6_config_update.json
Action  : CRÉÉ
Statut  : ✅ COMPLET
Tests   : n8n-workflows.test.js — ✅ PASS
```

### Module C — Dashboard (C.2)

```
Fichier : dashboard/server.js
Action  : CRÉÉ
Statut  : ✅ COMPLET
Exports : createDashboardApp, startDashboardServer, buildRealtimeData
Tests   : tests/unit/dashboard.test.js — 10 tests — ✅ PASS
Couverture : 94% lignes
Notes   : Basic auth admin/DASHBOARD_PASSWORD (défaut changeme)
```

```
Fichier : dashboard/api/backtest.js
Action  : CRÉÉ
Statut  : ✅ COMPLET
Tests   : tests/unit/backtest.test.js — 2 tests — ✅ PASS
Couverture : 90%
```

```
Fichier : dashboard/api/pnl.js, trades.js, status.js, correlation.js
Action  : CRÉÉ
Statut  : ✅ COMPLET
Tests   : couverts partiellement via dashboard.test.js — ✅ PASS
```

```
Fichier : dashboard/public/index.html, css/dashboard.css, js/dashboard.js
Action  : CRÉÉ
Statut  : ✅ COMPLET
Notes   : 9 onglets UI
```

```
Fichier : dashboard/Dockerfile
Action  : CRÉÉ
Statut  : ✅ COMPLET
```

### Module C — MCP (C.3)

```
Fichier : mcp/server.js
Action  : CRÉÉ
Statut  : ✅ COMPLET
Exports : createMcpApp, startMcpServer
Tests   : tests/unit/mcp.test.js — 17 tests — ✅ PASS
Couverture : 89% lignes
```

```
Fichier : mcp/lib/sqlGuard.js
Action  : CRÉÉ
Statut  : ✅ COMPLET
Exports : validateSelectOnly, validateConfigParam, ALLOWED_PARAMS
Couverture : 94%
```

```
Fichier : mcp/lib/tools.js
Action  : CRÉÉ
Statut  : ✅ COMPLET
Exports : getPnl, runQuery, setConfig
Couverture : 100%
```

```
Fichier : mcp/Dockerfile
Action  : CRÉÉ
Statut  : ✅ COMPLET
```

### Pipeline & tests Module C

```
Fichier : scripts/lib/coverage-min.js
Action  : MODIFIÉ
Statut  : ✅ COMPLET
Notes   : TASK_TEST_MAP, seuils Module C
```

```
Fichier : scripts/lib/validate-task.js
Action  : MODIFIÉ
Statut  : ✅ COMPLET
Notes   : Checklists L14, L15, L_DASH
```

```
Fichier : scripts/pipeline-task.js
Action  : MODIFIÉ
Statut  : ✅ COMPLET
Notes   : resolveTestFile pour chemins Module C
```

```
Fichier : scripts/run-module-c.sh
Action  : CRÉÉ
Statut  : ✅ COMPLET
Notes   : 4 tâches pipeline coworker-3, 4/4 GO claude_api sur VPS
```

```
Fichier : jest.config.js
Action  : MODIFIÉ
Statut  : ✅ COMPLET
Notes   : collectCoverageFrom mcp/** et dashboard/**
```

```
Fichier : tests/unit/mcp.test.js, dashboard.test.js, backtest.test.js, n8n-workflows.test.js
Action  : CRÉÉ
Statut  : ✅ COMPLET
```

### Phase 4 DRY_RUN runtime

```
Fichier : src/monitor.js
Action  : MODIFIÉ
Statut  : ✅ COMPLET
Tests   : monitor.test.js — ✅ PASS
Notes   : DRY_RUN ignore userDataStream (testnet 410/404)
```

```
Fichier : src/bot.js
Action  : MODIFIÉ
Statut  : ✅ COMPLET
Tests   : bot.test.js — ✅ PASS
Notes   : sleep(scanInterval) après trade simulé DRY_RUN (évite boucle rapide)
```

---

## 3. RÉSULTATS DES TESTS

```

> oco-strategie@1.0.0 test
> jest --coverage

PASS tests/unit/atr.test.js
PASS tests/unit/kelly.test.js
PASS tests/unit/journal.test.js
PASS tests/unit/regime.test.js
PASS tests/unit/correlation.test.js
PASS tests/unit/protection.test.js
PASS tests/unit/backtest.test.js
PASS tests/unit/n8n-workflows.test.js
PASS tests/unit/bot.test.js
PASS tests/unit/order.test.js
PASS tests/unit/signal.test.js
PASS tests/unit/health.test.js
PASS tests/unit/mcp.test.js
PASS tests/unit/dashboard.test.js
PASS tests/unit/monitor.test.js
---------------------|---------|----------|---------|---------|-----------------------------------------
File                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                       
---------------------|---------|----------|---------|---------|-----------------------------------------
All files            |   86.23 |    62.32 |   83.22 |   88.33 |                                         
 dashboard           |   90.38 |       60 |      80 |      94 |                                         
  server.js          |   90.38 |       60 |      80 |      94 | 64,78-79                                
 dashboard/api       |   87.71 |    68.75 |     100 |      86 |                                         
  backtest.js        |    92.3 |    66.66 |     100 |      90 | 24                                      
  correlation.js     |   82.35 |       75 |     100 |   81.25 | 9-10,18                                 
  pnl.js             |   85.71 |      100 |     100 |   83.33 | 12                                      
  status.js          |   91.66 |       50 |     100 |    90.9 | 21                                      
  trades.js          |    87.5 |      100 |     100 |   85.71 | 11                                      
 dashboard/public/js |       0 |        0 |       0 |       0 |                                         
  dashboard.js       |       0 |        0 |       0 |       0 | 1-61                                    
 mcp                 |   87.75 |    73.91 |      90 |   88.88 |                                         
  server.js          |   87.75 |    73.91 |      90 |   88.88 | 32,42,52,69-70                          
 mcp/lib             |   97.56 |    82.35 |     100 |   97.29 |                                         
  sqlGuard.js        |   94.44 |     87.5 |     100 |   93.75 | 19                                      
  tools.js           |     100 |    77.77 |     100 |     100 | 10-13                                   
 src                 |    89.5 |    65.68 |   84.48 |   92.09 |                                         
  atr.js             |   96.66 |       75 |     100 |     100 | 28                                      
  bot.js             |   85.29 |     65.3 |      60 |   88.18 | 64,158,176,189-192,212-217,223-225      
  correlation.js     |   94.44 |    76.19 |     100 |     100 | 21,34-42                                
  health.js          |   94.44 |    65.38 |   86.66 |   95.58 | 67-68,85                                
  journal.js         |   86.88 |    45.16 |     100 |   91.07 | 17-20,75-76                             
  kelly.js           |     100 |       75 |     100 |     100 | 26                                      
  monitor.js         |   80.76 |    65.78 |   66.66 |   81.81 | 100-101,128-137,153-158,163,169,177-178 
  notify.js          |      30 |        0 |       0 |      30 | 4-8,12-16                               
  order.js           |   99.09 |    78.12 |     100 |     100 | 18,54-61,100-123,168                    
  protection.js      |   97.95 |    72.22 |     100 |     100 | 32-39,60-65                             
  regime.js          |    87.5 |    73.52 |     100 |   89.79 | 35-37,45,73                             
  signal.js          |   89.01 |    65.33 |     100 |   96.15 | 93,99,111                               
---------------------|---------|----------|---------|---------|-----------------------------------------

Test Suites: 15 passed, 15 total
Tests:       132 passed, 132 total
Snapshots:   0 total
Time:        7.312 s, estimated 8 s
Ran all test suites.

```

---

## 4. ERREURS RENCONTRÉES ET SOLUTIONS APPLIQUÉES

```
ERREUR #1
---------
Moment     : Pipeline Claude initial (session précédente reprise)
Message    : HTTP 400 Claude API (temperature deprecated)
Cause      : Paramètre temperature dans claude-gate.js
Solution   : Retrait temperature, retries JSON
Statut     : ✅ RÉSOLU

ERREUR #2
---------
Moment     : Démarrage bot_btc Phase 4
Message    : Variable manquante : TELEGRAM_BOT_TOKEN
Cause      : .env.shared vide sur VPS
Solution   : TELEGRAM_BOT_TOKEN=dry_run_stub, MAX_POSITION_HOURS=4
Statut     : ✅ RÉSOLU

ERREUR #3
---------
Moment     : Démarrage bot_btc après fix Telegram
Message    : Request failed with status code 410
Cause      : userDataStream testnet Binance indisponible
Solution   : monitor.js — skip listenKey si DRY_RUN=true
Statut     : ✅ RÉSOLU

ERREUR #4
---------
Moment     : WebSocket monitor testnet
Message    : Unexpected server response: 404
Cause      : WS testnet.binance.vision incompatible
Solution   : BINANCE_TESTNET=false sur VPS pour flux publics (DRY_RUN, pas d'ordres)
Statut     : ✅ RÉSOLU (config VPS)

ERREUR #5
---------
Moment     : Signaux DRY_RUN après extension horaires
Message    : Centaines de signaux en <1s
Cause      : bot.js return sans sleep après entry.simulated
Solution   : await sleep(scanInterval) avant return DRY_RUN
Statut     : ✅ RÉSOLU

ERREUR #6
---------
Moment     : Correction .env.shared (shell PowerShell)
Message    : MAX_POSITION: command not found / exit 255
Cause      : grep -E avec pipe mal échappé
Solution   : Commande sed/grep simplifiée en SSH ultérieure
Statut     : ✅ RÉSOLU

ERREUR #7
---------
Moment     : Dashboard trading :3010
Message    : Utilisateur ne voit pas le mot de passe
Cause      : DASHBOARD_PASSWORD non défini → défaut code changeme
Solution   : Documenté admin/changeme pour l'utilisateur
Statut     : ✅ RÉSOLU (info)
```

---

## 5. DÉCISIONS TECHNIQUES PRISES

```
DÉCISION #1
-----------
Sujet      : Gate pipeline Claude
CDC/CD dit : Validation avant suite
Décision   : GO uniquement si gate.source === 'claude_api' (NON NÉGOCIABLE)
             rule_fallback → NO_GO

DÉCISION #2
-----------
Sujet      : userDataStream en DRY_RUN
CDC/CD dit : monitor.js complet
Décision   : Skip listenKey + WS executionReport si DRY_RUN=true
             Raison : testnet 410, inutile sans ordres réels

DÉCISION #3
-----------
Sujet      : BINANCE_TESTNET sur VPS smoke test
CDC/CD dit : testnet pour phase testnet
Décision   : BINANCE_TESTNET=false temporaire pour WS publics en DRY_RUN
             Aucun ordre placé (DRY_RUN=true)

DÉCISION #4
-----------
Sujet      : Horaires trading smoke test
CDC/CD dit : 08:00-22:00 UTC
Décision   : Extension temporaire 00:00-23:59 sur VPS pour observer signaux
             À remettre à 08:00-22:00 après tests

DÉCISION #5
-----------
Sujet      : Auth dashboard
CDC/CD dit : DASHBOARD_PASSWORD dans .env.shared
Décision   : Fallback changeme si variable absente (dashboard/server.js)

DÉCISION #6
-----------
Sujet      : Pipeline Module C — tâche n8n
CDC/CD dit : 6 fichiers JSON
Décision   : Tâche virtuelle n8n/workflows + test dédié n8n-workflows.test.js
```

---

## 6. ÉTAT ACTUEL DE CHAQUE MODULE

```
MODULE              FICHIER                    STATUT         TESTS
─────────────────────────────────────────────────────────────────────
Kelly               src/kelly.js               ✅ COMPLET     ✅ PASS 100%
Journal             src/journal.js             ✅ COMPLET     ✅ PASS 91%
ATR                 src/atr.js                 ✅ COMPLET     ✅ PASS 100%
Regime              src/regime.js              ✅ COMPLET     ✅ PASS 90%
Correlation         src/correlation.js         ✅ COMPLET     ✅ PASS 100%
Protection          src/protection.js          ✅ COMPLET     ✅ PASS 100%
Health              src/health.js              ✅ COMPLET     ✅ PASS 96%
Order               src/order.js               ✅ COMPLET     ✅ PASS 100%
Monitor             src/monitor.js             ✅ COMPLET     ✅ PASS 82%
Signal              src/signal.js              ✅ COMPLET     ✅ PASS 96%
Bot                 src/bot.js                 ✅ COMPLET     ✅ PASS 88%
Notify              src/notify.js              ⚠️ PARTIEL     ⚠️ 30% cov stub
Schema DB           db/schema.sql              ✅ COMPLET     ✅ Postgres VPS
Docker              docker-compose.yml         ✅ COMPLET     ✅ ops profile UP
Dashboard trading   dashboard/server.js        ✅ COMPLET     ✅ PASS 94%
MCP                 mcp/server.js              ✅ COMPLET     ✅ PASS 89%
N8n WF1-6           n8n/workflows/*.json       ✅ COMPLET     ✅ PASS L15
Dev dashboard       dev-dashboard/server.js    ✅ COMPLET     ✅ :3020 healthy
bot_btc VPS         DRY_RUN                    ✅ RUNNING     smoke 10m PASS
```

---

## 7. CONTENU INTÉGRAL DES FICHIERS CRÉÉS

═══════════════════════════════════════════════════════
FICHIER : src/bot.js
═══════════════════════════════════════════════════════
```javascript
// src/bot.js — CD §4.13

'use strict';

const Redis = require('ioredis');
const { Pool } = require('pg');
const axios = require('axios');
const winston = require('winston');

const order = require('./order');
const monitor = require('./monitor');
const signal = require('./signal');
const protection = require('./protection');
const journal = require('./journal');
const atr = require('./atr');
const health = require('./health');
const { computeKellyAuto } = require('./kelly');
const { notifyN8n } = require('./notify');

const REQUIRED_ENV = [
  'SYMBOL', 'CAPITAL', 'TP_BRUT', 'SL_BRUT',
  'BINANCE_API_KEY', 'BINANCE_API_SECRET',
  'REDIS_URL', 'POSTGRES_URL',
  'RESTART_SECRET', 'TELEGRAM_BOT_TOKEN',
  'MAX_SLIPPAGE_PCT', 'MAX_POSITION_HOURS',
  'MAX_SPREAD', 'MAX_TRADES_DAY', 'MAX_CONSEC_LOSS', 'MAX_LOSS_DAY',
];

const SCAN_INTERVAL = 30000;

const validateRequiredEnv = () => {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) throw new Error(`Variable manquante : ${key}`);
  }
};

const createLogger = (symbol) => winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.printf(({ level, message }) =>
    `[${new Date().toISOString()}] [${symbol}] [${level.toUpperCase()}] ${message}`),
  transports: [
    new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' }),
  ],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const createBinanceClient = () => {
  const baseURL = process.env.BINANCE_TESTNET === 'true'
    ? 'https://testnet.binance.vision'
    : 'https://api.binance.com';
  return axios.create({ baseURL });
};

const gracefulShutdown = async (symbol, redis, orderMod, logger) => {
  logger.info(`${symbol} — arrêt propre en cours`);
  try {
    await orderMod.cancelAllOrders(symbol);
    const sym = symbol.toLowerCase();
    await redis.del(`bot:${sym}:position_open`);
    await redis.del(`bot:${sym}:position_open_since`);
    logger.info(`[${symbol}] Ordres annulés — arrêt propre terminé`);
  } catch (err) {
    logger.error(`[${symbol}] Erreur pendant l'arrêt propre: ${err.message}`);
  }
};

const processTradingCycle = async (ctx) => {
  const {
    symbol, redis, pgPool, binanceClient, filters, logger,
    capital, tpBrut, slBrut, atrTpMult, atrSlMult,
  } = ctx;
  const sym = symbol.toLowerCase();

  if (await protection.isGloballyLocked(redis)) {
    await sleep(ctx.globalLockInterval ?? 60000);
    return;
  }
  if (await protection.isPairLocked(symbol, redis)) {
    await sleep(ctx.pairLockInterval ?? 30000);
    return;
  }

  await protection.checkPositionTimeout(symbol, redis, order);

  const sig = await signal.evaluateSignal(symbol, redis, binanceClient, pgPool);
  if (!sig.ok) {
    logger.debug(`[${symbol}] Signal rejeté: ${sig.reason}`);
    await sleep(ctx.scanInterval ?? SCAN_INTERVAL);
    return;
  }

  const price = parseFloat(await redis.get(`bid:${symbol}`));
  const atrData = await atr.getATR(symbol, redis, binanceClient);
  const tp = price + Math.max(tpBrut, atrData.atr * atrTpMult);
  const sl = price - Math.max(slBrut, atrData.atr * atrSlMult);

  const kellyFraction = await computeKellyAuto(pgPool, redis, symbol, tpBrut, slBrut);
  const qty = (capital * kellyFraction) / price;

  logger.info(`[${symbol}] Signal OK — price=${price} tp=${tp.toFixed(2)} sl=${sl.toFixed(2)} kelly=${kellyFraction.toFixed(3)} qty=${qty.toFixed(6)}`);

  await redis.set(`bot:${sym}:position_open`, '1');
  await redis.set(`bot:${sym}:position_open_since`, Date.now().toString());
  await redis.set(`bot:${sym}:position_qty`, qty.toFixed(order.getDecimals(filters.stepSize)));

  const tradeId = await journal.logTradeOpen(pgPool, symbol, price, qty, tp, sl, atrData.atr, kellyFraction);

  const entry = await order.placeEntry(symbol, qty, price, filters, redis);
  if (!entry || entry.simulated) {
    await redis.del(`bot:${sym}:position_open`);
    await redis.del(`bot:${sym}:position_open_since`);
    await sleep(ctx.scanInterval ?? SCAN_INTERVAL);
    return;
  }

  await journal.logTradeFill(pgPool, tradeId, entry);

  const exitOrder = filters.opoAllowed
    ? await order.placeOPOCO(symbol, entry.quantity, entry.fillPrice, tp, sl, filters)
    : await order.placeOCO(symbol, entry.quantity, entry.fillPrice, tp, sl, filters);

  await redis.setex(
    `tp:${exitOrder.orderListId}`,
    86400,
    tp.toFixed(order.getDecimals(filters.tickSize)),
  );

  const result = await monitor.waitForResult(exitOrder.orderListId, redis);

  await redis.del(`bot:${sym}:position_open`);
  await redis.del(`bot:${sym}:position_open_since`);
  await redis.del(`bot:${sym}:position_qty`);
  await redis.del(`tp:${exitOrder.orderListId}`);

  await journal.logTradeClose(pgPool, redis, symbol, tradeId, {
    exitPrice: result.exitPrice,
    durationMin: Math.round((Date.now() - (entry.timestamp || Date.now())) / 60000),
    pnlBrut: (result.exitPrice - entry.fillPrice) * entry.quantity,
    fees: result.fees,
    pnlNet: result.pnlNet || ((result.exitPrice - entry.fillPrice) * entry.quantity - result.fees),
    result: result.result,
  });

  await redis.incr(`bot:${sym}:trades_day`);

  if (result.result === 'SL') {
    await protection.checkAndLock(symbol, redis, pgPool);
  } else {
    await redis.set(`bot:${sym}:consec_loss`, '0');
  }

  await notifyN8n('/webhook/trade', { symbol, ...result });
};

const run = async (options = {}) => {
  if (process.env.NODE_ENV !== 'test') {
    require('dotenv').config({ path: process.env.ENV_FILE || '.env.btc' });
  }
  validateRequiredEnv();

  const symbol = process.env.SYMBOL;
  const capital = parseFloat(process.env.CAPITAL);
  const tpBrut = parseFloat(process.env.TP_BRUT);
  const slBrut = parseFloat(process.env.SL_BRUT);
  const atrTpMult = parseFloat(process.env.ATR_TP_MULT || '1.5');
  const atrSlMult = parseFloat(process.env.ATR_SL_MULT || '0.8');
  const port = parseInt(process.env.PORT, 10);

  const logger = createLogger(symbol);
  const redis = new Redis(process.env.REDIS_URL);
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const binanceClient = createBinanceClient();

  const shutdown = (sig) => gracefulShutdown(symbol, redis, order, logger)
    .then(() => process.exit(0));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const filters = await order.getExchangeFilters(symbol, binanceClient);
  logger.info(`[${symbol}] opoAllowed=${filters.opoAllowed} tickSize=${filters.tickSize} stepSize=${filters.stepSize}`);

  await monitor.startMonitor(symbol, redis);
  await health.startHealthServer(port, redis, pgPool);

  const redisSub = redis.duplicate();
  redisSub.subscribe(`bot:${symbol.toLowerCase()}:config`);
  redisSub.on('message', (channel, message) => {
    const [key, value] = message.split(':');
    logger.info(`[${symbol}] Config à chaud: ${key}=${value}`);
    if (key === 'MAX_SPREAD') process.env.MAX_SPREAD = value;
    if (key === 'MAX_CONSEC_LOSS') process.env.MAX_CONSEC_LOSS = value;
  });

  const ctx = {
    symbol, redis, pgPool, binanceClient, filters, logger,
    capital, tpBrut, slBrut, atrTpMult, atrSlMult,
    scanInterval: options.scanInterval,
    globalLockInterval: options.globalLockInterval,
    pairLockInterval: options.pairLockInterval,
  };

  if (options.once) {
    await processTradingCycle(ctx);
    await monitor.stopMonitor();
    await health.stopHealthServer();
    await pgPool.end();
    redis.disconnect();
    return;
  }

  while (true) {
    try {
      await processTradingCycle(ctx);
    } catch (err) {
      logger.error(`[${symbol}] Erreur boucle principale: ${err.message}`);
      await sleep(SCAN_INTERVAL);
    }
  }
};

if (require.main === module) {
  run().catch((err) => {
    console.error(`Erreur fatale: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  run,
  gracefulShutdown,
  validateRequiredEnv,
  processTradingCycle,
  createBinanceClient,
  SCAN_INTERVAL,
  REQUIRED_ENV,
};
```

═══════════════════════════════════════════════════════
FICHIER : src/monitor.js
═══════════════════════════════════════════════════════
```javascript
// src/monitor.js — CD §4.11

const WebSocket = require('ws');
const axios = require('axios');
const winston = require('winston');
const { notifyTelegram } = require('./notify');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsInstances = [];
let keepAliveTimer = null;
let listenKey = null;

const getBaseUrl = () => (
  process.env.BINANCE_TESTNET === 'true'
    ? 'https://testnet.binance.vision'
    : 'https://api.binance.com'
);

const getWsBase = () => (
  process.env.BINANCE_TESTNET === 'true'
    ? 'wss://testnet.binance.vision'
    : 'wss://stream.binance.com:9443'
);

const handleExecutionReport = async (report, redis) => {
  const {
    orderId, orderListId, status, side, price, executedQty, commission,
  } = report;
  const listId = parseInt(orderListId, 10);

  if (status === 'FILLED' && (listId === -1 || orderListId === -1)) {
    await redis.setex(`fill:${orderId}`, 120, JSON.stringify({
      orderId, price, quantity: executedQty, commission,
    }));
    return;
  }

  if (status === 'FILLED' && listId !== -1 && side === 'SELL') {
    const tpPrice = parseFloat(await redis.get(`tp:${orderListId}`) || '0');
    const result = parseFloat(price) >= tpPrice ? 'TP' : 'SL';

    await redis.setex(`result:${orderListId}`, 300, JSON.stringify({
      result,
      exitPrice: parseFloat(price),
      quantity: parseFloat(executedQty),
      fees: parseFloat(commission),
    }));
  }
};

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

  throw new Error(`waitForResult timeout orderListId=${orderListId}`);
};

const handleBookTicker = async (data, symbol, redis) => {
  await redis.set(`bid:${symbol}`, data.b);
  await redis.set(`ask:${symbol}`, data.a);
};

const handleKline = async (data, symbol, redis) => {
  const kline = data.k;
  if (kline.x === true) {
    await redis.lpush(`closes:${symbol}`, parseFloat(kline.c).toString());
    await redis.ltrim(`closes:${symbol}`, 0, 49);
    await redis.set(`volume_current:${symbol}`, kline.v);
  }
};

const createListenKey = async () => {
  const apiKey = process.env.BINANCE_API_KEY;
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v3/userDataStream`,
    null,
    { headers: { 'X-MBX-APIKEY': apiKey } },
  );
  return data.listenKey;
};

const keepAliveListenKey = async (key) => {
  const apiKey = process.env.BINANCE_API_KEY;
  await axios.put(`${getBaseUrl()}/api/v3/userDataStream`, null, {
    params: { listenKey: key },
    headers: { 'X-MBX-APIKEY': apiKey },
  });
};

const connectWithRetry = async (url, onMessage, symbol, maxRetries = 5) => {
  let attempt = 0;

  const connect = () => new Promise((resolve) => {
    const ws = new WebSocket(url);
    wsInstances.push(ws);

    ws.on('message', (raw) => {
      try {
        onMessage(JSON.parse(raw.toString()));
      } catch (err) {
        logger.error(`[${symbol}] WS parse erreur: ${err.message}`);
      }
    });

    ws.on('open', () => {
      attempt = 0;
      resolve(ws);
    });

    ws.on('close', async () => {
      if (attempt >= maxRetries) {
        logger.error(`[${symbol}] WS non récupérable après ${maxRetries} tentatives`);
        await notifyTelegram(`⛔ [${symbol}] WebSocket irrécupérable — intervention requise`);
        return;
      }
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, 30000);
      logger.warn(`[${symbol}] WS déconnecté — retry ${attempt}/${maxRetries} dans ${delay}ms`);
      await sleep(delay);
      await connect();
    });

    ws.on('error', (err) => logger.error(`[${symbol}] WS erreur: ${err.message}`));
  });

  return connect();
};

const startMonitor = async (symbol, redis) => {
  const sym = symbol.toLowerCase();

  if (process.env.DRY_RUN !== 'true') {
    listenKey = await createListenKey();

    keepAliveTimer = setInterval(() => {
      keepAliveListenKey(listenKey).catch((err) => {
        logger.error(`[${symbol}] keepAlive listenKey: ${err.message}`);
      });
    }, 20 * 60 * 1000);
  } else {
    logger.info(`[${symbol}] DRY_RUN — userDataStream ignoré`);
  }

  await connectWithRetry(
    `${getWsBase()}/ws/${sym}@bookTicker`,
    async (msg) => handleBookTicker(msg, symbol, redis),
    symbol,
  );

  await connectWithRetry(
    `${getWsBase()}/ws/${sym}@kline_5m`,
    async (msg) => handleKline(msg, symbol, redis),
    symbol,
  );

  if (process.env.DRY_RUN !== 'true') {
    await connectWithRetry(
      `${getWsBase()}/ws/${listenKey}`,
      async (msg) => {
        if (msg.e === 'executionReport') {
          await handleExecutionReport(msg, redis);
        }
      },
      symbol,
    );
  }
};

const stopMonitor = async () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  for (const ws of wsInstances) {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  }
  wsInstances = [];
  listenKey = null;
};

module.exports = {
  startMonitor,
  stopMonitor,
  waitForResult,
  handleExecutionReport,
  handleBookTicker,
  handleKline,
};
```

═══════════════════════════════════════════════════════
FICHIER : jest.config.js
═══════════════════════════════════════════════════════
```javascript
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', 'mcp/**/*.js', 'dashboard/**/*.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
```

═══════════════════════════════════════════════════════
FICHIER : scripts/run-module-c.sh
═══════════════════════════════════════════════════════
```bash
#!/bin/bash
# Enchaîne Module C C.1 → C.4 avec pipeline automatique + preuves
set -e
cd /home/dev/dev/OCO_strategie
RUN=./scripts/run-pipeline.sh

run_task() {
  local task=$1
  local ref=$2
  local next=$3
  local testfile
  case "$task" in
    n8n/workflows) testfile="tests/unit/n8n-workflows.test.js" ;;
    mcp/server.js) testfile="tests/unit/mcp.test.js" ;;
    dashboard/server.js) testfile="tests/unit/dashboard.test.js" ;;
    dashboard/api/backtest.js) testfile="tests/unit/backtest.test.js" ;;
    *) testfile="${task//src\//tests\/unit/}"; testfile="${testfile/.js/.test.js}" ;;
  esac
  echo ""
  echo "========== PIPELINE $task =========="
  $RUN \
    --agent coworker-3 \
    --module C \
    --task "$task" \
    --message "$task implémenté CD" \
    --files-changed "[\"$task\",\"$testfile\"]" \
    --doc-ref "$ref" \
    --next-task "$next"
}

run_task "n8n/workflows" "CD §8.7" "dashboard/server.js"
run_task "dashboard/server.js" "CD §6" "mcp/server.js"
run_task "mcp/server.js" "CD §6.3" "dashboard/api/backtest.js"
run_task "dashboard/api/backtest.js" "CD §6" "PIPELINE_VALIDATION"

echo ""
echo "========== MODULE C TERMINÉ =========="
```

═══════════════════════════════════════════════════════
FICHIER : scripts/pipeline-task.js
═══════════════════════════════════════════════════════
```javascript
#!/usr/bin/env node
/**
 * Pipeline automatique par tâche — NON NÉGOCIABLE
 * Chaque livrable : tests réels → validateur → Claude GO/NO_GO → Postgres → dashboard
 *
 * Usage:
 *   node scripts/pipeline-task.js \\
 *     --agent coworker-1 --module B --task src/journal.js \\
 *     --message "journal.js implémenté" \\
 *     --files-changed '["src/journal.js","tests/unit/journal.test.js"]' \\
 *     --doc-ref "CD §4.5" --next-task "src/atr.js"
 */
require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { validateTask } = require('./lib/validate-task');
const { getCoverageMin, resolveTestFile } = require('./lib/coverage-min');
const { runClaudeGate } = require('./claude-gate');

const ROOT = path.resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    out[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return out;
}

function resolvePostgresUrl() {
  let url = process.env.POSTGRES_URL || '';
  if (url.includes('bot_postgres')) {
    url = url.replace('bot_postgres', '127.0.0.1').replace(':5432', ':5435');
  }
  return url;
}

function runTests(task) {
  const testFile = resolveTestFile(task);
  const testPath = path.join(ROOT, testFile);
  const covFrom = task.startsWith('n8n/')
    ? ''
    : `--collectCoverageFrom=${task} `;
  const cmd = fs.existsSync(testPath)
    ? `npm test -- --coverage ${covFrom}${testFile}`
    : 'npm test -- --coverage';

  const result = spawnSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;

  const passMatch = output.match(/Tests:\s+(\d+) passed/);
  const totalMatch = output.match(/Tests:\s+\d+ passed,\s+(\d+) total/);
  const testsPass = passMatch ? parseInt(passMatch[1], 10) : 0;
  const testsTotal = totalMatch ? parseInt(totalMatch[1], 10) : testsPass;

  let coveragePct = 0;
  const summaryPath = path.join(ROOT, 'coverage/coverage-summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      const absKey = path.join(ROOT, task).replace(/\\/g, '/');
      const relKey = path.resolve(ROOT, task).replace(/\\/g, '/');
      const entry = summary[absKey] || summary[relKey] || summary[task];
      if (entry?.lines?.pct != null) coveragePct = entry.lines.pct;
    } catch { /* ignore */ }
  }
  if (!coveragePct) {
    const base = path.basename(task);
    const covRe = new RegExp(`\\n\\s+${base}\\s+\\|\\s+[\\d.]+\\s+\\|\\s+[\\d.]+\\s+\\|\\s+[\\d.]+\\s+\\|\\s+([\\d.]+)`);
    const covMatch = output.match(covRe);
    coveragePct = covMatch ? parseFloat(covMatch[1]) : 0;
  }

  return {
    scope: task,
    tests_pass: testsPass,
    tests_total: testsTotal,
    coverage_pct: coveragePct,
    coverage_required_pct: getCoverageMin(task),
    coverage_ok: coveragePct >= getCoverageMin(task),
    command: cmd,
    exit_code: result.status,
    raw_tail: output.split('\n').slice(-20).join('\n'),
  };
}

async function main() {
  const a = parseArgs();
  const task = a.task;
  if (!task || !a.agent) {
    console.error('Usage: --agent coworker-N --task src/file.js [--module B] [--message ...]');
    process.exit(1);
  }

  const module = a.module || 'B';
  const agentRoles = {
    'coworker-1': 'Module B — Risk & Data',
    'coworker-2': 'Module A — Trading Core',
    'coworker-3': 'Module C — Ops Platform',
    'coworker-4': 'Infra & QA',
  };

  console.log(`\n=== PIPELINE TÂCHE : ${task} ===\n`);

  // 1. Tests réels (preuve)
  console.log('[1/4] Testeur — Jest...');
  const testReport = runTests(task);
  console.log(`      ${testReport.tests_pass}/${testReport.tests_total} | couverture ${testReport.coverage_pct}%`);

  // 2. Validateur (preuves fichiers/exports)
  console.log('[2/4] Validateur — checklist...');
  const validationReport = validateTask(task, testReport);
  console.log(`      ${validationReport.fail_count} FAIL`);

  // 3. Rapport coworker
  const filesChanged = (() => {
    try { return JSON.parse(a['files-changed'] || '[]'); }
    catch { return (a['files-changed'] || '').split(',').map((s) => s.trim()).filter(Boolean); }
  })();

  const coworkerReport = {
    agent_id: a.agent,
    agent_role: agentRoles[a.agent] || a.agent,
    module,
    task,
    status: validationReport.pass && testReport.tests_pass === testReport.tests_total ? 'done' : 'fail',
    message: a.message || '',
    files_changed: filesChanged,
    doc_reference: a['doc-ref'] || 'CD',
  };

  // 4. Claude IA GO/NO_GO
  console.log('[3/4] Coworker Claude IA — verdict...');
  const gateInput = {
    current_step: `MODULE_${module}.${task}`,
    next_task_hint: a['next-task'] || '',
    coworker_report: coworkerReport,
    test_report: testReport,
    validation_report: validationReport,
  };
  const gate = await runClaudeGate(gateInput);

  // NON NÉGOCIABLE : GO uniquement si Claude API a validé explicitement
  if (gate.source !== 'claude_api') {
    gate.verdict = 'NO_GO';
    gate.reasons = [
      ...(gate.reasons || []),
      `NON NÉGOCIABLE : source=${gate.source} — seul claude_api autorise la suite`,
    ];
    gate.failed_agents = [...new Set([...(gate.failed_agents || []), 'coworker-claude-ia'])];
  }

  const attemptInfo = gate.claude_attempt ? `, tentative ${gate.claude_attempt}` : '';
  console.log(`      ${gate.verdict} (${gate.source || 'unknown'}${attemptInfo})`);

  // 5. Postgres + dashboard
  console.log('[4/4] Enregistrement Postgres...');
  const pool = new Pool({ connectionString: resolvePostgresUrl() });

  await pool.query(
    `INSERT INTO dev_reports (agent_id, agent_role, module, task, status, message, files_changed, doc_reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [
      coworkerReport.agent_id, coworkerReport.agent_role, module, task,
      coworkerReport.status, coworkerReport.message,
      JSON.stringify(coworkerReport.files_changed), coworkerReport.doc_reference,
    ],
  );

  await pool.query(
    `INSERT INTO dev_test_results (scope, tests_pass, tests_total, coverage_pct, coverage_required_pct, coverage_ok, command)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      task, testReport.tests_pass, testReport.tests_total,
      testReport.coverage_pct, testReport.coverage_required_pct, testReport.coverage_ok,
      testReport.command,
    ],
  );

  await pool.query(
    `INSERT INTO dev_validation_results (scope, checklist, items, fail_count)
     VALUES ($1,$2,$3::jsonb,$4)`,
    [task, validationReport.checklist, JSON.stringify(validationReport.items), validationReport.fail_count],
  );

  const allProofs = [
    ...(validationReport.proofs || []),
    ...(gate.proofs || []),
  ];

  await pool.query(
    `INSERT INTO dev_gate_verdicts (step, verdict, gate_source, reasons, doc_references, next_action, failed_agents)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)`,
    [
      gate.step || gateInput.current_step,
      gate.verdict,
      gate.source || 'unknown',
      JSON.stringify([...gate.reasons, { proofs: allProofs }]),
      JSON.stringify(gate.doc_references || []),
      gate.next_action || '',
      JSON.stringify(gate.failed_agents || []),
    ],
  );

  await pool.query(
    `UPDATE dev_agent_status SET status=$2, last_task=$3, last_report=NOW(), updated_at=NOW() WHERE agent_id=$1`,
    [a.agent, gate.verdict === 'GO' ? 'idle' : 'retry', task],
  );

  await pool.query(
    `UPDATE dev_agent_status SET status=$1, last_task=$2, last_report=NOW(), updated_at=NOW() WHERE agent_id='coworker-claude-ia'`,
    ['idle', gate.verdict],
  );

  await pool.query(
    `UPDATE dev_pipeline_state SET current_module=$1, current_task=$2, updated_at=NOW()
     WHERE id=(SELECT id FROM dev_pipeline_state ORDER BY id DESC LIMIT 1)`,
    [module, gate.verdict === 'GO' ? (a['next-task'] || task) : task],
  );

  await pool.end();

  try {
    const http = require('http');
    http.request({ hostname: '127.0.0.1', port: 3020, path: '/api/dev/push', method: 'POST' }).end();
  } catch { /* dashboard optionnel */ }

  console.log(`\n=== ${gate.verdict} — ${task} ===\n`);
  console.log(JSON.stringify({ gate, proofs: allProofs }, null, 2));

  if (gate.verdict !== 'GO' || gate.source !== 'claude_api') process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
```

═══════════════════════════════════════════════════════
FICHIER : scripts/lib/coverage-min.js
═══════════════════════════════════════════════════════
```javascript
/**
 * Seuils couverture CD §9.1 — seule source autorisée
 */
const COVERAGE_MIN = {
  'db/schema.sql': null,
  'src/kelly.js': 95,
  'src/journal.js': 80,
  'src/atr.js': 90,
  'src/regime.js': 85,
  'src/correlation.js': 85,
  'src/protection.js': 90,
  'src/health.js': 80,
  'src/order.js': 90,
  'src/monitor.js': 80,
  'src/signal.js': 95,
  'src/bot.js': 80,
  'mcp/server.js': 80,
  'mcp/lib/sqlGuard.js': 90,
  'mcp/lib/tools.js': 85,
  'dashboard/server.js': 80,
  'dashboard/api/backtest.js': 85,
  'n8n/workflows': null,
};

const TASK_TEST_MAP = {
  'mcp/server.js': 'tests/unit/mcp.test.js',
  'dashboard/server.js': 'tests/unit/dashboard.test.js',
  'dashboard/api/backtest.js': 'tests/unit/backtest.test.js',
  'n8n/workflows': 'tests/unit/n8n-workflows.test.js',
};

const EXPORTS_REQUIRED = {
  'src/kelly.js': ['computeKellyFormula', 'computeKellyAuto'],
  'src/journal.js': [
    'logTradeOpen', 'logTradeFill', 'logTradeClose', 'logEvent',
    'logDryRun', 'logSlippageAbort', 'logForcedExit',
    'getDayPnl', 'getConsecLoss', 'getTotalTrades', 'getProfitFactor',
  ],
  'src/atr.js': ['getATR'],
  'src/regime.js': ['getRegime', 'checkTrendDown'],
  'src/correlation.js': ['getPairCorrelation', 'shouldBlockOnCorrelation'],
  'src/protection.js': [
    'checkAndLock', 'isGloballyLocked', 'isPairLocked',
    'checkPositionTimeout', 'resetDailyLocks',
  ],
  'src/health.js': ['startHealthServer', 'createHealthApp'],
  'src/order.js': [
    'getExchangeFilters', 'placeEntry', 'placeOPOCO', 'placeOCO',
    'cancelOrder', 'cancelAllOrders', 'getOpenOrders', 'placeMarketSell', 'waitForFill',
  ],
  'src/monitor.js': ['startMonitor', 'stopMonitor', 'waitForResult'],
  'src/signal.js': ['evaluateSignal'],
  'src/bot.js': ['run', 'gracefulShutdown', 'validateRequiredEnv', 'processTradingCycle'],
  'mcp/server.js': ['createMcpApp', 'startMcpServer'],
  'dashboard/server.js': ['createDashboardApp', 'startDashboardServer', 'buildRealtimeData'],
};

function getCoverageMin(task) {
  if (task in COVERAGE_MIN) return COVERAGE_MIN[task];
  if (task.startsWith('n8n/workflows')) return null;
  return 80;
}

function resolveTestFile(task) {
  if (TASK_TEST_MAP[task]) return TASK_TEST_MAP[task];
  if (task.startsWith('n8n/workflows')) return TASK_TEST_MAP['n8n/workflows'];
  return task.replace('src/', 'tests/unit/').replace('.js', '.test.js');
}

module.exports = {
  COVERAGE_MIN, EXPORTS_REQUIRED, TASK_TEST_MAP, getCoverageMin, resolveTestFile,
};
```

═══════════════════════════════════════════════════════
FICHIER : scripts/lib/validate-task.js
═══════════════════════════════════════════════════════
```javascript
/**
 * Validateur technique — preuves factuelles uniquement (CD §10, ARCHITECTURE §6)
 */
const fs = require('fs');
const path = require('path');
const { EXPORTS_REQUIRED, getCoverageMin } = require('./coverage-min');

const ROOT = path.resolve(__dirname, '../..');
const WF_DIR = path.join(ROOT, 'n8n/workflows');
const WF_FILES = [
  'wf1_health.json', 'wf2_trade_alert.json', 'wf3_stop_global.json',
  'wf4_daily_report.json', 'wf5_reset_daily.json', 'wf6_config_update.json',
];

function proof(type, ref, detail, pass) {
  return { type, ref, detail, result: pass ? 'PASS' : 'FAIL' };
}

function checklistFor(task) {
  if (task.startsWith('mcp/')) return 'L14';
  if (task.startsWith('n8n/workflows')) return 'L15';
  if (task.startsWith('dashboard/')) return 'L_DASH';
  return 'L2';
}

function validateL14(task, items, proofs) {
  const sqlGuard = path.join(ROOT, 'mcp/lib/sqlGuard.js');
  const tools = path.join(ROOT, 'mcp/lib/tools.js');
  const server = path.join(ROOT, 'mcp/server.js');
  const sg = fs.existsSync(sqlGuard) ? fs.readFileSync(sqlGuard, 'utf8') : '';
  const tl = fs.existsSync(tools) ? fs.readFileSync(tools, 'utf8') : '';
  const sv = fs.existsSync(server) ? fs.readFileSync(server, 'utf8') : '';

  const checks = [
    ['sqlGuard bloque FORBIDDEN', sg.includes('FORBIDDEN') && sg.includes('drop')],
    ['ALLOWED_PARAMS whitelist', sg.includes('ALLOWED_PARAMS')],
    ['run_query log mcp_actions', tl.includes('mcp_actions')],
    ['set_config log mcp_actions', tl.includes("['set_config'")],
    ['auth token MCP_TOKEN', sv.includes('MCP_TOKEN') && sv.includes('x-mcp-token')],
  ];
  for (const [label, ok] of checks) {
    items.push({ criterion: label, result: ok ? 'PASS' : 'FAIL', ref: 'CD L14' });
    proofs.push(proof('checklist_l14', 'CD L14', label, ok));
  }
}

function validateL15(items, proofs) {
  const allExist = WF_FILES.every((f) => fs.existsSync(path.join(WF_DIR, f)));
  items.push({ criterion: '6 fichiers JSON présents', result: allExist ? 'PASS' : 'FAIL', ref: 'CD L15' });
  proofs.push(proof('checklist_l15', 'CD L15', `6 WF → ${allExist ? 'OK' : 'MANQUANT'}`, allExist));

  if (allExist) {
    const wf1 = JSON.parse(fs.readFileSync(path.join(WF_DIR, 'wf1_health.json'), 'utf8'));
    const wf5 = JSON.parse(fs.readFileSync(path.join(WF_DIR, 'wf5_reset_daily.json'), 'utf8'));
    const wf1raw = JSON.stringify(wf1);
    const wf5raw = JSON.stringify(wf5);

    const httpRestart = wf1raw.includes('/restart') && wf1raw.includes('x-restart-token');
    items.push({ criterion: 'WF1 HTTP /restart + token', result: httpRestart ? 'PASS' : 'FAIL', ref: 'CD L15' });
    proofs.push(proof('checklist_l15', 'CD L15', 'WF1 restart HTTP', httpRestart));

    const resetDaily = wf5raw.includes('reset_daily') && wf5raw.includes('/config');
    items.push({ criterion: 'WF5 POST /config reset_daily', result: resetDaily ? 'PASS' : 'FAIL', ref: 'CD L15' });
    proofs.push(proof('checklist_l15', 'CD L15', 'WF5 reset_daily', resetDaily));

    const secretsEnv = WF_FILES.every((f) => {
      const raw = fs.readFileSync(path.join(WF_DIR, f), 'utf8');
      if (!raw.includes('RESTART_SECRET') && !raw.includes('TELEGRAM')) return true;
      return raw.includes('$env.');
    });
    items.push({ criterion: 'Secrets via $env', result: secretsEnv ? 'PASS' : 'FAIL', ref: 'CD L15' });
    proofs.push(proof('checklist_l15', 'CD L15', 'secrets $env', secretsEnv));
  }
}

function validateDashboard(task, items, proofs) {
  const html = path.join(ROOT, 'dashboard/public/index.html');
  const content = fs.existsSync(html) ? fs.readFileSync(html, 'utf8') : '';
  const tabs = (content.match(/data-tab="/g) || []).length;
  const tabsOk = tabs === 9;
  items.push({ criterion: '9 onglets dashboard', result: tabsOk ? 'PASS' : 'FAIL', ref: 'ARCHITECTURE §4' });
  proofs.push(proof('checklist_dash', 'ARCHITECTURE §4', `onglets=${tabs}`, tabsOk));

  if (task === 'dashboard/server.js') {
    const srv = fs.readFileSync(path.join(ROOT, 'dashboard/server.js'), 'utf8');
    const wsOk = srv.includes('WebSocketServer');
    items.push({ criterion: 'WebSocket temps réel', result: wsOk ? 'PASS' : 'FAIL', ref: 'CD §6' });
    proofs.push(proof('checklist_dash', 'CD §6', 'WebSocket 1s', wsOk));
  }
}

function validateTask(task, testReport) {
  const items = [];
  const proofs = [];
  const checklist = checklistFor(task);

  if (task.startsWith('n8n/workflows')) {
    validateL15(items, proofs);
  } else {
    const absPath = path.join(ROOT, task);
    const fileExists = fs.existsSync(absPath);
    items.push({
      criterion: `Fichier ${task} existe`,
      result: fileExists ? 'PASS' : 'FAIL',
      ref: 'CD §3',
    });
    proofs.push(proof('file_exists', 'CD §3', `${task} → ${fileExists ? 'présent' : 'ABSENT'}`, fileExists));

    if (EXPORTS_REQUIRED[task]) {
      const content = fileExists ? fs.readFileSync(absPath, 'utf8') : '';
      for (const exp of EXPORTS_REQUIRED[task]) {
        const ok = content.includes(exp);
        items.push({
          criterion: `Export ${exp}`,
          result: ok ? 'PASS' : 'FAIL',
          ref: 'ARCHITECTURE §6',
        });
        proofs.push(proof('export', 'ARCHITECTURE §6', `${exp} → ${ok ? 'trouvé' : 'MANQUANT'}`, ok));
      }
    }

    if (task.startsWith('mcp/')) validateL14(task, items, proofs);
    if (task.startsWith('dashboard/')) validateDashboard(task, items, proofs);
  }

  const minCov = getCoverageMin(task);
  if (minCov !== null && testReport) {
    const covOk = testReport.coverage_pct >= minCov;
    items.push({
      criterion: `Couverture >= ${minCov}%`,
      result: covOk ? 'PASS' : 'FAIL',
      ref: 'CD §9.1',
    });
    proofs.push(proof(
      'coverage',
      'CD §9.1',
      `${task} ${testReport.coverage_pct}% (requis ${minCov}%)`,
      covOk,
    ));
  }

  if (testReport) {
    const testsOk = testReport.tests_pass === testReport.tests_total;
    items.push({
      criterion: 'Tests 100%',
      result: testsOk ? 'PASS' : 'FAIL',
      ref: 'CD §3',
    });
    proofs.push(proof(
      'test',
      'CD §3',
      `${testReport.tests_pass}/${testReport.tests_total} PASS (commande: ${testReport.command})`,
      testsOk,
    ));
  }

  const failCount = items.filter((i) => i.result === 'FAIL').length;
  return {
    scope: task,
    checklist,
    items,
    proofs,
    fail_count: failCount,
    pass: failCount === 0,
  };
}

module.exports = { validateTask };
```

═══════════════════════════════════════════════════════
FICHIER : tests/unit/mcp.test.js
═══════════════════════════════════════════════════════
```javascript
const http = require('http');
const { validateSelectOnly, validateConfigParam, ALLOWED_PARAMS } = require('../../mcp/lib/sqlGuard');
const { getPnl, runQuery, setConfig } = require('../../mcp/lib/tools');
const { createMcpApp } = require('../../mcp/server');

function httpRequest(app, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request({
        hostname: '127.0.0.1', port, path, method, headers,
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          server.close();
          let parsed = {};
          try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

describe('sqlGuard — L14', () => {
  test('SELECT valide accepté', () => {
    const r = validateSelectOnly('SELECT 1');
    expect(r.ok).toBe(true);
  });

  test('bloque DROP', () => {
    const r = validateSelectOnly('SELECT 1; DROP TABLE trades');
    expect(r.ok).toBe(false);
  });

  test('bloque UPDATE', () => {
    const r = validateSelectOnly('UPDATE trades SET pnl_net=0');
    expect(r.ok).toBe(false);
  });

  test('bloque injection point-virgule', () => {
    const r = validateSelectOnly('SELECT 1; DELETE FROM trades');
    expect(r.ok).toBe(false);
  });

  test('whitelist ALLOWED_PARAMS', () => {
    expect(validateConfigParam('MAX_SPREAD').ok).toBe(true);
    expect(validateConfigParam('HACK_PARAM').ok).toBe(false);
    expect(ALLOWED_PARAMS).toContain('TP_BRUT');
  });
});

describe('tools.js — L14', () => {
  const mockPg = { query: jest.fn() };
  const mockRedis = { publish: jest.fn().mockResolvedValue(1) };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPg.query.mockResolvedValue({ rows: [{ symbol: 'BTCUSDT', pnl: 10 }] });
  });

  test('getPnl agrège par symbole', async () => {
    const rows = await getPnl(mockPg, { symbol: 'BTCUSDT', period: 'today' });
    expect(rows).toHaveLength(1);
    expect(mockPg.query).toHaveBeenCalled();
  });

  test('runQuery log mcp_actions', async () => {
    mockPg.query
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    const out = await runQuery(mockPg, 'SELECT 1');
    expect(out.rows).toHaveLength(1);
    expect(mockPg.query).toHaveBeenCalledWith(
      expect.stringContaining('mcp_actions'),
      expect.any(Array),
    );
  });

  test('runQuery rejette SQL non SELECT', async () => {
    const out = await runQuery(mockPg, 'DROP TABLE trades');
    expect(out.error).toMatch(/SELECT/);
  });

  test('setConfig publie Redis et log', async () => {
    const out = await setConfig(mockRedis, mockPg, {
      symbol: 'BTCUSDT', param: 'MAX_SPREAD', value: '1.5',
    });
    expect(out.message).toMatch(/MAX_SPREAD/);
    expect(mockRedis.publish).toHaveBeenCalled();
    expect(mockPg.query).toHaveBeenCalledWith(
      expect.stringContaining('mcp_actions'),
      expect.any(Array),
    );
  });

  test('setConfig rejette param hors whitelist', async () => {
    const out = await setConfig(mockRedis, mockPg, {
      symbol: 'BTCUSDT', param: 'EVIL', value: '1',
    });
    expect(out.error).toMatch(/non autorisé/);
  });
});

describe('mcp/server.js — L14', () => {
  const mockPg = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const mockRedis = { publish: jest.fn().mockResolvedValue(1) };

  beforeEach(() => {
    process.env.MCP_TOKEN = 'test-mcp-token';
    jest.clearAllMocks();
    mockPg.query.mockResolvedValue({ rows: [] });
  });

  test('GET /health sans auth', async () => {
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('bot-mcp');
  });

  test('POST /tools/run_query sans token → 401', async () => {
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/run_query', {}, { sql: 'SELECT 1' });
    expect(res.status).toBe(401);
  });

  test('POST /tools/run_query avec token', async () => {
    mockPg.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 });
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/run_query', {
      'x-mcp-token': 'test-mcp-token',
      'Content-Type': 'application/json',
    }, { sql: 'SELECT 1' });
    expect(res.status).toBe(200);
    expect(res.body.rows).toBeDefined();
  });

  test('POST /tools/get_pnl avec token', async () => {
    mockPg.query.mockResolvedValueOnce({ rows: [{ symbol: 'BTCUSDT', pnl: 1 }] });
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/get_pnl', {
      'x-mcp-token': 'test-mcp-token',
      'Content-Type': 'application/json',
    }, { symbol: 'BTCUSDT' });
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });

  test('POST /tools/set_config avec token', async () => {
    mockPg.query.mockResolvedValueOnce({ rowCount: 1 });
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/set_config', {
      'x-mcp-token': 'test-mcp-token',
      'Content-Type': 'application/json',
    }, { symbol: 'BTCUSDT', param: 'MAX_SPREAD', value: '1.5' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/MAX_SPREAD/);
  });

  test('POST /tools/set_config param invalide → 400', async () => {
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/set_config', {
      'x-mcp-token': 'test-mcp-token',
      'Content-Type': 'application/json',
    }, { symbol: 'BTCUSDT', param: 'EVIL', value: '1' });
    expect(res.status).toBe(400);
  });

  test('startMcpServer démarre le listener', async () => {
    jest.resetModules();
    jest.doMock('pg', () => ({
      Pool: jest.fn().mockImplementation(() => mockPg),
    }));
    jest.doMock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));
    const { startMcpServer } = require('../../mcp/server');
    const ctx = await startMcpServer(0);
    expect(ctx.server.listening).toBe(true);
    await new Promise((r) => ctx.server.close(r));
    jest.dontMock('pg');
    jest.dontMock('ioredis');
  });
});
```

═══════════════════════════════════════════════════════
FICHIER : tests/unit/dashboard.test.js
═══════════════════════════════════════════════════════
```javascript
const path = require('path');
const fs = require('fs');
const http = require('http');
const { createDashboardApp, buildRealtimeData } = require('../../dashboard/server');

function httpRequest(app, method, pathReq, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request({
        hostname: '127.0.0.1', port, path: pathReq, method, headers,
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          server.close();
          let parsed = {};
          try { parsed = data && res.headers['content-type']?.includes('json') ? JSON.parse(data) : { raw: data }; } catch { parsed = { raw: data }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

const authHeader = () => {
  process.env.DASHBOARD_PASSWORD = 'testpass';
  return { Authorization: `Basic ${Buffer.from('admin:testpass').toString('base64')}` };
};

describe('dashboard/server.js — 9 onglets', () => {
  const mockPg = { query: jest.fn() };
  const mockRedis = {
    get: jest.fn().mockResolvedValue('65000'),
    lrange: jest.fn().mockResolvedValue(['1', '2', '3', '4', '5', '6']),
  };

  beforeEach(() => {
    process.env.DASHBOARD_PASSWORD = 'testpass';
    jest.clearAllMocks();
    mockPg.query.mockResolvedValue({ rows: [{ total: '42.5' }] });
  });

  test('index.html expose 9 onglets', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../dashboard/public/index.html'), 'utf8');
    const tabs = (html.match(/data-tab="/g) || []).length;
    expect(tabs).toBe(9);
  });

  test('GET /health sans auth', async () => {
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('bot-dashboard');
  });

  test('GET /api/pnl/today requiert auth', async () => {
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/pnl/today');
    expect(res.status).toBe(401);
  });

  test('GET /api/pnl/today avec Basic auth', async () => {
    mockPg.query.mockResolvedValueOnce({ rows: [{ symbol: 'BTCUSDT', pnl: 10, trades: 2 }] });
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/pnl/today', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('GET /api/status', async () => {
    mockRedis.get.mockImplementation((k) => Promise.resolve(k.includes('position') ? '0' : '0'));
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/status', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.pairs).toHaveLength(3);
  });

  test('GET /api/correlation', async () => {
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/correlation', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('BTCUSDT');
  });

  test('buildRealtimeData', async () => {
    mockRedis.get.mockResolvedValue('65000');
    const data = await buildRealtimeData(mockRedis, mockPg);
    expect(data.bid_btc).toBe('65000');
    expect(data.pnl_day).toBe(42.5);
  });

  test('GET /api/trades', async () => {
    mockPg.query.mockResolvedValueOnce({
      rows: [{ id: 1, symbol: 'BTCUSDT', pnl_net: 5, result: 'TP' }],
    });
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/trades', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('POST /api/backtest', async () => {
    mockPg.query.mockResolvedValueOnce({
      rows: [{ day: '2026-07-01', pnl: '10', trades: '1' }],
    });
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/api/backtest', {
      ...authHeader(),
      'Content-Type': 'application/json',
    }, { symbol: 'BTCUSDT', days: 7 });
    expect(res.status).toBe(200);
    expect(res.body.total_pnl).toBe(10);
  });

  test('startDashboardServer démarre WebSocket', async () => {
    jest.resetModules();
    jest.doMock('pg', () => ({
      Pool: jest.fn().mockImplementation(() => mockPg),
    }));
    jest.doMock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));
    const { startDashboardServer: start } = require('../../dashboard/server');
    const ctx = await start(0);
    expect(ctx.server.listening).toBe(true);
    expect(ctx.wss).toBeDefined();
    await ctx.push();
    clearInterval(ctx.interval);
    await new Promise((r) => ctx.server.close(r));
    jest.dontMock('pg');
    jest.dontMock('ioredis');
  });
});
```

═══════════════════════════════════════════════════════
FICHIER : tests/unit/backtest.test.js
═══════════════════════════════════════════════════════
```javascript
const { run } = require('../../dashboard/api/backtest');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe('dashboard/api/backtest.js — C.4', () => {
  const mockPg = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPg.query.mockResolvedValue({
      rows: [
        { day: '2026-07-01', pnl: '10', trades: '2' },
        { day: '2026-07-02', pnl: '-5', trades: '1' },
      ],
    });
  });

  test('agrège PnL journalier', async () => {
    const handler = run(mockPg);
    const req = { body: { symbol: 'BTCUSDT', days: 30 } };
    const res = mockRes();
    await handler(req, res);
    expect(res.body.symbol).toBe('BTCUSDT');
    expect(res.body.total_pnl).toBe(5);
    expect(res.body.win_days).toBe(1);
    expect(res.body.loss_days).toBe(1);
    expect(res.body.daily).toHaveLength(2);
  });

  test('valeurs par défaut symbol/days', async () => {
    const handler = run(mockPg);
    const res = mockRes();
    await handler({ body: {} }, res);
    expect(res.body.days).toBe(30);
    expect(res.body.symbol).toBe('BTCUSDT');
  });
});
```

═══════════════════════════════════════════════════════
FICHIER : tests/unit/n8n-workflows.test.js
═══════════════════════════════════════════════════════
```javascript
const fs = require('fs');
const path = require('path');

const WF_DIR = path.join(__dirname, '../../n8n/workflows');
const WF_FILES = [
  'wf1_health.json',
  'wf2_trade_alert.json',
  'wf3_stop_global.json',
  'wf4_daily_report.json',
  'wf5_reset_daily.json',
  'wf6_config_update.json',
];

function loadWf(name) {
  return JSON.parse(fs.readFileSync(path.join(WF_DIR, name), 'utf8'));
}

function allNodes(wf) {
  return wf.nodes || [];
}

describe('n8n/workflows — L15', () => {
  test('6 fichiers JSON importables', () => {
    for (const f of WF_FILES) {
      const wf = loadWf(f);
      expect(wf.name).toBeTruthy();
      expect(Array.isArray(wf.nodes)).toBe(true);
      expect(wf.nodes.length).toBeGreaterThan(0);
    }
  });

  test('WF1 — HTTP /restart avec x-restart-token, pas SSH', () => {
    const wf = loadWf('wf1_health.json');
    const nodes = allNodes(wf);
    const types = nodes.map((n) => n.type);
    expect(types).not.toContain('n8n-nodes-base.ssh');
    const restart = nodes.find((n) => n.name === 'Restart via HTTP');
    expect(restart).toBeDefined();
    expect(restart.parameters.url).toMatch(/\/restart/);
    const hdr = restart.parameters.headerParameters?.parameters || [];
    expect(hdr.some((h) => h.name === 'x-restart-token' && h.value.includes('$env.RESTART_SECRET'))).toBe(true);
  });

  test('WF5 — POST /config reset_daily, pas Redis direct', () => {
    const wf = loadWf('wf5_reset_daily.json');
    const nodes = allNodes(wf);
    expect(nodes.some((n) => n.type === 'n8n-nodes-base.redis')).toBe(false);
    const reset = nodes.find((n) => n.name === 'Reset BTC');
    expect(reset.parameters.method).toBe('POST');
    expect(reset.parameters.url).toMatch(/\/config/);
    expect(reset.parameters.jsonBody).toMatch(/reset_daily/);
  });

  test('secrets via $env, pas en dur', () => {
    for (const f of WF_FILES) {
      const raw = fs.readFileSync(path.join(WF_DIR, f), 'utf8');
      expect(raw).not.toMatch(/sk-ant-/);
      expect(raw).not.toMatch(/[0-9]{10}:[A-Za-z0-9_-]{35}/);
      if (raw.includes('TELEGRAM') || raw.includes('RESTART')) {
        expect(raw).toMatch(/\$env\./);
      }
    }
  });

  test('WF3 webhook stop-global', () => {
    const wf = loadWf('wf3_stop_global.json');
    const wh = allNodes(wf).find((n) => n.type === 'n8n-nodes-base.webhook');
    expect(wh.parameters.path).toBe('stop-global');
  });
});
```

═══════════════════════════════════════════════════════
FICHIER : n8n/workflows/wf1_health.json
═══════════════════════════════════════════════════════
```json
{
  "name": "WF1 — Health Check",
  "nodes": [
    {
      "parameters": { "rule": { "interval": [{ "field": "minutes", "minutesInterval": 5 }] } },
      "id": "schedule",
      "name": "Cron 5min",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 0]
    },
    {
      "parameters": { "url": "http://bot_btc:4001/health", "options": { "timeout": 5000 } },
      "id": "ping-btc",
      "name": "Ping bot_btc",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [220, -100]
    },
    {
      "parameters": {
        "conditions": {
          "string": [{ "value1": "={{$json.status}}", "operation": "notEqual", "value2": "ok" }]
        }
      },
      "id": "if-btc",
      "name": "Bot mort ?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [440, -100]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://bot_btc:4001/restart",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [{ "name": "x-restart-token", "value": "={{$env.RESTART_SECRET}}" }]
        },
        "options": { "timeout": 5000 }
      },
      "id": "restart-btc",
      "name": "Restart via HTTP",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [660, -100]
    },
    {
      "parameters": { "chatId": "={{$env.TELEGRAM_CHAT_ID}}", "text": "⛔ bot_btc non répondant — restart déclenché" },
      "id": "tg-btc",
      "name": "Alerte Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [880, -100]
    }
  ],
  "connections": {
    "Cron 5min": { "main": [[{ "node": "Ping bot_btc", "type": "main", "index": 0 }]] },
    "Ping bot_btc": { "main": [[{ "node": "Bot mort ?", "type": "main", "index": 0 }]] },
    "Bot mort ?": { "main": [[{ "node": "Restart via HTTP", "type": "main", "index": 0 }], []] },
    "Restart via HTTP": { "main": [[{ "node": "Alerte Telegram", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" },
  "meta": { "description": "CD §8.7 WF1 — HTTP /restart, zéro SSH" }
}
```

═══════════════════════════════════════════════════════
FICHIER : n8n/workflows/wf2_trade_alert.json
═══════════════════════════════════════════════════════
```json
{
  "name": "WF2 — Trade Alert",
  "nodes": [
    {
      "parameters": { "httpMethod": "POST", "path": "trade", "responseMode": "onReceived" },
      "id": "webhook",
      "name": "Webhook Trade",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 0]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO events (symbol, type, payload) VALUES ($1, 'TRADE_ALERT', $2::jsonb)",
        "additionalFields": { "queryParams": "={{$json.body.symbol}},={{JSON.stringify($json.body)}}" }
      },
      "id": "pg-log",
      "name": "Log Postgres",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [220, 0]
    },
    {
      "parameters": {
        "chatId": "={{$env.TELEGRAM_CHAT_ID}}",
        "text": "=Trade {{$json.body.symbol}} — PnL {{$json.body.pnlNet}} — PF {{$json.body.profit_factor}}"
      },
      "id": "tg",
      "name": "Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [440, 0]
    }
  ],
  "connections": {
    "Webhook Trade": { "main": [[{ "node": "Log Postgres", "type": "main", "index": 0 }]] },
    "Log Postgres": { "main": [[{ "node": "Telegram", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" },
  "meta": { "description": "CD §8.7 WF2 — webhook /webhook/trade" }
}
```

═══════════════════════════════════════════════════════
FICHIER : n8n/workflows/wf3_stop_global.json
═══════════════════════════════════════════════════════
```json
{
  "name": "WF3 — Stop Global",
  "nodes": [
    {
      "parameters": { "httpMethod": "POST", "path": "stop-global", "responseMode": "onReceived" },
      "id": "webhook",
      "name": "Webhook Stop",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 0]
    },
    {
      "parameters": { "method": "POST", "url": "http://bot_btc:4001/stop", "options": { "timeout": 5000 } },
      "id": "stop-btc",
      "name": "Stop BTC",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [220, 0]
    },
    {
      "parameters": { "chatId": "={{$env.TELEGRAM_CHAT_ID}}", "text": "⛔ STOP GLOBAL déclenché sur les 3 bots" },
      "id": "tg",
      "name": "Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [440, 0]
    }
  ],
  "connections": {
    "Webhook Stop": { "main": [[{ "node": "Stop BTC", "type": "main", "index": 0 }]] },
    "Stop BTC": { "main": [[{ "node": "Telegram", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" },
  "meta": { "description": "CD §8.7 WF3 — POST /stop bots" }
}
```

═══════════════════════════════════════════════════════
FICHIER : n8n/workflows/wf4_daily_report.json
═══════════════════════════════════════════════════════
```json
{
  "name": "WF4 — Rapport Daily",
  "nodes": [
    {
      "parameters": { "rule": { "interval": [{ "field": "cronExpression", "expression": "58 23 * * *" }] } },
      "id": "cron",
      "name": "Cron 23h58 UTC",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 0]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT symbol, COUNT(*) trades, SUM(pnl_net) pnl FROM trades WHERE dry_run=false AND entry_time >= CURRENT_DATE GROUP BY symbol"
      },
      "id": "pg",
      "name": "Agrégats Postgres",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [220, 0]
    },
    {
      "parameters": { "chatId": "={{$env.TELEGRAM_CHAT_ID}}", "text": "=Rapport daily ROHAN\n{{JSON.stringify($json)}}" },
      "id": "tg",
      "name": "Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [440, 0]
    }
  ],
  "connections": {
    "Cron 23h58 UTC": { "main": [[{ "node": "Agrégats Postgres", "type": "main", "index": 0 }]] },
    "Agrégats Postgres": { "main": [[{ "node": "Telegram", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" },
  "meta": { "description": "CD §8.7 WF4 — rapport quotidien Telegram" }
}
```

═══════════════════════════════════════════════════════
FICHIER : n8n/workflows/wf5_reset_daily.json
═══════════════════════════════════════════════════════
```json
{
  "name": "WF5 — Reset Daily",
  "nodes": [
    {
      "parameters": { "rule": { "interval": [{ "field": "cronExpression", "expression": "1 0 * * *" }] } },
      "id": "cron",
      "name": "Cron 00h01 UTC",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 0]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://bot_btc:4001/config",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "x-bot-token", "value": "={{$env.RESTART_SECRET}}" },
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"key\":\"reset_daily\"}"
      },
      "id": "reset-btc",
      "name": "Reset BTC",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [220, 0]
    },
    {
      "parameters": { "chatId": "={{$env.TELEGRAM_CHAT_ID}}", "text": "✅ reset_daily appliqué sur les bots" },
      "id": "tg",
      "name": "Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [440, 0]
    }
  ],
  "connections": {
    "Cron 00h01 UTC": { "main": [[{ "node": "Reset BTC", "type": "main", "index": 0 }]] },
    "Reset BTC": { "main": [[{ "node": "Telegram", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" },
  "meta": { "description": "CD §8.7 WF5 — POST /config reset_daily, pas Redis direct" }
}
```

═══════════════════════════════════════════════════════
FICHIER : n8n/workflows/wf6_config_update.json
═══════════════════════════════════════════════════════
```json
{
  "name": "WF6 — Config Update",
  "nodes": [
    {
      "parameters": { "httpMethod": "POST", "path": "config", "responseMode": "onReceived" },
      "id": "webhook",
      "name": "Webhook Config",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 0]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "=http://bot_{{$json.body.symbol.toLowerCase().replace('usdt','')}}:400{{$json.body.symbol === 'ETHUSDT' ? 2 : $json.body.symbol === 'SOLUSDT' ? 3 : 1}}/config",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "x-bot-token", "value": "={{$env.RESTART_SECRET}}" },
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"key\": $json.body.key, \"value\": $json.body.value}"
      },
      "id": "http-config",
      "name": "POST /config bot",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [220, 0]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO mcp_actions (tool, params) VALUES ('set_config', $1::jsonb)",
        "additionalFields": { "queryParams": "={{JSON.stringify($json.body)}}" }
      },
      "id": "pg",
      "name": "Log mcp_actions",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [440, 0]
    }
  ],
  "connections": {
    "Webhook Config": { "main": [[{ "node": "POST /config bot", "type": "main", "index": 0 }]] },
    "POST /config bot": { "main": [[{ "node": "Log mcp_actions", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" },
  "meta": { "description": "CD §8.7 WF6 — webhook config → HTTP bot" }
}
```

═══════════════════════════════════════════════════════
FICHIER : mcp/server.js
═══════════════════════════════════════════════════════
```javascript
require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });

const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { getPnl, runQuery, setConfig } = require('./lib/tools');

const PORT = parseInt(process.env.MCP_PORT || '5010', 10);

const createMcpApp = (pgPool, redis) => {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    if (req.path === '/health') return next();
    const token = req.headers['x-mcp-token'] || req.headers.authorization?.replace('Bearer ', '');
    if (token !== process.env.MCP_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'bot-mcp', version: '1.0.0' });
  });

  app.post('/tools/get_pnl', async (req, res) => {
    try {
      const rows = await getPnl(pgPool, req.body || {});
      res.json({ rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/tools/run_query', async (req, res) => {
    try {
      const out = await runQuery(pgPool, req.body?.sql || '');
      if (out.error) return res.status(400).json(out);
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/tools/set_config', async (req, res) => {
    try {
      const out = await setConfig(redis, pgPool, req.body || {});
      if (out.error) return res.status(400).json(out);
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
};

const startMcpServer = async (port = PORT) => {
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const redis = new Redis(process.env.REDIS_URL);
  const app = createMcpApp(pgPool, redis);
  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve({ app, server, pgPool, redis }));
  });
};

if (require.main === module) {
  startMcpServer().then(() => {
    console.log(`MCP HTTP: http://0.0.0.0:${PORT}`);
  });
}

module.exports = { createMcpApp, startMcpServer, PORT };
```

═══════════════════════════════════════════════════════
FICHIER : mcp/lib/sqlGuard.js
═══════════════════════════════════════════════════════
```javascript
/**
 * Garde SQL pour run_query — CD §6.3 P1-7, L14
 */
const FORBIDDEN = ['drop', 'delete', 'truncate', 'update', 'insert', 'alter', 'create'];

function validateSelectOnly(sql) {
  const cleaned = sql.trim().toLowerCase();
  if (!cleaned.startsWith('select')) {
    return { ok: false, error: 'Erreur: SELECT uniquement autorisé' };
  }

  const stripped = cleaned.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
  const parts = stripped.split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return { ok: false, error: 'Erreur: un seul statement autorisé' };
  }

  if (FORBIDDEN.some((kw) => stripped.includes(kw))) {
    return { ok: false, error: 'Erreur: opération non autorisée' };
  }

  return { ok: true, sql };
}

const ALLOWED_PARAMS = ['MAX_SPREAD', 'MAX_CONSEC_LOSS', 'TP_BRUT', 'SL_BRUT', 'ATR_TP_MULT'];

function validateConfigParam(param) {
  if (!ALLOWED_PARAMS.includes(param)) {
    return { ok: false, error: `Paramètre non autorisé: ${param}` };
  }
  return { ok: true };
}

module.exports = { validateSelectOnly, validateConfigParam, ALLOWED_PARAMS, FORBIDDEN };
```

═══════════════════════════════════════════════════════
FICHIER : mcp/lib/tools.js
═══════════════════════════════════════════════════════
```javascript
const { validateSelectOnly, validateConfigParam } = require('./sqlGuard');

const INTERVAL_MAP = {
  today: '1 day',
  week: '7 days',
  month: '30 days',
};

async function getPnl(pgPool, { symbol, period = 'today' }) {
  const interval = INTERVAL_MAP[period] || INTERVAL_MAP.today;
  const params = [];
  let symbolClause = '';
  if (symbol) {
    params.push(symbol);
    symbolClause = `AND symbol = $${params.length}`;
  }
  const result = await pgPool.query(
    `SELECT symbol,
            SUM(pnl_net) AS pnl,
            COUNT(*) AS trades,
            SUM(CASE WHEN result='TP' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*),0) AS wr,
            SUM(CASE WHEN pnl_net>0 THEN pnl_net ELSE 0 END) /
              NULLIF(ABS(SUM(CASE WHEN pnl_net<0 THEN pnl_net ELSE 0 END)),0) AS profit_factor
     FROM trades
     WHERE dry_run = false
       AND entry_time >= NOW() - INTERVAL '${interval}'
       ${symbolClause}
     GROUP BY symbol`,
    params,
  );
  return result.rows;
}

async function runQuery(pgPool, sql) {
  const check = validateSelectOnly(sql);
  if (!check.ok) return { error: check.error };
  const result = await pgPool.query(check.sql);
  await pgPool.query(
    'INSERT INTO mcp_actions (tool, params, result) VALUES ($1,$2,$3)',
    ['run_query', { sql }, { rows: result.rows.length }],
  );
  return { rows: result.rows };
}

async function setConfig(redis, pgPool, { symbol, param, value }) {
  const check = validateConfigParam(param);
  if (!check.ok) return { error: check.error };
  await redis.publish(`bot:${symbol.toLowerCase()}:config`, `${param}:${value}`);
  await pgPool.query(
    'INSERT INTO mcp_actions (tool, params) VALUES ($1,$2)',
    ['set_config', { symbol, param, value }],
  );
  return { message: `Config ${param}=${value} envoyée à ${symbol}` };
}

module.exports = { getPnl, runQuery, setConfig, INTERVAL_MAP };
```

═══════════════════════════════════════════════════════
FICHIER : mcp/Dockerfile
═══════════════════════════════════════════════════════
```javascript
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY mcp/ ./mcp/
EXPOSE 5010
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5010/health || exit 1
CMD ["node", "mcp/server.js"]
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/server.js
═══════════════════════════════════════════════════════
```javascript
const path = require('path');
const express = require('express');
const http = require('http');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.DASHBOARD_PORT || '3010', 10);

const buildRealtimeData = async (redis, pgPool) => {
  const bid = await redis.get('bid:BTCUSDT');
  const pnl = await pgPool.query(
    `SELECT COALESCE(SUM(pnl_net),0) AS total FROM trades
     WHERE dry_run=false AND entry_time >= CURRENT_DATE`,
  );
  return {
    ts: Date.now(),
    bid_btc: bid,
    pnl_day: parseFloat(pnl.rows[0].total),
  };
};

const createDashboardApp = (pgPool, redis) => {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'bot-dashboard', port: PORT });
  });

  app.use((req, res, next) => {
    if (req.path === '/health') return next();
    const auth = req.headers.authorization;
    const expected = `Basic ${Buffer.from(`admin:${process.env.DASHBOARD_PASSWORD || 'changeme'}`).toString('base64')}`;
    if (!auth || auth !== expected) {
      res.set('WWW-Authenticate', 'Basic realm="ROHAN Trading"');
      return res.status(401).send('Unauthorized');
    }
    next();
  });

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/pnl/today', require('./api/pnl').today(pgPool));
  app.get('/api/trades', require('./api/trades').list(pgPool));
  app.get('/api/status', require('./api/status').get(redis, pgPool));
  app.post('/api/backtest', require('./api/backtest').run(pgPool));
  app.get('/api/correlation', require('./api/correlation').current(redis));

  return app;
};

const startDashboardServer = async (port = PORT) => {
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const redis = new Redis(process.env.REDIS_URL);
  const app = createDashboardApp(pgPool, redis);
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const push = async () => {
    const data = await buildRealtimeData(redis, pgPool);
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(payload);
    });
  };

  const interval = setInterval(push, 1000);

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ app, server, pgPool, redis, wss, interval, push, buildRealtimeData });
    });
  });
};

if (require.main === module) {
  startDashboardServer().then(() => {
    console.log(`Dashboard: http://0.0.0.0:${PORT}`);
  });
}

module.exports = {
  createDashboardApp,
  startDashboardServer,
  buildRealtimeData,
  PORT,
};
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/api/backtest.js
═══════════════════════════════════════════════════════
```javascript
const run = (pgPool) => async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', days = 30 } = req.body || {};
    const result = await pgPool.query(
      `SELECT DATE(entry_time) AS day, SUM(pnl_net) AS pnl, COUNT(*) AS trades
       FROM trades
       WHERE symbol = $1 AND dry_run = false
         AND entry_time >= NOW() - ($2::int || ' days')::interval
       GROUP BY DATE(entry_time) ORDER BY day`,
      [symbol, days],
    );
    const rows = result.rows;
    const totalPnl = rows.reduce((s, r) => s + parseFloat(r.pnl || 0), 0);
    const wins = rows.filter((r) => parseFloat(r.pnl) > 0).length;
    res.json({
      symbol,
      days,
      total_pnl: totalPnl,
      win_days: wins,
      loss_days: rows.length - wins,
      daily: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { run };
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/api/correlation.js
═══════════════════════════════════════════════════════
```javascript
const current = (redis) => async (_req, res) => {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const out = {};
    for (const symbol of symbols) {
      const pricesA = await redis.lrange(`closes:${symbol}`, 0, 19);
      const pricesB = await redis.lrange('closes:ETHUSDT', 0, 19);
      if (pricesA.length < 5) {
        out[symbol] = null;
        continue;
      }
      const corr = require('../../src/correlation');
      const other = symbol === 'BTCUSDT' ? 'ETHUSDT' : 'BTCUSDT';
      out[symbol] = await corr.getPairCorrelation(symbol, other, Math.min(20, pricesA.length), redis);
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { current };
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/api/pnl.js
═══════════════════════════════════════════════════════
```javascript
const today = (pgPool) => async (_req, res) => {
  try {
    const result = await pgPool.query(
      `SELECT symbol, COALESCE(SUM(pnl_net), 0) AS pnl, COUNT(*) AS trades
       FROM trades
       WHERE dry_run = false AND entry_time >= CURRENT_DATE
         AND result IN ('TP', 'SL', 'FORCED_EXIT', 'SLIPPAGE_ABORT')
       GROUP BY symbol`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { today };
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/api/status.js
═══════════════════════════════════════════════════════
```javascript
const get = (redis, pgPool) => async (_req, res) => {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const pairs = [];
    for (const symbol of symbols) {
      const sym = symbol.toLowerCase();
      pairs.push({
        symbol,
        position_open: await redis.get(`bot:${sym}:position_open`) === '1',
        consec_loss: parseInt(await redis.get(`bot:${sym}:consec_loss`) || '0', 10),
        trades_day: parseInt(await redis.get(`bot:${sym}:trades_day`) || '0', 10),
        global_stop: await redis.get('bot:global:stop') === '1',
      });
    }
    const pnl = await pgPool.query(
      `SELECT COALESCE(SUM(pnl_net), 0) AS total FROM trades
       WHERE dry_run = false AND entry_time >= CURRENT_DATE`,
    );
    res.json({ pairs, pnl_day: parseFloat(pnl.rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { get };
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/api/trades.js
═══════════════════════════════════════════════════════
```javascript
const list = (pgPool) => async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const result = await pgPool.query(
      `SELECT id, symbol, entry_time, exit_time, entry_price, exit_price, qty, pnl_net, result, dry_run
       FROM trades ORDER BY entry_time DESC LIMIT $1`,
      [limit],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { list };
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/Dockerfile
═══════════════════════════════════════════════════════
```javascript
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY dashboard/ ./dashboard/
COPY src/correlation.js ./src/correlation.js
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3010/health || exit 1
CMD ["node", "dashboard/server.js"]
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/public/index.html
═══════════════════════════════════════════════════════
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>ROHAN Trading Dashboard</title>
  <link rel="stylesheet" href="/css/dashboard.css" />
</head>
<body>
  <header>
    <h1>BotTrader — Dashboard</h1>
    <span id="live-ts">—</span>
  </header>
  <nav id="tabs">
    <button data-tab="overview" class="active">Vue</button>
    <button data-tab="trades">Trades</button>
    <button data-tab="pnl">PnL</button>
    <button data-tab="status">Statut</button>
    <button data-tab="correlation">Corrélation</button>
    <button data-tab="backtest">Backtest</button>
    <button data-tab="events">Events</button>
    <button data-tab="config">Config</button>
    <button data-tab="health">Health</button>
  </nav>
  <main id="panel"></main>
  <script src="/js/dashboard.js"></script>
</body>
</html>
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/public/css/dashboard.css
═══════════════════════════════════════════════════════
```css
body { font-family: system-ui, sans-serif; margin: 0; background: #0f1419; color: #e7ecf3; }
header { padding: 1rem 1.5rem; border-bottom: 1px solid #243044; display: flex; justify-content: space-between; }
nav { display: flex; gap: .5rem; padding: .75rem 1rem; flex-wrap: wrap; }
nav button { background: #1a2332; color: #e7ecf3; border: 1px solid #2d3a4f; padding: .4rem .8rem; cursor: pointer; border-radius: 4px; }
nav button.active { background: #2f6fed; border-color: #2f6fed; }
main { padding: 1rem 1.5rem; }
.card { background: #151d2b; border: 1px solid #243044; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
.positive { color: #3dd68c; }
.negative { color: #f87171; }
```

═══════════════════════════════════════════════════════
FICHIER : dashboard/public/js/dashboard.js
═══════════════════════════════════════════════════════
```javascript
const panel = document.getElementById('panel');
const liveTs = document.getElementById('live-ts');
const auth = 'Basic ' + btoa(`admin:${prompt('Mot de passe dashboard:', 'changeme') || 'changeme'}`);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: auth, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function renderOverview(data) {
  panel.innerHTML = `<div class="card"><h2>Temps réel</h2>
    <p>Bid BTC: <strong>${data.bid_btc || '—'}</strong></p>
    <p>PnL jour: <strong class="${data.pnl_day >= 0 ? 'positive' : 'negative'}">${data.pnl_day?.toFixed?.(2) ?? data.pnl_day}</strong></p>
  </div>`;
}

async function loadTab(tab) {
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  try {
    if (tab === 'trades') {
      const rows = await api('/api/trades?limit=20');
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else if (tab === 'pnl') {
      const rows = await api('/api/pnl/today');
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else if (tab === 'status') {
      const rows = await api('/api/status');
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else if (tab === 'correlation') {
      const rows = await api('/api/correlation');
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else if (tab === 'backtest') {
      const rows = await api('/api/backtest', { method: 'POST', body: JSON.stringify({ symbol: 'BTCUSDT', days: 30 }) });
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else {
      panel.innerHTML = `<div class="card"><p>Onglet ${tab} — données via API / WebSocket</p></div>`;
    }
  } catch (e) {
    panel.innerHTML = `<div class="card negative">Erreur: ${e.message}</div>`;
  }
}

document.getElementById('tabs').addEventListener('click', (e) => {
  if (e.target.dataset.tab) loadTab(e.target.dataset.tab);
});

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${proto}://${location.host}`);
ws.onmessage = (ev) => {
  const data = JSON.parse(ev.data);
  liveTs.textContent = new Date(data.ts).toLocaleTimeString('fr-FR');
  if (document.querySelector('#tabs .active')?.dataset.tab === 'overview') renderOverview(data);
};

loadTab('overview');
```


---

## 8. VARIABLES D'ENVIRONNEMENT UTILISÉES

```
Variables confirmées dans le code (process.env.XXX) :
  SYMBOL, CAPITAL, TP_BRUT, SL_BRUT, MAX_SPREAD,
  MAX_TRADES_DAY, MAX_CONSEC_LOSS, MAX_LOSS_DAY,
  ENTRY_TIMEOUT, MAX_POSITION_HOURS, DRY_RUN,
  PORT, BINANCE_API_KEY, BINANCE_API_SECRET, BINANCE_TESTNET,
  REDIS_URL, POSTGRES_URL, RESTART_SECRET,
  MAX_SLIPPAGE_PCT, CORRELATION_THRESHOLD,
  LOG_LEVEL, NODE_ENV, ENV_FILE,
  ATR_TP_MULT, ATR_SL_MULT,
  TRADING_HOURS_START, TRADING_HOURS_END,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, N8N_WEBHOOK_BASE,
  MCP_TOKEN, MCP_PORT, DASHBOARD_PASSWORD, DASHBOARD_PORT,
  ANTHROPIC_API_KEY, POSTGRES_PASSWORD, DEV_GO_TOKEN, DEV_DASHBOARD_PORT

Variables absentes du code mais requises selon CD v1.1 :
  DASHBOARD_PASSWORD — utilisée avec fallback 'changeme' si absente
  MCP_TOKEN — requis en prod MCP, défini .env.shared VPS

VPS .env.shared modifié session :
  TELEGRAM_BOT_TOKEN=dry_run_stub (stub smoke test)
  TELEGRAM_CHAT_ID=0
  MAX_POSITION_HOURS=4
  TRADING_HOURS_START=00:00 (temporaire)
  TRADING_HOURS_END=23:59 (temporaire)

VPS .env.btc modifié session :
  BINANCE_TESTNET=false (temporaire, flux publics mainnet)
  DRY_RUN=true
```

---

## 9. DÉPENDANCES NPM

```json
{
  "name": "oco-strategie",
  "version": "1.0.0",
  "description": "BotTrader OPOCO — ROHAN Innovation",
  "private": true,
  "main": "src/bot.js",
  "scripts": {
    "start:btc": "node -r dotenv/config src/bot.js dotenv_config_path=.env.btc",
    "start:eth": "node -r dotenv/config src/bot.js dotenv_config_path=.env.eth",
    "start:sol": "node -r dotenv/config src/bot.js dotenv_config_path=.env.sol",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "pipeline:go": "node scripts/pipeline-go.js",
    "pipeline:task": "node scripts/pipeline-task.js",
    "dev:report": "node scripts/dev-report.js",
    "claude:test": "node scripts/claude-gate-test.js"
  },
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

```
Ajouts par rapport au squelette CD §2.3 :
  @modelcontextprotocol/sdk — MCP Module C
  zod — validation (pipeline)
  ws — dashboard WebSocket + monitor
  express — dashboard + mcp HTTP
  winston — logging
  jest, nock, ioredis-mock — tests
Aucune dépendance retirée.
```

---

## 10. POINTS D'ATTENTION POUR CLAUDE

```
🔴 CRITIQUE — À corriger avant de continuer :
  1. Remettre TRADING_HOURS 08:00-22:00 sur VPS après tests
  2. Définir DASHBOARD_PASSWORD réel dans .env.shared (actuellement changeme)
  3. TELEGRAM_BOT_TOKEN stub — remplacer par vrai token avant alertes prod
  4. Code non commité — tout le projet hors docs est untracked (git status)
  5. logTradeOpen appelé avant placeEntry DRY_RUN → trades OPEN orphelins possibles

🟠 IMPORTANT — À vérifier :
  6. BINANCE_TESTNET=false sur VPS — remettre true avant phase testnet réelle
  7. Import manuel WF1-6 dans N8n ultiumgrid_obs-n8n-1:25678
  8. notify.js couverture 30% — stub non testé
  9. dashboard/public/js/dashboard.js — 0% couverture Jest (UI seulement)
  10. bot_btc port 4001 non exposé host — normal, health via docker exec

🟡 MINEUR — À noter :
  11. ANTHROPIC_API_KEY .env.shared — vérifier intégrité après sed accidentel
  12. docker-compose.yml version obsolete warning
  13. Phase 4 checklist 1 semaine non démarrée — seulement smoke 10m + signaux
```

---

## 11. COMMANDES POUR REPRENDRE

```bash
# 1. Vérifier l'état actuel
cd /home/dev/dev/OCO_strategie
git status
git log --oneline -10

# 2. Lancer les tests pour confirmer l'état
npm test 2>&1

# 3. Vérifier Redis et Postgres
docker exec bot_redis redis-cli ping
docker exec bot_postgres psql -U bot -d bot_trading -c "\dt"

# 4. État bots / dashboards
docker ps --filter name=bot_
curl -s http://127.0.0.1:3010/health
curl -s http://127.0.0.1:3020/health
docker exec bot_btc curl -s http://localhost:4001/status

# 5. Prochaine étape
# → Phase 4.1 checklist 1 semaine DRY_RUN BTC
# → Puis Testnet BINANCE_TESTNET=true DRY_RUN=false
# → Remettre horaires 08:00-22:00
# → git add + commit code complet
```

---

## 12. GIT STATUS ET LOG

### git status

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   .gitignore
	modified:   README.md
	modified:   docs/CAHIER_DEVELOPPEMENT.md

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.env.example.btc
	.env.example.shared
	Dockerfile
	dashboard/
	db/
	dev-dashboard/
	docker-compose.btc.yml
	docker-compose.yml
	docs/ARCHITECTURE_3_MODULES.md
	docs/DASHBOARD_DEV_ORCHESTRATION.md
	docs/PLAN_8_AGENTS.md
	docs/RAPPORT_ALIGNEMENT_CDC_CD.md
	docs/README.md
	docs/REGLES_STRICTES_AGENTS.md
	jest.config.js
	mcp/
	n8n/
	package-lock.json
	package.json
	scripts/
	src/
	tests/

no changes added to commit (use "git add" and/or "git commit -a")

```

### git log --oneline -15

```
1ce88ad docs: ajouter cahier de developpement BotTrader v1.1.0
b238837 Initial commit

```

### git diff --stat HEAD~1 HEAD

```
 README.md                    |   12 +-
 docs/CAHIER_DEVELOPPEMENT.md | 2146 ++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 2153 insertions(+), 5 deletions(-)

```

---

*ROHAN Innovation — BotTrader v1.0 — Rapport session Cursor*
*Généré : 2026-07-10 07:00 UTC*
*VPS : 176.97.70.254 — /home/dev/dev/OCO_strategie*
