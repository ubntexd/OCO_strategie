require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });
const { runClaudeGate } = require('./claude-gate');

const input = {
  current_step: 'MODULE_B.src/atr.js',
  next_task_hint: 'src/regime.js',
  coworker_report: { agent_id: 'coworker-1' },
  test_report: {
    tests_pass: 3, tests_total: 3, exit_code: 0, coverage_pct: 100, coverage_ok: true,
  },
  validation_report: {
    pass: true, fail_count: 0,
    proofs: [{ type: 'test', ref: 'CD §3', detail: '3/3 PASS', result: 'PASS' }],
  },
};

runClaudeGate(input)
  .then((g) => console.log(JSON.stringify(g, null, 2)))
  .catch((e) => { console.error(e); process.exit(1); });
