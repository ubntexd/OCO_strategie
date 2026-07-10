#!/bin/bash
# TUNNEL SSH → MCP BRIDGE (Linux/Mac)
VPS_IP="${VPS_IP:-176.97.70.254}"
VPS_USER="${VPS_USER:-dev}"
LOCAL_PORT="${LOCAL_PORT:-5011}"
REMOTE_PORT="${REMOTE_PORT:-5011}"

echo "Tunnel: http://localhost:${LOCAL_PORT} → ${VPS_USER}@${VPS_IP}:${REMOTE_PORT}"
while true; do
  ssh -N -L "${LOCAL_PORT}:localhost:${REMOTE_PORT}" \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -o StrictHostKeyChecking=accept-new \
      "${VPS_USER}@${VPS_IP}"
  echo "Tunnel fermé — reconnexion dans 5s..."
  sleep 5
done
