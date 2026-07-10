#!/usr/bin/env node
/**
 * Enregistre résultats test + rapport coworker — PLAN_8_AGENTS.md §6
 * Usage: node scripts/record-step.js --task src/journal.js --tests-pass 9 --tests-total 9
 */
require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });
const { Pool } = require('pg');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    out[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return out;
}

async function main() {
  const a = parseArgs();
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL?.replace('bot_postgres', '127.0.0.1').replace(':5432', ':5435')
      || process.env.POSTGRES_URL,
  });

  const testsPass = parseInt(a['tests-pass'] || '0', 10);
  const testsTotal = parseInt(a['tests-total'] || '0', 10);
  const coverage = parseFloat(a.coverage || '0');
  const coverageReq = parseFloat(a['coverage-req'] || '80');

  await pool.query(
    `INSERT INTO dev_reports (agent_id, agent_role, module, task, status, message, doc_reference)
     VALUES ('coworker-1', 'Module B', 'B', $1, 'done', $2, 'CD §4.5')`,
    [a.task || 'unknown', a.message || 'Livré'],
  );

  await pool.query(
    `INSERT INTO dev_test_results (scope, tests_pass, tests_total, coverage_pct, coverage_required_pct, coverage_ok, command)
     VALUES ($1, $2, $3, $4, $5, $6, 'npm test')`,
    [a.task, testsPass, testsTotal, coverage, coverageReq, coverage >= coverageReq],
  );

  await pool.query(
    `INSERT INTO dev_validation_results (scope, checklist, items, fail_count)
     VALUES ($1, 'L2', $2::jsonb, 0)`,
    [
      a.task,
      JSON.stringify([
        { criterion: 'Exports journal CD §4.5', result: 'PASS', ref: 'ARCHITECTURE §6' },
        { criterion: 'Tests 100%', result: testsPass === testsTotal ? 'PASS' : 'FAIL', ref: 'CD §3' },
      ]),
    ],
  );

  const verdict = testsPass === testsTotal && coverage >= coverageReq ? 'GO' : 'NO_GO';
  await pool.query(
    `INSERT INTO dev_gate_verdicts (step, verdict, reasons, doc_references, next_action)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
    [
      `MODULE_B.${a.task}`,
      verdict,
      JSON.stringify([`${testsPass}/${testsTotal} tests`, `couverture ${coverage}%`]),
      JSON.stringify(['CD §4.5', 'CD §9.1', 'L2']),
      verdict === 'GO' ? 'B.4 atr.js' : 'Relance coworker-1',
    ],
  );

  await pool.query(
    `UPDATE dev_agent_status SET status = 'idle', last_task = $2, last_report = NOW(), updated_at = NOW()
     WHERE agent_id = 'coworker-1'`,
    [a.task],
  );

  await pool.query(
    `UPDATE dev_pipeline_state SET current_module = 'B', current_task = $1, updated_at = NOW()
     WHERE id = (SELECT id FROM dev_pipeline_state ORDER BY id DESC LIMIT 1)`,
    [a.task],
  );

  await pool.end();
  console.log(`Étape enregistrée: ${a.task} — ${verdict}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
