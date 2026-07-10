const panel = document.getElementById('panel');
const liveTs = document.getElementById('live-ts');
const auth = 'Basic ' + btoa(`admin:${prompt('Mot de passe dashboard:', 'changeme') || 'changeme'}`);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: auth, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function renderOverview(data) {
  panel.innerHTML = `<div class="card"><h2>Temps réel</h2>
    <p>Bid BTC: <strong>${data.bid_btc || '—'}</strong></p>
    <p>PnL jour: <strong class="${data.pnl_day >= 0 ? 'positive' : 'negative'}">${data.pnl_day?.toFixed?.(2) ?? data.pnl_day}</strong></p>
  </div>`;
}

async function loadTab(tab) {
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  try {
    if (tab === 'trades') {
      const rows = await api('/api/trades?limit=20');
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else if (tab === 'pnl') {
      const rows = await api('/api/pnl/today');
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else if (tab === 'status') {
      const rows = await api('/api/status');
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else if (tab === 'correlation') {
      const rows = await api('/api/correlation');
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else if (tab === 'backtest') {
      const rows = await api('/api/backtest', { method: 'POST', body: JSON.stringify({ symbol: 'BTCUSDT', days: 30 }) });
      panel.innerHTML = `<div class="card"><pre>${JSON.stringify(rows, null, 2)}</pre></div>`;
    } else {
      panel.innerHTML = `<div class="card"><p>Onglet ${tab} — données via API / WebSocket</p></div>`;
    }
  } catch (e) {
    panel.innerHTML = `<div class="card negative">Erreur: ${e.message}</div>`;
  }
}

document.getElementById('tabs').addEventListener('click', (e) => {
  if (e.target.dataset.tab) loadTab(e.target.dataset.tab);
});

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${proto}://${location.host}`);
ws.onmessage = (ev) => {
  const data = JSON.parse(ev.data);
  liveTs.textContent = new Date(data.ts).toLocaleTimeString('fr-FR');
  if (document.querySelector('#tabs .active')?.dataset.tab === 'overview') renderOverview(data);
};

loadTab('overview');
