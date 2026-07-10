// src/correlation.js — CD §4.8

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

const CORRELATION_BLOCK_THRESHOLD = parseFloat(
  process.env.CORRELATION_THRESHOLD || '0.85',
);

const PAIR_CORRELATIONS = {
  BTCUSDT: ['ETHUSDT'],
  ETHUSDT: ['BTCUSDT', 'SOLUSDT'],
  SOLUSDT: ['ETHUSDT'],
};

const getPairCorrelation = async (symbolA, symbolB, n = 20, redis) => {
  const pricesA = await redis.lrange(`closes:${symbolA}`, 0, n - 1);
  const pricesB = await redis.lrange(`closes:${symbolB}`, 0, n - 1);
  if (pricesA.length < n || pricesB.length < n) return null;

  const a = pricesA.map(Number);
  const b = pricesB.map(Number);
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;
  const num = a.reduce((s, x, i) => s + (x - meanA) * (b[i] - meanB), 0);
  const denA = Math.sqrt(a.reduce((s, x) => s + (x - meanA) ** 2, 0));
  const denB = Math.sqrt(b.reduce((s, x) => s + (x - meanB) ** 2, 0));

  if (denA === 0 || denB === 0) return null;
  return num / (denA * denB);
};

const shouldBlockOnCorrelation = async (symbol, redis) => {
  for (const other of PAIR_CORRELATIONS[symbol] || []) {
    const corr = await getPairCorrelation(symbol, other, 20, redis);
    if (corr === null) continue;
    if (corr > CORRELATION_BLOCK_THRESHOLD) {
      const otherOpen = await redis.get(`bot:${other.toLowerCase()}:position_open`);
      if (otherOpen === '1') {
        logger.warn(
          `[${symbol}] Corrélation ${symbol}/${other}=${corr.toFixed(2)} > ${CORRELATION_BLOCK_THRESHOLD} — bloqué`,
        );
        return true;
      }
    }
  }
  return false;
};

module.exports = { getPairCorrelation, shouldBlockOnCorrelation, PAIR_CORRELATIONS };
