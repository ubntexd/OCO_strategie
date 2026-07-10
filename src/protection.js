// src/protection.js — CD §4.12

const winston = require('winston');
const journal = require('./journal');
const { notifyTelegram } = require('./notify');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

const isGloballyLocked = async (redis) => {
  return (await redis.get('bot:global:stop')) === '1';
};

const isPairLocked = async (symbol, redis) => {
  return (await redis.get(`bot:${symbol.toLowerCase()}:daily_loss_locked`)) === '1';
};

const resetDailyLocks = async (symbol, redis) => {
  const sym = symbol.toLowerCase();
  await redis.del(`bot:${sym}:daily_loss_locked`);
  await redis.del(`bot:${sym}:consec_loss`);
  await redis.set(`bot:${sym}:consec_loss`, '0');
};

const checkAndLock = async (symbol, redis, pgPool) => {
  const sym = symbol.toLowerCase();

  const consec = await redis.incr(`bot:${sym}:consec_loss`);
  if (consec >= parseInt(process.env.MAX_CONSEC_LOSS || '3', 10)) {
    await redis.set(`bot:${sym}:daily_loss_locked`, '1');
    logger.warn(`[${symbol}] ${consec} pertes consécutives — paire lockée`);
    await notifyTelegram(`⚠️ [${symbol}] ${consec} pertes consécutives — bot stoppé`);
  }

  const dayPnl = await journal.getDayPnl(pgPool, symbol);
  const MAX_LOSS_DAY = parseFloat(process.env.MAX_LOSS_DAY || '60');
  if (dayPnl <= -MAX_LOSS_DAY) {
    await redis.set(`bot:${sym}:daily_loss_locked`, '1');
    logger.warn(`[${symbol}] Perte jour ${dayPnl.toFixed(2)} USDT — paire lockée`);
    await notifyTelegram(`⚠️ [${symbol}] Perte journalière max atteinte — bot stoppé`);
  }

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  let totalPnl = 0;
  for (const s of symbols) {
    totalPnl += await journal.getDayPnl(pgPool, s);
  }
  if (totalPnl <= -120) {
    await redis.set('bot:global:stop', '1');
    logger.error(`STOP GLOBAL — Perte totale ${totalPnl.toFixed(2)} USDT`);
    await notifyTelegram(`⛔ STOP GLOBAL — Perte totale: ${totalPnl.toFixed(2)} USDT`);
  }
};

const checkPositionTimeout = async (symbol, redis, orderManager) => {
  const openSince = await redis.get(`bot:${symbol.toLowerCase()}:position_open_since`);
  if (!openSince) return;

  const MAX_POSITION_HOURS = parseFloat(process.env.MAX_POSITION_HOURS || '4');
  const hoursOpen = (Date.now() - parseInt(openSince, 10)) / 3600000;

  if (hoursOpen > MAX_POSITION_HOURS) {
    logger.warn(`[${symbol}] Position ouverte depuis ${hoursOpen.toFixed(1)}h — fermeture forcée`);
    const qty = await redis.get(`bot:${symbol.toLowerCase()}:position_qty`);
    await orderManager.placeMarketSell(symbol, parseFloat(qty));
    await journal.logForcedExit(symbol, 'MAX_POSITION_TIME');
    await redis.del(`bot:${symbol.toLowerCase()}:position_open`);
    await redis.del(`bot:${symbol.toLowerCase()}:position_open_since`);
    await redis.del(`bot:${symbol.toLowerCase()}:position_qty`);
  }
};

module.exports = {
  checkAndLock,
  isGloballyLocked,
  isPairLocked,
  checkPositionTimeout,
  resetDailyLocks,
};
