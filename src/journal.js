// src/journal.js — CD §4.5

const { Pool } = require('pg');
const winston = require('winston');
const { notifyTelegram } = require('./notify');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

let defaultPool = null;

const resolvePool = (pgPool) => {
  if (pgPool) return pgPool;
  if (!defaultPool && process.env.POSTGRES_URL) {
    defaultPool = new Pool({ connectionString: process.env.POSTGRES_URL });
  }
  return defaultPool;
};

const logEvent = async (pgPool, symbol, type, payload = {}) => {
  await pgPool.query(
    'INSERT INTO events (symbol, type, payload) VALUES ($1, $2, $3)',
    [symbol, type, JSON.stringify(payload)],
  );
};

const logTradeOpen = async (pgPool, symbol, price, qty, tp, sl, atr, kellyFraction) => {
  const result = await pgPool.query(
    `INSERT INTO trades (
       symbol, entry_price, qty, result, order_type, entry_mode,
       regime, kelly_fraction, dry_run
     ) VALUES ($1, $2, $3, 'OPEN', 'OPOCO', 'LIMIT_MAKER', NULL, $4, $5)
     RETURNING id`,
    [symbol, price, qty, kellyFraction, process.env.DRY_RUN === 'true'],
  );
  logger.debug(`Trade ouvert id=${result.rows[0].id} ${symbol}`);
  return result.rows[0].id;
};

const logTradeFill = async (pgPool, tradeId, entry) => {
  await pgPool.query(
    `UPDATE trades SET entry_price = $1, qty = $2 WHERE id = $3`,
    [entry.fillPrice, entry.quantity, tradeId],
  );
};

const logTradeClose = async (pgPool, redis, symbol, tradeId, closeData) => {
  await pgPool.query(
    `UPDATE trades SET exit_price = $1, exit_time = NOW(), duration_min = $2,
     pnl_brut = $3, fees = $4, pnl_net = $5, result = $6
     WHERE id = $7`,
    [
      closeData.exitPrice,
      closeData.durationMin,
      closeData.pnlBrut,
      closeData.fees,
      closeData.pnlNet,
      closeData.result,
      tradeId,
    ],
  );

  const total = await redis.incr('bot:global:total_trades');
  if (total === 1500) {
    await notifyTelegram('🧠 Seuil 1500 trades atteint — entraînement XGBoost Phase 2 possible');
  }
};

const logDryRun = async (symbol, entryPrice, qty, pgPool = null) => {
  const pool = resolvePool(pgPool);
  if (!pool) {
    logger.warn('logDryRun: POSTGRES_URL absent');
    return;
  }
  await pool.query(
    `INSERT INTO trades (symbol, entry_price, qty, result, dry_run, kelly_fraction)
     VALUES ($1, $2, $3, 'DRY_RUN', true, 0.10)`,
    [symbol, entryPrice, qty],
  );
};

const logSlippageAbort = async (symbol, fillPrice, expectedPrice, slippagePct, pgPool = null) => {
  const pool = resolvePool(pgPool);
  if (!pool) return;
  await pool.query(
    `INSERT INTO events (symbol, type, payload) VALUES ($1, 'SLIPPAGE_ABORT', $2)`,
    [symbol, JSON.stringify({ fillPrice, expectedPrice, slippagePct })],
  );
  await pool.query(
    `INSERT INTO trades (symbol, entry_price, exit_price, qty, result, slippage_pct, dry_run, pnl_net)
     VALUES ($1, $2, $2, 0, 'SLIPPAGE_ABORT', $3, false, 0)`,
    [symbol, fillPrice, slippagePct],
  );
};

const logForcedExit = async (symbol, reason, pgPool = null) => {
  const pool = resolvePool(pgPool);
  if (!pool) return;
  await pool.query(
    `INSERT INTO events (symbol, type, payload) VALUES ($1, 'FORCED_EXIT', $2)`,
    [symbol, JSON.stringify({ reason })],
  );
};

const getDayPnl = async (pgPool, symbol) => {
  const result = await pgPool.query(
    `SELECT COALESCE(SUM(pnl_net), 0) AS total
     FROM trades
     WHERE symbol = $1
       AND entry_time >= CURRENT_DATE
       AND dry_run = false
       AND result IN ('TP', 'SL', 'FORCED_EXIT', 'SLIPPAGE_ABORT')`,
    [symbol],
  );
  return parseFloat(result.rows[0].total);
};

const getConsecLoss = async (redis, symbol) => {
  return parseInt(await redis.get(`bot:${symbol.toLowerCase()}:consec_loss`) || '0', 10);
};

const getTotalTrades = async (redis) => {
  return parseInt(await redis.get('bot:global:total_trades') || '0', 10);
};

const getProfitFactor = async (pgPool, symbol, limit = 100) => {
  const result = await pgPool.query(
    `SELECT pnl_net FROM trades
     WHERE symbol = $1 AND dry_run = false AND result IN ('TP', 'SL')
     ORDER BY created_at DESC LIMIT $2`,
    [symbol, limit],
  );
  let gains = 0;
  let losses = 0;
  for (const row of result.rows) {
    const pnl = parseFloat(row.pnl_net);
    if (pnl > 0) gains += pnl;
    else losses += Math.abs(pnl);
  }
  if (losses === 0) return gains > 0 ? Infinity : 0;
  return gains / losses;
};

module.exports = {
  logTradeOpen,
  logTradeFill,
  logTradeClose,
  logEvent,
  logDryRun,
  logSlippageAbort,
  logForcedExit,
  getDayPnl,
  getConsecLoss,
  getTotalTrades,
  getProfitFactor,
};
