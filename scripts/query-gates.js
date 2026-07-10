require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });
const { Pool } = require('pg');

let url = process.env.POSTGRES_URL || '';
if (url.includes('bot_postgres')) {
  url = url.replace('bot_postgres', '127.0.0.1').replace(':5432', ':5435');
}

const pool = new Pool({ connectionString: url });

pool.query(
  'SELECT step, verdict, gate_source, reasons FROM dev_gate_verdicts ORDER BY id DESC LIMIT 12',
).then((r) => {
  for (const row of r.rows) {
    const src = row.gate_source || 'unknown';
    console.log(`${src.padEnd(16)} ${row.verdict.padEnd(5)} ${row.step}`);
    (row.reasons || []).filter((x) => typeof x === 'string').forEach((s) => console.log(`  → ${s}`));
  }
  pool.end();
}).catch((e) => { console.error(e); process.exit(1); });
