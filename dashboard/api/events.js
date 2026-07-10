const list = (pgPool) => async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const result = await pgPool.query(
      `SELECT id, symbol, type, payload, created_at
       FROM events ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { list };
