#!/bin/bash
set -e
cd /home/dev/dev/OCO_strategie
mkdir -p tmp_claude_sync logs scripts claude-worker n8n/workflows

cp -f tmp_claude_sync/claude-bridge.sh tmp_claude_sync/claude-session.sh tmp_claude_sync/claude-n8n-worker.js scripts/ 2>/dev/null || true
cp -f tmp_claude_sync/wf7_claude_worker.json n8n/workflows/ 2>/dev/null || true
cp -f tmp_claude_sync/docker-compose.yml . 2>/dev/null || true
cp -rf tmp_claude_sync/claude-worker/* claude-worker/ 2>/dev/null || cp -rf tmp_claude_sync/Dockerfile claude-worker/ 2>/dev/null || true

chmod +x scripts/claude-bridge.sh scripts/claude-session.sh

# Step 2 — Claude Code CLI
if command -v claude &>/dev/null; then
  echo "Claude Code déjà installé : $(claude --version 2>/dev/null || echo ok)"
else
  npm install -g @anthropic-ai/claude-code || {
    npm install -g @anthropic-ai/claude-code --prefix "$HOME/.npm-global"
    export PATH="$HOME/.npm-global/bin:$PATH"
    grep -q '.npm-global/bin' "$HOME/.bashrc" || echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.bashrc"
  }
fi
export PATH="$HOME/.npm-global/bin:$PATH"
command -v claude || { echo "FAIL: claude CLI introuvable"; exit 1; }

# Step 3 — API key
set -a
source .env.shared
set +a
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERREUR: ANTHROPIC_API_KEY manquante"
  exit 1
fi
export ANTHROPIC_API_KEY
echo "Clé API OK : ${ANTHROPIC_API_KEY:0:15}..."

# Step 9 — quick CLI test
echo "=== TEST CLI ==="
echo "Réponds uniquement: pong" | timeout 60 claude --print --dangerously-skip-permissions 2>/dev/null | head -3 || echo "CLI test timeout/fail (continuer)"

# Step 7+10 — Docker worker
docker compose --profile ops up -d --build claude_worker 2>&1 | tail -8
sleep 8

if curl -sf http://127.0.0.1:4099/health | grep -q ok; then
  echo "✅ Worker Docker port 4099 OK"
else
  echo "Docker worker fail — fallback host worker"
  pkill -f claude-n8n-worker.js 2>/dev/null || true
  nohup node scripts/claude-n8n-worker.js > logs/claude-worker-host.log 2>&1 &
  sleep 3
  curl -sf http://127.0.0.1:4099/health && echo "✅ Worker host OK" || echo "❌ Worker non démarré"
fi

# Test execute (short instruction)
RESTART_SECRET_VAL=$(grep '^RESTART_SECRET=' .env.shared | cut -d= -f2-)
curl -sf -X POST http://127.0.0.1:4099/execute \
  -H "Content-Type: application/json" \
  -H "x-worker-token: $RESTART_SECRET_VAL" \
  -d '{"instruction":"Dis la version du package.json en une ligne","async":false}' \
  | head -c 500
echo ""
echo "=== SETUP TERMINÉ ==="
