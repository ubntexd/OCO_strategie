#!/usr/bin/env python3
"""Patch n8n and journal tests after audit fixes."""
from pathlib import Path

ROOT = Path('/home/dev/dev/OCO_strategie')

# n8n test - WF5 three bots
n8n = ROOT / 'tests/unit/n8n-workflows.test.js'
t = n8n.read_text(encoding='utf-8')
old = """  test('WF5 — POST /config reset_daily, pas Redis direct', () => {
    const wf = loadWf('wf5_reset_daily.json');
    const nodes = allNodes(wf);
    expect(nodes.some((n) => n.type === 'n8n-nodes-base.redis')).toBe(false);
    const reset = nodes.find((n) => n.name === 'Reset BTC');
    expect(reset.parameters.method).toBe('POST');
    expect(reset.parameters.url).toMatch(/\\/config/);
    expect(reset.parameters.jsonBody).toMatch(/reset_daily/);
  });"""

new = """  test('WF5 — POST /config reset_daily sur 3 bots, pas Redis direct', () => {
    const wf = loadWf('wf5_reset_daily.json');
    const nodes = allNodes(wf);
    expect(nodes.some((n) => n.type === 'n8n-nodes-base.redis')).toBe(false);
    for (const name of ['Reset BTC', 'Reset ETH', 'Reset SOL']) {
      const reset = nodes.find((n) => n.name === name);
      expect(reset).toBeDefined();
      expect(reset.parameters.method).toBe('POST');
      expect(reset.parameters.url).toMatch(/\\/config/);
      expect(reset.parameters.jsonBody).toMatch(/reset_daily/);
    }
  });"""

if old in t:
    t = t.replace(old, new)
    n8n.write_text(t, encoding='utf-8')
    print('n8n test OK')

# journal test - correlation in INSERT
jtest = ROOT / 'tests/unit/journal.test.js'
jt = jtest.read_text(encoding='utf-8')
if 'correlation_btc_eth' not in jt:
    jt = jt.replace(
        "      const id = await journal.logTradeOpen(\n        mockPg, 'BTCUSDT', 104500, 0.001, 104900, 104200, 50, 0.10,\n      );",
        "      const id = await journal.logTradeOpen(\n        mockPg, 'BTCUSDT', 104500, 0.001, 104900, 104200, 50, 0.10, 0.42,\n      );",
    )
    jt = jt.replace(
        "        expect.arrayContaining(['BTCUSDT', 104500, 0.001, 0.10]),",
        "        expect.arrayContaining(['BTCUSDT', 104500, 0.001, 0.10, 0.42]),",
    )
    jt = jt.replace(
        "      expect(mockRedis.incr).toHaveBeenCalledWith('bot:global:total_trades');\n    });",
        "      expect(mockRedis.incr).toHaveBeenCalledWith('bot:global:total_trades');\n      expect(mockPg.query).toHaveBeenCalledWith(\n        expect.stringContaining('daily_summary'),\n        expect.any(Array),\n      );\n    });",
    )
    jtest.write_text(jt, encoding='utf-8')
    print('journal test OK')
