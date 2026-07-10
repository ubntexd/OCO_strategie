# SETUP CLAUDE DESKTOP — ROHAN BotTrader v1.0
# Usage: powershell -ExecutionPolicy Bypass -File setup-claude-desktop-windows.ps1 [-Token "hex..."]

param(
  [string]$Token = "",
  [string]$VpsIp = "176.97.70.254",
  [string]$SshUser = "dev"
)

$ErrorActionPreference = "Continue"

Write-Host "=== SETUP CLAUDE DESKTOP MCP — BotTrader v1.0 ===" -ForegroundColor Cyan

if (-not $Token) {
  $tokenFile = Join-Path $PSScriptRoot "..\logs\mcp-token.txt"
  if (Test-Path $tokenFile) {
    $Token = (Get-Content $tokenFile -Raw).Trim()
  } else {
  $Token = "CHANGE_ME_256_BITS"
  Write-Host "Token par défaut — récupérer depuis VPS: /tmp/bottrader_mcp_token.txt" -ForegroundColor Yellow
  }
}

$configPaths = @(
  "$env:APPDATA\Claude\claude_desktop_config.json",
  "$env:LOCALAPPDATA\Claude\claude_desktop_config.json",
  "$env:USERPROFILE\.claude\claude_desktop_config.json"
)

$configFile = $null
foreach ($p in $configPaths) {
  if (Test-Path $p) { $configFile = $p; break }
}
if (-not $configFile) {
  $configFile = "$env:APPDATA\Claude\claude_desktop_config.json"
  New-Item -ItemType Directory -Force -Path (Split-Path $configFile) | Out-Null
}

Write-Host "Config: $configFile"

$config = @{ mcpServers = @{} }
if (Test-Path $configFile) {
  try {
    $raw = Get-Content $configFile -Raw -Encoding UTF8
    if ($raw.Trim()) { $config = $raw | ConvertFrom-Json -AsHashtable }
    if (-not $config.mcpServers) { $config.mcpServers = @{} }
  } catch {
    $config = @{ mcpServers = @{} }
  }
}

$config.mcpServers["bottrader"] = @{
  command = "npx"
  args = @("-y", "mcp-remote", "http://localhost:5011", "--header", "x-mcp-token: $Token")
}

$json = $config | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($configFile, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Config MCP bottrader écrite" -ForegroundColor Green

if (Get-Command npx -ErrorAction SilentlyContinue) {
  npm install -g mcp-remote 2>$null
  Write-Host "mcp-remote installé/vérifié"
}

$tunnelBat = Join-Path $PSScriptRoot "tunnel-mcp.bat"
if (Test-Path $tunnelBat) {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$tunnelBat`"" -WindowStyle Minimized
  Start-Sleep -Seconds 4
  Write-Host "Tunnel SSH lancé (minimisé)"
}

$ok = $false
try {
  $h = Invoke-RestMethod -Uri "http://localhost:5011/health" -TimeoutSec 8
  if ($h.status -eq "ok") { $ok = $true; Write-Host "Tunnel OK: $($h.status)" -ForegroundColor Green }
} catch {}

if (-not $ok) {
  try {
    $h = Invoke-RestMethod -Uri "http://${VpsIp}:5011/health" -TimeoutSec 8
    if ($h.status -eq "ok") {
      $config.mcpServers["bottrader"].args[2] = "http://${VpsIp}:5011"
      $config | ConvertTo-Json -Depth 10 | Set-Content $configFile -Encoding UTF8
      Write-Host "Connexion directe VPS OK — config mise à jour IP $VpsIp" -ForegroundColor Green
      $ok = $true
    }
  } catch {
    Write-Host "Bridge non joignable — vérifier VPS/tunnel" -ForegroundColor Red
  }
}

$claudePaths = @(
  "$env:LOCALAPPDATA\Programs\Claude\Claude.exe",
  "$env:LOCALAPPDATA\Claude\Claude.exe",
  "$env:APPDATA\Claude\Claude.exe"
)
$claudeProc = Get-Process -Name "Claude" -ErrorAction SilentlyContinue
if ($claudeProc) {
  Stop-Process -Name "Claude" -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
foreach ($cp in $claudePaths) {
  if (Test-Path $cp) {
    Start-Process $cp
    Write-Host "Claude Desktop relancé: $cp" -ForegroundColor Green
    break
  }
}

Write-Host "=== SETUP WINDOWS TERMINÉ ===" -ForegroundColor Cyan
