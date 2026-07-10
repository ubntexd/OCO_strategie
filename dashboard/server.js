'use strict';

const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const express = require('express');
const http = require('http');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.DASHBOARD_PORT || '3010', 10);
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

// ── Realtime WS payload ───────────────────────────────────────────────────────

const buildRealtimeData = async (redis, pgPool) => {
  const [bidBtc, bidEth, bidSol, pnlRes] = await Promise.all([
    redis.get('bid:BTCUSDT'),
    redis.get('bid:ETHUSDT'),
    redis.get('bid:SOLUSDT'),
    pgPool.query(
      `SELECT COALESCE(SUM(pnl_net),0) AS total FROM trades
       WHERE dry_run=false AND entry_time >= CURRENT_DATE`,
    ),
  ]);
  const pairs = {};
  for (const sym of SYMBOLS) {
    const s = sym.toLowerCase();
    pairs[sym] = {
      position_open: (await redis.get(`bot:${s}:position_open`)) === '1',
      trades_day: parseInt((await redis.get(`bot:${s}:trades_day`)) || '0', 10),
      consec_loss: parseInt((await redis.get(`bot:${s}:consec_loss`)) || '0', 10),
      regime: (await redis.get(`regime:${sym}`)) || '—',
      kelly: parseFloat((await redis.get(`bot:${s}:kelly`)) || '0'),
      atr: parseFloat((await redis.get(`atr:${sym}`)) || '0'),
      ws_status: (await redis.get(`bot:${s}:ws_status`)) || 'unknown',
      listen_key_age: parseInt((await redis.get(`bot:${s}:listen_key_age`)) || '0', 10),
      last_signal: (await redis.get(`bot:${s}:last_signal`)) || null,
    };
  }
  return {
    ts: Date.now(),
    bid_btc: bidBtc,
    bid_eth: bidEth,
    bid_sol: bidSol,
    pnl_day: parseFloat(pnlRes.rows[0].total),
    global_stop: (await redis.get('bot:global:stop')) === '1',
    pairs,
  };
};

// ── System info ───────────────────────────────────────────────────────────────

const getSystemInfo = () => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    uptime: os.uptime(),
    load: os.loadavg(),
    cpu_count: cpus.length,
    cpu_model: cpus[0]?.model || '—',
    mem_total_mb: Math.round(totalMem / 1024 / 1024),
    mem_used_mb: Math.round((totalMem - freeMem) / 1024 / 1024),
    mem_free_mb: Math.round(freeMem / 1024 / 1024),
    platform: os.platform(),
    hostname: os.hostname(),
  };
};

const getDockerInfo = () => new Promise((resolve) => {
  exec('docker ps --format "{{.Names}}|{{.Status}}|{{.Image}}" 2>/dev/null', (err, stdout) => {
    if (err || !stdout.trim()) { resolve([]); return; }
    const containers = stdout.trim().split('\n').map((line) => {
      const [name, status, image] = line.split('|');
      return { name, status, image };
    });
    resolve(containers);
  });
});

// ── App factory ───────────────────────────────────────────────────────────────

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

  // ── Existing endpoints ──────────────────────────────────────────────────────
  app.get('/api/pnl/today', require('./api/pnl').today(pgPool));
  app.get('/api/trades', require('./api/trades').list(pgPool));
  app.get('/api/status', require('./api/status').get(redis, pgPool));
  app.post('/api/backtest', require('./api/backtest').run(pgPool));
  app.get('/api/correlation', require('./api/correlation').current(redis));
  app.get('/api/events', require('./api/events').list(pgPool));

  // ── Config à chaud ──────────────────────────────────────────────────────────
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

  // ── System / VPS ────────────────────────────────────────────────────────────
  app.get('/api/system', async (_req, res) => {
    try {
      const [sys, docker] = await Promise.all([getSystemInfo(), getDockerInfo()]);
      res.json({ ...sys, containers: docker });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Trades avec filtres avancés ─────────────────────────────────────────────
  app.get('/api/trades/filtered', async (req, res) => {
    try {
      const {
        symbol, result, from, to, pnl_min, pnl_max,
        dry_run, limit = '200', offset = '0',
        sort_col = 'entry_time', sort_dir = 'DESC',
      } = req.query;

      const allowed_cols = ['entry_time', 'exit_time', 'pnl_net', 'symbol', 'result', 'qty', 'entry_price', 'exit_price'];
      const col = allowed_cols.includes(sort_col) ? sort_col : 'entry_time';
      const dir = sort_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const conditions = [];
      const params = [];
      let i = 1;

      if (symbol && symbol !== 'ALL') { conditions.push(`symbol = $${i++}`); params.push(symbol); }
      if (result && result !== 'ALL') { conditions.push(`result = $${i++}`); params.push(result); }
      if (from) { conditions.push(`entry_time >= $${i++}`); params.push(from); }
      if (to) { conditions.push(`entry_time <= $${i++}`); params.push(to); }
      if (pnl_min !== undefined) { conditions.push(`pnl_net >= $${i++}`); params.push(parseFloat(pnl_min)); }
      if (pnl_max !== undefined) { conditions.push(`pnl_net <= $${i++}`); params.push(parseFloat(pnl_max)); }
      if (dry_run !== undefined) { conditions.push(`dry_run = $${i++}`); params.push(dry_run === 'true'); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const lim = Math.min(parseInt(limit, 10), 1000);
      const off = parseInt(offset, 10);

      const [rows, stats] = await Promise.all([
        pgPool.query(
          `SELECT id, symbol, entry_time, exit_time, entry_price, exit_price,
                  qty, pnl_net, result, dry_run, kelly_fraction, slippage_pct,
                  EXTRACT(EPOCH FROM (exit_time - entry_time)) AS duration_s
           FROM trades ${where} ORDER BY ${col} ${dir} LIMIT $${i} OFFSET $${i + 1}`,
          [...params, lim, off],
        ),
        pgPool.query(
          `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE pnl_net > 0) AS wins,
             COUNT(*) FILTER (WHERE pnl_net <= 0) AS losses,
             COALESCE(SUM(pnl_net), 0) AS total_pnl,
             COALESCE(AVG(pnl_net), 0) AS avg_pnl,
             COALESCE(MAX(pnl_net), 0) AS best,
             COALESCE(MIN(pnl_net), 0) AS worst,
             COALESCE(AVG(EXTRACT(EPOCH FROM (exit_time - entry_time))), 0) AS avg_duration_s
           FROM trades ${where}`,
          params,
        ),
      ]);

      res.json({ rows: rows.rows, stats: stats.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PnL historique par jour (courbe) ────────────────────────────────────────
  app.get('/api/pnl/history', async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days || '30', 10), 365);
      const result = await pgPool.query(
        `SELECT DATE(entry_time) AS day, symbol,
                SUM(pnl_net) AS pnl, COUNT(*) AS trades
         FROM trades
         WHERE dry_run = false
           AND entry_time >= NOW() - ($1::int || ' days')::interval
         GROUP BY DATE(entry_time), symbol
         ORDER BY day ASC`,
        [days],
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
};

// ── Server bootstrap ──────────────────────────────────────────────────────────

const startDashboardServer = async (port = PORT) => {
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const redis = new Redis(process.env.REDIS_URL);
  const app = createDashboardApp(pgPool, redis);
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const push = async () => {
    try {
      const data = await buildRealtimeData(redis, pgPool);
      const payload = JSON.stringify(data);
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(payload);
      });
    } catch (_e) { /* Redis/PG indispo — on ignore */ }
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

module.exports = { createDashboardApp, startDashboardServer, buildRealtimeData, PORT };
