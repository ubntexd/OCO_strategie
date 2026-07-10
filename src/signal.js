// src/signal.js — CD §4.9

const winston = require('winston');
const journal = require('./journal');
const atrModule = require('./atr');
const regimeModule = require('./regime');
const correlation = require('./correlation');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

const computeEMA = (values, period) => {
  if (values.length < period) return null;
  const slice = values.slice(0, period).reverse();
  const k = 2 / (period + 1);
  let result = slice[0];
  for (let i = 1; i < slice.length; i += 1) {
    result = slice[i] * k + result * (1 - k);
  }
  return result;
};

const isWithinTradingHours = () => {
  const start = process.env.TRADING_HOURS_START || '08:00';
  const end = process.env.TRADING_HOURS_END || '22:00';
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return utcMins >= startMins && utcMins <= endMins;
};

const getRelativeVolume = async (symbol, redis) => {
  const current = parseFloat(await redis.get(`volume_current:${symbol}`) || '0');
  const avg = parseFloat(await redis.get(`volume_avg:${symbol}`) || '0');
  if (!avg) return 1;
  return current / avg;
};

const reject = async (pgPool, symbol, reason) => {
  logger.warn(`[${symbol}] Signal rejeté: ${reason}`);
  await journal.logEvent(pgPool, symbol, 'SIGNAL_REJECTED', { reason });
  return { ok: false, reason };
};

const evaluateSignal = async (symbol, redis, binanceClient, pgPool) => {
  const MAX_SPREAD = parseFloat(process.env.MAX_SPREAD || '1.5');
  const MAX_TRADES_DAY = parseInt(process.env.MAX_TRADES_DAY || '6', 10);
  const MAX_CONSEC_LOSS = parseInt(process.env.MAX_CONSEC_LOSS || '3', 10);
  const MAX_LOSS_DAY = parseFloat(process.env.MAX_LOSS_DAY || '60');
  const sym = symbol.toLowerCase();

  if (!isWithinTradingHours()) return reject(pgPool, symbol, 'TRADING_HOURS');

  if (await redis.get('bot:global:stop') === '1') {
    return reject(pgPool, symbol, 'GLOBAL_STOP');
  }
  if (await redis.get(`bot:${sym}:daily_loss_locked`) === '1') {
    return reject(pgPool, symbol, 'DAILY_LOSS_LOCKED');
  }

  const consecLoss = parseInt(await redis.get(`bot:${sym}:consec_loss`) || '0', 10);
  if (consecLoss >= MAX_CONSEC_LOSS) return reject(pgPool, symbol, 'MAX_CONSEC_LOSS');

  const tradesDay = parseInt(await redis.get(`bot:${sym}:trades_day`) || '0', 10);
  if (tradesDay >= MAX_TRADES_DAY) return reject(pgPool, symbol, 'MAX_TRADES_DAY');

  const dayPnl = await journal.getDayPnl(pgPool, symbol);
  if (dayPnl <= -MAX_LOSS_DAY) return reject(pgPool, symbol, 'MAX_LOSS_DAY');

  const bid = parseFloat(await redis.get(`bid:${symbol}`) || '0');
  const ask = parseFloat(await redis.get(`ask:${symbol}`) || '0');
  const spread = ask - bid;
  if (spread > MAX_SPREAD) return reject(pgPool, symbol, 'SPREAD_TOO_HIGH');

  const relVol = await getRelativeVolume(symbol, redis);
  if (relVol < 0.8) return reject(pgPool, symbol, 'VOLUME_TOO_LOW');
  if (relVol > 4.0) return reject(pgPool, symbol, 'VOLUME_SPIKE');

  const { atr } = await atrModule.getATR(symbol, redis, binanceClient);
  const atrAvg = parseFloat(await redis.get(`atr_avg:${symbol}`) || '0');
  if (atrAvg > 0) {
    if (atr < atrAvg * 0.5) return reject(pgPool, symbol, 'ATR_TOO_LOW');
    if (atr > atrAvg * 3.0) return reject(pgPool, symbol, 'ATR_TOO_HIGH');
  }

  if (await redis.get(`liq:${symbol}`) === '1') {
    return reject(pgPool, symbol, 'LIQUIDATION_CASCADE');
  }

  const regime = await regimeModule.getRegime(symbol, redis, binanceClient);
  if (regime === 'TREND_DOWN') return reject(pgPool, symbol, 'TREND_DOWN');
  if (regime === 'VOLATILE' && symbol === 'SOLUSDT') {
    return reject(pgPool, symbol, 'VOLATILE_SOL');
  }

  if (await correlation.shouldBlockOnCorrelation(symbol, redis)) {
    return reject(pgPool, symbol, 'CORRELATION_BLOCK');
  }

  const closes = (await redis.lrange(`closes:${symbol}`, 0, 19)).map(Number);
  if (closes.length >= 20) {
    const ema5 = computeEMA(closes, 5);
    const ema20 = computeEMA(closes, 20);
    if (ema5 != null && ema20 != null && ema5 < ema20 * 0.998) {
      return reject(pgPool, symbol, 'MOMENTUM_BEARISH');
    }
  }

  return { ok: true, reason: null };
};

module.exports = {
  evaluateSignal,
  isWithinTradingHours,
  getRelativeVolume,
  computeEMA,
};
