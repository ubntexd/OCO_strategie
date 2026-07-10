# CAHIER DES CHARGES — BOT DE TRADING AUTOMATISÉ
## ROHAN Innovation — Projet BotTrader v1.0
**Version :** 1.1.0 — Corrigé et mis à jour  
**Date :** 09 juillet 2026  
**Auteur :** Sas — ROHAN Innovation, Abidjan, Côte d'Ivoire  
**Statut :** Spécification finale avant développement

> **Changelog v1.1 :** 12 corrections (C1–C12) + 5 suggestions (S1–S5) intégrées suite à revue technique. Voir section 17.

---

## TABLE DES MATIÈRES

1. Contexte et objectifs
2. Architecture générale
3. Infrastructure et déploiement
4. Paramètres financiers et trading
5. Modules du bot
6. API Binance — spécifications techniques
7. Gestion des ordres
8. Algorithmes et IA
9. Système de protection capital
10. Orchestration N8n
11. Serveur MCP
12. Dashboard web
13. Base de données
14. Sécurité
15. Tests — Backtest et Fronttest
16. Livrables et planning
17. Corrections v1.1 — détail complet

---

## 1. CONTEXTE ET OBJECTIFS

### 1.1 Contexte
ROHAN Innovation développe un bot de trading automatisé sur Binance Spot pour les paires BTCUSDT, ETHUSDT et SOLUSDT. Le bot est déployé sur le VPS existant de ROHAN (37.1.209.232, Ubuntu 24.04 LTS) en conteneurs Docker, en cohabitation avec l'infrastructure ROHAN-Wash.

### 1.2 Objectifs financiers

| Paramètre | Valeur |
|---|---|
| Capital total déployé | 15 000 USDT |
| Répartition | BTC 6 000 / ETH 5 000 / SOL 4 000 USDT |
| Objectif journalier net | 80 USDT (1.6% du capital) |
| Objectif mensuel net | ~1 600 USDT (20 jours ouvrés) |
| Win rate minimum (seuil équilibre) | 53% |
| Win rate cible | 58–63% |
| Trades par jour (toutes paires) | 8–12 |
| Perte journalière maximale (stop global) | 120 USDT |

### 1.3 Objectifs techniques
- Bot entièrement automatisé, sans intervention manuelle en conditions normales
- Déploiement Docker multi-instance sur VPS existant
- Dashboard web professionnel 9 onglets (graphiques, historique, backtest, fronttest, config, commandes, logs)
- Intégration N8n pour orchestration, alertes et rapports automatiques
- Serveur MCP pour pilotage via Claude Desktop
- Journal complet en PostgreSQL
- Notifications Telegram en temps réel
- Mode `DRY_RUN` par paire pour validation sans risque capital *(S3)*
- Clés API séparées par paire pour isolation des risques *(S5)*

---

## 2. ARCHITECTURE GÉNÉRALE

### 2.1 Principe fondamental
**Un seul code source — trois instances Docker.** La configuration par paire est injectée via variables d'environnement (`.env`). Pas de duplication de code.

### 2.2 Composants

| Conteneur | Image | Port | Rôle |
|---|---|---|---|
| bot_btc | node:22-alpine | 4001 | Bot trading BTCUSDT |
| bot_eth | node:22-alpine | 4002 | Bot trading ETHUSDT |
| bot_sol | node:22-alpine | 4003 | Bot trading SOLUSDT |
| bot_redis | redis:7-alpine | 6380 | État partagé, locks, pub/sub |
| bot_postgres | postgres:16 | 5435 | Journal trades, historique |
| bot_mcp | node:22-alpine | 5010 | Serveur MCP pour Claude Desktop |
| bot_dashboard | node:22-alpine | 3010 | Interface web 9 onglets |

### 2.3 Isolation
- Redis dédié `bot_redis` (port 6380) — séparé de `rohan_redis`
- PostgreSQL dédié `bot_postgres` (port 5435) — séparé de `rohan_postgres`
- Réseau Docker interne : `bot_network`
- Pas d'interférence avec l'infrastructure ROHAN-Wash

---

## 3. INFRASTRUCTURE ET DÉPLOIEMENT

### 3.1 Structure du projet
```
/var/www/dev/apps/bot-trading/
├── docker-compose.yml
├── .env.btc
├── .env.eth
├── .env.sol
├── .env.shared
├── src/
│   ├── bot.js            # Core principal + machine d'état
│   ├── signal.js         # Moteur de signal Mode 2
│   ├── order.js          # Gestion OPOCO/OCO/LIMIT_MAKER
│   ├── monitor.js        # WebSocket Binance robuste
│   ├── protection.js     # Règles de sécurité
│   ├── journal.js        # Logger PostgreSQL
│   ├── atr.js            # Calcul ATR adaptatif
│   ├── regime.js         # Détection régime marché
│   ├── correlation.js    # Corrélation inter-paires (Phase 1) ← C6
│   └── health.js         # Endpoints HTTP /health /status /stop /config /restart
├── dashboard/
├── mcp/server.js
├── db/schema.sql
└── n8n/workflows/
    ├── wf1_health.json
    ├── wf2_trade_alert.json
    ├── wf3_stop_global.json
    ├── wf4_daily_report.json
    ├── wf5_daily_reset.json
    └── wf6_config_update.json
```

### 3.2 Variables d'environnement par instance

**Fichier `.env.btc` :**
```env
SYMBOL=BTCUSDT
CAPITAL=6000
TP_BRUT=28
SL_BRUT=18
ATR_TP_MULT=1.5
ATR_SL_MULT=0.8
MAX_SPREAD=1.50          # ← C5 corrigé (était 10.00)
MAX_TRADES_DAY=6
MAX_CONSEC_LOSS=3
MAX_LOSS_DAY=60
ENTRY_TIMEOUT=45
MAX_POSITION_HOURS=4     # ← S4
DRY_RUN=false            # ← S3
PORT=4001
BINANCE_API_KEY=<clé_btc>      # ← S5 : clé dédiée par paire
BINANCE_API_SECRET=<secret_btc>
```

**Fichier `.env.shared` :**
```env
BINANCE_TESTNET=false
REDIS_URL=redis://bot_redis:6380
POSTGRES_URL=postgresql://bot:...@bot_postgres:5435/bot_trading
N8N_WEBHOOK_BASE=http://rohan_n8n:5678/webhook
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TRADING_HOURS_START=08:00
TRADING_HOURS_END=22:00
FEES_RATE=0.00075        # 0.075% avec BNB
BNB_FEES=true
ENTRY_MODE=LIMIT_MAKER
MAX_SLIPPAGE_PCT=0.20    # ← C7
RESTART_SECRET=<token_256bits>  # ← C10
LOG_LEVEL=info
```

**Seuils spread corrigés *(C5)* :**

| Paire | MAX_SPREAD v1.0 (inutilisable) | MAX_SPREAD v1.1 (corrigé) |
|---|---|---|
| BTCUSDT | 10.00 USDT | **1.50 USDT** |
| ETHUSDT | 3.00 USDT | **0.40 USDT** |
| SOLUSDT | 0.50 USDT | **0.08 USDT** |

### 3.3 docker-compose.yml — healthcheck *(C10)*
```yaml
services:
  bot_btc:
    image: node:22-alpine
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

### 3.4 Commandes de déploiement
```bash
docker compose up -d                           # Démarrer tout
docker compose stop bot_btc                    # Stopper une paire
docker compose logs -f bot_eth                 # Logs live
docker compose up -d --force-recreate bot_sol  # Redémarrer après config
git pull && docker compose up -d --build       # Mise à jour code
```

---

## 4. PARAMÈTRES FINANCIERS ET TRADING

### 4.1 Allocation capitale et objectifs

| Paire | Capital | TP brut | SL brut | Obj/jour | Max trades | Stop/jour |
|---|---|---|---|---|---|---|
| BTCUSDT | 6 000 USDT | +28 USDT | −18 USDT | +30 USDT | 6 | −60 USDT |
| ETHUSDT | 5 000 USDT | +21 USDT | −13 USDT | +30 USDT | 7 | −50 USDT |
| SOLUSDT | 4 000 USDT | +16 USDT | −11 USDT | +20 USDT | 8 | −40 USDT |
| **TOTAL** | **15 000 USDT** | | | **+80 USDT** | **21** | **−120 USDT** |

### 4.2 Calcul des frais Binance
- Frais standard : 0.1% maker/taker
- Avec BNB activé : **0.075%** (−25%)
- Frais aller-retour par trade : ~0.15% avec BNB
- Économie BNB estimée : +160 USDT/mois

### 4.3 ATR adaptatif — formule
```
ATR = moyenne des 14 True Range sur bougies 5 minutes
TP  = entry + max(TP_BRUT,  ATR × ATR_TP_MULT)
SL  = entry − max(SL_BRUT,  ATR × ATR_SL_MULT)
```
`TP_BRUT` et `SL_BRUT` servent de **plancher garanti**.

### 4.4 Kelly Criterion corrigé *(C1)*
```js
// Formule correcte (trading binaire avec ratio R/R)
const f = (winRate * ratioRR - (1 - winRate)) / ratioRR;
const halfKelly = f * 0.5;
const clampedKelly = Math.max(0.05, Math.min(halfKelly, 0.20)); // [5%, 20%]
const capitalPerTrade = CAPITAL * clampedKelly;

// Seuil minimum avant recalcul : 100 trades (pas 50)
// En dessous de 100 trades → fraction fixe 10%
const KELLY_MIN_TRADES = 100;
```

### 4.5 Win rate et mathématique
- Seuil d'équilibre : WR ≥ 52.4%
- Seuil minimum exploité : 53%
- Cible : 58–63%
- Ratio R/R cible : 1.5 à 1.75
- Profit Factor cible : > 1.8

---

## 5. MODULES DU BOT

### 5.1 `bot.js` — Core et machine d'état
```
IDLE → SCANNING → WAITING_FILL → POSITION_OPEN → IDLE
                      ↓ timeout          ↓ TP ou SL
                   SCANNING ←─────────────┘
        STOPPED (perte max ou erreur critique)
```

Vérification `MAX_POSITION_HOURS` à chaque cycle *(S4)* :
```js
if (positionOpen && minutesSinceEntry > MAX_POSITION_HOURS * 60) {
  logger.warn(`[${symbol}] Position ouverte depuis ${hours}h — fermeture forcée`);
  await placeMarketSell(symbol, qty);
  await journal.logForcedExit(symbol, 'MAX_POSITION_TIME');
}
```

### 5.2 `signal.js` — Filtres Mode 2

| # | Filtre | BTCUSDT | ETHUSDT | SOLUSDT |
|---|---|---|---|---|
| 1 | Spread bid/ask max | ≤ **1.50** USDT | ≤ **0.40** USDT | ≤ **0.08** USDT |
| 2 | Volume relatif *(S2)* | 0.8× – 4.0× moy | 0.8× – 4.0× moy | 0.8× – 4.0× moy |
| 3 | Momentum | EMA5 ≥ EMA20 | EMA5 ≥ EMA20 | EMA5 ≥ EMA20 |
| 4 | ATR range | 0.5× – 3× moy | 0.5× – 3× moy | 0.5× – 3× moy |
| 5 | Liquidations | Pas de cascade | Pas de cascade | Pas de cascade |
| 6 | Heures | 08h–22h UTC | 08h–22h UTC | 08h–22h UTC |
| 7 | Capital | Disponible | Disponible | Disponible |
| 8 | Corrélation *(C6)* | BTC↔ETH < 0.85 | ETH↔BTC < 0.85 | SOL↔BTC < 0.85 |

**Volume relatif *(S2)* :**
```js
const relVolume = currentVolume / avgVolume20;
if (relVolume < 0.8) return false;  // marché trop calme
if (relVolume > 4.0) return false;  // spike anormal
```

**Log spread *(C5)* :**
```js
if (spread > MAX_SPREAD) {
  logger.warn(`[${symbol}] Spread trop élevé: ${spread} > ${MAX_SPREAD} — signal rejeté`);
  return false;
}
```

### 5.3 `order.js` — Flux d'entrée et OPOCO

**Flux d'entrée :**
1. Mode `DRY_RUN` → simuler, logger, ne pas appeler l'API *(S3)*
2. Placer `LIMIT_MAKER` BUY au meilleur bid (frais 0%)
3. Attendre fill pendant `ENTRY_TIMEOUT` (45 secondes)
4. Si fillé → enregistrer prix réel → passer à OPOCO
5. Si timeout → `DELETE /api/v3/order` → `MARKET BUY`
6. Vérifier slippage MARKET *(C7)* → abort si > `MAX_SLIPPAGE_PCT`

**Structure OPOCO correcte *(C2 + C3)* :**
```js
const payload = {
  symbol,
  workingType: 'LIMIT_MAKER',     // entrée : maker (frais 0%)
  workingSide: 'BUY',
  workingPrice: entryPrice.toFixed(tickDecimals),
  workingQuantity: qty.toFixed(stepDecimals),
  workingTimeInForce: 'GTC',
  pendingSide: 'SELL',
  // ⚠️  pendingQuantity NON FOURNI — calculé par Binance après fill (principe OPOCO)
  pendingAboveType: 'LIMIT',        // TP : LIMIT GTC (pas LIMIT_MAKER) ← C3
  pendingAbovePrice: tpPrice.toFixed(tickDecimals),
  pendingAboveTimeInForce: 'GTC',   // requis avec LIMIT ← C3
  pendingBelowType: 'STOP_LOSS',    // SL
  pendingBelowStopPrice: slPrice.toFixed(tickDecimals),
};
```

> **Note C2 :** `pendingQuantity` **ne doit pas** être fourni dans OPOCO. C'est la différence fondamentale avec OTOCO. Binance calcule la quantité des ordres pending à partir du fill réel du working order, déduction faite des frais. La doc officielle confirme : *"the received amount from the working order is used for the quantity of the pending order(s)"*.

**Gestion slippage MARKET *(C7)* :**
```js
const slippage = Math.abs((fillPrice - intendedPrice) / intendedPrice) * 100;
logger.warn(`[${symbol}] Fallback MARKET — slippage: ${slippage.toFixed(3)}%`);

if (slippage > parseFloat(process.env.MAX_SLIPPAGE_PCT)) {
  logger.error(`[${symbol}] Slippage excessif (${slippage.toFixed(2)}%) — sortie immédiate`);
  await placeMarketSell(symbol, qty);
  await journal.logSlippageAbort(symbol, fillPrice, intendedPrice, slippage);
  return null;
}
```

**Mode DRY_RUN *(S3)* :**
```js
if (process.env.DRY_RUN === 'true') {
  logger.info(`[DRY_RUN] Signal BUY ${symbol} @ ${price} — TP=${tpPrice} SL=${slPrice}`);
  await journal.logDryRun(symbol, price, tpPrice, slPrice, qty);
  return { simulated: true };
}
```

### 5.4 `monitor.js` — WebSocket

- Stream prix : `wss://stream.binance.com/ws/btcusdt@bookTicker`
- K-lines stream : `wss://stream.binance.com/ws/btcusdt@kline_5m` (pour ATR + corrélation)
- User Data Stream : listenKey + écoute `executionReport`
- **Keepalive : toutes les 20 minutes** *(C4 — était 30 min)*
- Reconnexion auto (5 tentatives max, backoff exponentiel)

**Alimentation Redis clôtures *(C6)* :**
```js
if (kline.x === true) { // bougie fermée
  await redis.lpush(`closes:${symbol}`, parseFloat(kline.c));
  await redis.ltrim(`closes:${symbol}`, 0, 49); // 50 dernières clôtures
}
```

### 5.5 `protection.js` — Arrêts automatiques

| Condition | Portée | Action |
|---|---|---|
| 3 pertes consécutives | Paire | Stop paire + lock Redis |
| Perte journalière paire dépassée | Paire | Stop paire + lock Redis |
| Erreur API 3× en 5 min | Paire | Stop paire + alerte |
| ATR > 3× ATR moyen | Paire | Pause 30 min |
| Slippage > MAX_SLIPPAGE_PCT | Paire | Sortie forcée + log |
| Position ouverte > MAX_POSITION_HOURS | Paire | Sortie marché forcée |
| Perte totale > 120 USDT/jour | Global | Stop toutes paires |
| Bot non répondant | Global | POST /restart auto |
| WebSocket coupé 3× | Paire | Reconnexion + alerte |

### 5.6 `journal.js` — Logger PostgreSQL

Compteur global trades *(C8)* :
```js
const totalTrades = await redis.incr('bot:global:total_trades');
if (totalTrades === 1500) {
  await notifyTelegram('🧠 Seuil 1500 trades — entraînement XGBoost Phase 2 possible');
}
```

Profit Factor temps réel *(S1)* :
```js
const profitFactor = sumTP / Math.abs(sumSL);
// Seuil dashboard : rouge < 1.2, orange 1.2–1.5, vert > 1.5
```

### 5.7 `atr.js` — Calcul ATR adaptatif
```
1. GET /api/v3/klines → 14 bougies 5min
2. True Range = max(H−L, |H−Cprev|, |L−Cprev|)
3. ATR = moyenne 14 TR
4. Cache Redis TTL 5 min
```

### 5.8 `regime.js` — Détection régime + suivi TREND_DOWN *(C12)*

| Régime | Condition | Comportement bot |
|---|---|---|
| TREND_UP | EMA5 > EMA20 × 1.002 | Trading normal, TP +10% |
| TREND_DOWN | EMA5 < EMA20 × 0.998 | Pause — attente retournement |
| VOLATILE | ATR > ATR_moy20j × 1.8 | Pause SOL, prudence BTC/ETH |
| RANGE | Aucune ci-dessus | Trading normal, fréquence max |

**Suivi durée TREND_DOWN *(C12)* :**
```js
// Si TREND_DOWN depuis 48h → alerte Telegram
// Si TREND_DOWN depuis 96h → flag intervention manuelle
// Reset automatique si régime change
```

### 5.9 `correlation.js` — Corrélation inter-paires *(C6 — Phase 1)*
```js
async function getPairCorrelation(symbolA, symbolB, n = 20, redis) {
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
  return num / (denA * denB);
}
```
Seuil blocage : corrélation > 0.85 avec position déjà ouverte sur la paire corrélée.

### 5.10 `health.js` — Endpoints HTTP

```
GET  /health    → { status, uptime, lastTrade }
GET  /status    → { pnl_day, trades, openOrders, consecLoss, regime, dryRun }
POST /stop      → Arrêt propre + annulation ordres
POST /config    → Mise à jour via Redis pub/sub (sans restart)
POST /restart   → Sortie process.exit(1) après auth token ← C10
```

**Endpoint /restart sécurisé *(C10)* :**
```js
app.post('/restart', (req, res) => {
  if (req.headers['x-restart-token'] !== process.env.RESTART_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  res.json({ status: 'restarting' });
  setTimeout(() => process.exit(1), 500); // Docker restart: unless-stopped
});
```

---

## 6. API BINANCE — SPÉCIFICATIONS TECHNIQUES

### 6.1 Endpoints utilisés

| Méthode | Endpoint | Usage |
|---|---|---|
| GET | /api/v3/exchangeInfo | Vérif opoAllowed au démarrage |
| GET | /api/v3/ticker/bookTicker | Prix bid/ask temps réel |
| GET | /api/v3/klines | K-lines pour ATR + corrélation |
| POST | /api/v3/orderList/opoco | Ordre OPOCO principal |
| POST | /api/v3/order (LIMIT_MAKER) | Entrée LIMIT |
| DELETE | /api/v3/order | Annulation ordre bloqué |
| GET | /api/v3/openOrders | Liste ordres ouverts |
| POST | /api/v3/userDataStream | Création listenKey |
| PUT | /api/v3/userDataStream | Keepalive 20 min *(C4)* |
| GET | /api/v3/account | Soldes |

### 6.2 Filtres BTCUSDT

| Filtre | Valeur | Impact |
|---|---|---|
| tickSize | 0.01 USDT | Précision prix |
| stepSize | 0.00001 BTC | Précision quantité |
| minNotional | 5 USDT | Valeur minimale ordre |
| opoAllowed | true | OPOCO disponible |
| otoAllowed | true | Requis OPOCO |
| ocoAllowed | true | Requis OPOCO |

### 6.3 Gestion rate limits
- REQUEST_WEIGHT : 6000/minute
- ORDERS : 50/10sec, 160000/jour
- Backoff 60s sur HTTP 429 + alerte Telegram
- Retry 3× backoff exponentiel (2s, 4s, 8s) sur HTTP 5xx

---

## 7. GESTION DES ORDRES

### 7.1 Pourquoi OPOCO + pourquoi sans `pendingQuantity`

OPOCO (**One Pays One Cancels the Other**) : le working order fill → la quantité reçue (nette de frais) est automatiquement utilisée pour les ordres pending. Pas besoin de spécifier `pendingQuantity` — c'est le comportement natif d'OPOCO.

Contrairement à OTOCO où `pendingQuantity` doit être spécifié (et peut causer des rejets LOT_SIZE si inférieur aux frais déduits), OPOCO gère ça côté Binance.

### 7.2 Pourquoi TP en `LIMIT` et non `LIMIT_MAKER` *(C3)*

`LIMIT_MAKER` est rejeté si au moment du placement le prix croise l'ordre (il deviendrait taker). En sortie de position, le prix évolue souvent dans la direction du TP — risque de rejet élevé. `LIMIT` avec `GTC` garantit l'exécution même si prix devient taker au fill.

L'entrée BUY reste en `LIMIT_MAKER` : on veut impérativement être maker à l'achat (frais 0%).

### 7.3 Gestion des erreurs API

| Code | Signification | Traitement |
|---|---|---|
| -1013 | LOT_SIZE incorrect | Recalculer avec stepSize + retry |
| -2011 | Ordre inconnu | Vérifier statut avant retry |
| -1121 | Symbole invalide | Arrêt critique |
| HTTP 429 | Rate limit dépassé | Backoff 60s + alerte |
| HTTP 5xx | Erreur Binance | Retry 3× backoff 2/4/8s |

---

## 8. ALGORITHMES ET IA

### 8.1 Phase 1 — Implémenté dès v1.0

**ATR Adaptatif** — ajuste TP/SL à la volatilité réelle.

**Détection Régime Marché** — TREND/RANGE/VOLATILE via EMA croisées + suivi durée TREND_DOWN *(C12)*.

**Corrélation inter-paires** *(C6 — avancé en Phase 1)* — calcul Pearson sur 20 clôtures, blocage si > 0.85 avec position ouverte sur paire corrélée.

**Kelly Criterion demi-fraction corrigé** *(C1)* — formule correcte, clamp [5%, 20%], minimum 100 trades avant recalcul.

**Filtre volume relatif** *(S2)* — ratio 0.8× – 4.0× volume moyen.

**Stop position temporel** *(S4)* — fermeture forcée si position > `MAX_POSITION_HOURS`.

### 8.2 Phase 2 — Après **1500** trades réels *(C8 — était 500)*

- **XGBoost classifier** : entraîné sur données Postgres réelles (7 features : heure, spread, ATR, régime, volume relatif, momentum, corrélation). Seuil : probabilité TP > 0.62
- **Backtest nocturne automatique** via N8n à 01h00 UTC
- Notification automatique à 1500 trades *(C8)*

### 8.3 Phase 3 — Après 3 mois de données
- RL Agent sur sizing (0.5× / 1× / 1.5× du capital alloué)

---

## 9. SYSTÈME DE PROTECTION CAPITAL

### 9.1 Protections par paire

| Protection | BTC | ETH | SOL |
|---|---|---|---|
| Pertes consécutives max | 3 | 3 | 3 |
| Perte journalière max | −60 USDT | −50 USDT | −40 USDT |
| Max trades/jour | 6 | 7 | 8 |
| ATR max (pause auto) | 3× moy. | 3× moy. | 3× moy. |
| Slippage max MARKET | 0.20% | 0.20% | 0.20% |
| Position max ouverte | 4h | 4h | 4h |
| Alerte inactivité | 1h | 1h | 1h |

### 9.2 Protection globale

| Condition | Seuil | Action |
|---|---|---|
| Perte totale jour | > 120 USDT | Stop toutes paires |
| Bot non répondant | Timeout 30s | POST /restart *(C10)* |
| WebSocket coupé | 3 tentatives | Reconnexion + alerte |

### 9.3 Persistence des locks Redis
```
bot:btc:daily_loss_locked = "1"
bot:global:stop = "1"
bot:btcusdt:trend_down_since = <timestamp>  ← C12
bot:global:total_trades = <count>           ← C8
```
Reset uniquement via WF5 N8n à minuit ou commande manuelle dashboard.

### 9.4 Gestion bot inactif

| Durée sans trade | Heure UTC | Action N8n |
|---|---|---|
| 30 min | 08h–22h | Telegram info |
| 1h | 08h–22h | Vérif + annulation ordre bloqué |
| 2h | 08h–22h | POST /restart si /health KO *(C10)* |
| 3h | 08h–22h | Relâchement spread +20% via Redis |
| 4h | 08h–22h | Alerte critique + question manuelle |
| Nuit | 22h–08h | Surveillance santé uniquement |

---

## 10. ORCHESTRATION N8N

### 10.1 Connexion
- Conteneur existant `rohan_n8n` (port 5678)
- Communication interne Docker via `http://rohan_n8n:5678`

### 10.2 Les 6 workflows

| Workflow | Déclencheur | Actions principales |
|---|---|---|
| WF1 — Health Check | Cron /5min | Ping 3 bots → **POST /restart** si KO *(C10)* → alerte inactivité |
| WF2 — Trade Alert | Webhook /trade | Log Postgres + Telegram + vérif perte globale + Profit Factor |
| WF3 — Stop Global | Webhook /stop-global | POST /stop 3 bots + Redis GLOBAL_STOP + alerte |
| WF4 — Rapport Daily | Cron 23h58 UTC | Agrégats + rapport Telegram |
| WF5 — Reset Daily | Cron 00h01 UTC | DEL locks Redis + reset compteurs + relance |
| WF6 — Config Update | Webhook /config | Redis pub/sub → bot applique sans restart |

> **C10 :** WF1 utilise un nœud **HTTP Request** (POST /restart avec `x-restart-token`) et non SSH. Plus sécurisé, plus simple, pas de gestion clés SSH dans N8n.

### 10.3 Format Telegram — trade
```
✅  BTC/USDT — TP atteint
Entrée: 104 650 → Sortie: 104 932
Qté: 0.0572 BTC  |  Durée: 18 min
Brut: +27.8  |  Frais: −9.8  |  Net: +18.0 USDT
PnL BTC: +34 USDT  |  Total 3 paires: +61 USDT  |  Obj: 80 USDT
Profit Factor: 1.84 ← S1
```

---

## 11. SERVEUR MCP

### 11.1 Outils exposés (10)

| Outil | Type | Description |
|---|---|---|
| get_pnl | Lecture | PnL live et historique par paire |
| get_trades | Lecture | Historique filtrable |
| get_status | Lecture | État, ordres, capital, DRY_RUN |
| get_regime | Lecture | Régime + ATR + corrélation actuelle |
| analyze_perf | Analyse | SQL auto + Profit Factor + Sharpe |
| set_config | Action | TP/SL/capital à chaud via Redis |
| stop_bot | Action | Arrêt propre |
| start_bot | Action | Démarrage |
| cancel_orders | Action | Annulation ordres ouverts |
| run_query | Analyse | SELECT uniquement sur Postgres |

---

## 12. DASHBOARD WEB

### 12.1 Accès
- URL : `http://37.1.209.232:3010`
- Stack : Node.js/Express + HTML/CSS/JS + Chart.js 4.x

### 12.2 Onglets (9)

| Onglet | Contenu |
|---|---|
| Dashboard | Stats globales + PnL intraday + cartes 3 paires + régime + protection + **Profit Factor** *(S1)* |
| Graphiques | PnL 30j, WR, distribution, trades/heure, drawdown, durée |
| Historique | Table + filtres + pagination + export CSV |
| Analyse | Perf globale, par paire, WR par régime, corrélation, suggestions, **Sortino** *(C9)* |
| Backtest | 12 paramètres + **Sharpe annualisé + Sortino** *(C9)* + courbe équité + drawdown |
| Fronttest | 3 scénarios + courbe forward + trades paper |
| Configuration | Paramètres globaux + par paire + **DRY_RUN toggle** *(S3)* |
| Commandes | Start/stop/restart + ordres + N8n + terminal |
| Logs | 4 panneaux (bot_btc, bot_eth, bot_sol, N8n) |

---

## 13. BASE DE DONNÉES

### 13.1 Schéma PostgreSQL

```sql
-- Table principale
CREATE TABLE trades (
  id              SERIAL PRIMARY KEY,
  symbol          VARCHAR(20) NOT NULL,
  entry_price     DECIMAL(18,8) NOT NULL,
  exit_price      DECIMAL(18,8),
  quantity        DECIMAL(18,8) NOT NULL,
  entry_time      TIMESTAMPTZ NOT NULL,
  exit_time       TIMESTAMPTZ,
  duration_min    INTEGER,
  atr_entry       DECIMAL(18,8),
  regime          VARCHAR(20),
  correlation_btc_eth DECIMAL(8,6),  -- ← C6
  tp_price        DECIMAL(18,8),
  sl_price        DECIMAL(18,8),
  pnl_brut        DECIMAL(18,4),
  fees            DECIMAL(18,4),
  pnl_net         DECIMAL(18,4),
  result          VARCHAR(20),  -- 'TP','SL','OPEN','CANCELLED','FORCED_EXIT','SLIPPAGE_ABORT'
  order_type      VARCHAR(20),  -- 'OPOCO','OCO'
  entry_mode      VARCHAR(20),  -- 'LIMIT_MAKER','MARKET'
  slippage_pct    DECIMAL(8,4), -- ← C7
  dry_run         BOOLEAN DEFAULT false,  -- ← S3
  kelly_fraction  DECIMAL(8,4), -- ← C1
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Événements système
CREATE TABLE events (
  id         SERIAL PRIMARY KEY,
  symbol     VARCHAR(20),
  type       VARCHAR(50),
  detail     JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Types d'événements : STOP_LOSS_LOCK, RESTART, CONFIG_CHANGE,
-- TREND_DOWN_48H, TREND_DOWN_96H, SLIPPAGE_ABORT, FORCED_EXIT,
-- CORRELATION_BLOCK, PHASE2_READY

-- Agrégats quotidiens
CREATE TABLE daily_summary (
  id             SERIAL PRIMARY KEY,
  date           DATE NOT NULL,
  symbol         VARCHAR(20) NOT NULL,
  total_trades   INTEGER,
  tp_count       INTEGER,
  sl_count       INTEGER,
  win_rate       DECIMAL(5,2),
  pnl_net        DECIMAL(18,4),
  fees           DECIMAL(18,4),
  profit_factor  DECIMAL(8,4),  -- ← S1
  sharpe         DECIMAL(8,4),  -- ← C9
  sortino        DECIMAL(8,4),  -- ← C9
  avg_duration   DECIMAL(8,2),
  kelly_avg      DECIMAL(8,4),
  UNIQUE(date, symbol)
);

-- Audit actions MCP
CREATE TABLE mcp_actions (
  id         SERIAL PRIMARY KEY,
  tool       VARCHAR(50),
  params     JSONB,
  result     JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_result ON trades(result);
CREATE INDEX idx_trades_entry_time ON trades(entry_time);
CREATE INDEX idx_trades_dry_run ON trades(dry_run);
CREATE INDEX idx_events_symbol ON events(symbol);
CREATE INDEX idx_events_type ON events(type);
```

### 13.2 Backup avec rotation externe *(C11)*
```bash
# /etc/cron.d/bot-backup — 03h00 UTC, rotation 30j + sync cloud
0 3 * * * root pg_dump -U bot -h localhost -p 5435 bot_trading \
  | gzip > /var/backups/bot-trading/bot_$(date +\%Y\%m\%d).sql.gz \
  && find /var/backups/bot-trading/ -name "*.sql.gz" -mtime +30 -delete \
  && rclone copy /var/backups/bot-trading/ gdrive:rohan-backups/bot-trading/ --max-age 24h
```
`rclone` configuré avec Google Drive (ou S3). Configuration documentée dans `README.md`.

---

## 14. SÉCURITÉ

### 14.1 Clés API Binance *(S5 — clés séparées par paire)*

| Instance | Clé API | Avantage |
|---|---|---|
| bot_btc | BINANCE_API_KEY_BTC | Compromission isolée |
| bot_eth | BINANCE_API_KEY_ETH | Révocation sans impact sur autres |
| bot_sol | BINANCE_API_KEY_SOL | Permissions strictes par paire |

- Permission activée : Spot Trading uniquement (jamais retraits)
- IP Whitelist : 37.1.209.232 uniquement sur les 3 clés
- Rotation recommandée tous les 90 jours

### 14.2 Réseau et accès
- Conteneurs sur `bot_network` (interne Docker)
- Ports exposés : 3010 (dashboard) et 5010 (MCP) uniquement
- Dashboard : authentification basique via Nginx
- MCP : token header `x-mcp-token`
- `/restart` : token dédié `x-restart-token` *(C10)*
- `run_query` MCP : SELECT uniquement

### 14.3 Secrets
```
.gitignore contient :
.env*
*.env
secrets/
```

---

## 15. TESTS — BACKTEST ET FRONTTEST

### 15.1 Backtest
- Source : GET /api/v3/klines (Binance)
- Période minimum : 12 mois
- Stockage klines en cache Postgres

**Métriques calculées *(C9 — Sharpe annualisé + Sortino)* :**
```js
const TRADING_DAYS = 252;

// Sharpe annualisé (correct)
const sharpe = (pnlMoyenJour / ecartTypePnlJour) * Math.sqrt(TRADING_DAYS);

// Sortino (pénalise seulement volatilité négative)
const downside = pnlsJour.filter(p => p < 0);
const downsideStd = Math.sqrt(downside.reduce((s, p) => s + p ** 2, 0) / downside.length);
const sortino = (pnlMoyenJour / downsideStd) * Math.sqrt(TRADING_DAYS);
```

Autres métriques : PnL total/moyen, WR, drawdown max (valeur + durée), Profit Factor *(S1)*, capital final, frais totaux.

### 15.2 Fronttest (Paper Trading)
- Mode Testnet Binance (`BINANCE_TESTNET=true`)
- Mode simulation pure (`DRY_RUN=true`) *(S3)*
- 3 scénarios dashboard : pessimiste/neutre/optimiste

### 15.3 Validation avant production

| Étape | Critère | Durée |
|---|---|---|
| 1. Backtest | WR > 55%, Sharpe > 1.5 sur 12 mois | — |
| 2. DRY_RUN local | Comportement signaux OK | 1 semaine |
| 3. Testnet Binance | WR confirmé, ordres OK | 2 semaines |
| 4. Production 10% | 1 500 USDT, comportement validé | 1 semaine |
| 5. Production complète | 15 000 USDT | Continu |

---

## 16. LIVRABLES ET PLANNING

### 16.1 Liste des livrables

| # | Livrable | Description |
|---|---|---|
| L1 | docker-compose.yml | Healthcheck + restart:unless-stopped *(C10)* |
| L2 | src/bot.js | Core + machine d'état + MAX_POSITION_HOURS *(S4)* |
| L3 | src/signal.js | Mode 2 + spread corrigé + volume relatif *(C5, S2)* |
| L4 | src/order.js | OPOCO correct + slippage + DRY_RUN *(C2, C3, C7, S3)* |
| L5 | src/monitor.js | WebSocket + keepalive 20min + alimentation closes Redis *(C4, C6)* |
| L6 | src/protection.js | Toutes règles de sécurité |
| L7 | src/journal.js | Logger + compteur Phase 2 1500 trades *(C8)* |
| L8 | src/atr.js | ATR adaptatif + cache Redis |
| L9 | src/regime.js | Régime + suivi TREND_DOWN 48h/96h *(C12)* |
| L10 | src/correlation.js | Corrélation Pearson Phase 1 *(C6)* |
| L11 | src/health.js | /health /status /stop /config /restart *(C10)* |
| L12 | dashboard/ | 9 onglets + Profit Factor + Sharpe annualisé *(S1, C9)* |
| L13 | mcp/server.js | 10 outils MCP |
| L14 | db/schema.sql | Schéma complet v1.1 |
| L15 | n8n/workflows/*.json | 6 workflows N8n (HTTP restart, sans SSH) *(C10)* |
| L16 | .env.* | Config par instance avec seuils corrigés *(C5)* |
| L17 | README.md | Déploiement + rclone config *(C11)* |

### 16.2 Phases de développement

| Phase | Contenu | Durée |
|---|---|---|
| Phase 1 — Fondation | docker-compose + bot.js + signal + order + journal + schema + health | Semaine 1–2 |
| Phase 2 — Intelligence | atr + regime + correlation + protection + monitor robuste | Semaine 3 |
| Phase 3 — Orchestration | N8n workflows + dashboard 9 onglets + MCP + backtest engine | Semaine 4 |
| Phase 4 — Validation | DRY_RUN 1sem → Testnet 2sem → Production 10% 1sem → complet | Semaine 5+ |

### 16.3 Points de vigilance critiques
1. Ne pas interférer avec `rohan_postgres` et `rohan_redis` (ports distincts 5435/6380)
2. UFW : ouvrir uniquement les ports 3010 et 5010
3. **3 paires de clés API distinctes** avec IP whitelist *(S5)*
4. `pendingQuantity` **absent** dans OPOCO (confirmé doc officielle) *(C2)*
5. TP en `LIMIT GTC`, entrée en `LIMIT_MAKER` *(C3)*
6. Tester OPOCO en Testnet avant production
7. Backup PostgreSQL avant toute migration
8. Jamais committer les `.env` dans Git
9. Configurer `rclone` avant mise en production *(C11)*
10. `RESTART_SECRET` en token 256 bits aléatoire *(C10)*

---

## 17. CORRECTIONS v1.1 — DÉTAIL COMPLET

### Corrections bloquantes (P0)

| ID | Module | Correction | Statut |
|---|---|---|---|
| C1 | bot.js | Formule Kelly corrigée + clamp [5%,20%] + min 100 trades | ✅ Intégré §4.4 |
| C2 | order.js | `pendingQuantity` non fourni dans OPOCO (confirmé doc Binance) | ✅ Intégré §5.3 + §7.1 |
| C3 | order.js | TP : `LIMIT GTC` au lieu de `LIMIT_MAKER` | ✅ Intégré §5.3 + §7.2 |
| C4 | monitor.js | Keepalive listenKey : 20 min au lieu de 30 min | ✅ Intégré §5.4 |

### Corrections majeures (P1)

| ID | Module | Correction | Statut |
|---|---|---|---|
| C5 | signal.js + .env | Seuils spread : BTC 1.50 / ETH 0.40 / SOL 0.08 | ✅ Intégré §3.2 + §5.2 |
| C6 | correlation.js | Corrélation inter-paires avancée en Phase 1 | ✅ Intégré §5.9 |
| C7 | order.js | Slippage MARKET borné + sortie forcée si > 0.20% | ✅ Intégré §5.3 |
| C8 | journal.js | Seuil XGBoost Phase 2 : 1500 trades (pas 500) | ✅ Intégré §8.2 |

### Corrections mineures (P2)

| ID | Module | Correction | Statut |
|---|---|---|---|
| C9 | dashboard | Sharpe annualisé × √252 + Sortino | ✅ Intégré §13.1 + §15.1 |
| C10 | health.js + docker-compose | Restart via HTTP token, sans SSH | ✅ Intégré §5.10 + §10.2 |
| C11 | cron VPS | Backup Postgres + rclone cloud + rotation 30j | ✅ Intégré §13.2 |
| C12 | regime.js | Suivi durée TREND_DOWN + alerte 48h/96h | ✅ Intégré §5.8 |

### Suggestions intégrées

| ID | Description | Statut |
|---|---|---|
| S1 | Profit Factor temps réel dans dashboard et Telegram | ✅ Intégré §5.6 + §12.2 |
| S2 | Volume relatif (ratio 0.8× – 4.0×) au lieu d'absolu | ✅ Intégré §5.2 |
| S3 | Mode DRY_RUN par paire dans .env | ✅ Intégré §3.2 + §5.3 |
| S4 | MAX_POSITION_HOURS : fermeture forcée si > 4h | ✅ Intégré §5.1 + §9.1 |
| S5 | 3 paires de clés API distinctes par instance | ✅ Intégré §3.2 + §14.1 |

### Point de désaccord avec le prompt de correction

**C2 — `pendingQuantity` dans OPOCO :** Le prompt suggérait d'ajouter `pendingQuantity` explicite. Après vérification de la documentation officielle Binance, ce paramètre **ne doit pas être fourni** dans OPOCO. C'est précisément la différence avec OTOCO : Binance calcule la quantité pending après fill, basée sur les fonds réellement reçus. Fournir `pendingQuantity` dans OPOCO pourrait provoquer une erreur ou un comportement inattendu. Le CDC maintient donc l'absence de ce paramètre, en accord avec la spec Binance.

---

*Fin du cahier des charges — Version 1.1.0*  
*ROHAN Innovation — Abidjan, Côte d'Ivoire — Juillet 2026*
