# Règles strictes — agents OCO_strategie
## NON NÉGOCIABLE — aucune exception

**Version :** 1.0  
**Date :** 10 juillet 2026  
**Applicabilité :** Coworkers 1–4, Testeur, Validateur, Claude IA, Superviseur

---

## 1. Principe zéro imagination

| Interdit | Obligatoire |
|----------|-------------|
| Inventer des ports, fichiers, seuils | Citer CD §x, ARCHITECTURE §x, RAPPORT_ALIGNEMENT §x |
| Affirmer « tests OK » sans `npm test` | Joindre `tests_pass/tests_total` réel |
| Affirmer couverture sans mesure | Joindre `%` issu de Jest |
| GO sans preuves | `proofs[]` dans chaque verdict |
| Passer une étape sans Claude IA | `pipeline-task.js` ou WF-dev-05 |

---

## 2. Pipeline automatique par tâche (obligatoire)

```
Coworker livre fichier
    → pipeline-task.js (automatique)
        [1] Testeur     npm test (preuve)
        [2] Validateur  fichier + exports + seuils CD §9.1
        [3] Claude IA   GO/NO_GO + proofs[]
        [4] Postgres    dev_reports, dev_test_results, dev_gate_verdicts
        [5] Dashboard   push WebSocket
```

**Commande unique :**

```bash
node scripts/pipeline-task.js \
  --agent coworker-1 \
  --module B \
  --task src/journal.js \
  --message "Description factuelle" \
  --files-changed '["src/journal.js","tests/unit/journal.test.js"]' \
  --doc-ref "CD §4.5" \
  --next-task "src/atr.js"
```

**Webhook N8n :** `POST /webhook/dev/gate` (WF-dev-05)

---

## 3. Format rapport coworker (§6.1 PLAN_8_AGENTS)

Chaque livrable **doit** inclure :

```json
{
  "agent_id": "coworker-1",
  "task": "src/journal.js",
  "status": "done",
  "message": "Fait X — preuve: tests 9/9",
  "files_changed": ["src/journal.js"],
  "doc_reference": "CD §4.5"
}
```

`status: "done"` **interdit** si pipeline-task retourne NO_GO.

---

## 4. Coworker Claude IA

- Modèle : `claude-sonnet-5` (`.env.shared`)
- Verdict sans `proofs[]` → **rejeté**, fallback règles CD (NO_GO si doute)
- Sources : CD, ARCHITECTURE, RAPPORT_ALIGNEMENT **uniquement**

---

## 5. Directeur humain

- **1 seul GO initial** (déjà fait)
- Ensuite : **lecture seule** dashboard http://176.97.70.254:3020
- **Jamais** redemander validation manuelle par tâche

---

## 6. Échec = relance auto

| Verdict | Action Superviseur |
|---------|-------------------|
| GO | Tâche suivante (séquence CD §3) |
| NO_GO | Relance coworker auteur (max 3) |
| 3× NO_GO | Pause + alerte Telegram |

---

*ROHAN Innovation — OCO_strategie*
