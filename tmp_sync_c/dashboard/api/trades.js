const list = (pgPool) => async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const result = await pgPool.query(
      `SELECT id, symbol, entry_time, exit_time, entry_price, exit_price, qty, pnl_net, result, dry_run
       FROM trades ORDER BY entry_time DESC LIMIT $1`,
      [limit],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { list };
