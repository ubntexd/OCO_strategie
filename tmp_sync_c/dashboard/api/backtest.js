const run = (pgPool) => async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', days = 30 } = req.body || {};
    const result = await pgPool.query(
      `SELECT DATE(entry_time) AS day, SUM(pnl_net) AS pnl, COUNT(*) AS trades
       FROM trades
       WHERE symbol = $1 AND dry_run = false
         AND entry_time >= NOW() - ($2::int || ' days')::interval
       GROUP BY DATE(entry_time) ORDER BY day`,
      [symbol, days],
    );
    const rows = result.rows;
    const totalPnl = rows.reduce((s, r) => s + parseFloat(r.pnl || 0), 0);
    const wins = rows.filter((r) => parseFloat(r.pnl) > 0).length;
    res.json({
      symbol,
      days,
      total_pnl: totalPnl,
      win_days: wins,
      loss_days: rows.length - wins,
      daily: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { run };
