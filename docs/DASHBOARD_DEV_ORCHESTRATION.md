# Dashboard d'orchestration développement — N8n
## BotTrader v1.0 — ROHAN Innovation / OCO_strategie

**Version :** 1.0  
**Date :** 10 juillet 2026  
**Statut :** Spécification — **non implémenté** (aucun code dashboard dev dans le repo)  
**Sources factuelles :**
- `CAHIER_DEVELOPPEMENT.md` v1.1.0
- `ARCHITECTURE_3_MODULES.md` v1.0
- `RAPPORT_ALIGNEMENT_CDC_CD.md` v1.0
- `PLAN_8_AGENTS.md` v1.0

> **Distinction obligatoire :**
> - **Dashboard trading** (Module C) : port `3010`, 9 onglets PnL/trades — `ARCHITECTURE_3_MODULES.md` §4
> - **Dashboard dev** (ce document) : suivi des 8 agents de développement — **à créer**

---

## 1. Objectif (validé utilisateur)

Permettre au **directeur** de suivre en **temps réel**, en **lecture seule** :

- l'évolution du développement (modules B → A → C),
- le rapport de **chaque coworker**,
- les résultats Testeur et Validateur,
- le verdict **GO / NO GO** du Coworker Claude IA,
- les actions du Superviseur.

**Orchestration :** N8n existant sur VPS — preuve : `ultiumgrid_obs-n8n-1`, port `25678` (`RAPPORT_ALIGNEMENT_CDC_CD.md` D5).

**Intervention humaine :** GO initial uniquement (`PLAN_8_AGENTS.md` §2).

---

## 2. État réel de l'infrastructure (preuves)

| Ressource | Valeur documentée | Source |
|-----------|-------------------|--------|
| VPS | `176.97.70.254` | `RAPPORT_ALIGNEMENT` D1 |
| RAM | 7,8 Go (4,4 Go dispo) | `RAPPORT_ALIGNEMENT` §2.1 |
| Docker | 20 conteneurs UltiumGrid | `RAPPORT_ALIGNEMENT` §2.1 |
| N8n | `ultiumgrid_obs-n8n-1` | D5 |
| N8n port host | `25678` / `127.0.0.1:5678` | D5, §2.3 |
| Postgres bot | port host `5435` | D6 |
| Redis bot | port host `6380` | §2.3 |
| Chemin projet | `/home/dev/dev/OCO_strategie` | D2 |
| Dashboard trading | port `3010` (futur Module C) | `ARCHITECTURE` §4 |
| Dashboard dev | port **`3020` proposé** | **Non documenté ailleurs** — choix libre, à ouvrir UFW si exposé |
| Code bot | non démarré | `RAPPORT_ALIGNEMENT` §8 |

---

## 3. Architecture cible

```
┌─────────────────────────────────────────────────────────────┐
│  DIRECTEUR — navigateur http://176.97.70.254:3020           │
│  (lecture seule + bouton GO initial uniquement)             │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket / REST
┌───────────────────────────▼─────────────────────────────────┐
│  DASHBOARD DEV (à créer)                                    │
│  dev-dashboard/ — Node.js + static                          │
│  Port 3020 (proposition)                                    │
└───────────────────────────┬─────────────────────────────────┘
                            │ lecture
┌───────────────────────────▼─────────────────────────────────┐
│  PostgreSQL bot_postgres (:5435)                            │
│  Tables dev_* (à créer — voir §5)                           │
└───────────────────────────▲─────────────────────────────────┘
                            │ écriture
┌───────────────────────────┴─────────────────────────────────┐
│  N8n ultiumgrid_obs-n8n-1 (:25678)                          │
│  WF-dev-01 → 06 (à créer — distincts WF1–WF6 trading)       │
└───────────────────────────▲─────────────────────────────────┘
                            │ webhooks
┌──────────┬──────────┬─────┴─────┬──────────┬────────────────┐
│Coworker 1│Coworker 2│Superviseur│ Testeur  │ Validateur     │
│Module B  │Module A  │           │          │                │
├──────────┴──────────┴───────────┴──────────┴────────────────┤
│ Coworker Claude IA ← lit tous rapports → GO / NO GO             │
└─────────────────────────────────────────────────────────────────┘
```

### Services N8n — deux familles (ne pas mélanger)

| Famille | Workflows | Statut | Source |
|---------|-----------|--------|--------|
| **Trading** | WF1–WF6 | À développer (Module C) | CD §8.7, `ARCHITECTURE` §4 |
| **Dev orchestration** | WF-dev-01–06 | À créer (ce document) | Spécification |

Fichiers trading prévus : `n8n/workflows/wf1_health.json` … `wf6_config_update.json` — CD §2.5.

Fichiers dev proposés : `n8n/workflows/dev/wf-dev-01_go.json` … `wf-dev-06_alert.json` — **nouveau dossier**.

---

## 4. Workflows N8n dev (spécification)

Base URL webhooks (à configurer au déploiement) :

```
N8N_WEBHOOK_BASE=http://host.docker.internal:25678/webhook
```

Valeur issue de `RAPPORT_ALIGNEMENT` §5 (`.env.shared` extrait).

### WF-dev-01 — GO directeur (démarrage pipeline)

| Champ | Valeur |
|-------|--------|
| Déclencheur | Webhook POST `/webhook/dev/go` |
| Auth | Token header `x-dev-go-token` (variable N8n — CD §8.7 : secrets via variables N8n) |
| Actions | 1. INSERT `dev_pipeline_state` status=`RUNNING` 2. Notifier Superviseur 3. Telegram « Pipeline démarré » 4. Push dashboard |
| Preuve séquence | `PLAN_8_AGENTS.md` §4, `ARCHITECTURE` §5 |

### WF-dev-02 — Rapport coworker

| Champ | Valeur |
|-------|--------|
| Déclencheur | Webhook POST `/webhook/dev/report` |
| Body | Format `dev_report` — `PLAN_8_AGENTS.md` §6.1 |
| Actions | INSERT `dev_reports` → MAJ `dev_agent_status` → WebSocket push |
| Agents sources | `coworker-1` … `coworker-4`, `superviseur` |

### WF-dev-03 — Rapport Testeur

| Champ | Valeur |
|-------|--------|
| Déclencheur | Webhook POST `/webhook/dev/test-result` |
| Body | Format `test_report` — `PLAN_8_AGENTS.md` §6.2 |
| Actions | INSERT → si `tests_pass < tests_total` : flag `BLOCKED` → déclencher WF-dev-05 (Claude IA) en NO_GO préalable |
| Seuils | Couverture CD §9.1 |

### WF-dev-04 — Rapport Validateur

| Champ | Valeur |
|-------|--------|
| Déclencheur | Webhook POST `/webhook/dev/validation` |
| Body | Format `validation_report` — `PLAN_8_AGENTS.md` §6.3 |
| Actions | INSERT → si `fail_count > 0` : flag agent |

### WF-dev-05 — Coworker Claude IA (GO / NO GO)

| Champ | Valeur |
|-------|--------|
| Déclencheur | Webhook POST `/webhook/dev/gate` (appelé par Superviseur après test+validation) |
| Entrée | Agrégat SQL des 3 derniers rapports de l'étape |
| Nœud Claude | HTTP Request → API Anthropic (clé variable N8n) **ou** agent Cursor webhook |
| Prompt | `PLAN_8_AGENTS.md` §3 Agent 8 — prompt système |
| Sortie | INSERT `dev_gate_verdicts` + `gate_report` JSON |
| Si GO | HTTP POST interne → Superviseur `/webhook/dev/supervisor/next` |
| Si NO_GO | HTTP POST → Superviseur `/webhook/dev/supervisor/retry` |

### WF-dev-06 — Alertes directeur

| Champ | Valeur |
|-------|--------|
| Déclencheur | Cron 30s **ou** événement fin de module |
| Actions | Telegram (même canal que WF2 trading — CD §8.7 utilise Telegram) |
| Contenu | % avancement, dernier verdict Claude IA, blocages |
| Règle | Informatif — pas d'action humaine requise |

### WF-dev-07 — Refresh dashboard (optionnel)

| Champ | Valeur |
|-------|--------|
| Déclencheur | Cron 10s |
| Actions | SELECT agrégats → POST dashboard `/api/dev/push` |

> Contrainte reprise du CD §8.7 pour les WF trading : **zéro nœud SSH** — tout passe par HTTP/webhook.

---

## 5. Schéma base de données dev (à créer)

Les tables `trades`, `events`, `daily_summary`, `mcp_actions` sont définies dans CD §8.1 / §4.1.
Les tables ci-dessous sont **spécifiques au dashboard dev** — absentes du CD, à ajouter dans `db/dev_schema.sql` :

```sql
-- db/dev_schema.sql — ORCHESTRATION DÉVELOPPEMENT UNIQUEMENT
-- Ne pas confondre avec db/schema.sql (trading)

CREATE TABLE IF NOT EXISTS dev_pipeline_state (
  id          SERIAL PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('IDLE','RUNNING','PAUSED','DONE','FAILED')),
  current_module CHAR(1) CHECK (current_module IN ('B','A','C','I')),
  current_task TEXT,
  started_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_reports (
  id            SERIAL PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  agent_role    TEXT,
  module        CHAR(1),
  task          TEXT,
  status        TEXT NOT NULL CHECK (status IN ('started','done','fail','retry')),
  message       TEXT,
  files_changed JSONB,
  doc_reference TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_test_results (
  id                    SERIAL PRIMARY KEY,
  scope                 TEXT NOT NULL,
  tests_pass            INT NOT NULL,
  tests_total           INT NOT NULL,
  coverage_pct          NUMERIC(5,2),
  coverage_required_pct NUMERIC(5,2),
  coverage_ok           BOOLEAN,
  command               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_validation_results (
  id          SERIAL PRIMARY KEY,
  scope       TEXT NOT NULL,
  checklist   TEXT,
  items       JSONB NOT NULL,
  fail_count  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_gate_verdicts (
  id              SERIAL PRIMARY KEY,
  step            TEXT NOT NULL,
  verdict         TEXT NOT NULL CHECK (verdict IN ('GO','NO_GO')),
  reasons         JSONB,
  doc_references  JSONB,
  next_action     TEXT,
  failed_agents   JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_agent_status (
  agent_id    TEXT PRIMARY KEY,
  agent_role  TEXT,
  status      TEXT NOT NULL,
  last_task   TEXT,
  last_report TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_reports_agent ON dev_reports(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_gate_verdicts_step ON dev_gate_verdicts(step, created_at DESC);
```

Déploiement (commande calquée sur CD §4.1) :

```bash
docker exec -i bot_postgres psql -U bot -d bot_trading < db/dev_schema.sql
```

---

## 6. API Dashboard dev (à créer)

Répertoire proposé : `dev-dashboard/` (séparé de `dashboard/` Module C — CD §2.5).

| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `/api/dev/status` | GET | État pipeline + % par module |
| `/api/dev/agents` | GET | Statut des 8 agents |
| `/api/dev/reports` | GET | Derniers rapports (filtre `agent_id`) |
| `/api/dev/timeline` | GET | Historique chronologique |
| `/api/dev/gate/latest` | GET | Dernier verdict Claude IA |
| `/api/dev/go` | POST | GO directeur → proxy WF-dev-01 |
| `/ws` | WebSocket | Push temps réel (refresh 1–10s) |

### Calcul % avancement (basé sur fichiers documentés)

| Module | Tâches totales | Source |
|--------|----------------|--------|
| B | 7 | `ARCHITECTURE` §5 B.1–B.7 |
| A | 4 groupes | A.1–A.4 |
| C | 4 | C.1–C.4 |
| Infra | 1 (L1) | CD §10 L1 |

```
progress_pct = (tasks_done / tasks_total) * 100
```

Pas d'estimation au feeling — compteur binaire par tâche GO validée par Claude IA.

---

## 7. Écrans dashboard (maquette fonctionnelle)

### 7.1 Vue globale

```
┌─────────────────────────────────────────────────────────────┐
│ OCO_strategie — Orchestration Développement                 │
│ VPS: 176.97.70.254 │ N8n: ultiumgrid_obs-n8n-1:25678       │
│ Dernière MAJ: <timestamp> │ Pipeline: RUNNING               │
├─────────────────────────────────────────────────────────────┤
│ MODULE B  [████████░░] 71%  (5/7 tâches GO)                │
│ MODULE A  [░░░░░░░░░░]  0%  EN ATTENTE                      │
│ MODULE C  [░░░░░░░░░░]  0%  EN ATTENTE                      │
│ INFRA     [██████░░░░] 60%  docker-compose.btc.yml en cours  │
├─────────────────────────────────────────────────────────────┤
│ Dernier verdict Claude IA: GO — journal.js (12:07 UTC)      │
│ Prochaine tâche: B.4 atr.js (Coworker 1)                    │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Tableau agents (8 lignes)

| Agent | Rôle documenté | Statut | Dernière tâche | Dernier rapport |
|-------|----------------|--------|----------------|-----------------|
| coworker-1 | Module B — `ARCHITECTURE` §3 | 🔄 | `journal.js` | CD §4.5 |
| coworker-2 | Module A — §2 | ⏸ | — | — |
| coworker-3 | Module C — §4 | ⏸ | — | — |
| coworker-4 | Infra — `PLAN_8_AGENTS` §3 | 🔄 | `docker-compose.btc.yml` | L1 |
| superviseur | Séquence B→A→C | ✅ | MODULE_B.B.3 | — |
| testeur | CD §9 | ✅ | kelly.js 12/12 | §9.1 |
| validateur | CD §10 | ✅ | L2 PASS | — |
| coworker-claude-ia | GO/NO GO — `PLAN_8_AGENTS` §3 | ✅ | GO B.3 | — |

### 7.3 Panneau rapport coworker (exemple)

Quand le directeur clique sur `coworker-2` :

```
Agent: coworker-2 (Module A — Trading Core)
Tâche: src/order.js
Statut: retry
Rapport:
  - OPOCO sans pendingQuantity implémenté (CD §8.3, P2-13)
  - waitForFill() polling Redis fill:{orderId} (P0-2)
Testeur: 8/12 PASS — échecs: slippage, DRY_RUN mock
Validateur: 1 FAIL — « await manquant ligne 142 » (L2)
Claude IA: NO_GO — « CD §3 : 100% tests requis »
Action Superviseur: relance auto #2
```

Toutes les lignes sont **lues depuis `dev_reports` / `dev_test_results` / `dev_gate_verdicts`** — pas de texte inventé côté UI.

### 7.4 Timeline

Alimentée par `UNION ALL` sur tables dev_* triées par `created_at` :

```
10:00  [directeur]     GO pipeline — WF-dev-01
10:02  [coworker-4]    started — docker-compose.btc.yml
10:15  [coworker-1]    done — schema.sql (CD §8.1)
10:20  [testeur]       12/12 PASS — schema
10:21  [validateur]    L2 PASS
10:22  [claude-ia]     GO — B.1
...
```

---

## 8. Flux complet avec Coworker Claude IA

```
Coworker 1 termine journal.js
        │
        ▼ POST /webhook/dev/report
     WF-dev-02 ──► dev_reports
        │
        ▼ Superviseur déclenche Testeur
     WF-dev-03 ──► dev_test_results
        │
        ▼ Superviseur déclenche Validateur
     WF-dev-04 ──► dev_validation_results
        │
        ▼ Superviseur déclenche Claude IA
     WF-dev-05
        ├── SELECT rapports agrégés
        ├── Appel API Claude (prompt PLAN_8_AGENTS §3 Agent 8)
        ├── INSERT dev_gate_verdicts
        │
        ├── GO  ──► Superviseur: tâche suivante (atr.js)
        └── NO_GO ──► Superviseur: relance coworker-1
        │
        ▼
     Dashboard /ws push + WF-dev-06 Telegram
        │
        ▼
     Directeur observe (aucune action requise)
```

---

## 9. Critères d'affichage GO / NO GO (preuves)

Le dashboard affiche le verdict Claude IA tel quel.
Les critères sous-jacents sont **uniquement** ceux listés dans `PLAN_8_AGENTS.md` §3 Agent 8 :

| Verdict | Condition (toutes / une) |
|---------|--------------------------|
| GO | tests 100% + couverture §9.1 + 0 FAIL validateur + rapport done |
| NO_GO | un test échoue, couverture basse, FAIL validateur, rapport manquant |

Références affichées : `doc_references[]` du `gate_report`.

---

## 10. Déploiement proposé (non exécuté)

### 10.1 Fichiers à créer

```
OCO_strategie/
├── db/
│   └── dev_schema.sql          ← §5 ce document
├── dev-dashboard/
│   ├── server.js
│   └── public/
│       ├── index.html
│       └── js/dev-dashboard.js
└── n8n/workflows/dev/
    ├── wf-dev-01_go.json
    ├── wf-dev-02_report.json
    ├── wf-dev-03_test.json
    ├── wf-dev-04_validation.json
    ├── wf-dev-05_gate.json
    └── wf-dev-06_alert.json
```

### 10.2 docker-compose (extrait proposé)

```yaml
# À ajouter à docker-compose.yml — NON PRÉSENT dans le CD actuel
dev_dashboard:
  build: ./dev-dashboard
  ports:
    - "3020:3020"
  environment:
    POSTGRES_URL: ${POSTGRES_URL}
    N8N_WEBHOOK_BASE: ${N8N_WEBHOOK_BASE}
  networks:
    - bot_network
```

### 10.3 UFW

| Port | Service | Phase |
|------|---------|-------|
| 3020 | Dashboard dev | Dès démarrage pipeline |
| 25678 | N8n (existant) | Déjà sur VPS |

Modèle UFW : `RAPPORT_ALIGNEMENT` §6 (3010, 5010 pour trading).

---

## 11. Mode dégradé (si dashboard pas prêt)

Si `dev-dashboard/` n'est pas encore déployé au GO :

1. Rapports visibles dans exécutions N8n (`ultiumgrid_obs-n8n-1`).
2. Alertes WF-dev-06 → Telegram.
3. Requêtes SQL directes sur `dev_*`.

Le pipeline 8 agents peut tourner **sans** UI — le dashboard est un confort pour le directeur, pas un bloquant technique.

---

## 12. Ce qui est documenté vs ce qui reste à faire

| Élément | Documenté ici | Implémenté |
|---------|---------------|------------|
| WF-dev-01–06 | ✅ | ❌ |
| `db/dev_schema.sql` | ✅ | ❌ |
| `dev-dashboard/` | ✅ | ❌ |
| Coworker Claude IA prompt | ✅ `PLAN_8_AGENTS` §3 | ❌ |
| N8n existant VPS | ✅ preuve alignement | ✅ (service existant) |
| Dashboard trading 3010 | ✅ `ARCHITECTURE` §4 | ❌ (Module C) |

---

*Fin du document — Version 1.0*  
*ROHAN Innovation — OCO_strategie — Juillet 2026*
