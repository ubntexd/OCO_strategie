const get = (redis, pgPool) => async (_req, res) => {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const pairs = [];
    for (const symbol of symbols) {
      const sym = symbol.toLowerCase();
      pairs.push({
        symbol,
        position_open: await redis.get(`bot:${sym}:position_open`) === '1',
        consec_loss: parseInt(await redis.get(`bot:${sym}:consec_loss`) || '0', 10),
        trades_day: parseInt(await redis.get(`bot:${sym}:trades_day`) || '0', 10),
        global_stop: await redis.get('bot:global:stop') === '1',
      });
    }
    const pnl = await pgPool.query(
      `SELECT COALESCE(SUM(pnl_net), 0) AS total FROM trades
       WHERE dry_run = false AND entry_time >= CURRENT_DATE`,
    );
    res.json({ pairs, pnl_day: parseFloat(pnl.rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { get };
