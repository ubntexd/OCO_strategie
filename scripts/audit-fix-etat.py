#!/usr/bin/env python3
from pathlib import Path
p = Path('/home/dev/dev/OCO_strategie/docs/ETAT_PROJET.md')
etat = p.read_text(encoding='utf-8')
etat = etat.replace('f2e5f6f', 'd2de46e')
etat = etat.replace('EN ATTENTE DÉMARRAGE BOT', 'BOT BTC DRY_RUN ACTIF — ETH/SOL À DÉMARRER')
etat = etat.replace(
    '| `bot_btc` | 4001 | `btc` | ⏸ À démarrer |',
    '| `bot_btc` | 4001 | `btc` | ✅ ACTIF (DRY_RUN) |',
)
if 'RAPPORT_AUDIT_COHERENCE' not in etat:
    etat = etat.replace(
        '## 0. RÉSUMÉ EXÉCUTIF',
        '## 0. RÉSUMÉ EXÉCUTIF\n\n> Dernier audit cohérence : 10/07/2026 — `docs/rapports/RAPPORT_AUDIT_COHERENCE.md`',
    )
p.write_text(etat, encoding='utf-8')
print('ETAT_PROJET OK')
