# Documentation OCO_strategie / BotTrader v1.0

**Projet :** ROHAN Innovation — BotTrader v1.0  
**Statut global :** Documentation prête — **code non démarré** (`RAPPORT_ALIGNEMENT_CDC_CD.md` §8)  
**VPS cible :** `176.97.70.254` — chemin `/home/dev/dev/OCO_strategie`

---

## Index des documents

| Document | Rôle | Statut |
|----------|------|--------|
| [CAHIER_DEVELOPPEMENT.md](./CAHIER_DEVELOPPEMENT.md) | Spécifications techniques, prompts, tests, checklists L1–L16 | ✅ v1.1.0 |
| [ARCHITECTURE_3_MODULES.md](./ARCHITECTURE_3_MODULES.md) | Division fonctionnelle A (Trading) / B (Risk) / C (Ops) | ✅ v1.0 |
| [RAPPORT_ALIGNEMENT_CDC_CD.md](./RAPPORT_ALIGNEMENT_CDC_CD.md) | Décisions infra VPS, ports, BTC first | ✅ v1.0 |
| [PLAN_8_AGENTS.md](./PLAN_8_AGENTS.md) | Orchestration 8 agents (4 coworkers + 3 workers + Claude IA) | ✅ v1.0 |
| [DASHBOARD_DEV_ORCHESTRATION.md](./DASHBOARD_DEV_ORCHESTRATION.md) | Dashboard dev N8n, WF-dev, tables `dev_*` | ✅ v1.0 — non implémenté |

---

## Ordre de lecture recommandé

1. `RAPPORT_ALIGNEMENT_CDC_CD.md` — infra et décisions
2. `ARCHITECTURE_3_MODULES.md` — modules et séquence B → A → C
3. `CAHIER_DEVELOPPEMENT.md` — détail implémentation
4. `PLAN_8_AGENTS.md` — qui fait quoi (8 agents)
5. `DASHBOARD_DEV_ORCHESTRATION.md` — suivi directeur temps réel

---

## Deux dashboards (ne pas confondre)

| Dashboard | Port documenté | Rôle |
|-----------|----------------|------|
| Trading (Module C) | `3010` | PnL, trades, signaux — `ARCHITECTURE_3_MODULES.md` §4 |
| Dev orchestration | `3020` (proposé) | Suivi 8 agents — `DASHBOARD_DEV_ORCHESTRATION.md` |

---

*ROHAN Innovation — Juillet 2026*
