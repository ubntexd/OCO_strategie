// src/health.js — CD §4.4

const express = require('express');
const winston = require('winston');
const journal = require('./journal');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

const VERSION = '1.0.0';
let server = null;
const startTime = Date.now();

const logRequest = (req) => {
  logger.info(`${req.method} ${req.path} — IP ${req.ip} — ${new Date().toISOString()}`);
};

const createHealthApp = (redis, pgPool) => {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    logRequest(req);
    req.setTimeout(5000);
    res.setTimeout(5000);
    next();
  });

  app.get('/health', async (req, res) => {
    const symbol = process.env.SYMBOL || 'UNKNOWN';
    const lastTrade = await pgPool.query(
      `SELECT MAX(entry_time) AS last FROM trades WHERE symbol = $1`,
      [symbol],
    );
    res.json({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      symbol,
      lastTradeAt: lastTrade.rows[0]?.last || null,
      version: VERSION,
    });
  });

  app.get('/status', async (req, res) => {
    const symbol = process.env.SYMBOL || 'UNKNOWN';
    const sym = symbol.toLowerCase();
    const pnlDay = await journal.getDayPnl(pgPool, symbol);
    const tradesDay = parseInt(await redis.get(`bot:${sym}:trades_day`) || '0', 10);
    const openOrders = await redis.get(`bot:${sym}:position_open`) === '1' ? 1 : 0;
    const consecLoss = await journal.getConsecLoss(redis, symbol);
    const regime = await redis.get(`regime:${symbol}`) || 'UNKNOWN';
    res.json({
      pnl_day: pnlDay,
      trades_day: tradesDay,
      open_orders: openOrders,
      consec_loss: consecLoss,
      regime,
      dry_run: process.env.DRY_RUN === 'true',
      kelly_fraction: parseFloat(await redis.get(`kelly:${sym}`) || '0.10'),
    });
  });

  app.post('/stop', (req, res) => {
    res.json({ status: 'stopping' });
    setTimeout(() => process.exit(0), 500);
  });

  app.post('/restart', (req, res) => {
    const token = req.headers['x-restart-token'];
    if (token !== process.env.RESTART_SECRET) {
      logger.warn(`/restart refusé — token invalide (IP: ${req.ip})`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    logger.info('/restart déclenché — process.exit(1) dans 500ms');
    res.json({ status: 'restarting' });
    setTimeout(() => process.exit(1), 500);
  });

  app.post('/config', async (req, res) => {
    const token = req.headers['x-bot-token'];
    if (token !== process.env.RESTART_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { key, value } = req.body;
    const symbol = (process.env.SYMBOL || 'BTCUSDT').toLowerCase();

    if (key === 'reset_daily') {
      await redis.del(`bot:${symbol}:daily_loss_locked`);
      await redis.del('bot:global:stop');
      await redis.set(`bot:${symbol}:consec_loss`, '0');
      await redis.set(`bot:${symbol}:trades_day`, '0');
      logger.info(`[${process.env.SYMBOL}] reset_daily appliqué`);
      return res.json({ status: 'applied', key: 'reset_daily' });
    }

    const channel = `bot:${symbol}:config`;
    await redis.publish(channel, `${key}:${value}`);
    logger.info(`Config publiée: ${key}=${value}`);
    res.json({ status: 'applied', key, value });
  });

  return app;
};

const startHealthServer = async (port, redis, pgPool) => {
  const app = createHealthApp(redis, pgPool);
  return new Promise((resolve) => {
    server = app.listen(port, () => resolve(server));
  });
};

const stopHealthServer = async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
};

module.exports = { startHealthServer, stopHealthServer, createHealthApp };
