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
    const pnls = rows.map((r) => parseFloat(r.pnl || 0));
    const totalPnl = pnls.reduce((s, p) => s + p, 0);
    const wins = pnls.filter((p) => p > 0).length;
    const TRADING_DAYS = 252;
    const mean = pnls.length ? totalPnl / pnls.length : 0;
    const variance = pnls.length > 1
      ? pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / (pnls.length - 1)
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(TRADING_DAYS) : 0;
    const downside = pnls.filter((p) => p < 0);
    const downsideVar = downside.length > 1
      ? downside.reduce((s, p) => s + p ** 2, 0) / downside.length
      : 0;
    const downsideStd = Math.sqrt(downsideVar);
    const sortino = downsideStd > 0 ? (mean / downsideStd) * Math.sqrt(TRADING_DAYS) : 0;
    const grossWin = pnls.filter((p) => p > 0).reduce((s, p) => s + p, 0);
    const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((s, p) => s + p, 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? grossWin : 0;
    res.json({
      symbol,
      days,
      total_pnl: totalPnl,
      win_days: wins,
      loss_days: rows.length - wins,
      sharpe: parseFloat(sharpe.toFixed(4)),
      sortino: parseFloat(sortino.toFixed(4)),
      profit_factor: parseFloat(profitFactor.toFixed(4)),
      daily: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { run };
