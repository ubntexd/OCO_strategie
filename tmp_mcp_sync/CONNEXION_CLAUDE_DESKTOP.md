# CONNEXION CLAUDE DESKTOP ↔ BOTTRADER VPS

## Option A — Tunnel SSH (recommandé)

### 1. Ouvrir le tunnel

**Windows :** `scripts\tunnel-mcp.bat`  
**Linux/Mac :** `./scripts/tunnel-mcp.sh`

### 2. Configurer Claude Desktop

- **Windows :** `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac :** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bottrader": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:5011",
        "--header",
        "x-mcp-token: CHANGE_ME_256_BITS"
      ]
    }
  }
}
```

### 3. Redémarrer Claude Desktop

Vérifier que **bottrader** apparaît dans les outils MCP.

---

## Option B — HTTP direct (VPS public)

```json
{
  "mcpServers": {
    "bottrader": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://176.97.70.254:5011",
        "--header",
        "x-mcp-token: CHANGE_ME_256_BITS"
      ]
    }
  }
}
```

---

## Outils MCP HTTP Bridge (port 5011)

| Outil | Endpoint |
|-------|----------|
| read_file | POST /tools/read_file |
| write_file | POST /tools/write_file |
| patch_file | POST /tools/patch_file |
| list_dir | POST /tools/list_dir |
| run_command | POST /tools/run_command |
| run_tests | POST /tools/run_tests |
| git_status | GET /tools/git_status |
| git_commit | POST /tools/git_commit |

Auth : header `x-mcp-token` = `RESTART_SECRET` dans `.env.shared`

---

## Services VPS

| Service | Port |
|---------|------|
| mcp_bridge (HTTP) | 5011 |
| bot_mcp (trading tools) | 5010 |
| claude_worker | 4099 |
