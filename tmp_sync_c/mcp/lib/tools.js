const { validateSelectOnly, validateConfigParam } = require('./sqlGuard');

const INTERVAL_MAP = {
  today: '1 day',
  week: '7 days',
  month: '30 days',
};

async function getPnl(pgPool, { symbol, period = 'today' }) {
  const interval = INTERVAL_MAP[period] || INTERVAL_MAP.today;
  const params = [];
  let symbolClause = '';
  if (symbol) {
    params.push(symbol);
    symbolClause = `AND symbol = $${params.length}`;
  }
  const result = await pgPool.query(
    `SELECT symbol,
            SUM(pnl_net) AS pnl,
            COUNT(*) AS trades,
            SUM(CASE WHEN result='TP' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*),0) AS wr,
            SUM(CASE WHEN pnl_net>0 THEN pnl_net ELSE 0 END) /
              NULLIF(ABS(SUM(CASE WHEN pnl_net<0 THEN pnl_net ELSE 0 END)),0) AS profit_factor
     FROM trades
     WHERE dry_run = false
       AND entry_time >= NOW() - INTERVAL '${interval}'
       ${symbolClause}
     GROUP BY symbol`,
    params,
  );
  return result.rows;
}

async function runQuery(pgPool, sql) {
  const check = validateSelectOnly(sql);
  if (!check.ok) return { error: check.error };
  const result = await pgPool.query(check.sql);
  await pgPool.query(
    'INSERT INTO mcp_actions (tool, params, result) VALUES ($1,$2,$3)',
    ['run_query', { sql }, { rows: result.rows.length }],
  );
  return { rows: result.rows };
}

async function setConfig(redis, pgPool, { symbol, param, value }) {
  const check = validateConfigParam(param);
  if (!check.ok) return { error: check.error };
  await redis.publish(`bot:${symbol.toLowerCase()}:config`, `${param}:${value}`);
  await pgPool.query(
    'INSERT INTO mcp_actions (tool, params) VALUES ($1,$2)',
    ['set_config', { symbol, param, value }],
  );
  return { message: `Config ${param}=${value} envoyée à ${symbol}` };
}

module.exports = { getPnl, runQuery, setConfig, INTERVAL_MAP };
