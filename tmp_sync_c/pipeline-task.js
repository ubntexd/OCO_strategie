#!/usr/bin/env node
/**
 * Pipeline automatique par tâche — NON NÉGOCIABLE
 * Chaque livrable : tests réels → validateur → Claude GO/NO_GO → Postgres → dashboard
 *
 * Usage:
 *   node scripts/pipeline-task.js \\
 *     --agent coworker-1 --module B --task src/journal.js \\
 *     --message "journal.js implémenté" \\
 *     --files-changed '["src/journal.js","tests/unit/journal.test.js"]' \\
 *     --doc-ref "CD §4.5" --next-task "src/atr.js"
 */
require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { validateTask } = require('./lib/validate-task');
const { getCoverageMin, resolveTestFile } = require('./lib/coverage-min');
const { runClaudeGate } = require('./claude-gate');

const ROOT = path.resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    out[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return out;
}

function resolvePostgresUrl() {
  let url = process.env.POSTGRES_URL || '';
  if (url.includes('bot_postgres')) {
    url = url.replace('bot_postgres', '127.0.0.1').replace(':5432', ':5435');
  }
  return url;
}

function runTests(task) {
  const testFile = resolveTestFile(task);
  const testPath = path.join(ROOT, testFile);
  const covFrom = task.startsWith('n8n/')
    ? ''
    : `--collectCoverageFrom=${task} `;
  const cmd = fs.existsSync(testPath)
    ? `npm test -- --coverage ${covFrom}${testFile}`
    : 'npm test -- --coverage';

  const result = spawnSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;

  const passMatch = output.match(/Tests:\s+(\d+) passed/);
  const totalMatch = output.match(/Tests:\s+\d+ passed,\s+(\d+) total/);
  const testsPass = passMatch ? parseInt(passMatch[1], 10) : 0;
  const testsTotal = totalMatch ? parseInt(totalMatch[1], 10) : testsPass;

  let coveragePct = 0;
  const summaryPath = path.join(ROOT, 'coverage/coverage-summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      const absKey = path.join(ROOT, task).replace(/\\/g, '/');
      const relKey = path.resolve(ROOT, task).replace(/\\/g, '/');
      const entry = summary[absKey] || summary[relKey] || summary[task];
      if (entry?.lines?.pct != null) coveragePct = entry.lines.pct;
    } catch { /* ignore */ }
  }
  if (!coveragePct) {
    const base = path.basename(task);
    const covRe = new RegExp(`\\n\\s+${base}\\s+\\|\\s+[\\d.]+\\s+\\|\\s+[\\d.]+\\s+\\|\\s+[\\d.]+\\s+\\|\\s+([\\d.]+)`);
    const covMatch = output.match(covRe);
    coveragePct = covMatch ? parseFloat(covMatch[1]) : 0;
  }

  return {
    scope: task,
    tests_pass: testsPass,
    tests_total: testsTotal,
    coverage_pct: coveragePct,
    coverage_required_pct: getCoverageMin(task),
    coverage_ok: coveragePct >= getCoverageMin(task),
    command: cmd,
    exit_code: result.status,
    raw_tail: output.split('\n').slice(-20).join('\n'),
  };
}

async function main() {
  const a = parseArgs();
  const task = a.task;
  if (!task || !a.agent) {
    console.error('Usage: --agent coworker-N --task src/file.js [--module B] [--message ...]');
    process.exit(1);
  }

  const module = a.module || 'B';
  const agentRoles = {
    'coworker-1': 'Module B — Risk & Data',
    'coworker-2': 'Module A — Trading Core',
    'coworker-3': 'Module C — Ops Platform',
    'coworker-4': 'Infra & QA',
  };

  console.log(`\n=== PIPELINE TÂCHE : ${task} ===\n`);

  // 1. Tests réels (preuve)
  console.log('[1/4] Testeur — Jest...');
  const testReport = runTests(task);
  console.log(`      ${testReport.tests_pass}/${testReport.tests_total} | couverture ${testReport.coverage_pct}%`);

  // 2. Validateur (preuves fichiers/exports)
  console.log('[2/4] Validateur — checklist...');
  const validationReport = validateTask(task, testReport);
  console.log(`      ${validationReport.fail_count} FAIL`);

  // 3. Rapport coworker
  const filesChanged = (() => {
    try { return JSON.parse(a['files-changed'] || '[]'); }
    catch { return (a['files-changed'] || '').split(',').map((s) => s.trim()).filter(Boolean); }
  })();

  const coworkerReport = {
    agent_id: a.agent,
    agent_role: agentRoles[a.agent] || a.agent,
    module,
    task,
    status: validationReport.pass && testReport.tests_pass === testReport.tests_total ? 'done' : 'fail',
    message: a.message || '',
    files_changed: filesChanged,
    doc_reference: a['doc-ref'] || 'CD',
  };

  // 4. Claude IA GO/NO_GO
  console.log('[3/4] Coworker Claude IA — verdict...');
  const gateInput = {
    current_step: `MODULE_${module}.${task}`,
    next_task_hint: a['next-task'] || '',
    coworker_report: coworkerReport,
    test_report: testReport,
    validation_report: validationReport,
  };
  const gate = await runClaudeGate(gateInput);

  // NON NÉGOCIABLE : GO uniquement si Claude API a validé explicitement
  if (gate.source !== 'claude_api') {
    gate.verdict = 'NO_GO';
    gate.reasons = [
      ...(gate.reasons || []),
      `NON NÉGOCIABLE : source=${gate.source} — seul claude_api autorise la suite`,
    ];
    gate.failed_agents = [...new Set([...(gate.failed_agents || []), 'coworker-claude-ia'])];
  }

  const attemptInfo = gate.claude_attempt ? `, tentative ${gate.claude_attempt}` : '';
  console.log(`      ${gate.verdict} (${gate.source || 'unknown'}${attemptInfo})`);

  // 5. Postgres + dashboard
  console.log('[4/4] Enregistrement Postgres...');
  const pool = new Pool({ connectionString: resolvePostgresUrl() });

  await pool.query(
    `INSERT INTO dev_reports (agent_id, agent_role, module, task, status, message, files_changed, doc_reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [
      coworkerReport.agent_id, coworkerReport.agent_role, module, task,
      coworkerReport.status, coworkerReport.message,
      JSON.stringify(coworkerReport.files_changed), coworkerReport.doc_reference,
    ],
  );

  await pool.query(
    `INSERT INTO dev_test_results (scope, tests_pass, tests_total, coverage_pct, coverage_required_pct, coverage_ok, command)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      task, testReport.tests_pass, testReport.tests_total,
      testReport.coverage_pct, testReport.coverage_required_pct, testReport.coverage_ok,
      testReport.command,
    ],
  );

  await pool.query(
    `INSERT INTO dev_validation_results (scope, checklist, items, fail_count)
     VALUES ($1,$2,$3::jsonb,$4)`,
    [task, validationReport.checklist, JSON.stringify(validationReport.items), validationReport.fail_count],
  );

  const allProofs = [
    ...(validationReport.proofs || []),
    ...(gate.proofs || []),
  ];

  await pool.query(
    `INSERT INTO dev_gate_verdicts (step, verdict, gate_source, reasons, doc_references, next_action, failed_agents)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)`,
    [
      gate.step || gateInput.current_step,
      gate.verdict,
      gate.source || 'unknown',
      JSON.stringify([...gate.reasons, { proofs: allProofs }]),
      JSON.stringify(gate.doc_references || []),
      gate.next_action || '',
      JSON.stringify(gate.failed_agents || []),
    ],
  );

  await pool.query(
    `UPDATE dev_agent_status SET status=$2, last_task=$3, last_report=NOW(), updated_at=NOW() WHERE agent_id=$1`,
    [a.agent, gate.verdict === 'GO' ? 'idle' : 'retry', task],
  );

  await pool.query(
    `UPDATE dev_agent_status SET status=$1, last_task=$2, last_report=NOW(), updated_at=NOW() WHERE agent_id='coworker-claude-ia'`,
    ['idle', gate.verdict],
  );

  await pool.query(
    `UPDATE dev_pipeline_state SET current_module=$1, current_task=$2, updated_at=NOW()
     WHERE id=(SELECT id FROM dev_pipeline_state ORDER BY id DESC LIMIT 1)`,
    [module, gate.verdict === 'GO' ? (a['next-task'] || task) : task],
  );

  await pool.end();

  try {
    const http = require('http');
    http.request({ hostname: '127.0.0.1', port: 3020, path: '/api/dev/push', method: 'POST' }).end();
  } catch { /* dashboard optionnel */ }

  console.log(`\n=== ${gate.verdict} — ${task} ===\n`);
  console.log(JSON.stringify({ gate, proofs: allProofs }, null, 2));

  if (gate.verdict !== 'GO' || gate.source !== 'claude_api') process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
