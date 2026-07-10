const current = (redis) => async (_req, res) => {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const out = {};
    for (const symbol of symbols) {
      const pricesA = await redis.lrange(`closes:${symbol}`, 0, 19);
      const pricesB = await redis.lrange('closes:ETHUSDT', 0, 19);
      if (pricesA.length < 5) {
        out[symbol] = null;
        continue;
      }
      const corr = require('../../src/correlation');
      const other = symbol === 'BTCUSDT' ? 'ETHUSDT' : 'BTCUSDT';
      out[symbol] = await corr.getPairCorrelation(symbol, other, Math.min(20, pricesA.length), redis);
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { current };
