require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });

const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const express = require('express');
const { Pool } = require('pg');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.DEV_DASHBOARD_PORT || '3020', 10);
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Set();

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

async function queryStatus() {
  const pipeline = await pool.query(
    'SELECT * FROM dev_pipeline_state ORDER BY id DESC LIMIT 1',
  );
  const agents = await pool.query('SELECT * FROM dev_agent_status ORDER BY agent_id');
  const lastGate = await pool.query(
    'SELECT * FROM dev_gate_verdicts ORDER BY created_at DESC LIMIT 1',
  );
  const reports = await pool.query(
    'SELECT * FROM dev_reports ORDER BY created_at DESC LIMIT 20',
  );
  const tests = await pool.query(
    'SELECT * FROM dev_test_results ORDER BY created_at DESC LIMIT 10',
  );
  return {
    pipeline: pipeline.rows[0] || { status: 'IDLE' },
    agents: agents.rows,
    lastGate: lastGate.rows[0] || null,
    reports: reports.rows,
    tests: tests.rows,
    updatedAt: new Date().toISOString(),
  };
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dev-dashboard' });
});

app.get('/api/dev/status', async (_req, res) => {
  try {
    res.json(await queryStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dev/agents', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM dev_agent_status ORDER BY agent_id');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dev/reports', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const agentId = req.query.agent_id;
    const r = agentId
      ? await pool.query(
        'SELECT * FROM dev_reports WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
        [agentId, limit],
      )
      : await pool.query(
        'SELECT * FROM dev_reports ORDER BY created_at DESC LIMIT $1',
        [limit],
      );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dev/gate/latest', async (_req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM dev_gate_verdicts ORDER BY created_at DESC LIMIT 1',
    );
    res.json(r.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dev/go', async (req, res) => {
  const token = req.headers['x-dev-go-token'];
  if (token !== process.env.DEV_GO_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await pool.query(
      `INSERT INTO dev_pipeline_state (status, current_module, current_task, started_at)
       VALUES ('RUNNING', 'I', 'INFRA_CHECK', NOW())`,
    );
    await pool.query(
      `UPDATE dev_agent_status SET status = 'running', updated_at = NOW()
       WHERE agent_id IN ('superviseur', 'coworker-4')`,
    );
    const status = await queryStatus();
    broadcast({ type: 'pipeline_go', ...status });
    res.json({ status: 'RUNNING', message: 'Pipeline démarré — PLAN_8_AGENTS.md §10' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dev/push', async (_req, res) => {
  try {
    const status = await queryStatus();
    broadcast({ type: 'refresh', ...status });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dev/pipeline/task', async (req, res) => {
  const token = req.headers['x-dev-go-token'];
  if (token !== process.env.DEV_GO_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const b = req.body || {};
  if (!b.agent || !b.task) {
    return res.status(400).json({ error: 'agent et task requis' });
  }
  const args = [
    path.join(__dirname, '../scripts/pipeline-task.js'),
    '--agent', b.agent,
    '--module', b.module || 'B',
    '--task', b.task,
    '--message', b.message || '',
    '--files-changed', JSON.stringify(b.files_changed || []),
    '--doc-ref', b.doc_ref || 'CD',
    '--next-task', b.next_task || '',
  ];
  execFile('node', args, {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ENV_FILE: process.env.ENV_FILE || '.env.shared' },
    maxBuffer: 10 * 1024 * 1024,
  }, async (err, stdout, stderr) => {
    try {
      const status = await queryStatus();
      broadcast({ type: 'pipeline_task', ...status });
    } catch { /* ignore */ }
    if (err) {
      return res.status(422).json({
        error: 'NO_GO ou erreur pipeline',
        stdout: stdout?.slice(-3000),
        stderr: stderr?.slice(-1000),
      });
    }
    res.json({ ok: true, stdout: stdout?.slice(-3000) });
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  clients.add(ws);
  queryStatus()
    .then((status) => ws.send(JSON.stringify({ type: 'init', ...status })))
    .catch(() => {});
  ws.on('close', () => clients.delete(ws));
});

setInterval(() => {
  queryStatus()
    .then((status) => broadcast({ type: 'tick', ...status }))
    .catch(() => {});
}, 10000);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`dev-dashboard listening on :${PORT}`);
});
