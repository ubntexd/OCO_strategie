'use strict';
/* ROHAN BotTrader Dashboard v2.0 — JS principal */

// ── Auth ──────────────────────────────────────────────────────────────────────
let AUTH = '';
(function initAuth() {
  const stored = sessionStorage.getItem('rh_auth');
  if (stored) { AUTH = stored; return; }
  const pw = window.prompt('Mot de passe dashboard :', '') || 'changeme';
  AUTH = 'Basic ' + btoa('admin:' + pw);
  sessionStorage.setItem('rh_auth', AUTH);
})();

// ── API helper ────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    sessionStorage.removeItem('rh_auth');
    AUTH = '';
    location.reload();
    return;
  }
  if (!res.ok) throw new Error(res.status + ' — ' + path);
  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.getElementById('toast-wrap').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const panel   = document.getElementById('panel');
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const fmt2 = (n) => (n == null || isNaN(n) ? '—' : parseFloat(n).toFixed(2));
const fmtPct = (n) => (n == null ? '—' : (parseFloat(n) * 100).toFixed(2) + '%');
const fmtDur = (s) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m ? m + 'm ' + sec + 's' : sec + 's';
};
const fmtDt = (d) => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const pnlClass = (v) => v > 0 ? 'td-pos positive' : v < 0 ? 'td-neg negative' : '';
const resultBadge = (r) => {
  const map = { TP: 'badge-green', SL: 'badge-red', FORCED_EXIT: 'badge-yellow', SLIPPAGE_ABORT: 'badge-purple' };
  return `<span class="badge ${map[r] || 'badge-grey'}">${r || '—'}</span>`;
};

// ── Chart registry (pour destroy avant recréation) ────────────────────────────
const CHARTS = {};
function destroyChart(id) { if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; } }

function makeChart(id, config) {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  CHARTS[id] = new Chart(ctx, config);
  return CHARTS[id];
}

const CHART_DEFAULTS = {
  color: '#cdd9e5',
  plugins: { legend: { labels: { color: '#8b9eb0', font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#556070', font: { size: 10 } }, grid: { color: '#1e2d3d' } },
    y: { ticks: { color: '#556070', font: { size: 10 } }, grid: { color: '#1e2d3d' } },
  },
};

// ── WS temps réel ─────────────────────────────────────────────────────────────
let lastWsData = null;
const wsDot  = document.getElementById('ws-dot');
const liveTs = document.getElementById('live-ts');

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
let ws;
function connectWs() {
  ws = new WebSocket(proto + '://' + location.host);
  ws.onopen = () => { wsDot.className = 'live'; };
  ws.onclose = () => { wsDot.className = ''; setTimeout(connectWs, 3000); };
  ws.onerror = () => { wsDot.className = ''; };
  ws.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data);
      lastWsData = d;
      liveTs.textContent = new Date(d.ts).toLocaleTimeString('fr-FR');
      updateHeader(d);
      const active = $('.tab-btn.active');
      if (active && active.dataset.tab === 'overview') renderOverviewLive(d);
      if (active && active.dataset.tab === 'status') updateStatusLive(d);
    } catch (_) {}
  };
}
connectWs();

function updateHeader(d) {
  const fmt = (v) => v ? parseFloat(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '—';
  document.getElementById('h-btc').textContent = fmt(d.bid_btc);
  document.getElementById('h-eth').textContent = fmt(d.bid_eth);
  document.getElementById('h-sol').textContent = fmt(d.bid_sol);
  const pnl = d.pnl_day ?? 0;
  const hPnl = document.getElementById('h-pnl');
  hPnl.textContent = (pnl >= 0 ? '+' : '') + fmt2(pnl) + ' $';
  hPnl.className = 'val ' + (pnl >= 0 ? 'positive' : 'negative');
}

// ── Tab router ────────────────────────────────────────────────────────────────
document.getElementById('nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  $$('.tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  loadTab(btn.dataset.tab);
});

async function loadTab(tab) {
  panel.innerHTML = '<div class="spinner"></div>';
  try {
    if (tab === 'overview')     await renderOverview();
    else if (tab === 'trades')  await renderTrades();
    else if (tab === 'pnl')     await renderPnl();
    else if (tab === 'status')  await renderStatus();
    else if (tab === 'market')  await renderMarket();
    else if (tab === 'correlation') await renderCorrelation();
    else if (tab === 'backtest') await renderBacktest();
    else if (tab === 'events')  await renderEvents();
    else if (tab === 'config')  await renderConfig();
    else if (tab === 'health')  await renderHealth();
  } catch (e) {
    panel.innerHTML = `<div class="card"><p class="negative">Erreur : ${e.message}</p></div>`;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═════════════════════════════════════════════════════════════════════════════
async function renderOverview() {
  const [status, pnlHist] = await Promise.all([
    api('/api/status'),
    api('/api/pnl/history?days=7'),
  ]);
  const d = lastWsData || {};
  const pnlDay = d.pnl_day ?? status.pnl_day ?? 0;
  const TARGET = 80;
  const pct = Math.min(100, Math.max(0, (pnlDay / TARGET) * 100));
  const barClass = pct >= 100 ? '' : pct >= 50 ? 'warn' : 'danger';

  // Equity 7j
  const labels7 = [], data7 = [];
  let cum = 0;
  const grouped = {};
  (pnlHist || []).forEach((r) => {
    if (!grouped[r.day]) grouped[r.day] = 0;
    grouped[r.day] += parseFloat(r.pnl || 0);
  });
  Object.keys(grouped).sort().forEach((day) => {
    cum += grouped[day];
    labels7.push(day.slice(5));
    data7.push(parseFloat(cum.toFixed(2)));
  });

  panel.innerHTML = `
    <!-- KPIs ligne 1 -->
    <div class="grid-4" style="margin-bottom:.75rem">
      <div class="kpi">
        <span class="kpi-label">PnL Jour</span>
        <span class="kpi-value ${pnlDay >= 0 ? 'pos' : 'neg'}" id="ov-pnl">${(pnlDay >= 0 ? '+' : '') + fmt2(pnlDay)} $</span>
        <div class="progress-track"><div class="progress-bar ${barClass}" id="ov-bar" style="width:${pct}%"></div></div>
        <span class="kpi-sub" id="ov-pct">${pct.toFixed(0)}% objectif 80 USDT</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">BTC / USD</span>
        <span class="kpi-value acc" id="ov-btc">${d.bid_btc ? parseFloat(d.bid_btc).toLocaleString('fr-FR') : '—'}</span>
        <span class="kpi-sub">Binance Spot</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Positions ouvertes</span>
        <span class="kpi-value neu" id="ov-pos">${(status.pairs || []).filter((p) => p.position_open).length} / 3</span>
        <span class="kpi-sub">BTC · ETH · SOL</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Stop global</span>
        <span class="kpi-value ${d.global_stop || status.pairs?.[0]?.global_stop ? 'neg' : 'pos'}" id="ov-stop">
          ${d.global_stop || status.pairs?.[0]?.global_stop ? '🛑 ACTIF' : '✅ OK'}
        </span>
        <span class="kpi-sub">Limite journalière</span>
      </div>
    </div>

    <!-- Bots strip -->
    <div class="bot-strip" id="ov-bots" style="margin-bottom:.75rem">
      ${(status.pairs || []).map((p) => `
        <div class="bot-card ${p.position_open ? 'active' : ''}">
          <div class="bot-name">${p.symbol}</div>
          <div class="bot-row"><span class="k">Position</span><span class="v">${p.position_open ? '<span class="positive">● OPEN</span>' : '<span class="muted">— IDLE</span>'}</span></div>
          <div class="bot-row"><span class="k">Trades/j</span><span class="v">${p.trades_day}</span></div>
          <div class="bot-row"><span class="k">Consec loss</span><span class="v ${p.consec_loss >= 3 ? 'negative' : ''}">${p.consec_loss}</span></div>
          <div class="bot-row"><span class="k">Régime</span><span class="v">${p.regime || '—'}</span></div>
        </div>`).join('')}
    </div>

    <!-- Equity 7j -->
    <div class="card">
      <div class="card-header"><span class="card-title">Equity cumulée — 7 jours</span></div>
      <div class="chart-wrap" style="height:180px">
        <canvas id="chart-equity7"></canvas>
      </div>
    </div>`;

  makeChart('chart-equity7', {
    type: 'line',
    data: {
      labels: labels7,
      datasets: [{
        label: 'Equity (USDT)',
        data: data7,
        borderColor: '#2f86eb',
        backgroundColor: 'rgba(47,134,235,.08)',
        fill: true,
        tension: .35,
        pointRadius: 3,
        pointBackgroundColor: '#2f86eb',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#556070', font: { size: 10 } }, grid: { color: '#1e2d3d' } },
        y: { ticks: { color: '#556070', font: { size: 10 } }, grid: { color: '#1e2d3d' } },
      },
    },
  });
}

function renderOverviewLive(d) {
  const el = (id) => document.getElementById(id);
  const pnlDay = d.pnl_day ?? 0;
  const TARGET = 80;
  const pct = Math.min(100, Math.max(0, (pnlDay / TARGET) * 100));
  if (el('ov-pnl')) {
    el('ov-pnl').textContent = (pnlDay >= 0 ? '+' : '') + fmt2(pnlDay) + ' $';
    el('ov-pnl').className = 'kpi-value ' + (pnlDay >= 0 ? 'pos' : 'neg');
  }
  if (el('ov-bar')) { el('ov-bar').style.width = pct + '%'; }
  if (el('ov-pct')) { el('ov-pct').textContent = pct.toFixed(0) + '% objectif 80 USDT'; }
  if (el('ov-btc') && d.bid_btc) el('ov-btc').textContent = parseFloat(d.bid_btc).toLocaleString('fr-FR');
  if (el('ov-stop')) {
    el('ov-stop').textContent = d.global_stop ? '🛑 ACTIF' : '✅ OK';
    el('ov-stop').className = 'kpi-value ' + (d.global_stop ? 'neg' : 'pos');
  }
  if (el('ov-pos') && d.pairs) {
    const open = Object.values(d.pairs).filter((p) => p.position_open).length;
    el('ov-pos').textContent = open + ' / 3';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TRADES — historique + filtres avancés + analyse
// ═════════════════════════════════════════════════════════════════════════════
let tradeState = {
  symbol: 'ALL', result: 'ALL', from: '', to: '',
  pnl_min: '', pnl_max: '', dry_run: 'false',
  sort_col: 'entry_time', sort_dir: 'DESC', rows: [], stats: null,
};

async function renderTrades() {
  panel.innerHTML = `
    <div class="filters">
      <label><span class="lbl">Symbole</span>
        <select id="f-sym">
          <option value="ALL">Tous</option>
          <option value="BTCUSDT">BTC</option>
          <option value="ETHUSDT">ETH</option>
          <option value="SOLUSDT">SOL</option>
        </select></label>
      <label><span class="lbl">Résultat</span>
        <select id="f-res">
          <option value="ALL">Tous</option>
          <option value="TP">TP</option>
          <option value="SL">SL</option>
          <option value="FORCED_EXIT">Forced Exit</option>
          <option value="SLIPPAGE_ABORT">Slippage Abort</option>
        </select></label>
      <label><span class="lbl">De</span><input type="date" id="f-from" /></label>
      <label><span class="lbl">À</span><input type="date" id="f-to" /></label>
      <label><span class="lbl">PnL min</span><input type="number" id="f-pmin" placeholder="-999" style="width:80px" /></label>
      <label><span class="lbl">PnL max</span><input type="number" id="f-pmax" placeholder="999" style="width:80px" /></label>
      <label><span class="lbl">Dry run</span>
        <select id="f-dry">
          <option value="false">Prod</option>
          <option value="true">Dry run</option>
          <option value="">Tous</option>
        </select></label>
      <button class="btn" id="f-apply">Appliquer</button>
      <button class="btn btn-ghost" id="f-reset">Reset</button>
      <button class="btn btn-ghost btn-sm" id="f-csv" style="margin-left:auto">⬇ CSV</button>
    </div>

    <!-- Stats analyse -->
    <div class="grid-4" id="trade-stats" style="margin-bottom:.75rem"></div>

    <!-- Equity filtrée -->
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-header">
        <span class="card-title">Equity cumulée (filtres actifs)</span>
      </div>
      <div class="chart-wrap" style="height:160px"><canvas id="chart-trade-equity"></canvas></div>
    </div>

    <!-- Table -->
    <div class="card">
      <div class="card-header">
        <span class="card-title" id="trade-count">—</span>
        <span id="trade-pagination" class="muted"></span>
      </div>
      <div class="tbl-wrap">
        <table id="trade-table">
          <thead>
            <tr>
              <th data-col="id">#</th>
              <th data-col="symbol">Symbole</th>
              <th data-col="entry_time">Entrée</th>
              <th data-col="exit_time">Sortie</th>
              <th data-col="entry_price">Prix E.</th>
              <th data-col="exit_price">Prix S.</th>
              <th data-col="qty">Qty</th>
              <th data-col="pnl_net">PnL</th>
              <th data-col="result">Résultat</th>
              <th>Durée</th>
              <th>Kelly</th>
            </tr>
          </thead>
          <tbody id="trade-tbody"><tr><td colspan="11" class="muted" style="padding:1rem">Chargement…</td></tr></tbody>
        </table>
      </div>
    </div>`;

  // Tri au clic en-tête
  $$('#trade-table thead th[data-col]').forEach((th) => {
    th.addEventListener('click', (e) => {
      const col = th.dataset.col;
      if (tradeState.sort_col === col) {
        tradeState.sort_dir = tradeState.sort_dir === 'DESC' ? 'ASC' : 'DESC';
      } else {
        tradeState.sort_col = col;
        tradeState.sort_dir = 'DESC';
      }
      fetchTrades();
    });
  });

  // Filtres
  document.getElementById('f-apply').addEventListener('click', () => {
    tradeState.symbol  = document.getElementById('f-sym').value;
    tradeState.result  = document.getElementById('f-res').value;
    tradeState.from    = document.getElementById('f-from').value;
    tradeState.to      = document.getElementById('f-to').value;
    tradeState.pnl_min = document.getElementById('f-pmin').value;
    tradeState.pnl_max = document.getElementById('f-pmax').value;
    tradeState.dry_run = document.getElementById('f-dry').value;
    fetchTrades();
  });

  document.getElementById('f-reset').addEventListener('click', () => {
    tradeState = { ...tradeState, symbol: 'ALL', result: 'ALL', from: '', to: '', pnl_min: '', pnl_max: '', dry_run: 'false' };
    ['f-sym','f-res','f-from','f-to','f-pmin','f-pmax'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = el.tagName === 'SELECT' ? el.options[0].value : ''; });
    document.getElementById('f-dry').value = 'false';
    fetchTrades();
  });

  document.getElementById('f-csv').addEventListener('click', exportCsv);

  await fetchTrades();
}

async function fetchTrades() {
  const p = new URLSearchParams();
  if (tradeState.symbol !== 'ALL') p.set('symbol', tradeState.symbol);
  if (tradeState.result !== 'ALL') p.set('result', tradeState.result);
  if (tradeState.from) p.set('from', tradeState.from);
  if (tradeState.to)   p.set('to', tradeState.to);
  if (tradeState.pnl_min !== '') p.set('pnl_min', tradeState.pnl_min);
  if (tradeState.pnl_max !== '') p.set('pnl_max', tradeState.pnl_max);
  if (tradeState.dry_run !== '') p.set('dry_run', tradeState.dry_run);
  p.set('sort_col', tradeState.sort_col);
  p.set('sort_dir', tradeState.sort_dir);
  p.set('limit', '200');

  const data = await api('/api/trades/filtered?' + p.toString());
  tradeState.rows  = data.rows || [];
  tradeState.stats = data.stats || {};
  renderTradeStats(tradeState.stats);
  renderTradeTable(tradeState.rows);
  renderTradeEquity(tradeState.rows);
  updateSortHeaders();
}

function renderTradeStats(s) {
  const total = parseInt(s.total || 0);
  const wins  = parseInt(s.wins || 0);
  const wr    = total ? ((wins / total) * 100).toFixed(1) : '—';
  const avg   = parseFloat(s.avg_pnl || 0);
  const totalPnl = parseFloat(s.total_pnl || 0);
  document.getElementById('trade-stats').innerHTML = `
    <div class="kpi"><span class="kpi-label">Trades filtrés</span><span class="kpi-value neu">${total}</span></div>
    <div class="kpi"><span class="kpi-label">Win Rate</span><span class="kpi-value ${parseFloat(wr) >= 50 ? 'pos' : 'neg'}">${wr}%</span></div>
    <div class="kpi"><span class="kpi-label">PnL total</span><span class="kpi-value ${totalPnl >= 0 ? 'pos' : 'neg'}">${fmt2(totalPnl)} $</span></div>
    <div class="kpi"><span class="kpi-label">PnL moyen/trade</span><span class="kpi-value ${avg >= 0 ? 'pos' : 'neg'}">${fmt2(avg)} $</span>
      <span class="kpi-sub">Best ${fmt2(s.best)} $ · Worst ${fmt2(s.worst)} $</span>
    </div>`;
  const tc = document.getElementById('trade-count');
  if (tc) tc.textContent = total + ' trades · durée moy. ' + fmtDur(parseFloat(s.avg_duration_s || 0));
}

function renderTradeTable(rows) {
  const tbody = document.getElementById('trade-tbody');
  if (!tbody) return;
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="11" class="muted" style="padding:1rem">Aucun résultat.</td></tr>'; return; }
  tbody.innerHTML = rows.map((r) => {
    const pnl = parseFloat(r.pnl_net || 0);
    return `<tr>
      <td class="mono">${r.id}</td>
      <td class="td-sym">${r.symbol}</td>
      <td>${fmtDt(r.entry_time)}</td>
      <td>${fmtDt(r.exit_time)}</td>
      <td class="mono">${fmt2(r.entry_price)}</td>
      <td class="mono">${fmt2(r.exit_price)}</td>
      <td class="mono">${parseFloat(r.qty || 0).toFixed(4)}</td>
      <td class="mono ${pnlClass(pnl)}">${pnl >= 0 ? '+' : ''}${fmt2(pnl)}</td>
      <td>${resultBadge(r.result)}</td>
      <td class="mono">${fmtDur(parseFloat(r.duration_s || 0))}</td>
      <td class="mono">${r.kelly_fraction ? (parseFloat(r.kelly_fraction) * 100).toFixed(1) + '%' : '—'}</td>
    </tr>`;
  }).join('');
}

function renderTradeEquity(rows) {
  const sorted = [...rows].sort((a, b) => new Date(a.entry_time) - new Date(b.entry_time));
  let cum = 0;
  const labels = [], data = [];
  sorted.forEach((r, i) => {
    cum += parseFloat(r.pnl_net || 0);
    if (i % Math.max(1, Math.floor(sorted.length / 80)) === 0) {
      labels.push(fmtDt(r.entry_time).slice(0, 5));
      data.push(parseFloat(cum.toFixed(2)));
    }
  });
  makeChart('chart-trade-equity', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: cum >= 0 ? '#3fb950' : '#f85149',
        backgroundColor: cum >= 0 ? 'rgba(63,185,80,.07)' : 'rgba(248,81,73,.07)',
        fill: true, tension: .3, pointRadius: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#556070', maxTicksLimit: 8, font: { size: 9 } }, grid: { color: '#1e2d3d' } },
        y: { ticks: { color: '#556070', font: { size: 10 } }, grid: { color: '#1e2d3d' } },
      },
    },
  });
}

function updateSortHeaders() {
  $$('#trade-table thead th[data-col]').forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === tradeState.sort_col) {
      th.classList.add(tradeState.sort_dir === 'ASC' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function exportCsv() {
  if (!tradeState.rows.length) { toast('Aucune donnée à exporter', 'err'); return; }
  const cols = ['id','symbol','entry_time','exit_time','entry_price','exit_price','qty','pnl_net','result','duration_s','kelly_fraction'];
  const csv = [cols.join(','), ...tradeState.rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'trades_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  toast('Export CSV téléchargé ✓');
}

// ═════════════════════════════════════════════════════════════════════════════
// PnL — courbes + métriques
// ═════════════════════════════════════════════════════════════════════════════
async function renderPnl() {
  const [today, hist] = await Promise.all([
    api('/api/pnl/today'),
    api('/api/pnl/history?days=30'),
  ]);

  // Agréger par jour (tous symboles)
  const byDay = {};
  const bySym = {};
  (hist || []).forEach((r) => {
    if (!byDay[r.day]) byDay[r.day] = 0;
    byDay[r.day] += parseFloat(r.pnl || 0);
    if (!bySym[r.symbol]) bySym[r.symbol] = {};
    if (!bySym[r.symbol][r.day]) bySym[r.symbol][r.day] = 0;
    bySym[r.symbol][r.day] += parseFloat(r.pnl || 0);
  });

  const days  = Object.keys(byDay).sort();
  const pnls  = days.map((d) => parseFloat(byDay[d].toFixed(2)));
  let cum = 0;
  const equity = pnls.map((p) => parseFloat((cum += p).toFixed(2)));

  panel.innerHTML = `
    <!-- KPIs aujourd'hui -->
    <div class="grid-3" style="margin-bottom:.75rem">
      ${(today || []).map((r) => `
        <div class="kpi">
          <span class="kpi-label">${r.symbol}</span>
          <span class="kpi-value ${parseFloat(r.pnl) >= 0 ? 'pos' : 'neg'}">${fmt2(r.pnl)} $</span>
          <span class="kpi-sub">${r.trades} trade(s) aujourd'hui</span>
        </div>`).join('')}
    </div>

    <!-- Equity 30j -->
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-header"><span class="card-title">Equity cumulée — 30 jours</span></div>
      <div class="chart-wrap" style="height:200px"><canvas id="chart-equity30"></canvas></div>
    </div>

    <!-- PnL journalier bars -->
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-header"><span class="card-title">PnL journalier (barres)</span></div>
      <div class="chart-wrap" style="height:180px"><canvas id="chart-pnl-bars"></canvas></div>
    </div>

    <!-- Par symbole -->
    <div class="card">
      <div class="card-header"><span class="card-title">PnL par symbole — 30j</span></div>
      <div class="chart-wrap" style="height:180px"><canvas id="chart-pnl-sym"></canvas></div>
    </div>`;

  // Equity
  makeChart('chart-equity30', {
    type: 'line',
    data: { labels: days.map((d) => d.slice(5)),
      datasets: [{ label: 'Equity', data: equity, borderColor: '#2f86eb', backgroundColor: 'rgba(47,134,235,.08)', fill: true, tension: .3, pointRadius: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#556070', font:{size:9} }, grid: { color: '#1e2d3d' } }, y: { ticks: { color: '#556070', font:{size:10} }, grid: { color: '#1e2d3d' } } } },
  });

  // Barres PnL
  makeChart('chart-pnl-bars', {
    type: 'bar',
    data: { labels: days.map((d) => d.slice(5)),
      datasets: [{ label: 'PnL/jour', data: pnls,
        backgroundColor: pnls.map((v) => v >= 0 ? 'rgba(63,185,80,.6)' : 'rgba(248,81,73,.6)'),
        borderColor: pnls.map((v) => v >= 0 ? '#3fb950' : '#f85149'),
        borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#556070', font:{size:9} }, grid: { color: '#1e2d3d' } }, y: { ticks: { color: '#556070', font:{size:10} }, grid: { color: '#1e2d3d' } } } },
  });

  // Par symbole
  const SYMS = ['BTCUSDT','ETHUSDT','SOLUSDT'];
  const COLORS = ['#2f86eb','#3fb950','#d29922'];
  makeChart('chart-pnl-sym', {
    type: 'line',
    data: { labels: days.map((d) => d.slice(5)),
      datasets: SYMS.map((sym, i) => ({
        label: sym.replace('USDT',''),
        data: days.map((d) => parseFloat(((bySym[sym] || {})[d] || 0).toFixed(2))),
        borderColor: COLORS[i], backgroundColor: 'transparent',
        tension: .3, pointRadius: 0, borderWidth: 1.5,
      })) },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b9eb0', font:{size:10} } } },
      scales: { x: { ticks: { color: '#556070', font:{size:9} }, grid: { color: '#1e2d3d' } }, y: { ticks: { color: '#556070', font:{size:10} }, grid: { color: '#1e2d3d' } } } },
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// STATUT BOTS
// ═════════════════════════════════════════════════════════════════════════════
async function renderStatus() {
  const status = await api('/api/status');
  const d = lastWsData || {};
  renderStatusHtml(status, d);
}

function updateStatusLive(d) {
  if (!document.getElementById('status-root')) return;
  // Mise à jour légère des valeurs WS sans tout re-render
  ['BTCUSDT','ETHUSDT','SOLUSDT'].forEach((sym) => {
    const p = d.pairs?.[sym];
    if (!p) return;
    const s = sym.toLowerCase();
    const el = (id) => document.getElementById(id);
    if (el(`s-pos-${s}`)) el(`s-pos-${s}`).innerHTML = p.position_open ? '<span class="positive">● OPEN</span>' : '<span class="muted">— IDLE</span>';
    if (el(`s-regime-${s}`)) el(`s-regime-${s}`).textContent = p.regime || '—';
    if (el(`s-kelly-${s}`)) el(`s-kelly-${s}`).textContent = p.kelly ? (p.kelly * 100).toFixed(1) + '%' : '—';
    if (el(`s-atr-${s}`)) el(`s-atr-${s}`).textContent = p.atr ? fmt2(p.atr) : '—';
    if (el(`s-ws-${s}`)) { el(`s-ws-${s}`).textContent = p.ws_status || '—'; el(`s-ws-${s}`).className = 'v ' + (p.ws_status === 'connected' ? 'positive' : 'negative'); }
  });
}

function renderStatusHtml(status, d) {
  panel.innerHTML = `<div id="status-root">
    <div class="bot-strip" style="margin-bottom:.75rem">
      ${(status.pairs || []).map((p) => {
        const sym = p.symbol;
        const s = sym.toLowerCase();
        const ws = d.pairs?.[sym] || {};
        return `<div class="bot-card ${p.position_open ? 'active' : ''}">
          <div class="bot-name">${sym.replace('USDT','')} / USDT</div>
          <div class="bot-row"><span class="k">Position</span><span class="v" id="s-pos-${s}">${p.position_open ? '<span class="positive">● OPEN</span>' : '<span class="muted">— IDLE</span>'}</span></div>
          <div class="bot-row"><span class="k">Trades/jour</span><span class="v">${p.trades_day}</span></div>
          <div class="bot-row"><span class="k">Consec loss</span><span class="v ${p.consec_loss >= 3 ? 'negative warn' : ''}">${p.consec_loss}</span></div>
          <div class="bot-row"><span class="k">Global stop</span><span class="v ${p.global_stop ? 'negative' : 'positive'}">${p.global_stop ? '🛑 STOP' : '✅ OK'}</span></div>
          <hr class="divider" />
          <div class="bot-row"><span class="k">Régime</span><span class="v" id="s-regime-${s}">${ws.regime || p.regime || '—'}</span></div>
          <div class="bot-row"><span class="k">Kelly</span><span class="v" id="s-kelly-${s}">${ws.kelly ? (ws.kelly*100).toFixed(1)+'%' : '—'}</span></div>
          <div class="bot-row"><span class="k">ATR</span><span class="v" id="s-atr-${s}">${ws.atr ? fmt2(ws.atr) : '—'}</span></div>
          <div class="bot-row"><span class="k">WS Binance</span><span class="v ${(ws.ws_status || 'unknown') === 'connected' ? 'positive' : 'negative'}" id="s-ws-${s}">${ws.ws_status || '—'}</span></div>
          <div class="bot-row"><span class="k">ListenKey age</span><span class="v">${ws.listen_key_age ? ws.listen_key_age + ' min' : '—'}</span></div>
          <div class="bot-row"><span class="k">Dernier signal</span><span class="v mono" style="font-size:.7rem">${ws.last_signal || '—'}</span></div>
        </div>`;
      }).join('')}
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">PnL jour total</span></div>
      <div class="kpi" style="max-width:220px">
        <span class="kpi-label">Tous bots confondus</span>
        <span class="kpi-value ${(status.pnl_day || 0) >= 0 ? 'pos' : 'neg'}">${fmt2(status.pnl_day)} $</span>
      </div>
    </div>
  </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// MARCHÉ — Binance REST + CoinGecko
// ═════════════════════════════════════════════════════════════════════════════
async function renderMarket() {
  panel.innerHTML = '<div class="spinner"></div>';

  const BINANCE_SYMS = ['BTCUSDT','ETHUSDT','SOLUSDT'];
  const CG_IDS = 'bitcoin,ethereum,solana';

  const [bnRes, cgRes] = await Promise.allSettled([
    fetch('https://api.binance.com/api/v3/ticker/24hr?' + BINANCE_SYMS.map((s) => 'symbol=' + s).join('&'))
      .then((r) => r.json()),
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + CG_IDS + '&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true')
      .then((r) => r.json()),
  ]);

  const bn   = bnRes.status === 'fulfilled' ? bnRes.value : [];
  const cg   = cgRes.status === 'fulfilled' ? cgRes.value : {};
  const bnOk = bnRes.status === 'fulfilled';
  const cgOk = cgRes.status === 'fulfilled';

  const CG_MAP = { BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', SOLUSDT: 'solana' };
  const bnMap  = {};
  (Array.isArray(bn) ? bn : []).forEach((t) => { bnMap[t.symbol] = t; });

  const fmtVol = (v) => {
    const n = parseFloat(v || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    return n.toFixed(0);
  };
  const fmtCap = (v) => {
    const n = parseFloat(v || 0);
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    return fmtVol(v);
  };

  panel.innerHTML = `
    <div class="row" style="margin-bottom:.5rem">
      <span class="card-title">Données marché</span>
      <span class="source-tag">Binance REST ${bnOk ? '✅' : '❌'}</span>
      <span class="source-tag">CoinGecko ${cgOk ? '✅' : '❌'}</span>
    </div>
    <div class="ticker-grid">
      ${BINANCE_SYMS.map((sym) => {
        const b  = bnMap[sym] || {};
        const id = CG_MAP[sym];
        const g  = cg[id] || {};
        const chg = parseFloat(b.priceChangePercent || 0);
        const cgChg = parseFloat(g.usd_24h_change || 0);
        return `<div class="ticker-card">
          <div class="ticker-sym">${sym.replace('USDT','')} <span class="source-tag">USDT</span></div>
          <div class="ticker-price">${b.lastPrice ? parseFloat(b.lastPrice).toLocaleString('fr-FR',{maximumFractionDigits:2}) : (g.usd ? g.usd.toLocaleString('fr-FR') : '—')}</div>
          <div class="ticker-change ${chg >= 0 ? 'positive' : 'negative'}">${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}% <span class="muted" style="font-size:.65rem;font-style:normal">24h Binance</span></div>
          <hr class="divider" />
          <div class="ticker-meta">
            <span><b>${fmtVol(b.volume)}</b> Vol (base)</span>
            <span><b>${fmtVol(b.quoteVolume)}</b> Vol USDT</span>
          </div>
          <div class="ticker-meta" style="margin-top:.3rem">
            <span>High <b>${b.highPrice ? parseFloat(b.highPrice).toLocaleString('fr-FR',{maximumFractionDigits:2}) : '—'}</b></span>
            <span>Low <b>${b.lowPrice ? parseFloat(b.lowPrice).toLocaleString('fr-FR',{maximumFractionDigits:2}) : '—'}</b></span>
          </div>
          ${cgOk ? `<hr class="divider" />
          <div class="ticker-meta">
            <span class="source-tag">CoinGecko</span>
            <span>Cap <b>${fmtCap(g.usd_market_cap)}</b></span>
            <span class="${cgChg >= 0 ? 'positive' : 'negative'}">${cgChg >= 0 ? '▲' : '▼'} ${Math.abs(cgChg).toFixed(2)}%</span>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// CORRÉLATION
// ═════════════════════════════════════════════════════════════════════════════
async function renderCorrelation() {
  const data = await api('/api/correlation');
  const SYMS = ['BTCUSDT','ETHUSDT','SOLUSDT'];
  const LABELS = ['BTC','ETH','SOL'];

  const corrColor = (v) => {
    if (v == null) return 'var(--bg3)';
    const abs = Math.abs(v);
    if (abs >= 0.85) return 'rgba(248,81,73,.35)';
    if (abs >= 0.6)  return 'rgba(210,153,34,.25)';
    return 'rgba(63,185,80,.15)';
  };

  panel.innerHTML = `
    <div class="card" style="display:inline-block;margin-bottom:.75rem">
      <div class="card-header"><span class="card-title">Matrice corrélation Pearson (20 closes)</span></div>
      <div class="corr-matrix">
        <div class="corr-cell corr-hdr"></div>
        ${LABELS.map((l) => `<div class="corr-cell corr-hdr">${l}</div>`).join('')}
        ${SYMS.map((sym, i) => `
          <div class="corr-cell corr-hdr">${LABELS[i]}</div>
          ${SYMS.map((_, j) => {
            if (i === j) return `<div class="corr-cell corr-diag">1.00</div>`;
            const v = data[SYMS[i]];
            const val = v != null ? parseFloat(v).toFixed(3) : 'N/A';
            const blocked = v != null && Math.abs(v) >= 0.85;
            return `<div class="corr-cell" style="background:${corrColor(v)};${blocked ? 'color:var(--red)' : ''}">
              ${val}${blocked ? ' 🚫' : ''}
            </div>`;
          }).join('')}
        `).join('')}
      </div>
      <p class="muted" style="margin-top:.5rem">🚫 &gt; 0.85 → signal bloqué par le filtre corrélation</p>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Valeurs brutes</span></div>
      <table>
        <thead><tr><th>Paire</th><th>Corrélation vs BTCUSDT</th><th>Statut</th></tr></thead>
        <tbody>
          ${Object.entries(data).map(([sym, val]) => {
            const v = val != null ? parseFloat(val) : null;
            const blocked = v != null && Math.abs(v) >= 0.85;
            return `<tr>
              <td class="td-sym">${sym}</td>
              <td class="mono ${blocked ? 'negative' : 'positive'}">${v != null ? v.toFixed(4) : 'N/A'}</td>
              <td>${blocked ? '<span class="badge badge-red">BLOQUÉ</span>' : '<span class="badge badge-green">OK</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// BACKTEST
// ═════════════════════════════════════════════════════════════════════════════
async function renderBacktest() {
  panel.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Backtest sur données historiques Postgres</span></div>
      <div class="form-grid">
        <div class="form-field"><label>Symbole</label>
          <select id="bt-sym"><option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option></select></div>
        <div class="form-field"><label>Période (jours)</label>
          <input type="number" id="bt-days" value="30" min="1" max="365" /></div>
        <div class="form-field" style="justify-content:flex-end">
          <button class="btn" id="bt-run">▷ Lancer le backtest</button></div>
      </div>
    </div>
    <div id="bt-results"></div>`;

  document.getElementById('bt-run').addEventListener('click', async () => {
    const sym  = document.getElementById('bt-sym').value;
    const days = parseInt(document.getElementById('bt-days').value, 10);
    document.getElementById('bt-results').innerHTML = '<div class="spinner"></div>';
    try {
      const r = await api('/api/backtest', { method: 'POST', body: JSON.stringify({ symbol: sym, days }) });
      renderBacktestResults(r);
    } catch (e) {
      document.getElementById('bt-results').innerHTML = `<div class="card"><p class="negative">Erreur : ${e.message}</p></div>`;
    }
  });
}

function renderBacktestResults(r) {
  const daily = r.daily || [];
  let cum = 0;
  const labels = daily.map((d) => d.day?.slice(5) || '');
  const equity = daily.map((d) => parseFloat((cum += parseFloat(d.pnl || 0)).toFixed(2)));

  document.getElementById('bt-results').innerHTML = `
    <div class="grid-4" style="margin:.75rem 0">
      <div class="kpi"><span class="kpi-label">PnL total</span><span class="kpi-value ${r.total_pnl >= 0 ? 'pos' : 'neg'}">${fmt2(r.total_pnl)} $</span></div>
      <div class="kpi"><span class="kpi-label">Sharpe (ann.)</span><span class="kpi-value ${r.sharpe >= 1 ? 'pos' : r.sharpe >= 0 ? 'neu' : 'neg'}">${r.sharpe}</span></div>
      <div class="kpi"><span class="kpi-label">Sortino</span><span class="kpi-value ${r.sortino >= 1 ? 'pos' : 'neu'}">${r.sortino}</span></div>
      <div class="kpi"><span class="kpi-label">Profit Factor</span><span class="kpi-value ${r.profit_factor >= 1 ? 'pos' : 'neg'}">${r.profit_factor}</span>
        <span class="kpi-sub">${r.win_days} jours +  ·  ${r.loss_days} jours −</span></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Equity curve — ${r.symbol} · ${r.days}j</span></div>
      <div class="chart-wrap" style="height:220px"><canvas id="chart-bt-equity"></canvas></div>
    </div>
    <div class="card" style="margin-top:.75rem">
      <div class="card-header"><span class="card-title">Détail journalier</span></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Jour</th><th>PnL</th><th>Trades</th></tr></thead>
          <tbody>${daily.map((d) => `<tr>
            <td class="mono">${d.day}</td>
            <td class="mono ${parseFloat(d.pnl) >= 0 ? 'positive' : 'negative'}">${fmt2(d.pnl)}</td>
            <td class="mono">${d.trades}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;

  makeChart('chart-bt-equity', {
    type: 'line',
    data: { labels, datasets: [{
      label: 'Equity',
      data: equity,
      borderColor: cum >= 0 ? '#3fb950' : '#f85149',
      backgroundColor: cum >= 0 ? 'rgba(63,185,80,.07)' : 'rgba(248,81,73,.07)',
      fill: true, tension: .35, pointRadius: 2,
    }] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#556070', font:{size:9} }, grid: { color: '#1e2d3d' } }, y: { ticks: { color: '#556070', font:{size:10} }, grid: { color: '#1e2d3d' } } } },
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// EVENTS
// ═════════════════════════════════════════════════════════════════════════════
async function renderEvents() {
  const rows = await api('/api/events?limit=100');
  panel.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Flux events Postgres</span>
        <span class="muted">${rows.length} derniers events</span>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>#</th><th>Symbole</th><th>Type</th><th>Payload</th><th>Date</th></tr></thead>
          <tbody>${(rows || []).map((r) => {
            const typeMap = { SIGNAL_REJECTED: 'badge-yellow', SLIPPAGE_ABORT: 'badge-purple', TRADE_OPEN: 'badge-blue', TRADE_CLOSE: 'badge-green', GLOBAL_STOP: 'badge-red' };
            return `<tr>
              <td class="mono">${r.id}</td>
              <td class="td-sym">${r.symbol || '—'}</td>
              <td><span class="badge ${typeMap[r.type] || 'badge-grey'}">${r.type || '—'}</span></td>
              <td class="mono" style="max-width:300px;font-size:.72rem">${r.payload ? JSON.stringify(r.payload).slice(0,80) : '—'}</td>
              <td class="mono">${fmtDt(r.created_at)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═════════════════════════════════════════════════════════════════════════════
async function renderConfig() {
  panel.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Configuration à chaud — Redis pub/sub</span></div>
      <p class="muted" style="margin-bottom:.75rem">Publie une valeur dans le canal <code>bot:{symbol}:config</code>. Le bot applique immédiatement.</p>
      <div class="form-grid">
        <div class="form-field"><label>Bot</label>
          <select id="cfg-sym"><option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option></select></div>
        <div class="form-field"><label>Clé</label>
          <input type="text" id="cfg-key" placeholder="ex: MAX_TRADES_DAY" list="cfg-suggestions" /></div>
        <datalist id="cfg-suggestions">
          <option value="MAX_TRADES_DAY"></option>
          <option value="SL_PCT"></option>
          <option value="TP_PCT"></option>
          <option value="reset_daily"></option>
          <option value="DRY_RUN"></option>
        </datalist>
        <div class="form-field"><label>Valeur</label>
          <input type="text" id="cfg-val" placeholder="ex: 5" /></div>
        <div class="form-field" style="justify-content:flex-end">
          <button class="btn" id="cfg-send">Envoyer</button></div>
      </div>
      <div id="cfg-result"></div>
    </div>`;

  document.getElementById('cfg-send').addEventListener('click', async () => {
    const symbol = document.getElementById('cfg-sym').value;
    const key    = document.getElementById('cfg-key').value.trim();
    const value  = document.getElementById('cfg-val').value.trim();
    if (!key || !value) { toast('Clé et valeur requises', 'err'); return; }
    document.getElementById('cfg-result').innerHTML = '<p class="muted">Envoi en cours…</p>';
    try {
      const r = await api('/api/config', { method: 'POST', body: JSON.stringify({ symbol, key, value }) });
      document.getElementById('cfg-result').innerHTML = `<p class="positive">✅ Appliqué : ${JSON.stringify(r)}</p>`;
      toast('Config envoyée ✓');
    } catch (e) {
      document.getElementById('cfg-result').innerHTML = `<p class="negative">Erreur : ${e.message}</p>`;
      toast('Erreur : ' + e.message, 'err');
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// HEALTH / VPS
// ═════════════════════════════════════════════════════════════════════════════
async function renderHealth() {
  const [sys, status] = await Promise.all([
    api('/api/system'),
    api('/api/status'),
  ]);

  const memPct  = Math.round((sys.mem_used_mb / sys.mem_total_mb) * 100);
  const load1   = sys.load?.[0] ?? 0;
  const cpuEst  = Math.min(100, Math.round((load1 / sys.cpu_count) * 100));
  const upDays  = Math.floor(sys.uptime / 86400);
  const upHours = Math.floor((sys.uptime % 86400) / 3600);
  const pnlDay  = status.pnl_day ?? 0;
  const TARGET  = 80;
  const pnlPct  = Math.min(100, Math.max(0, (pnlDay / TARGET) * 100));

  panel.innerHTML = `
    <!-- VPS -->
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-header"><span class="card-title">VPS — ${sys.hostname || '176.97.70.254'}</span></div>
      <div class="grid-4">
        <div class="kpi">
          <span class="kpi-label">CPU (estimé)</span>
          <span class="kpi-value ${cpuEst > 80 ? 'neg' : cpuEst > 50 ? 'warn' : 'pos'}">${cpuEst}%</span>
          <div class="progress-track"><div class="progress-bar ${cpuEst > 80 ? 'danger' : cpuEst > 50 ? 'warn' : ''}" style="width:${cpuEst}%"></div></div>
          <span class="kpi-sub">Load ${sys.load?.map((v) => v.toFixed(2)).join(' / ') || '—'} · ${sys.cpu_count} CPU</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">RAM</span>
          <span class="kpi-value ${memPct > 85 ? 'neg' : 'neu'}">${sys.mem_used_mb} / ${sys.mem_total_mb} MB</span>
          <div class="progress-track"><div class="progress-bar ${memPct > 85 ? 'danger' : memPct > 65 ? 'warn' : ''}" style="width:${memPct}%"></div></div>
          <span class="kpi-sub">${memPct}% utilisé</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Uptime</span>
          <span class="kpi-value neu">${upDays}j ${upHours}h</span>
          <span class="kpi-sub">${sys.platform || '—'}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">PnL / Objectif</span>
          <span class="kpi-value ${pnlDay >= TARGET ? 'pos' : pnlDay >= 0 ? 'neu' : 'neg'}">${fmt2(pnlDay)} / ${TARGET} $</span>
          <div class="progress-track"><div class="progress-bar ${pnlDay >= TARGET ? '' : pnlDay >= TARGET * .5 ? 'warn' : 'danger'}" style="width:${pnlPct}%"></div></div>
          <span class="kpi-sub">${pnlPct.toFixed(0)}% objectif journalier</span>
        </div>
      </div>
    </div>

    <!-- Docker -->
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-header"><span class="card-title">Conteneurs Docker</span></div>
      ${sys.containers && sys.containers.length ? `
        <table>
          <thead><tr><th>Nom</th><th>Image</th><th>Statut</th></tr></thead>
          <tbody>${sys.containers.map((c) => {
            const up = c.status?.toLowerCase().includes('up');
            return `<tr>
              <td class="mono">${c.name}</td>
              <td class="mono" style="color:var(--text3)">${c.image}</td>
              <td><span class="badge ${up ? 'badge-green' : 'badge-red'}">${c.status || '—'}</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : '<p class="muted">Docker non accessible depuis ce contexte.</p>'}
    </div>

    <!-- Bots health résumé -->
    <div class="card">
      <div class="card-header"><span class="card-title">Santé bots</span></div>
      <div class="bot-strip">
        ${(status.pairs || []).map((p) => `
          <div class="bot-card ${p.global_stop ? 'stopped' : p.position_open ? 'active' : ''}">
            <div class="bot-name">${p.symbol}</div>
            <div class="bot-row"><span class="k">Global stop</span><span class="v ${p.global_stop ? 'negative' : 'positive'}">${p.global_stop ? '🛑' : '✅'}</span></div>
            <div class="bot-row"><span class="k">Consec loss</span><span class="v ${p.consec_loss >= 3 ? 'negative' : ''}">${p.consec_loss}</span></div>
            <div class="bot-row"><span class="k">Trades/j</span><span class="v">${p.trades_day}</span></div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadTab('overview');
