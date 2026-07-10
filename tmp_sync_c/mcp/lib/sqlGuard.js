/**
 * Garde SQL pour run_query — CD §6.3 P1-7, L14
 */
const FORBIDDEN = ['drop', 'delete', 'truncate', 'update', 'insert', 'alter', 'create'];

function validateSelectOnly(sql) {
  const cleaned = sql.trim().toLowerCase();
  if (!cleaned.startsWith('select')) {
    return { ok: false, error: 'Erreur: SELECT uniquement autorisé' };
  }

  const stripped = cleaned.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
  const parts = stripped.split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return { ok: false, error: 'Erreur: un seul statement autorisé' };
  }

  if (FORBIDDEN.some((kw) => stripped.includes(kw))) {
    return { ok: false, error: 'Erreur: opération non autorisée' };
  }

  return { ok: true, sql };
}

const ALLOWED_PARAMS = ['MAX_SPREAD', 'MAX_CONSEC_LOSS', 'TP_BRUT', 'SL_BRUT', 'ATR_TP_MULT'];

function validateConfigParam(param) {
  if (!ALLOWED_PARAMS.includes(param)) {
    return { ok: false, error: `Paramètre non autorisé: ${param}` };
  }
  return { ok: true };
}

module.exports = { validateSelectOnly, validateConfigParam, ALLOWED_PARAMS, FORBIDDEN };
