require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });
const { spawnSync } = require('child_process');
const path = require('path');
const { validateTask } = require('./lib/validate-task');
const { getCoverageMin } = require('./lib/coverage-min');
const { runClaudeGate } = require('./claude-gate');
const { callAnthropic, extractJson } = require('./lib/anthropic');

const task = 'src/atr.js';
const ROOT = path.resolve(__dirname, '..');

const result = spawnSync(
  `npm test -- --coverage --collectCoverageFrom=${task} tests/unit/atr.test.js`,
  { cwd: ROOT, encoding: 'utf8', shell: true, env: { ...process.env, NODE_ENV: 'test' } },
);
const output = `${result.stdout}\n${result.stderr}`;
const passMatch = output.match(/Tests:\s+(\d+) passed/);
const testsPass = passMatch ? parseInt(passMatch[1], 10) : 0;
const covMatch = output.match(/atr\.js\s+\|[\s\S]*?\|\s+([\d.]+)\s+\|/);
const coveragePct = covMatch ? parseFloat(covMatch[1]) : 0;

const testReport = {
  scope: task,
  tests_pass: testsPass,
  tests_total: testsPass,
  coverage_pct: coveragePct,
  coverage_required_pct: getCoverageMin(task),
  coverage_ok: coveragePct >= getCoverageMin(task),
  command: 'npm test',
  exit_code: result.status,
};
const validationReport = validateTask(task, testReport);

const gateInput = {
  current_step: `MODULE_B.${task}`,
  next_task_hint: 'src/regime.js',
  coworker_report: { agent_id: 'coworker-1' },
  test_report: testReport,
  validation_report: validationReport,
};

console.log('Input size:', JSON.stringify(gateInput).length, 'bytes');

runClaudeGate(gateInput).then(async (g) => {
  console.log(JSON.stringify(g, null, 2));
  if (g.source !== 'claude_api') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const res = await callAnthropic(apiKey, {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 1536,
      system: 'Reply JSON only',
      messages: [{ role: 'user', content: JSON.stringify(gateInput).slice(0, 5000) }],
    });
    console.log('\n--- Raw API (truncated) ---');
    console.log(res.body.slice(0, 800));
  }
});
