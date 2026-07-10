/**
 * Validateur technique — preuves factuelles uniquement (CD §10, ARCHITECTURE §6)
 */
const fs = require('fs');
const path = require('path');
const { EXPORTS_REQUIRED, getCoverageMin } = require('./coverage-min');

const ROOT = path.resolve(__dirname, '../..');
const WF_DIR = path.join(ROOT, 'n8n/workflows');
const WF_FILES = [
  'wf1_health.json', 'wf2_trade_alert.json', 'wf3_stop_global.json',
  'wf4_daily_report.json', 'wf5_reset_daily.json', 'wf6_config_update.json',
];

function proof(type, ref, detail, pass) {
  return { type, ref, detail, result: pass ? 'PASS' : 'FAIL' };
}

function checklistFor(task) {
  if (task.startsWith('mcp/')) return 'L14';
  if (task.startsWith('n8n/workflows')) return 'L15';
  if (task.startsWith('dashboard/')) return 'L_DASH';
  return 'L2';
}

function validateL14(task, items, proofs) {
  const sqlGuard = path.join(ROOT, 'mcp/lib/sqlGuard.js');
  const tools = path.join(ROOT, 'mcp/lib/tools.js');
  const server = path.join(ROOT, 'mcp/server.js');
  const sg = fs.existsSync(sqlGuard) ? fs.readFileSync(sqlGuard, 'utf8') : '';
  const tl = fs.existsSync(tools) ? fs.readFileSync(tools, 'utf8') : '';
  const sv = fs.existsSync(server) ? fs.readFileSync(server, 'utf8') : '';

  const checks = [
    ['sqlGuard bloque FORBIDDEN', sg.includes('FORBIDDEN') && sg.includes('drop')],
    ['ALLOWED_PARAMS whitelist', sg.includes('ALLOWED_PARAMS')],
    ['run_query log mcp_actions', tl.includes('mcp_actions')],
    ['set_config log mcp_actions', tl.includes("['set_config'")],
    ['auth token MCP_TOKEN', sv.includes('MCP_TOKEN') && sv.includes('x-mcp-token')],
  ];
  for (const [label, ok] of checks) {
    items.push({ criterion: label, result: ok ? 'PASS' : 'FAIL', ref: 'CD L14' });
    proofs.push(proof('checklist_l14', 'CD L14', label, ok));
  }
}

function validateL15(items, proofs) {
  const allExist = WF_FILES.every((f) => fs.existsSync(path.join(WF_DIR, f)));
  items.push({ criterion: '6 fichiers JSON présents', result: allExist ? 'PASS' : 'FAIL', ref: 'CD L15' });
  proofs.push(proof('checklist_l15', 'CD L15', `6 WF → ${allExist ? 'OK' : 'MANQUANT'}`, allExist));

  if (allExist) {
    const wf1 = JSON.parse(fs.readFileSync(path.join(WF_DIR, 'wf1_health.json'), 'utf8'));
    const wf5 = JSON.parse(fs.readFileSync(path.join(WF_DIR, 'wf5_reset_daily.json'), 'utf8'));
    const wf1raw = JSON.stringify(wf1);
    const wf5raw = JSON.stringify(wf5);

    const httpRestart = wf1raw.includes('/restart') && wf1raw.includes('x-restart-token');
    items.push({ criterion: 'WF1 HTTP /restart + token', result: httpRestart ? 'PASS' : 'FAIL', ref: 'CD L15' });
    proofs.push(proof('checklist_l15', 'CD L15', 'WF1 restart HTTP', httpRestart));

    const resetDaily = wf5raw.includes('reset_daily') && wf5raw.includes('/config');
    items.push({ criterion: 'WF5 POST /config reset_daily', result: resetDaily ? 'PASS' : 'FAIL', ref: 'CD L15' });
    proofs.push(proof('checklist_l15', 'CD L15', 'WF5 reset_daily', resetDaily));

    const secretsEnv = WF_FILES.every((f) => {
      const raw = fs.readFileSync(path.join(WF_DIR, f), 'utf8');
      if (!raw.includes('RESTART_SECRET') && !raw.includes('TELEGRAM')) return true;
      return raw.includes('$env.');
    });
    items.push({ criterion: 'Secrets via $env', result: secretsEnv ? 'PASS' : 'FAIL', ref: 'CD L15' });
    proofs.push(proof('checklist_l15', 'CD L15', 'secrets $env', secretsEnv));
  }
}

function validateDashboard(task, items, proofs) {
  const html = path.join(ROOT, 'dashboard/public/index.html');
  const content = fs.existsSync(html) ? fs.readFileSync(html, 'utf8') : '';
  const tabs = (content.match(/data-tab="/g) || []).length;
  const tabsOk = tabs === 9;
  items.push({ criterion: '9 onglets dashboard', result: tabsOk ? 'PASS' : 'FAIL', ref: 'ARCHITECTURE §4' });
  proofs.push(proof('checklist_dash', 'ARCHITECTURE §4', `onglets=${tabs}`, tabsOk));

  if (task === 'dashboard/server.js') {
    const srv = fs.readFileSync(path.join(ROOT, 'dashboard/server.js'), 'utf8');
    const wsOk = srv.includes('WebSocketServer');
    items.push({ criterion: 'WebSocket temps réel', result: wsOk ? 'PASS' : 'FAIL', ref: 'CD §6' });
    proofs.push(proof('checklist_dash', 'CD §6', 'WebSocket 1s', wsOk));
  }
}

function validateTask(task, testReport) {
  const items = [];
  const proofs = [];
  const checklist = checklistFor(task);

  if (task.startsWith('n8n/workflows')) {
    validateL15(items, proofs);
  } else {
    const absPath = path.join(ROOT, task);
    const fileExists = fs.existsSync(absPath);
    items.push({
      criterion: `Fichier ${task} existe`,
      result: fileExists ? 'PASS' : 'FAIL',
      ref: 'CD §3',
    });
    proofs.push(proof('file_exists', 'CD §3', `${task} → ${fileExists ? 'présent' : 'ABSENT'}`, fileExists));

    if (EXPORTS_REQUIRED[task]) {
      const content = fileExists ? fs.readFileSync(absPath, 'utf8') : '';
      for (const exp of EXPORTS_REQUIRED[task]) {
        const ok = content.includes(exp);
        items.push({
          criterion: `Export ${exp}`,
          result: ok ? 'PASS' : 'FAIL',
          ref: 'ARCHITECTURE §6',
        });
        proofs.push(proof('export', 'ARCHITECTURE §6', `${exp} → ${ok ? 'trouvé' : 'MANQUANT'}`, ok));
      }
    }

    if (task.startsWith('mcp/')) validateL14(task, items, proofs);
    if (task.startsWith('dashboard/')) validateDashboard(task, items, proofs);
  }

  const minCov = getCoverageMin(task);
  if (minCov !== null && testReport) {
    const covOk = testReport.coverage_pct >= minCov;
    items.push({
      criterion: `Couverture >= ${minCov}%`,
      result: covOk ? 'PASS' : 'FAIL',
      ref: 'CD §9.1',
    });
    proofs.push(proof(
      'coverage',
      'CD §9.1',
      `${task} ${testReport.coverage_pct}% (requis ${minCov}%)`,
      covOk,
    ));
  }

  if (testReport) {
    const testsOk = testReport.tests_pass === testReport.tests_total;
    items.push({
      criterion: 'Tests 100%',
      result: testsOk ? 'PASS' : 'FAIL',
      ref: 'CD §3',
    });
    proofs.push(proof(
      'test',
      'CD §3',
      `${testReport.tests_pass}/${testReport.tests_total} PASS (commande: ${testReport.command})`,
      testsOk,
    ));
  }

  const failCount = items.filter((i) => i.result === 'FAIL').length;
  return {
    scope: task,
    checklist,
    items,
    proofs,
    fail_count: failCount,
    pass: failCount === 0,
  };
}

module.exports = { validateTask };
