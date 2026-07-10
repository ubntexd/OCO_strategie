// src/bot.js — CD §4.13

'use strict';

const Redis = require('ioredis');
const { Pool } = require('pg');
const axios = require('axios');
const winston = require('winston');

const order = require('./order');
const monitor = require('./monitor');
const signal = require('./signal');
const protection = require('./protection');
const journal = require('./journal');
const atr = require('./atr');
const health = require('./health');
const { computeKellyAuto } = require('./kelly');
const { notifyN8n } = require('./notify');

const REQUIRED_ENV = [
  'SYMBOL', 'CAPITAL', 'TP_BRUT', 'SL_BRUT',
  'BINANCE_API_KEY', 'BINANCE_API_SECRET',
  'REDIS_URL', 'POSTGRES_URL',
  'RESTART_SECRET', 'TELEGRAM_BOT_TOKEN',
  'MAX_SLIPPAGE_PCT', 'MAX_POSITION_HOURS',
  'MAX_SPREAD', 'MAX_TRADES_DAY', 'MAX_CONSEC_LOSS', 'MAX_LOSS_DAY',
];

const SCAN_INTERVAL = 30000;

const validateRequiredEnv = () => {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) throw new Error(`Variable manquante : ${key}`);
  }
};

const createLogger = (symbol) => winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.printf(({ level, message }) =>
    `[${new Date().toISOString()}] [${symbol}] [${level.toUpperCase()}] ${message}`),
  transports: [
    new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' }),
  ],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const createBinanceClient = () => {
  const baseURL = process.env.BINANCE_TESTNET === 'true'
    ? 'https://testnet.binance.vision'
    : 'https://api.binance.com';
  return axios.create({ baseURL });
};

const gracefulShutdown = async (symbol, redis, orderMod, logger) => {
  logger.info(`${symbol} — arrêt propre en cours`);
  try {
    await orderMod.cancelAllOrders(symbol);
    const sym = symbol.toLowerCase();
    await redis.del(`bot:${sym}:position_open`);
    await redis.del(`bot:${sym}:position_open_since`);
    logger.info(`[${symbol}] Ordres annulés — arrêt propre terminé`);
  } catch (err) {
    logger.error(`[${symbol}] Erreur pendant l'arrêt propre: ${err.message}`);
  }
};

const processTradingCycle = async (ctx) => {
  const {
    symbol, redis, pgPool, binanceClient, filters, logger,
    capital, tpBrut, slBrut, atrTpMult, atrSlMult,
  } = ctx;
  const sym = symbol.toLowerCase();

  if (await protection.isGloballyLocked(redis)) {
    await sleep(ctx.globalLockInterval ?? 60000);
    return;
  }
  if (await protection.isPairLocked(symbol, redis)) {
    await sleep(ctx.pairLockInterval ?? 30000);
    return;
  }

  await protection.checkPositionTimeout(symbol, redis, order);

  const sig = await signal.evaluateSignal(symbol, redis, binanceClient, pgPool);
  if (!sig.ok) {
    logger.debug(`[${symbol}] Signal rejeté: ${sig.reason}`);
    await sleep(ctx.scanInterval ?? SCAN_INTERVAL);
    return;
  }

  const price = parseFloat(await redis.get(`bid:${symbol}`));
  const atrData = await atr.getATR(symbol, redis, binanceClient);
  const tp = price + Math.max(tpBrut, atrData.atr * atrTpMult);
  const sl = price - Math.max(slBrut, atrData.atr * atrSlMult);

  const kellyFraction = await computeKellyAuto(pgPool, redis, symbol, tpBrut, slBrut);
  const qty = (capital * kellyFraction) / price;

  logger.info(`[${symbol}] Signal OK — price=${price} tp=${tp.toFixed(2)} sl=${sl.toFixed(2)} kelly=${kellyFraction.toFixed(3)} qty=${qty.toFixed(6)}`);

  await redis.set(`bot:${sym}:position_open`, '1');
  await redis.set(`bot:${sym}:position_open_since`, Date.now().toString());
  await redis.set(`bot:${sym}:position_qty`, qty.toFixed(order.getDecimals(filters.stepSize)));

  const entry = await order.placeEntry(symbol, qty, price, filters, redis);
  if (!entry || entry.simulated) {
    await redis.del(`bot:${sym}:position_open`);
    await redis.del(`bot:${sym}:position_open_since`);
    await sleep(ctx.scanInterval ?? SCAN_INTERVAL);
    return;
  }

  const tradeId = await journal.logTradeOpen(
    pgPool, symbol, entry.fillPrice, entry.quantity, tp, sl, atrData.atr, kellyFraction,
  );
  await journal.logTradeFill(pgPool, tradeId, entry);

  const exitOrder = filters.opoAllowed
    ? await order.placeOPOCO(symbol, entry.quantity, entry.fillPrice, tp, sl, filters)
    : await order.placeOCO(symbol, entry.quantity, entry.fillPrice, tp, sl, filters);

  await redis.setex(
    `tp:${exitOrder.orderListId}`,
    86400,
    tp.toFixed(order.getDecimals(filters.tickSize)),
  );

  const result = await monitor.waitForResult(exitOrder.orderListId, redis);

  await redis.del(`bot:${sym}:position_open`);
  await redis.del(`bot:${sym}:position_open_since`);
  await redis.del(`bot:${sym}:position_qty`);
  await redis.del(`tp:${exitOrder.orderListId}`);

  await journal.logTradeClose(pgPool, redis, symbol, tradeId, {
    exitPrice: result.exitPrice,
    durationMin: Math.round((Date.now() - (entry.timestamp || Date.now())) / 60000),
    pnlBrut: (result.exitPrice - entry.fillPrice) * entry.quantity,
    fees: result.fees,
    pnlNet: result.pnlNet || ((result.exitPrice - entry.fillPrice) * entry.quantity - result.fees),
    result: result.result,
  });

  await redis.incr(`bot:${sym}:trades_day`);

  if (result.result === 'SL') {
    await protection.checkAndLock(symbol, redis, pgPool);
  } else {
    await redis.set(`bot:${sym}:consec_loss`, '0');
  }

  await notifyN8n('/webhook/trade', { symbol, ...result });
};

const run = async (options = {}) => {
  if (process.env.NODE_ENV !== 'test') {
    require('dotenv').config({ path: process.env.ENV_FILE || '.env.btc' });
  }
  validateRequiredEnv();

  const symbol = process.env.SYMBOL;
  const capital = parseFloat(process.env.CAPITAL);
  const tpBrut = parseFloat(process.env.TP_BRUT);
  const slBrut = parseFloat(process.env.SL_BRUT);
  const atrTpMult = parseFloat(process.env.ATR_TP_MULT || '1.5');
  const atrSlMult = parseFloat(process.env.ATR_SL_MULT || '0.8');
  const port = parseInt(process.env.PORT, 10);

  const logger = createLogger(symbol);
  const redis = new Redis(process.env.REDIS_URL);
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const binanceClient = createBinanceClient();

  const shutdown = (sig) => gracefulShutdown(symbol, redis, order, logger)
    .then(() => process.exit(0));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const filters = await order.getExchangeFilters(symbol, binanceClient);
  logger.info(`[${symbol}] opoAllowed=${filters.opoAllowed} tickSize=${filters.tickSize} stepSize=${filters.stepSize}`);

  await monitor.startMonitor(symbol, redis);
  await health.startHealthServer(port, redis, pgPool);

  const redisSub = redis.duplicate();
  redisSub.subscribe(`bot:${symbol.toLowerCase()}:config`);
  redisSub.on('message', (channel, message) => {
    const [key, value] = message.split(':');
    logger.info(`[${symbol}] Config à chaud: ${key}=${value}`);
    if (key === 'MAX_SPREAD') process.env.MAX_SPREAD = value;
    if (key === 'MAX_CONSEC_LOSS') process.env.MAX_CONSEC_LOSS = value;
  });

  const ctx = {
    symbol, redis, pgPool, binanceClient, filters, logger,
    capital, tpBrut, slBrut, atrTpMult, atrSlMult,
    scanInterval: options.scanInterval,
    globalLockInterval: options.globalLockInterval,
    pairLockInterval: options.pairLockInterval,
  };

  if (options.once) {
    await processTradingCycle(ctx);
    await monitor.stopMonitor();
    await health.stopHealthServer();
    await pgPool.end();
    redis.disconnect();
    return;
  }

  while (true) {
    try {
      await processTradingCycle(ctx);
    } catch (err) {
      logger.error(`[${symbol}] Erreur boucle principale: ${err.message}`);
      await sleep(SCAN_INTERVAL);
    }
  }
};

if (require.main === module) {
  run().catch((err) => {
    console.error(`Erreur fatale: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  run,
  gracefulShutdown,
  validateRequiredEnv,
  processTradingCycle,
  createBinanceClient,
  SCAN_INTERVAL,
  REQUIRED_ENV,
};
