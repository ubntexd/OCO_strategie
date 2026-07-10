# OCO_strategie

BotTrader OPOCO — ROHAN Innovation.

**Statut :** Développement démarré (GO directeur 10/07/2026).

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Index documentation |
| [PLAN_8_AGENTS.md](docs/PLAN_8_AGENTS.md) | 8 agents + Claude IA GO/NO GO |
| [DASHBOARD_DEV_ORCHESTRATION.md](docs/DASHBOARD_DEV_ORCHESTRATION.md) | Dashboard dev N8n port 3020 |
| [ARCHITECTURE_3_MODULES.md](docs/ARCHITECTURE_3_MODULES.md) | Modules A / B / C |
| [CAHIER_DEVELOPPEMENT.md](docs/CAHIER_DEVELOPPEMENT.md) | Spécifications techniques |
| [RAPPORT_ALIGNEMENT_CDC_CD.md](docs/RAPPORT_ALIGNEMENT_CDC_CD.md) | Infra VPS |

## Démarrage rapide

```bash
cp .env.example.shared .env.shared
cp .env.example.btc .env.btc
# Éditer POSTGRES_PASSWORD, DEV_GO_TOKEN, RESTART_SECRET

npm install
npm test

docker compose up -d bot_redis bot_postgres dev_dashboard
npm run pipeline:go   # après Postgres prêt
```

Dashboard dev : http://localhost:3020

## VPS

- **IP :** `176.97.70.254`
- **Chemin :** `/home/dev/dev/OCO_strategie`
- **GitHub :** https://github.com/ubntexd/OCO_strategie

```bash
cd /home/dev/dev/OCO_strategie
git pull
docker compose up -d bot_redis bot_postgres dev_dashboard
```

## Livrables Phase 1 en cours

| Tâche | Fichier | Statut |
|-------|---------|--------|
| Infra Docker | `docker-compose.yml` | ✅ créé |
| Schéma trading | `db/schema.sql` | ✅ créé |
| Schéma dev | `db/dev_schema.sql` | ✅ créé |
| Module B — kelly | `src/kelly.js` | ✅ créé |
| Tests kelly | `tests/unit/kelly.test.js` | ✅ créé |
| Dashboard dev | `dev-dashboard/` | ✅ créé |
| N8n WF-dev | `n8n/workflows/dev/` | ✅ squelette |

Prochaine tâche pipeline : `src/journal.js` (Module B — CD §4.5).
