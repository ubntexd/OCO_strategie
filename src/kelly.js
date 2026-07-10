// src/kelly.js — CD §4.3, P2-11

/**
 * Formule Kelly pure — synchrone, aucune dépendance externe.
 * @param {number} winRate - Taux de gains [0, 1]
 * @param {number} ratioRR - Ratio Risk/Reward (TP_BRUT / SL_BRUT)
 * @returns {number} Fraction Kelly clampée entre 5% et 20%
 */
const computeKellyFormula = (winRate, ratioRR) => {
  const f = (winRate * ratioRR - (1 - winRate)) / ratioRR;
  const halfKelly = f * 0.5;
  return Math.max(0.05, Math.min(halfKelly, 0.20));
};

/**
 * Calcul Kelly automatique — async, lit Postgres et Redis.
 * @param {import('pg').Pool} pgPool
 * @param {{ get: (key: string) => Promise<string|null> }} redis
 * @param {string} symbol
 * @param {number} tpBrut
 * @param {number} slBrut
 * @returns {Promise<number>}
 */
const computeKellyAuto = async (pgPool, redis, symbol, tpBrut, slBrut) => {
  const KELLY_MIN_TRADES = 100;
  const total = parseInt(await redis.get('bot:global:total_trades') || '0', 10);

  if (total < KELLY_MIN_TRADES) {
    return 0.10;
  }

  const result = await pgPool.query(
    `SELECT pnl_net FROM trades
     WHERE symbol = $1 AND dry_run = false
     ORDER BY created_at DESC LIMIT 100`,
    [symbol],
  );

  const wins = result.rows.filter((t) => parseFloat(t.pnl_net) > 0).length;
  const winRate = wins / 100;
  const ratioRR = tpBrut / slBrut;
  return computeKellyFormula(winRate, ratioRR);
};

module.exports = { computeKellyFormula, computeKellyAuto };
