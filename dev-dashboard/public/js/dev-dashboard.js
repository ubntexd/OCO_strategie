function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { hour12: false });
}

function render(data) {
  const p = data.pipeline || {};
  document.getElementById('header-meta').textContent =
    `MAJ ${fmtTime(data.updatedAt)} | VPS 176.97.70.254 | N8n :25678`;

  document.getElementById('pipeline').innerHTML = `
    <strong class="status-running">${p.status || 'IDLE'}</strong><br/>
    Module: ${p.current_module || '—'} | Tâche: ${p.current_task || '—'}<br/>
    Démarré: ${fmtTime(p.started_at)}
  `;

  const g = data.lastGate;
  if (g) {
    const cls = g.verdict === 'GO' ? 'verdict-go' : 'verdict-no';
    const src = g.gate_source || 'unknown';
    const srcCls = src === 'claude_api' ? 'verdict-go' : 'verdict-no';
    let proofsHtml = '';
    try {
      const reasons = typeof g.reasons === 'string' ? JSON.parse(g.reasons) : g.reasons;
      const proofBlock = Array.isArray(reasons) ? reasons.find((r) => r && r.proofs) : null;
      if (proofBlock?.proofs) {
        proofsHtml = '<br/><strong>Preuves:</strong><br/>' + proofBlock.proofs
          .map((p) => `• [${p.ref}] ${p.type}: ${p.detail} → ${p.result}`)
          .join('<br/>');
      }
    } catch { /* ignore */ }
    document.getElementById('gate').innerHTML = `
      <span class="${cls}"><strong>${g.verdict}</strong></span> — ${g.step}<br/>
      <span class="${srcCls}">Source: <strong>${src}</strong></span>
      ${src !== 'claude_api' ? ' <em>(pipeline bloqué — validation Claude obligatoire)</em>' : ''}<br/>
      ${(Array.isArray(g.reasons) ? g.reasons.filter((r) => typeof r === 'string') : []).join('<br/>')}
      ${proofsHtml}
      <br/><small>${fmtTime(g.created_at)}</small>
    `;
  } else {
    document.getElementById('gate').textContent = 'Aucun verdict encore';
  }

  const tbody = document.getElementById('agents-body');
  tbody.innerHTML = (data.agents || []).map((a) => `
    <tr>
      <td>${a.agent_id}</td>
      <td>${a.agent_role || ''}</td>
      <td>${a.status}</td>
      <td>${a.last_task || '—'}</td>
    </tr>
  `).join('');

  const timeline = document.getElementById('timeline');
  timeline.innerHTML = (data.reports || []).map((r) => `
    <div>
      <strong>${fmtTime(r.created_at)}</strong>
      [${r.agent_id}] ${r.task || ''} — <em>${r.status}</em>
      ${r.message ? `: ${r.message}` : ''}
    </div>
  `).join('') || '<div>Aucun rapport</div>';
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage = (ev) => {
    try { render(JSON.parse(ev.data)); } catch (_) { /* ignore */ }
  };
  ws.onclose = () => setTimeout(connect, 3000);
  fetch('/api/dev/status').then((r) => r.json()).then(render).catch(() => {});
}

connect();
