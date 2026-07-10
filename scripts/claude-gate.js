#!/usr/bin/env node
/**
 * Coworker Claude IA — verdict GO/NO_GO avec preuves obligatoires
 * RÈGLE NON NÉGOCIABLE : GO uniquement si validation explicite via API Claude (source=claude_api)
 */
require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });

const { callAnthropic, extractJson, normalizeGate } = require('./lib/anthropic');

const MAX_RETRIES = parseInt(process.env.CLAUDE_GATE_RETRIES || '3', 10);

const SYSTEM_PROMPT = `Tu es le Coworker Claude IA du projet OCO_strategie / BotTrader v1.0.

RÈGLES NON NÉGOCIABLES :
1. INTERDIT d'inventer : critères, ports, fichiers, seuils, résultats de tests.
2. Chaque reason DOIT citer une preuve fournie dans l'entrée (test_report, validation_report, proofs[]).
3. Chaque doc_reference DOIT être CD §x, ARCHITECTURE §x, ou RAPPORT_ALIGNEMENT §x.
4. verdict GO uniquement si validation_report.pass=true ET tests 100% ET couverture OK.
5. En cas de doute → NO_GO.
6. proofs[] en sortie : recopier/valider les preuves factuelles reçues (ne pas en inventer).

FORMAT DE SORTIE — CRITIQUE :
- Réponds UNIQUEMENT avec un objet JSON valide.
- PAS de markdown, PAS de backticks, PAS de texte avant ou après le JSON.
- Le premier caractère doit être { et le dernier }.

SORTIE JSON STRICTE :
{
  "verdict": "GO" | "NO_GO",
  "step": "MODULE_X.task",
  "reasons": ["..."],
  "proofs": [{"type":"test|coverage|file_exists|export","ref":"CD §x","detail":"...","result":"PASS|FAIL"}],
  "doc_references": ["CD §9.1"],
  "failed_agents": [],
  "next_action": "..."
}`;

function buildNoGo(input, reasons, source, failedAgents = ['coworker-claude-ia']) {
  return {
    verdict: 'NO_GO',
    step: input.current_step,
    reasons,
    proofs: input.validation_report?.proofs || [],
    doc_references: ['CD §10 L2', 'PLAN_8_AGENTS §3 Agent 8'],
    failed_agents: failedAgents,
    next_action: `Relance validation Claude IA sur ${input.current_step}`,
    source,
  };
}

function enforceBusinessRules(gate, input) {
  const v = input.validation_report;
  const t = input.test_report;
  const testsOk = t?.tests_pass === t?.tests_total && t?.exit_code === 0;
  const validatorOk = v?.pass === true && (v?.fail_count || 0) === 0;

  if (gate.verdict === 'GO' && (!testsOk || !validatorOk)) {
    gate.verdict = 'NO_GO';
    gate.reasons.push(
      `NO_GO forcé : tests ${t?.tests_pass}/${t?.tests_total} ou validateur fail_count=${v?.fail_count}`,
    );
    gate.failed_agents = [...new Set([...(gate.failed_agents || []), input.coworker_report?.agent_id].filter(Boolean))];
  }
  return gate;
}

function sanitizeGateInput(input) {
  const copy = JSON.parse(JSON.stringify(input));
  if (copy.test_report?.raw_tail) delete copy.test_report.raw_tail;
  if (copy.validation_report?.items) {
    copy.validation_report.items = copy.validation_report.items.map((i) => ({
      criterion: i.criterion,
      result: i.result,
      ref: i.ref,
    }));
  }
  return copy;
}

function getResponseText(apiBody) {
  const parsed = JSON.parse(apiBody);
  const textBlock = parsed.content?.find((c) => c.type === 'text');
  const text = textBlock?.text || parsed.content?.[0]?.text || '';
  if (!text) {
    const meta = parsed.stop_reason || parsed.error?.message || 'vide';
    throw new Error(`Réponse Claude vide (${meta})`);
  }
  return { text, stopReason: parsed.stop_reason };
}

async function runClaudeGate(input) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

  if (!apiKey) {
    return buildNoGo(
      input,
      ['ANTHROPIC_API_KEY absente — validation Claude impossible (NON NÉGOCIABLE)'],
      'api_missing',
    );
  }

  const safeInput = sanitizeGateInput(input);
  const basePayload = JSON.stringify(safeInput, null, 2);
  let lastError = 'inconnue';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const retryHint = attempt > 1
      ? `\n\nTENTATIVE ${attempt}/${MAX_RETRIES} — réponse précédente invalide (${lastError}). JSON uniquement, sans markdown.`
      : '';

    const res = await callAnthropic(apiKey, {
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Valide ou refuse cette tâche. Réponds UNIQUEMENT en JSON.\n\n${basePayload}${retryHint}`,
      }],
    });

    if (res.status !== 200) {
      lastError = `HTTP ${res.status}: ${res.body.slice(0, 200)}`;
      continue;
    }

    try {
      const { text } = getResponseText(res.body);
      const rawGate = extractJson(text);
      const gate = enforceBusinessRules(normalizeGate(rawGate, input), input);
      gate.claude_attempt = attempt;
      return gate;
    } catch (err) {
      lastError = err.message;
    }
  }

  return buildNoGo(
    input,
    [
      `Claude API n'a pas produit de verdict JSON valide après ${MAX_RETRIES} tentatives`,
      `Dernière erreur : ${lastError}`,
      'NON NÉGOCIABLE : pas de fallback — pipeline bloqué',
    ],
    'claude_api_failed',
  );
}

module.exports = { runClaudeGate, SYSTEM_PROMPT, MAX_RETRIES };

if (require.main === module) {
  const input = JSON.parse(process.argv[2] || '{}');
  runClaudeGate(input)
    .then((g) => { console.log(JSON.stringify(g, null, 2)); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
