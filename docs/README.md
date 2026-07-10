# BotTrader v1.0 — Documentation Projet
## ROHAN Innovation — Index complet
**Mise à jour :** 10 juillet 2026  
**VPS :** `176.97.70.254` — `/home/dev/dev/OCO_strategie`  
**GitHub :** https://github.com/ubntexd/OCO_strategie  
**Tests :** 132/132 PASS ✅

---

## Documents disponibles

| Document | Rôle | Audience |
|---|---|---|
| [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md) | Spécification produit complète | Direction / Client |
| [CAHIER_DEVELOPPEMENT.md](CAHIER_DEVELOPPEMENT.md) | Spec technique exhaustive — source de vérité code | Développeurs / Coworkers |
| [CAHIER_TESTS_VALIDATION.md](CAHIER_TESTS_VALIDATION.md) | Plan de tests + critères GO/NO-GO | QA / Validateurs |
| [RAPPORT_ALIGNEMENT_CDC_CD.md](RAPPORT_ALIGNEMENT_CDC_CD.md) | Décisions infra + écarts CDC/CD | Tech Lead |
| [ARCHITECTURE_3_MODULES.md](ARCHITECTURE_3_MODULES.md) | Architecture 3 modules de développement | Architectes |
| [ETAT_PROJET.md](ETAT_PROJET.md) | **État actuel du projet — à lire en premier** | Tous |

---

## Démarrage rapide pour un coworker

```bash
# 1. Cloner
git clone https://github.com/ubntexd/OCO_strategie
cd OCO_strategie

# 2. Configurer
cp .env.example.shared .env.shared
cp .env.example.btc .env.btc
# Éditer : POSTGRES_PASSWORD, RESTART_SECRET, BINANCE_API_KEY, BINANCE_API_SECRET

# 3. Installer
npm install

# 4. Tests
npm test   # → 132/132 PASS attendu

# 5. Dashboard dev local
docker compose up -d bot_redis bot_postgres dev_dashboard

# 6. Dashboard prod (VPS)
http://176.97.70.254:3010
```

---

## État résumé (10/07/2026)

| Composant | Statut |
|---|---|
| `src/` — 12 modules core | ✅ Codés + testés |
| `dashboard/` — UI pro 10 onglets | ✅ Déployé sur VPS |
| `mcp/` — Serveur MCP | ✅ Opérationnel |
| `tests/` — 132 tests | ✅ 132/132 PASS |
| Bot `bot_btc` en prod | ⏸ DRY_RUN — POSTGRES_PASSWORD à configurer |
| N8n workflows | ⏸ JSON générés — à importer |
| Phase 2 XGBoost | ⏸ Après 1500 trades réels |
