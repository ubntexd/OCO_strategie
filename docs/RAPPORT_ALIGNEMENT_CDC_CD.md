# RAPPORT D'ALIGNEMENT — CDC ↔ Cahier de développement
## BotTrader v1.0 — Décisions d'infrastructure et de déploiement

**Version :** 1.0  
**Date :** 10 juillet 2026  
**Statut :** Validé pour attente — **aucun développement code lancé**  
**Projet :** `OCO_strategie` / BotTrader ROHAN Innovation

---

## 1. DÉCISIONS RETENUES

| # | Sujet | CDC v1.1 (original) | Décision rectifiée |
|---|-------|---------------------|-------------------|
| D1 | VPS cible | `37.1.209.232` — cohabitation ROHAN-Wash | **`176.97.70.254`** — cohabitation dédiée UltiumGrid |
| D2 | Chemin projet | `/var/www/dev/apps/bot-trading/` | **`/home/dev/dev/OCO_strategie`** |
| D3 | Ordre déploiement paires | BTC + ETH + SOL simultanés | **BTC seul → valider → SOL → valider → ETH** |
| D4 | IP whitelist Binance | `37.1.209.232` | **`176.97.70.254`** |
| D5 | N8n | `rohan_n8n:5678` | **`ultiumgrid_obs-n8n-1`** (existant, port `25678` / `127.0.0.1:5678`) |
| D6 | Postgres bot (host) | Port `5433` | Port **`5435`** (5433 occupé par UltiumGrid) |
| D7 | Capital Phase 4 | 15 000 USDT d'emblée | **BTC 600 USDT test** → montée progressive par paire validée |
| D8 | Corrélation SOL | CDC §5.2 : SOL↔BTC | **SOL↔ETH** (aligné CD §5.9 et `correlation.js`) |

---

## 2. CONTEXTE VPS — `176.97.70.254`

### 2.1 Profil serveur (audit 09/07/2026)

| Ressource | Valeur | Verdict bot-trading |
|-----------|--------|---------------------|
| RAM | 7,8 Go (4,4 Go dispo) | OK pour stack BTC seule + UltiumGrid |
| Disque | 45 Go (27 Go libres) | OK |
| CPU | 3 cœurs | OK |
| Docker | Actif — 20 conteneurs UltiumGrid | Cohabitation possible |
| UFW | Actif | Ouvrir ports bot explicitement |

### 2.2 Principe de cohabitation

- **Stack bot isolée** : réseau Docker `bot_network` dédié
- **Pas d'interférence** avec `ultiumgrid_*` (réseaux séparés)
- **Services partagés possibles** : N8n existant (`ultiumgrid_obs-n8n-1`) via webhook host
- **Pas de dépendance** ROHAN-Wash (`rohan_redis`, `rohan_postgres`, `rohan_n8n`)

### 2.3 Conflits de ports — rectifications

| Service CDC | Port CDC | Port rectifié | Raison |
|-------------|----------|---------------|--------|
| bot_postgres | 5433 | **5435** | `127.0.0.1:5433` utilisé par UltiumGrid SOL |
| bot_redis | 6380 | **6380** | Libre |
| bot_btc | 4001 (interne) | **4001** | Libre |
| bot_dashboard | 3010 | **3010** | Libre (à ouvrir UFW) |
| bot_mcp | 5010 | **5010** | Libre (à ouvrir UFW) |
| N8n webhooks | rohan_n8n:5678 | **host:25678** ou **127.0.0.1:5678** | N8n UltiumGrid existant |

---

## 3. STRATÉGIE DE DÉPLOIEMENT — BTC FIRST

### 3.1 Principe

> **Une paire à la fois.** Aucune mise en production ETH/SOL tant que la paire précédente n'a pas passé tous les critères de validation.

### 3.2 Séquence par paire

```
┌─────────────────────────────────────────────────────────────┐
│  ÉTAPE A — BTCUSDT (priorité 1)                           │
├─────────────────────────────────────────────────────────────┤
│  A1. Infra : bot_redis + bot_postgres + bot_btc (DRY_RUN)   │
│  A2. Tests unitaires Jest 100% Phase 1                      │
│  A3. DRY_RUN 1 semaine — signaux + journal + health         │
│  A4. Testnet Binance 2 semaines — OPOCO réel                │
│  A5. Production 10% capital (600 USDT) 1 semaine              │
│  A6. GO/NO-GO : WR ≥ 53%, PF ≥ 1.5, 0 erreur critique      │
└─────────────────────────────────────────────────────────────┘
                          ↓ GO
┌─────────────────────────────────────────────────────────────┐
│  ÉTAPE B — SOLUSDT (priorité 2)                             │
├─────────────────────────────────────────────────────────────┤
│  B1. Activer bot_sol (DRY_RUN) — infra déjà en place        │
│  B2. Même pipeline A2→A6 avec capital SOL 400 USDT test     │
│  B3. GO/NO-GO avant ETH                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓ GO
┌─────────────────────────────────────────────────────────────┐
│  ÉTAPE C — ETHUSDT (priorité 3)                             │
├─────────────────────────────────────────────────────────────┤
│  C1. Activer bot_eth (DRY_RUN)                              │
│  C2. Même pipeline avec capital ETH 500 USDT test           │
│  C3. Montée capital complète si 3 paires validées           │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 docker-compose par étape

| Étape | Services actifs | Services commentés/désactivés |
|-------|-----------------|-------------------------------|
| A (BTC) | `bot_redis`, `bot_postgres`, `bot_btc` | `bot_eth`, `bot_sol` |
| A+ (BTC validé) | + `bot_dashboard`, `bot_mcp`, workflows N8n | `bot_eth`, `bot_sol` |
| B (SOL) | + `bot_sol` | `bot_eth` |
| C (ETH) | + `bot_eth` | — (stack complète) |

Fichiers compose prévus :
- `docker-compose.yml` — stack complète (référence)
- `docker-compose.btc.yml` — **démarrage initial** (override BTC seul)

### 3.4 Critères GO/NO-GO par paire

| Critère | Seuil |
|---------|-------|
| Win rate (Testnet + prod 10%) | ≥ 53% |
| Profit Factor | ≥ 1,5 |
| Erreurs OPOCO / LOT_SIZE | 0 |
| Slippage abort non contrôlé | 0 |
| Health check N8n WF1 | 100% ping 48h |
| DRY_RUN signal cohérent | Filtres spread actifs |

---

## 4. ALIGNEMENT CDC ↔ CD — ÉCARTS ET RECTIFICATIONS

### 4.1 Écarts infra (CDC → rectifié)

| Réf CDC | Contenu CDC | Action CD |
|---------|-------------|-----------|
| §1.1 | VPS `37.1.209.232` | Remplacer par `176.97.70.254` dans `.env.shared`, README, checklist prod |
| §2.3 | Isolation `rohan_redis` / `rohan_postgres` | Isolation `ultiumgrid_*` — ports distincts (table §2.3) |
| §3.1 | Chemin `/var/www/dev/apps/bot-trading/` | `/home/dev/dev/OCO_strategie` |
| §3.2 | `N8N_WEBHOOK_BASE=http://rohan_n8n:5678` | `http://172.x.x.x:5678` via réseau host ou IP bridge — **à configurer au déploiement** |
| §12.1 | Dashboard `http://37.1.209.232:3010` | `http://176.97.70.254:3010` |
| §14.1 | IP whitelist `37.1.209.232` | `176.97.70.254` |
| §11.4 CD | `cd /var/www/dev/apps/bot-trading/` | `cd /home/dev/dev/OCO_strategie` |

### 4.2 Écarts fonctionnels (déjà couverts par CD)

| Sujet | CDC | CD | Statut |
|-------|-----|-----|--------|
| `waitForFill()` | Non spécifié | P0-2 `order.js` | CD complète CDC |
| `waitForResult()` | Non spécifié | P0-1 `monitor.js` | CD complète CDC |
| `kelly.js` séparé | Inline dans §4.4 | Module dédié P2-11 | CD complète CDC |
| `reset_daily` | WF5 mentionné | P1-8 `health.js` | CD complète CDC |
| SQL injection MCP | SELECT seul | Filtrage `;` + FORBIDDEN | CD complète CDC |
| `pendingQuantity` OPOCO | C2 absent (correct) | P2-13 autorité CDC §17 | Aligné |

### 4.3 Écarts à corriger dans les deux documents

| # | Sujet | Correction |
|---|-------|------------|
| E1 | Trades/jour CDC §1.2 (8–12) vs §4.1 (max 21) | **Cible opérationnelle : 8–12** — max 21 = plafond technique |
| E2 | Corrélation SOL §5.2 CDC | Remplacer « SOL↔BTC » par **« SOL↔ETH »** |
| E3 | Déploiement simultané 3 paires | Remplacer par **séquence BTC → SOL → ETH** |
| E4 | Phase 4 prod checklist IP | `176.97.70.254` |
| E5 | `docker-compose.yml` postgres port | `5435:5432` sur host |

### 4.4 Éléments inchangés (validés)

- Stratégie OPOCO sans `pendingQuantity` (C2)
- TP `LIMIT GTC` / entrée `LIMIT_MAKER` (C3)
- Seuils spread BTC 1.50 / ETH 0.40 / SOL 0.08 (C5)
- Kelly min 100 trades, fraction fixe 10% (C1)
- Keepalive listenKey 20 min (C4)
- Restart HTTP via `x-restart-token` (C10)
- DRY_RUN par paire (S3)
- Clés API séparées par paire (S5)
- Phase 2 XGBoost à 1500 trades (C8)

---

## 5. FICHIERS `.env` RECTIFIÉS (APERÇU)

### `.env.shared` (extrait — VPS 176.97.70.254)

```env
# VPS : 176.97.70.254 — cohabitation UltiumGrid
REDIS_URL=redis://bot_redis:6379
POSTGRES_URL=postgresql://bot:${POSTGRES_PASSWORD}@bot_postgres:5432/bot_trading
N8N_WEBHOOK_BASE=http://host.docker.internal:25678/webhook
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TRADING_HOURS_START=08:00
TRADING_HOURS_END=22:00
FEES_RATE=0.00075
BNB_FEES=true
ENTRY_MODE=LIMIT_MAKER
MAX_SLIPPAGE_PCT=0.20
RESTART_SECRET=<token_256bits>
LOG_LEVEL=info
DEPLOY_VPS=176.97.70.254
DEPLOY_PATH=/home/dev/dev/OCO_strategie
```

### `.env.btc` (Phase A — seul actif au départ)

```env
SYMBOL=BTCUSDT
CAPITAL=6000
TP_BRUT=28
SL_BRUT=18
MAX_SPREAD=1.50
MAX_TRADES_DAY=6
MAX_CONSEC_LOSS=3
MAX_LOSS_DAY=60
DRY_RUN=true
PORT=4001
BINANCE_API_KEY=<clé_btc>
BINANCE_API_SECRET=<secret_btc>
```

> `.env.eth` et `.env.sol` : créés mais **non utilisés** jusqu'aux étapes B et C.

---

## 6. UFW — PORTS À OUVRIR (176.97.70.254)

| Port | Service | Phase |
|------|---------|-------|
| 3010 | Dashboard | A+ |
| 5010 | MCP | A+ |
| 4001 | bot_btc health (si exposé) | Optionnel — interne Docker suffit |

> Postgres `5435` et Redis `6380` : **localhost uniquement** — ne pas exposer publiquement.

---

## 7. PLANNING RECTIFIÉ

| Semaine | Contenu | Paire |
|---------|---------|-------|
| S1–S2 | Phase 1 CD : schema, docker BTC, modules src | BTC |
| S3 | DRY_RUN BTC 1 semaine | BTC |
| S4–S5 | Testnet BTC 2 semaines | BTC |
| S6 | Prod 10% BTC (600 USDT) + GO/NO-GO | BTC |
| S7–S8 | Activation SOL — même pipeline | SOL |
| S9–S10 | Activation ETH — même pipeline | ETH |
| S11+ | Dashboard + MCP + N8n workflows complets | Toutes |

**Durée estimée jusqu'à stack complète :** 10–11 semaines (vs 5 semaines CDC original).

---

## 8. ÉTAT ACTUEL — EN ATTENTE

| Élément | Statut |
|---------|--------|
| Rapport d'alignement | ✅ Ce document |
| Code source bot | ⏸ Non démarré |
| docker-compose | ⏸ Non démarré |
| Clés API Binance | ⏸ À créer (whitelist `176.97.70.254`) |
| Validation utilisateur | ⏸ **En attente** |

### Prochaine action (après validation)

1. Créer `docker-compose.btc.yml` (BTC seul)
2. Implémenter Phase 1 CD dans l'ordre strict (§3 du CD)
3. Lancer DRY_RUN BTC

---

## 9. CHECKLIST VALIDATION UTILISATEUR

Avant de démarrer le développement, confirmer :

- [ ] VPS `176.97.70.254` validé comme cible définitive
- [ ] Stratégie BTC → SOL → ETH acceptée
- [ ] Ports `5435` (postgres) et `6380` (redis) acceptés
- [ ] N8n UltiumGrid existant réutilisé pour webhooks
- [ ] Capital test BTC 600 USDT pour Phase 4 initiale
- [ ] IP whitelist Binance à configurer sur `176.97.70.254`

---

*Fin du rapport d'alignement — Version 1.0*  
*ROHAN Innovation — En attente de validation avant développement*
