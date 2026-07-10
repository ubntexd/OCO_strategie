#!/usr/bin/env node
/**
 * Enregistre le GO directeur — PLAN_8_AGENTS.md §10
 * Usage: npm run pipeline:go
 */
require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });
const { Pool } = require('pg');

function getPool() {
  const url = process.env.POSTGRES_URL_HOST || process.env.POSTGRES_URL?.replace('@bot_postgres:', '@127.0.0.1:') || process.env.POSTGRES_URL;
  return new Pool({ connectionString: url });
}

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO dev_pipeline_state (status, current_module, current_task, started_at)
       VALUES ('RUNNING', 'I', 'INFRA_CHECK', NOW())`,
    );

    await client.query(
      `INSERT INTO dev_reports (agent_id, agent_role, module, task, status, message, doc_reference)
       VALUES ('directeur', 'Humain', 'I', 'GO pipeline', 'done',
               'GO enregistré — développement démarré', 'PLAN_8_AGENTS.md §10')`,
    );

    await client.query(
      `UPDATE dev_agent_status SET status = 'running', last_task = 'INFRA_CHECK', updated_at = NOW()
       WHERE agent_id IN ('superviseur', 'coworker-4')`,
    );

    await client.query(
      `INSERT INTO dev_reports (agent_id, agent_role, module, task, status, message, files_changed, doc_reference)
       VALUES ('coworker-4', 'Infra & QA', 'I', 'bootstrap', 'done',
               'Structure projet, docker-compose, dev-dashboard, schema.sql, kelly.js',
               '["docker-compose.yml","db/schema.sql","src/kelly.js"]'::jsonb, 'CD §3 Phase 1')`,
    );

    await client.query(
      `INSERT INTO dev_gate_verdicts (step, verdict, reasons, doc_references, next_action)
       VALUES ('INFRA.BOOTSTRAP', 'GO',
               '["Fichiers fondation créés","Tests kelly.js à exécuter"]'::jsonb,
               '["PLAN_8_AGENTS.md","CD §3"]'::jsonb,
               'B.1 schema.sql déployé — Coworker 1')`,
    );

    await client.query('COMMIT');
    console.log('GO pipeline enregistré dans dev_pipeline_state');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
