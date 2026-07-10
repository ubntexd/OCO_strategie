const path = require('path');
const express = require('express');
const http = require('http');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.DASHBOARD_PORT || '3010', 10);

const buildRealtimeData = async (redis, pgPool) => {
  const bid = await redis.get('bid:BTCUSDT');
  const pnl = await pgPool.query(
    `SELECT COALESCE(SUM(pnl_net),0) AS total FROM trades
     WHERE dry_run=false AND entry_time >= CURRENT_DATE`,
  );
  return {
    ts: Date.now(),
    bid_btc: bid,
    pnl_day: parseFloat(pnl.rows[0].total),
  };
};

const createDashboardApp = (pgPool, redis) => {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'bot-dashboard', port: PORT });
  });

  app.use((req, res, next) => {
    if (req.path === '/health') return next();
    const auth = req.headers.authorization;
    const expected = `Basic ${Buffer.from(`admin:${process.env.DASHBOARD_PASSWORD || 'changeme'}`).toString('base64')}`;
    if (!auth || auth !== expected) {
      res.set('WWW-Authenticate', 'Basic realm="ROHAN Trading"');
      return res.status(401).send('Unauthorized');
    }
    next();
  });

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/pnl/today', require('./api/pnl').today(pgPool));
  app.get('/api/trades', require('./api/trades').list(pgPool));
  app.get('/api/status', require('./api/status').get(redis, pgPool));
  app.post('/api/backtest', require('./api/backtest').run(pgPool));
  app.get('/api/correlation', require('./api/correlation').current(redis));

  // Config à chaud — publie dans Redis pub/sub (WF6)
  app.post('/api/config', async (req, res) => {
    try {
      const { symbol, key, value } = req.body || {};
      if (!symbol || !key || value === undefined) {
        return res.status(400).json({ error: 'symbol, key et value requis' });
      }
      const channel = `bot:${symbol.toLowerCase()}:config`;
      await redis.publish(channel, `${key}:${value}`);
      res.json({ status: 'applied', symbol, key, value });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get('/api/events', require('./api/events').list(pgPool));

  return app;
};

const startDashboardServer = async (port = PORT) => {
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const redis = new Redis(process.env.REDIS_URL);
  const app = createDashboardApp(pgPool, redis);
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const push = async () => {
    const data = await buildRealtimeData(redis, pgPool);
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(payload);
    });
  };

  const interval = setInterval(push, 1000);

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ app, server, pgPool, redis, wss, interval, push, buildRealtimeData });
    });
  });
};

if (require.main === module) {
  startDashboardServer().then(() => {
    console.log(`Dashboard: http://0.0.0.0:${PORT}`);
  });
}

module.exports = {
  createDashboardApp,
  startDashboardServer,
  buildRealtimeData,
  PORT,
};
