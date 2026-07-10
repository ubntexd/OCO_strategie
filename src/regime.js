// src/regime.js — CD §4.7

const winston = require('winston');
const { notifyTelegram } = require('./notify');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

const ema = (values, period) => {
  if (values.length < period) return null;
  const slice = values.slice(0, period).reverse();
  const k = 2 / (period + 1);
  let result = slice[0];
  for (let i = 1; i < slice.length; i += 1) {
    result = slice[i] * k + result * (1 - k);
  }
  return result;
};

const getRegime = async (symbol, redis, axiosInstance) => {
  const closesRaw = await redis.lrange(`closes:${symbol}`, 0, 19);
  if (closesRaw.length < 20) return 'RANGE';

  const closes = closesRaw.map(Number);
  const ema5 = ema(closes, 5);
  const ema20 = ema(closes, 20);
  if (ema5 == null || ema20 == null) return 'RANGE';

  const atrKey = `atr:${symbol}`;
  let currentAtr = parseFloat(await redis.get(atrKey) || '0');
  if (!currentAtr && axiosInstance) {
    const atrMod = require('./atr');
    const { atr } = await atrMod.getATR(symbol, redis, axiosInstance);
    currentAtr = atr;
  }

  const atrAvgKey = `atr_avg_20d:${symbol}`;
  const atrAvg = parseFloat(await redis.get(atrAvgKey) || '0');
  if (atrAvg > 0 && currentAtr > atrAvg * 1.8) return 'VOLATILE';
  if (ema5 > ema20 * 1.002) return 'TREND_UP';
  if (ema5 < ema20 * 0.998) return 'TREND_DOWN';
  return 'RANGE';
};

const checkTrendDown = async (symbol, regime, redis) => {
  const key = `bot:${symbol.toLowerCase()}:trend_down_since`;

  if (regime !== 'TREND_DOWN') {
    await redis.del(key);
    await redis.del(`bot:${symbol.toLowerCase()}:trend_down_alert`);
    return { alert48h: false, alert96h: false };
  }

  const since = await redis.get(key);
  if (!since) {
    await redis.set(key, Date.now().toString());
    return { alert48h: false, alert96h: false };
  }

  const hoursDown = (Date.now() - parseInt(since, 10)) / 3600000;
  const alert48h = hoursDown >= 48;
  const alert96h = hoursDown >= 96;

  if (alert48h) {
    await notifyTelegram(
      `⚠️ [${symbol}] TREND_DOWN depuis ${Math.round(hoursDown)}h — vérification recommandée`,
    );
  }
  if (alert96h) {
    await redis.set(`bot:${symbol.toLowerCase()}:trend_down_alert`, '1');
  }

  return { alert48h, alert96h };
};

module.exports = { getRegime, checkTrendDown, ema };
