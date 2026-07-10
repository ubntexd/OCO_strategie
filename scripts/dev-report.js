#!/usr/bin/env node
/**
 * Enregistre un rapport agent — PLAN_8_AGENTS.md §6.1
 * Usage: node scripts/dev-report.js --agent coworker-1 --task src/kelly.js --status done --message "OK"
 */
require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });
const { Pool } = require('pg');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    out[key] = args[i + 1];
  }
  return out;
}

async function main() {
  const a = parseArgs();
  if (!a.agent || !a.task || !a.status) {
    console.error('Usage: --agent ID --task TASK --status started|done|fail|retry [--message TEXT] [--module B]');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  await pool.query(
    `INSERT INTO dev_reports (agent_id, agent_role, module, task, status, message, doc_reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [a.agent, a.role || null, a.module || null, a.task, a.status, a.message || null, a.ref || null],
  );
  await pool.query(
    `UPDATE dev_agent_status SET status = $2, last_task = $3, last_report = NOW(), updated_at = NOW()
     WHERE agent_id = $1`,
    [a.agent, a.status === 'done' ? 'idle' : a.status, a.task],
  );
  await pool.end();
  console.log(`Rapport enregistré: ${a.agent} / ${a.task} / ${a.status}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
