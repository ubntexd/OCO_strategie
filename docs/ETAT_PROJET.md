# ÉTAT PROJET — BotTrader v1.0
## ROHAN Innovation — Snapshot 10 juillet 2026 — v2.1
**À lire EN PREMIER par tout coworker arrivant sur le projet.**
**Temps de lecture estimé : 10 minutes.**

---

## 0. RÉSUMÉ EXÉCUTIF

> Dernier audit cohérence : 10/07/2026 — `docs/rapports/RAPPORT_AUDIT_COHERENCE.md`

| Item | Valeur |
|------|--------|
| Projet | BotTrader v1.0 — Trading automatisé Binance Spot |
| Paires | BTCUSDT · ETHUSDT · SOLUSDT |
| Capital cible | 15 000 USDT (6k BTC / 5k ETH / 4k SOL) |
| Objectif | 80 USDT net/jour |
| VPS | `176.97.70.254` — Ubuntu 24.04 LTS |
| Chemin | `/home/dev/dev/OCO_strategie` |
| Git branch | `main` — dernier commit `d2de46e` |
| Tests | **132/132 PASS** — 15 suites — ~5s |
| Dashboard | `http://176.97.70.254:3010` — **ACTIF et validé** |
| Statut global | 🟡 CODE COMPLET — BOT BTC DRY_RUN ACTIF — ETH/SOL À DÉMARRER |

---

## 1. CE QUI EST FAIT — CODE LIVRÉ ET TESTÉ

### 1.1 Modules core `src/` — 12 fichiers — 1 424 lignes

| Fichier | Lignes | Rôle | Suite de tests |
|---------|--------|------|----------------|
| `src/bot.js` | 238 | Machine d'état IDLE→SCANNING→POSITION→IDLE, boucle 30s | `bot.test.js` |
| `src/signal.js` | 123 | 8 filtres Mode 2 : spread, volume, EMA20/50, ATR, régime, corrélation, heures trading | `signal.test.js` |
| `src/order.js` | 247 | OPOCO (sans pendingQuantity), LIMIT_MAKER entrée, slippage guard, DRY_RUN | `order.test.js` |
| `src/monitor.js` | 205 | WebSocket Binance, keepalive listenKey 20min, reconnexion auto, waitForResult | `monitor.test.js` |
| `src/protection.js` | 82 | Locks Redis paire/global, stop journalier, timeout position 4h | `protection.test.js` |
| `src/journal.js` | 159 | Logger PostgreSQL — trades open/fill/close, events, daily_summary | `journal.test.js` |
| `src/atr.js` | 49 | ATR 14 bougies 5min via klines Binance, cache Redis 5min | `atr.test.js` |
| `src/regime.js` | 79 | TREND_UP / TREND_DOWN / VOLATILE / RANGE via EMA croisées | `regime.test.js` |
| `src/correlation.js` | 55 | Pearson sur 20 clôtures Redis, seuil blocage 0.85 | `correlation.test.js` |
| `src/kelly.js` | 45 | Half-Kelly clampé [5%–20%], fixe 10% si < 100 trades | `kelly.test.js` |
| `src/health.js` | 123 | Serveur HTTP par bot : GET /health /status, POST /stop /config /restart | `health.test.js` |
| `src/notify.js` | 19 | Notifications N8n webhook + Telegram | — |

### 1.2 Dashboard `dashboard/` — UI Pro — validée visuellement

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `dashboard/server.js` | 254 | Express + WS push 1s + 8 endpoints API |
| `dashboard/api/pnl.js` | 16 | PnL aujourd'hui par symbole |
| `dashboard/api/trades.js` | 25 | Liste trades avec filtres avancés |
| `dashboard/api/status.js` | 25 | État des 3 bots via Redis |
| `dashboard/api/backtest.js` | 48 | Backtest historique avec Sharpe/Sortino/PF |
| `dashboard/api/correlation.js` | 21 | Matrice corrélation depuis Redis |
| `dashboard/api/events.js` | 15 | Flux events depuis Postgres |
| `dashboard/public/js/dashboard.js` | 1035 | Frontend complet 10 onglets + Chart.js |
| `dashboard/public/css/dashboard.css` | ~300 | Design dark pro avec variables CSS |
| `dashboard/public/index.html` | ~60 | Structure HTML 10 onglets |

**URL :** `http://176.97.70.254:3010`
**Auth :** Basic `admin` / valeur de `DASHBOARD_PASSWORD`
**10 onglets opérationnels :**
- **Overview** — KPIs live WS, BTC/ETH/SOL bid, PnL jour, progression objectif, equity 7j
- **Historique** — Filtres 7 critères, tri multi-colonnes, stats analyse, export CSV
- **PnL** — Courbe 30j, barres journalières, courbes par symbole (Chart.js)
- **Statut Bots** — Kelly, régime, ATR, WS status, listenKey age, dernier signal (live WS)
- **Marché** — Binance REST + CoinGecko (2 sources indépendantes)
- **Corrélation** — Matrice colorée, badge BLOQUÉ si > 0.85
- **Backtest** — Formulaire + equity curve + Sharpe/Sortino/Profit Factor
- **Events** — Flux Postgres avec badges par type (SIGNAL_REJECTED, SLIPPAGE_ABORT…)
- **Config** — Config à chaud Redis par bot (formulaire avec suggestions)
- **Health/VPS** — CPU/RAM/uptime système, Docker conteneurs, objectif PnL barre de progression

**Validation visuelle :** Confirmée le 10/07/2026 — 55 events SIGNAL_REJECTED visibles, BTC 64 273 USDT live.

### 1.3 MCP Server `mcp/`

- **Port :** 5010 (conteneur `bot_mcp`) / 5011 (conteneur `mcp_bridge`)
- **10 outils :** `get_pnl`, `get_trades`, `get_status`, `get_regime`, `analyze_perf`, `set_config`, `stop_bot`, `start_bot`, `cancel_orders`, `run_query`
- **Sécurité :** SQL guard anti-injection (`mcp/lib/sqlGuard.js`), SELECT uniquement pour `run_query`
- **Audit :** Toute action loggée dans table `mcp_actions`

### 1.4 N8n Workflows `n8n/workflows/`

6 fichiers JSON prêts à importer dans N8n existant (`ultiumgrid_obs-n8n-1`, port 25678) :

| Fichier | Nom | Déclencheur | Priorité |
|---------|-----|-------------|----------|
| `wf1_health.json` | WF1 — Health Check | Cron `/5min` | 🔴 Critique |
| `wf2_trade_alert.json` | WF2 — Trade Alert | Webhook | 🟡 Important |
| `wf3_stop_global.json` | WF3 — Stop Global | Webhook | 🔴 Critique |
| `wf4_daily_report.json` | WF4 — Daily Report | Cron `23h58` | 🟢 Utile |
| `wf5_reset_daily.json` | WF5 — Daily Reset | Cron `00h01` | 🔴 Critique |
| `wf6_config_update.json` | WF6 — Config Update | Webhook | 🟡 Important |

### 1.5 Base de données `db/schema.sql`

4 tables créées et validées :

| Table | Rôle | Colonnes clés |
|-------|------|---------------|
| `trades` | Journal complet des trades | symbol, entry/exit price, qty, pnl_net, result, kelly_fraction, slippage_pct, dry_run |
| `events` | Événements système | symbol, type, payload JSONB, created_at |
| `daily_summary` | Agrégats quotidiens | summary_date, symbol, trades_count, wins, losses, pnl_net, profit_factor |
| `mcp_actions` | Audit actions MCP | tool, params, result, created_at |

Indexes sur colonnes fréquentes. Script idempotent (IF NOT EXISTS).

### 1.6 Tests `tests/`

```
15 suites de tests — 132 tests — 132 PASS — 0 FAIL
Couverture : src/ + mcp/ + dashboard/
Temps d'exécution : ~5 secondes
```

**Configuration :** `jest.config.js` — `forceExit: true`, `testTimeout: 15000`

### 1.7 Infrastructure Docker

7 conteneurs définis dans `docker-compose.yml` :

| Conteneur | Port hôte | Profile | État |
|-----------|-----------|---------|------|
| `bot_redis` | 6380 | (toujours) | ✅ ACTIF |
| `bot_postgres` | 5435 | (toujours) | ✅ ACTIF |
| `bot_dashboard` | 3010 | `ops` | ✅ ACTIF |
| `mcp_bridge` | 5011 | `ops` | ✅ ACTIF |
| `dev_dashboard` | 3020 | (toujours) | ✅ ACTIF |
| `claude_worker` | 4099 | `ops` | ✅ ACTIF |
| `bot_btc` | 4001 | `btc` | ✅ ACTIF (DRY_RUN) |
| `bot_eth` | 4002 | `full` | ⏸ Phase C |
| `bot_sol` | 4003 | `full` | ⏸ Phase B |
| `bot_mcp` | 5010 | `ops` | ⏸ À démarrer |

---

## 2. CE QUI RESTE À FAIRE — SÉQUENCE STRICTE

### ÉTAPE 1 — Bloquer immédiat : configurer POSTGRES_PASSWORD ⚠️

```bash
# Sur le VPS SSH :
nano /home/dev/dev/OCO_strategie/.env.shared
# Changer : POSTGRES_PASSWORD=CHANGE_ME
# Par     : POSTGRES_PASSWORD=<vrai_mot_de_passe_postgres>

nano /home/dev/dev/OCO_strategie/.env
# Même correction

# Redémarrer postgres pour prendre en compte :
docker compose restart bot_postgres
```

### ÉTAPE 2 — Démarrer bot_btc en DRY_RUN

```bash
cd /home/dev/dev/OCO_strategie
docker compose --profile btc up -d bot_btc
docker compose logs -f bot_btc
```

**Attendu :** Logs toutes les 30s — signaux évalués — events `SIGNAL_REJECTED` insérés en DB si filtrés — trades `DRY_RUN` si signal OK.

### ÉTAPE 3 — Valider DRY_RUN 1 semaine

Critères GO/NO-GO BTC DRY_RUN :
- [ ] WR ≥ 53% sur minimum 50 trades
- [ ] Profit Factor ≥ 1.5
- [ ] Zéro erreur OPOCO (vérifier logs)
- [ ] Health /health répond en < 5s
- [ ] N8n WF1 ping toutes les 5min sans alertes
- [ ] Reset daily WF5 fonctionne à 00h01

### ÉTAPE 4 — Importer workflows N8n

Dans l'interface N8n (`http://127.0.0.1:25678`) :
```
Import → wf1_health.json → Activer
Import → wf3_stop_global.json → Activer
Import → wf5_reset_daily.json → Activer
Import → wf2_trade_alert.json → Activer
Import → wf4_daily_report.json → Activer
Import → wf6_config_update.json → Activer
```

### ÉTAPE 5 — Production 10% capital BTC

```bash
# Modifier .env.btc :
DRY_RUN=false
CAPITAL=600   # 10% de 6000 USDT

docker compose --profile btc restart bot_btc
```

### ÉTAPE 6 — GO/NO-GO prod complète BTC → SOL → ETH

Critères identiques par paire. Séquence stricte — jamais deux paires simultanées en validation.

---

## 3. DÉCISIONS TECHNIQUES CLÉS — NON NÉGOCIABLES

| Décision | Valeur | Raison |
|----------|--------|--------|
| OPOCO sans `pendingQuantity` | ✅ Absent | Binance calcule post-fill — si présent → rejet API |
| TP ordre type | `LIMIT GTC` | LIMIT_MAKER rejeté si prix croise au moment du placement |
| Entrée ordre type | `LIMIT_MAKER` | Frais 0% maker garanti — jamais MARKET pour l'entrée |
| Keepalive listenKey | 20 min | Binance expire à 60min — marge sécurité 40min |
| Kelly fraction | [5% – 20%] | Half-Kelly clampé — protection capital |
| Kelly min trades | 100 | En dessous → 10% fixe — pas assez de données |
| Corrélation seuil blocage | 0.85 | Signal bloqué si corrélation > 0.85 entre paires |
| XGBoost activation | 1 500 trades réels | Données insuffisantes avant — Phase 2 uniquement |
| Spread max BTC | ≤ 1.50 USDT | Filtre signal — spread trop large = liquidité faible |
| Spread max ETH | ≤ 0.40 USDT | Idem |
| Spread max SOL | ≤ 0.08 USDT | Idem |
| Sharpe annualisé | × √252 | 252 jours trading par an — convention standard |
| VPS cible | `176.97.70.254` | Remplace `37.1.209.232` — cohabitation UltiumGrid |
| Postgres port hôte | `5435` | Port 5433 occupé par UltiumGrid SOL |
| Déploiement | BTC → SOL → ETH | Séquence stricte — jamais simultané |
| Capital Phase 1 | 600 USDT (10% BTC) | Montée progressive — validation avant mise en prod |

---

## 4. ARCHITECTURE VPS — ÉTAT RÉEL

```
176.97.70.254 — /home/dev/dev/OCO_strategie
│
├─── ACTIFS ──────────────────────────────────────────────────
│  bot_redis          :6380   Redis 7 — locks, pub/sub, closes
│  bot_postgres       :5435   Postgres 16 — trades, events
│  bot_dashboard      :3010   UI Pro 10 onglets — ✅ VALIDÉ
│  mcp_bridge         :5011   MCP HTTP Claude Desktop
│  dev_dashboard      :3020   Dashboard développement
│  claude_worker      :4099   Worker autonome
│
├─── À DÉMARRER ──────────────────────────────────────────────
│  bot_btc            :4001   Bot BTCUSDT (profile btc)
│  bot_mcp            :5010   MCP server (profile ops)
│
└─── PHASE FUTURE ────────────────────────────────────────────
   bot_sol            :4003   SOLUSDT (après BTC validé)
   bot_eth            :4002   ETHUSDT (après SOL validé)
```

---

## 5. ENVIRONNEMENT — VARIABLES REQUISES

### `.env.btc` (exemple complet)
```bash
SYMBOL=BTCUSDT
CAPITAL=6000            # 600 pour phase test 10%
TP_BRUT=28              # USDT
SL_BRUT=18              # USDT
MAX_SPREAD=1.50         # USDT
MAX_TRADES_DAY=6
MAX_CONSEC_LOSS=3
MAX_LOSS_DAY=60         # USDT
DRY_RUN=true            # false pour prod
BINANCE_TESTNET=false
PORT=4001
BINANCE_API_KEY=<clé_api_btc>
BINANCE_API_SECRET=<secret_btc>
```

### `.env.shared` (variables communes)
```bash
REDIS_URL=redis://bot_redis:6379
POSTGRES_URL=postgresql://bot:<PASSWORD>@bot_postgres:5432/bot_trading
POSTGRES_PASSWORD=<VRAI_MOT_DE_PASSE>    # ← BLOQUER CRITIQUE
DASHBOARD_PASSWORD=<mot_de_passe_dashboard>
RESTART_SECRET=<token_restart>
TELEGRAM_BOT_TOKEN=<token_telegram>
TELEGRAM_CHAT_ID=<chat_id>
TRADING_HOURS_START=08:00
TRADING_HOURS_END=22:00
FEES_RATE=0.00075
BNB_FEES=true
ENTRY_MODE=LIMIT_MAKER
MAX_SLIPPAGE_PCT=0.20
MAX_POSITION_HOURS=4
LOG_LEVEL=info
```

---

## 6. COMMITS — HISTORIQUE

```
d2de46e  feat: dashboard UI pro v2 validé — 10 onglets Chart.js 132/132 PASS
6b62b66  feat: dashboard UI pro v2 + volume bind-mount docker-compose
421aff2  feat: dashboard conforme CDC v1.1 — 9 onglets complets
70f7deb  docs: architecture 3 modules de développement
159211b  docs: rapport alignement CDC/CD — VPS 176.97.70.254 BTC first
1ce88ad  docs: cahier de développement BotTrader v1.1.0
```
