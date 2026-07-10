const fs = require('fs');
const path = require('path');

const WF_DIR = path.join(__dirname, '../../n8n/workflows');
const WF_FILES = [
  'wf1_health.json',
  'wf2_trade_alert.json',
  'wf3_stop_global.json',
  'wf4_daily_report.json',
  'wf5_reset_daily.json',
  'wf6_config_update.json',
];

function loadWf(name) {
  return JSON.parse(fs.readFileSync(path.join(WF_DIR, name), 'utf8'));
}

function allNodes(wf) {
  return wf.nodes || [];
}

describe('n8n/workflows — L15', () => {
  test('6 fichiers JSON importables', () => {
    for (const f of WF_FILES) {
      const wf = loadWf(f);
      expect(wf.name).toBeTruthy();
      expect(Array.isArray(wf.nodes)).toBe(true);
      expect(wf.nodes.length).toBeGreaterThan(0);
    }
  });

  test('WF1 — HTTP /restart avec x-restart-token, pas SSH', () => {
    const wf = loadWf('wf1_health.json');
    const nodes = allNodes(wf);
    const types = nodes.map((n) => n.type);
    expect(types).not.toContain('n8n-nodes-base.ssh');
    const restart = nodes.find((n) => n.name === 'Restart via HTTP');
    expect(restart).toBeDefined();
    expect(restart.parameters.url).toMatch(/\/restart/);
    const hdr = restart.parameters.headerParameters?.parameters || [];
    expect(hdr.some((h) => h.name === 'x-restart-token' && h.value.includes('$env.RESTART_SECRET'))).toBe(true);
  });

  test('WF5 — POST /config reset_daily, pas Redis direct', () => {
    const wf = loadWf('wf5_reset_daily.json');
    const nodes = allNodes(wf);
    expect(nodes.some((n) => n.type === 'n8n-nodes-base.redis')).toBe(false);
    const reset = nodes.find((n) => n.name === 'Reset BTC');
    expect(reset.parameters.method).toBe('POST');
    expect(reset.parameters.url).toMatch(/\/config/);
    expect(reset.parameters.jsonBody).toMatch(/reset_daily/);
  });

  test('secrets via $env, pas en dur', () => {
    for (const f of WF_FILES) {
      const raw = fs.readFileSync(path.join(WF_DIR, f), 'utf8');
      expect(raw).not.toMatch(/sk-ant-/);
      expect(raw).not.toMatch(/[0-9]{10}:[A-Za-z0-9_-]{35}/);
      if (raw.includes('TELEGRAM') || raw.includes('RESTART')) {
        expect(raw).toMatch(/\$env\./);
      }
    }
  });

  test('WF3 webhook stop-global', () => {
    const wf = loadWf('wf3_stop_global.json');
    const wh = allNodes(wf).find((n) => n.type === 'n8n-nodes-base.webhook');
    expect(wh.parameters.path).toBe('stop-global');
  });
});
