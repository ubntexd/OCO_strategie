// src/atr.js — CD §4.6

const ATR_PERIOD = 14;
const CACHE_TTL_SEC = 300;
const CACHE_KEY_PREFIX = 'atr:';

const parseKlines = (data) => {
  return data.map((k) => ({
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
  }));
};

const computeATR = (candles) => {
  const trs = [];
  for (let i = 1; i < candles.length; i += 1) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    trs.push(tr);
  }
  const slice = trs.slice(-ATR_PERIOD);
  if (slice.length === 0) return 0;
  return slice.reduce((s, v) => s + v, 0) / slice.length;
};

const getATR = async (symbol, redis, axiosInstance) => {
  const cacheKey = `${CACHE_KEY_PREFIX}${symbol}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return { atr: parseFloat(cached), cached: true };
  }

  const { data } = await axiosInstance.get('/api/v3/klines', {
    params: { symbol, interval: '5m', limit: 15 },
  });

  const candles = parseKlines(data);
  const atr = computeATR(candles);
  await redis.setex(cacheKey, CACHE_TTL_SEC, atr.toString());
  return { atr, cached: false };
};

module.exports = { getATR, computeATR, parseKlines };
