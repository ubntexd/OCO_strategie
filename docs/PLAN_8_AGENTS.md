# Plan d'orchestration — 8 agents de développement
## BotTrader v1.0 — ROHAN Innovation / OCO_strategie

**Version :** 1.0  
**Date :** 10 juillet 2026  
**Statut :** Spécification — **code bot non démarré** (preuve : `RAPPORT_ALIGNEMENT_CDC_CD.md` §8)  
**Sources factuelles :**
- `CAHIER_DEVELOPPEMENT.md` v1.1.0 (CD)
- `ARCHITECTURE_3_MODULES.md` v1.0
- `RAPPORT_ALIGNEMENT_CDC_CD.md` v1.0

> Ce document décrit **comment** développer le bot avec 8 agents Cursor/N8n.
> Il ne remplace pas le CD : chaque livrable reste défini par le CD et validé
> contre les checklists §10 (L1–L16) et les tests §9.

---

## 1. État réel du projet (preuves)

| Élément | Statut | Preuve |
|---------|--------|--------|
| Documentation CD / alignement / architecture | ✅ Existe | Fichiers dans `docs/` |
| Code source `src/` | ⏸ Non démarré | `RAPPORT_ALIGNEMENT_CDC_CD.md` §8 : « Code source bot — Non démarré » |
| `docker-compose.btc.yml` | ⏸ Non démarré | `RAPPORT_ALIGNEMENT_CDC_CD.md` §8 |
| VPS cible | ✅ Décision validée | `176.97.70.254` — `RAPPORT_ALIGNEMENT_CDC_CD.md` D1 |
| Chemin VPS | ✅ Décision validée | `/home/dev/dev/OCO_strategie` — D2 |
| N8n existant | ✅ Sur VPS | `ultiumgrid_obs-n8n-1`, port `25678` — D5 |
| Postgres bot (host) | ✅ Port rectifié | `5435` — D6 |
| Ordre dev modules | ✅ Documenté | B → A → C — `ARCHITECTURE_3_MODULES.md` §5 |
| Ordre dev fichiers | ✅ Documenté | CD §3 (1.1 → 1.13) |
| Prompts Cursor par fichier | ✅ Documentés | CD §8.1 → §8.7 |
| Couverture tests minimale | ✅ Documentée | CD §9.1 |
| Checklists livrables | ✅ Documentées | CD §10 L1–L16 |
| Dashboard trading (Module C) | ⏸ À développer | Port `3010` — `ARCHITECTURE_3_MODULES.md` §4 |
| Dashboard dev orchestration | ⏸ À créer | Voir `DASHBOARD_DEV_ORCHESTRATION.md` |
| Workflows N8n trading (WF1–WF6) | ⏸ À développer | CD §8.7, `ARCHITECTURE_3_MODULES.md` §4 |
| Workflows N8n dev (WF-dev) | ⏸ À créer | Voir `DASHBOARD_DEV_ORCHESTRATION.md` |

---

## 2. Les 8 agents — rôles et limites

### Principe validé par l'utilisateur

- **1 seule intervention humaine** : GO de départ du directeur.
- Ensuite : pipeline **100 % automatisé** entre agents.
- Le directeur **suit en lecture seule** via le dashboard dev (voir doc dédiée).

### Vue d'ensemble

```
                    ┌─────────────────────┐
                    │  DIRECTEUR (humain)  │
                    │  GO initial uniquement│
                    └──────────┬──────────┘
                               │ observe
                    ┌──────────▼──────────┐
                    │  DASHBOARD DEV N8n   │  ← DASHBOARD_DEV_ORCHESTRATION.md
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  WORKER SUPERVISEUR  │  séquence, déblocage, relances
                    └──────────┬──────────┘
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼────────┐   ┌────────▼────────┐   ┌───────▼────────┐
│ 4 COWORKERS     │   │ WORKER TESTEUR  │   │WORKER VALIDATEUR│
│ (codent)        │   │ (Jest, §9)      │   │ (L1–L16, §10)   │
└────────┬────────┘   └────────┬────────┘   └───────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │ tous les rapports
                    ┌──────────▼──────────┐
                    │ COWORKER CLAUDE IA  │  ← NOUVEAU
                    │ lit rapports        │
                    │ verdict GO / NO GO  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  SUPERVISEUR exécute │
                    │  GO → étape suivante │
                    │  NO GO → relance     │
                    └─────────────────────┘
```

---

## 3. Détail des 8 agents

### Agent 1 — Coworker Module B (Risk & Data)

| Champ | Valeur documentée |
|-------|-------------------|
| Module | B — `ARCHITECTURE_3_MODULES.md` §3 |
| Fichiers | `db/schema.sql`, `kelly.js`, `journal.js`, `atr.js`, `regime.js`, `correlation.js`, `protection.js` |
| Ordre interne | B.1 → B.7 — `ARCHITECTURE_3_MODULES.md` §5 |
| Séquence CD | 1.1, 1.3, 1.5–1.8, 1.12 — CD §3 |
| Prompts | CD §8.1 (`schema.sql`), §8.2 (`kelly.js`) ; autres fichiers : specs CD §4.5–4.8, 4.12 |
| Tests min | CD §9.1 : kelly 95%, atr 90%, regime 85%, correlation 85%, protection 90%, journal 80% |
| Bloqué jusqu'à | GO directeur + infra Coworker 4 (schema Postgres déployable) |
| Rapport obligatoire | Voir §6.1 format `dev_report` |

### Agent 2 — Coworker Module A (Trading Core)

| Champ | Valeur documentée |
|-------|-------------------|
| Module | A — `ARCHITECTURE_3_MODULES.md` §2 |
| Fichiers | `health.js`, `order.js`, `monitor.js`, `signal.js`, `bot.js` |
| Ordre interne | A.1 → A.4 — `ARCHITECTURE_3_MODULES.md` §5 |
| Séquence CD | 1.4, 1.9–1.11, 1.13 — CD §3 |
| Prompts | CD §8.3–8.6 |
| Règles P0 | `waitForFill` (P0-2), `waitForResult` (P0-1), `await computeKellyAuto` (P0-3), SIGTERM (P0-4) — CD en-tête |
| Tests min | CD §9.1 : order 90%, monitor 80%, signal 95%, bot 80% |
| Dépendance | Module B validé (GO Claude IA sur étape B) |
| Critère module | DRY_RUN fonctionnel — `ARCHITECTURE_3_MODULES.md` §2 « Livrable » |

### Agent 3 — Coworker Module C (Ops Platform)

| Champ | Valeur documentée |
|-------|-------------------|
| Module | C — `ARCHITECTURE_3_MODULES.md` §4 |
| Composants | `n8n/workflows/` (6 JSON), `dashboard/` (9 onglets), `mcp/server.js`, backtest |
| Séquence | C.1 → C.4 — `ARCHITECTURE_3_MODULES.md` §5 |
| Prompt N8n trading | CD §8.7 (WF1–WF6) |
| Port dashboard trading | `3010` — `ARCHITECTURE_3_MODULES.md` §4 |
| Port MCP | `5010` — idem |
| N8n externe | `ultiumgrid_obs-n8n-1:25678` — `RAPPORT_ALIGNEMENT_CDC_CD.md` D5 |
| Dépendance | Modules A + B validés |
| Checklists | L14 (MCP), L15 (N8n), dashboard — CD §10 |

### Agent 4 — Coworker Infra & QA

| Champ | Valeur documentée |
|-------|-------------------|
| Périmètre | Docker, `.env`, structure projet, tests d'intégration infra |
| Fichiers | `docker-compose.yml`, `docker-compose.btc.yml`, `Dockerfile`, `dashboard/Dockerfile`, `mcp/Dockerfile`, `.env.*` |
| Postgres host | Port `5435` — `RAPPORT_ALIGNEMENT_CDC_CD.md` D6, CD §4.2 |
| Redis host | Port `6380` — `RAPPORT_ALIGNEMENT_CDC_CD.md` §2.3 |
| Déploiement | `cd /home/dev/dev/OCO_strategie` — CD §11.4 |
| BTC first | `docker-compose.btc.yml` — `RAPPORT_ALIGNEMENT_CDC_CD.md` §3.3 |
| Checklist | L1, L16 — CD §10 |
| Capital test BTC | 600 USDT Phase 4 — `RAPPORT_ALIGNEMENT_CDC_CD.md` D7 |

### Agent 5 — Worker Superviseur

| Champ | Valeur |
|-------|--------|
| Rôle | Orchestrer la séquence B → A → C, assigner tâches, merger, relancer sur NO GO |
| Séquence source | `ARCHITECTURE_3_MODULES.md` §5, CD §3 |
| Règle absolue | « Ne jamais passer au module suivant si tests ≠ 100% » — CD §3, `ARCHITECTURE_3_MODULES.md` §5 |
| Entrée | GO directeur (webhook N8n WF-dev-01) |
| Sortie | Ordres vers coworkers, déclenchement Testeur/Validateur/Claude IA |
| Ne fait pas | Écrire le code métier (réservé aux coworkers 1–4) |

**Machine d'états superviseur (dérivée des docs) :**

```
IDLE
  → [GO directeur] → INFRA_CHECK
INFRA_CHECK (Coworker 4 : L1)
  → PASS → MODULE_B
MODULE_B (Coworker 1 : B.1→B.7)
  → chaque fichier → TESTEUR → VALIDATEUR → CLAUDE_IA
  → GO → MODULE_A
MODULE_A (Coworker 2 : A.1→A.4)
  → idem boucle qualité
  → GO → MODULE_C
MODULE_C (Coworker 3 : C.1→C.4)
  → idem boucle qualité
  → GO → PIPELINE_VALIDATION (CD §7 Phase 4)
```

### Agent 6 — Worker Testeur

| Champ | Valeur documentée |
|-------|-------------------|
| Rôle | Exécuter Jest, mesurer couverture, DRY_RUN smoke |
| Commandes | `npm test`, `npm run test:coverage` — CD §2.4 (scripts npm à créer avec le projet) |
| Seuils | CD §9.1 (table couverture par fichier) |
| Tests critiques | CD §9.2 (exemples `kelly.test.js`, etc.) |
| Intégration | `tests/integration/bot.test.js`, `monitor.test.js` — CD §2.5 |
| Rapport | `tests_pass`, `tests_total`, `coverage_pct` par fichier/module |
| Échec | → rapport au Superviseur + Validateur + Claude IA → NO GO automatique |

### Agent 7 — Worker Validateur

| Champ | Valeur documentée |
|-------|-------------------|
| Rôle | Vérifier conformité **technique** CDC/CD — checklists, exports, règles |
| Sources | CD §10 L1–L16, §9.1, exports `ARCHITECTURE_3_MODULES.md` §6 |
| Exemples vérifiables | OPOCO sans `pendingQuantity` (CD §8.3, P2-13), `pgPool` injecté (P1-9), `reset_daily` (P1-8), MCP SQL (P1-7) |
| Verdict | `PASS` / `FAIL` par critère checklist (pas GO/NO GO global) |
| Différence avec Claude IA | Validateur = conformité point par point ; Claude IA = décision de passage d'étape |

### Agent 8 — Coworker Claude IA (GO / NO GO) — NOUVEAU

| Champ | Valeur |
|-------|--------|
| Rôle | **Lire tous les rapports** des agents 1–7 et émettre un verdict **GO** ou **NO GO** pour passer à l'étape suivante |
| Environnement | API Claude (via N8n HTTP Request ou agent Cursor dédié) — **à configurer au déploiement** |
| Entrées obligatoires | Rapports JSON des coworkers, rapport Testeur, rapport Validateur, contexte étape courante |
| Sortie | `{ "verdict": "GO"|"NO_GO", "reasons": [...], "references": [...], "next_action": "..." }` |
| Ne remplace pas | Le directeur humain (observe seulement) ; le Validateur (checklist technique) |
| Ne décide pas | Paramètres trading, capital, déploiement prod — réservés au directeur humain en Phase 4 |

#### Pourquoi un agent séparé du Validateur ?

| | Validateur | Coworker Claude IA |
|--|-----------|-------------------|
| Question | « Le livrable respecte-t-il le CD ? » | « Peut-on passer à l'étape suivante ? » |
| Méthode | Checklist L1–L16, booléens | Synthèse de **tous** les rapports |
| Sortie | PASS/FAIL par critère | **GO / NO GO** global |
| Exemple NO GO | `order.js` : export manquant | Tests 8/12 + Validateur 2 FAIL + rapport coworker incomplet → NO GO, relance Coworker 2 |

#### Critères GO / NO GO — uniquement depuis les docs

**GO** si et seulement si (tous vrais) :

1. Rapport coworker : statut `done` pour la tâche courante (format §6.1).
2. Testeur : `tests_pass === tests_total` pour le périmètre de l'étape (CD §3 : « 100% »).
3. Testeur : couverture ≥ seuil CD §9.1 pour chaque fichier de l'étape.
4. Validateur : **zéro** critère `FAIL` sur les L-items applicables (CD §10).
5. Infra (si étape infra) : L1 entièrement cochée.

**NO GO** si l'un est vrai :

1. Un test échoue (CD §3).
2. Couverture sous le seuil §9.1.
3. Un critère L1–L16 en FAIL.
4. Rapport coworker absent, vide, ou `status: fail` sans plan de correction.
5. Fichier hors séquence CD §3 / `ARCHITECTURE_3_MODULES.md` §5.

**Références obligatoires dans la réponse Claude IA :** numéro de section CD ou ARCHITECTURE cité pour chaque reason (ex. « CD §9.1 order.js min 90% — obtenu 72% »).

#### Prompt système Coworker Claude IA (à utiliser tel quel)

```
Tu es l'agent Coworker Claude IA du projet OCO_strategie / BotTrader v1.0.

MISSION : Lire les rapports JSON des agents de développement et décider GO ou NO_GO
pour passer à l'étape suivante du pipeline.

SOURCES AUTORISÉES (seules références valides) :
- CAHIER_DEVELOPPEMENT.md v1.1.0 (CD)
- ARCHITECTURE_3_MODULES.md v1.0
- RAPPORT_ALIGNEMENT_CDC_CD.md v1.0

INTERDIT : Inventer des critères, des ports, des fichiers ou des seuils non présents dans ces docs.

ENTRÉE : JSON avec champs agent_reports[], test_report, validation_report, current_step.

SORTIE (JSON strict) :
{
  "verdict": "GO" | "NO_GO",
  "step": "<ex: MODULE_B.B.3 journal.js>",
  "reasons": ["..."],
  "doc_references": ["CD §9.1", "L2", ...],
  "failed_agents": ["coworker-2"],
  "next_action": "<ex: Relancer coworker-2 sur order.js — tests slippage>"
}

RÈGLES GO (toutes requises) :
- tests_pass === tests_total (CD §3)
- couverture ≥ CD §9.1 par fichier de l'étape
- validation_report : 0 FAIL sur L-items applicables (CD §10)
- coworker report status === "done"

RÈGLES NO_GO (une suffit) :
- test échoué, couverture insuffisante, FAIL validateur, rapport manquant

Ne jamais émettre GO si un doute subsiste — NO_GO par prudence.
```

---

## 4. Séquence de développement (preuve croisée CD + ARCHITECTURE)

Ordre **strict** — deux sources concordantes :

| Étape | ARCHITECTURE_3_MODULES §5 | CD §3 |
|-------|-------------------------|-------|
| 1 | B.1 `schema.sql` | 1.1 `db/schema.sql` |
| 2 | B.2 `kelly.js` | 1.3 `src/kelly.js` |
| 3 | B.3 `journal.js` | 1.5 `src/journal.js` |
| 4 | B.4 `atr.js` | 1.6 `src/atr.js` |
| 5 | B.5 `regime.js` | 1.7 `src/regime.js` |
| 6 | B.6 `correlation.js` | 1.8 `src/correlation.js` |
| 7 | B.7 `protection.js` | 1.12 `src/protection.js` |
| 8 | — | 1.2 Docker (Coworker 4, en parallèle dès le début) |
| 9 | A.1 `health.js` | 1.4 `src/health.js` |
| 10 | A.2 `order.js` + `monitor.js` | 1.10, 1.11 |
| 11 | A.3 `signal.js` | 1.9 `src/signal.js` |
| 12 | A.4 `bot.js` | 1.13 `src/bot.js` |
| 13 | C.1 N8n 6 WF | 3.1 `n8n/workflows/` |
| 14 | C.2 dashboard | 3.2 `dashboard/` |
| 15 | C.3 MCP | 3.3 `mcp/server.js` |
| 16 | C.4 backtest | 3.4 backtest engine |

> **Note :** CD §3 place `signal.js` (1.9) avant `order.js` (1.10) ; ARCHITECTURE §5 place `order.js`+`monitor.js` (A.2) avant `signal.js` (A.3). Le Superviseur suit **ARCHITECTURE_3_MODULES.md** §5 (order/monitor avant signal) sauf décision contraire du directeur — écart documenté, pas résolu ici.

---

## 5. Boucle qualité par livrable (obligatoire)

Pour **chaque** fichier ou sous-étape :

```
1. Coworker N produit le code
2. Coworker N envoie dev_report (webhook N8n)
3. Superviseur déclenche Testeur
4. Testeur envoie test_report
5. Superviseur déclenche Validateur
6. Validateur envoie validation_report
7. Superviseur déclenche Coworker Claude IA
8. Claude IA → GO ou NO_GO
   ├── GO  → Superviseur passe à la tâche suivante
   └── NO_GO → Superviseur relance le coworker concerné (max 3 relances — voir §7)
```

---

## 6. Format des rapports (contrat N8n)

### 6.1 Rapport coworker (`dev_report`)

Champs **minimum** — à stocker en base (voir `DASHBOARD_DEV_ORCHESTRATION.md`) :

```json
{
  "agent_id": "coworker-1",
  "agent_role": "Module B",
  "module": "B",
  "task": "src/kelly.js",
  "status": "done",
  "message": "computeKellyFormula + computeKellyAuto implémentés",
  "files_changed": ["src/kelly.js", "tests/unit/kelly.test.js"],
  "doc_reference": "CD §8.2",
  "timestamp": "2026-07-10T12:00:00Z"
}
```

`status` autorisés : `started` | `done` | `fail` | `retry`

### 6.2 Rapport Testeur (`test_report`)

```json
{
  "agent_id": "testeur",
  "scope": "src/kelly.js",
  "tests_pass": 12,
  "tests_total": 12,
  "coverage_pct": 96.2,
  "coverage_required_pct": 95,
  "coverage_ok": true,
  "command": "npm run test:coverage -- tests/unit/kelly.test.js",
  "timestamp": "2026-07-10T12:05:00Z"
}
```

Seuils `coverage_required_pct` : tirés de CD §9.1 uniquement.

### 6.3 Rapport Validateur (`validation_report`)

```json
{
  "agent_id": "validateur",
  "scope": "src/kelly.js",
  "checklist": "L2",
  "items": [
    { "criterion": "Exports computeKellyFormula + computeKellyAuto", "result": "PASS", "ref": "ARCHITECTURE §6" },
    { "criterion": "Couverture > minimale", "result": "PASS", "ref": "CD §9.1" }
  ],
  "fail_count": 0,
  "timestamp": "2026-07-10T12:06:00Z"
}
```

### 6.4 Verdict Claude IA (`gate_report`)

```json
{
  "agent_id": "coworker-claude-ia",
  "step": "MODULE_B.B.2",
  "verdict": "GO",
  "reasons": ["12/12 tests PASS", "Couverture 96.2% >= 95%", "Validateur 0 FAIL"],
  "doc_references": ["CD §3", "CD §9.1", "CD §10 L2"],
  "next_action": "Démarrer B.3 journal.js — Coworker 1",
  "timestamp": "2026-07-10T12:07:00Z"
}
```

---

## 7. Règles de relance (Superviseur)

| Situation | Action |
|-----------|--------|
| NO GO — tests FAIL | Relance coworker auteur + Testeur |
| NO GO — Validateur FAIL | Relance coworker avec liste des critères FAIL |
| NO GO — rapport manquant | Relance coworker (envoi rapport obligatoire) |
| 3 NO GO consécutifs même tâche | Pause pipeline + alerte Telegram directeur (informatif) |
| GO sur module complet (B, A ou C) | Rapport synthèse + notification directeur |

> Le directeur n'a **pas** à débloquer manuellement — sauf s'il choisit d'intervenir hors processus.

---

## 8. Prompts Cursor par coworker (références CD)

Ne pas réinventer : utiliser les prompts CD §8 existants.

| Coworker | Fichier | Prompt source |
|----------|---------|---------------|
| 1 — Module B | `db/schema.sql` | CD §8.1 |
| 1 — Module B | `src/kelly.js` | CD §8.2 |
| 2 — Module A | `src/order.js` | CD §8.3 |
| 2 — Module A | `src/monitor.js` | CD §8.4 |
| 2 — Module A | `src/signal.js` | CD §8.5 |
| 2 — Module A | `src/bot.js` | CD §8.6 |
| 3 — Module C | N8n WF1–WF6 | CD §8.7 |
| 4 — Infra | Docker / .env | CD §4.2, §10 L1, L16, `RAPPORT_ALIGNEMENT` §5 |
| 5 — Superviseur | Orchestration | Ce document §3 Agent 5 + `DASHBOARD_DEV_ORCHESTRATION.md` |
| 6 — Testeur | Jest | CD §9 |
| 7 — Validateur | Checklists | CD §10 |
| 8 — Claude IA | GO/NO GO | Ce document §3 Agent 8 |

Pour les fichiers Module B sans prompt dédié (`journal.js`, `atr.js`, etc.) : specs CD §4.5–4.8, 4.12 + exports `ARCHITECTURE_3_MODULES.md` §6.

---

## 9. Ce qui n'existe pas encore (honnêteté)

Les éléments suivants sont **spécifiés dans ce plan** mais **absents du repo** au 10/07/2026 :

- Répertoire `src/` et tous les fichiers listés CD §2.5
- Agents Cursor configurés (workspaces / règles par agent)
- Workflows N8n `WF-dev-*` (distincts des WF1–WF6 trading)
- Tables `dev_reports`, `dev_gate_verdicts` (spec dans dashboard doc)
- Coworker Claude IA branché sur API
- Dashboard dev (port proposé `3020` — non présent dans CD ; trading = `3010`)

---

## 10. Checklist GO de départ (directeur humain)

Avant webhook `WF-dev-01` :

- [ ] `RAPPORT_ALIGNEMENT_CDC_CD.md` §9 validé par le directeur
- [ ] VPS `176.97.70.254` accessible SSH
- [ ] N8n `ultiumgrid_obs-n8n-1` répond sur port `25678`
- [ ] Repo cloné sur `/home/dev/dev/OCO_strategie`
- [ ] 8 agents documentés et prompts chargés
- [ ] Dashboard dev déployé (ou mode dégradé : logs N8n + Telegram)

---

*Fin du document — Version 1.0*  
*ROHAN Innovation — OCO_strategie — Juillet 2026*
