# CAHIER DE VALIDATION — BotTrader v1.0
## ROHAN Innovation — Validation exhaustive et détaillée
**Version :** 1.0
**Date :** 10 juillet 2026
**Auteur :** ROHAN Innovation / Claude Architect
**Usage :** Document de référence pour tout coworker chargé de valider le système

---

## TABLE DES MATIÈRES

1. Pré-requis et environnement de validation
2. Validation unitaire — module par module
3. Validation intégration — scénarios bout-en-bout
4. Validation dashboard — vérification visuelle
5. Validation infrastructure Docker
6. Validation base de données
7. Validation N8n workflows
8. Checklist DRY_RUN — 1 semaine
9. Checklist GO/NO-GO production par paire
10. Procédures de rollback et incidents
11. Critères d'acceptation globaux

---

## 1. PRÉ-REQUIS ET ENVIRONNEMENT DE VALIDATION

### 1.1 Environnement requis

```bash
# Connexion VPS
ssh dev@176.97.70.254
cd /home/dev/dev/OCO_strategie

# Vérifier que les conteneurs de base tournent
docker ps | grep -E "bot_redis|bot_postgres|bot_dashboard"

# Vérifier la version Node dans les conteneurs
docker exec bot_dashboard node --version   # doit afficher v22.x
```

### 1.2 Vérifier les tests avant tout

```bash
# Lancer la suite complète
npm test

# Résultat attendu OBLIGATOIRE :
# Tests: 132 passed, 132 total
# Test Suites: 15 passed, 15 total
# Time: < 10s
```

> ⚠️ **RÈGLE ABSOLUE** : aucune validation manuelle n'est effectuée si les tests ne passent pas à 132/132.

### 1.3 Accès dashboard

```
URL     : http://176.97.70.254:3010
Login   : admin
Password: valeur de DASHBOARD_PASSWORD dans .env.shared
```

---

## 2. VALIDATION UNITAIRE — MODULE PAR MODULE

### 2.1 `src/kelly.js` — Kelly fraction

**Lancer :**
```bash
npx jest tests/unit/kelly.test.js --verbose
```

**Vérifier ces cas précis :**

| Test | Input | Attendu |
|------|-------|---------|
| WR=60%, RR=1.5 | `computeKellyFormula(0.60, 1.5)` | Entre 0.05 et 0.20 |
| WR=10% (perdant) | `computeKellyFormula(0.10, 1.0)` | Exactement 0.05 (clamped min) |
| WR=99%, RR=10 | `computeKellyFormula(0.99, 10)` | Exactement 0.20 (clamped max) |
| computeKellyAuto < 100 trades | Mock pgPool 0 rows | Retourne 0.10 (fixe) |

**Ce qui serait un FAIL :**
- `computeKellyFormula` est async → FAIL (doit être sync)
- Valeur retournée hors [0.05, 0.20] → FAIL
- `computeKellyAuto` sans `await` dans bot.js → bug critique

---

### 2.2 `src/signal.js` — 8 filtres

**Lancer :**
```bash
npx jest tests/unit/signal.test.js --verbose
```

**Vérifier les 8 filtres :**

| # | Filtre | Condition de rejet |
|---|--------|--------------------|
| 1 | Spread | `ask - bid > MAX_SPREAD` → SIGNAL_REJECTED reason: SPREAD_TOO_HIGH |
| 2 | Volume | Volume 24h < seuil configuré → SIGNAL_REJECTED |
| 3 | EMA | EMA20 < EMA50 (pas de tendance haussière) → rejeté |
| 4 | ATR | ATR trop faible (marché plat) → rejeté |
| 5 | Corrélation | Pearson > 0.85 avec autre paire → SIGNAL_REJECTED |
| 6 | Heures trading | Heure hors [TRADING_HOURS_START, TRADING_HOURS_END] → SIGNAL_REJECTED |
| 7 | Global stop | `bot:global:stop = 1` → rejeté |
| 8 | Position ouverte | `bot:{sym}:position_open = 1` → rejeté |

**Confirmation des 55 events visibles sur dashboard :**
La majorité montre `TRADING_HOURS` → filtre 6 fonctionne correctement.

---

### 2.3 `src/order.js` — Ordres OPOCO

**Lancer :**
```bash
npx jest tests/unit/order.test.js --verbose
```

**Points critiques à valider manuellement :**

```javascript
// ✅ CORRECT — pas de pendingQuantity
{
  symbol: 'BTCUSDT',
  side: 'SELL',
  quantity: '0.001',
  price: '65000',          // TP
  stopPrice: '63000',      // SL déclenchement
  stopLimitPrice: '62980', // SL limite
  // pendingQuantity: ABSENT — Binance calcule post-fill
}

// ❌ INCORRECT — rejeté par Binance
{
  pendingQuantity: '0.001', // NE PAS AJOUTER
}
```

**Vérifier DRY_RUN :**
```bash
# En mode DRY_RUN, placeEntry doit retourner {simulated: true}
# Aucun ordre ne doit partir sur Binance
grep "simulated\|DRY_RUN" /app/src/order.js
```

---

### 2.4 `src/monitor.js` — WebSocket

**Lancer :**
```bash
npx jest tests/unit/monitor.test.js --verbose
```

**Vérifier :**
- `waitForResult()` est bien définie et exportée
- Keepalive listenKey toutes les 20 minutes (pas 30, pas 60)
- Reconnexion automatique après déconnexion WS
- `waitForFill()` est bien définie dans `order.js`

---

### 2.5 `src/protection.js` — Locks Redis

**Lancer :**
```bash
npx jest tests/unit/protection.test.js --verbose
```

**Scénarios à valider :**

| Scénario | Attendu |
|----------|---------|
| Perte quotidienne > MAX_LOSS_DAY | `bot:global:stop = 1` dans Redis |
| 3 pertes consécutives | Pair lock activé |
| Position ouverte depuis > MAX_POSITION_HOURS | Position fermée (FORCED_EXIT) |
| Reset daily WF5 | Tous les locks supprimés |

---

### 2.6 `src/correlation.js` — Pearson

**Lancer :**
```bash
npx jest tests/unit/correlation.test.js --verbose
```

**Vérifier :**
```javascript
// Corrélation parfaite = 1.0 → blocage
// Corrélation nulle = 0.0 → OK
// Corrélation > 0.85 → shouldBlockOnCorrelation() retourne true
// Seuil exact : 0.85 (ni 0.84 ni 0.86)
```

---

### 2.7 `src/atr.js`

**Lancer :**
```bash
npx jest tests/unit/atr.test.js --verbose
```

**Vérifier :**
- ATR calculé sur 14 bougies (pas 10, pas 20)
- Bougie 5min depuis Binance klines endpoint
- Cache Redis 5 minutes — pas de requête Binance à chaque cycle
- Retourne `{atr: number, cached: boolean}`

---

### 2.8 `src/regime.js`

**Lancer :**
```bash
npx jest tests/unit/regime.test.js --verbose
```

**4 régimes possibles :**

| Régime | Condition | Signal autorisé |
|--------|-----------|-----------------|
| `TREND_UP` | EMA20 > EMA50, pente positive | ✅ OUI |
| `TREND_DOWN` | EMA20 < EMA50 | ❌ NON |
| `VOLATILE` | ATR > seuil haut | ⚠️ Config dépendant |
| `RANGE` | EMA20 ≈ EMA50, faible ATR | ⚠️ Config dépendant |

---

## 3. VALIDATION INTÉGRATION — SCÉNARIOS BOUT-EN-BOUT

### 3.1 Scénario A — Cycle complet DRY_RUN

**Pré-requis :** `bot_btc` démarré avec `DRY_RUN=true`

**Séquence attendue :**
```
1. bot.js démarre → validateRequiredEnv() → OK
2. Connexion Redis → OK
3. Connexion Postgres → OK
4. health.startHealthServer(4001) → GET http://bot_btc:4001/health → {status:'ok'}
5. monitor.startMonitor('BTCUSDT') → WS connecté à Binance
6. Boucle 30s → signal.evaluateSignal()
   └─ Si rejeté → INSERT INTO events (type='SIGNAL_REJECTED', payload={reason:'...'})
   └─ Si OK → placeEntry() → {simulated:true} → logTradeOpen() → logTradeClose()
7. Dashboard → onglet Events → nouveaux events visibles
8. Dashboard → onglet Statut → position_open, trades_day mis à jour
```

**Commandes de vérification :**
```bash
# Logs bot
docker compose logs -f bot_btc

# Events en DB
docker exec bot_postgres psql -U bot -d bot_trading \
  -c "SELECT type, payload, created_at FROM events ORDER BY created_at DESC LIMIT 10;"

# Trades DRY_RUN
docker exec bot_postgres psql -U bot -d bot_trading \
  -c "SELECT id, result, pnl_net, dry_run FROM trades ORDER BY id DESC LIMIT 5;"

# Redis état
docker exec bot_redis redis-cli GET bot:btcusdt:position_open
docker exec bot_redis redis-cli GET bot:btcusdt:trades_day
```

---

### 3.2 Scénario B — Stop global

**Test :**
```bash
# Simuler perte > MAX_LOSS_DAY via Redis direct
docker exec bot_redis redis-cli SET bot:global:stop 1

# Vérifier que le bot est en pause (log attendu) :
docker compose logs bot_btc | tail -20
# Attendu : "position bloquée — global stop actif"

# Reset
docker exec bot_redis redis-cli DEL bot:global:stop
```

---

### 3.3 Scénario C — Config à chaud

**Via dashboard onglet Config :**
```
Symbol : BTCUSDT
Clé    : MAX_TRADES_DAY
Valeur : 3
→ Envoyer
→ Attendu : {"status":"applied","symbol":"BTCUSDT","key":"MAX_TRADES_DAY","value":"3"}
```

**Vérifier que le bot reçoit :**
```bash
docker compose logs bot_btc | grep "Config à chaud"
# Attendu : [INFO] [BTCUSDT] Config à chaud: MAX_TRADES_DAY=3
```

---

### 3.4 Scénario D — Health endpoint

```bash
# Depuis l'hôte VPS
curl http://localhost:4001/health
# Attendu :
{
  "status": "ok",
  "uptime": <secondes>,
  "symbol": "BTCUSDT",
  "lastTradeAt": "<timestamp ou null>",
  "version": "1.0.0"
}

curl http://localhost:4001/status
# Attendu :
{
  "pnl_day": <number>,
  "trades_day": <number>,
  "open_orders": <0 ou 1>,
  "consec_loss": <number>,
  "regime": "<TREND_UP|TREND_DOWN|VOLATILE|RANGE>",
  "dry_run": true,
  "kelly_fraction": <0.05 à 0.20>
}
```

---

### 3.5 Scénario E — WebSocket Dashboard

**Vérifier en temps réel :**
1. Ouvrir `http://176.97.70.254:3010`
2. Onglet Overview — le timestamp en haut à droite doit changer chaque seconde
3. Le point vert (WS dot) doit pulser
4. BTC/ETH/SOL bid doivent afficher des prix réels (pas `—`)
5. PnL jour doit afficher `0.00 $` si aucun trade fermé aujourd'hui

---

## 4. VALIDATION DASHBOARD — VÉRIFICATION VISUELLE

### 4.1 Checklist onglet par onglet

#### Overview
- [ ] Header : ROHAN logo + BTC/ETH/SOL prix + PnL + WS dot vert
- [ ] 4 KPI tiles : PnL Jour, BTC/USD, Positions ouvertes, Stop global
- [ ] Barre de progression objectif 80 USDT visible
- [ ] Bot strip : 3 cards BTC/ETH/SOL avec données Redis
- [ ] Graphique equity 7j Chart.js (bleu, rempli)
- [ ] WS update toutes les secondes (timestamp change)

#### Historique
- [ ] Filtres : Symbole, Résultat, De/À, PnL min/max, Dry run — tous fonctionnels
- [ ] Tableau : 11 colonnes avec données formatées
- [ ] Bouton **Appliquer** → recharge le tableau
- [ ] Bouton **Reset** → efface les filtres
- [ ] Bouton **⬇ CSV** → télécharge un fichier `.csv`
- [ ] Clic en-tête colonne → tri ASC/DESC avec indicateur ↑/↓
- [ ] 4 KPI stats sous les filtres : Trades, Win Rate, PnL total, PnL moyen
- [ ] Graphique equity filtrée Chart.js (vert si positif, rouge si négatif)

#### PnL
- [ ] 3 KPI par symbole (PnL + count trades aujourd'hui)
- [ ] Graphique equity 30j (courbe bleue)
- [ ] Graphique barres journalières (vert/rouge selon signe)
- [ ] Graphique courbes par symbole BTC/ETH/SOL (3 couleurs)

#### Statut Bots
- [ ] 3 cards une par paire avec toutes métriques Redis
- [ ] Kelly, ATR, WS status, listenKey age visibles
- [ ] PnL total en bas
- [ ] Mis à jour par WS live (sans rechargement)

#### Marché
- [ ] 3 ticker cards : BTC, ETH, SOL
- [ ] Source Binance REST : prix, variation 24h, High/Low, Volume
- [ ] Source CoinGecko : Market cap, variation 24h
- [ ] Badge `Binance REST ✅` et `CoinGecko ✅` (ou ❌ si API down)

#### Corrélation
- [ ] Matrice 3×3 colorée
- [ ] Cellules rouges si corrélation > 0.85 avec badge 🚫
- [ ] Cellules vertes si corrélation < 0.60
- [ ] Tableau en dessous avec valeurs brutes et badge BLOQUÉ/OK

#### Backtest
- [ ] Formulaire : Symbole + Jours + Bouton Lancer
- [ ] Après lancement : 4 KPI (PnL, Sharpe, Sortino, Profit Factor)
- [ ] Equity curve Chart.js (couleur selon PnL final)
- [ ] Tableau journalier détaillé

#### Events
- [ ] Table avec badges colorés par type
- [ ] SIGNAL_REJECTED → badge jaune
- [ ] SLIPPAGE_ABORT → badge violet
- [ ] TRADE_OPEN → badge bleu
- [ ] TRADE_CLOSE → badge vert
- [ ] GLOBAL_STOP → badge rouge

#### Config
- [ ] Formulaire Bot/Clé/Valeur avec suggestions autocomplete
- [ ] Bouton Envoyer → toast de confirmation
- [ ] Message ✅ Appliqué avec réponse JSON

#### Health / VPS
- [ ] CPU % avec barre de progression (rouge si > 80%)
- [ ] RAM MB utilisée / totale avec barre
- [ ] Uptime jours + heures
- [ ] Docker containers liste (ou message si inaccessible)
- [ ] PnL vs objectif 80 USDT avec barre

---

## 5. VALIDATION INFRASTRUCTURE DOCKER

### 5.1 Vérifier tous les conteneurs actifs

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Attendu minimum :**
```
bot_redis       Up X hours   0.0.0.0:6380->6379/tcp
bot_postgres    Up X hours   0.0.0.0:5435->5432/tcp
bot_dashboard   Up X hours   0.0.0.0:3010->3010/tcp
mcp_bridge      Up X hours   0.0.0.0:5011->5011/tcp
```

### 5.2 Health checks

```bash
# Dashboard
curl http://localhost:3010/health
# → {"status":"ok","service":"bot-dashboard","port":3010}

# MCP bridge
curl http://localhost:5011/health
# → {"status":"ok"}

# Bot BTC (si démarré)
curl http://localhost:4001/health
# → {"status":"ok","symbol":"BTCUSDT",...}
```

### 5.3 Réseau Docker

```bash
docker network inspect bot_network
# Doit lister : bot_redis, bot_postgres, bot_dashboard, mcp_bridge, bot_btc (si actif)
```

### 5.4 Volumes Postgres

```bash
docker volume ls | grep bot_pgdata
# → local   oco_strategie_bot_pgdata

# Taille
docker exec bot_postgres du -sh /var/lib/postgresql/data
```

---

## 6. VALIDATION BASE DE DONNÉES

### 6.1 Connexion et tables

```bash
docker exec -it bot_postgres psql -U bot -d bot_trading

# Dans psql :
\dt
# Doit afficher : trades, events, daily_summary, mcp_actions

\d trades
# Vérifier : dry_run boolean, kelly_fraction numeric, slippage_pct numeric

SELECT COUNT(*) FROM events;
# Doit être > 0 si bot_btc a tourné
```

### 6.2 Vérifier le schéma exact

```sql
-- trades : colonnes requises CDC §13
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trades'
ORDER BY ordinal_position;

-- Colonnes attendues :
-- id, symbol, entry_time, exit_time, entry_price, exit_price,
-- qty, duration_min, pnl_brut, fees, pnl_net, result,
-- order_type, entry_mode, regime, kelly_fraction,
-- correlation_btc_eth, slippage_pct, dry_run, created_at
```

### 6.3 Test données DRY_RUN

```sql
-- Trades dry run (insérés par bot en DRY_RUN=true)
SELECT id, symbol, result, dry_run, kelly_fraction
FROM trades
WHERE dry_run = true
ORDER BY id DESC
LIMIT 10;

-- Events signal rejected
SELECT type, payload->>'reason' AS reason, created_at
FROM events
WHERE type = 'SIGNAL_REJECTED'
ORDER BY created_at DESC
LIMIT 20;
```

### 6.4 Index présents

```sql
SELECT indexname FROM pg_indexes
WHERE tablename IN ('trades','events','daily_summary')
ORDER BY tablename, indexname;

-- Attendu :
-- idx_trades_symbol_created
-- idx_trades_symbol_entry_day
-- idx_trades_result
-- idx_events_symbol_created
-- idx_events_type
-- idx_daily_summary_date_symbol
```

---

## 7. VALIDATION N8n WORKFLOWS

### 7.1 Import et activation

Depuis l'interface N8n (`http://127.0.0.1:25678` ou IP VPS port 25678) :

```
Menu → Workflows → Import from file
→ n8n/workflows/wf1_health.json
→ Vérifier : nœuds visibles, connexions correctes
→ Activer le workflow
→ Vérifier exécution dans "Executions"
```

### 7.2 Test WF1 — Health Check

```bash
# WF1 ping /health toutes les 5min
# Simuler une panne en stoppant bot_btc :
docker compose stop bot_btc

# Attendre 5min → WF1 doit détecter l'échec et envoyer alerte Telegram
# Puis appeler POST /restart avec x-restart-token

# Redémarrer manuellement pour vérifier :
docker compose --profile btc start bot_btc
```

### 7.3 Test WF5 — Reset Daily

```bash
# Vérifier l'heure du cron dans wf5_reset_daily.json :
cat n8n/workflows/wf5_reset_daily.json | grep cron
# Attendu : 00h01

# Test manuel : appeler POST /config reset_daily
curl -X POST http://localhost:4001/config \
  -H "Content-Type: application/json" \
  -H "x-bot-token: <RESTART_SECRET>" \
  -d '{"key":"reset_daily","value":"true"}'
# Attendu : {"status":"applied","key":"reset_daily"}

# Vérifier Redis après reset :
docker exec bot_redis redis-cli KEYS "bot:btcusdt:*"
# Les clés daily_loss_locked et consec_loss doivent être à 0
```

---

## 8. CHECKLIST DRY_RUN — 1 SEMAINE

À remplir quotidiennement pendant 7 jours consécutifs avant de passer en prod.

### Jour J — Vérifications quotidiennes

```
□ bot_btc ACTIF (docker ps | grep bot_btc)
□ Aucun crash depuis 24h (docker logs bot_btc --since 24h | grep "Erreur fatale")
□ Events SIGNAL_REJECTED insérés en DB (pas de silence total)
□ WF1 Health Check s'exécute toutes les 5min (N8n Executions)
□ WF5 Reset Daily s'est exécuté à 00h01 (logs N8n)
□ Dashboard Overview — WS live actif (timestamp change chaque seconde)
□ Dashboard Events — nouveaux events visibles
□ Aucune erreur OPOCO dans les logs
□ Aucune alerte Telegram inattendue
```

### Métriques à atteindre avant GO production

| Métrique | Seuil minimum | Seuil cible |
|----------|---------------|-------------|
| Nombre de cycles évalués | ≥ 500 | — |
| Trades DRY_RUN fermés | ≥ 50 | ≥ 100 |
| Win Rate DRY_RUN | ≥ 53% | ≥ 58% |
| Profit Factor DRY_RUN | ≥ 1.2 | ≥ 1.5 |
| Uptime bot | ≥ 95% sur 7j | 99% |
| Erreurs critiques | 0 | 0 |
| Crashes non récupérés | 0 | 0 |

### Lecture des métriques DRY_RUN

```sql
-- Métriques depuis Postgres
SELECT
  COUNT(*) AS total_trades,
  COUNT(*) FILTER (WHERE pnl_net > 0) AS wins,
  ROUND(COUNT(*) FILTER (WHERE pnl_net > 0) * 100.0 / COUNT(*), 1) AS win_rate_pct,
  ROUND(SUM(pnl_net)::numeric, 2) AS total_pnl,
  ROUND(
    SUM(pnl_net) FILTER (WHERE pnl_net > 0) /
    NULLIF(ABS(SUM(pnl_net) FILTER (WHERE pnl_net < 0)), 0),
    2
  ) AS profit_factor
FROM trades
WHERE dry_run = true
  AND symbol = 'BTCUSDT'
  AND result NOT IN ('OPEN', 'CANCELLED');
```

---

## 9. CHECKLIST GO/NO-GO PRODUCTION PAR PAIRE

### Phase A — BTCUSDT

#### Pré-conditions techniques
- [ ] Tests 132/132 PASS
- [ ] POSTGRES_PASSWORD configuré (non CHANGE_ME)
- [ ] BINANCE_API_KEY et SECRET valides (whitelist IP 176.97.70.254)
- [ ] DRY_RUN=false dans .env.btc
- [ ] CAPITAL=600 (10% — phase test)
- [ ] N8n WF1, WF3, WF5 actifs

#### Validation DRY_RUN 1 semaine
- [ ] WR ≥ 53% sur ≥ 50 trades
- [ ] PF ≥ 1.2 (cible 1.5)
- [ ] 0 crash non récupéré
- [ ] 0 erreur OPOCO (pendingQuantity, etc.)
- [ ] Reset daily WF5 fonctionne

#### GO production 10% capital
```bash
# Modifier .env.btc :
DRY_RUN=false
CAPITAL=600

docker compose --profile btc restart bot_btc
docker compose logs -f bot_btc
```

**Premier trade réel — vérifications immédiates :**
```bash
# Dans les logs :
# → "Signal OK — price=... tp=... sl=... kelly=... qty=..."
# → "Ordre LIMIT_MAKER placé — orderId=..."
# → Aucun "pendingQuantity" dans les logs

# Dans Binance :
# → Vérifier manuellement l'ordre ouvert dans l'interface Binance
# → Prix d'entrée = LIMIT_MAKER (ne doit pas croiser le marché)
# → TP et SL placés via OPOCO
```

#### GO production 100% capital BTCUSDT
- [ ] 100 trades réels BTCUSDT
- [ ] WR ≥ 53%, PF ≥ 1.5
- [ ] Drawdown max < 10% du capital BTCUSDT
- [ ] Sharpe annualisé ≥ 1.0
- [ ] 0 incident de sécurité

#### Passage à CAPITAL=6000
```bash
nano .env.btc
# CAPITAL=6000
docker compose --profile btc restart bot_btc
```

---

### Phase B — SOLUSDT (après BTC validé 100%)

```bash
# Créer .env.sol si pas existant
cp .env.btc .env.sol
# Modifier :
# SYMBOL=SOLUSDT
# CAPITAL=400  (10% de 4000)
# MAX_SPREAD=0.08
# BINANCE_API_KEY=<clé_sol>
# BINANCE_API_SECRET=<secret_sol>
# PORT=4003

docker compose --profile full up -d bot_sol
```

Mêmes critères que Phase A.

---

### Phase C — ETHUSDT (après SOL validé)

```bash
cp .env.btc .env.eth
# SYMBOL=ETHUSDT
# CAPITAL=500  (10% de 5000)
# MAX_SPREAD=0.40
# PORT=4002
```

---

## 10. PROCÉDURES DE ROLLBACK ET INCIDENTS

### 10.1 Stop d'urgence

```bash
# Via dashboard onglet Config :
Clé: reset_daily → Valeur: true → Envoyer

# Via Redis direct :
docker exec bot_redis redis-cli SET bot:global:stop 1

# Via endpoint bot :
curl -X POST http://localhost:4001/stop \
  -H "x-bot-token: <RESTART_SECRET>"

# Arrêt complet :
docker compose stop bot_btc bot_eth bot_sol
```

### 10.2 Rollback code

```bash
# Voir l'historique git
git log --oneline -10

# Revenir à un commit précédent
git checkout <commit_hash> -- src/ dashboard/ tests/
npm test  # vérifier 132/132
git commit -m "rollback: retour à <commit_hash>"
docker compose --profile btc restart bot_btc
```

### 10.3 Incident OPOCO — ordre non placé

**Symptôme :** Log `placeOPOCO failed` ou erreur Binance API

**Diagnostic :**
```bash
# Vérifier les logs
docker compose logs bot_btc | grep -i "error\|failed\|OPOCO"

# Vérifier l'ordre dans Redis
docker exec bot_redis redis-cli GET bot:btcusdt:position_open

# Si position_open=1 mais pas d'ordre Binance → FORCED_EXIT manuel
curl -X POST http://localhost:4001/config \
  -H "x-bot-token: <RESTART_SECRET>" \
  -d '{"key":"reset_daily","value":"true"}'
```

### 10.4 Incident Postgres — connexion perdue

```bash
# Vérifier
docker exec bot_postgres pg_isready -U bot -d bot_trading

# Si KO — redémarrer
docker compose restart bot_postgres

# Le bot se reconnecte automatiquement (pg.Pool gère les reconnexions)
```

### 10.5 Incident Redis — connexion perdue

```bash
docker exec bot_redis redis-cli ping
# → PONG attendu

# Si KO
docker compose restart bot_redis
# ATTENTION : les locks Redis sont perdus — vérifier position_open avant de relancer le bot
docker exec bot_redis redis-cli SET bot:btcusdt:position_open 0
```

---

## 11. CRITÈRES D'ACCEPTATION GLOBAUX

### 11.1 Code

| Critère | Valeur requise |
|---------|----------------|
| Tests unitaires | 132/132 PASS |
| Tests suites | 15/15 PASS |
| Temps exécution tests | < 10 secondes |
| Couverture src/ | > 80% lignes |
| Zéro warning jest | 0 warnings |

### 11.2 Performance bot (DRY_RUN)

| Critère | Minimum | Cible |
|---------|---------|-------|
| Win Rate | 53% | 58–63% |
| Profit Factor | 1.2 | 1.5–2.0 |
| Sharpe annualisé | 0.8 | ≥ 1.5 |
| Drawdown max journalier | < 120 USDT | < 60 USDT |
| Trades/jour | 4–6 | 8–12 |
| Uptime | 95% | 99% |

### 11.3 Infrastructure

| Critère | Valeur requise |
|---------|----------------|
| Temps réponse /health | < 500ms |
| Temps réponse dashboard | < 2s |
| WS push latence | < 1.5s |
| Redis disponibilité | 99.9% |
| Postgres disponibilité | 99.9% |

### 11.4 Sécurité

| Critère | Valeur requise |
|---------|----------------|
| Clés API jamais en clair dans les logs | ✅ Obligatoire |
| DASHBOARD_PASSWORD non `changeme` en prod | ✅ Obligatoire |
| RESTART_SECRET non `CHANGE_ME` en prod | ✅ Obligatoire |
| SQL injection bloquée (MCP sqlGuard) | ✅ Obligatoire |
| IP whitelist Binance = 176.97.70.254 | ✅ Obligatoire |
| HTTPS en production (si exposition publique) | 🟡 Recommandé |

---

## ANNEXE — COMMANDES DE RÉFÉRENCE RAPIDE

```bash
# === TESTS ===
npm test                                    # Suite complète
npx jest tests/unit/kelly.test.js --verbose # Module spécifique

# === DOCKER ===
docker compose --profile btc up -d bot_btc  # Démarrer BTC
docker compose logs -f bot_btc              # Logs live
docker compose stop bot_btc                 # Arrêter BTC
docker ps                                   # État conteneurs

# === REDIS ===
docker exec bot_redis redis-cli GET bot:btcusdt:position_open
docker exec bot_redis redis-cli SET bot:global:stop 1
docker exec bot_redis redis-cli DEL bot:global:stop
docker exec bot_redis redis-cli KEYS "bot:*"

# === POSTGRES ===
docker exec -it bot_postgres psql -U bot -d bot_trading
SELECT COUNT(*) FROM trades WHERE dry_run=true;
SELECT type, COUNT(*) FROM events GROUP BY type;

# === GIT ===
git log --oneline -5                        # Derniers commits
git status                                  # État du repo

# === DASHBOARD ===
curl http://localhost:3010/health            # Health check
curl http://localhost:4001/health            # Health bot BTC
```
