# FIX MCP CLAUDE DESKTOP
param([string]$Token = "")

$ErrorActionPreference = "Continue"
Write-Host "=== FIX MCP CLAUDE DESKTOP ===" -ForegroundColor Cyan

if (-not $Token) {
  $tf = Join-Path $PSScriptRoot "..\logs\mcp-token.txt"
  if (Test-Path $tf) { $Token = (Get-Content $tf -Raw).Trim() }
}
if (-not $Token) { Write-Host "ERREUR: token manquant"; exit 1 }

$nodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodeExe)) { $nodeExe = (Get-Command node).Source }

$ultiumLauncher = "C:\Users\EZAN\.ultiumgrid-mcp\mcp-postgres-launcher.mjs"
$rohanLauncher = "C:\Users\EZAN\.rohan-mcp\mcp-auditor-launcher.mjs"

$configPaths = @(
  "$env:LOCALAPPDATA\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json",
  "$env:APPDATA\Claude\claude_desktop_config.json"
)

$baseConfig = $null
foreach ($p in $configPaths) {
  if (Test-Path $p) {
    try {
      $obj = Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($obj.mcpServers) {
        $baseConfig = $obj
        Write-Host "Config source: $p"
        break
      }
    } catch { }
  }
}

if (-not $baseConfig) {
  $baseConfig = [PSCustomObject]@{ mcpServers = [PSCustomObject]@{} }
}
if (-not $baseConfig.mcpServers) {
  $baseConfig | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([PSCustomObject]@{})
}

$pgDefs = @{
  "postgres-btc" = @{
    db = "postgresql://claude_readonly:p7lqryp8TLEtyKb2ro7JyQq75Mbn@176.97.70.254:25432/ultiumgrid"
    tool = "query_btc"
    server = "ultiumgrid/postgres-btc"
    desc = "SQL read-only sur ultiumgrid (BTC, port 25432)"
  }
  "postgres-sol" = @{
    db = "postgresql://claude_readonly:p7lqryp8TLEtyKb2ro7JyQq75Mbn@176.97.70.254:25433/ultiumgrid_sol"
    tool = "query_sol"
    server = "ultiumgrid/postgres-sol"
    desc = "SQL read-only sur ultiumgrid_sol (SOL, port 25433)"
  }
  "postgres-xrp" = @{
    db = "postgresql://claude_readonly:p7lqryp8TLEtyKb2ro7JyQq75Mbn@176.97.70.254:25434/ultiumgrid_hyper"
    tool = "query_xrp"
    server = "ultiumgrid/postgres-xrp"
    desc = "SQL read-only sur ultiumgrid_hyper (XRP, port 25434)"
  }
}

foreach ($name in $pgDefs.Keys) {
  $d = $pgDefs[$name]
  $baseConfig.mcpServers | Add-Member -NotePropertyName $name -NotePropertyValue ([PSCustomObject]@{
    command = $nodeExe
    args = @($ultiumLauncher)
    env = [PSCustomObject]@{
      ULTIUMGRID_DB_URL = $d.db
      ULTIUMGRID_TOOL = $d.tool
      ULTIUMGRID_SERVER = $d.server
      ULTIUMGRID_TOOL_DESC = $d.desc
    }
  }) -Force
}

if (Test-Path $rohanLauncher) {
  $baseConfig.mcpServers | Add-Member -NotePropertyName "rohan-auditor" -NotePropertyValue ([PSCustomObject]@{
    command = $nodeExe
    args = @($rohanLauncher)
    env = [PSCustomObject]@{
      MCP_AUTH_TOKEN = "e830e463a961e33f0316c08fb02a3892afa3ab7eac29b50ce8333b618c4cfe14"
      ROHAN_MCP_URL = "https://rohain.149-33-5-15.sslip.io/mcp"
      NODE_TLS_REJECT_UNAUTHORIZED = "0"
    }
  }) -Force
  Write-Host "rohan-auditor OK"
}

$botLauncher = Join-Path $PSScriptRoot "..\mcp\bottrader-stdio-launcher.mjs"
$bridgeUrl = "http://localhost:5011"
$baseConfig.mcpServers | Add-Member -NotePropertyName "bottrader" -NotePropertyValue ([PSCustomObject]@{
  command = $nodeExe
  args = @($botLauncher)
  env = [PSCustomObject]@{
    BOTTRADER_BRIDGE_URL = $bridgeUrl
    BOTTRADER_MCP_TOKEN = $Token
  }
}) -Force
Write-Host "bottrader OK (stdio launcher)"

$json = $baseConfig | ConvertTo-Json -Depth 10
foreach ($p in $configPaths) {
  $dir = Split-Path $p
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($p, $json, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Ecrit: $p" -ForegroundColor Green
}

$tunnel = Join-Path $PSScriptRoot "tunnel-mcp.bat"
if (Test-Path $tunnel) {
  $sshProc = Get-Process ssh -ErrorAction SilentlyContinue
  if (-not $sshProc) {
    Start-Process cmd.exe -ArgumentList "/c `"$tunnel`"" -WindowStyle Minimized
    Start-Sleep -Seconds 6
  }
}

$bridgeOk = $false
try {
  $h = Invoke-RestMethod -Uri "http://localhost:5011/health" -TimeoutSec 8
  if ($h.status -eq "ok") { $bridgeOk = $true; Write-Host "Tunnel/bridge OK" -ForegroundColor Green }
} catch { }

if (-not $bridgeOk) {
  try {
    $h = Invoke-RestMethod -Uri "http://176.97.70.254:5011/health" -TimeoutSec 8
    if ($h.status -eq "ok") {
      Write-Host "Bridge direct VPS OK" -ForegroundColor Green
      $obj = Get-Content $configPaths[0] -Raw | ConvertFrom-Json
      $obj.mcpServers.bottrader.env.BOTTRADER_BRIDGE_URL = "http://176.97.70.254:5011"
      $nj = $obj | ConvertTo-Json -Depth 10
      foreach ($p in $configPaths) {
        [System.IO.File]::WriteAllText($p, $nj, [System.Text.UTF8Encoding]::new($false))
      }
    }
  } catch {
    Write-Host "Bridge inaccessible" -ForegroundColor Red
  }
}

Get-Process -Name "Claude" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$claudeExe = "$env:LOCALAPPDATA\Microsoft\WindowsApps\Claude.exe"
if (-not (Test-Path $claudeExe)) {
  $claudeExe = "$env:LOCALAPPDATA\Programs\Claude\Claude.exe"
}
if (Test-Path $claudeExe) {
  Start-Process $claudeExe
  Write-Host "Claude relance" -ForegroundColor Green
}

Write-Host ""
Write-Host "Serveurs MCP:" -ForegroundColor Cyan
$baseConfig.mcpServers.PSObject.Properties.Name | ForEach-Object { Write-Host "  - $_" }
Write-Host "=== FIX TERMINE ===" -ForegroundColor Cyan
