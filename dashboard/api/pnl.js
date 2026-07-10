const today = (pgPool) => async (_req, res) => {
  try {
    const result = await pgPool.query(
      `SELECT symbol, COALESCE(SUM(pnl_net), 0) AS pnl, COUNT(*) AS trades
       FROM trades
       WHERE dry_run = false AND entry_time >= CURRENT_DATE
         AND result IN ('TP', 'SL', 'FORCED_EXIT', 'SLIPPAGE_ABORT')
       GROUP BY symbol`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { today };
