require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });

const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { getPnl, runQuery, setConfig } = require('./lib/tools');

const PORT = parseInt(process.env.MCP_PORT || '5010', 10);

const createMcpApp = (pgPool, redis) => {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    if (req.path === '/health') return next();
    const token = req.headers['x-mcp-token'] || req.headers.authorization?.replace('Bearer ', '');
    if (token !== process.env.MCP_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'bot-mcp', version: '1.0.0' });
  });

  app.post('/tools/get_pnl', async (req, res) => {
    try {
      const rows = await getPnl(pgPool, req.body || {});
      res.json({ rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/tools/run_query', async (req, res) => {
    try {
      const out = await runQuery(pgPool, req.body?.sql || '');
      if (out.error) return res.status(400).json(out);
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/tools/set_config', async (req, res) => {
    try {
      const out = await setConfig(redis, pgPool, req.body || {});
      if (out.error) return res.status(400).json(out);
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
};

const startMcpServer = async (port = PORT) => {
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const redis = new Redis(process.env.REDIS_URL);
  const app = createMcpApp(pgPool, redis);
  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve({ app, server, pgPool, redis }));
  });
};

if (require.main === module) {
  startMcpServer().then(() => {
    console.log(`MCP HTTP: http://0.0.0.0:${PORT}`);
  });
}

module.exports = { createMcpApp, startMcpServer, PORT };
