// ROHAN Trading Dashboard — main JS
// Auth via header HTTP Basic (pas de prompt bloquant)
let authHeader = '';

function initAuth() {
  const stored = sessionStorage.getItem('dash_auth');
  if (stored) { authHeader = stored; return; }
  const pw = window.prompt('Mot de passe dashboard:', '') || 'changeme';
  authHeader = 'Basic ' + btoa('admin:' + pw);
  sessionStorage.setItem('dash_auth', authHeader);
}

const panel = document.getElementById('panel');
const liveTs = document.getElementById('live-ts');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    sessionStorage.removeItem('dash_auth');
    authHeader = '';
    initAuth();
    return api(path, opts);
  }
  if (!res.ok) throw new Error(res.status + ' ' + path);
  return res.json();
}

// ── Renderers ────────────────────────────────────────────────────────────────

function renderOverview(data) {
  panel.innerHTML = `<div class="card">
    <h2>Temps réel</h2>
    <p>Bid BTC : <strong>${data.bid_btc || '—'}</strong></p>
    <p>PnL jour : <strong class="${(data.pnl_day || 0) >= 0 ? 'positive' : 'negative'}">${
      typeof data.pnl_day === 'number' ? data.pnl_day.toFixed(2) : '—'
    } USDT</strong></p>
  </div>`;
}

function renderTable(rows, cols) {
  if (!rows || !rows.length) return '<p class="muted">Aucune donnée.</p>';
  const thead = cols.map((c) => `<th>${c}</th>`).join('');
  const tbody = rows.map((r) =>
    '<tr>' + cols.map((c) => `<td>${r[c] ?? '—'}</td>`).join('') + '</tr>',
  ).join('');
  return `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

// ── Tab loaders ───────────────────────────────────────────────────────────────

async function loadTab(tab) {
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  panel.innerHTML = '<div class="card"><p class="muted">Chargement…</p></div>';

  try {
    if (tab === 'overview') {
      // will be filled by WS push; show last known or skeleton
      panel.innerHTML = `<div class="card"><h2>Temps réel</h2><p class="muted">En attente WebSocket…</p></div>`;

    } else if (tab === 'trades') {
      const rows = await api('/api/trades?limit=50');
      panel.innerHTML = `<div class="card"><h2>Derniers trades</h2>${renderTable(rows,
        ['id', 'symbol', 'entry_time', 'exit_time', 'entry_price', 'exit_price', 'qty', 'pnl_net', 'result'],
      )}</div>`;

    } else if (tab === 'pnl') {
      const rows = await api('/api/pnl/today');
      panel.innerHTML = `<div class="card"><h2>PnL aujourd'hui</h2>${renderTable(rows,
        ['symbol', 'pnl', 'trades'],
      )}</div>`;

    } else if (tab === 'status') {
      const data = await api('/api/status');
      const pairsHtml = data.pairs.map((p) => `
        <div class="card">
          <h3>${p.symbol}</h3>
          <p>Position ouverte : <strong>${p.position_open ? '✅ OUI' : '—'}</strong></p>
          <p>Trades/jour : <strong>${p.trades_day}</strong></p>
          <p>Pertes consécutives : <strong>${p.consec_loss}</strong></p>
          <p>Stop global : <strong class="${p.global_stop ? 'negative' : 'positive'}">${p.global_stop ? '🛑 ACTIF' : 'OK'}</strong></p>
        </div>`).join('');
      panel.innerHTML = `<h2>Statut bots</h2>${pairsHtml}
        <div class="card"><p>PnL jour total : <strong class="${(data.pnl_day || 0) >= 0 ? 'positive' : 'negative'}">${
          (data.pnl_day || 0).toFixed(2)
        } USDT</strong></p></div>`;

    } else if (tab === 'correlation') {
      const data = await api('/api/correlation');
      const rows = Object.entries(data).map(([symbol, val]) => ({ symbol, correlation: val?.toFixed?.(4) ?? 'N/A' }));
      panel.innerHTML = `<div class="card"><h2>Corrélations (20 closes)</h2>${renderTable(rows, ['symbol', 'correlation'])}</div>`;

    } else if (tab === 'backtest') {
      panel.innerHTML = `<div class="card">
        <h2>Backtest</h2>
        <div class="form-row">
          <label>Symbole :
            <select id="bt-symbol">
              <option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option>
            </select>
          </label>
          <label>Jours :
            <input id="bt-days" type="number" value="30" min="1" max="365" />
          </label>
          <button id="bt-run">▶ Lancer</button>
        </div>
        <div id="bt-result"></div>
      </div>`;
      document.getElementById('bt-run').addEventListener('click', async () => {
        const symbol = document.getElementById('bt-symbol').value;
        const days = parseInt(document.getElementById('bt-days').value, 10);
        document.getElementById('bt-result').innerHTML = '<p class="muted">Calcul en cours…</p>';
        try {
          const r = await api('/api/backtest', {
            method: 'POST',
            body: JSON.stringify({ symbol, days }),
          });
          document.getElementById('bt-result').innerHTML = `
            <table>
              <tr><th>Total PnL</th><td class="${r.total_pnl >= 0 ? 'positive' : 'negative'}">${r.total_pnl.toFixed(2)} USDT</td></tr>
              <tr><th>Jours gagnants</th><td class="positive">${r.win_days}</td></tr>
              <tr><th>Jours perdants</th><td class="negative">${r.loss_days}</td></tr>
              <tr><th>Sharpe (ann.)</th><td>${r.sharpe}</td></tr>
              <tr><th>Sortino</th><td>${r.sortino}</td></tr>
              <tr><th>Profit Factor</th><td>${r.profit_factor}</td></tr>
            </table>
            <details><summary>Détail journalier</summary><pre>${JSON.stringify(r.daily, null, 2)}</pre></details>`;
        } catch (e) {
          document.getElementById('bt-result').innerHTML = `<p class="negative">Erreur : ${e.message}</p>`;
        }
      });

    } else if (tab === 'events') {
      const rows = await api('/api/trades?limit=100');
      // On filtre les événements visibles via trades (result) — endpoint /api/events absent, on affiche les trades récents
      panel.innerHTML = `<div class="card">
        <h2>Événements récents</h2>
        <p class="muted">Source : 100 derniers trades (result)</p>
        ${renderTable(rows, ['id', 'symbol', 'entry_time', 'result', 'pnl_net'])}
      </div>`;

    } else if (tab === 'config') {
      panel.innerHTML = `<div class="card">
        <h2>Configuration à chaud</h2>
        <p class="muted">Publie une valeur dans Redis (canal bot:{symbol}:config).</p>
        <div class="form-row">
          <label>Bot :
            <select id="cfg-symbol">
              <option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option>
            </select>
          </label>
          <label>Clé : <input id="cfg-key" type="text" placeholder="ex: MAX_TRADES_DAY" /></label>
          <label>Valeur : <input id="cfg-val" type="text" placeholder="ex: 5" /></label>
          <button id="cfg-send">Envoyer</button>
        </div>
        <div id="cfg-result"></div>
      </div>`;
      document.getElementById('cfg-send').addEventListener('click', async () => {
        const symbol = document.getElementById('cfg-symbol').value;
        const key = document.getElementById('cfg-key').value.trim();
        const value = document.getElementById('cfg-val').value.trim();
        if (!key || !value) { document.getElementById('cfg-result').innerHTML = '<p class="negative">Clé et valeur requises.</p>'; return; }
        document.getElementById('cfg-result').innerHTML = '<p class="muted">Envoi…</p>';
        try {
          const r = await api('/api/config', {
            method: 'POST',
            body: JSON.stringify({ symbol, key, value }),
          });
          document.getElementById('cfg-result').innerHTML = `<p class="positive">✅ ${JSON.stringify(r)}</p>`;
        } catch (e) {
          document.getElementById('cfg-result').innerHTML = `<p class="negative">Erreur : ${e.message}</p>`;
        }
      });

    } else if (tab === 'health') {
      const data = await api('/api/status');
      panel.innerHTML = `<div class="card">
        <h2>Health — Bots</h2>
        ${data.pairs.map((p) => `
          <div class="card">
            <h3>${p.symbol}</h3>
            <p>Global stop : <strong class="${p.global_stop ? 'negative' : 'positive'}">${p.global_stop ? '🛑 STOP' : '✅ OK'}</strong></p>
            <p>Pertes consécutives : <strong>${p.consec_loss}</strong></p>
            <p>Trades aujourd'hui : <strong>${p.trades_day}</strong></p>
          </div>`).join('')}
        <div class="card"><p>PnL jour : <strong class="${(data.pnl_day || 0) >= 0 ? 'positive' : 'negative'}">${(data.pnl_day || 0).toFixed(2)} USDT</strong></p></div>
      </div>`;

    } else {
      panel.innerHTML = `<div class="card"><p class="muted">Onglet ${tab} — non implémenté.</p></div>`;
    }
  } catch (e) {
    panel.innerHTML = `<div class="card"><p class="negative">Erreur : ${e.message}</p></div>`;
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

document.getElementById('tabs').addEventListener('click', (e) => {
  if (e.target.dataset.tab) loadTab(e.target.dataset.tab);
});

// ── WebSocket temps réel ──────────────────────────────────────────────────────

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(proto + '://' + location.host);
ws.onmessage = (ev) => {
  const data = JSON.parse(ev.data);
  liveTs.textContent = new Date(data.ts).toLocaleTimeString('fr-FR');
  const active = document.querySelector('#tabs .active');
  if (active && active.dataset.tab === 'overview') renderOverview(data);
};
ws.onerror = () => { liveTs.textContent = '⚠ WS'; };

// ── Init ──────────────────────────────────────────────────────────────────────

initAuth();
loadTab('overview');
